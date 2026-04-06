export const calculateProjections = (attended, total) => {
    if (total === 0) return { canBunk: 0, mustAttend: 0, status: 'On Track', neededFor85: 0 };

    const currentPercent = (attended / total) * 100;

    // To reach 85%: Math.ceil((0.85 * total - attended) / 0.15)
    let neededFor85 = Math.ceil((0.85 * total - attended) / 0.15);
    if (neededFor85 < 0) neededFor85 = 0;

    if (currentPercent < 75) {
        let neededFor75 = Math.ceil((0.75 * total - attended) / 0.25);
        if (neededFor75 < 0) neededFor75 = 0;

        return {
            canBunk: 0,
            mustAttend: neededFor75,
            neededFor85: neededFor85,
            status: 'Below 75%',
            message: `Attend ${neededFor75} more classes to reach 75%`
        };
    } else if (currentPercent < 85) {
        let bunkable = Math.floor((attended - 0.75 * total) / 0.75);
        if (bunkable < 0) bunkable = 0;

        return {
            canBunk: bunkable,
            mustAttend: 0,
            neededFor85: neededFor85,
            status: 'Lower than 85%',
            message: `Attend ${neededFor85} more classes for 85%`
        };
    } else {
        let bunkable = Math.floor((attended - 0.75 * total) / 0.75);
        if (bunkable < 0) bunkable = 0;

        return {
            canBunk: bunkable,
            mustAttend: 0,
            neededFor85: 0,
            status: 'Safe',
            message: `Safe`
        };
    }
};

export const parseAttendanceString = (str) => {
    // Expected format "28/33" or similar
    if (!str) return { attended: 0, total: 0 };
    const parts = str.split('/');
    if (parts.length === 2) {
        return {
            attended: parseInt(parts[0], 10) || 0,
            total: parseInt(parts[1], 10) || 0
        };
    }
    return { attended: 0, total: 0 };
};
