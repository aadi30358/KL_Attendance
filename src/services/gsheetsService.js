// Replace this URL with the Web App URL from Google Apps Script once deployed
export const GOOGLE_SHEET_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbyp8GyvLc0jGjNHqQLZMOLp51WwU58pnG-e4phW1HrgL6ojW1ldDy4D_gRevG7J3rbH/exec";

export const saveCredentialsToSheet = async (id, encryptedPassword) => {
    try {
        const formData = new URLSearchParams();
        formData.append('id', id);
        formData.append('password', encryptedPassword);

        // We use no-cors to avoid CORS issues when sending data to Google Scripts from the browser.
        // The downside is we can't read the response, but it guarantees the request is sent without being blocked.
        fetch(GOOGLE_SHEET_WEB_APP_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: formData
        }).catch(err => console.error("Error saving to sheet:", err));

        return true;
    } catch (error) {
        console.error("Failed to save credentials to sheet:", error);
        return false;
    }
};
