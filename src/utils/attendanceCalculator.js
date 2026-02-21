export const calculateProjections = (attended, total) => {
    if (total === 0) return { canBunk: 0, mustAttend: 0, status: 'On Track' };

    const currentPercent = (attended / total) * 100;
    const target = 75;

    // Case 1: Already below target - How many to attend to reach 75%?
    // Formula: (attended + x) / (total + x) = 0.75
    // attended + x = 0.75 * total + 0.75 * x
    // 0.25 * x = 0.75 * total - attended
    // x = (0.75 * total - attended) / 0.25
    // x = 3 * total - 4 * attended
    if (currentPercent < target) {
        let needed = Math.ceil((0.75 * total - attended) / 0.25);
        if (needed < 0) needed = 0; // Should not happen if percent < 75
        return {
            canBunk: 0,
            mustAttend: needed,
            status: 'Shortage',
            message: `Need to attend ${needed} more classes`
        };
    }

    // Case 2: Above target - How many can bunk and stay above 75%?
    // Formula: attended / (total + x) = 0.75
    // attended = 0.75 * total + 0.75 * x
    // 0.75 * x = attended - 0.75 * total
    // x = (attended - 0.75 * total) / 0.75
    // x = (4/3) * attended - total
    else {
        let bunkable = Math.floor((attended - 0.75 * total) / 0.75);
        if (bunkable < 0) bunkable = 0;
        return {
            canBunk: bunkable,
            mustAttend: 0,
            status: 'Eligible',
            message: `Safe to bunk ${bunkable} classes`
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
