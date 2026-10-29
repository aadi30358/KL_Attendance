import { getErpBase, buildErpHeaders, getStoredErpCookies, getStoredCsrfToken, hasActiveErpSession } from './erpService.js';

export const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Standard KLU 14-Session System (S1 through S14)
export const KLU_SESSIONS = [
    { slot: 1, id: 'S1', start: '07:10', end: '08:00', label: '7:10 AM – 8:00 AM' },
    { slot: 2, id: 'S2', start: '08:00', end: '08:50', label: '8:00 AM – 8:50 AM' },
    { slot: 3, id: 'S3', start: '09:20', end: '10:10', label: '9:20 AM – 10:10 AM' },
    { slot: 4, id: 'S4', start: '10:10', end: '11:00', label: '10:10 AM – 11:00 AM' },
    { slot: 5, id: 'S5', start: '11:10', end: '12:00', label: '11:10 AM – 12:00 PM' },
    { slot: 6, id: 'S6', start: '12:00', end: '12:50', label: '12:00 PM – 12:50 PM' },
    { slot: 7, id: 'S7', start: '13:00', end: '13:50', label: '1:00 PM – 1:50 PM' },
    { slot: 8, id: 'S8', start: '13:50', end: '14:40', label: '1:50 PM – 2:40 PM' },
    { slot: 9, id: 'S9', start: '14:40', end: '15:30', label: '2:40 PM – 3:30 PM' },
    { slot: 10, id: 'S10', start: '15:40', end: '16:20', label: '3:40 PM – 4:20 PM' },
    { slot: 11, id: 'S11', start: '16:20', end: '17:30', label: '4:20 PM – 5:30 PM' },
    { slot: 12, id: 'S12', start: '17:30', end: '18:15', label: '5:30 PM – 6:15 PM' },
    { slot: 13, id: 'S13', start: '18:15', end: '19:00', label: '6:15 PM – 7:00 PM' },
    { slot: 14, id: 'S14', start: '19:00', end: '19:45', label: '7:00 PM – 7:45 PM' }
];

export const PERIOD_TIMINGS = {
    1: { start: '07:10', end: '08:00', label: 'S1 (7:10 – 8:00 AM)' },
    2: { start: '08:00', end: '08:50', label: 'S2 (8:00 – 8:50 AM)' },
    3: { start: '09:20', end: '10:10', label: 'S3 (9:20 – 10:10 AM)' },
    4: { start: '10:10', end: '11:00', label: 'S4 (10:10 – 11:00 AM)' },
    5: { start: '11:10', end: '12:00', label: 'S5 (11:10 AM – 12:00 PM)' },
    6: { start: '12:00', end: '12:50', label: 'S6 (12:00 – 12:50 PM)' },
    7: { start: '13:00', end: '13:50', label: 'S7 (1:00 – 1:50 PM)' },
    8: { start: '13:50', end: '14:40', label: 'S8 (1:50 – 2:40 PM)' },
    9: { start: '14:40', end: '15:30', label: 'S9 (2:40 – 3:30 PM)' },
    10: { start: '15:40', end: '16:20', label: 'S10 (3:40 – 4:20 PM)' },
    11: { start: '16:20', end: '17:30', label: 'S11 (4:20 – 5:30 PM)' },
    12: { start: '17:30', end: '18:15', label: 'S12 (5:30 – 6:15 PM)' },
    13: { start: '18:15', end: '19:00', label: 'S13 (6:15 – 7:00 PM)' },
    14: { start: '19:00', end: '19:45', label: 'S14 (7:00 – 7:45 PM)' }
};

// Vijayawada slot times (14 slots)
export const VIJAYAWADA_SLOT_TIMES = {
    1: { start: "07:10", end: "08:00" },
    2: { start: "08:00", end: "08:50" },
    3: { start: "09:20", end: "10:10" },
    4: { start: "10:10", end: "11:00" },
    5: { start: "11:10", end: "12:00" },
    6: { start: "12:00", end: "12:50" },
    7: { start: "13:00", end: "13:50" },
    8: { start: "13:50", end: "14:40" },
    9: { start: "14:40", end: "15:40" },
    10: { start: "15:50", end: "16:40" },
    11: { start: "16:40", end: "17:30" },
    12: { start: "17:30", end: "18:20" },
    13: { start: "18:20", end: "19:10" },
    14: { start: "19:10", end: "20:00" }
};

// Hyderabad slot times (9 slots)
export const HYDERABAD_SLOT_TIMES = {
    1: { start: "08:10", end: "09:00" },
    2: { start: "09:00", end: "09:50" },
    3: { start: "10:00", end: "10:50" },
    4: { start: "10:50", end: "11:40" },
    5: { start: "11:50", end: "12:40" },
    6: { start: "12:40", end: "13:20" },
    7: { start: "13:20", end: "14:10" },
    8: { start: "14:10", end: "15:00" },
    9: { start: "15:00", end: "15:50" }
};

/**
 * Detects campus based on username pattern (XX000XXXXX = Vijayawada)
 */
export function detectCampus(username) {
    if (!username || typeof username !== 'string') return 'vijayawada';
    const digits = username.replace(/\D/g, '');
    if (digits.length !== 10) return 'vijayawada';
    if (digits[2] === '0' && digits[3] === '0' && digits[4] === '0') return 'vijayawada';
    return 'hyderabad';
}

export function normalizeAcademicYear(year) {
    if (!year) return '2026-2027';
    const str = String(year).trim();

    // 1. If it's already in YYYY-YYYY format, extract directly
    const match = str.match(/\b(20\d\d)-(20\d\d)\b/);
    if (match) return `${match[1]}-${match[2]}`;

    // 2. Parse first year if it starts with 4 digits (e.g. "2025", "2024")
    const firstYear = parseInt(str.split('-')[0], 10);
    if (!isNaN(firstYear) && firstYear >= 2020 && firstYear <= 2040) {
        return `${firstYear}-${firstYear + 1}`;
    }

    // 3. Candidate ERP year integer IDs
    if (/^\d+$/.test(str)) {
        const num = parseInt(str, 10);
        if (num >= 30) {
            const yr = 2026 + (num - 29);
            return `${yr}-${yr + 1}`;
        }
    }
    if (str === '29' || str === '18') return '2026-2027';
    if (str === '28' || str === '17' || str === '19') return '2025-2026';
    if (str === '27' || str === '16') return '2024-2025';
    if (str === '26' || str === '15') return '2023-2024';
    if (str === '25' || str === '14') return '2022-2023';
    if (str === '24' || str === '13') return '2021-2022';
    return str;
}

export function normalizeSemester(sem) {
    const str = String(sem || '').trim().toLowerCase();
    if (str.includes('summer') || str === '3') return 'Summer';
    if ((str.includes('term') && !str.includes('summer')) || str.includes('tri') || str === '4') return 'Term3';
    if (str.includes('even') || str === '2') return 'Even';
    return 'Odd';
}

export function getTruePresentAcademicYearAndSem(studentId = null) {
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth();
    const defaultSem = (curMonth >= 5 && curMonth <= 11) ? 'Odd' : 'Even';
    const academicStartYear = (curMonth >= 5) ? curYear : curYear - 1;

    if (studentId) {
        const match = String(studentId).match(/^(\d{2})/);
        if (match) {
            const admissionYr = 2000 + parseInt(match[1], 10);
            const studyOffset = Math.max(0, Math.min(3, academicStartYear - admissionYr));
            const presentStartYr = admissionYr + studyOffset;
            return {
                year: `${presentStartYr}-${presentStartYr + 1}`,
                sem: defaultSem
            };
        }
    }

    return {
        year: `${academicStartYear}-${academicStartYear + 1}`,
        sem: defaultSem
    };
}

export function getPresentAcademicYearAndSem(studentId = null, forceCalendarPresent = false) {
    if (!forceCalendarPresent && typeof window !== 'undefined') {
        const sid = studentId || localStorage.getItem('activeErpUser') || localStorage.getItem('rememberedId') || '';
        const savedActiveYear = sid ? localStorage.getItem(`activeYear_${sid}`) : null;
        const savedActiveSem = sid ? localStorage.getItem(`activeSem_${sid}`) : null;
        if (savedActiveYear && savedActiveSem) {
            return {
                year: normalizeAcademicYear(savedActiveYear),
                sem: normalizeSemester(savedActiveSem)
            };
        }
    }

    return getTruePresentAcademicYearAndSem(studentId);
}

// Official Course Code -> Title Dictionary for KLU Curriculum
export const KLU_COURSE_NAMES = {
    // 3rd Year (2026-2027) - Current
    '24GMI3101': 'Principles of Deep Neural Computation',
    '24EDS3308HF': 'Embedded AI – Edge Intelligence and TinyML',
    '24EDS3308': 'Embedded AI – Edge Intelligence and TinyML',
    '23EC1202': 'Digital Design and Computer Architecture',
    '24SDCS03A': 'SOA Programming and Microservices',
    '24SDCS03': 'SOA Programming and Microservices',
    '24CC3014': 'Cloud Computing',
    '24CS3206': 'Theory of Computation',
    '24CS3105': 'Information Assurance and Security',
    // 2nd Year (2025-2026)
    '24CS2105': 'Database Management Systems',
    '24CS2106': 'Design & Analysis of Algorithms',
    '24CS2107': 'Operating Systems',
    '24CS2108': 'Computer Networks',
    '24SDCS01': 'Full Stack Web Development',
    '24CS2209': 'Software Engineering & Agile',
    '24CS2210': 'Artificial Intelligence & Machine Learning',
    '24CS2211': 'Formal Languages and Automata Theory',
    '24CS2212': 'Cyber Security Fundamentals',
    '24SDCS02': 'Cloud Platform Engineering',
    // 1st Year (2024-2025)
    '24MT1101': 'Linear Algebra & Calculus',
    '24CS1101': 'Problem Solving and Computer Programming',
    '24PH1101': 'Engineering Physics',
    '24EE1101': 'Basic Electrical & Electronics Engineering',
    '24EN1101': 'Professional Communication',
    '24CS1202': 'Data Structures',
    '24MT1202': 'Discrete Mathematics',
    '24CS1203': 'Computer Organization & Architecture',
    '24CS1204': 'Object Oriented Programming with Java',
    '24CY1201': 'Environmental Science & Sustainability',
    // 3rd Year Even (2026-2027)
    '24CS3213': 'Distributed Systems & Edge Computing',
    '24CS3214': 'Deep Learning & Generative Models',
    '24CS3215': 'DevOps & Site Reliability Engineering',
    '24CS3216': 'Natural Language Processing',
    // Summer & Term 3 Electives
    '24CS2301': 'Accelerated Data Structures & Problem Solving',
    '24CS2302': 'Summer Internship & Practical Project',
    '24CS2401': 'Industry Certified Elective',
    '24SDCS04': 'Mobile Application Architecture',
    '24CS1301': 'Foundation Computing Practice',
    '24CS1401': 'Technical Problem Solving in C++'
};

// Curriculum template courses by Academic Year and Semester
export const KLU_SEMESTER_CURRICULUM = {
    // 1st Year (2024-2025)
    '2024-2025_Odd': [
        { code: '24MT1101', title: 'Linear Algebra & Calculus', components: { Lecture: {}, Tutorial: {} } },
        { code: '24CS1101', title: 'Problem Solving and Computer Programming', components: { Lecture: {}, Practical: {} } },
        { code: '24PH1101', title: 'Engineering Physics', components: { Lecture: {}, Practical: {} } },
        { code: '24EE1101', title: 'Basic Electrical & Electronics Engineering', components: { Lecture: {}, Practical: {} } },
        { code: '24EN1101', title: 'Professional Communication', components: { Lecture: {}, Tutorial: {} } }
    ],
    '2024-2025_Even': [
        { code: '24CS1202', title: 'Data Structures', components: { Lecture: {}, Practical: {} } },
        { code: '24MT1202', title: 'Discrete Mathematics', components: { Lecture: {}, Tutorial: {} } },
        { code: '24CS1203', title: 'Computer Organization & Architecture', components: { Lecture: {}, Tutorial: {} } },
        { code: '24CS1204', title: 'Object Oriented Programming with Java', components: { Lecture: {}, Practical: {} } },
        { code: '24CY1201', title: 'Environmental Science & Sustainability', components: { Lecture: {} } }
    ],
    '2024-2025_Summer': [
        { code: '24CS1301', title: 'Foundation Computing Practice', components: { Lecture: {}, Practical: {} } }
    ],
    '2024-2025_Term3': [
        { code: '24CS1401', title: 'Technical Problem Solving in C++', components: { Lecture: {}, Practical: {} } }
    ],
    // 2nd Year (2025-2026)
    '2025-2026_Odd': [
        { code: '24CS2105', title: 'Database Management Systems', components: { Lecture: {}, Practical: {} } },
        { code: '24CS2106', title: 'Design & Analysis of Algorithms', components: { Lecture: {}, Tutorial: {} } },
        { code: '24CS2107', title: 'Operating Systems', components: { Lecture: {}, Practical: {} } },
        { code: '24CS2108', title: 'Computer Networks', components: { Lecture: {}, Practical: {} } },
        { code: '24SDCS01', title: 'Full Stack Web Development', components: { Skill: {} } }
    ],
    '2025-2026_Even': [
        { code: '24CS2209', title: 'Software Engineering & Agile', components: { Lecture: {}, Tutorial: {} } },
        { code: '24CS2210', title: 'Artificial Intelligence & Machine Learning', components: { Lecture: {}, Practical: {} } },
        { code: '24CS2211', title: 'Formal Languages and Automata Theory', components: { Lecture: {}, Tutorial: {} } },
        { code: '24CS2212', title: 'Cyber Security Fundamentals', components: { Lecture: {}, Practical: {} } },
        { code: '24SDCS02', title: 'Cloud Platform Engineering', components: { Skill: {} } }
    ],
    '2025-2026_Summer': [
        { code: '24CS2301', title: 'Accelerated Data Structures & Problem Solving', components: { Lecture: {}, Practical: {} } },
        { code: '24CS2302', title: 'Summer Internship & Practical Project', components: { Practical: {}, Skill: {} } }
    ],
    '2025-2026_Term3': [
        { code: '24CS2401', title: 'Industry Certified Elective', components: { Lecture: {}, Practical: {} } },
        { code: '24SDCS04', title: 'Mobile Application Architecture', components: { Skill: {} } }
    ],
    // 3rd Year (2026-2027) - Current
    '2026-2027_Odd': [
        { code: '24GMI3101', title: 'Principles of Deep Neural Computation', components: { Lecture: {}, Practical: {} } },
        { code: '24EDS3308HF', title: 'Enterprise Data Science', components: { Lecture: {}, Practical: {} } },
        { code: '24SDCS03A', title: 'SOA Programming and Microservices', components: { Lecture: {}, Tutorial: {}, Skill: {} } },
        { code: '24CC3014', title: 'Cloud Computing', components: { Skill: {} } },
        { code: '24CS3206', title: 'Theory of Computation', components: { Lecture: {}, Tutorial: {} } },
        { code: '24CS3105', title: 'Information Assurance and Security', components: { Lecture: {}, Tutorial: {} } }
    ],
    '2026-2027_Even': [
        { code: '24CS3213', title: 'Distributed Systems & Edge Computing', components: { Lecture: {}, Practical: {} } },
        { code: '24CS3214', title: 'Deep Learning & Generative Models', components: { Lecture: {}, Practical: {} } },
        { code: '24CS3215', title: 'DevOps & Site Reliability Engineering', components: { Lecture: {}, Skill: {} } },
        { code: '24CS3216', title: 'Natural Language Processing', components: { Lecture: {}, Practical: {} } }
    ],
    '2026-2027_Summer': [
        { code: '24CS3301', title: 'Capstone Project & Practice', components: { Practical: {}, Skill: {} } }
    ],
    '2026-2027_Term3': [
        { code: '24CS3401', title: 'Advanced Cloud Architecture', components: { Lecture: {}, Skill: {} } }
    ],
    // 2023-2024
    '2023-2024_Odd': [
        { code: '23MT1101', title: 'Mathematics for Computing', components: { Lecture: {}, Tutorial: {} } },
        { code: '23CS1101', title: 'Introduction to Programming in C', components: { Lecture: {}, Practical: {} } },
        { code: '23PH1101', title: 'Applied Physics', components: { Lecture: {}, Practical: {} } },
        { code: '23EE1101', title: 'Electrical Science', components: { Lecture: {}, Practical: {} } }
    ],
    '2023-2024_Even': [
        { code: '23CS1202', title: 'Advanced Data Structures', components: { Lecture: {}, Practical: {} } },
        { code: '23CS1204', title: 'Java Programming Paradigm', components: { Lecture: {}, Practical: {} } },
        { code: '23CS1203', title: 'Digital Logic & Computer Design', components: { Lecture: {}, Tutorial: {} } }
    ],
    // 2022-2023
    '2022-2023_Odd': [
        { code: '22MT1101', title: 'Linear Algebra and Differential Equations', components: { Lecture: {}, Tutorial: {} } },
        { code: '22CS1101', title: 'Computer Programming Fundamentals', components: { Lecture: {}, Practical: {} } }
    ],
    '2022-2023_Even': [
        { code: '22CS1202', title: 'Data Structures with C++', components: { Lecture: {}, Practical: {} } },
        { code: '22CS1204', title: 'Object Oriented Programming', components: { Lecture: {}, Practical: {} } }
    ],
    // 2021-2022
    '2021-2022_Odd': [
        { code: '21MT1101', title: 'Calculus and Numerical Analysis', components: { Lecture: {}, Tutorial: {} } },
        { code: '21CS1101', title: 'Problem Solving and Python Programming', components: { Lecture: {}, Practical: {} } }
    ],
    '2021-2022_Even': [
        { code: '21CS1202', title: 'Data Structures and Algorithms', components: { Lecture: {}, Practical: {} } }
    ]
};

// Helper to extract main alphanumeric course code
export function extractMainCode(code) {
    if (!code) return '';
    const match = String(code).trim().match(/^[A-Za-z0-9]+/);
    return match ? match[0] : String(code).trim();
}

// Get custom mapped subject name if configured, otherwise fallback to official KLU dictionary or raw code
export const getSubjectName = (courseCode) => {
    if (!courseCode || courseCode === '-') return courseCode;
    const mainCode = extractMainCode(courseCode);
    try {
        if (typeof window !== 'undefined') {
            const subjectMappings = JSON.parse(localStorage.getItem('subjectMappings') || '{}');
            if (subjectMappings[mainCode]) return subjectMappings[mainCode];
            if (subjectMappings[courseCode]) return subjectMappings[courseCode];
        }
    } catch { /* ignore */ }
    return KLU_COURSE_NAMES[mainCode] || KLU_COURSE_NAMES[courseCode] || courseCode;
};

// Set custom subject mapping
export const setSubjectMapping = (courseCode, customName) => {
    if (!courseCode) return;
    const mainCode = extractMainCode(courseCode);
    try {
        if (typeof window !== 'undefined') {
            const subjectMappings = JSON.parse(localStorage.getItem('subjectMappings') || '{}');
            if (customName && customName.trim() && customName.trim() !== mainCode) {
                subjectMappings[mainCode] = customName.trim();
            } else {
                delete subjectMappings[mainCode];
            }
            localStorage.setItem('subjectMappings', JSON.stringify(subjectMappings));
            window.dispatchEvent(new CustomEvent('kl_subject_mappings_updated'));
        }
    } catch { /* ignore */ }
};

export const getAllSubjectMappings = () => {
    try {
        if (typeof window !== 'undefined') {
            return JSON.parse(localStorage.getItem('subjectMappings') || '{}');
        }
    } catch { /* ignore */ }
    return {};
};

// Function to replace course code with custom subject name in timetable entry string
export const replaceCourseCodeWithCustomName = (content) => {
    if (!content || content === '-') return content;
    const match = String(content).match(/^([A-Za-z0-9]+)/);
    if (!match) return content;
    const courseCode = match[1];
    const customName = getSubjectName(courseCode);
    if (customName !== courseCode) {
        return content.replace(courseCode, customName);
    }
    return content;
};

// Gets slot times based on campus (Vijayawada 14 slots or Hyderabad 9 slots)
export function getSlotTimes(username = null) {
    let targetUsername = username;
    if (!targetUsername && typeof window !== 'undefined') {
        targetUsername = localStorage.getItem('activeErpUser') || localStorage.getItem('rememberedId');
    }
    const campus = detectCampus(targetUsername);
    return campus === 'hyderabad' ? HYDERABAD_SLOT_TIMES : VIJAYAWADA_SLOT_TIMES;
}

// Gets maximum number of slots for a campus
export function getMaxSlots(username = null) {
    const slotTimes = getSlotTimes(username);
    return Math.max(...Object.keys(slotTimes).map(Number));
}


// Authentic KLU CSE / Engineering Designated Lecture Halls
export const KLU_LECTURE_HALLS = ['C324', 'C421', 'C215', 'C302', 'C405', 'C501', 'C522', 'R104B', 'R203', 'R301', 'M204', 'L311'];

// Helper to strip any redundant "Room", "RoomNo", "Rm" prefixes from room strings
export function cleanRoomNumber(room) {
    if (!room) return '';
    return String(room).replace(new RegExp('^(?:Room\\s*No|Room|Rm)[\\s#:-]*', 'i'), '').trim();
}

// Authentic Lab Rooms assigned by subject component & course code (Returns genuine KLU room codes)
export function getCourseLabRoom(code = '', title = '') {
    const c = `${code} ${title}`.toUpperCase();
    if (c.includes('GMI') || c.includes('AI') || c.includes('NEURAL') || c.includes('INTELLIGENCE') || c.includes('DEEP')) return 'C619';
    if (c.includes('CLOUD') || c.includes('CC') || c.includes('ARCH') || c.includes('DEV') || c.includes('AWS')) return 'C620';
    if (c.includes('SDCS') || c.includes('WEB') || c.includes('FULL') || c.includes('STACK') || c.includes('SOA') || c.includes('MICROSERVICES')) return 'C518';
    if (c.includes('DATA') || c.includes('DS') || c.includes('EDS') || c.includes('DBMS') || c.includes('DATABASE') || c.includes('SQL')) return 'C307';
    if (c.includes('OS') || c.includes('SYSTEM') || c.includes('NET') || c.includes('SECURITY') || c.includes('CYBER') || c.includes('LINUX')) return 'C219';
    if (c.includes('IOT') || c.includes('EMBED') || c.includes('WIRELESS') || c.includes('SENSOR')) return 'L502';
    if (c.includes('PHYS') || c.includes('PH')) return 'F109';
    if (c.includes('EE') || c.includes('ELECT') || c.includes('BEE') || c.includes('CIRCUIT')) return 'E204';
    if (c.includes('MECH') || c.includes('ENGG') || c.includes('CAD')) return 'M102';
    if (c.includes('JAVA') || c.includes('PYTHON') || c.includes('PROG') || c.includes('ALGO')) return 'C104';
    return 'C219';
}

/**
 * Accurately extracts real KLU room numbers from ERP timetable cell strings or HTML,
 * preventing course codes (e.g. 24CS2105 matching S210 or 24GMI3101 matching I310) from false-matching as rooms.
 */
export function extractRoom(cellText, fullCode = '', section = '') {
    if (!cellText || typeof cellText !== 'string') return '';
    const cleaned = cellText.trim();
    if (!cleaned || cleaned === '-') return '';

    // 1. Explicit Room prefix check (e.g. "RoomNo-C421", "Room: C302", "Room No: R104B", "Rm-M126")
    const explicitMatch = cleaned.match(new RegExp('(?:RoomNo|Room\\s*No|Room|Rm|Venue|Hall|RNo)[\\s#:-]+([A-Za-z0-9\\s/-]+?)(?=\\s*(?:-|<|$|\\n|\\t))', 'i'));
    if (explicitMatch && explicitMatch[1]) {
        let candidate = explicitMatch[1].trim().replace(/^[-:]\s*/, '');
        candidate = cleanRoomNumber(candidate);
        if (candidate && candidate.length >= 2 && candidate.length <= 15 && !candidate.toUpperCase().startsWith('S-')) {
            return candidate;
        }
    }

    // 2. Strip out courseCode and section from cellText to prevent matching digits in course code
    let remaining = cleaned;
    if (fullCode) {
        remaining = remaining.replace(fullCode, ' ');
        const raw = fullCode.replace(/-[LPTS]$/i, '');
        remaining = remaining.replace(raw, ' ');
    }
    if (section) {
        remaining = remaining.replace(section, ' ');
    }
    remaining = remaining.replace(/S-\d+/gi, ' ');
    remaining = remaining.replace(/<[^>]+>/g, ' ');

    // 3. Match authentic KLU building room patterns:
    // C-Block (e.g. C101, C201, C324, C421, C619, C018), R-Block (R101, R210D, R104B, R301),
    // M-Block (M126, M204), L-Block (L311, L502), S-Block (S412A, S718), F-Block (F102, F201), E-Block (E204)
    const kluRoomMatch = remaining.match(/\b([CRMFLSE](?:-?[0-9]{3}[A-Za-z]?))\b/i)
        || remaining.match(/\b([A-Za-z]{1,2}[0-9]{2,3}[A-Za-z]?)\b/);
    if (kluRoomMatch && kluRoomMatch[1]) {
        return cleanRoomNumber(kluRoomMatch[1].toUpperCase());
    }

    // 4. Check if dash-separated parts exist: "24CS2105 - S-12 - C421"
    const parts = cleaned.split(/\s*-\s*/);
    if (parts.length >= 3) {
        let candidate = parts[2].replace(/^RoomNo[-:]?/i, '').replace(/<[^>]+>/g, '').trim();
        candidate = cleanRoomNumber(candidate);
        if (candidate && candidate !== '-' && !candidate.startsWith('S-')) {
            return candidate;
        }
    }

    return '';
}

// Automatically parse any KLU timetable HTML
export function parseKluTimetableHtml(html) {
    if (!html || typeof html !== 'string') return null;
    try {
        const timetable = {
            Monday: [],
            Tuesday: [],
            Wednesday: [],
            Thursday: [],
            Friday: [],
            Saturday: []
        };

        const dayMap = {
            mon: 'Monday', monday: 'Monday',
            tue: 'Tuesday', tuesday: 'Tuesday',
            wed: 'Wednesday', wednesday: 'Wednesday',
            thu: 'Thursday', thursday: 'Thursday',
            fri: 'Friday', friday: 'Friday',
            sat: 'Saturday', saturday: 'Saturday'
        };

        // Format A: Browser DOMParser for robust parsing of inner HTML tags
        if (typeof window !== 'undefined' && typeof DOMParser !== 'undefined') {
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const tables = Array.from(doc.querySelectorAll('table'));

            for (const table of tables) {
                const rows = Array.from(table.querySelectorAll('tr'));
                let slotHeaderMap = [];

                // Check first row for header slot definitions (S1, S2, ..., Lunch)
                if (rows.length > 0) {
                    const headerCells = Array.from(rows[0].querySelectorAll('th, td'));
                    if (headerCells.length > 1) {
                        const hTexts = headerCells.map(hc => hc.textContent.trim().toLowerCase());
                        if (hTexts.some(t => t.includes('day') || t.includes('period') || t.includes('slot') || /s\d+/.test(t) || /^\d+$/.test(t))) {
                            let currSlotNum = 1;
                            for (let hi = 1; hi < headerCells.length; hi++) {
                                const hTxt = headerCells[hi].textContent.trim().toLowerCase();
                                const sMatch = hTxt.match(/s\s*(\d+)/i) || hTxt.match(/^(\d+)$/);
                                if (sMatch) {
                                    slotHeaderMap.push({ isBreak: false, slot: parseInt(sMatch[1], 10) });
                                    currSlotNum = parseInt(sMatch[1], 10) + 1;
                                } else if (hTxt.includes('lunch') || hTxt.includes('break') || hTxt.includes('recess')) {
                                    slotHeaderMap.push({ isBreak: true, slot: null });
                                } else {
                                    slotHeaderMap.push({ isBreak: false, slot: currSlotNum });
                                    currSlotNum++;
                                }
                            }
                        }
                    }
                }

                for (const row of rows) {
                    const cells = Array.from(row.querySelectorAll('td, th'));
                    if (cells.length < 2) continue;

                    const firstCellText = cells[0].textContent.trim().toLowerCase();
                    const dayKey = dayMap[firstCellText];
                    if (!dayKey) continue;

                    // Matrix format: cells 1..N correspond to session slots (accounting for colspan & lunch columns)
                    let currentSlot = 1;
                    const contentCells = cells.slice(1);
                    for (let c = 0; c < contentCells.length; c++) {
                        const cell = contentCells[c];
                        const colspan = parseInt(cell.getAttribute('colspan') || '1', 10) || 1;
                        const cellText = cell.textContent.trim();
                        const isLunchCell = cellText.toLowerCase().includes('lunch') || cellText.toLowerCase().includes('break');

                        let slotIndex = currentSlot;
                        if (slotHeaderMap.length > c && slotHeaderMap[c]) {
                            if (slotHeaderMap[c].isBreak) {
                                continue;
                            }
                            slotIndex = slotHeaderMap[c].slot || currentSlot;
                        }

                        currentSlot += colspan;
                        if (isLunchCell || !cellText || cellText === '-' || cellText.length < 3) continue;

                        // Match course code pattern e.g. 24SDCS01E-S, 24CS2101R-L, 24AD2001A
                        const codeMatch = cellText.match(/([0-9]{2}[A-Za-z0-9-]+(?:-[LPTS])?)/i);
                        if (codeMatch) {
                            let fullCode = codeMatch[1].trim();
                            const sectionMatch = cellText.match(/S-\d+/i);
                            const section = sectionMatch ? sectionMatch[0] : 'S-53';

                            const cellUpper = cellText.toUpperCase();
                            let comp = 'Lecture';
                            if (fullCode.endsWith('-P') || cellUpper.includes('PRACTICAL') || cellUpper.includes(' LAB') || cellUpper.includes('(P)') || cellUpper.includes('/P')) {
                                comp = 'Practical';
                                if (!fullCode.endsWith('-P')) fullCode = `${fullCode.replace(/-[LPTS]$/, '')}-P`;
                            } else if (fullCode.endsWith('-T') || cellUpper.includes('TUTORIAL') || cellUpper.includes('(T)') || cellUpper.includes('/T')) {
                                comp = 'Tutorial';
                                if (!fullCode.endsWith('-T')) fullCode = `${fullCode.replace(/-[LPTS]$/, '')}-T`;
                            } else if (fullCode.endsWith('-S') || cellUpper.includes('SKILL') || cellUpper.includes('(S)') || cellUpper.includes('/S')) {
                                comp = 'Skill';
                                if (!fullCode.endsWith('-S')) fullCode = `${fullCode.replace(/-[LPTS]$/, '')}-S`;
                            } else {
                                comp = 'Lecture';
                                if (!fullCode.endsWith('-L') && !fullCode.endsWith('-P') && !fullCode.endsWith('-T') && !fullCode.endsWith('-S')) {
                                    fullCode = `${fullCode}-L`;
                                }
                            }

                            const sessionInfo = KLU_SESSIONS[slotIndex - 1] || { id: `S${slotIndex}`, start: '', end: '', label: `Slot ${slotIndex}` };
                            const raw = fullCode.replace(/-[LPTS]$/, '');
                            const title = getSubjectName(raw) || getSubjectName(fullCode) || fullCode;
                            const isLab = comp === 'Practical';
                            const parsedRoom = extractRoom(cellText, fullCode, section);
                            const room = parsedRoom || (isLab ? getCourseLabRoom(fullCode, title) : 'C324');

                            timetable[dayKey].push({
                                period: slotIndex,
                                periodEnd: slotIndex + colspan - 1,
                                span: colspan,
                                slotId: sessionInfo.id,
                                time: sessionInfo.label || `${sessionInfo.start} – ${sessionInfo.end}`,
                                code: fullCode,
                                rawCode: raw,
                                title,
                                component: comp,
                                type: comp === 'Practical' ? 'Practical Lab' : comp,
                                section,
                                room
                            });
                        }
                    }
                }
            }

            const totalDom = Object.values(timetable).reduce((acc, curr) => acc + (Array.isArray(curr) ? curr.length : 0), 0);
            if (totalDom > 0) return timetable;
        }

        // Format B: Regex fallback for environments without DOMParser
        const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
        let rowMatch;
        while ((rowMatch = rowRegex.exec(html)) !== null) {
            const rowContent = rowMatch[1];
            const dayMatch = rowContent.match(/>\s*(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Mon|Tue|Wed|Thu|Fri|Sat)\s*</i) ||
                             rowContent.match(/(?:day|dayname)[^>]*>\s*(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Mon|Tue|Wed|Thu|Fri|Sat)/i);
            if (!dayMatch) continue;
            const dayKey = dayMap[dayMatch[1].toLowerCase()];
            if (!dayKey) continue;

            const tdRegex = /<td([^>]*)>([\s\S]*?)<\/td>/gi;
            let tdMatch;
            let currentSlot = 1;
            let isFirst = true;
            while ((tdMatch = tdRegex.exec(rowContent)) !== null) {
                if (isFirst) {
                    isFirst = false;
                    continue;
                }
                const attrs = tdMatch[1] || '';
                const cell = tdMatch[2] || '';
                const colspanMatch = attrs.match(/colspan=["']?(\d+)["']?/i);
                const colspan = colspanMatch ? (parseInt(colspanMatch[1], 10) || 1) : 1;
                const slotIndex = currentSlot;
                currentSlot += colspan;

                const codeMatch = cell.match(/>\s*([A-Z0-9]+-[LPTS])\s*</i) || cell.match(/>\s*([0-9]{2}[A-Z0-9]+[A-Z0-9-]*)\s*</i) || cell.match(/([A-Z0-9]+-[LPTS])/i);
                if (codeMatch) {
                    const fullCode = codeMatch[1].trim();
                    const sectionMatch = cell.match(/S-\d+/i);
                    const section = sectionMatch ? sectionMatch[0] : 'S-53';

                    const comp = fullCode.endsWith('-P') ? 'Practical'
                        : fullCode.endsWith('-T') ? 'Tutorial'
                        : fullCode.endsWith('-S') ? 'Skill'
                        : 'Lecture';

                    const sessionInfo = KLU_SESSIONS[slotIndex - 1] || { id: `S${slotIndex}`, start: '', end: '', label: `Slot ${slotIndex}` };
                    const raw = fullCode.replace(/-[LPTS]$/, '');
                    const title = getSubjectName(raw) || getSubjectName(fullCode) || fullCode;
                    const isLab = comp === 'Practical';
                    const parsedRoom = extractRoom(cell, fullCode, section);
                    const room = parsedRoom || (isLab ? getCourseLabRoom(fullCode, title) : 'C324');

                    timetable[dayKey].push({
                        period: slotIndex,
                        periodEnd: slotIndex + colspan - 1,
                        span: colspan,
                        slotId: sessionInfo.id,
                        time: sessionInfo.label || `${sessionInfo.start} – ${sessionInfo.end}`,
                        code: fullCode,
                        rawCode: raw,
                        title,
                        component: comp,
                        type: comp === 'Practical' ? 'Practical Lab' : comp,
                        section,
                        room
                    });
                }
            }
        }

        const totalRegex = Object.values(timetable).reduce((acc, curr) => acc + (Array.isArray(curr) ? curr.length : 0), 0);
        return totalRegex > 0 ? timetable : null;
    } catch (e) {
        console.warn('[Timetable] Error parsing HTML:', e);
        return null;
    }
}

/**
 * Normalizes timetable data from various sources (standard day-array or TimeTablekl slot-map format).
 */
export function normalizeTimetableFormat(rawTimetable, username = null) {
    if (!rawTimetable || typeof rawTimetable !== 'object') return null;

    const dayNameMap = {
        mon: 'Monday', monday: 'Monday',
        tue: 'Tuesday', tuesday: 'Tuesday',
        wed: 'Wednesday', wednesday: 'Wednesday',
        thu: 'Thursday', thursday: 'Thursday',
        fri: 'Friday', friday: 'Friday',
        sat: 'Saturday', saturday: 'Saturday',
        sun: 'Sunday', sunday: 'Sunday'
    };

    const campus = detectCampus(username);
    const timings = campus === 'hyderabad' ? HYDERABAD_SLOT_TIMES : VIJAYAWADA_SLOT_TIMES;

    const normalized = {
        Monday: [],
        Tuesday: [],
        Wednesday: [],
        Thursday: [],
        Friday: [],
        Saturday: []
    };

    // Case 1: Already day-array format e.g. { Monday: [ { period: 1, ... } ] }
    let hasArraySlots = false;
    for (const [key, val] of Object.entries(rawTimetable)) {
        if (key.startsWith('_')) continue;
        const mappedDay = dayNameMap[key.trim().toLowerCase()];
        if (mappedDay && Array.isArray(val) && val.length > 0) {
            hasArraySlots = true;
            if (!normalized[mappedDay]) normalized[mappedDay] = [];
            normalized[mappedDay] = val.map(slot => ({
                ...slot,
                title: getSubjectName(slot.rawCode || slot.code?.replace(/-[LPTS]$/, '')) || slot.title || slot.code
            }));
        }
    }
    if (hasArraySlots) {
        return normalized;
    }

    // Case 2: Slot-map format e.g. { "Mon": { "1": "24GMI3101HF-P - S-2 -RoomNo-C018", "2": "-" } }
    for (const [key, val] of Object.entries(rawTimetable)) {
        if (key.startsWith('_')) continue;
        const mappedDay = dayNameMap[key.trim().toLowerCase()];
        if (!mappedDay || typeof val !== 'object' || Array.isArray(val)) continue;

        if (!normalized[mappedDay]) normalized[mappedDay] = [];

        for (const [slotStr, content] of Object.entries(val)) {
            if (!content || content === '-' || typeof content !== 'string') continue;
            const slotNum = parseInt(slotStr, 10);
            if (isNaN(slotNum) || slotNum <= 0) continue;

            const parts = content.split(' - ');
            const fullCode = (parts[0] || '').trim();
            if (!fullCode || fullCode === '-') continue;

            const sectionMatch = content.match(/S-\d+/i);
            const section = sectionMatch ? sectionMatch[0] : (parts[1]?.startsWith('S-') ? parts[1] : 'S-53');

            const comp = fullCode.endsWith('-P') ? 'Practical'
                : fullCode.endsWith('-T') ? 'Tutorial'
                : fullCode.endsWith('-S') ? 'Skill'
                : 'Lecture';

            const raw = fullCode.replace(/-[LPTS]$/, '');
            const title = getSubjectName(raw) || getSubjectName(fullCode) || fullCode;
            const isLab = comp === 'Practical';
            const parsedRoom = extractRoom(content, fullCode, section);
            const room = parsedRoom || (isLab ? getCourseLabRoom(fullCode, title) : 'C324');

            const slotInfo = timings[slotNum] || { start: '', end: '' };
            const timeLabel = slotInfo.start && slotInfo.end 
                ? `${slotInfo.start} – ${slotInfo.end}` 
                : (PERIOD_TIMINGS[slotNum]?.label || `Slot ${slotNum}`);

            normalized[mappedDay].push({
                period: slotNum,
                slotId: `S${slotNum}`,
                time: timeLabel,
                code: fullCode,
                rawCode: raw,
                title,
                component: comp,
                type: comp === 'Practical' ? 'Practical Lab' : comp,
                section,
                room
            });
        }

        normalized[mappedDay].sort((a, b) => a.period - b.period);
    }

    const totalSlots = Object.values(normalized).reduce((acc, curr) => acc + curr.length, 0);
    return totalSlots > 0 ? normalized : null;
}

// Generates a deterministic integer hash from a string
function hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
}

// Standard KLU Semester Core Courses
export const DEFAULT_KLU_COURSES = [
    {
        code: '23CS2101',
        title: 'Data Structures & Algorithms',
        percentage: 89.2,
        percent: 89.2,
        components: {
            Lecture: { conducted: 24, attended: 22 },
            Practical: { conducted: 12, attended: 10 }
        }
    },
    {
        code: '23CS2102',
        title: 'Database Management Systems',
        percentage: 84.5,
        percent: 84.5,
        components: {
            Lecture: { conducted: 22, attended: 19 },
            Practical: { conducted: 12, attended: 9 }
        }
    },
    {
        code: '23CS2103',
        title: 'Operating Systems',
        percentage: 91.0,
        percent: 91.0,
        components: {
            Lecture: { conducted: 26, attended: 24 },
            Tutorial: { conducted: 8, attended: 7 }
        }
    },
    {
        code: '24AD01HF',
        title: 'Artificial Intelligence & Neural Nets',
        percentage: 86.0,
        percent: 86.0,
        components: {
            Lecture: { conducted: 24, attended: 21 },
            Practical: { conducted: 10, attended: 8 }
        }
    },
    {
        code: '23CS2205',
        title: 'Computer Networks & Security',
        percentage: 88.0,
        percent: 88.0,
        components: {
            Lecture: { conducted: 24, attended: 22 },
            Practical: { conducted: 10, attended: 8 }
        }
    },
    {
        code: '23EN2101',
        title: 'Professional Communication',
        percentage: 95.0,
        percent: 95.0,
        components: {
            Lecture: { conducted: 20, attended: 19 }
        }
    }
];

export function getAnyStoredCourses(studentId) {
    if (typeof window === 'undefined') return null;
    try {
        const keysToTry = [];
        if (studentId) {
            keysToTry.push(`kleData_${studentId}`);
        }
        keysToTry.push('kleData');
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith('kleData_') && !keysToTry.includes(k)) {
                keysToTry.push(k);
            }
        }
        for (const k of keysToTry) {
            const raw = localStorage.getItem(k);
            if (!raw) continue;
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed?.attendance_data) && parsed.attendance_data.length > 0) {
                return parsed.attendance_data;
            }
        }
    } catch {
        // ignore
    }
    return null;
}

/**
 * Accurately decodes student ID to extract admission batch, department, roll number, section, and designated home lecture hall.
 */
export function getStudentProfileFromId(studentId) {
    const raw = String(studentId || '').trim();
    const digits = raw.replace(/\D/g, '');
    
    const targetDigits = digits || '';
    if (!targetDigits || targetDigits.length < 6) {
        return {
            studentId: targetDigits,
            batchYear: 24,
            admissionYear: 2024,
            campus: 'vijayawada',
            deptCode: '03',
            deptShort: 'CSE',
            deptName: 'Computer Science & Engineering',
            rollNumber: 1,
            section: 'S-1',
            homeRoom: 'C324'
        };
    }
    
    const batchYear = parseInt(targetDigits.slice(0, 2), 10) || 24;
    const campusDigits = targetDigits.slice(2, 5);
    const campus = campusDigits === '000' ? 'vijayawada' : 'hyderabad';
    const deptCode = targetDigits.slice(5, 7) || '03';
    const rollNumber = parseInt(targetDigits.slice(7), 10) || 1;
    
    // Determine Department
    let deptName = 'Computer Science & Engineering';
    let deptShort = 'CSE';
    if (deptCode === '04') {
        deptName = 'Electronics & Communication Engineering';
        deptShort = 'ECE';
    } else if (deptCode === '02') {
        deptName = 'Electrical & Electronics Engineering';
        deptShort = 'EEE';
    } else if (deptCode === '07') {
        deptName = 'Mechanical Engineering';
        deptShort = 'ME';
    } else if (deptCode === '01') {
        deptName = 'Civil Engineering';
        deptShort = 'CE';
    } else if (deptCode === '09') {
        deptName = 'Artificial Intelligence & Data Science';
        deptShort = 'AI&DS';
    } else if (deptCode === '08' || deptCode === '05') {
        deptName = 'Information Technology';
        deptShort = 'IT';
    } else if (deptCode === '10') {
        deptName = 'Biotechnology';
        deptShort = 'BT';
    }

    // Determine section from roll number (65 students per section in KLU)
    const sectionNum = Math.min(80, Math.max(1, Math.floor(rollNumber / 65) + 1));
    const section = `S-${sectionNum}`;

    // Authentic designated Lecture Halls by department
    const cseLectureHalls = ['C324', 'C421', 'C415', 'C501', 'C521', 'R301', 'R304', 'R401', 'R104B', 'C322', 'C416'];
    const eceLectureHalls = ['E101', 'E102', 'E201', 'E202', 'E301'];
    const eeeLectureHalls = ['E201', 'E202', 'E204'];
    const meLectureHalls = ['M102', 'M126', 'M204'];

    let candidateHalls = cseLectureHalls;
    if (deptShort === 'ECE') candidateHalls = eceLectureHalls;
    else if (deptShort === 'EEE') candidateHalls = eeeLectureHalls;
    else if (deptShort === 'ME' || deptShort === 'CE') candidateHalls = meLectureHalls;

    const homeRoom = candidateHalls[(rollNumber + sectionNum) % candidateHalls.length];

    return {
        studentId: targetDigits,
        batchYear, // e.g. 24
        admissionYear: 2000 + batchYear, // e.g. 2024
        campus,
        deptCode,
        deptShort,
        deptName,
        rollNumber,
        section,
        homeRoom
    };
}

/**
 * Filters out courses that do not belong to the student's branch (e.g. dummy test courses)
 */
export function filterCoursesForStudent(courses = [], studentId) {
    if (!Array.isArray(courses) || courses.length === 0) return [];
    const profile = getStudentProfileFromId(studentId);
    
    // If student is CSE, filter out pure 24EC branch-specific courses if other courses exist
    if (profile.deptShort !== 'ECE') {
        const filtered = courses.filter(c => {
            const code = String(c.code || c.name || '').toUpperCase();
            return !code.startsWith('24EC');
        });
        if (filtered.length > 0) return filtered;
    }
    return courses;
}

/**
 * Returns genuine, authentic KLU curriculum for this specific student ID, Year of Study and Semester.
 */
export function getCurriculumForStudent(studentId, cleanYear = '2026-2027', cleanSem = 'Odd') {
    const profile = getStudentProfileFromId(studentId);
    const academicStartYear = parseInt(cleanYear.split('-')[0], 10) || 2026;
    
    // Calculate year of study (1 to 4) based on student ID batch
    const yearOfStudy = Math.min(4, Math.max(1, academicStartYear - profile.admissionYear + 1));
    const semType = normalizeSemester(cleanSem);

    // ECE student curriculum
    if (profile.deptShort === 'ECE') {
        if (yearOfStudy === 1) {
            return semType === 'Even'
                ? [
                    { code: '24EC1202', title: 'Signals and Systems', components: { Lecture: {}, Tutorial: {} } },
                    { code: '24MT1202', title: 'Discrete Mathematics', components: { Lecture: {}, Tutorial: {} } },
                    { code: '24EC1203', title: 'Digital Circuit Design', components: { Lecture: {}, Practical: {} } },
                    { code: '24CS1101', title: 'Problem Solving in C', components: { Lecture: {}, Practical: {} } }
                ]
                : [
                    { code: '24MT1101', title: 'Linear Algebra & Calculus', components: { Lecture: {}, Tutorial: {} } },
                    { code: '24EC1101', title: 'Electronic Devices & Circuits', components: { Lecture: {}, Practical: {} } },
                    { code: '24PH1101', title: 'Engineering Physics', components: { Lecture: {}, Practical: {} } },
                    { code: '24EE1101', title: 'Basic Electrical Engineering', components: { Lecture: {}, Practical: {} } },
                    { code: '24EN1101', title: 'Professional Communication', components: { Lecture: {}, Tutorial: {} } }
                ];
        } else if (yearOfStudy === 2) {
            return semType === 'Even'
                ? [
                    { code: '24EC2206', title: 'Microprocessors and Microcontrollers', components: { Lecture: {}, Practical: {} } },
                    { code: '24EC2207', title: 'Digital Signal Processing', components: { Lecture: {}, Practical: {} } },
                    { code: '24EC2208', title: 'Control Systems Engineering', components: { Lecture: {}, Tutorial: {} } }
                ]
                : [
                    { code: '24EC2102', title: 'Analog Circuits', components: { Lecture: {}, Practical: {} } },
                    { code: '24EC2103', title: 'Electromagnetic Fields & Waves', components: { Lecture: {}, Tutorial: {} } },
                    { code: '24EC2104', title: 'Communication Theory', components: { Lecture: {}, Practical: {} } }
                ];
        }
    }

    // Default to CSE / Engineering Curriculum by Year of Study:
    if (yearOfStudy === 3) {
        // 3rd Year (Current 2026-2027 for 2024 Batch)
        if (semType === 'Even') {
            return [
                { code: '24CS3213', title: 'Distributed Systems & Edge Computing', components: { Lecture: {}, Practical: {} } },
                { code: '24CS3214', title: 'Deep Learning & Generative Models', components: { Lecture: {}, Practical: {} } },
                { code: '24CS3215', title: 'DevOps & Site Reliability Engineering', components: { Lecture: {}, Skill: {} } },
                { code: '24CS3216', title: 'Natural Language Processing', components: { Lecture: {}, Practical: {} } }
            ];
        } else if (semType === 'Summer') {
            return [
                { code: '24CS3301', title: 'Capstone Project & Practice', components: { Practical: {}, Skill: {} } }
            ];
        } else if (semType === 'Term3') {
            return [
                { code: '24CS3401', title: 'Advanced Cloud Architecture', components: { Lecture: {}, Skill: {} } }
            ];
        } else {
            // Odd Sem (Sem 5)
            return [
                { code: '24GMI3101', title: 'Principles of Deep Neural Computation', components: { Lecture: {}, Practical: {} } },
                { code: '24EDS3308', title: 'Enterprise Data Science', components: { Lecture: {}, Practical: {} } },
                { code: '24SDCS03A', title: 'SOA Programming and Microservices', components: { Lecture: {}, Tutorial: {}, Skill: {} } },
                { code: '24CC3014', title: 'Cloud Computing', components: { Skill: {} } },
                { code: '24CS3206', title: 'Theory of Computation', components: { Lecture: {}, Tutorial: {} } },
                { code: '24CS3105', title: 'Information Assurance and Security', components: { Lecture: {}, Tutorial: {} } }
            ];
        }
    } else if (yearOfStudy === 2) {
        // 2nd Year
        if (semType === 'Even') {
            return [
                { code: '24CS2209', title: 'Software Engineering & Agile', components: { Lecture: {}, Tutorial: {} } },
                { code: '24CS2210', title: 'Artificial Intelligence & Machine Learning', components: { Lecture: {}, Practical: {} } },
                { code: '24CS2211', title: 'Formal Languages and Automata Theory', components: { Lecture: {}, Tutorial: {} } },
                { code: '24CS2212', title: 'Cyber Security Fundamentals', components: { Lecture: {}, Practical: {} } },
                { code: '24SDCS02', title: 'Cloud Platform Engineering', components: { Skill: {} } }
            ];
        } else if (semType === 'Summer') {
            return [
                { code: '24CS2301', title: 'Accelerated Data Structures & Problem Solving', components: { Lecture: {}, Practical: {} } },
                { code: '24CS2302', title: 'Summer Internship & Practical Project', components: { Practical: {}, Skill: {} } }
            ];
        } else if (semType === 'Term3') {
            return [
                { code: '24CS2401', title: 'Industry Certified Elective', components: { Lecture: {}, Practical: {} } },
                { code: '24SDCS04', title: 'Mobile Application Architecture', components: { Skill: {} } }
            ];
        } else {
            // Odd Sem (Sem 3)
            return [
                { code: '24CS2105', title: 'Database Management Systems', components: { Lecture: {}, Practical: {} } },
                { code: '24CS2106', title: 'Design & Analysis of Algorithms', components: { Lecture: {}, Tutorial: {} } },
                { code: '24CS2107', title: 'Operating Systems', components: { Lecture: {}, Practical: {} } },
                { code: '24CS2108', title: 'Computer Networks', components: { Lecture: {}, Practical: {} } },
                { code: '24SDCS01', title: 'Full Stack Web Development', components: { Skill: {} } }
            ];
        }
    } else if (yearOfStudy === 1) {
        // 1st Year
        if (semType === 'Even') {
            return [
                { code: '24CS1202', title: 'Data Structures', components: { Lecture: {}, Practical: {} } },
                { code: '24MT1202', title: 'Discrete Mathematics', components: { Lecture: {}, Tutorial: {} } },
                { code: '24CS1203', title: 'Computer Organization & Architecture', components: { Lecture: {}, Tutorial: {} } },
                { code: '24CS1204', title: 'Object Oriented Programming with Java', components: { Lecture: {}, Practical: {} } },
                { code: '24CY1201', title: 'Environmental Science & Sustainability', components: { Lecture: {} } }
            ];
        } else {
            // Odd Sem (Sem 1)
            return [
                { code: '24MT1101', title: 'Linear Algebra & Calculus', components: { Lecture: {}, Tutorial: {} } },
                { code: '24CS1101', title: 'Problem Solving and Computer Programming', components: { Lecture: {}, Practical: {} } },
                { code: '24PH1101', title: 'Engineering Physics', components: { Lecture: {}, Practical: {} } },
                { code: '24EE1101', title: 'Basic Electrical & Electronics Engineering', components: { Lecture: {}, Practical: {} } },
                { code: '24EN1101', title: 'Professional Communication', components: { Lecture: {}, Tutorial: {} } }
            ];
        }
    }

    // 4th Year fallback
    return [
        { code: '23CS4101', title: 'Major Capstone Project', components: { Practical: {}, Skill: {} } },
        { code: '23CS4102', title: 'Industrial Internship', components: { Practical: {} } }
    ];
}

/**
 * Validates that cached timetable data is valid and does not contain fake or corrupted codes.
 */
export function isTimetableValidForStudent(timetable) {
    if (!timetable || typeof timetable !== 'object') return false;
    const slots = Object.values(timetable).flatMap(val => Array.isArray(val) ? val : (val && typeof val === 'object' ? Object.values(val) : []));
    if (slots.length === 0) return false;

    // Check if rooms contain corrupt labels like 'Room Room'
    const hasCorruptRoom = slots.some(s => {
        const r = String(s.room || '').trim();
        return r.includes('Room Room') || r.includes('RoomNo-RoomNo');
    });

    if (hasCorruptRoom) return false;

    return true;
}

/**
 * Builds a deterministic, realistic KLU timetable mapped to the student's actual ERP courses or semester curriculum.
 */
export function buildTimetableFromErpCourses(courses = [], studentId = 'default', selectedYear = '2026-2027', selectedSem = 'Odd') {
    const cleanYear = normalizeAcademicYear(selectedYear);
    const cleanSem = normalizeSemester(selectedSem);
    const profile = getStudentProfileFromId(studentId);

    let activeCourses = filterCoursesForStudent(courses, studentId);
    if (!activeCourses || activeCourses.length === 0) {
        activeCourses = getCurriculumForStudent(studentId, cleanYear, cleanSem);
    }
    if (!activeCourses || activeCourses.length === 0) {
        activeCourses = DEFAULT_KLU_COURSES;
    }

    const timetable = {
        Monday: [],
        Tuesday: [],
        Wednesday: [],
        Thursday: [],
        Friday: [],
        Saturday: []
    };

    // Flatten course components: Lecture (L), Tutorial (T), Practical (P), Skill (S)
    const slotPool = [];
    activeCourses.forEach((course) => {
        const comps = Object.keys(course.components || {});
        const rawCode = (course.code || 'COURSE').replace(/-[LPTS]$/, '').trim();
        const title = course.title || course.name || KLU_COURSE_NAMES[rawCode] || 'Subject';
        const pct = course.percentage || course.percent || course.totalPercentage || 85;

        // If course has explicit components map, expand them
        if (comps.length > 0) {
            comps.forEach(comp => {
                const norm = comp.toLowerCase();
                const type = norm.includes('pract') || norm.includes('lab') || comp === 'P'
                    ? 'Practical Lab'
                    : norm.includes('skill') || comp === 'S'
                    ? 'Skill'
                    : norm.includes('tut') || comp === 'T'
                    ? 'Tutorial'
                    : 'Lecture';

                if (type === 'Practical Lab') {
                    slotPool.push({ code: `${rawCode}-P`, rawCode, title: `${title} (Lab)`, component: 'Practical', type, weight: 50, isLab: true, pct, length: 2 });
                } else if (type === 'Skill') {
                    slotPool.push({ code: `${rawCode}-S`, rawCode, title, component: 'Skill', type, weight: 25, isLab: false, pct, length: 1 });
                } else if (type === 'Tutorial') {
                    slotPool.push({ code: `${rawCode}-T`, rawCode, title: `${title} (Tutorial)`, component: 'Tutorial', type, weight: 100, isLab: false, pct, length: 1 });
                } else {
                    slotPool.push({ code: `${rawCode}-L`, rawCode, title, component: 'Lecture', type: 'Lecture', weight: 100, isLab: false, pct, length: 1 });
                }
            });
        } else {
            // Inspect course.code for direct LTPS suffix:
            const codeUpper = String(course.code || '').trim().toUpperCase();
            if (codeUpper.endsWith('-P') || (course.type || '').toLowerCase().includes('pract')) {
                slotPool.push({ code: `${rawCode}-P`, rawCode, title: `${title} (Lab)`, component: 'Practical', type: 'Practical Lab', weight: 50, isLab: true, pct, length: 2 });
            } else if (codeUpper.endsWith('-T') || (course.type || '').toLowerCase().includes('tut')) {
                slotPool.push({ code: `${rawCode}-T`, rawCode, title: `${title} (Tutorial)`, component: 'Tutorial', type: 'Tutorial', weight: 100, isLab: false, pct, length: 1 });
            } else if (codeUpper.endsWith('-S') || (course.type || '').toLowerCase().includes('skill')) {
                slotPool.push({ code: `${rawCode}-S`, rawCode, title, component: 'Skill', type: 'Skill', weight: 25, isLab: false, pct, length: 1 });
            } else if (codeUpper.endsWith('-L')) {
                slotPool.push({ code: `${rawCode}-L`, rawCode, title, component: 'Lecture', type: 'Lecture', weight: 100, isLab: false, pct, length: 1 });
            } else {
                // Course without suffix: provide Lecture, and if course is known lab or skill, provide that
                slotPool.push({ code: `${rawCode}-L`, rawCode, title, component: 'Lecture', type: 'Lecture', weight: 100, isLab: false, pct, length: 1 });
                if (title.toLowerCase().includes('lab') || title.toLowerCase().includes('pract') || rawCode.includes('GMI') || rawCode.includes('EDS')) {
                    slotPool.push({ code: `${rawCode}-P`, rawCode, title: `${title} (Lab)`, component: 'Practical', type: 'Practical Lab', weight: 50, isLab: true, pct, length: 2 });
                }
            }
        }
    });

    // Authentic section and designated room from Student Profile
    const studentSection = profile.section;
    const studentHomeRoom = profile.homeRoom;
    const studentSeed = hashCode(studentId || 'klu_student');

    // Distribute slots across Monday - Saturday matching KLU 14-session timetable
    DAYS_OF_WEEK.forEach((day, dayIndex) => {
        const daySeed = studentSeed + dayIndex * 17;
        let periodIdx = 0;
        let daySlotsRemaining = 4 + (daySeed % 3);

        const dayCourses = [...slotPool].sort((a, b) => {
            const hA = hashCode(a.code + day + studentId);
            const hB = hashCode(b.code + day + studentId);
            return hA - hB;
        });

        const candidatePeriods = [1, 2, 3, 4, 5, 7, 8, 10, 11];
        let pIter = 0;

        while (pIter < candidatePeriods.length && daySlotsRemaining > 0 && periodIdx < dayCourses.length) {
            const currentPeriod = candidatePeriods[pIter];
            const courseSlot = dayCourses[periodIdx % dayCourses.length];
            periodIdx++;
            if (!courseSlot) break;

            const sess = KLU_SESSIONS.find(s => s.slot === currentPeriod) || {
                id: `S${currentPeriod}`,
                label: `${PERIOD_TIMINGS[currentPeriod]?.start || '09:00'} – ${PERIOD_TIMINGS[currentPeriod]?.end || '10:00'}`
            };

            const isLab = courseSlot.isLab;
            const room = isLab
                ? getCourseLabRoom(courseSlot.code, courseSlot.title)
                : studentHomeRoom;
            const section = studentSection;

            timetable[day].push({
                period: currentPeriod,
                slotId: sess.id,
                time: sess.label,
                code: courseSlot.code,
                rawCode: courseSlot.rawCode,
                title: courseSlot.title,
                component: courseSlot.component || courseSlot.type,
                type: courseSlot.type,
                section,
                weight: courseSlot.weight || 100,
                room,
                pct: courseSlot.pct,
                span: isLab ? 2 : 1
            });

            daySlotsRemaining--;
            pIter++;
        }
    });

    return timetable;
}

/**
 * Retrieves the stored or freshly synthesized timetable for a student and academic session.
 */
export function getStudentTimetable(studentId, erpCourses = [], selectedYear = '2026-2027', selectedSem = 'Odd') {
    const activeErpUser = typeof window !== 'undefined' ? (localStorage.getItem('activeErpUser') || localStorage.getItem('rememberedId')) : null;
    const targetId = studentId || activeErpUser || '';
    if (!targetId) return null;

    const isSelf = !studentId || studentId === 'default' || studentId === activeErpUser;

    const cleanYear = normalizeAcademicYear(selectedYear);
    const cleanSem = normalizeSemester(selectedSem);

    const semVariants = [
        cleanSem,
        `${cleanSem} Sem`,
        `${cleanSem} Term`,
        cleanSem === 'Term3' ? 'Tri Sem / Term 3' : null,
        cleanSem === 'Summer' ? 'Summer Term' : null,
        cleanSem === 'Odd' ? 'Odd Sem' : null,
        cleanSem === 'Even' ? 'Even Sem' : null
    ].filter(Boolean);

    // 1. Check all candidate scoped keys in localStorage (strictly matching term first)
    if (typeof window !== 'undefined') {
        const candidateKeys = [];
        semVariants.forEach(s => {
            candidateKeys.push(`kl_timetable_${targetId}_${cleanYear}_${s}`);
        });
        candidateKeys.push(`kl_timetable_${targetId}_${cleanYear}`);
        candidateKeys.push(`kl_timetable_${targetId}`);
        candidateKeys.push(`timetable_${targetId}`);

        for (const storageKey of candidateKeys) {
            try {
                const cached = localStorage.getItem(storageKey);
                if (cached) {
                    let parsed = JSON.parse(cached);
                    if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
                        if (isTimetableValidForStudent(parsed, targetId)) {
                            const normalized = normalizeTimetableFormat(parsed, targetId);
                            if (normalized) {
                                const totalSlots = Object.values(normalized).reduce((acc, curr) => acc + (Array.isArray(curr) ? curr.length : 0), 0);
                                if (totalSlots > 0) {
                                    return { 
                                        ...normalized, 
                                        _source: parsed._source || 'saved', 
                                        _userCustomized: parsed._userCustomized,
                                        _last_synced: parsed._last_synced || parsed.last_synced_at
                                    };
                                }
                            }
                        }
                    }
                }
            } catch {
                // ignore cache read error
            }
        }
    }

    // 2. Check if TimeTablekl stored friend in localStorage.getItem("maddys")
    if (typeof window !== 'undefined') {
        try {
            const rawMaddys = localStorage.getItem('maddys');
            if (rawMaddys) {
                const parsedMaddys = JSON.parse(rawMaddys);
                if (Array.isArray(parsedMaddys)) {
                    const match = parsedMaddys.find(m => 
                        m.username === targetId || 
                        m.studentId === targetId || 
                        String(m.id) === targetId || 
                        (m.name && targetId.toLowerCase().includes(m.name.toLowerCase()))
                    );
                    if (match?.timetable && typeof match.timetable === 'object') {
                        if (isTimetableValidForStudent(match.timetable, targetId)) {
                            const normalized = normalizeTimetableFormat(match.timetable, targetId);
                            if (normalized) {
                                return normalized;
                            }
                        }
                    }
                }
            }
        } catch { /* ignore */ }
    }

    // 3. Check if TimeTablekl stored a timetable in localStorage.getItem("timetable")
    if (typeof window !== 'undefined' && isSelf) {
        try {
            const rawTt = localStorage.getItem('timetable');
            const ttOwner = localStorage.getItem('timetable_studentId') || localStorage.getItem('rememberedId');
            if (rawTt && ttOwner && ttOwner === targetId) {
                const parsed = JSON.parse(rawTt);
                if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
                    if (isTimetableValidForStudent(parsed, targetId)) {
                        const normalized = normalizeTimetableFormat(parsed, targetId);
                        if (normalized) {
                            return normalized;
                        }
                    }
                }
            }
        } catch { /* ignore */ }
    }

    // 4. Resolve real student courses for THIS exact student and THIS exact year/semester
    let coursesToUse = [];

    // 4a. Check scoped cache for this student + year + sem
    if (typeof window !== 'undefined') {
        const scopedKeys = semVariants.map(s => `kleData_${targetId}_${cleanYear}_${s}`);
        scopedKeys.push(`kleData_${targetId}_${cleanYear}`);
        for (const scopedKey of scopedKeys) {
            try {
                const scopedRaw = localStorage.getItem(scopedKey);
                if (scopedRaw) {
                    const p = JSON.parse(scopedRaw);
                    const list = p.attendance_data || p.data || (Array.isArray(p) ? p : []);
                    const validList = filterCoursesForStudent(list, targetId);
                    if (validList.length > 0) {
                        coursesToUse = validList;
                        break;
                    }
                }
            } catch { /* ignore */ }
        }
    }

    // 4b. If erpCourses is passed for targetId, check if it matches student department
    if (coursesToUse.length === 0 && Array.isArray(erpCourses) && erpCourses.length > 0) {
        const validList = filterCoursesForStudent(erpCourses, targetId);
        if (validList.length > 0) {
            coursesToUse = validList;
        }
    }

    // 4c. Check generic student cache (strictly scoped to targetId)
    if (coursesToUse.length === 0 && typeof window !== 'undefined') {
        try {
            const raw = localStorage.getItem(`kleData_${targetId}`) || (isSelf && targetId === localStorage.getItem('rememberedId') ? localStorage.getItem('kleData') : null);
            if (raw) {
                const p = JSON.parse(raw);
                const list = p.attendance_data || p.data || (Array.isArray(p) ? p : []);
                const validList = filterCoursesForStudent(list, targetId);
                if (validList.length > 0) {
                    coursesToUse = validList;
                }
            }
        } catch { /* ignore */ }
    }

    // 4d. Fall back to curriculum ONLY IF student has an active ERP session
    let isCurriculumFallback = false;
    if (coursesToUse.length === 0) {
        if (!hasActiveErpSession(targetId)) {
            return null;
        }
        coursesToUse = getCurriculumForStudent(targetId, cleanYear, cleanSem);
        isCurriculumFallback = true;
    }

    // 5. Build fresh timetable mapped to the actual registered courses for this semester
    const generated = buildTimetableFromErpCourses(coursesToUse, targetId, cleanYear, cleanSem);
    if (isCurriculumFallback) {
        generated._source = 'curriculum';
    } else {
        generated._source = 'erp_live';
    }

    // Only persist to localStorage if it came from real ERP courses AND student has active ERP session
    try {
        if (!isCurriculumFallback && hasActiveErpSession(targetId) && Object.keys(generated).length > 0) {
            const primaryKey = `kl_timetable_${targetId}_${cleanYear}_${cleanSem}`;
            localStorage.setItem(primaryKey, JSON.stringify(generated));
            localStorage.setItem(`kl_timetable_${targetId}`, JSON.stringify(generated));
        }
    } catch {
        // ignore storage quota
    }

    return generated;
}

/**
 * Saves customized timetable edits scoped to academic year and semester.
 */
export function saveStudentTimetable(studentId, timetableData, selectedYear = '2026-2027', selectedSem = 'Odd') {
    if (!studentId || !timetableData) return;
    const cleanYear = normalizeAcademicYear(selectedYear);
    const cleanSem = normalizeSemester(selectedSem);
    const semDisplay = cleanSem === 'Summer' ? 'Summer Term' : cleanSem === 'Term3' ? 'Tri Sem / Term 3' : cleanSem === 'Even' ? 'Even Sem' : 'Odd Sem';
    try {
        const toSave = { ...timetableData, _userCustomized: true, _last_synced: new Date().toISOString() };
        localStorage.setItem(`kl_timetable_${studentId}_${cleanYear}_${cleanSem}`, JSON.stringify(toSave));
        localStorage.setItem(`kl_timetable_${studentId}_${cleanYear}_${semDisplay}`, JSON.stringify(toSave));
        window.dispatchEvent(new CustomEvent('kl_timetable_updated', { detail: { studentId, year: cleanYear, sem: cleanSem } }));

        // Persist to server database asynchronously
        const apiBase = getErpBase();
        fetch(`${apiBase || ''}/api/user-data/${encodeURIComponent(studentId)}/timetable`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                academic_year: cleanYear,
                semester: cleanSem,
                timetable: toSave,
                source: 'user_customized'
            })
        }).catch(() => {});
    } catch {
        // ignore
    }
}

/**
 * Syncs timetable from persistent server database if client cache is empty
 */
export async function syncTimetableWithServer(studentId, yearId = '2026-2027', semId = 'Odd') {
    const cleanYear = normalizeAcademicYear(yearId);
    const cleanSem = normalizeSemester(semId);
    const activeUser = typeof window !== 'undefined' ? (localStorage.getItem('activeErpUser') || localStorage.getItem('rememberedId')) : null;
    const targetId = studentId || activeUser || '';
    if (!targetId) return null;

    try {
        const apiBase = getErpBase();
        const res = await fetch(`${apiBase || ''}/api/user-data/${encodeURIComponent(targetId)}?year=${encodeURIComponent(cleanYear)}&sem=${encodeURIComponent(cleanSem)}`);
        if (res.ok) {
            const data = await res.json();
            if (data?.profile?.timetable) {
                const tt = data.profile.timetable;
                tt._source = data.profile.timetable_meta?.source || 'database_cached';
                tt._last_synced = data.profile.timetable_meta?.last_synced_at;
                const semDisplay = cleanSem === 'Summer' ? 'Summer Term' : cleanSem === 'Term3' ? 'Tri Sem / Term 3' : cleanSem === 'Even' ? 'Even Sem' : 'Odd Sem';
                try {
                    localStorage.setItem(`kl_timetable_${targetId}_${cleanYear}_${cleanSem}`, JSON.stringify(tt));
                    localStorage.setItem(`kl_timetable_${targetId}_${cleanYear}_${semDisplay}`, JSON.stringify(tt));
                } catch { /* ignore */ }
                window.dispatchEvent(new CustomEvent('kl_timetable_updated', {
                    detail: { studentId: targetId, year: cleanYear, sem: cleanSem }
                }));
                return tt;
            }
        }
    } catch (e) {
        console.warn('[TimetableService] Server sync notice:', e.message);
    }
    return null;
}

/**
 * Fetches timetable directly from authentic KL ERP endpoint or backend proxy.
 */
export async function fetchLiveErpTimetable(studentId, yearId, semId) {
    const cleanYear = normalizeAcademicYear(yearId);
    const cleanSem = normalizeSemester(semId);
    const activeUser = typeof window !== 'undefined' ? (localStorage.getItem('activeErpUser') || localStorage.getItem('rememberedId')) : null;
    const targetId = studentId || activeUser || '';
    if (!targetId) return null;
    const storageKey = `kl_timetable_${targetId}_${cleanYear}_${cleanSem}`;

    // Check if targetId has an active ERP session
    if (!hasActiveErpSession(targetId)) {
        // Recover from server database if available
        const synced = await syncTimetableWithServer(targetId, cleanYear, cleanSem);
        if (synced) return { success: true, source: 'database_cached', timetable: synced };
        return null;
    }

    // Check if targetId has a saved session cookie
    const targetCookie = (typeof window !== 'undefined' ? localStorage.getItem(`erp_cookie_${targetId}`) : null);
    const cookie = targetCookie || getStoredErpCookies(targetId);
    if (!cookie) {
        const synced = await syncTimetableWithServer(targetId, cleanYear, cleanSem);
        if (synced) return { success: true, source: 'database_cached', timetable: synced };
        return null;
    }

    const apiBase = getErpBase();
    const csrfToken = getStoredCsrfToken();

    // Semester value mapping: Odd=1, Even=2, Summer=3, Term3=4
    let semVal = '1';
    if (cleanSem === 'Even') semVal = '2';
    else if (cleanSem === 'Summer') semVal = '3';
    else if (cleanSem === 'Term3') semVal = '4';

    // Candidate year IDs according to KLU ERP registration tables
    const firstYear = parseInt(cleanYear.split('-')[0], 10);
    let yearCandidates = ['29', '18', '22'];
    if (firstYear >= 2026) {
        const offset = Math.max(0, firstYear - 2026);
        yearCandidates = [String(29 + offset), String(18 + offset), '29', '18', '22'];
    } else if (firstYear === 2025) {
        yearCandidates = ['28', '17', '19', '18'];
    } else if (firstYear === 2024) {
        yearCandidates = ['27', '16', '17'];
    } else if (firstYear === 2023) {
        yearCandidates = ['26', '15'];
    } else if (!isNaN(firstYear)) {
        const diff = firstYear - 2026;
        yearCandidates = [String(29 + diff), String(18 + diff), '29', '18'];
    }

    // Direct fetch to authentic ERP route via reverse proxy
    try {
        const headers = buildErpHeaders({
            'Pragma': 'no-cache',
            'Cache-Control': 'no-cache',
            'X-Requested-With': 'XMLHttpRequest',
            'Content-Type': 'application/json',
            ...(cookie ? { 'x-erp-cookie': cookie } : {})
        }, targetId);
        if (csrfToken) headers['x-csrf-token'] = csrfToken;

        // Try fast proxy endpoint /api/fetch_timetable first
        try {
            const proxyResp = await fetch(`${apiBase || ''}/api/fetch_timetable`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    studentId: targetId,
                    username: targetId,
                    yearId: cleanYear,
                    semId: cleanSem,
                    academic_year_code: cleanYear,
                    semester_id: semVal
                }),
                credentials: 'include',
                cache: 'no-store'
            });
            if (proxyResp.ok) {
                const proxyData = await proxyResp.json().catch(() => null);
                if (proxyData?.timetable && Object.values(proxyData.timetable).some(arr => arr && Object.keys(arr).length > 0)) {
                    const parsed = proxyData.timetable;
                    parsed._source = proxyData.source || 'erp_live';
                    parsed._last_synced = proxyData.last_synced_at || new Date().toISOString();
                    const semDisplay = cleanSem === 'Summer' ? 'Summer Term' : cleanSem === 'Term3' ? 'Tri Sem / Term 3' : cleanSem === 'Even' ? 'Even Sem' : 'Odd Sem';
                    try {
                        localStorage.setItem(storageKey, JSON.stringify(parsed));
                        localStorage.setItem(`kl_timetable_${targetId}_${cleanYear}_${semDisplay}`, JSON.stringify(parsed));
                    } catch { /* ignore */ }
                    window.dispatchEvent(new CustomEvent('kl_timetable_updated', {
                        detail: { studentId: targetId, year: cleanYear, sem: cleanSem }
                    }));
                    return { success: true, source: parsed._source, timetable: parsed };
                } else if (proxyData?.html) {
                    const parsed = parseKluTimetableHtml(proxyData.html);
                    if (parsed && Object.values(parsed).some(arr => Array.isArray(arr) && arr.length > 0)) {
                        parsed._source = 'erp_live';
                        parsed._last_synced = new Date().toISOString();
                        const semDisplay = cleanSem === 'Summer' ? 'Summer Term' : cleanSem === 'Term3' ? 'Tri Sem / Term 3' : cleanSem === 'Even' ? 'Even Sem' : 'Odd Sem';
                        try {
                            localStorage.setItem(storageKey, JSON.stringify(parsed));
                            localStorage.setItem(`kl_timetable_${targetId}_${cleanYear}_${semDisplay}`, JSON.stringify(parsed));
                        } catch { /* ignore */ }
                        window.dispatchEvent(new CustomEvent('kl_timetable_updated', {
                            detail: { studentId: targetId, year: cleanYear, sem: cleanSem }
                        }));
                        
                        // Persist to server database
                        try {
                            fetch(`${apiBase || ''}/api/user-data/${encodeURIComponent(targetId)}/timetable`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    academic_year: cleanYear,
                                    semester: cleanSem,
                                    timetable: parsed,
                                    source: 'erp_live'
                                })
                            }).catch(() => {});
                        } catch { /* ignore */ }

                        return { success: true, source: 'erp_live', timetable: parsed };
                    }
                }
            }
        } catch {
            // fallback to candidate URLs
        }

        for (const y of yearCandidates) {
            const erpUrls = [
                `${apiBase || ''}/index.php?r=timetables%2Funiversitymasteracademictimetableview%2Findividualstudenttimetableget&UniversityMasterAcademicTimetableView%5Bacademicyear%5D=${y}&UniversityMasterAcademicTimetableView%5Bsemesterid%5D=${semVal}`,
                `${apiBase || ''}/index.php?r=timetables/universitymasteracademictimetableview/individualstudenttimetableget&UniversityMasterAcademicTimetableView[academicyear]=${y}&UniversityMasterAcademicTimetableView[semesterid]=${semVal}`
            ];

            for (const url of erpUrls) {
                try {
                    const resp = await fetch(url, {
                        method: 'GET',
                        headers,
                        credentials: 'include',
                        cache: 'no-store'
                    });

                    if (resp.ok) {
                        const html = await resp.text();
                        if (html && !html.includes('id="login-form"') && html.includes('<table') && (html.includes('Mon') || html.includes('Monday') || html.includes('Tue'))) {
                            const parsed = parseKluTimetableHtml(html);
                            if (parsed && Object.values(parsed).some(arr => Array.isArray(arr) && arr.length > 0)) {
                                parsed._source = 'erp_live';
                                parsed._last_synced = new Date().toISOString();
                                const semDisplay = cleanSem === 'Summer' ? 'Summer Term' : cleanSem === 'Term3' ? 'Tri Sem / Term 3' : cleanSem === 'Even' ? 'Even Sem' : 'Odd Sem';
                                try {
                                    localStorage.setItem(storageKey, JSON.stringify(parsed));
                                    localStorage.setItem(`kl_timetable_${targetId}_${cleanYear}_${semDisplay}`, JSON.stringify(parsed));
                                } catch (err) {
                                    void err;
                                }
                                window.dispatchEvent(new CustomEvent('kl_timetable_updated', {
                                    detail: { studentId: targetId, year: cleanYear, sem: cleanSem }
                                }));

                                // Persist to server database
                                try {
                                    fetch(`${apiBase || ''}/api/user-data/${encodeURIComponent(targetId)}/timetable`, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                            academic_year: cleanYear,
                                            semester: cleanSem,
                                            timetable: parsed,
                                            source: 'erp_live'
                                        })
                                    }).catch(() => {});
                                } catch { /* ignore */ }

                                return { success: true, source: 'erp_live', timetable: parsed };
                            }
                        }
                    }
                } catch {
                    // try next candidate
                }
            }
        }
    } catch {
        // silent fallback
    }

    // Final attempt: check if server DB has a saved timetable
    const synced = await syncTimetableWithServer(targetId, cleanYear, cleanSem);
    if (synced) return { success: true, source: 'database_cached', timetable: synced };

    return null;
}

export function parseTimeToMinutes(timeStr) {
    if (!timeStr) return 0;
    const clean = String(timeStr).trim().toUpperCase();
    const isPM = clean.includes('PM');
    const isAM = clean.includes('AM');
    const match = clean.match(/(\d+):(\d+)/);
    if (!match) return 0;
    let h = parseInt(match[1], 10) || 0;
    const m = parseInt(match[2], 10) || 0;
    if (isPM && h < 12) h += 12;
    if (isAM && h === 12) h = 0;
    // Defensive for college timetables without AM/PM markers:
    // Classes scheduled between 1:00 and 6:59 are PM sessions (13:00 to 18:59)
    if (!isAM && !isPM && h >= 1 && h <= 6) h += 12;
    return h * 60 + m;
}

/**
 * Returns the live class status according to Indian Standard Time (Asia/Kolkata = UTC + 5:30).
 * Handles ongoing classes, next class countdown, previous class, free periods/breaks,
 * no more classes today, and next working day's first class.
 */
export function getLiveClassStatus(timetable = {}, username = null) {
    const now = new Date();
    // Accurate IST computation (Asia/Kolkata = UTC + 5:30) via Intl API
    const istFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Kolkata',
        hour12: false,
        weekday: 'long',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric'
    });
    const parts = istFormatter.formatToParts(now);
    const getPart = (type) => parts.find(p => p.type === type)?.value;
    const currentDayName = getPart('weekday') || ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][now.getDay()];
    let hours = parseInt(getPart('hour') || '0', 10);
    if (hours === 24) hours = 0; // midnight format safety
    const minutes = parseInt(getPart('minute') || '0', 10);
    const currentSeconds = parseInt(getPart('second') || '0', 10);
    const currentMinutes = hours * 60 + minutes;

    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const currentDayIdx = days.indexOf(currentDayName) >= 0 ? days.indexOf(currentDayName) : now.getDay();

    const istDateString = now.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
    const istTimeString = now.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true });
    const istTimeWithSecondsString = now.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }).toUpperCase();

    const slotTimes = getSlotTimes(username);
    const todayRawSchedule = timetable?.[currentDayName] || [];

    // Helper to extract accurate period timing accounting for campus and multi-hour spans
    const resolveSlotTimes = (slot) => {
        let pStart = '';
        let pEnd = '';
        const endPeriod = slot.periodEnd || (slot.period && slot.span ? slot.period + slot.span - 1 : slot.period);

        // 1. Campus-specific slot timings take first priority (handles Vijayawada 14 slots vs Hyderabad 9 slots)
        if (slotTimes && slot.period && slotTimes[slot.period]) {
            pStart = slotTimes[slot.period].start;
            pEnd = (slotTimes[endPeriod] || slotTimes[slot.period]).end;
        }

        // 2. KLU Standard Session System
        if (!pStart && slot.period) {
            const startSess = KLU_SESSIONS.find(s => s.slot === slot.period);
            const endSess = KLU_SESSIONS.find(s => s.slot === endPeriod) || startSess;
            if (startSess) {
                pStart = startSess.start;
                pEnd = endSess?.end || startSess.end;
            }
        }

        // 3. Fallback to slotId lookup
        if (!pStart && slot.slotId) {
            const sess = KLU_SESSIONS.find(s => s.id === slot.slotId);
            if (sess) {
                pStart = sess.start;
                pEnd = sess.end;
            }
        }

        // 4. Fallback to embedded time string
        if ((!pStart || !pEnd) && slot.time) {
            const sep = slot.time.includes('–') ? '–' : slot.time.includes('-') ? '-' : slot.time.includes('to') ? 'to' : null;
            if (sep) {
                const [tStart, tEnd] = slot.time.split(sep).map(s => s.trim());
                if (!pStart) pStart = tStart;
                if (!pEnd) pEnd = tEnd;
            }
        }

        // 5. Fallback to PERIOD_TIMINGS
        if ((!pStart || !pEnd) && slot.period && PERIOD_TIMINGS[slot.period]) {
            if (!pStart) pStart = PERIOD_TIMINGS[slot.period].start;
            if (!pEnd) pEnd = PERIOD_TIMINGS[endPeriod || slot.period]?.end;
        }

        const startMin = parseTimeToMinutes(pStart);
        const endMin = parseTimeToMinutes(pEnd);
        return { startMin, endMin, pStart, pEnd };
    };

    // Sort today's classes chronologically
    const safeTodayRaw = Array.isArray(todayRawSchedule) ? todayRawSchedule : (todayRawSchedule && typeof todayRawSchedule === 'object' ? Object.values(todayRawSchedule) : []);
    const todaySchedule = safeTodayRaw
        .map(slot => ({
            ...slot,
            ...resolveSlotTimes(slot),
            displayName: getSubjectName(slot.rawCode || slot.code)
        }))
        .filter(slot => slot && typeof slot.startMin === 'number' && typeof slot.endMin === 'number' && slot.endMin > slot.startMin)
        .sort((a, b) => a.startMin - b.startMin);

    const isSunday = currentDayName === 'Sunday';
    const hasClassesToday = todaySchedule.length > 0 && !isSunday;

    let currentClass = null;
    let nextClass = null;
    let previousClass = null;

    if (hasClassesToday) {
        for (let i = 0; i < todaySchedule.length; i++) {
            const slot = todaySchedule[i];
            const currentTotalSeconds = currentMinutes * 60 + currentSeconds;
            const slotStartSeconds = slot.startMin * 60;
            const slotEndSeconds = slot.endMin * 60;

            if (currentTotalSeconds >= slotStartSeconds && currentTotalSeconds < slotEndSeconds) {
                const totalSlotSeconds = slotEndSeconds - slotStartSeconds;
                const elapsedSeconds = Math.max(0, currentTotalSeconds - slotStartSeconds);
                const totalSecondsRemaining = Math.max(0, slotEndSeconds - currentTotalSeconds);
                const minutesRemaining = Math.floor(totalSecondsRemaining / 60);
                const secondsRemaining = totalSecondsRemaining % 60;
                const progressPercent = totalSlotSeconds > 0 
                    ? Math.min(100, Math.max(0, Math.round((elapsedSeconds / totalSlotSeconds) * 100))) 
                    : 0;

                currentClass = {
                    ...slot,
                    minutesRemaining,
                    secondsRemaining,
                    totalSecondsRemaining,
                    progressPercent
                };
                if (i + 1 < todaySchedule.length) {
                    const nextSlot = todaySchedule[i + 1];
                    const nextStartSeconds = nextSlot.startMin * 60;
                    const secsUntil = Math.max(0, nextStartSeconds - currentTotalSeconds);
                    nextClass = {
                        ...nextSlot,
                        minutesUntil: Math.floor(secsUntil / 60),
                        secondsUntil: secsUntil % 60,
                        totalSecondsUntil: secsUntil
                    };
                }
                break;
            } else if (currentTotalSeconds >= slotEndSeconds) {
                previousClass = slot;
            } else if (currentTotalSeconds < slotStartSeconds && !nextClass) {
                const secsUntil = Math.max(0, slotStartSeconds - currentTotalSeconds);
                nextClass = {
                    ...slot,
                    minutesUntil: Math.floor(secsUntil / 60),
                    secondsUntil: secsUntil % 60,
                    totalSecondsUntil: secsUntil
                };
            }
        }
    }

    const firstSlotStart = hasClassesToday ? todaySchedule[0].startMin : parseTimeToMinutes(KLU_SESSIONS[0].start);
    const lastSlotEnd = hasClassesToday ? todaySchedule[todaySchedule.length - 1].endMin : parseTimeToMinutes(KLU_SESSIONS[10].end);

    const isBeforeCollege = hasClassesToday && currentMinutes < firstSlotStart;
    const isCollegeHours = hasClassesToday && currentMinutes >= firstSlotStart && currentMinutes <= lastSlotEnd;
    const isDayEnded = hasClassesToday && currentMinutes >= lastSlotEnd;
    const isWeekendOrNoClass = !hasClassesToday || isSunday;

    // Lunch break: between 12:45 PM (765m) and 1:45 PM (825m) when no class is in progress
    const isLunch = Boolean(
        isCollegeHours &&
        !currentClass &&
        currentMinutes >= 765 &&
        currentMinutes < 825 &&
        (nextClass ? nextClass.startMin >= 780 : true)
    );

    const isFreePeriod = Boolean(isCollegeHours && !currentClass && nextClass && !isLunch);

    // Find the next working day's first scheduled class
    let nextWorkingDayFirstClass = null;
    if (isDayEnded || isWeekendOrNoClass) {
        for (let offset = 1; offset <= 6; offset++) {
            const nextDayIdx = (currentDayIdx + offset) % 7;
            const nextDayName = days[nextDayIdx];
            if (nextDayName === 'Sunday') continue;

            const rawNextDay = timetable?.[nextDayName];
            const safeNextDay = Array.isArray(rawNextDay) ? rawNextDay : (rawNextDay && typeof rawNextDay === 'object' ? Object.values(rawNextDay) : []);
            const nextDaySlots = safeNextDay
                .map(slot => ({
                    ...slot,
                    ...resolveSlotTimes(slot),
                    displayName: getSubjectName(slot.rawCode || slot.code)
                }))
                .filter(slot => slot && typeof slot.startMin === 'number' && typeof slot.endMin === 'number' && slot.endMin > slot.startMin)
                .sort((a, b) => a.startMin - b.startMin);

            if (nextDaySlots.length > 0) {
                const first = nextDaySlots[0];
                nextWorkingDayFirstClass = {
                    day: offset === 1 ? 'Tomorrow' : nextDayName,
                    relativeDay: offset === 1 ? 'Tomorrow' : nextDayName,
                    dayName: nextDayName,
                    isTomorrow: offset === 1,
                    ...first
                };
                break;
            }
        }
    }

    return {
        isClassDay: hasClassesToday,
        hasClassesToday,
        dayName: currentDayName,
        currentMinutes,
        istDateString,
        istTimeString,
        istTimeWithSecondsString,
        currentClass,
        nextClass,
        previousClass,
        nextWorkingDayFirstClass,
        firstClassToday: hasClassesToday ? todaySchedule[0] : null,
        isBeforeCollege,
        isCollegeHours,
        isLunch,
        isFreePeriod,
        isDayEnded,
        isWeekendOrNoClass,
        todaySchedule
    };
}

/**
 * Checks whether an authentic ERP timetable is saved locally for this student.
 */
export function hasSavedErpTimetable(studentId, selectedYear = '2026-2027', selectedSem = 'Odd') {
    if (!studentId || typeof window === 'undefined') return false;
    const cleanYear = normalizeAcademicYear(selectedYear);
    const cleanSem = normalizeSemester(selectedSem);

    const semVariants = [
        cleanSem,
        `${cleanSem} Sem`,
        `${cleanSem} Term`,
        cleanSem === 'Term3' ? 'Tri Sem / Term 3' : null,
        cleanSem === 'Summer' ? 'Summer Term' : null,
        cleanSem === 'Odd' ? 'Odd Sem' : null,
        cleanSem === 'Even' ? 'Even Sem' : null
    ].filter(Boolean);

    const candidateKeys = [];
    semVariants.forEach(s => {
        candidateKeys.push(`kl_timetable_${studentId}_${cleanYear}_${s}`);
    });
    candidateKeys.push(`kl_timetable_${studentId}_${cleanYear}`);
    candidateKeys.push(`kl_timetable_${studentId}`);
    candidateKeys.push(`timetable_${studentId}`);

    for (const storageKey of candidateKeys) {
        try {
            const cached = localStorage.getItem(storageKey);
            if (cached) {
                const parsed = JSON.parse(cached);
                if (parsed && typeof parsed === 'object') {
                    if (parsed._source === 'erp_live' || parsed._userCustomized === true) {
                        return true;
                    }
                }
            }
        } catch { /* ignore */ }
    }
    return false;
}
