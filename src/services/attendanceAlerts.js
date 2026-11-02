/**
 * Attendance Alerts & Real-Time Period Monitoring Engine
 * Provides:
 * 1. KL Timetable Tracker & Period Completion Detection (aggressive 4s polling near period completion / in-class)
 * 2. Zero-latency synthesized Web Audio API chime (descending urgency alert for absent, ascending harmonic for present)
 * 3. Attendance diffing and visual notification state
 */

// KL University Standard 14-Period Timings (IST)
export const KLU_PERIODS = [
    { period: 1, id: 'S1', start: '07:10', end: '08:00' },
    { period: 2, id: 'S2', start: '08:00', end: '08:50' },
    { period: 3, id: 'S3', start: '09:20', end: '10:10' },
    { period: 4, id: 'S4', start: '10:10', end: '11:00' },
    { period: 5, id: 'S5', start: '11:10', end: '12:00' },
    { period: 6, id: 'S6', start: '12:00', end: '12:50' },
    { period: 7, id: 'S7', start: '13:00', end: '13:50' },
    { period: 8, id: 'S8', start: '13:50', end: '14:40' },
    { period: 9, id: 'S9', start: '14:40', end: '15:30' },
    { period: 10, id: 'S10', start: '15:40', end: '16:20' },
    { period: 11, id: 'S11', start: '16:20', end: '17:30' },
    { period: 12, id: 'S12', start: '17:30', end: '18:15' },
    { period: 13, id: 'S13', start: '18:15', end: '19:00' },
    { period: 14, id: 'S14', start: '19:00', end: '19:45' }
];

function parseTimeToMinutes(timeStr) {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
}

/**
 * Checks if current time is in the attendance submission window or active class period.
 * (Active class period or up to 20 minutes after period end, when faculty submit attendance).
 */
export function isNearPeriodEnd() {
    const now = new Date();
    // Convert to Indian Standard Time (UTC + 5:30)
    const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
    const istMinutes = (utcMinutes + 330) % 1440;

    for (const p of KLU_PERIODS) {
        const startMinutes = parseTimeToMinutes(p.start);
        const endMinutes = parseTimeToMinutes(p.end);
        // Active class or submission window: period start through 20 minutes after end
        if (istMinutes >= startMinutes && istMinutes <= endMinutes + 20) {
            return {
                isWindow: true,
                period: p.period,
                slotId: p.id,
                startTime: p.start,
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
    const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
    const istMinutes = (utcMinutes + 330) % 1440;

    for (const p of KLU_PERIODS) {
        const startMin = parseTimeToMinutes(p.start);
        const endMin = parseTimeToMinutes(p.end);
        if (istMinutes >= startMin && istMinutes < endMin) {
            return {
                period: p.period,
                slotId: p.id,
                label: `Period ${p.id} (${p.period})`,
                timing: `${p.start} - ${p.end}`,
                isSubmissionWindow: true,
                isClassHours: true,
                statusText: `Period ${p.id} (${p.start} - ${p.end}) in progress`
            };
        }
    }

    // Check if within submission window (up to 20 mins after period end)
    for (const p of KLU_PERIODS) {
        const endMin = parseTimeToMinutes(p.end);
        if (istMinutes >= endMin && istMinutes <= endMin + 20) {
            return {
                period: p.period,
                slotId: p.id,
                label: `Period ${p.id}`,
                timing: `${p.start} - ${p.end}`,
                isSubmissionWindow: true,
                isClassHours: true,
                statusText: `Period ${p.id} ended · Faculty attendance entry window active`
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
        isClassHours,
        statusText: isClassHours ? 'Break Between Periods' : 'Classes done for today'
    };
}

/**
 * Recommended polling interval:
 * 4 seconds during active class / attendance submission windows, 12 seconds otherwise.
 */
export function getRecommendedPollInterval() {
    const check = isNearPeriodEnd();
    return check.isWindow ? 4000 : 12000;
}

/**
 * Synthesizes zero-latency audio alert via Web Audio API.
 * - If isAbsent === true: Urgent descending tone alerting student that absence was marked.
 * - If isAbsent === false: Uplifting ascending harmonic chime celebrating present mark.
 */
export function playAttendanceChime(isAbsent = false) {
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        if (ctx.state === 'suspended') {
            ctx.resume();
        }

        const now = ctx.currentTime;

        if (isAbsent) {
            // Absent Warning Tone: Urgent dual-pulse minor chord (E5 -> A4)
            const osc1 = ctx.createOscillator();
            const gain1 = ctx.createGain();
            osc1.type = 'sawtooth';
            osc1.frequency.setValueAtTime(659.25, now); // E5
            gain1.gain.setValueAtTime(0, now);
            gain1.gain.linearRampToValueAtTime(0.2, now + 0.02);
            gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
            osc1.connect(gain1);
            gain1.connect(ctx.destination);
            osc1.start(now);
            osc1.stop(now + 0.28);

            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.type = 'sawtooth';
            osc2.frequency.setValueAtTime(440, now + 0.12); // A4
            gain2.gain.setValueAtTime(0, now + 0.12);
            gain2.gain.linearRampToValueAtTime(0.25, now + 0.14);
            gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
            osc2.connect(gain2);
            gain2.connect(ctx.destination);
            osc2.start(now + 0.12);
            osc2.stop(now + 0.5);
        } else {
            // Present Celebration Tone: Ascending harmonic bell (D5 -> A5)
            const osc1 = ctx.createOscillator();
            const gain1 = ctx.createGain();
            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(587.33, now); // D5
            gain1.gain.setValueAtTime(0, now);
            gain1.gain.linearRampToValueAtTime(0.2, now + 0.03);
            gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
            osc1.connect(gain1);
            gain1.connect(ctx.destination);
            osc1.start(now);
            osc1.stop(now + 0.35);

            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(880, now + 0.12); // A5
            gain2.gain.setValueAtTime(0, now + 0.12);
            gain2.gain.linearRampToValueAtTime(0.25, now + 0.15);
            gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);
            osc2.connect(gain2);
            gain2.connect(ctx.destination);
            osc2.start(now + 0.12);
            osc2.stop(now + 0.55);
        }
    } catch (e) {
        console.warn('[Audio] Notice on synthesize chime:', e);
    }
}

/**
 * Compares old attendance list vs new attendance list with deep component-level accuracy.
 * Identifies courses that received new attendance marks (Present, Absent, or Component-level change).
 * Strictly guards against cross-student diffs.
 */
export function calculateAttendanceDiff(oldSubjects, newSubjects, currentStudentId = null, previousStudentId = null) {
    // 1. Strict student isolation: Never diff across different students
    if (currentStudentId && previousStudentId && String(currentStudentId).trim() !== String(previousStudentId).trim()) {
        return { hasChanges: false, changes: [], isAbsent: false, summaryBanner: '' };
    }

    if (!Array.isArray(oldSubjects) || !Array.isArray(newSubjects) || oldSubjects.length === 0 || newSubjects.length === 0) {
        return { hasChanges: false, changes: [], isAbsent: false, summaryBanner: '' };
    }

    const oldMap = new Map();
    oldSubjects.forEach(s => {
        if (s.code) oldMap.set(s.code, s);
    });

    const changes = [];

    newSubjects.forEach(newSubj => {
        const oldSubj = oldMap.get(newSubj.code);
        if (!oldSubj) return;

        // 2. Component-level diffing (Lecture, Practical, Skill, Tutorial)
        const oldComponents = oldSubj.components && typeof oldSubj.components === 'object' ? oldSubj.components : {};
        const newComponents = newSubj.components && typeof newSubj.components === 'object' ? newSubj.components : {};

        const allCompNames = Array.from(new Set([
            ...Object.keys(oldComponents),
            ...Object.keys(newComponents)
        ]));

        const componentChanges = [];
        let anyCompAbsent = false;
        let anyCompPresent = false;
        let totalCompConductedDiff = 0;
        let totalCompAttendedDiff = 0;

        allCompNames.forEach(compName => {
            const oldC = oldComponents[compName] || { conducted: 0, attended: 0 };
            const newC = newComponents[compName] || { conducted: 0, attended: 0 };

            const cDiff = (Number(newC.conducted) || 0) - (Number(oldC.conducted) || 0);
            const aDiff = (Number(newC.attended) || 0) - (Number(oldC.attended) || 0);

            if (cDiff > 0 || aDiff > 0) {
                totalCompConductedDiff += Math.max(0, cDiff);
                totalCompAttendedDiff += Math.max(0, aDiff);

                const wasCompAbsent = cDiff > 0 && aDiff === 0;
                const wasCompPresent = aDiff > 0;

                if (wasCompAbsent) anyCompAbsent = true;
                if (wasCompPresent) anyCompPresent = true;
                if (cDiff > aDiff && aDiff > 0) anyCompAbsent = true; // Partial absence in this component

                componentChanges.push({
                    name: compName,
                    conductedDiff: Math.max(0, cDiff),
                    attendedDiff: Math.max(0, aDiff),
                    wasAbsent: wasCompAbsent || (cDiff > aDiff),
                    wasPresent: wasCompPresent
                });
            }
        });

        // 3. Fallback to raw aggregated counts if component breakdown was identical or empty
        const parseRawCounts = (subj) => {
            if (subj.rawConducted !== undefined && subj.rawAttended !== undefined) {
                return { conducted: Number(subj.rawConducted) || 0, attended: Number(subj.rawAttended) || 0 };
            }
            if (typeof subj.attended === 'string' && subj.attended.includes('/')) {
                const parts = subj.attended.split('/');
                return {
                    attended: parseInt(parts[0], 10) || 0,
                    conducted: parseInt(parts[1], 10) || 0
                };
            }
            return { conducted: 0, attended: 0 };
        };

        const oldRaw = parseRawCounts(oldSubj);
        const newRaw = parseRawCounts(newSubj);
        const rawConductedDiff = newRaw.conducted - oldRaw.conducted;
        const rawAttendedDiff = newRaw.attended - oldRaw.attended;

        const effectiveConductedDiff = totalCompConductedDiff > 0 ? totalCompConductedDiff : Math.max(0, rawConductedDiff);
        const effectiveAttendedDiff = totalCompAttendedDiff > 0 ? totalCompAttendedDiff : Math.max(0, rawAttendedDiff);

        const hasAnyChange = componentChanges.length > 0 || (effectiveConductedDiff > 0 || effectiveAttendedDiff > 0);

        if (hasAnyChange) {
            // Priority: An absence is detected if any component was absent, or conducted increased without full attendance
            const wasCourseAbsent = anyCompAbsent || (effectiveConductedDiff > 0 && effectiveAttendedDiff === 0) || (effectiveConductedDiff > effectiveAttendedDiff);
            const wasCoursePresent = anyCompPresent || effectiveAttendedDiff > 0;

            changes.push({
                code: newSubj.code,
                title: newSubj.title,
                conductedDiff: effectiveConductedDiff,
                attendedDiff: effectiveAttendedDiff,
                oldPct: oldSubj.percent,
                newPct: newSubj.percent,
                wasAttended: wasCoursePresent,
                wasAbsent: wasCourseAbsent,
                componentChanges
            });
        }
    });

    let summaryBanner = '';
    let isAbsentAlert = false;

    if (changes.length > 0) {
        // Absence takes utmost priority so student is immediately warned
        const firstAbsent = changes.find(c => c.wasAbsent);
        const targetChange = firstAbsent || changes[0];
        isAbsentAlert = Boolean(targetChange.wasAbsent);

        const titleOrCode = targetChange.title || targetChange.code;

        if (targetChange.componentChanges && targetChange.componentChanges.length > 0) {
            const parts = targetChange.componentChanges.map(comp => {
                if (comp.wasAbsent && comp.attendedDiff === 0) {
                    return `${comp.name}: +${comp.conductedDiff} Absent`;
                }
                if (comp.wasPresent && comp.conductedDiff === comp.attendedDiff) {
                    return `${comp.name}: +${comp.attendedDiff} Present`;
                }
                return `${comp.name}: +${comp.attendedDiff}P / +${comp.conductedDiff}C`;
            });

            const actionPrefix = isAbsentAlert ? '⚠️ Marked ABSENT in' : '🎉 Marked PRESENT in';
            summaryBanner = `${actionPrefix} ${titleOrCode} (${parts.join(', ')}): Now ${targetChange.newPct}%`;
        } else {
            const statusText = targetChange.wasAbsent && targetChange.attendedDiff === 0
                ? `+${targetChange.conductedDiff} Absent`
                : (targetChange.attendedDiff > 0 ? `+${targetChange.attendedDiff} Present` : `+${targetChange.conductedDiff} Conducted`);
            const actionPrefix = isAbsentAlert ? '⚠️ Marked ABSENT in' : '🎉 Marked PRESENT in';
            summaryBanner = `${actionPrefix} ${titleOrCode}: ${statusText} • Now ${targetChange.newPct}%`;
        }
    }

    return {
        hasChanges: changes.length > 0,
        changes,
        summaryBanner,
        isAbsent: isAbsentAlert
    };
}
