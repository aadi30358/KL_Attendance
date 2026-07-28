import { SEMESTER_MAP, getAcademicYearCode, findAcademicYearFromHtml, getCandidateYearIdsForYear, findSemesterFromHtml } from '../config/api';

export const erpService = {
    // Fetch the login page to scrape CSRF token
    async getInitialState() {
        const timestamp = new Date().getTime();
        const response = await fetch(`/index.php?_t=${timestamp}`, { 
            credentials: 'include',
            cache: 'no-store',
            headers: {
                'Pragma': 'no-cache',
                'Cache-Control': 'no-cache'
            }
        });
        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const csrfToken = doc.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
        return { csrfToken };
    },

    // Login function
    async login(username, password, captcha, csrfToken) {
        const formData = new URLSearchParams();
        formData.append('_csrf', csrfToken);
        formData.append('LoginForm[username]', username);
        formData.append('LoginForm[password]', password);
        formData.append('LoginForm[rememberMe]', '0');
        formData.append('LoginForm[captcha]', captcha);
        formData.append('login-button', '');

        const response = await fetch('/index.php?r=site%2Flogin', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Pragma': 'no-cache',
                'Cache-Control': 'no-cache'
            },
            body: formData,
            credentials: 'include', // Guarantee the browser saves the new Set-Cookie header
            cache: 'no-store'
        });

        const html = await response.text();

        // Check for common error messages
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        const errorBlock = doc.querySelector('.field-loginform-password .help-block');
        if (errorBlock && errorBlock.textContent.trim()) {
            throw new Error(errorBlock.textContent.trim());
        }

        const captchaError = doc.querySelector('.field-loginFormCaptcha .help-block');
        if (captchaError && captchaError.textContent.trim()) {
            throw new Error("Invalid Captcha");
        }

        const generalError = doc.querySelector('.text-danger');
        if (generalError && generalError.textContent.trim()) {
            // Ignore * asterisk
            if (generalError.textContent.trim() !== '*') {
                throw new Error(generalError.textContent.trim());
            }
        }

        // Success detection: If we are redirected or see dashboard elements
        // Typically, after login, we get a 302 redirect. Fetch follows it automatically.
        // So if we land on a page that is NOT the login page, we interpret it as success.
        // The login page usually has id="login-form"
        const loginForm = doc.getElementById('login-form');
        if (!loginForm) {
            return { success: true, html };
        } else {
            throw new Error("Login failed. Please check your credentials.");
        }
    },

    // IMPORTANT: Actually tell the ERP server to destroy the session cookie!
    async erpLogout() {
        try {
            // We need the CSRF token to logout from Yii2
            let csrfToken = null;
            const dashboardHtml = localStorage.getItem('erpDashboardHtml');
            if (dashboardHtml) {
                const parser = new DOMParser();
                const doc = parser.parseFromString(dashboardHtml, 'text/html');
                csrfToken = doc.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
            }

            if (csrfToken) {
                const formData = new URLSearchParams();
                formData.append('_csrf', csrfToken);

                await fetch('/index.php?r=site%2Flogout', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Pragma': 'no-cache',
                        'Cache-Control': 'no-cache'
                    },
                    body: formData,
                    credentials: 'include',
                    cache: 'no-store'
                });
                console.log("Successfully destroyed ERP session cookie.");
            }
        } catch (e) {
            console.error("Failed to notify ERP of logout", e);
        }
    },

    // Parse Student Data from Dashboard HTML
    parseStudentData(html) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        let name = "Student";
        let image = "/assets/default-user.png"; // Fallback

        const nameEl = doc.querySelector('.profile_info h2') || doc.querySelector('.user-profile');
        if (nameEl) name = nameEl.textContent.trim();

        const imgEl = doc.querySelector('.profile_pic img') || doc.querySelector('img.img-circle');
        if (imgEl) {
            const src = imgEl.getAttribute('src');
            if (src) image = src;
        }

        return { name, image };
    },

    // Single request helper
    async _postFetchAttendance(yearId, semId, csrfToken) {
        const formData = new URLSearchParams();
        formData.append('DynamicModel[academicyear]', yearId);
        formData.append('DynamicModel[semesterid]', semId);
        if (csrfToken) {
            formData.append('_csrf', csrfToken);
        }

        const headers = {
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-Requested-With': 'XMLHttpRequest'
        };
        if (csrfToken) {
            headers['X-CSRF-Token'] = csrfToken;
        }

        const response = await fetch('/index.php?r=studentattendance%2Fstudentdailyattendance%2Fcourselist', {
            method: 'POST',
            headers: {
                ...headers,
                'Pragma': 'no-cache',
                'Cache-Control': 'no-cache'
            },
            body: formData,
            credentials: 'include',
            cache: 'no-store'
        });

        const html = await response.text();

        if (response.status === 400 && html.includes('Unable to verify your data submission')) {
            throw new Error("Your session has expired. Please completely sign out and log in again.");
        }

        if (!response.ok) {
            console.error("ERP HTTP Error:", response.status, response.statusText);
            throw new Error(`Session error (${response.status}). Please log out and sign in again.`);
        }

        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        if (doc.getElementById('login-form')) {
            throw new Error("Your session has expired. Please log out and sign in again.");
        }

        const subjects = this.parseSubjects(html);
        return { subjects, html };
    },

    // Fetch live attendance index page to scrape real option values & CSRF token
    async getAttendancePageOptions(year, semester) {
        try {
            const timestamp = new Date().getTime();
            const response = await fetch(`/index.php?r=studentattendance%2Fstudentdailyattendance%2Findex&_t=${timestamp}`, {
                credentials: 'include',
                cache: 'no-store',
                headers: {
                    'Pragma': 'no-cache',
                    'Cache-Control': 'no-cache'
                }
            });
            if (response.ok) {
                const html = await response.text();
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');
                const csrfToken = doc.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
                const parsedYearId = findAcademicYearFromHtml(html, year);
                const parsedSemId = findSemesterFromHtml(html, semester);
                return { csrfToken, parsedYearId, parsedSemId, html };
            }
        } catch (e) {
            console.warn("[ERP] Failed to fetch live attendance index page options", e);
        }
        return null;
    },

    // Fetch Subjects and Attendance
    async fetchAttendance(year, semester) {
        let dashboardHtml = localStorage.getItem('erpDashboardHtml') || '';
        const liveOptions = await this.getAttendancePageOptions(year, semester);

        let csrfToken = liveOptions?.csrfToken || null;
        if (!csrfToken && dashboardHtml) {
            try {
                const parser = new DOMParser();
                const doc = parser.parseFromString(dashboardHtml, 'text/html');
                csrfToken = doc.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
            } catch (e) {
                console.warn("[ERP] Failed to parse cached dashboard HTML", e);
            }
        }

        const liveYearId = liveOptions?.parsedYearId;
        const liveSemId = liveOptions?.parsedSemId;
        const htmlYearId = findAcademicYearFromHtml(dashboardHtml, year);
        const calculatedYearId = getAcademicYearCode(year);
        const semId = SEMESTER_MAP[semester] || '1';

        const primaryYearId = liveYearId || htmlYearId || calculatedYearId;
        console.log(`[ERP] Fetch Attendance -> Year: ${year} (Primary ID: ${primaryYearId}, Live Year ID: ${liveYearId}), Sem: ${semester} (Live Sem ID: ${liveSemId}, Sem ID: ${semId})`);

        if (!primaryYearId || !semId) {
            throw new Error(`Invalid year (${year}) or semester (${semester}) selected.`);
        }

        if (!csrfToken) {
            console.error("[ERP] No CSRF token available for request. Session likely wiped.");
        }

        // Candidate year IDs strictly isolated for requested academic year
        const candidateYearIds = getCandidateYearIdsForYear(year, liveYearId, htmlYearId);

        // Candidate semester IDs (e.g. '1', 'Odd Sem', 'Odd')
        const candidateSemIds = Array.from(new Set([
            liveSemId,
            semId,
            semester,
            semester === 'Odd' ? 'Odd Sem' : semester === 'Even' ? 'Even Sem' : semester
        ])).filter(Boolean);

        for (const candidateYearId of candidateYearIds) {
            for (const candidateSemId of candidateSemIds) {
                try {
                    console.log(`[ERP] Trying candidate yearId: ${candidateYearId}, semId: ${candidateSemId}...`);
                    const { subjects } = await this._postFetchAttendance(candidateYearId, candidateSemId, csrfToken);
                    if (subjects && subjects.length > 0) {
                        console.log(`[ERP] Successfully fetched ${subjects.length} subjects with yearId: ${candidateYearId}, semId: ${candidateSemId}`);
                        return subjects;
                    }
                } catch (err) {
                    if (err.message?.includes('session has expired') || err.message?.includes('Session error')) {
                        throw err;
                    }
                    console.warn(`[ERP] Candidate yearId ${candidateYearId} / semId ${candidateSemId} failed:`, err);
                }
            }
        }

        return [];
    },
    // Parse Subjects from Attendance Page
    parseSubjects(html) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const subjectMap = new Map();

        const getWeight = (ltpsType) => {
            const type = (ltpsType || '').toLowerCase();
            if (type.includes('lecture') || type === 'l') return 100;
            if (type.includes('practical') || type === 'p') return 50;
            if (type.includes('theory') || type.includes('tutorial') || type === 't') return 100;
            if (type.includes('skill') || type === 's') return 25;
            return 1;
        };

        const rows = doc.querySelectorAll('table tr');

        rows.forEach(row => {
            if (row.querySelector('th')) return;

            const cols = row.querySelectorAll('td');
            if (cols.length >= 4) {
                const code = cols[1]?.textContent.trim();
                const title = cols[2]?.textContent.trim();
                const ltps = cols[3]?.textContent.trim() || 'N/A';

                if (!code || !title || code.toLowerCase().includes('course') || title.toLowerCase().includes('title')) {
                    return;
                }

                let rawConducted = 0;
                let rawAttended = 0;

                if (cols.length >= 10) {
                    rawConducted = parseInt(cols[8]?.textContent.trim() || '0', 10) || 0;
                    rawAttended = parseInt(cols[9]?.textContent.trim() || '0', 10) || 0;
                } else {
                    for (let i = 4; i < cols.length; i++) {
                        const val = parseInt(cols[i]?.textContent.trim(), 10);
                        if (!isNaN(val)) {
                            if (rawConducted === 0) rawConducted = val;
                            else if (rawAttended === 0) { rawAttended = val; break; }
                        }
                    }
                }

                const weight = getWeight(ltps);
                const conducted = rawConducted * weight;
                const attended = rawAttended * weight;

                const componentName = ltps !== 'N/A' && ltps !== '' ? ltps : 'Unknown';
                const componentPercent = rawConducted > 0 ? ((rawAttended / rawConducted) * 100).toFixed(2) : 0;
                const componentData = {
                    conducted: rawConducted,
                    attended: rawAttended,
                    percent: parseFloat(componentPercent)
                };

                if (!subjectMap.has(code)) {
                    subjectMap.set(code, {
                        code: code,
                        title: title,
                        ltpsArray: ltps !== 'N/A' && ltps !== '' ? [ltps] : [],
                        components: { [componentName]: componentData },
                        totalConducted: conducted,
                        totalAttended: attended,
                        rawConducted: rawConducted,
                        rawAttended: rawAttended
                    });
                } else {
                    const existing = subjectMap.get(code);
                    if (ltps !== 'N/A' && ltps !== '' && !existing.ltpsArray.includes(ltps)) {
                        existing.ltpsArray.push(ltps);
                    }

                    if (existing.components[componentName]) {
                        existing.components[componentName].conducted += rawConducted;
                        existing.components[componentName].attended += rawAttended;
                        existing.components[componentName].percent = parseFloat((existing.components[componentName].conducted > 0 ? (existing.components[componentName].attended / existing.components[componentName].conducted) * 100 : 0).toFixed(2));
                    } else {
                        existing.components[componentName] = componentData;
                    }

                    existing.totalConducted += conducted;
                    existing.totalAttended += attended;
                    existing.rawConducted += rawConducted;
                    existing.rawAttended += rawAttended;
                }
            }
        });

        return Array.from(subjectMap.values()).map(subj => {
            const percent = subj.totalConducted > 0
                ? Math.ceil((subj.totalAttended / subj.totalConducted) * 100)
                : 0;

            return {
                code: subj.code,
                title: subj.title,
                ltps: subj.ltpsArray.length > 0 ? subj.ltpsArray.join(' + ') : 'N/A',
                components: subj.components,
                attended: `${subj.rawAttended}/${subj.rawConducted}`,
                percent: parseFloat(percent)
            };
        });
    },

    async getCaptchaUrl() {
        const apiBase = import.meta.env.VITE_API_URL || '';
        return `${apiBase}/api/captcha?v=${Math.random().toString(36).substring(7)}`;
    }
};


