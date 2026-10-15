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
  // If it's already an ID number (e.g., '18', '22')
  if (/^\d+$/.test(str) && parseInt(str, 10) < 50) return str;

  let firstYear = parseInt(str.split('-')[0], 10);
  if (isNaN(firstYear)) return null;
  if (firstYear < 100) firstYear += 2000;
  
  const historicalMap = {
    '2026': '29',
    '2025': '28',
    '2024': '27',
    '2023': '26',
    '2022': '25',
    '2021': '24',
    '2020': '23'
  };
  
  if (historicalMap[firstYear]) return historicalMap[firstYear];
  return (29 + (firstYear - 2026)).toString();
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
  const cleanStr = strYear.replace(/\s*\([^)]*\)/g, '').trim().toLowerCase();

  let firstYear = null;
  const yearMatch = strYear.match(/\b(20\d\d)\b/);
  if (yearMatch) {
    firstYear = parseInt(yearMatch[1], 10);
  } else if (/^\d+$/.test(strYear)) {
    const num = parseInt(strYear, 10);
    if (num >= 30) firstYear = 2026 + (num - 29);
    else if (num === 29 || num === 18) firstYear = 2026;
    else if (num === 28 || num === 17) firstYear = 2025;
    else if (num === 27 || num === 16) firstYear = 2024;
    else if (num === 26 || num === 15) firstYear = 2023;
    else if (num === 25 || num === 14) firstYear = 2022;
    else if (num === 24 || num === 13) firstYear = 2021;
    else if (num === 23 || num === 10) firstYear = 2020;
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
  } else if (firstYear === 2026 || strYear === '29' || strYear === '18' || cleanStr.includes('26')) {
    candidates.push('29', '18', '2026-2027', '2026-27', '26-27');
  } else if (firstYear === 2025 || strYear === '28' || strYear === '17' || strYear === '19' || cleanStr.includes('25')) {
    candidates.push('28', '17', '19', '18', '2025-2026', '2025-26', '25-26');
  } else if (firstYear === 2024 || strYear === '27' || strYear === '16' || cleanStr.includes('24')) {
    candidates.push('27', '16', '17', '2024-2025', '2024-25', '24-25');
  } else if (firstYear === 2023 || strYear === '26' || strYear === '15' || cleanStr.includes('23')) {
    candidates.push('26', '15', '16', '2023-2024', '2023-24', '23-24');
  } else if (firstYear === 2022 || strYear === '25' || strYear === '14' || cleanStr.includes('22')) {
    candidates.push('25', '14', '15', '2022-2023', '2022-23', '22-23');
  } else if (firstYear === 2021 || strYear === '24' || strYear === '13' || cleanStr.includes('21')) {
    candidates.push('24', '13', '14', '2021-2022', '2021-22', '21-22');
  } else if (firstYear === 2020 || strYear === '23' || strYear === '10' || cleanStr.includes('20')) {
    candidates.push('23', '10', '13', '2020-2021', '2020-21', '20-21');
  }

  if (strYear && !candidates.includes(strYear)) {
    candidates.push(strYear);
  }

  return Array.from(new Set(candidates.filter(Boolean)));
};

export const isHtmlMatchingRequestedYear = () => true;
export const findAcademicYearFromHtml = () => null;
export const findSemesterFromHtml = () => null;
