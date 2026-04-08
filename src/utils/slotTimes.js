/**
 * Slot mapping for university timetable sessions.
 * Returns a mapping of slot IDs to their default start/end times.
 * These are used as fallbacks if the ERP data doesn't provide specific times.
 */
export const getSlotTimes = () => {
    return {
      1: { start: '07:10', end: '08:00' },
      2: { start: '08:00', end: '08:50' },
      3: { start: '09:20', end: '10:10' },
      4: { start: '10:10', end: '11:00' },
      5: { start: '11:10', end: '12:00' },
      6: { start: '12:00', end: '12:50' },
      7: { start: '13:50', end: '14:40' },
      8: { start: '14:40', end: '15:30' },
      9: { start: '15:30', end: '16:20' },
      10: { start: '16:20', end: '17:10' },
      11: { start: '17:10', end: '18:00' },
      12: { start: '18:20', end: '19:10' },
      13: { start: '19:10', end: '20:00' },
      14: { start: '20:00', end: '20:50' },
      15: { start: '20:50', end: '21:40' }
    };
  };
  
  export const getMaxSlots = () => 15;

  /**
   * Checks if current time is within a slot's time range
   */
  export const isCurrentSlot = (startTime, endTime) => {
    if (!startTime || !endTime) return false;
    const now = new Date();
    const currentH = now.getHours();
    const currentM = now.getMinutes();
    const currentTime = currentH * 60 + currentM;

    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    const startTotal = startH * 60 + startM;
    const endTotal = endH * 60 + endM;

    return currentTime >= startTotal && currentTime <= endTotal;
  };

  /**
   * Formats raw timetable strings like "NAME - SECTION - RoomNo-XXX" 
   * into structured data.
   */
  export const parseClassInfo = (info) => {
    if (!info || info === '-') return null;
    
    // 1. Strip time patterns like "07:10-08:00" or similar
    const cleanInfo = info.replace(/^\d{2}:\d{2}-\d{2}:\d{2}\s+/, '').trim();
    
    // 2. Handle both " - " and " " separators common in ERP
    const parts = cleanInfo.includes(' - ') 
        ? cleanInfo.split(' - ') 
        : cleanInfo.split(' ').filter(p => p.length > 0);

    return {
      subject: (parts[0] || '').trim(),
      section: (parts[1] || '').trim(),
      room: (parts[2] || '').replace('RoomNo-', '').trim(),
      raw: info
    };
  };

