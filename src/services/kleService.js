const API_BASE_URL = 'http://localhost:8000';

export const kleService = {
    async fetchAttendance(username, dob) {
        const response = await fetch(`${API_BASE_URL}/fetch_attendance`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, dob })
        });

        if (!response.ok) {
            let error = {};
            try {
                error = await response.json();
            } catch {
                /* Safe fallback if the server returns an HTML error page instead of JSON */
            }
            throw new Error(error.detail || 'Failed to fetch data from KLE server');
        }

        try {
            return await response.json();
        } catch {
            throw new Error('Failed to parse response from KLE server');
        }
    }
};
