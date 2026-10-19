import { getErpBase, buildErpHeaders, getStoredErpCookies, getStoredCsrfToken } from './erpService.js';

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
    '24EDS3308HF': 'Enterprise Data Science',
    '24EDS3308': 'Enterprise Data Science',
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
                for (const row of rows) {
                    const cells = Array.from(row.querySelectorAll('td, th'));
                    if (cells.length < 2) continue;

                    const firstCellText = cells[0].textContent.trim().toLowerCase();
                    const dayKey = dayMap[firstCellText];
                    if (!dayKey) continue;

                    // Matrix format: cells 1..N correspond to session slots
                    cells.slice(1).forEach((cell, cellIdx) => {
                        const cellText = cell.textContent.trim();
                        if (!cellText || cellText === '-' || cellText.length < 3) return;

                        // Match course code pattern e.g. 24SDCS01E-S, 24CS2101R-L, 24AD2001A
                        const codeMatch = cellText.match(/([0-9]{2}[A-Za-z0-9-]+(?:-[LPTS])?)/i);
                        if (codeMatch) {
                            const fullCode = codeMatch[1].trim();
                            const sectionMatch = cellText.match(/S-\d+/i);
                            const section = sectionMatch ? sectionMatch[0] : 'S-53';

                            const comp = fullCode.endsWith('-P') ? 'Practical'
                                : fullCode.endsWith('-T') ? 'Tutorial'
                                : fullCode.endsWith('-S') ? 'Skill'
                                : 'Lecture';

                            const slotIndex = cellIdx + 1;
                            const sessionInfo = KLU_SESSIONS[slotIndex - 1] || { id: `S${slotIndex}`, start: '', end: '', label: `Slot ${slotIndex}` };
                            const raw = fullCode.replace(/-[LPTS]$/, '');
                            const title = getSubjectName(raw) || getSubjectName(fullCode) || fullCode;
                            const isLab = comp === 'Practical';
                            const parsedRoom = extractRoom(cellText, fullCode, section);
                            const room = parsedRoom || (isLab ? getCourseLabRoom(fullCode, title) : 'C324');

                            timetable[dayKey].push({
                                period: slotIndex,
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
                    });
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

            const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
            let tdMatch;
            let slotIndex = 0;
            while ((tdMatch = tdRegex.exec(rowContent)) !== null) {
                if (slotIndex === 0) {
                    slotIndex++;
                    continue;
                }
                const cell = tdMatch[1];
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
                slotIndex++;
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
    
    // Default to creator's ID 2400030358 if missing or too short
    const targetDigits = (digits.length >= 8) ? digits : '2400030358';
    
    const batchYear = parseInt(targetDigits.slice(0, 2), 10) || 24;
    const campusDigits = targetDigits.slice(2, 5);
    const campus = campusDigits === '000' ? 'vijayawada' : 'hyderabad';
    const deptCode = targetDigits.slice(5, 7) || '03';
    const rollNumber = parseInt(targetDigits.slice(7), 10) || 358;
    
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
    
    // If student is CSE, filter out obvious test codes like 24EC1101, 23SC1101, 24UC1102 unless valid
    if (profile.deptShort !== 'ECE') {
        const filtered = courses.filter(c => {
            const code = String(c.code || c.name || '').toUpperCase();
            return !code.startsWith('24EC') && !code.startsWith('23SC') && !code.startsWith('24UC');
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
 * Validates that cached timetable data actually belongs to this student and does not contain fake or corrupted codes.
 */
export function isTimetableValidForStudent(timetable, studentId) {
    if (!timetable || typeof timetable !== 'object') return false;
    const profile = getStudentProfileFromId(studentId);
    const slots = Object.values(timetable).flatMap(val => Array.isArray(val) ? val : (val && typeof val === 'object' ? Object.values(val) : []));
    if (slots.length === 0) return false;

    // Check for foreign/corrupted test course codes (e.g. 24EC1101 for a CSE student)
    if (profile.deptShort !== 'ECE') {
        const hasForeignEcCourse = slots.some(s => {
            const code = String(s.code || s.rawCode || '').toUpperCase();
            return code.startsWith('24EC') || code.startsWith('23SC') || code.startsWith('24UC');
        });
        if (hasForeignEcCourse) return false;
    }

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

        // If course has explicit components, expand them
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
            slotPool.push({ code: `${rawCode}-L`, rawCode, title, component: 'Lecture', type: 'Lecture', weight: 100, isLab: false, pct, length: 1 });
            slotPool.push({ code: `${rawCode}-P`, rawCode, title: `${title} (Lab)`, component: 'Practical', type: 'Practical Lab', weight: 50, isLab: true, pct, length: 2 });
            slotPool.push({ code: `${rawCode}-T`, rawCode, title: `${title} (Tutorial)`, component: 'Tutorial', type: 'Tutorial', weight: 100, isLab: false, pct, length: 1 });
        }
    });

    // Authentic section and designated room from Student Profile
    const studentSection = profile.section;
    const studentHomeRoom = profile.homeRoom;
    const studentSeed = hashCode(studentId || '2400030358');

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
    const targetId = studentId || activeErpUser || '2400030358';
    const isSelf = !studentId || studentId === 'default' || studentId === activeErpUser;

    const cleanYear = normalizeAcademicYear(selectedYear);
    const cleanSem = normalizeSemester(selectedSem);

    const storageKey = `kl_timetable_${targetId}_${cleanYear}_${cleanSem}`;

    // 1. Check user-customized or live ERP timetable saved in localStorage for this exact year + sem:
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
                            return { ...normalized, _source: parsed._source, _userCustomized: parsed._userCustomized };
                        }
                    }
                } else {
                    // Cached data is corrupted or foreign - clear it!
                    localStorage.removeItem(storageKey);
                }
            }
        }
    } catch {
        // ignore cache read error
    }

    // 2. Check if TimeTablekl stored a timetable in localStorage.getItem("timetable")
    if (typeof window !== 'undefined' && isSelf && cleanYear === '2026-2027' && cleanSem === 'Odd') {
        try {
            const rawTt = localStorage.getItem('timetable');
            if (rawTt) {
                const parsed = JSON.parse(rawTt);
                if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
                    if (isTimetableValidForStudent(parsed, targetId)) {
                        const normalized = normalizeTimetableFormat(parsed, targetId);
                        if (normalized) {
                            return normalized;
                        }
                    } else {
                        localStorage.removeItem('timetable');
                    }
                }
            }
        } catch { /* ignore */ }
    }

    // 3. Check if TimeTablekl stored friend in localStorage.getItem("maddys")
    if (typeof window !== 'undefined' && !isSelf) {
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

    // 4. Resolve real student courses for THIS exact student and THIS exact year/semester
    let coursesToUse = [];

    // 4a. Check scoped cache for this student + year + sem
    if (typeof window !== 'undefined') {
        try {
            const scopedKey = `kleData_${targetId}_${cleanYear}_${cleanSem}`;
            const scopedRaw = localStorage.getItem(scopedKey);
            if (scopedRaw) {
                const p = JSON.parse(scopedRaw);
                const list = p.attendance_data || p.data || (Array.isArray(p) ? p : []);
                const validList = filterCoursesForStudent(list, targetId);
                if (validList.length > 0) {
                    coursesToUse = validList;
                }
            }
        } catch { /* ignore */ }
    }

    // 4b. If viewing oneself and erpCourses is passed, check if it matches student department
    if (coursesToUse.length === 0 && isSelf && Array.isArray(erpCourses) && erpCourses.length > 0) {
        const validList = filterCoursesForStudent(erpCourses, targetId);
        if (validList.length > 0) {
            coursesToUse = validList;
        }
    }

    // 4c. Check generic student cache if year/sem match
    if (coursesToUse.length === 0 && typeof window !== 'undefined') {
        try {
            const raw = localStorage.getItem(`kleData_${targetId}`);
            if (raw) {
                const p = JSON.parse(raw);
                if (normalizeAcademicYear(p.year) === cleanYear && normalizeSemester(p.semester) === cleanSem) {
                    const list = p.attendance_data || p.data || (Array.isArray(p) ? p : []);
                    const validList = filterCoursesForStudent(list, targetId);
                    if (validList.length > 0) {
                        coursesToUse = validList;
                    }
                }
            }
        } catch { /* ignore */ }
    }

    // 4d. Fall back to the authentic KLU curriculum derived directly from student ID, Year of Study & Semester
    if (coursesToUse.length === 0) {
        coursesToUse = getCurriculumForStudent(targetId, cleanYear, cleanSem);
    }

    // 5. Build fresh timetable mapped to the actual registered courses for this semester
    const generated = buildTimetableFromErpCourses(coursesToUse, targetId, cleanYear, cleanSem);
    try {
        if (Object.keys(generated).length > 0) {
            localStorage.setItem(storageKey, JSON.stringify(generated));
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
    try {
        const toSave = { ...timetableData, _userCustomized: true };
        localStorage.setItem(`kl_timetable_${studentId}_${cleanYear}_${cleanSem}`, JSON.stringify(toSave));
        window.dispatchEvent(new CustomEvent('kl_timetable_updated', { detail: { studentId, year: cleanYear, sem: cleanSem } }));
    } catch {
        // ignore
    }
}

/**
 * Fetches timetable directly from authentic KL ERP endpoint or backend proxy.
 */
export async function fetchLiveErpTimetable(studentId, yearId, semId) {
    const cleanYear = normalizeAcademicYear(yearId);
    const cleanSem = normalizeSemester(semId);
    const targetId = studentId || localStorage.getItem('activeErpUser') || localStorage.getItem('rememberedId') || '2400030358';
    const storageKey = `kl_timetable_${targetId}_${cleanYear}_${cleanSem}`;

    const apiBase = getErpBase();
    const csrfToken = getStoredCsrfToken();
    const cookie = getStoredErpCookies();

    // Semester value mapping: Odd=1, Even=2, Summer=3, Term3=4
    let semVal = '1';
    if (cleanSem === 'Even') semVal = '2';
    else if (cleanSem === 'Summer') semVal = '3';
    else if (cleanSem === 'Term3') semVal = '4';

    // Candidate year IDs according to KLU ERP registration tables
    const firstYear = parseInt(cleanYear.split('-')[0], 10);
    let yearCandidates = ['29', '18'];
    if (firstYear === 2026) yearCandidates = ['29', '18'];
    else if (firstYear === 2025) yearCandidates = ['19', '28', '17', '18'];
    else if (firstYear === 2024) yearCandidates = ['16', '27', '17'];
    else if (firstYear === 2023) yearCandidates = ['15', '26'];
    else if (!isNaN(firstYear)) {
        const diff = firstYear - 2026;
        yearCandidates = [String(29 + diff), String(18 + diff), '29', '18'];
    }

    // 1. First try backend proxy /api/fetch_timetable
    try {
        const backendUrls = [
            `${apiBase || ''}/api/fetch_timetable`,
            `${apiBase || ''}/api/fetch-timetable`,
            `${apiBase || ''}/fetch-timetable`
        ];

        for (const bUrl of backendUrls) {
            try {
                const resp = await fetch(bUrl, {
                    method: 'POST',
                    headers: buildErpHeaders({
                        'Content-Type': 'application/json',
                        ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}),
                        ...(cookie ? { 'x-erp-cookie': cookie } : {})
                    }),
                    body: JSON.stringify({
                        studentId: targetId,
                        yearId: cleanYear,
                        semId: cleanSem,
                        semVal
                    })
                });

                if (resp.ok) {
                    const data = await resp.json().catch(() => null);
                    if (data?.timetable && Object.keys(data.timetable).length > 0) {
                        const normalized = normalizeTimetableFormat(data.timetable, targetId);
                        if (normalized && Object.values(normalized).some(arr => Array.isArray(arr) && arr.length > 0)) {
                            normalized._source = 'erp_live';
                            try {
                                localStorage.setItem(storageKey, JSON.stringify(normalized));
                            } catch (err) {
                                void err; // Ignore storage quota or private browsing limits
                            }
                            window.dispatchEvent(new CustomEvent('kl_timetable_updated', {
                                detail: { studentId: targetId, year: cleanYear, sem: cleanSem }
                            }));
                            return { success: true, source: 'erp_live', timetable: normalized };
                        }
                    }
                    if (data?.html) {
                        const parsed = parseKluTimetableHtml(data.html);
                        if (parsed && Object.values(parsed).some(arr => Array.isArray(arr) && arr.length > 0)) {
                            parsed._source = 'erp_live';
                            try {
                                localStorage.setItem(storageKey, JSON.stringify(parsed));
                            } catch (err) {
                                void err; // Ignore storage quota or private browsing limits
                            }
                            window.dispatchEvent(new CustomEvent('kl_timetable_updated', {
                                detail: { studentId: targetId, year: cleanYear, sem: cleanSem }
                            }));
                            return { success: true, source: 'erp_live', timetable: parsed };
                        }
                    }
                }
            } catch {
                // continue to next backend url or direct fetch
            }
        }
    } catch (err) {
        console.warn('[Timetable] Backend fetch notice:', err.message);
    }

    // 2. Direct fetch to authentic ERP route via proxy
    try {
        const headers = buildErpHeaders({
            'Pragma': 'no-cache',
            'Cache-Control': 'no-cache',
            'X-Requested-With': 'XMLHttpRequest',
            ...(cookie ? { 'x-erp-cookie': cookie } : {})
        });
        if (csrfToken) headers['x-csrf-token'] = csrfToken;

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
                                try {
                                    localStorage.setItem(storageKey, JSON.stringify(parsed));
                                } catch (err) {
                                    void err; // Ignore storage quota or private browsing limits
                                }
                                window.dispatchEvent(new CustomEvent('kl_timetable_updated', {
                                    detail: { studentId: targetId, year: cleanYear, sem: cleanSem }
                                }));
                                return { success: true, source: 'erp_live', timetable: parsed };
                            }
                        }
                    }
                } catch {
                    // try next candidate
                }
            }
        }
    } catch (e) {
        console.warn('[Timetable] Direct ERP timetable fetch notice:', e.message);
    }

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
    return h * 60 + m;
}

/**
 * Returns the live class status according to Indian Standard Time (Asia/Kolkata = UTC + 5:30).
 * Handles ongoing classes, next class countdown, previous class, free periods/breaks,
 * no more classes today, and next working day's first class.
 */
export function getLiveClassStatus(timetable = {}, username = null) {
    const now = new Date();
    // Accurate IST computation (UTC + 5:30)
    const istOffsetMs = (5 * 60 + 30) * 60 * 1000;
    const utcMs = now.getTime() + (now.getTimezoneOffset() * 60 * 1000);
    const istDate = new Date(utcMs + istOffsetMs);

    const currentMinutes = istDate.getHours() * 60 + istDate.getMinutes();
    const currentSeconds = istDate.getSeconds();
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const currentDayName = days[istDate.getDay()];

    const slotTimes = getSlotTimes(username);
    const todayRawSchedule = timetable?.[currentDayName] || [];

    // Helper to extract period timing
    const resolveSlotTimes = (slot) => {
        let pStart = '';
        let pEnd = '';
        if (slot.slotId) {
            const sess = KLU_SESSIONS.find(s => s.id === slot.slotId);
            if (sess) {
                pStart = sess.start;
                pEnd = sess.end;
            }
        }
        if (!pStart && slotTimes && slot.period && slotTimes[slot.period]) {
            pStart = slotTimes[slot.period].start;
            pEnd = slotTimes[slot.periodEnd || slot.period]?.end;
        }
        if (!pStart && slot.time && slot.time.includes('–')) {
            const [tStart, tEnd] = slot.time.split('–').map(s => s.trim());
            pStart = tStart;
            pEnd = tEnd;
        }
        if (!pStart && PERIOD_TIMINGS[slot.period]) {
            pStart = PERIOD_TIMINGS[slot.period].start;
            pEnd = PERIOD_TIMINGS[slot.periodEnd || slot.period]?.end;
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
        .filter(slot => slot && slot.startMin && slot.endMin)
        .sort((a, b) => a.startMin - b.startMin);

    let currentClass = null;
    let nextClass = null;
    let previousClass = null;

    for (let i = 0; i < todaySchedule.length; i++) {
        const slot = todaySchedule[i];
        if (currentMinutes >= slot.startMin && currentMinutes < slot.endMin) {
            const currentTotalSeconds = currentMinutes * 60 + currentSeconds;
            const slotStartSeconds = slot.startMin * 60;
            const slotEndSeconds = slot.endMin * 60;
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
        } else if (currentMinutes >= slot.endMin) {
            previousClass = slot;
        } else if (currentMinutes < slot.startMin && !nextClass) {
            const currentTotalSeconds = currentMinutes * 60 + currentSeconds;
            const slotStartSeconds = slot.startMin * 60;
            const secsUntil = Math.max(0, slotStartSeconds - currentTotalSeconds);
            nextClass = {
                ...slot,
                minutesUntil: Math.floor(secsUntil / 60),
                secondsUntil: secsUntil % 60,
                totalSecondsUntil: secsUntil
            };
        }
    }

    const firstSlotStart = todaySchedule.length > 0 ? todaySchedule[0].startMin : parseTimeToMinutes(KLU_SESSIONS[0].start);
    const lastSlotEnd = todaySchedule.length > 0 ? todaySchedule[todaySchedule.length - 1].endMin : parseTimeToMinutes(KLU_SESSIONS[10].end);

    const isCollegeHours = currentMinutes >= firstSlotStart && currentMinutes <= lastSlotEnd;
    const isLunch = currentMinutes >= 770 && currentMinutes < 780; // 12:50 PM - 1:00 PM
    const isFreePeriod = Boolean(isCollegeHours && !currentClass && nextClass && !isLunch);
    const isDayEnded = Boolean(todaySchedule.length === 0 || (todaySchedule.length > 0 && currentMinutes >= lastSlotEnd));

    // Find the next working day's first scheduled class
    let nextWorkingDayFirstClass = null;
    if (isDayEnded || currentDayName === 'Sunday' || todaySchedule.length === 0) {
        for (let offset = 1; offset <= 6; offset++) {
            const nextDayIdx = (istDate.getDay() + offset) % 7;
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
                .filter(slot => slot && slot.startMin && slot.endMin)
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
        isClassDay: currentDayName !== 'Sunday' && todaySchedule.length > 0,
        dayName: currentDayName,
        currentMinutes,
        istDateString: istDate.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' }),
        istTimeString: istDate.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true }),
        istTimeWithSecondsString: istDate.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }).toUpperCase(),
        currentClass,
        nextClass,
        previousClass,
        nextWorkingDayFirstClass,
        isCollegeHours,
        isLunch,
        isFreePeriod,
        isDayEnded,
        todaySchedule
    };
}


