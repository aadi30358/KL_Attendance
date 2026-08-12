import { SEMESTER_MAP, getAcademicYearCode, findAcademicYearFromHtml, getCandidateYearIdsForYear, findSemesterFromHtml, isHtmlMatchingRequestedYear } from '../config/api';
import { db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

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
        formData.append('academicyear', yearId);
        formData.append('semesterid', semId);
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

        let response = await fetch('/index.php?r=studentattendance%2Fstudentdailyattendance%2Fcourselist', {
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

        let html = await response.text();

        if (response.status === 400 && html.includes('Unable to verify your data submission')) {
            throw new Error("Your session has expired. Please completely sign out and log in again.");
        }

        if (!response.ok) {
            console.error("ERP HTTP Error:", response.status, response.statusText);
            throw new Error(`Session error (${response.status}). Please log out and sign in again.`);
        }

        const parser = new DOMParser();
        let doc = parser.parseFromString(html, 'text/html');
        if (doc.getElementById('login-form')) {
            throw new Error("Your session has expired. Please log out and sign in again.");
        }

        let subjects = this.parseSubjects(html);

        // Fallback: If courselist yielded 0 subjects, attempt posting to index route
        if (!subjects || subjects.length === 0) {
            try {
                const indexResp = await fetch('/index.php?r=studentattendance%2Fstudentdailyattendance%2Findex', {
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
                if (indexResp.ok) {
                    const indexHtml = await indexResp.text();
                    const indexSubjects = this.parseSubjects(indexHtml);
                    if (indexSubjects && indexSubjects.length > 0) {
                        return { subjects: indexSubjects, html: indexHtml };
                    }
                }
            } catch (e) {
                console.warn("[ERP] Index POST fallback failed", e);
            }
        }

        return { subjects, html };
    },

    // Fetch live attendance index page to scrape real option values & CSRF token
    async getAttendancePageOptions(year, semester) {
        try {
            const timestamp = new Date().getTime();
            const response = await fetch(`/index.php?r=studentattendance%2Fstudentdailyattendance%2Fsearchgetinput&_t=${timestamp}`, {
                method: 'GET',
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

    // Fetch Subjects and Attendance (Wrapped with Firebase Cache)
    async fetchAttendance(year, semester) {
        const username = sessionStorage.getItem('erp_username');
        const cacheDocId = username ? `${username}_${year}_${semester}` : null;
        
        // 1. Read from Cache
        if (cacheDocId) {
            try {
                const docRef = doc(db, 'attendanceCache', cacheDocId);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    const now = new Date().getTime();
                    // 6 hours cache validity (21600000 ms)
                    if (now - data.last_updated < 21600000) {
                        console.log(`[ERP] Fetched attendance from Firebase cache for ${year} ${semester}`);
                        return data.subjects;
                    }
                }
            } catch (err) {
                console.warn("[ERP] Firebase cache read error:", err);
            }
        }

        // 2. Scrape from ERP
        const subjects = await this._fetchAttendanceFromERP(year, semester);

        // 3. Write to Cache
        if (cacheDocId && subjects && subjects.length > 0) {
            try {
                const docRef = doc(db, 'attendanceCache', cacheDocId);
                await setDoc(docRef, {
                    subjects: subjects,
                    last_updated: new Date().getTime()
                });
                console.log(`[ERP] Saved attendance to Firebase cache for ${year} ${semester}`);
            } catch (err) {
                console.warn("[ERP] Firebase cache write error:", err);
            }
        }

        return subjects;
    },

    // Actual Scraping Logic
    async _fetchAttendanceFromERP(year, semester) {
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

        let fallbackSubjects = null;
        let fallbackCandidate = null;

        for (const candidateYearId of candidateYearIds) {
            for (const candidateSemId of candidateSemIds) {
                try {
                    const { subjects, html } = await this._postFetchAttendance(candidateYearId, candidateSemId, csrfToken);
                    const isLiveId = (candidateYearId === liveYearId);
                    
                    if (subjects && subjects.length > 0) {
                        if (isLiveId || isHtmlMatchingRequestedYear(html, year)) {
                            console.log(`[ERP] Successfully fetched ${subjects.length} subjects for requested year ${year} with yearId: ${candidateYearId}, semId: ${candidateSemId}`);
                            return subjects;
                        } else {
                            console.warn(`[ERP] Saving fallback subjects for yearId ${candidateYearId} despite HTML mismatch with requested year ${year}`);
                            if (!fallbackSubjects) {
                                fallbackSubjects = subjects;
                                fallbackCandidate = { yearId: candidateYearId, semId: candidateSemId };
                            }
                        }
                    }
                } catch (err) {
                    if (err.message?.includes('session has expired') || err.message?.includes('Session error')) {
                        throw err;
                    }
                    console.warn(`[ERP] Candidate yearId ${candidateYearId} / semId ${candidateSemId} failed:`, err);
                }
            }
        }

        if (fallbackSubjects && fallbackSubjects.length > 0) {
            console.log(`[ERP] Using fallback subjects from candidate yearId ${fallbackCandidate.yearId} because no perfect HTML match was found.`);
            return fallbackSubjects;
        }

        // Auto-extract registered subjects from user data / dashboard HTML
        if (isHtmlMatchingRequestedYear(dashboardHtml, year)) {
            console.log(`[ERP] Auto-extracting registered subjects for ${year} (${semester} Sem) from user data...`);
            return this.extractRegisteredCoursesFromUserData(dashboardHtml, liveOptions?.html);
        } else {
            throw new Error(`No attendance data found for ${year} ${semester} Semester`);
        }
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

            const cols = Array.from(row.querySelectorAll('td')).map(td => td.textContent.trim());
            if (cols.length < 2) return;

            // Detect course code and title
            let code = '';
            let title = '';
            let ltps = 'N/A';
            let rawConducted = 0;
            let rawAttended = 0;

            if (cols.length >= 4) {
                // Standard ERP table structure
                code = cols[1];
                title = cols[2];
                ltps = cols[3] || 'N/A';
            }

            // Fallback for non-standard column index: search for code matching pattern or column
            if (!code || !/^[A-Za-z0-9\s-]{4,15}$/.test(code) || /^\d+$/.test(code) || code.toLowerCase().includes('course') || title.toLowerCase().includes('title')) {
                const codeIdx = cols.findIndex(c => /\b[0-9]{2}[A-Z]{1,5}[0-9]{3,5}[A-Z]?\b/i.test(c));
                if (codeIdx !== -1) {
                    code = cols[codeIdx];
                    title = cols[codeIdx + 1] || cols[codeIdx - 1] || '';
                    if (cols[codeIdx + 2] && ['L', 'T', 'P', 'S', 'Lecture', 'Tutorial', 'Practical', 'Skill'].some(k => cols[codeIdx + 2].includes(k))) {
                        ltps = cols[codeIdx + 2];
                    }
                }
            }

            if (!code || !title || /^\d+$/.test(code) || code.toLowerCase().includes('course') || title.toLowerCase().includes('title')) {
                return;
            }

            // Extract numbers for conducted & attended
            if (cols.length >= 10) {
                rawConducted = parseInt(cols[8] || '0', 10) || 0;
                rawAttended = parseInt(cols[9] || '0', 10) || 0;
            } else {
                const numbers = cols.map(c => parseInt(c, 10)).filter(n => !isNaN(n) && n >= 0);
                if (numbers.length >= 2) {
                    rawConducted = numbers[numbers.length - 2];
                    rawAttended = numbers[numbers.length - 1];
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

    extractRegisteredCoursesFromUserData(dashboardHtml, liveHtml) {
        const combinedHtml = (dashboardHtml || '') + ' ' + (liveHtml || '');
        const subjectMap = new Map();

        if (combinedHtml.trim()) {
            try {
                const parser = new DOMParser();
                const doc = parser.parseFromString(combinedHtml, 'text/html');

                const elements = doc.querySelectorAll('tr, li, div.card, div.box, div.panel, p, span, td, a');
                elements.forEach(el => {
                    const text = el.textContent.trim();
                    // Match valid KL University course codes like 24CS3101, 23SDCS11, 22EC2101, 24UC1101
                    const match = text.match(/\b([0-9]{2}[A-Z]{1,5}[0-9]{3,5}[A-Z]?)\b/i);
                    if (match && /[A-Za-z]/.test(match[1]) && /\d{3,}/.test(match[1])) {
                        const code = match[1].toUpperCase();
                        let title = text.replace(match[1], '').replace(/[\s\-_:=]+/g, ' ').trim();
                        title = title.split('\n')[0].trim();
                        if (title.length > 50) title = title.slice(0, 50);
                        if (!title || /^\d+$/.test(title)) title = `Course ${code}`;

                        if (!subjectMap.has(code) && !code.toLowerCase().includes('course')) {
                            subjectMap.set(code, {
                                code: code,
                                title: title,
                                ltps: 'L + T + P',
                                components: {
                                    'Lecture': { conducted: 0, attended: 0, percent: 0 },
                                    'Tutorial': { conducted: 0, attended: 0, percent: 0 },
                                    'Practical': { conducted: 0, attended: 0, percent: 0 }
                                },
                                attended: '0/0',
                                percent: 0,
                                isAutoExtracted: true
                            });
                        }
                    }
                });
            } catch (e) {
                console.warn("[ERP] Failed parsing registered courses from user HTML", e);
            }
        }

        if (subjectMap.size > 0) {
            return Array.from(subjectMap.values());
        }

        // Output debug HTML if nothing worked
        throw new Error(`DEBUG_HTML:` + (liveHtml || dashboardHtml || 'No HTML available to debug.'));
    },

    async getCaptchaUrl() {
        const apiBase = import.meta.env.VITE_API_URL || '';
        return `${apiBase}/api/captcha?v=${Math.random().toString(36).substring(7)}`;
    }
};


