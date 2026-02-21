import { useState } from 'react';
import { AttendanceContext } from './useAttendance';

export const AttendanceProvider = ({ children }) => {
    const [attendanceData, setAttendanceData] = useState({
        totalClasses: 0,
        attendedClasses: 0,
        projectedAbsences: 0,
        currentPercentage: 0,
        subject: '',
    });

    const updateAttendanceData = (data) => {
        setAttendanceData((prev) => ({ ...prev, ...data }));
    };

    return (
        <AttendanceContext.Provider value={{ attendanceData, updateAttendanceData }}>
            {children}
        </AttendanceContext.Provider>
    );
};
