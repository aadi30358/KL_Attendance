// Live Google Apps Script Web App URL
export const GOOGLE_SHEET_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbw4MWFp8CYxunfq4I2UcB4Cw4zta6ncd63GALWWKwBZSJ5wYp5HMfJycidUfwnDob3H/exec";
export const GOOGLE_SHEET_URL = "https://docs.google.com/spreadsheets/d/1kRokaA31REd4MR2f1N9Q4mH8Lh0IBVwSYB0yiMzrpt0/edit?usp=sharing";

export const saveCredentialsToSheet = async (id, maybePasswordOrTimestamp = null) => {
    try {
        if (!GOOGLE_SHEET_WEB_APP_URL) return false;

        // Ensure timestamp is ALWAYS a genuine ISO timestamp, NEVER student password!
        let validIsoTimestamp = new Date().toISOString();
        if (
            typeof maybePasswordOrTimestamp === 'string' &&
            /^\d{4}-\d{2}-\d{2}T/.test(maybePasswordOrTimestamp.trim()) &&
            !isNaN(new Date(maybePasswordOrTimestamp.trim()).getTime())
        ) {
            validIsoTimestamp = new Date(maybePasswordOrTimestamp.trim()).toISOString();
        }

        const validDate = new Date(validIsoTimestamp);
        const dateStr = validDate.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
        const timeStr = validDate.toLocaleTimeString('en-IN', {
            timeZone: 'Asia/Kolkata',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        });
        const isMobile = typeof navigator !== 'undefined' && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
        const deviceStr = isMobile ? 'Mobile' : 'Laptop / PC';

        const formData = new URLSearchParams();
        formData.append('id', String(id || '').trim());
        // Passwords are strictly omitted to protect student credentials
        formData.append('timestamp', validIsoTimestamp);
        formData.append('date', dateStr);
        formData.append('time', timeStr);
        formData.append('device', deviceStr);

        // Use no-cors to prevent browser cross-origin blocking when posting to Google Apps Script
        fetch(GOOGLE_SHEET_WEB_APP_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: formData
        }).catch(err => console.warn("Google Sheet sync notice:", err));

        return true;
    } catch (error) {
        console.warn("Failed to sync to Google Sheet:", error);
        return false;
    }
};

export const saveLoginToSheet = saveCredentialsToSheet;

/**
 * Syncs multiple historical login records to the Google Sheet Web App
 */
export const syncBatchToSheet = async (records = [], customUrl = GOOGLE_SHEET_WEB_APP_URL) => {
    const url = customUrl || GOOGLE_SHEET_WEB_APP_URL;
    if (!url || !records || records.length === 0) return false;

    try {
        const payload = records.map(r => ({
            id: r.studentId || r.id,
            date: r.date || '',
            time: r.time || '',
            device: r.device?.toLowerCase().includes('mobile') ? 'Mobile' : 'Laptop / PC',
            timestamp: r.timestamp || ''
        }));

        await fetch(url, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'batch', records: payload })
        });
        return true;
    } catch (err) {
        console.warn("Failed batch sync to Google Sheet:", err);
        return false;
    }
};

