/**
 * Attendance Alerts & Real-Time Period Monitoring Engine
 * Provides:
 * 1. KL Timetable Tracker & Period Completion Detection (aggressive 5s polling near period completion)
 * 2. Zero-latency synthesized Web Audio API chime
 * 3. Attendance diffing and visual notification state
 */

// KL University Standard Period Timings (IST)
export const KLU_PERIODS = [
    { period: 1, start: '09:00', end: '09:50' },
    { period: 2, start: '09:50', end: '10:40' },
    { period: 3, start: '10:50', end: '11:40' },
    { period: 4, start: '11:40', end: '12:30' },
    { period: 'Lunch', start: '12:30', end: '13:20' },
    { period: 5, start: '13:20', end: '14:10' },
    { period: 6, start: '14:10', end: '15:00' },
    { period: 7, start: '15:10', end: '16:00' },
    { period: 8, start: '16:00', end: '16:50' },
    { period: 9, start: '17:00', end: '17:50' },
    { period: 10, start: '17:50', end: '18:40' }
];

function parseTimeToMinutes(timeStr) {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
}

/**
 * Checks if current time is in the attendance submission window
 * (5 minutes before period end to 15 minutes after period end, when faculty submit attendance).
 */
export function isNearPeriodEnd() {
    const now = new Date();
    // Convert to Indian Standard Time (UTC + 5:30)
    const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
    const istMinutes = (utcMinutes + 330) % 1440; // 5 hours 30 mins

    for (const p of KLU_PERIODS) {
        if (typeof p.period !== 'number') continue;
        const endMinutes = parseTimeToMinutes(p.end);
        // Window: 5 minutes before end -> 15 minutes after end
        if (istMinutes >= endMinutes - 5 && istMinutes <= endMinutes + 15) {
            return {
                isWindow: true,
                period: p.period,
                endTime: p.end
            };
        }
    }

    return { isWindow: false };
}

/**
 * Returns current period info and whether college hours/submission window are active.
 */
export function getCurrentPeriodInfo() {
    const now = new Date();
    // Convert to Indian Standard Time (UTC + 5:30)
    const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
    const istMinutes = (utcMinutes + 330) % 1440;

    for (const p of KLU_PERIODS) {
        const startMin = parseTimeToMinutes(p.start);
        const endMin = parseTimeToMinutes(p.end);
        if (istMinutes >= startMin && istMinutes < endMin) {
            return {
                period: p.period,
                label: p.period === 'Lunch' ? 'Lunch Break' : `Period ${p.period}`,
                timing: `${p.start} - ${p.end}`,
                isSubmissionWindow: istMinutes >= endMin - 5,
                isLunch: p.period === 'Lunch',
                isClassHours: true,
                statusText: p.period === 'Lunch' ? 'Lunch Break (12:30 - 13:20)' : `Period ${p.period} (${p.start} - ${p.end}) in progress`
            };
        }
    }

    // Check if within submission window (up to 15 mins after period end)
    for (const p of KLU_PERIODS) {
        if (typeof p.period !== 'number') continue;
        const endMin = parseTimeToMinutes(p.end);
        if (istMinutes >= endMin && istMinutes <= endMin + 15) {
            return {
                period: p.period,
                label: `Period ${p.period}`,
                timing: `${p.start} - ${p.end}`,
                isSubmissionWindow: true,
                isLunch: false,
                isClassHours: true,
                statusText: `Period ${p.period} ended · Faculty attendance window active`
            };
        }
    }

    const firstStart = parseTimeToMinutes(KLU_PERIODS[0].start);
    const lastEnd = parseTimeToMinutes(KLU_PERIODS[KLU_PERIODS.length - 1].end);
    const isClassHours = istMinutes >= firstStart && istMinutes <= lastEnd;

    return {
        period: null,
        label: isClassHours ? 'Between Periods' : 'Classes Done for Today',
        timing: '',
        isSubmissionWindow: false,
        isLunch: false,
        isClassHours,
        statusText: isClassHours ? 'Break Between Periods' : 'Classes done for today'
    };
}

/**
 * Recommended polling interval:
 * 5 seconds during active attendance submission windows, 20 seconds otherwise.
 */
export function getRecommendedPollInterval() {
    const check = isNearPeriodEnd();
    return check.isWindow ? 5000 : 20000;
}

/**
 * Synthesizes a high-tech two-tone success chime via Web Audio API.
 * Instant zero-latency sound with zero external audio assets.
 */
export function playAttendanceChime() {
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        if (ctx.state === 'suspended') {
            ctx.resume();
        }

        const now = ctx.currentTime;

        // Tone 1: D5 (587.33 Hz)
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(587.33, now);
        gain1.gain.setValueAtTime(0, now);
        gain1.gain.linearRampToValueAtTime(0.2, now + 0.03);
        gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start(now);
        osc1.stop(now + 0.35);

        // Tone 2: A5 (880 Hz) harmonic bell
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(880, now + 0.12);
        gain2.gain.setValueAtTime(0, now + 0.12);
        gain2.gain.linearRampToValueAtTime(0.25, now + 0.15);
        gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(now + 0.12);
        osc2.stop(now + 0.55);
    } catch (e) {
        // Audio policy or unsupported browser
        console.warn('[Audio] Notice on synthesize chime:', e);
    }
}

/**
 * Compares old attendance list vs new attendance list.
 * Identifies courses that received new attendance marks.
 */
export function calculateAttendanceDiff(oldSubjects, newSubjects) {
    if (!Array.isArray(oldSubjects) || !Array.isArray(newSubjects) || oldSubjects.length === 0) {
        return { hasChanges: false, changes: [] };
    }

    const oldMap = new Map();
    oldSubjects.forEach(s => {
        if (s.code) oldMap.set(s.code, s);
    });

    const changes = [];

    newSubjects.forEach(newSubj => {
        const oldSubj = oldMap.get(newSubj.code);
        if (!oldSubj) return;

        const parseCounts = (subj) => {
            if (subj.rawConducted !== undefined && subj.rawAttended !== undefined) {
                return { conducted: Number(subj.rawConducted), attended: Number(subj.rawAttended) };
            }
            if (typeof subj.attended === 'string' && subj.attended.includes('/')) {
                const parts = subj.attended.split('/');
                return {
                    attended: parseInt(parts[0], 10) || 0,
                    conducted: parseInt(parts[1], 10) || 0
                };
            }
            if (subj.components && typeof subj.components === 'object') {
                let c = 0, a = 0;
                Object.values(subj.components).forEach(comp => {
                    c += Number(comp.conducted || comp.totalConducted || 0);
                    a += Number(comp.attended || 0);
                });
                if (c > 0) return { conducted: c, attended: a };
            }
            return { conducted: 0, attended: 0 };
        };

        const oldCounts = parseCounts(oldSubj);
        const newCounts = parseCounts(newSubj);

        // Must have valid prior counts to detect a real diff
        if (oldCounts.conducted === 0 && newCounts.conducted === 0) return;

        const conductedDiff = newCounts.conducted - oldCounts.conducted;
        const attendedDiff = newCounts.attended - oldCounts.attended;

        // ONLY trigger when a new attendance mark actually occurred
        // Strictly avoids false alarms from floating point precision
        if (conductedDiff > 0 || attendedDiff > 0) {
            changes.push({
                code: newSubj.code,
                title: newSubj.title,
                conductedDiff: Math.max(0, conductedDiff),
                attendedDiff: Math.max(0, attendedDiff),
                oldPct: oldSubj.percent,
                newPct: newSubj.percent,
                wasAttended: attendedDiff > 0,
                wasAbsent: conductedDiff > 0 && attendedDiff === 0
            });
        }
    });

    let summaryBanner = '';
    if (changes.length > 0) {
        const first = changes[0];
        const statusText = first.attendedDiff > 0
            ? `+${first.attendedDiff} Present`
            : `+${first.conductedDiff} Absent`;
        summaryBanner = `${first.code || first.title}: ${statusText} • Now ${first.newPct}%`;
    }

    return {
        hasChanges: changes.length > 0,
        changes,
        summaryBanner
    };
}
