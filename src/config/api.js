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
};

export const getAcademicYearCode = (academicYear) => {
  if (!academicYear) return null;
  const str = String(academicYear).trim();
  // If it's already an ID number (e.g., '18', '22')
  if (/^\d+$/.test(str) && parseInt(str, 10) < 50) return str;

  let firstYear = parseInt(str.split('-')[0], 10);
  if (isNaN(firstYear)) return null;
  if (firstYear < 100) firstYear += 2000;
  
  // Historical mapping observed from the ERP (step of 1 in the MySQL auto-increment ID):
  // 2026: 18
  // 2025: 17
  // 2024: 16
  // 2023: 15
  // 2022: 14
  // 2021: 13
  // 2020: 10
  // 2019: 9
  // 2018: 8
  const historicalMap = {
    '2026': '18',
    '2025': '17',
    '2024': '16',
    '2023': '15',
    '2022': '14',
    '2021': '13',
    '2020': '10',
    '2019': '9',
    '2018': '8'
  };
  
  if (historicalMap[firstYear]) return historicalMap[firstYear];
  
  return (18 + (firstYear - 2026)).toString();
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
  return [
    `${currentYear}-${(currentYear + 1).toString().slice(-2)}`,
    `${currentYear - 1}-${currentYear.toString().slice(-2)}`,
    `${currentYear - 2}-${(currentYear - 1).toString().slice(-2)}`
  ];
};

export const getCandidateYearIdsForYear = (academicYear, detectedYearId, extraId) => {
  const candidates = [];
  if (detectedYearId) candidates.push(String(detectedYearId).trim());
  if (extraId) candidates.push(String(extraId).trim());
  
  const code = getAcademicYearCode(academicYear);
  if (code) candidates.push(String(code).trim());

  let firstYear = parseInt(String(academicYear || '').split('-')[0], 10);
  if (!isNaN(firstYear) && firstYear < 100) firstYear += 2000;

  // Real KL ERP database IDs (2026-2027 is 29, 2025-2026 is 28, 2024-2025 is 27, etc.)
  const strYear = String(academicYear || '').trim();
  if (firstYear === 2026 || strYear === '18' || strYear === '29' || strYear.includes('26')) {
    candidates.push('29', '28', '22', '18', '19', '17', '20', '21');
  } else if (firstYear === 2025 || strYear === '17' || strYear === '28' || strYear.includes('25')) {
    candidates.push('28', '17', '19', '18', '16');
  } else if (firstYear === 2024 || strYear === '16' || strYear === '27' || strYear.includes('24')) {
    candidates.push('27', '16', '15', '17');
  } else if (firstYear === 2023 || strYear === '15' || strYear === '26' || strYear.includes('23')) {
    candidates.push('26', '15', '14', '16');
  } else {
    if (code) candidates.push(code);
  }

  return Array.from(new Set(candidates.filter(Boolean)));
};

export const isHtmlMatchingRequestedYear = () => true;
export const findAcademicYearFromHtml = () => null;
export const findSemesterFromHtml = () => null;
