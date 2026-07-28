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
  let firstYear = parseInt(academicYear.split('-')[0], 10);
  if (isNaN(firstYear)) return null;
  if (firstYear < 100) {
    firstYear += 2000;
  }
  
  // Historical mapping observed from the ERP
  const historicalMap = {
    '2026': '22',
    '2025': '19',
    '2024': '16',
    '2023': '15',
    '2022': '14',
    '2021': '13',
    '2020': '10',
    '2019': '9',
    '2018': '8'
  };
  
  if (historicalMap[firstYear]) return historicalMap[firstYear];
  
  // Dynamic formula for 2027 and beyond
  return (16 + (firstYear - 2024) * 3).toString();
};

export const getCandidateYearIdsForYear = (academicYear, liveYearId, htmlYearId) => {
  if (!academicYear) return [];
  let firstYear = parseInt(academicYear.split('-')[0], 10);
  if (isNaN(firstYear)) return [];
  if (firstYear < 100) firstYear += 2000;

  const strictYearMap = {
    '2026': ['2026-2027', '26-27', '22'],
    '2025': ['2025-2026', '25-26', '19', '17'],
    '2024': ['2024-2025', '24-25', '16', '18'],
    '2023': ['2023-2024', '23-24', '15'],
    '2022': ['2022-2023', '22-23', '14'],
    '2021': ['2021-2022', '21-22', '13'],
    '2020': ['2020-2021', '20-21', '10']
  };

  const rawYear = academicYear.trim();
  const shortYear = `${firstYear.toString().slice(-2)}-${(firstYear + 1).toString().slice(-2)}`;
  const knownCandidates = strictYearMap[firstYear] || [rawYear, shortYear];

  return Array.from(new Set([
    liveYearId,
    htmlYearId,
    ...knownCandidates
  ])).filter(Boolean);
};

export const isHtmlMatchingRequestedYear = (html, requestedYear) => {
  if (!html || !requestedYear) return true;
  try {
    let reqFirst = requestedYear.split('-')[0].trim();
    let reqFirstNum = parseInt(reqFirst, 10);
    if (isNaN(reqFirstNum)) return true;
    let reqFull = reqFirstNum < 100 ? (2000 + reqFirstNum).toString() : reqFirst;

    const foundYears = html.match(/\b(20\d{2})-(20\d{2}|\d{2})\b/g);
    if (foundYears && foundYears.length > 0) {
      const hasMatch = foundYears.some(y => y.startsWith(reqFull) || y.startsWith(reqFull.slice(-2)));
      const hasMismatch = foundYears.some(y => !y.startsWith(reqFull) && !y.startsWith(reqFull.slice(-2)));
      if (!hasMatch && hasMismatch) {
        console.warn(`[ERP] HTML contained year ${foundYears[0]} which does not match requested year ${requestedYear}`);
        return false;
      }
    }
  } catch (e) {
    console.warn("Error validating HTML matching year", e);
  }
  return true;
};

export const findAcademicYearFromHtml = (html, year) => {
  if (!html || !year) return null;
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const selects = doc.querySelectorAll('select');
    let firstYearStr = year.split('-')[0].trim();
    if (parseInt(firstYearStr, 10) < 100) {
      firstYearStr = (2000 + parseInt(firstYearStr, 10)).toString();
    }
    
    for (const select of selects) {
      const nameOrId = (select.getAttribute('name') || select.getAttribute('id') || '').toLowerCase();
      if (nameOrId.includes('year') || nameOrId.includes('academic') || nameOrId.includes('dynamicmodel')) {
        const options = select.querySelectorAll('option');
        for (const opt of options) {
          const text = opt.textContent.trim();
          const val = opt.getAttribute('value');
          if (val && text.includes(firstYearStr)) {
            return val;
          }
        }
      }
    }
  } catch (e) {
    console.warn("Failed to parse academic year from HTML", e);
  }
  return null;
};

export const findSemesterFromHtml = (html, semester) => {
  if (!html || !semester) return null;
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const selects = doc.querySelectorAll('select');
    const semLower = semester.toLowerCase();

    for (const select of selects) {
      const nameOrId = (select.getAttribute('name') || select.getAttribute('id') || '').toLowerCase();
      if (nameOrId.includes('sem') || nameOrId.includes('dynamicmodel')) {
        const options = select.querySelectorAll('option');
        for (const opt of options) {
          const text = opt.textContent.trim().toLowerCase();
          const val = opt.getAttribute('value');
          if (val && (text.includes(semLower) || (semLower.includes('odd') && text.includes('odd')) || (semLower.includes('even') && text.includes('even')))) {
            return val;
          }
        }
      }
    }
  } catch (e) {
    console.warn("Failed to parse semester from HTML", e);
  }
  return null;
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
