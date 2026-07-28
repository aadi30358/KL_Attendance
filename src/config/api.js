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
  
  // Dynamic formula for 2027 and beyond (step of 1 per academic year)
  return (16 + (firstYear - 2024)).toString();
};

export const getCandidateYearIdsForYear = (academicYear, liveYearId, htmlYearId) => {
  if (!academicYear) return [];
  let firstYear = parseInt(academicYear.split('-')[0], 10);
  if (isNaN(firstYear)) return [];
  if (firstYear < 100) firstYear += 2000;

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

  const step1Id = historicalMap[firstYear] || (16 + (firstYear - 2024)).toString();
  const step3Id = (16 + (firstYear - 2024) * 3).toString();

  const rawYear = academicYear.trim();
  const shortYear = `${firstYear.toString().slice(-2)}-${(firstYear + 1).toString().slice(-2)}`;

  return Array.from(new Set([
    liveYearId,
    htmlYearId,
    rawYear,
    shortYear,
    step1Id,
    step3Id
  ])).filter(Boolean);
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
