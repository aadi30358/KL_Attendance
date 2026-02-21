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
            const error = await response.json();
            throw new Error(error.detail || 'Failed to fetch data');
        }

        return await response.json();
    }
};
