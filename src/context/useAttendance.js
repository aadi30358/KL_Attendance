import { createContext, useContext } from 'react';

export const AttendanceContext = createContext({});

export const useAttendance = () => {
    const context = useContext(AttendanceContext);
    if (!context) {
        console.warn("useAttendance used outside of AttendanceProvider");
        return { attendanceData: {}, updateAttendanceData: () => { } };
    }
    return context;
};
