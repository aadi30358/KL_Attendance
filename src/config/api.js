import { APP_CONFIG } from '../config';

export const API_CONFIG = {
  CAPTCHA_URL: `${APP_CONFIG.API_URL}/api/captcha`,
  FETCH_URL: `${APP_CONFIG.API_URL}/api/fetch_timetable`
};



// Semester mapping
export const SEMESTER_MAP = {
  'Odd': '1',
  'Even': '2', 
  'Summer': '3',
  'Term3': '4',
};

export const getAcademicYearCode = (academicYear) => {
  const firstYear = parseInt(academicYear.split('-')[0]);
  
  // Historical mapping observed from the ERP
  const historicalMap = {
    '2024': '16',
    '2023': '15',
    '2022': '14',
    '2021': '13',
    '2020': '10',
    '2019': '9',
    '2018': '8'
  };
  
  if (historicalMap[firstYear]) return historicalMap[firstYear];
  
  // Dynamic formula for 2025 and beyond (using step of 3 as per user code)
  // 2024 is 16, so 2025 is 19, 2026 is 22...
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
  return [
    `${currentYear}-${(currentYear + 1).toString().slice(-2)}`,
    `${currentYear - 1}-${currentYear.toString().slice(-2)}`,
    `${currentYear - 2}-${(currentYear - 1).toString().slice(-2)}`
  ];
};
