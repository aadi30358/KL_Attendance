import { SEMESTER_MAP, getAcademicYearCode, getCandidateYearIdsForYear } from '../config/api';

export const erpService = {
    // Fetch the login page to scrape CSRF token and initial captcha atomically
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
        const csrfToken = doc.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ||
                          doc.querySelector('input[name="_csrf"]')?.getAttribute('value');

        // Extract the exact captcha image URL generated for this session
        let captchaSrc = doc.getElementById('loginFormCaptcha-image')?.getAttribute('src') ||
                         doc.querySelector('img[src*="captcha"]')?.getAttribute('src');
        if (captchaSrc) {
            captchaSrc = captchaSrc.replace(/&amp;/g, '&');
            if (captchaSrc.includes('newerp.kluniversity.in/')) {
                captchaSrc = captchaSrc.replace(/^https?:\/\/newerp\.kluniversity\.in/i, '');
            }
        }

        let captchaBlob = null;
        if (captchaSrc) {
            try {
                const captchaResp = await fetch(captchaSrc, {
                    credentials: 'include',
                    cache: 'no-store',
                    headers: {
                        'Pragma': 'no-cache',
                        'Cache-Control': 'no-cache'
                    }
                });
                if (captchaResp.ok) {
                    captchaBlob = await captchaResp.blob();
                }
            } catch (e) {
                console.warn('[ERP] Failed to load initial captcha image:', e);
            }
        }

        return { csrfToken, captchaSrc, captchaBlob };
    },

    // Refresh captcha via Yii2 official refresh endpoint with refresh=1
    async refreshCaptcha() {
        try {
            let refreshResp = await fetch('/index.php?r=site%2Fcaptcha&refresh=1', {
                credentials: 'include',
                cache: 'no-store',
                headers: {
                    'Pragma': 'no-cache',
                    'Cache-Control': 'no-cache',
                    'X-Requested-With': 'XMLHttpRequest'
                }
            });

            let newUrl = null;
            if (refreshResp.ok) {
                try {
                    const data = await refreshResp.json();
                    if (data && data.url) {
                        newUrl = data.url.replace(/&amp;/g, '&');
                    }
                } catch {
                    // Not JSON, continue to fallback
                }
            }

            if (!newUrl) {
                newUrl = '/index.php?r=site%2Fcaptcha&v=' + Math.random();
            }

            const imgResp = await fetch(newUrl, {
                credentials: 'include',
                cache: 'no-store',
                headers: {
                    'Pragma': 'no-cache',
                    'Cache-Control': 'no-cache'
                }
            });
            const blob = await imgResp.blob();
            return { blob, url: newUrl };
        } catch (e) {
            console.error('[ERP] refreshCaptcha error:', e);
            throw e;
        }
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
            credentials: 'include',
            cache: 'no-store'
        });

        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // Check for specific field error blocks
        const errorBlocks = doc.querySelectorAll('.help-block, .help-block-error');
        for (const el of errorBlocks) {
            const txt = el.textContent.trim();
            if (txt && !txt.includes('*') && txt !== 'Enter Username' && txt !== 'Enter Password') {
                if (txt.toLowerCase().includes('verification code') || txt.toLowerCase().includes('captcha')) {
                    throw new Error("Invalid Captcha. Please re-enter the captcha.");
                }
                if (txt.toLowerCase().includes('incorrect username') || txt.toLowerCase().includes('password')) {
                    throw new Error(txt);
                }
            }
        }

        const pwdError = doc.querySelector('.field-loginFormPasswordID .help-block, .field-loginform-password .help-block');
        if (pwdError && pwdError.textContent.trim()) {
            throw new Error(pwdError.textContent.trim());
        }

        const captchaError = doc.querySelector('.field-loginFormCaptcha .help-block, .field-loginform-captcha .help-block');
        if (captchaError && captchaError.textContent.trim()) {
            throw new Error("Invalid Captcha. Please re-enter the captcha.");
        }

        const generalError = doc.querySelector('.text-danger:not(span)');
        if (generalError && generalError.textContent.trim() && generalError.textContent.trim() !== '*') {
            throw new Error(generalError.textContent.trim());
        }

        // Success detection: If we are redirected or see dashboard elements
        const loginForm = doc.getElementById('login-form');
        if (!loginForm) {
            return { success: true, html };
        } else {
            const alertDanger = doc.querySelector('.alert-danger, .callout-danger');
            if (alertDanger && alertDanger.textContent.trim()) {
                throw new Error(alertDanger.textContent.trim());
            }
            throw new Error("Login failed. Please check your credentials.");
        }
    },

    // Destroy ERP session cookie
    async erpLogout() {
        try {
            const csrfToken = this.getCachedCsrfToken();
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

    // Helper to get CSRF token from cached dashboard HTML
    getCachedCsrfToken() {
        try {
            const dashboardHtml = localStorage.getItem('erpDashboardHtml');
            if (dashboardHtml) {
                const parser = new DOMParser();
                const doc = parser.parseFromString(dashboardHtml, 'text/html');
                return doc.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ||
                       doc.querySelector('input[name="_csrf"]')?.getAttribute('value') || null;
            }
        } catch {
            return null;
        }
        return null;
    },

    // Parse Student Data from Dashboard HTML
    parseStudentData(html) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        let name = "Student";
        let image = "/assets/default-user.png";

        const nameEl = doc.querySelector('.profile_info h2') || doc.querySelector('.user-profile');
        if (nameEl) name = nameEl.textContent.trim();

        const imgEl = doc.querySelector('.profile_pic img') || doc.querySelector('img.img-circle');
        if (imgEl) {
            const src = imgEl.getAttribute('src');
            if (src) image = src;
        }

        return { name, image };
    },

    // Parse the search form HTML to extract available academic years, semesters, and active selections
    parseSearchInputHtml(html) {
        if (!html) return null;
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        const csrfToken = doc.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ||
                          doc.querySelector('input[name="_csrf"]')?.getAttribute('value') ||
                          this.getCachedCsrfToken();

        const years = [];
        let selectedYear = null;
        const yearSelect = doc.querySelector('select[name*="academicyear"], select#dynamicmodel-academicyear, select#academicyear');
        if (yearSelect) {
            yearSelect.querySelectorAll('option').forEach(opt => {
                const val = (opt.getAttribute('value') || opt.value || '').trim();
                const text = opt.textContent.trim();
                if (val && val !== '') {
                    const isSelected = opt.hasAttribute('selected') || opt.selected;
                    years.push({ value: val, text, isSelected });
                    if (isSelected) {
                        selectedYear = { value: val, text };
                    }
                }
            });
        }

        const semesters = [];
        let selectedSemester = null;
        const semSelect = doc.querySelector('select[name*="semesterid"], select#dynamicmodel-semesterid, select#semesterid');
        if (semSelect) {
            semSelect.querySelectorAll('option').forEach(opt => {
                const val = (opt.getAttribute('value') || opt.value || '').trim();
                const text = opt.textContent.trim();
                if (val && val !== '') {
                    const isSelected = opt.hasAttribute('selected') || opt.selected;
                    semesters.push({ value: val, text, isSelected });
                    if (isSelected) {
                        selectedSemester = { value: val, text };
                    }
                }
            });
        }

        return { csrfToken, years, semesters, selectedYear, selectedSemester, rawHtml: html };
    },

    // Prime the Yii2 controller session and fetch real options
    async getAvailableSessions() {
        try {
            let resp = await fetch('/index.php?r=studentattendance%2Fstudentdailyattendance%2Fsearchgetinput', {
                method: 'GET',
                credentials: 'include',
                cache: 'no-store',
                headers: {
                    'Pragma': 'no-cache',
                    'Cache-Control': 'no-cache',
                    'X-Requested-With': 'XMLHttpRequest'
                }
            });

            if (!resp.ok || resp.status === 404) {
                resp = await fetch('/index.php?r=studentattendance%2Fstudentdailyattendance%2Findex', {
                    method: 'GET',
                    credentials: 'include',
                    cache: 'no-store',
                    headers: {
                        'Pragma': 'no-cache',
                        'Cache-Control': 'no-cache'
                    }
                });
            }

            if (!resp.ok) return null;
            const html = await resp.text();
            if (html.includes('id="login-form"') || html.includes('loginFormUserNameID')) {
                return null;
            }

            return this.parseSearchInputHtml(html);
        } catch (e) {
            console.warn("[ERP] Failed to retrieve dynamic session options:", e);
            return null;
        }
    },

    // Fetch Subjects and Attendance with automatic session priming and candidate fallbacks
    async fetchAttendance(year, semester) {
        console.log(`[ERP] Fetch Attendance initiated -> Year: "${year}", Semester: "${semester}"`);

        // 1. Prime the controller session and discover dynamic options
        let sessionInfo = null;
        try {
            sessionInfo = await this.getAvailableSessions();
        } catch (e) {
            console.warn("[ERP] Session priming warning:", e);
        }

        const csrfToken = sessionInfo?.csrfToken || this.getCachedCsrfToken();

        // 2. Resolve matching year ID
        let matchedYearVal = null;
        const reqYearStr = String(year || '').trim().toLowerCase();

        if (sessionInfo?.years && sessionInfo.years.length > 0) {
            // Text match (e.g. "2026-2027", "26-27", "2026")
            const textMatch = sessionInfo.years.find(y => 
                y.text.toLowerCase() === reqYearStr ||
                y.text.toLowerCase().includes(reqYearStr) ||
                reqYearStr.includes(y.text.toLowerCase())
            );
            if (textMatch) matchedYearVal = textMatch.value;

            // Start year match (e.g. "2026")
            if (!matchedYearVal && reqYearStr.includes('-')) {
                const startY = reqYearStr.split('-')[0].trim();
                const startMatch = sessionInfo.years.find(y => y.text.startsWith(startY) || y.text.includes(startY));
                if (startMatch) matchedYearVal = startMatch.value;
            }

            // Direct value match
            if (!matchedYearVal) {
                const valMatch = sessionInfo.years.find(y => y.value === year);
                if (valMatch) matchedYearVal = valMatch.value;
            }
        }

        // 3. Resolve semester ID
        let semId = SEMESTER_MAP[semester] || '1';
        const reqSemStr = String(semester || '').trim().toLowerCase();

        if (sessionInfo?.semesters && sessionInfo.semesters.length > 0) {
            const semMatch = sessionInfo.semesters.find(s => 
                s.text.toLowerCase() === reqSemStr ||
                s.text.toLowerCase().includes(reqSemStr) ||
                (reqSemStr.includes('odd') && (s.value === '1' || s.text.toLowerCase().includes('odd'))) ||
                (reqSemStr.includes('even') && (s.value === '2' || s.text.toLowerCase().includes('even'))) ||
                (reqSemStr.includes('summer') && (s.value === '3' || s.text.toLowerCase().includes('summer'))) ||
                (reqSemStr.includes('term') && (s.value === '4' || s.text.toLowerCase().includes('term')))
            );
            if (semMatch) semId = semMatch.value;
        }

        // 4. Candidate IDs to try (matched first, then standard 2026 mappings, then selected default)
        const candidateYearIds = getCandidateYearIdsForYear(year, matchedYearVal, sessionInfo?.selectedYear?.value);
        console.log(`[ERP] Candidate Year IDs to query:`, candidateYearIds, `SemId:`, semId);

        let subjects = [];
        let lastHtml = '';
        let lastError = null;

        for (const currentYearId of candidateYearIds) {
            try {
                const formData = new URLSearchParams();
                formData.append('DynamicModel[academicyear]', String(currentYearId));
                formData.append('DynamicModel[semesterid]', String(semId));
                formData.append('DynamicModel[academic_year]', String(currentYearId));
                formData.append('DynamicModel[semester_id]', String(semId));
                formData.append('academicyear', String(currentYearId));
                formData.append('semesterid', String(semId));
                if (csrfToken) {
                    formData.append('_csrf', csrfToken);
                    formData.append('_csrf-frontend', csrfToken);
                }

                const headers = {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'X-Requested-With': 'XMLHttpRequest',
                    'Pragma': 'no-cache',
                    'Cache-Control': 'no-cache',
                    'Referer': 'https://newerp.kluniversity.in/index.php?r=studentattendance%2Fstudentdailyattendance%2Fsearchgetinput'
                };
                if (csrfToken) {
                    headers['X-CSRF-Token'] = csrfToken;
                }

                const response = await fetch('/index.php?r=studentattendance%2Fstudentdailyattendance%2Fcourselist', {
                    method: 'POST',
                    headers,
                    body: formData,
                    credentials: 'include',
                    cache: 'no-store'
                });

                if (response.status === 400) {
                    const errorText = await response.text();
                    if (errorText.includes('Unable to verify your data submission')) {
                        throw new Error("Your session has expired. Please completely sign out and log in again.");
                    }
                    continue;
                }

                if (!response.ok) {
                    console.warn(`[ERP] Candidate Year ID ${currentYearId} returned status ${response.status}`);
                    continue;
                }

                const html = await response.text();
                lastHtml = html;

                if (html.includes('id="login-form"') || html.includes('loginFormUserNameID')) {
                    throw new Error("Your session has expired. Please log out and sign in again.");
                }

                const parsed = this.parseSubjects(html);
                if (parsed.length > 0) {
                    subjects = parsed;
                    console.log(`[ERP] Successfully fetched ${subjects.length} courses with YearId: ${currentYearId}`);
                    break;
                }
            } catch (err) {
                lastError = err;
                if (err.message?.includes('expired') || err.message?.includes('sign in')) {
                    throw err;
                }
                console.warn(`[ERP] Error querying Year ID ${currentYearId}:`, err.message);
            }
        }

        if (subjects.length > 0) {
            return subjects;
        }

        if (lastError && lastError.message?.includes('expired')) {
            throw lastError;
        }

        if (lastHtml) {
            const parser = new DOMParser();
            const doc = parser.parseFromString(lastHtml, 'text/html');
            if (doc.getElementById('login-form')) {
                throw new Error("Your session has expired. Please log out and sign in again.");
            }
        }

        // Return empty array to trigger standard "No Courses Found" view gracefully
        return [];
    },

    // Resilient Parser for Attendance HTML
    parseSubjects(html) {
        if (!html) return [];
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const subjectMap = new Map();

        // Standard LTPS Weights: Lecture=100, Tutorial=100, Practical=50, Skill=25
        const getWeight = (ltpsType) => {
            const type = (ltpsType || '').toLowerCase();
            if (type.includes('lecture') || type === 'l') return 100;
            if (type.includes('practical') || type === 'p') return 50;
            if (type.includes('theory') || type.includes('tutorial') || type === 't') return 100;
            if (type.includes('skill') || type === 's') return 25;
            return 1;
        };

        const tables = doc.querySelectorAll('table');

        tables.forEach(table => {
            let codeIdx = 1;
            let titleIdx = 2;
            let ltpsIdx = 3;
            let conductedIdx = 8;
            let attendedIdx = 9;

            // Detect headers if available
            const ths = Array.from(table.querySelectorAll('th'));
            if (ths.length >= 4) {
                ths.forEach((th, idx) => {
                    const txt = th.textContent.trim().toLowerCase();
                    if (txt.includes('code')) codeIdx = idx;
                    else if (txt.includes('title') || txt.includes('name') || txt.includes('course')) titleIdx = idx;
                    else if (txt.includes('ltps') || txt.includes('component') || txt.includes('type')) ltpsIdx = idx;
                    else if (txt.includes('conducted')) conductedIdx = idx;
                    else if (txt.includes('attended') || txt.includes('present')) attendedIdx = idx;
                });
            }

            const rows = table.querySelectorAll('tr');

            rows.forEach(row => {
                // Ignore pure header rows
                if (row.querySelector('th') && !row.querySelector('td')) return;

                const cols = row.querySelectorAll('td');
                if (cols.length < 3) return;

                let code = cols[codeIdx]?.textContent.trim();
                let title = cols[titleIdx]?.textContent.trim();
                let ltps = cols[ltpsIdx]?.textContent.trim() || 'N/A';

                // If standard index didn't produce a valid course code, scan cells
                if (!code || code.length < 3 || code.toLowerCase().includes('code')) {
                    for (let i = 0; i < cols.length; i++) {
                        const cellText = cols[i].textContent.trim();
                        // Alphanumeric course code pattern (e.g., 23CS2101, 24AD01HF)
                        if (/^[0-9]{2}[A-Za-z]{2,5}[0-9A-Za-z]+$/.test(cellText)) {
                            code = cellText;
                            if (cols[i + 1]) title = cols[i + 1].textContent.trim();
                            if (cols[i + 2]) ltps = cols[i + 2].textContent.trim();
                            break;
                        }
                    }
                }

                if (!code || !title) return;
                if (code.toLowerCase() === 'course code' || code.toLowerCase() === 'code') return;

                // Extract conducted and attended numbers
                let rawConducted = 0;
                let rawAttended = 0;

                if (cols[conductedIdx] && cols[attendedIdx]) {
                    rawConducted = parseInt(cols[conductedIdx].textContent.trim() || '0', 10) || 0;
                    rawAttended = parseInt(cols[attendedIdx].textContent.trim() || '0', 10) || 0;
                }

                // Fallback: look for "Attended/Conducted" format in any column
                if (rawConducted === 0 && rawAttended === 0) {
                    for (let i = 0; i < cols.length; i++) {
                        const t = cols[i].textContent.trim();
                        if (t.includes('/')) {
                            const parts = t.split('/');
                            const a = parseInt(parts[0], 10);
                            const c = parseInt(parts[1], 10);
                            if (!isNaN(a) && !isNaN(c) && c > 0) {
                                rawAttended = a;
                                rawConducted = c;
                                break;
                            }
                        }
                    }
                }

                const weight = getWeight(ltps);
                const conducted = rawConducted * weight;
                const attended = rawAttended * weight;
                const componentName = ltps !== 'N/A' && ltps !== '' ? ltps : 'Unknown';
                const componentPercent = rawConducted > 0 ? parseFloat(((rawAttended / rawConducted) * 100).toFixed(2)) : 0;
                const componentData = {
                    conducted: rawConducted,
                    attended: rawAttended,
                    percent: componentPercent
                };

                if (!subjectMap.has(code)) {
                    subjectMap.set(code, {
                        code,
                        title,
                        ltpsArray: ltps !== 'N/A' && ltps !== '' ? [ltps] : [],
                        components: { [componentName]: componentData },
                        totalConducted: conducted,
                        totalAttended: attended,
                        rawConducted,
                        rawAttended
                    });
                } else {
                    const existing = subjectMap.get(code);
                    if (ltps !== 'N/A' && ltps !== '' && !existing.ltpsArray.includes(ltps)) {
                        existing.ltpsArray.push(ltps);
                    }

                    if (existing.components[componentName]) {
                        existing.components[componentName].conducted += rawConducted;
                        existing.components[componentName].attended += rawAttended;
                        const cTot = existing.components[componentName].conducted;
                        existing.components[componentName].percent = cTot > 0
                            ? parseFloat(((existing.components[componentName].attended / cTot) * 100).toFixed(2))
                            : 0;
                    } else {
                        existing.components[componentName] = componentData;
                    }

                    existing.totalConducted += conducted;
                    existing.totalAttended += attended;
                    existing.rawConducted += rawConducted;
                    existing.rawAttended += rawAttended;
                }
            });
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
    },

    // Backward compatibility helper
    clearStoredErpCookies() {
        sessionStorage.removeItem('erp_session_cookie');
        localStorage.removeItem('erp_session_cookie');
        sessionStorage.removeItem('erp_csrf_token');
        localStorage.removeItem('erp_csrf_token');
    }
};

export const clearStoredErpCookies = () => erpService.clearStoredErpCookies();
export const getStoredErpCookies = () => '';
export const getStoredCsrfToken = () => erpService.getCachedCsrfToken();

