import { APP_CONFIG } from '../config';

export const API_CONFIG = {
  CAPTCHA_URL: `${APP_CONFIG.API_URL}/api/captcha`
};

// Semester mapping
export const SEMESTER_MAP = {
  'Odd': '1',
  'Even': '2', 
  'Summer': '3',
  'Term3': '4',
  'Tri Sem': '4',
  'Trimester': '4',
  'Term 3': '4',
  'Term-3': '4',
  'Tri Sem / Term 3': '4',
  '1': '1',
  '2': '2',
  '3': '3',
  '4': '4',
  'odd': '1',
  'even': '2',
  'summer': '3',
  'term3': '4',
  'tri': '4',
  'tri sem': '4',
  'trimester': '4',
  'Odd Sem': '1',
  'Even Sem': '2',
  'Odd Sem (Sem 1)': '1',
  'Even Sem (Sem 2)': '2',
  'Summer Term': '3'
};

export const getAcademicYearCode = (academicYear) => {
  if (!academicYear) return null;
  const str = String(academicYear).trim();
  // If it's already an ID number (e.g., '19', '18', '29', '16')
  if (/^\d+$/.test(str) && parseInt(str, 10) < 50) return str;

  let firstYear = parseInt(str.split('-')[0], 10);
  if (isNaN(firstYear)) return null;
  if (firstYear < 100) firstYear += 2000;
  
  if (firstYear === 2026) return '29';
  if (firstYear === 2025) return '19';
  if (firstYear === 2024) return '16';
  if (firstYear === 2023) return '13';
  if (firstYear === 2022) return '10';

  return (16 + (firstYear - 2024) * 3).toString();
};

export const getFormData = (username, password, captcha, semester, academicYear, sessionId) => {
  const formData = new FormData();
  formData.append('username', username);
  formData.append('password', password);
  formData.append('captcha', captcha);
  formData.append('semester', semester);
  formData.append('academicYear', academicYear);
  formData.append('sessionId', sessionId);
  return formData;
};

export const getCurrentAcademicYearOptions = () => {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();
  const startYear = (currentMonth >= 5) ? currentYear : currentYear - 1;
  const topYear = Math.max(startYear + 1, 2026);
  const options = [];
  for (let y = topYear; y >= 2021; y--) {
    options.push(`${y}-${y + 1}`);
  }
  return options;
};

export const getCandidateYearIdsForYear = (academicYear, detectedYearId, extraId) => {
  const candidates = [];
  if (detectedYearId) candidates.push(String(detectedYearId).trim());
  if (extraId) candidates.push(String(extraId).trim());

  const strYear = String(academicYear || '').trim();

  let firstYear = null;
  const startMatch = strYear.match(/^(20\d\d)\b/) || strYear.match(/\b(20\d\d)-(?:20)?\d\d\b/);
  if (startMatch) {
    firstYear = parseInt(startMatch[1], 10);
  } else {
    const anyMatch = strYear.match(/\b(20\d\d)\b/);
    if (anyMatch) {
      firstYear = parseInt(anyMatch[1], 10);
    } else if (/^\d+$/.test(strYear)) {
      const num = parseInt(strYear, 10);
      if (num >= 30) firstYear = 2026 + (num - 29);
      else if (num === 29 || num === 18) firstYear = 2026;
      else if (num === 28 || num === 17 || num === 19) firstYear = 2025;
      else if (num === 27 || num === 16) firstYear = 2024;
      else if (num === 26 || num === 15) firstYear = 2023;
      else if (num === 25 || num === 14) firstYear = 2022;
      else if (num === 24 || num === 13) firstYear = 2021;
      else if (num === 23 || num === 10) firstYear = 2020;
    }
  }

  // Include all valid historical & modern ERP database representations for the year
  if (firstYear && firstYear > 2026) {
    const offset = firstYear - 2026;
    const nextYr = firstYear + 1;
    const shortYr = String(nextYr).slice(-2);
    candidates.push(
      String(29 + offset),
      String(18 + offset),
      `${firstYear}-${nextYr}`,
      `${firstYear}-${shortYr}`,
      `${String(firstYear).slice(-2)}-${shortYr}`
    );
  } else if (firstYear === 2026 || strYear === '29' || strYear === '18') {
    candidates.push('29', '18', '22', '2026-2027', '2026-27', '26-27');
  } else if (firstYear === 2025 || strYear === '19' || strYear === '28' || strYear === '17') {
    candidates.push('19', '28', '17', '2025-2026', '2025-26', '25-26');
  } else if (firstYear === 2024 || strYear === '16' || strYear === '27') {
    candidates.push('16', '27', '15', '2024-2025', '2024-25', '24-25');
  } else if (firstYear === 2023 || strYear === '13' || strYear === '15' || strYear === '26') {
    candidates.push('13', '15', '26', '2023-2024', '2023-24', '23-24');
  } else if (firstYear === 2022 || strYear === '10' || strYear === '14' || strYear === '25') {
    candidates.push('10', '14', '25', '2022-2023', '2022-23', '22-23');
  } else if (firstYear === 2021 || strYear === '13' || strYear === '24') {
    candidates.push('13', '24', '2021-2022', '2021-22', '21-22');
  } else if (firstYear === 2020 || strYear === '10' || strYear === '23') {
    candidates.push('10', '23', '2020-2021', '2020-21', '20-21');
  }

  if (strYear && !candidates.includes(strYear)) {
    candidates.push(strYear);
  }

  return Array.from(new Set(candidates.filter(Boolean)));
};

/**
 * Validates whether an ERP attendance HTML response matches the requested academic year and semester.
 * Prevents default-session leakage (e.g. ERP serving 2026-2027 present courses for past queries).
 */
export const isHtmlMatchingRequestedYear = (html, requestedYear, requestedSem = null) => {
  if (!html || typeof html !== 'string') return false;
  if (!requestedYear) return true;

  const cleanReq = String(requestedYear).trim();
  const reqStartYear = cleanReq.split('-')[0].trim();
  if (!reqStartYear || reqStartYear.length < 4) return true;

  // Check if HTML contains explicit academic year column text in table cells
  const rowYearMatches = Array.from(html.matchAll(/<td[^>]*>\s*(20\d\d[-/]\d{2,4})\s*<\/td>/gi)).map(m => m[1]);
  if (rowYearMatches.length > 0) {
    const matchingCount = rowYearMatches.filter(yr => yr.includes(reqStartYear)).length;
    // If table rows exist and none match the requested year, reject
    if (matchingCount === 0) {
      return false;
    }
  }

  return true;
};

export const findAcademicYearFromHtml = (html) => {
  if (!html || typeof html !== 'string') return null;
  const match = html.match(/<td[^>]*>\s*(20\d\d[-/]\d{2,4})\s*<\/td>/i);
  return match ? match[1].trim() : null;
};

export const findSemesterFromHtml = (html) => {
  if (!html || typeof html !== 'string') return null;
  const match = html.match(/<td[^>]*>\s*(Odd\s*Sem|Even\s*Sem|Summer\s*Term|Term\s*3)\s*<\/td>/i);
  return match ? match[1].trim() : null;
};
