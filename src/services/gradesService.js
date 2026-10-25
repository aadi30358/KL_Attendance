/**
 * Grades & CGPA/SGPA Service
 * Extracted and adapted from TimeTablekl 
 * Accurately calculates SGPA, CGPA, and Percentage according to official KLU regulations.
 */
import { getErpBase, buildErpHeaders, getStoredErpCookies, getStoredCsrfToken, hasActiveErpSession } from './erpService.js';

export const decodeHtml = (text) => {
    if (!text) return "";
    let clean = String(text);
    for (let i = 0; i < 2; i++) {
        clean = clean
            .replace(/&amp;/gi, "&")
            .replace(/&lt;/gi, "<")
            .replace(/&gt;/gi, ">")
            .replace(/&quot;/gi, '"')
            .replace(/&#39;/gi, "'")
            .replace(/&#039;/gi, "'")
            .replace(/&nbsp;/gi, " ");
    }
    return clean.trim();
};

// Official KLU curriculum grade points map
export const KLU_GRADE_POINTS = {
    'O': 10,
    'A+': 9,
    'A': 8,
    'B+': 7,
    'B': 6,
    'C': 5,
    'P': 4,
    'F': 0
};

/**
 * SGPA / CGPA: Σ(grade_point × credits) / Σ(credits)
 * Skips rows with zero or invalid credits (audit / non-credit courses).
 */
export const calculateGPA = (courses) => {
    if (!courses?.length) return null;

    let totalPoints = 0;
    let totalCredits = 0;

    courses.forEach((course) => {
        const credits = parseFloat(course.credits);
        const gradePoint = parseFloat(course.grade_point);
        if (!Number.isFinite(credits) || credits <= 0) return;
        if (!Number.isFinite(gradePoint)) return;
        totalPoints += gradePoint * credits;
        totalCredits += credits;
    });

    if (totalCredits <= 0) return null;
    return (totalPoints / totalCredits).toFixed(2);
};

export const getSemesterKey = (course) =>
    `${course.academic_year || ""}|${course.semester || ""}`;

/** Human-readable term name (Odd / Even / Summer / Term 3) for SGPA labels & cards */
export const formatSemesterDisplay = (semester) => {
    const raw = (semester || "").trim();
    if (!raw) return "Unknown Term";

    const lower = raw.toLowerCase();
    if (lower.includes("summer")) return "Summer Term";
    if (lower.includes("odd")) return "Odd Term";
    if (lower.includes("even")) return "Even Term";
    if (/term\s*3|term3/i.test(lower)) return "Term 3";

    return raw.replace(/\bSem\b/i, "Term");
};

export const formatSemesterLabel = (academicYear, semester) =>
    `${academicYear} • ${formatSemesterDisplay(semester)}`;

/** Clean semester display without repetition (e.g. removes "Sem Sem") */
export const cleanSemesterLabel = (semester) => {
    if (!semester) return 'Odd Sem';
    let s = String(semester).trim();
    s = s.replace(/\bSem\s+Sem\b/gi, 'Sem')
         .replace(/\bTerm\s+Term\b/gi, 'Term')
         .trim();
    const lower = s.toLowerCase();
    if (lower === 'odd' || lower === 'odd sem') return 'Odd Sem';
    if (lower === 'even' || lower === 'even sem') return 'Even Sem';
    if (lower.includes('summer')) return 'Summer Term';
    if (lower.includes('term 3') || lower.includes('tri') || lower.includes('term3')) return 'Tri Sem / Term 3';
    if (!lower.includes('sem') && !lower.includes('term')) return `${s} Sem`;
    return s;
};

const getSemesterSortIndex = (semester) => {
    const lower = (semester || "").toLowerCase();
    if (lower.includes("odd")) return 0;
    if (lower.includes("even")) return 1;
    if (lower.includes("summer")) return 2;
    if (/term\s*3|term3/i.test(lower)) return 3;
    return 50;
};

export const buildSemesterOptions = (courses) => {
    const seen = new Map();
    courses.forEach((course) => {
        const key = getSemesterKey(course);
        if (!seen.has(key)) {
            seen.set(key, {
                key,
                academicYear: course.academic_year,
                semester: course.semester,
                label: formatSemesterLabel(course.academic_year, course.semester),
            });
        }
    });

    return Array.from(seen.values()).sort((a, b) => {
        if (a.academicYear !== b.academicYear) {
            return (b.academicYear || "").localeCompare(a.academicYear || "");
        }
        return getSemesterSortIndex(a.semester) - getSemesterSortIndex(b.semester);
    });
};

export const filterCoursesBySemester = (courses, semesterKey) =>
    courses.filter((course) => getSemesterKey(course) === semesterKey);

/**
 * Returns color styling for grade badges (O, A+, A, B+, B, C, P, F)
 */
export const getGradeBadgeStyle = (grade, course) => {
    if (!grade) return { bg: 'bg-slate-100 text-slate-600 border-slate-200', text: 'Audit Pass' };
    const g = String(grade).toUpperCase().trim();
    const credits = parseFloat(course?.credits ?? "");
    const status = (course?.promotion_status ?? "").toUpperCase();

    if (g === "P" && credits === 0 && status === "P") {
        return { bg: 'bg-slate-100 text-slate-500 border-slate-200', text: 'Audit Pass' };
    }
    if (g === "O") {
        return { bg: 'bg-emerald-500 text-white border-emerald-600 shadow-sm shadow-emerald-200', text: 'Outstanding (10)' };
    }
    if (g === "A+") {
        return { bg: 'bg-emerald-100 text-emerald-800 border-emerald-300', text: 'Excellent (9)' };
    }
    if (g === "A") {
        return { bg: 'bg-teal-100 text-teal-800 border-teal-300', text: 'Very Good (8)' };
    }
    if (g === "B+") {
        return { bg: 'bg-blue-100 text-blue-800 border-blue-300', text: 'Good (7)' };
    }
    if (g === "B") {
        return { bg: 'bg-indigo-100 text-indigo-800 border-indigo-300', text: 'Above Average (6)' };
    }
    if (g === "C") {
        return { bg: 'bg-amber-100 text-amber-800 border-amber-300', text: 'Average (5)' };
    }
    if (g === "P") {
        return { bg: 'bg-slate-100 text-slate-700 border-slate-300', text: 'Pass (4)' };
    }
    return { bg: 'bg-rose-100 text-rose-800 border-rose-300', text: 'Fail (0)' };
};

/**
 * Returns stored grades for a student (user-entered or synced from ERP).
 * Returns empty array if no genuine grades have been entered/synced yet.
 */
export const getStoredGrades = (studentId) => {
    if (typeof window === 'undefined') return [];
    const mainUser = localStorage.getItem('activeErpUser') || localStorage.getItem('erp_username') || '2400030358';
    const targetId = studentId || mainUser;
    const isMain = targetId === mainUser || targetId === 'main';

    // 1. Check student-specific stored grades
    try {
        const custom = localStorage.getItem(`kl_grades_${targetId}`);
        if (custom) {
            const parsed = JSON.parse(custom);
            if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
    } catch {
        // continue
    }

    try {
        const specific = localStorage.getItem(`cgpa_${targetId}`);
        if (specific) {
            const parsed = JSON.parse(specific);
            const list = Array.isArray(parsed) ? parsed : (parsed.data || parsed.courses || []);
            if (Array.isArray(list) && list.length > 0) return list;
        }
    } catch {
        // continue
    }

    // 2. ONLY for the main user, check generic cgpa_data or grades
    if (isMain) {
        try {
            const rawCgpa = localStorage.getItem('cgpa_data') || localStorage.getItem('grades');
            if (rawCgpa) {
                const parsed = JSON.parse(rawCgpa);
                const list = Array.isArray(parsed) ? parsed : (parsed.data || parsed.courses || []);
                if (Array.isArray(list) && list.length > 0) return list;
            }
        } catch {
            // continue
        }
    }

    // Never return main user's data for a friend!
    return [];
};

/**
 * Generates grade entry templates from student's genuine ERP registered courses (if available in kleData).
 * This allows students to calculate SGPA/CGPA without having to type all their course codes and titles by hand.
 */
export const getEnrolledCoursesTemplate = (studentId) => {
    if (typeof window === 'undefined') return [];
    const targetId = studentId || localStorage.getItem('activeErpUser') || '2400030358';

    try {
        const erpKey = `kleData_${targetId}`;
        const rawErp = localStorage.getItem(erpKey) || (targetId === localStorage.getItem('activeErpUser') ? localStorage.getItem('kleData') : null);
        if (rawErp) {
            const parsed = JSON.parse(rawErp);
            const list = parsed.attendance_data || parsed.data || (Array.isArray(parsed) ? parsed : []);
            if (Array.isArray(list) && list.length > 0) {
                const seenCodes = new Set();
                const activeYear = localStorage.getItem('selectedAcademicYear') || localStorage.getItem(`activeYear_${targetId}`) || '2026-2027';
                const activeSem = localStorage.getItem('selectedSemester') || localStorage.getItem(`activeSem_${targetId}`) || 'Odd';

                const templates = [];
                list.forEach((subj) => {
                    const rawCode = (subj.code || subj.course_code || '').replace(/-[LPTS]$/, '').trim();
                    if (!rawCode || seenCodes.has(rawCode)) return;
                    seenCodes.add(rawCode);

                    const title = subj.title || subj.name || subj.course_name || rawCode;
                    let credits = '3.0';
                    if (rawCode.includes('SD') || rawCode.includes('SKILL') || rawCode.includes('CY') || rawCode.includes('EN')) credits = '2.0';
                    else if (rawCode.includes('LAB') || rawCode.endsWith('-P')) credits = '1.5';
                    else if (rawCode.includes('CS') || rawCode.includes('MT') || rawCode.includes('AD')) credits = '4.0';

                    templates.push({
                        academic_year: activeYear,
                        semester: activeSem,
                        course_code: rawCode,
                        course_desc: title,
                        credits,
                        grade: 'O',
                        grade_point: '10',
                        promotion_status: 'P'
                    });
                });
                return templates;
            }
        }
    } catch {
        // ignore
    }

    return [];
};

export const saveStoredGrades = (studentId, grades) => {
    if (typeof window === 'undefined' || !Array.isArray(grades)) return;
    try {
        const targetId = studentId || localStorage.getItem('activeErpUser') || '2400030358';
        const key = `kl_grades_${targetId}`;
        localStorage.setItem(key, JSON.stringify(grades));
    } catch {
        // ignore
    }
};

/**
 * Updates or adds a specific course grade and grade points for a student
 */
export const updateCourseGrade = (studentId, courseCode, newGrade, newCredits = null) => {
    const list = getStoredGrades(studentId);
    let found = false;
    const updated = list.map(c => {
        if (c.course_code === courseCode) {
            found = true;
            const gp = String(KLU_GRADE_POINTS[newGrade] ?? 0);
            return {
                ...c,
                grade: newGrade,
                grade_point: gp,
                ...(newCredits !== null ? { credits: String(newCredits) } : {})
            };
        }
        return c;
    });

    if (!found) {
        updated.push({
            academic_year: localStorage.getItem('selectedAcademicYear') || '2026-2027',
            semester: localStorage.getItem('selectedSemester') || 'Odd',
            course_code: courseCode,
            course_desc: courseCode,
            credits: newCredits ? String(newCredits) : '3.0',
            grade: newGrade,
            grade_point: String(KLU_GRADE_POINTS[newGrade] ?? 0),
            promotion_status: newGrade === 'F' ? 'F' : 'P'
        });
    }

    saveStoredGrades(studentId, updated);
    return updated;
};

/**
 * Adds a new course to the student's calculator scorecard
 */
export const addCourseToScorecard = (studentId, course) => {
    const list = getStoredGrades(studentId);
    const existingIdx = list.findIndex(c => c.course_code === course.course_code);
    let updated;
    if (existingIdx !== -1) {
        updated = [...list];
        updated[existingIdx] = course;
    } else {
        updated = [...list, course];
    }
    saveStoredGrades(studentId, updated);
    return updated;
};

/**
 * Deletes a course from the student's scorecard
 */
export const deleteCourseFromScorecard = (studentId, courseCode) => {
    const list = getStoredGrades(studentId);
    const updated = list.filter(c => c.course_code !== courseCode);
    saveStoredGrades(studentId, updated);
    return updated;
};

/**
 * Clears all stored grades
 */
export const resetGradesToDefault = (studentId) => {
    const targetId = studentId || localStorage.getItem('activeErpUser') || '2400030358';
    try {
        localStorage.removeItem(`kl_grades_${targetId}`);
    } catch (err) {
        void err; // Ignore storage access error
    }
    return [];
};

/**
 * Parses raw HTML table from authentic KLU ERP searchgetmycgpa endpoint.
 */
export const parseCgpaTableHtml = (html) => {
    if (!html || typeof html !== 'string') return [];
    const courses = [];
    try {
        if (typeof window !== 'undefined' && typeof DOMParser !== 'undefined') {
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const rows = Array.from(doc.querySelectorAll('table tr'));

            // Detect column headers dynamically if present
            let headerIndices = null;
            for (const row of rows) {
                const ths = Array.from(row.querySelectorAll('th'));
                if (ths.length >= 6) {
                    const headers = ths.map(th => th.textContent.trim().toLowerCase());
                    const findIdx = (keywords) => headers.findIndex(h => keywords.some(k => h.includes(k)));
                    headerIndices = {
                        code: findIdx(['course code', 'code']),
                        desc: findIdx(['course desc', 'course title', 'course name', 'desc', 'title']),
                        grade: findIdx(['grade']),
                        point: findIdx(['grade point', 'point', 'gp']),
                        credits: findIdx(['credit', 'cr']),
                        status: findIdx(['promotion status', 'status', 'result']),
                        acy: findIdx(['academic year', 'acy', 'academic']),
                        sem: findIdx(['semester', 'sem']),
                        offeringYear: findIdx(['offering year', 'offering'])
                    };
                    break;
                }
            }

            for (const row of rows) {
                if (row.querySelector('th')) continue;
                const cells = Array.from(row.querySelectorAll('td'));
                if (cells.length < 8) continue;

                const link = row.querySelector('a[href]') || row.querySelector('a[onclick]');
                let targetHref = '';
                if (link) {
                    const href = link.getAttribute('href') || '';
                    if (href && !href.toLowerCase().startsWith('javascript:')) {
                        targetHref = href;
                    } else {
                        const onclick = link.getAttribute('onclick') || '';
                        const match = onclick.match(/['"]([^'"]*\.php[^'"]*)['"]/i);
                        if (match) targetHref = match[1];
                    }
                }

                let courseCode = '';
                let courseName = '';
                let grade = '';
                let gradePoint = '';
                let credits = '';
                let promotionStatus = 'P';
                let academicYear = '2024-2025';
                let semester = 'Even Sem';
                let offeringYear = '';

                if (headerIndices && headerIndices.code !== -1 && cells[headerIndices.code]) {
                    courseCode = cells[headerIndices.code]?.textContent.trim();
                    courseName = (headerIndices.desc !== -1 && cells[headerIndices.desc]?.textContent.trim()) || courseCode;
                    grade = (headerIndices.grade !== -1 && cells[headerIndices.grade]?.textContent.trim()) || 'P';
                    gradePoint = (headerIndices.point !== -1 && cells[headerIndices.point]?.textContent.trim()) || String(KLU_GRADE_POINTS[grade] ?? 0);
                    credits = (headerIndices.credits !== -1 && cells[headerIndices.credits]?.textContent.trim()) || '3.0';
                    promotionStatus = (headerIndices.status !== -1 && cells[headerIndices.status]?.textContent.trim()) || 'P';
                    academicYear = (headerIndices.acy !== -1 && cells[headerIndices.acy]?.textContent.trim()) || '2024-2025';
                    semester = (headerIndices.sem !== -1 && cells[headerIndices.sem]?.textContent.trim()) || 'Even Sem';
                    if (headerIndices.offeringYear !== -1 && cells[headerIndices.offeringYear]) {
                        offeringYear = cells[headerIndices.offeringYear]?.textContent.trim();
                    }
                } else {
                    courseCode = cells[3]?.textContent.trim() || cells[2]?.textContent.trim() || '';
                    courseName = cells[4]?.textContent.trim() || cells[3]?.textContent.trim() || courseCode;
                    grade = cells[5]?.textContent.trim() || 'P';
                    gradePoint = cells[6]?.textContent.trim() || String(KLU_GRADE_POINTS[grade] ?? 0);
                    credits = cells[7]?.textContent.trim() || '3.0';
                    promotionStatus = cells[8]?.textContent.trim() || 'P';
                    academicYear = cells[9]?.textContent.trim() || '2024-2025';
                    semester = cells[10]?.textContent.trim() || 'Even Sem';
                }

                if (courseCode && courseCode.length >= 3) {
                    courses.push({
                        course_code: courseCode,
                        course_desc: courseName,
                        course_name: courseName,
                        grade,
                        grade_point: gradePoint,
                        credits,
                        promotion_status: promotionStatus,
                        academic_year: academicYear,
                        semester: cleanSemesterLabel(semester),
                        offering_year: offeringYear,
                        target_href: targetHref
                    });
                }
            }
        }
    } catch (e) {
        console.warn('[GradesService] Error parsing CGPA table:', e);
    }
    return courses;
};

/**
 * Saves genuine ERP grade list to localStorage and syncs all course codes/titles into subjectMappings.
 */
export const saveGradesAndMappings = (studentId, courses) => {
    if (!Array.isArray(courses)) return;
    const mainUser = localStorage.getItem('activeErpUser') || localStorage.getItem('erp_username') || '2400030358';
    const targetId = studentId || mainUser;
    const isMain = targetId === mainUser || targetId === 'main';

    try {
        if (typeof window !== 'undefined') {
            localStorage.setItem(`kl_grades_${targetId}`, JSON.stringify(courses));
            localStorage.setItem(`cgpa_${targetId}`, JSON.stringify(courses));
            if (isMain) {
                localStorage.setItem('cgpa_data', JSON.stringify(courses));
            }

            // Populate subjectMappings for Timetable display
            const mappings = JSON.parse(localStorage.getItem('subjectMappings') || '{}');
            let updated = false;
            courses.forEach(c => {
                const code = c.course_code;
                const name = c.course_desc || c.course_name;
                if (code && name && name !== code) {
                    mappings[code] = name;
                    const cleanCode = code.replace(/-[LPTS]$/, '').trim();
                    mappings[cleanCode] = name;
                    updated = true;
                }
            });
            if (updated) {
                localStorage.setItem('subjectMappings', JSON.stringify(mappings));
                window.dispatchEvent(new CustomEvent('kl_subject_mappings_updated'));
            }
            window.dispatchEvent(new CustomEvent('kl_grades_updated', { detail: { studentId: targetId, courses } }));
        }
    } catch { /* ignore storage quota */ }
};

/**
 * Fetches authentic historical SGPA and CGPA results directly from KLU ERP searchgetmycgpa endpoint.
 */
export const fetchLiveErpGrades = async (studentId) => {
    const mainUser = localStorage.getItem('activeErpUser') || localStorage.getItem('rememberedId') || '2400030358';
    const targetId = studentId || mainUser;
    const isFriend = targetId && mainUser && targetId !== mainUser;

    const apiBase = getErpBase();
    const activeErp = typeof window !== 'undefined' ? localStorage.getItem('activeErpUser') : null;
    const isCurrentlyActiveUser = targetId === activeErp;
    const friendCookie = isFriend ? (localStorage.getItem(`erp_cookie_${targetId}`) || '') : '';
    const cookie = isCurrentlyActiveUser ? getStoredErpCookies() : (friendCookie || getStoredErpCookies());
    const csrfToken = getStoredCsrfToken();

    // Guard: Only fetch live ERP grades if active session or cookie exists
    if (!cookie && !hasActiveErpSession()) {
        return { success: false, message: 'No active ERP session.' };
    }

    // Direct fetch to authentic ERP CGPA endpoint via reverse proxy
    try {
        const directResp = await fetch(`${apiBase || ''}/index.php?r=studentinfo%2Fstudentendexamresult%2Fsearchgetmycgpa`, {
            method: 'GET',
            headers: buildErpHeaders({
                ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}),
                ...(cookie ? { 'x-erp-cookie': cookie } : {})
            }),
            credentials: 'include',
            cache: 'no-store'
        });

        if (directResp.ok) {
            const html = await directResp.text();
            if (html && !html.includes('id="login-form"') && html.includes('<table')) {
                const parsed = parseCgpaTableHtml(html);
                if (parsed.length > 0) {
                    saveGradesAndMappings(targetId, parsed);
                    return { success: true, source: 'erp_live', courses: parsed };
                }
            }
        }
    } catch {
        // silent fallback
    }

    return { success: false, message: 'Could not fetch live grades from ERP. Results may be unpublished or session expired.' };
};

/**
 * Fetches detailed component marks (internals, externals, lab, assignments) for a specific course scorecard.
 */
export const fetchLiveMarksDetail = async (targetHref, studentId, courseCode) => {
    const targetId = studentId || localStorage.getItem('activeErpUser') || '2400030358';
    const cleanCode = (courseCode || '').toUpperCase().trim();

    // 1. Check local cache first
    if (typeof window !== 'undefined' && cleanCode) {
        try {
            const cached = localStorage.getItem(`kl_scorecard_${targetId}_${cleanCode}`);
            if (cached) {
                const parsed = JSON.parse(cached);
                if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
                    return { success: true, scorecard: parsed, source: 'cache' };
                }
            }
        } catch (err) {
            void err;
        }
    }

    if (!targetHref) {
        return { success: false, message: 'Component marks endpoint not available for this course' };
    }

    const apiBase = getErpBase();
    const csrfToken = getStoredCsrfToken();
    const cookie = getStoredErpCookies();

    // Guard: Only fetch marks detail if active session or cookie exists
    if (!cookie && !hasActiveErpSession()) {
        return { success: false, message: 'No active ERP session.' };
    }

    // Direct fetch if targetHref is a full or relative URL on same host
    if (targetHref && targetHref.includes('.php')) {
        try {
            const cleanHref = targetHref.startsWith('http') ? targetHref : `${apiBase || ''}/${targetHref.replace(/^\//, '')}`;
            const directResp = await fetch(cleanHref, {
                method: 'GET',
                headers: buildErpHeaders({
                    ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}),
                    ...(cookie ? { 'x-erp-cookie': cookie } : {})
                }),
                credentials: 'include',
                cache: 'no-store'
            });
            if (directResp.ok) {
                const html = await directResp.text();
                if (html && !html.includes('id="login-form"')) {
                    const scorecard = {};
                    const allTrs = Array.from(html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi));
                    for (const rm of allTrs) {
                        const cells = Array.from(rm[1].matchAll(/<(?:th|td)[^>]*>([\s\S]*?)<\/(?:th|td)>/gi))
                            .map(m => m[1].replace(/<[^>]+>/g, '').trim());
                        if (cells.length >= 2) {
                            const rawKey = cells[0].trim();
                            const val = cells[1].trim();
                            if (rawKey && val !== undefined) {
                                const fieldKey = rawKey.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
                                if (fieldKey.length > 0 && fieldKey.length < 50) {
                                    scorecard[fieldKey] = val;
                                }
                            }
                        }
                    }
                    if (Object.keys(scorecard).length > 0) {
                        if (typeof window !== 'undefined' && cleanCode) {
                            try {
                                localStorage.setItem(`kl_scorecard_${targetId}_${cleanCode}`, JSON.stringify(scorecard));
                            } catch (err) {
                                void err;
                            }
                        }
                        return { success: true, scorecard };
                    }
                }
            }
        } catch (e) {
            console.warn('[GradesService] Direct marks fetch fallback notice:', e.message);
        }
    }

    return { success: false, message: 'Could not fetch detailed marks scorecard.' };
};
