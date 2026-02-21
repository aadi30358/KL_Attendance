export const erpService = {
    // Fetch the login page to scrape CSRF token
    async getInitialState() {
        const response = await fetch('/index.php', { credentials: 'include' });
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
            },
            body: formData,
            credentials: 'include' // Guarantee the browser saves the new Set-Cookie header
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
                    },
                    body: formData,
                    credentials: 'include'
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

        // Selectors need to be adjusted based on real HTML. 
        // Assuming some standard classes for now.
        // Option 1: Look for user profile in sidebar
        let name = "Student";
        let image = "/assets/default-user.png"; // Fallback

        // Try to find name
        const nameEl = doc.querySelector('.profile_info h2') || doc.querySelector('.user-profile');
        if (nameEl) name = nameEl.textContent.trim();

        // Try to find image
        const imgEl = doc.querySelector('.profile_pic img') || doc.querySelector('img.img-circle');
        if (imgEl) {
            const src = imgEl.getAttribute('src');
            if (src) image = src;
        }

        return { name, image };
    },

    // Fetch Subjects and Attendance
    async fetchAttendance(year, semester) {
        // Map the user-friendly string (e.g., '2023-2024') to the exact ERP database ID (e.g., '15')
        const yearMap = {
            '2026-2027': '29',
            '2025-2026': '19',
            '2024-2025': '16',
            '2023-2024': '15',
            '2022-2023': '14',
            '2021-2022': '13',
            '2020-2021': '10',
            '2019-2020': '9',
            '2018-2019': '8'
        };

        // Map the semester string to ERP database ID
        const semMap = {
            'Odd': '1',
            'Even': '2',
            'Summer': '3'
        };

        const yearId = yearMap[year];
        const semId = semMap[semester];

        if (!yearId || !semId) {
            throw new Error(`Invalid year (${year}) or semester (${semester}) selected.`);
        }

        console.log(`Setting up AJAX POST for Year: ${year} (ID: ${yearId}), Sem: ${semester} (ID: ${semId})`);

        const formData = new URLSearchParams();
        // The required parameters identified by scraping the native form:
        formData.append('DynamicModel[academicyear]', yearId);
        formData.append('DynamicModel[semesterid]', semId);

        // Include the CSRF token for Yii2
        let csrfToken = null;
        const dashboardHtml = localStorage.getItem('erpDashboardHtml');
        if (dashboardHtml) {
            const parser = new DOMParser();
            const doc = parser.parseFromString(dashboardHtml, 'text/html');
            csrfToken = doc.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
            if (csrfToken) {
                formData.append('_csrf', csrfToken);
            }
        }

        const headers = {
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-Requested-With': 'XMLHttpRequest' // Crucial: Tell Yii2 this is the AJAX call!
        };
        if (csrfToken) {
            headers['X-CSRF-Token'] = csrfToken;
        }

        // We found the TRUE endpoint hidden in the page's Javascript:
        const response = await fetch('/index.php?r=studentattendance%2Fstudentdailyattendance%2Fcourselist', {
            method: 'POST',
            headers: headers,
            body: formData,
            credentials: 'include' // Force browser to send the newest session cookie!
        });

        const html = await response.text();
        console.log("ERP Response HTML Length:", html.length);

        if (!response.ok) {
            console.error("ERP HTTP Error:", response.status, response.statusText);
            throw new Error(`HTTP Error: ${response.status}`);
        }

        const subjects = this.parseSubjects(html);
        console.log("Parsed Subjects:", subjects);

        if (subjects.length === 0) {
            throw new Error("Failed to find any subjects in table. Html length: " + html.length);
        }

        return subjects;
    },
    // Parse Subjects from Attendance Page
    parseSubjects(html) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        // Group by course code
        const subjectMap = new Map();

        // Weights
        const getWeight = (ltpsType) => {
            const type = ltpsType.toLowerCase();
            if (type.includes('lecture') || type === 'l') return 100;
            if (type.includes('practical') || type === 'p') return 50;
            if (type.includes('tutorial') || type === 't') return 25;
            if (type.includes('skill') || type === 's') return 25;
            return 1; // Fallback weight if unknown type
        };

        // Finding the specific table structure from the debug output
        const rows = doc.querySelectorAll('table tbody tr');

        rows.forEach(row => {
            const cols = row.querySelectorAll('td');
            // The exact table has 14 columns
            if (cols.length >= 13) {
                const code = cols[1]?.textContent.trim();
                const title = cols[2]?.textContent.trim();
                const ltps = cols[3]?.textContent.trim() || 'N/A';

                const rawConducted = parseInt(cols[8]?.textContent.trim() || '0', 10) || 0;
                const rawAttended = parseInt(cols[9]?.textContent.trim() || '0', 10) || 0;

                const weight = getWeight(ltps);
                const conducted = rawConducted * weight;
                const attended = rawAttended * weight;

                if (code && title) {
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
                            // Keep raw counts for display if needed, but we'll use weighted for percentage
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
            }
        });

        // Convert map to array and compute final percentages based on unified totals
        return Array.from(subjectMap.values()).map(subj => {
            const percent = subj.totalConducted > 0
                ? ((subj.totalAttended / subj.totalConducted) * 100).toFixed(2)
                : 0;

            return {
                code: subj.code,
                title: subj.title,
                ltps: subj.ltpsArray.length > 0 ? subj.ltpsArray.join(' + ') : 'N/A',
                components: subj.components,
                // For display, it's often confusing to show weighted numbers like "250/300" 
                // when the student only had 5 classes. Showing raw classes attended/conducted, but using weighted percentage.
                attended: `${subj.rawAttended}/${subj.rawConducted}`,
                percent: parseFloat(percent)
            };
        });
    },

    getCaptchaUrl() {
        return `/index.php?r=site%2Fcaptcha&v=${Math.random().toString(36).substring(7)}`;
    }
};
