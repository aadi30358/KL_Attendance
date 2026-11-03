import { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    Flame,
    Calculator,
    RotateCcw,
    BookOpen,
    Info,
    TrendingDown,
    Award,
    AlertTriangle,
    Clock,
    Users,
    ArrowLeft
} from 'lucide-react';
import { Link } from 'react-router-dom';
import ErpSidebar from '../components/ErpSidebar';
import SEO from '../components/SEO';
import { useAttendance } from '../context/useAttendance';
import { subscribeCrossDomainSync } from '../services/crossDomainSync';
import { getActiveProfileDetails } from '../services/friendsService';

// KLU Official Weights
const KLU_WEIGHTS = {
    L: 100, // Lecture: 100%
    T: 100, // Tutorial / Theory: 100%
    P: 50,  // Practical: 50%
    S: 25   // Skill: 25%
};

const COMPONENT_LABELS = {
    L: 'Lecture (L - 100%)',
    T: 'Tutorial / Theory (T - 100%)',
    P: 'Practical (P - 50%)',
    S: 'Skill (S - 25%)'
};

const COMP_SHORT_NAMES = {
    L: 'Lecture (L)',
    T: 'Tutorial / Theory (T)',
    P: 'Practical (P)',
    S: 'Skill (S)'
};

const getStoredErpSubjects = () => {
    try {
        const activeId = localStorage.getItem('activeErpUser') || localStorage.getItem('rememberedId');
        const rememberedId = localStorage.getItem('rememberedId');
        const keysToTry = [];
        if (activeId) keysToTry.push(`kleData_${activeId}`);
        if (!activeId || activeId === rememberedId) {
            keysToTry.push('kleData');
        }

        for (const key of keysToTry) {
            const raw = localStorage.getItem(key);
            if (raw) {
                const parsed = JSON.parse(raw);
                const list = parsed.attendance_data || parsed.data || [];
                if (Array.isArray(list) && list.length > 0) {
                    return list;
                }
            }
        }
    } catch {
        // Ignore parse error
    }
    return [];
};

const BunkSimulator = () => {
    const { attendanceData } = useAttendance();
    const [mode, setMode] = useState('ltps'); // 'ltps' or 'quick'
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const [activeProfile, setActiveProfile] = useState(() => getActiveProfileDetails());
    const [activeId, setActiveId] = useState(() => {
        const prof = getActiveProfileDetails();
        return prof?.studentId || (typeof window !== 'undefined' ? localStorage.getItem('activeErpUser') : null) || '';
    });

    useEffect(() => {
        const updateProf = () => {
            const prof = getActiveProfileDetails();
            setActiveProfile(prof);
            setActiveId(prof?.studentId || localStorage.getItem('activeErpUser') || '');
        };
        window.addEventListener('kl_friends_updated', updateProf);
        window.addEventListener('kl_active_profile_updated', updateProf);
        window.addEventListener('kl_profile_switched', updateProf);
        window.addEventListener('storage', updateProf);
        return () => {
            window.removeEventListener('kl_friends_updated', updateProf);
            window.removeEventListener('kl_active_profile_updated', updateProf);
            window.removeEventListener('kl_profile_switched', updateProf);
            window.removeEventListener('storage', updateProf);
        };
    }, []);

    // ERP subjects if available
    const [savedSubjects, setSavedSubjects] = useState(getStoredErpSubjects);

    // Real-Time Cross-Domain & Tab Synchronization (< 1s)
    useEffect(() => {
        const refreshSubjects = () => {
            const subjects = getStoredErpSubjects();
            if (subjects && subjects.length > 0) {
                setSavedSubjects(subjects);
            }
        };

        window.addEventListener('storage', refreshSubjects);
        window.addEventListener('focus', refreshSubjects);

        const unsubscribe = subscribeCrossDomainSync((event) => {
            if (event.type === 'ATTENDANCE_UPDATED' && Array.isArray(event.data?.subjects) && event.data.subjects.length > 0) {
                setSavedSubjects(event.data.subjects);
            }
        });

        return () => {
            window.removeEventListener('storage', refreshSubjects);
            window.removeEventListener('focus', refreshSubjects);
            unsubscribe();
        };
    }, []);

    const [selectedCourseCode, setSelectedCourseCode] = useState('');
    const [courseAvailableComponents, setCourseAvailableComponents] = useState(null);

    // --- L-T-P-S State ---
    const [courseTitle, setCourseTitle] = useState('');
    const [ltpsData, setLtpsData] = useState({
        L: { conducted: '', attended: '' },
        T: { conducted: '', attended: '' },
        P: { conducted: '', attended: '' },
        S: { conducted: '', attended: '' }
    });

    const [bunksToSimulate, setBunksToSimulate] = useState({
        L: 0,
        T: 0,
        P: 0,
        S: 0
    });

    // --- Quick Mode State ---
    const [quickTotal, setQuickTotal] = useState(() => {
        return attendanceData?.totalClasses ? attendanceData.totalClasses.toString() : '';
    });
    const [quickAttended, setQuickAttended] = useState(() => {
        return attendanceData?.attendedClasses ? attendanceData.attendedClasses.toString() : '';
    });
    const [quickBunks, setQuickBunks] = useState(1);

    // Target threshold for safe bunk calculation (85% safe or 75% condonation)
    const [targetThreshold, setTargetThreshold] = useState(85);

    // Handle ERP subject selection
    const handleSelectCourse = (code) => {
        setSelectedCourseCode(code);
        if (!code) {
            setCourseTitle('');
            setCourseAvailableComponents(null);
            setLtpsData({
                L: { conducted: '', attended: '' },
                T: { conducted: '', attended: '' },
                P: { conducted: '', attended: '' },
                S: { conducted: '', attended: '' }
            });
            setBunksToSimulate({ L: 0, T: 0, P: 0, S: 0 });
            return;
        }

        if (code === '__OVERALL__') {
            setCourseTitle('Overall Attendance (All Courses Combined)');

            const aggregatedLtps = {
                L: { conducted: 0, attended: 0 },
                T: { conducted: 0, attended: 0 },
                P: { conducted: 0, attended: 0 },
                S: { conducted: 0, attended: 0 }
            };

            const overallActiveKeys = new Set();
            let overallRawAtt = 0;
            let overallRawCond = 0;

            savedSubjects.forEach((subj) => {
                let hasComp = false;
                if (subj.components && Object.keys(subj.components).length > 0) {
                    Object.entries(subj.components).forEach(([compKey, compVal]) => {
                        const norm = (compKey || '').trim().toLowerCase();
                        let targetKey = null;
                        if (norm.startsWith('pract') || norm.includes('lab') || norm === 'p') targetKey = 'P';
                        else if (norm.includes('theor') || norm.includes('tut') || norm === 't') targetKey = 'T';
                        else if (norm.includes('sk') || norm === 's') targetKey = 'S';
                        else if (norm.startsWith('lect') || norm === 'l') targetKey = 'L';
                        else {
                            const first = norm.charAt(0).toUpperCase();
                            if (aggregatedLtps[first]) targetKey = first;
                        }

                        if (targetKey && aggregatedLtps[targetKey]) {
                            hasComp = true;
                            overallActiveKeys.add(targetKey);
                            const c = parseInt(compVal.conducted, 10) || 0;
                            const a = parseInt(compVal.attended, 10) || 0;
                            aggregatedLtps[targetKey].conducted += c;
                            aggregatedLtps[targetKey].attended += a;
                        }
                    });
                }

                if (!hasComp && subj.attended && typeof subj.attended === 'string' && subj.attended.includes('/')) {
                    const [a, c] = subj.attended.split('/').map(v => parseInt(v, 10) || 0);
                    aggregatedLtps.L.conducted += c;
                    aggregatedLtps.L.attended += a;
                    overallActiveKeys.add('L');
                }

                if (subj.attended && typeof subj.attended === 'string' && subj.attended.includes('/')) {
                    const [a, c] = subj.attended.split('/').map(v => parseInt(v, 10) || 0);
                    overallRawAtt += a;
                    overallRawCond += c;
                } else if (subj.rawAttended && subj.rawConducted) {
                    overallRawAtt += Number(subj.rawAttended) || 0;
                    overallRawCond += Number(subj.rawConducted) || 0;
                }
            });

            const overallList = ['L', 'T', 'P', 'S'].filter(k => overallActiveKeys.has(k));
            setCourseAvailableComponents(overallList.length > 0 ? overallList : null);

            setLtpsData({
                L: { conducted: aggregatedLtps.L.conducted ? aggregatedLtps.L.conducted.toString() : '', attended: aggregatedLtps.L.attended ? aggregatedLtps.L.attended.toString() : '' },
                T: { conducted: aggregatedLtps.T.conducted ? aggregatedLtps.T.conducted.toString() : '', attended: aggregatedLtps.T.attended ? aggregatedLtps.T.attended.toString() : '' },
                P: { conducted: aggregatedLtps.P.conducted ? aggregatedLtps.P.conducted.toString() : '', attended: aggregatedLtps.P.attended ? aggregatedLtps.P.attended.toString() : '' },
                S: { conducted: aggregatedLtps.S.conducted ? aggregatedLtps.S.conducted.toString() : '', attended: aggregatedLtps.S.attended ? aggregatedLtps.S.attended.toString() : '' }
            });
            setBunksToSimulate({ L: 0, T: 0, P: 0, S: 0 });

            setQuickAttended(overallRawAtt ? overallRawAtt.toString() : '');
            setQuickTotal(overallRawCond ? overallRawCond.toString() : '');
            return;
        }

        const found = savedSubjects.find(s => s.code === code);
        if (!found) return;

        setCourseTitle(found.title ? `${found.code} - ${found.title}` : found.code);

        const newLtps = {
            L: { conducted: '', attended: '' },
            T: { conducted: '', attended: '' },
            P: { conducted: '', attended: '' },
            S: { conducted: '', attended: '' }
        };

        const compKeys = new Set();

        if (found.components && Object.keys(found.components).length > 0) {
            Object.entries(found.components).forEach(([compKey, compVal]) => {
                const norm = (compKey || '').trim().toLowerCase();
                let targetKey = null;
                if (norm.startsWith('pract') || norm.includes('lab') || norm === 'p') targetKey = 'P';
                else if (norm.includes('theor') || norm.includes('tut') || norm === 't') targetKey = 'T';
                else if (norm.includes('sk') || norm === 's') targetKey = 'S';
                else if (norm.startsWith('lect') || norm === 'l') targetKey = 'L';
                else {
                    const first = norm.charAt(0).toUpperCase();
                    if (newLtps[first]) targetKey = first;
                }

                if (targetKey && newLtps[targetKey]) {
                    compKeys.add(targetKey);
                    newLtps[targetKey] = {
                        conducted: (compVal.conducted ?? '').toString(),
                        attended: (compVal.attended ?? '').toString()
                    };
                }
            });
        }

        // Fallback: if components empty but attended "att/cond" exists, assign to Lecture
        if (!newLtps.L.conducted && !newLtps.T.conducted && !newLtps.P.conducted && !newLtps.S.conducted) {
            if (found.attended && typeof found.attended === 'string' && found.attended.includes('/')) {
                const [att, cond] = found.attended.split('/');
                newLtps.L = { conducted: cond || '', attended: att || '' };
                compKeys.add('L');
            }
        }

        const activeList = ['L', 'T', 'P', 'S'].filter(k => compKeys.has(k));
        setCourseAvailableComponents(activeList.length > 0 ? activeList : ['L']);

        setLtpsData(newLtps);
        setBunksToSimulate({ L: 0, T: 0, P: 0, S: 0 });

        // Also sync quick mode
        if (found.attended && typeof found.attended === 'string' && found.attended.includes('/')) {
            const [att, cond] = found.attended.split('/');
            setQuickAttended(att);
            setQuickTotal(cond);
        }
    };

    // --- L-T-P-S Calculations ---
    const ltpsResults = useMemo(() => {
        let currentWeightedAttended = 0;
        let currentWeightedConducted = 0;
        let hasAnyInput = false;

        const activeComponents = [];

        ['L', 'T', 'P', 'S'].forEach((k) => {
            const cond = parseInt(ltpsData[k].conducted, 10) || 0;
            const att = parseInt(ltpsData[k].attended, 10) || 0;
            const weight = KLU_WEIGHTS[k];

            if (cond > 0) {
                hasAnyInput = true;
                activeComponents.push(k);
                currentWeightedAttended += att * weight;
                currentWeightedConducted += cond * weight;
            }
        });

        if (!hasAnyInput || currentWeightedConducted === 0) {
            return null;
        }

        const currentPctRaw = (currentWeightedAttended / currentWeightedConducted) * 100;
        const currentPctOfficial = Math.ceil(currentPctRaw);
        const currentPctExact = parseFloat(currentPctRaw.toFixed(2));

        // After Bunks (only simulate bunks for active components)
        let simulatedWeightedConducted = currentWeightedConducted;
        let totalBunksCount = 0;

        activeComponents.forEach((k) => {
            const bunks = parseInt(bunksToSimulate[k], 10) || 0;
            if (bunks > 0) {
                totalBunksCount += bunks;
                simulatedWeightedConducted += bunks * KLU_WEIGHTS[k];
            }
        });

        const projectedPctRaw = (currentWeightedAttended / simulatedWeightedConducted) * 100;
        const projectedPctOfficial = Math.ceil(projectedPctRaw);
        const projectedPctExact = parseFloat(projectedPctRaw.toFixed(2));
        const percentageDrop = parseFloat((currentPctExact - projectedPctExact).toFixed(2));

        // Calculate max safe bunks ONLY for active components that belong to this course
        const maxSafeBunks = {};
        const targetFrac = targetThreshold / 100;

        activeComponents.forEach((k) => {
            const weight = KLU_WEIGHTS[k];
            if (currentPctExact < targetThreshold && currentPctOfficial < targetThreshold) {
                maxSafeBunks[k] = 0;
            } else {
                const allowance = Math.floor((currentWeightedAttended - targetFrac * currentWeightedConducted) / (targetFrac * weight));
                maxSafeBunks[k] = Math.max(0, allowance);
            }
        });

        // Classes needed to attend if below threshold
        const classesNeededByComp = {};
        const primaryComp = activeComponents.includes('L') ? 'L' : (activeComponents[0] || 'L');
        const primaryWeight = KLU_WEIGHTS[primaryComp] || 100;
        let classesNeededToRecover = 0;

        activeComponents.forEach((k) => {
            const weight = KLU_WEIGHTS[k] || 100;
            if (currentPctExact >= targetThreshold) {
                classesNeededByComp[k] = 0;
            } else {
                const numerator = targetFrac * currentWeightedConducted - currentWeightedAttended;
                const denominator = weight * (1 - targetFrac);
                classesNeededByComp[k] = Math.max(0, Math.ceil(numerator / denominator));
            }
        });

        if (currentPctExact < targetThreshold && currentPctOfficial < targetThreshold) {
            const numerator = targetFrac * currentWeightedConducted - currentWeightedAttended;
            const denominator = primaryWeight * (1 - targetFrac);
            classesNeededToRecover = Math.max(0, Math.ceil(numerator / denominator));
        }

        return {
            currentPctOfficial,
            currentPctExact,
            projectedPctOfficial,
            projectedPctExact,
            percentageDrop,
            totalBunksCount,
            activeComponents,
            primaryComp,
            maxSafeBunks,
            classesNeededByComp,
            classesNeededToRecover,
            isSafe: projectedPctOfficial >= 85,
            isWarning: projectedPctOfficial >= 75 && projectedPctOfficial < 85,
            isDanger: projectedPctOfficial < 75
        };
    }, [ltpsData, bunksToSimulate, targetThreshold]);

    // --- Quick Mode Calculations ---
    const quickResults = useMemo(() => {
        const cond = parseInt(quickTotal, 10);
        const att = parseInt(quickAttended, 10);
        const bunks = Math.max(0, parseInt(quickBunks, 10) || 0);

        if (isNaN(cond) || isNaN(att) || cond <= 0) return null;
        if (att > cond) return { error: 'Attended cannot exceed conducted classes' };

        const currentPctRaw = (att / cond) * 100;
        const currentPctOfficial = Math.ceil(currentPctRaw);
        const currentPctExact = parseFloat(currentPctRaw.toFixed(2));

        const newTotal = cond + bunks;
        const projectedPctRaw = (att / newTotal) * 100;
        const projectedPctOfficial = Math.ceil(projectedPctRaw);
        const projectedPctExact = parseFloat(projectedPctRaw.toFixed(2));
        const drop = parseFloat((currentPctExact - projectedPctExact).toFixed(2));

        // Safe bunks to keep 85% and 75%
        const maxBunk85 = att >= 0.85 * cond ? Math.floor((att - 0.85 * cond) / 0.85) : 0;
        const maxBunk75 = att >= 0.75 * cond ? Math.floor((att - 0.75 * cond) / 0.75) : 0;

        // Needed to recover
        const needed85 = currentPctExact < 85 ? Math.ceil((0.85 * cond - att) / 0.15) : 0;
        const needed75 = currentPctExact < 75 ? Math.ceil((0.75 * cond - att) / 0.25) : 0;

        // Scenario table for 1 to 8 bunks
        const scenarios = [1, 2, 3, 5, 8].map(n => {
            const simTotal = cond + n;
            const simPct = Math.ceil((att / simTotal) * 100);
            return { bunks: n, percent: simPct };
        });

        return {
            currentPctOfficial,
            currentPctExact,
            projectedPctOfficial,
            projectedPctExact,
            drop,
            bunks,
            maxBunk85,
            maxBunk75,
            needed85,
            needed75,
            scenarios,
            isSafe: projectedPctOfficial >= 85,
            isWarning: projectedPctOfficial >= 75 && projectedPctOfficial < 85,
            isDanger: projectedPctOfficial < 75
        };
    }, [quickTotal, quickAttended, quickBunks]);

    const resetLtps = () => {
        setLtpsData({
            L: { conducted: '', attended: '' },
            T: { conducted: '', attended: '' },
            P: { conducted: '', attended: '' },
            S: { conducted: '', attended: '' }
        });
        setBunksToSimulate({ L: 0, T: 0, P: 0, S: 0 });
        setSelectedCourseCode('');
        setCourseTitle('');
        setCourseAvailableComponents(null);
    };

    const resetQuick = () => {
        setQuickTotal('');
        setQuickAttended('');
        setQuickBunks(1);
    };

    return (
        <div className="h-full flex flex-col font-sans selection:bg-indigo-500 selection:text-white overflow-hidden">
            <SEO
                title="Bunk Simulator | KL Attendance Calculator"
                description="Simulate bunking classes using official KL University LTPS weights. Calculate how much your attendance drops before you bunk."
            />

            {/* Top Header */}
            <header className="bg-[#0088cc] text-white px-4 sm:px-6 py-2.5 shadow-md z-40 sticky top-0 shrink-0 w-full select-none border-b border-black/10">
                <div className="w-full relative flex items-center justify-between min-h-[46px]">
                    {/* Left: Mobile Drawer Toggle */}
                    <div className="flex items-center gap-2 z-10">
                        <button
                            type="button"
                            onClick={() => setSidebarOpen(prev => !prev)}
                            className="lg:hidden flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 active:scale-95 text-white text-xs font-bold transition-all border border-white/20 shadow-2xs cursor-pointer"
                            title="Menu"
                        >
                            <Users className="w-4 h-4" />
                            <span className="hidden sm:inline text-[11px] font-bold">Menu</span>
                        </button>
                    </div>

                    {/* Center: Logo + KL Attendance Calculator */}
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center text-center pointer-events-auto">
                        <div className="flex items-center gap-2 sm:gap-2.5">
                            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-white flex items-center justify-center p-0.5 shadow-sm ring-1 ring-white/30 shrink-0">
                                <img
                                    src="/Koneru Lakshmaiah University Logo Banner.png"
                                    alt="KLU"
                                    className="w-full h-full object-contain"
                                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                />
                            </div>
                            <span className="font-sans font-extrabold text-sm sm:text-lg text-white tracking-wide drop-shadow-xs whitespace-nowrap">
                                KL Attendance Calculator
                            </span>
                        </div>
                        <span className="text-[10px] sm:text-[11px] font-semibold text-white/95 tracking-wide leading-none mt-1 whitespace-nowrap">
                            Bunk Simulator • {activeProfile?.nickname || 'My Profile'} ({activeId})
                        </span>
                    </div>

                    {/* Right: Back to Home */}
                    <div className="flex items-center gap-2 z-10 ml-auto">
                        <Link
                            to="/"
                            className="text-xs font-black uppercase tracking-wider bg-white/15 hover:bg-white/25 active:scale-95 text-white px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-1.5 shadow-2xs border border-white/20"
                        >
                            <ArrowLeft className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Back to Home</span>
                        </Link>
                    </div>
                </div>
            </header>

            {/* Page Body: Left Sidebar + Bunk Simulator View */}
            <div className="flex-1 flex overflow-hidden min-h-0 relative">
                <ErpSidebar
                    isOpen={sidebarOpen}
                    onToggle={() => setSidebarOpen(false)}
                    activePage="bunk"
                />

                <main className="flex-1 overflow-y-auto min-h-0 p-4 sm:p-6 lg:p-8 font-sans">
                    <div className="fixed inset-0 -z-10 bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 pointer-events-none" />

                    <div className="max-w-5xl mx-auto space-y-8">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center space-y-3"
                >
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-rose-700 dark:text-rose-300 text-xs font-black uppercase tracking-wider shadow-sm">
                        <Flame className="w-4 h-4 text-rose-500 animate-pulse" />
                        <span>KLU Bunk Simulator Engine</span>
                    </div>
                    <h1 className="text-3xl sm:text-5xl font-black text-slate-900 dark:text-white tracking-tight">
                        Simulate Before You <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-600 via-pink-600 to-indigo-600 dark:from-rose-400 dark:via-pink-400 dark:to-indigo-300">Bunk</span>
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 max-w-xl mx-auto text-sm sm:text-base font-medium">
                        Calculate exactly how much your percentage drops when skipping classes with official KLU L-T-P-S weightages.
                    </p>
                </motion.div>

                {/* Mode Selector Tabs */}
                <div className="flex justify-center">
                    <div className="bg-slate-200/70 dark:bg-slate-800/80 p-1.5 rounded-2xl flex gap-1 border border-slate-300/60 dark:border-slate-700 shadow-inner max-w-md w-full">
                        <button
                            onClick={() => setMode('ltps')}
                            className={`flex-1 py-2.5 px-4 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer ${
                                mode === 'ltps'
                                    ? 'bg-white dark:bg-[#1e293b] text-indigo-700 dark:text-indigo-300 shadow-md border border-slate-200 dark:border-slate-700/80'
                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                            }`}
                        >
                            <Calculator className="w-4 h-4" />
                            <span>L-T-P-S Mode (KLU)</span>
                        </button>
                        <button
                            onClick={() => setMode('quick')}
                            className={`flex-1 py-2.5 px-4 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer ${
                                mode === 'quick'
                                    ? 'bg-white dark:bg-[#1e293b] text-indigo-700 dark:text-indigo-300 shadow-md border border-slate-200 dark:border-slate-700/80'
                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                            }`}
                        >
                            <Flame className="w-4 h-4 text-rose-500" />
                            <span>Quick Subject Mode</span>
                        </button>
                    </div>
                </div>

                {/* Period Duration Reference Note */}
                <div className="bg-gradient-to-r from-amber-50 to-orange-50/60 dark:from-amber-950/20 dark:to-orange-950/20 border border-amber-200/90 dark:border-amber-800/60 rounded-3xl p-4 sm:p-5 shadow-sm text-slate-800 dark:text-slate-200">
                    <div className="flex items-start gap-3 sm:gap-4">
                        <div className="p-2.5 bg-amber-100/90 text-amber-700 rounded-2xl shrink-0 mt-0.5 shadow-2xs">
                            <Clock className="w-5 h-5" />
                        </div>
                        <div className="space-y-2 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-xs sm:text-sm font-black text-amber-950 uppercase tracking-wide">
                                    Period Duration & Weightage Guide:
                                </h3>
                                <span className="text-[10px] font-bold bg-amber-200/80 text-amber-900 px-2 py-0.5 rounded-full">
                                    Timetable Calculation Guide
                                </span>
                            </div>
                            <p className="text-xs text-amber-900/90 font-medium leading-relaxed">
                                In KLU timetable schedule: <strong>Lecture & Tutorial = 50 mins (100% weightage)</strong>, <strong>Practical = 1.50 (50% weightage)</strong>, and <strong>Skill = 1.50 (25% weightage)</strong>:
                            </p>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                                <div className="bg-white/95 border border-amber-200 rounded-xl p-2.5 text-center shadow-2xs">
                                    <div className="flex items-center justify-center gap-1 mb-1">
                                        <span className="text-[10px] text-slate-500 font-bold block uppercase">Lecture (L)</span>
                                        <span className="text-[9px] font-black bg-indigo-100 text-indigo-800 px-1 rounded">100%</span>
                                    </div>
                                    <span className="text-xs sm:text-sm font-black text-amber-900 font-mono block">1 Class = 50 mins</span>
                                    <span className="text-[10px] text-slate-400 font-medium block mt-0.5">(1 Period)</span>
                                </div>
                                <div className="bg-white/95 border border-amber-200 rounded-xl p-2.5 text-center shadow-2xs">
                                    <div className="flex items-center justify-center gap-1 mb-1">
                                        <span className="text-[10px] text-slate-500 font-bold block uppercase">Tutorial (T)</span>
                                        <span className="text-[9px] font-black bg-indigo-100 text-indigo-800 px-1 rounded">100%</span>
                                    </div>
                                    <span className="text-xs sm:text-sm font-black text-amber-900 font-mono block">1 Class = 50 mins</span>
                                    <span className="text-[10px] text-slate-400 font-medium block mt-0.5">(1 Period)</span>
                                </div>
                                <div className="bg-white/95 border border-amber-200 rounded-xl p-2.5 text-center shadow-2xs">
                                    <div className="flex items-center justify-center gap-1 mb-1">
                                        <span className="text-[10px] text-slate-500 font-bold block uppercase">Practical (P)</span>
                                        <span className="text-[9px] font-black bg-rose-100 text-rose-800 px-1 rounded">50%</span>
                                    </div>
                                    <span className="text-xs sm:text-sm font-black text-amber-900 font-mono block">1 Class = 1.50</span>
                                    <span className="text-[10px] text-slate-400 font-medium block mt-0.5">(1h 50m / 2 Periods)</span>
                                </div>
                                <div className="bg-white/95 border border-amber-200 rounded-xl p-2.5 text-center shadow-2xs">
                                    <div className="flex items-center justify-center gap-1 mb-1">
                                        <span className="text-[10px] text-slate-500 font-bold block uppercase">Skill (S)</span>
                                        <span className="text-[9px] font-black bg-amber-100 text-amber-800 px-1 rounded">25%</span>
                                    </div>
                                    <span className="text-xs sm:text-sm font-black text-amber-900 font-mono block">1 Class = 1.50</span>
                                    <span className="text-[10px] text-slate-400 font-medium block mt-0.5">(1h 50m / 2 Periods)</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* --- L-T-P-S SIMULATOR MODE --- */}
                {mode === 'ltps' && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2 }}
                        className="space-y-8"
                    >
                        {/* Auto-fill from ERP session if available */}
                        {savedSubjects.length > 0 && (
                            <div className="bg-indigo-50/70 border border-indigo-200 rounded-3xl p-5 sm:p-6 shadow-sm">
                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3">
                                    <div className="flex items-center gap-2 text-indigo-900 font-bold text-sm">
                                        <BookOpen className="w-4 h-4 text-indigo-600" />
                                        <span>Load from your ERP Attendance Register</span>
                                    </div>
                                    <span className="text-[11px] font-semibold text-indigo-600 bg-white px-2.5 py-0.5 rounded-full border border-indigo-200">
                                        {savedSubjects.length} Courses Available
                                    </span>
                                </div>
                                <select
                                    value={selectedCourseCode}
                                    onChange={(e) => handleSelectCourse(e.target.value)}
                                    className="w-full bg-white border border-indigo-200 rounded-2xl px-4 py-3 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                                >
                                    <option value="">-- Choose a course to auto-fill components --</option>
                                    <option value="__OVERALL__">
                                        📊 Overall Total Attendance (All {savedSubjects.length} Courses Combined)
                                    </option>
                                    {savedSubjects.map((s) => (
                                        <option key={s.code} value={s.code}>
                                            {s.code} - {s.title} ({s.percent}%)
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                            {/* Input Form Column */}
                            <div className="lg:col-span-7 bg-white rounded-3xl p-6 sm:p-8 border-2 border-slate-900 shadow-xl space-y-6">
                                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                                    <div>
                                        <h2 className="text-xl font-extrabold text-slate-900">
                                            {courseTitle ? courseTitle : 'Enter LTPS Attendance'}
                                        </h2>
                                        <p className="text-xs text-slate-400 font-medium mt-0.5">
                                            {(courseAvailableComponents || ['L', 'T', 'P', 'S']).map(k => `${k === 'L' ? 'Lecture' : k === 'T' ? 'Tutorial' : k === 'P' ? 'Practical' : 'Skill'} (${KLU_WEIGHTS[k]}%)`).join(', ')}
                                        </p>
                                    </div>
                                    <button
                                        onClick={resetLtps}
                                        title="Reset All Fields"
                                        className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors"
                                    >
                                        <RotateCcw className="w-4 h-4" />
                                    </button>
                                </div>

                                {/* Component Inputs Table */}
                                <div className="space-y-4">
                                    {(courseAvailableComponents || ['L', 'T', 'P', 'S']).map((compKey) => {
                                        const condInt = parseInt(ltpsData[compKey].conducted, 10) || 0;
                                        const isCompActive = condInt > 0;
                                        return (
                                            <div
                                                key={compKey}
                                                className={`p-4 rounded-2xl border transition-all space-y-3 ${
                                                    isCompActive
                                                        ? 'bg-slate-50 border-slate-200/90 shadow-2xs'
                                                        : 'bg-slate-50/50 border-slate-200/60 opacity-80'
                                                }`}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs font-black text-slate-800 tracking-wide">
                                                        {COMPONENT_LABELS[compKey]}
                                                    </span>
                                                    <span className="text-[10px] font-bold text-slate-400 font-mono">
                                                        Weight: {KLU_WEIGHTS[compKey]}%
                                                    </span>
                                                </div>

                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Conducted</label>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            placeholder="e.g. 24"
                                                            value={ltpsData[compKey].conducted}
                                                            onChange={(e) => {
                                                                const val = e.target.value;
                                                                setLtpsData(prev => ({
                                                                    ...prev,
                                                                    [compKey]: { ...prev[compKey], conducted: val }
                                                                }));
                                                                if (!val || parseInt(val, 10) <= 0) {
                                                                    setBunksToSimulate(prev => ({ ...prev, [compKey]: 0 }));
                                                                }
                                                            }}
                                                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Attended</label>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            placeholder="e.g. 21"
                                                            value={ltpsData[compKey].attended}
                                                            onChange={(e) =>
                                                                setLtpsData(prev => ({
                                                                    ...prev,
                                                                    [compKey]: { ...prev[compKey], attended: e.target.value }
                                                                }))
                                                            }
                                                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                                                        />
                                                    </div>
                                                </div>

                                                {/* Bunk Counter for this Component */}
                                                <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between">
                                                    <span className={`text-[11px] font-bold flex items-center gap-1 ${isCompActive ? 'text-rose-600' : 'text-slate-400'}`}>
                                                        <Flame className={`w-3.5 h-3.5 ${isCompActive ? 'text-rose-500' : 'text-slate-300'}`} />
                                                        <span>Bunk {compKey === 'L' ? 'Lectures' : compKey === 'T' ? 'Tutorials' : compKey === 'P' ? 'Practicals' : 'Skills'}:</span>
                                                    </span>
                                                    <div className="flex items-center gap-1.5">
                                                        <button
                                                            type="button"
                                                            disabled={!isCompActive}
                                                            onClick={() =>
                                                                setBunksToSimulate(prev => ({
                                                                    ...prev,
                                                                    [compKey]: Math.max(0, (prev[compKey] || 0) - 1)
                                                                }))
                                                            }
                                                            className={`w-7 h-7 rounded-lg border font-black text-sm flex items-center justify-center transition-all ${
                                                                !isCompActive
                                                                    ? 'bg-slate-100 border-slate-200 text-slate-300 cursor-not-allowed'
                                                                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100 active:scale-95'
                                                            }`}
                                                        >
                                                            -
                                                        </button>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            disabled={!isCompActive}
                                                            value={isCompActive ? (bunksToSimulate[compKey] || 0) : 0}
                                                            onChange={(e) =>
                                                                setBunksToSimulate(prev => ({
                                                                    ...prev,
                                                                    [compKey]: Math.max(0, parseInt(e.target.value, 10) || 0)
                                                                }))
                                                            }
                                                            className={`w-12 text-center border rounded-lg py-1 text-xs font-black outline-none font-mono ${
                                                                !isCompActive
                                                                    ? 'bg-slate-100/70 border-slate-200 text-slate-300 cursor-not-allowed'
                                                                    : 'bg-white border-slate-200 text-rose-600 focus:ring-2 focus:ring-rose-400'
                                                             }`}
                                                        />
                                                        <button
                                                            type="button"
                                                            disabled={!isCompActive}
                                                            onClick={() =>
                                                                setBunksToSimulate(prev => ({
                                                                    ...prev,
                                                                    [compKey]: (prev[compKey] || 0) + 1
                                                                }))
                                                            }
                                                            className={`w-7 h-7 rounded-lg border font-black text-sm flex items-center justify-center transition-all ${
                                                                !isCompActive
                                                                    ? 'bg-slate-100 border-slate-200 text-slate-300 cursor-not-allowed'
                                                                    : 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100 active:scale-95'
                                                            }`}
                                                        >
                                                            +
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {courseAvailableComponents && courseAvailableComponents.length < 4 && (
                                    <div className="pt-1 text-center">
                                        <button
                                            type="button"
                                            onClick={() => setCourseAvailableComponents(null)}
                                            className="text-xs text-indigo-600 hover:text-indigo-800 font-bold transition-colors cursor-pointer hover:underline"
                                        >
                                            + Show all 4 components (Practical, Skill, etc.)
                                        </button>
                                    </div>
                                )}

                                <div className="flex items-center justify-between pt-2">
                                    <span className="text-xs font-bold text-slate-500">Calculate Safe Bunks for:</span>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setTargetThreshold(85)}
                                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                                targetThreshold === 85
                                                    ? 'bg-emerald-600 text-white shadow-sm'
                                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                            }`}
                                        >
                                            85% (Safe)
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setTargetThreshold(75)}
                                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                                targetThreshold === 75
                                                    ? 'bg-amber-600 text-white shadow-sm'
                                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                            }`}
                                        >
                                            75% (Condonation)
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Result Column */}
                            <div className="lg:col-span-5 space-y-6">
                                {ltpsResults ? (
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        className="bg-white rounded-3xl p-6 sm:p-8 border-2 border-slate-900 shadow-2xl space-y-6"
                                    >
                                        {/* Status Tag */}
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                                                Simulation Outcome
                                            </span>
                                            <span
                                                className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border ${
                                                    ltpsResults.isSafe
                                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                        : ltpsResults.isWarning
                                                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                                                        : 'bg-rose-50 text-rose-700 border-rose-200'
                                                }`}
                                            >
                                                {ltpsResults.isSafe ? '✓ Safe Zone' : ltpsResults.isWarning ? '⚠ Condonation' : '✗ Detained Zone'}
                                            </span>
                                        </div>

                                        {/* Big Percentage Cards */}
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                                                    Current Score
                                                </span>
                                                <span className="text-3xl font-black text-slate-800">
                                                    {ltpsResults.currentPctOfficial}%
                                                </span>
                                                <span className="text-[10px] text-slate-400 block font-mono mt-0.5">
                                                    ({ltpsResults.currentPctExact}%)
                                                </span>
                                            </div>

                                            <div
                                                className={`rounded-2xl p-4 text-center border ${
                                                    ltpsResults.isSafe
                                                        ? 'bg-emerald-50 border-emerald-200'
                                                        : ltpsResults.isWarning
                                                        ? 'bg-amber-50 border-amber-200'
                                                        : 'bg-rose-50 border-rose-200'
                                                }`}
                                            >
                                                <span className="text-[10px] font-bold uppercase tracking-widest block mb-1 opacity-70">
                                                    After Bunking
                                                </span>
                                                <span
                                                    className={`text-3xl font-black ${
                                                        ltpsResults.isSafe
                                                            ? 'text-emerald-700'
                                                            : ltpsResults.isWarning
                                                            ? 'text-amber-700'
                                                            : 'text-rose-700'
                                                    }`}
                                                >
                                                    {ltpsResults.projectedPctOfficial}%
                                                </span>
                                                <span className="text-[10px] opacity-70 block font-mono mt-0.5">
                                                    ({ltpsResults.projectedPctExact}%)
                                                </span>
                                            </div>
                                        </div>

                                        {/* Drop Warning */}
                                        {ltpsResults.totalBunksCount > 0 ? (
                                            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <TrendingDown className="w-5 h-5 text-rose-600" />
                                                    <div>
                                                        <p className="text-xs font-black text-rose-900">
                                                            {ltpsResults.totalBunksCount} classes bunked
                                                        </p>
                                                        <p className="text-[11px] text-rose-700">Attendance drops by</p>
                                                    </div>
                                                </div>
                                                <span className="text-xl font-black text-rose-600 font-mono">
                                                    -{ltpsResults.percentageDrop}%
                                                </span>
                                            </div>
                                        ) : (
                                            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-center text-xs text-slate-500 font-medium">
                                                Use the + / - buttons on the left to simulate bunking classes.
                                            </div>
                                        )}

                                        {/* Safe Bunk Allowance Grid */}
                                        <div className="space-y-2 pt-2 border-t border-slate-100">
                                            <p className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                                                <Award className="w-4 h-4 text-indigo-600" />
                                                <span>Max Safe Bunk Allowance (To Keep {targetThreshold}%):</span>
                                            </p>

                                            <div className={`grid gap-2 text-center ${
                                                ltpsResults.activeComponents.length === 1
                                                    ? 'grid-cols-1'
                                                    : ltpsResults.activeComponents.length === 3
                                                    ? 'grid-cols-3'
                                                    : ltpsResults.activeComponents.length === 4
                                                    ? 'grid-cols-2 sm:grid-cols-4'
                                                    : 'grid-cols-2'
                                            }`}>
                                                {ltpsResults.activeComponents.map((k) => {
                                                    const count = ltpsResults.maxSafeBunks[k] ?? 0;
                                                    const bunks = bunksToSimulate[k] || 0;
                                                    const remaining = Math.max(0, count - bunks);
                                                    return (
                                                        <div key={k} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                                                            <span className="text-[10px] text-slate-400 font-bold uppercase block">
                                                                {COMP_SHORT_NAMES[k] || k}
                                                            </span>
                                                            <span className="text-lg font-black text-slate-800">
                                                                {count} <span className="text-xs font-semibold text-slate-400">{count === 1 ? 'class' : 'classes'}</span>
                                                            </span>
                                                            <span className="text-[10px] font-semibold text-slate-500 block mt-0.5 font-mono">
                                                                {k === 'P' || k === 'S' ? '1 class = 1.50 (1h 50m)' : count === 2 ? '2 classes = 1.50 (1h 50m)' : count === 1 ? '1 class = 50 mins' : '1 = 50m, 2 = 1.50'}
                                                            </span>
                                                            {bunks > 0 && (
                                                                <span className="text-[10px] font-bold text-amber-600 block mt-0.5">
                                                                    ({remaining} left)
                                                                </span>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* Recovery Notice */}
                                        {ltpsResults.classesNeededToRecover > 0 && (
                                            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-start gap-3">
                                                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                                                <div>
                                                    <p className="text-xs font-bold text-amber-900">
                                                        Recovery Needed for {targetThreshold}%
                                                    </p>
                                                    <p className="text-xs text-amber-800 mt-0.5">
                                                        You must attend the next <strong>{ltpsResults.classesNeededToRecover}</strong> {COMP_SHORT_NAMES[ltpsResults.primaryComp] || 'lecture'} sessions consecutively without missing to reach {targetThreshold}%.
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                    </motion.div>
                                ) : (
                                    <div className="bg-white rounded-3xl p-8 border-2 border-dashed border-slate-300 text-center space-y-3">
                                        <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto text-slate-400">
                                            <Calculator className="w-6 h-6" />
                                        </div>
                                        <h3 className="font-extrabold text-slate-700 text-lg">Awaiting Component Data</h3>
                                        <p className="text-xs text-slate-400 max-w-xs mx-auto">
                                            Fill in Conducted & Attended classes for any component on the left (or pick an ERP course above) to see live bunk simulations.
                                        </p>
                                    </div>
                                )}

                                {/* Rule Guide Card */}
                                <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-2.5 text-xs text-slate-600">
                                    <div className="flex items-center gap-2 font-bold text-slate-900">
                                        <Info className="w-4 h-4 text-indigo-600" />
                                        <span>KL University Attendance Rules</span>
                                    </div>
                                    <ul className="space-y-1.5 pl-4 list-disc text-[11px] text-slate-500">
                                        <li><strong>85% and above:</strong> Safe Zone (eligible for all exams).</li>
                                        <li><strong>75% to 84%:</strong> Condonation required with medical proof & fee.</li>
                                        <li><strong>Below 75%:</strong> Strictly detained according to university policy.</li>
                                        <li><strong>Weightages:</strong> Lecture & Tutorial carry 100%, Practical carries 50%, Skill carries 25%.</li>
                                        <li><strong>Period Durations:</strong> 1 class = 50 mins, 2 classes = 1.50 (1 hr 50 mins).</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* --- QUICK SUBJECT / OVERALL MODE --- */}
                {mode === 'quick' && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2 }}
                        className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start"
                    >
                        {/* Quick Inputs */}
                        <div className="lg:col-span-6 bg-white rounded-3xl p-6 sm:p-8 border-2 border-slate-900 shadow-xl space-y-6">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                                <div>
                                    <h2 className="text-xl font-extrabold text-slate-900">Quick Bunk Calculator</h2>
                                    <p className="text-xs text-slate-400 font-medium">For single subjects or total semester classes</p>
                                </div>
                                <button
                                    onClick={resetQuick}
                                    title="Reset"
                                    className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors"
                                >
                                    <RotateCcw className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                                        Total Classes Conducted
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        placeholder="e.g. 50"
                                        value={quickTotal}
                                        onChange={(e) => setQuickTotal(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-base font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                                        Total Classes Attended
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        placeholder="e.g. 45"
                                        value={quickAttended}
                                        onChange={(e) => setQuickAttended(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-base font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                </div>

                                {/* Bunk Stepper & Slider */}
                                <div className="p-5 rounded-2xl bg-rose-50/70 border border-rose-200/80 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-black text-rose-900 uppercase flex items-center gap-1.5">
                                            <Flame className="w-4 h-4 text-rose-600" />
                                            <span>Number of Classes to Bunk</span>
                                        </label>
                                        <span className="text-lg font-black text-rose-600 font-mono">
                                            {quickBunks} {quickBunks === 1 ? 'class' : 'classes'}
                                        </span>
                                    </div>

                                    <input
                                        type="range"
                                        min="1"
                                        max="30"
                                        value={quickBunks}
                                        onChange={(e) => setQuickBunks(parseInt(e.target.value, 10) || 0)}
                                        className="w-full accent-rose-600 cursor-pointer"
                                    />

                                    <div className="flex gap-2 pt-1">
                                        {[1, 2, 3, 5, 10].map((num) => (
                                            <button
                                                key={num}
                                                type="button"
                                                onClick={() => setQuickBunks(num)}
                                                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                                    quickBunks === num
                                                        ? 'bg-rose-600 text-white shadow-sm'
                                                        : 'bg-white border border-rose-200 text-rose-700 hover:bg-rose-100'
                                                }`}
                                            >
                                                +{num}
                                            </button>
                                        ))}
                                    </div>

                                    <div className="pt-2 border-t border-rose-200/60 flex items-center justify-between text-[11px] text-rose-800 font-medium">
                                        <span>Duration Reference:</span>
                                        <span className="font-mono font-bold">1 = 50m • 2 = 1.50</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Quick Results */}
                        <div className="lg:col-span-6 space-y-6">
                            {quickResults && !quickResults.error ? (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="bg-white rounded-3xl p-6 sm:p-8 border-2 border-slate-900 shadow-2xl space-y-6"
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                                            Quick Prediction
                                        </span>
                                        <span
                                            className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border ${
                                                quickResults.isSafe
                                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                    : quickResults.isWarning
                                                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                                                    : 'bg-rose-50 text-rose-700 border-rose-200'
                                            }`}
                                        >
                                            {quickResults.isSafe ? 'Safe (85%+)' : quickResults.isWarning ? 'Condonation (75-85%)' : 'Detained (<75%)'}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                                                Current Score
                                            </span>
                                            <span className="text-3xl font-black text-slate-800">
                                                {quickResults.currentPctOfficial}%
                                            </span>
                                            <span className="text-[10px] text-slate-400 block font-mono">
                                                ({quickResults.currentPctExact}%)
                                            </span>
                                        </div>

                                        <div
                                            className={`rounded-2xl p-4 text-center border ${
                                                quickResults.isSafe
                                                    ? 'bg-emerald-50 border-emerald-200'
                                                    : quickResults.isWarning
                                                    ? 'bg-amber-50 border-amber-200'
                                                    : 'bg-rose-50 border-rose-200'
                                            }`}
                                        >
                                            <span className="text-[10px] font-bold uppercase tracking-widest block mb-1 opacity-70">
                                                After {quickBunks} Bunk{quickBunks > 1 ? 's' : ''}
                                            </span>
                                            <span
                                                className={`text-3xl font-black ${
                                                    quickResults.isSafe
                                                        ? 'text-emerald-700'
                                                        : quickResults.isWarning
                                                        ? 'text-amber-700'
                                                        : 'text-rose-700'
                                                }`}
                                            >
                                                {quickResults.projectedPctOfficial}%
                                            </span>
                                            <span className="text-[10px] opacity-70 block font-mono">
                                                ({quickResults.projectedPctExact}%)
                                            </span>
                                        </div>
                                    </div>

                                    {/* Safe Bunk Threshold Cards */}
                                    <div className="grid grid-cols-2 gap-3 pt-2">
                                        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200">
                                            <span className="text-[10px] font-bold uppercase text-emerald-800 block">
                                                Safe to Skip (85%)
                                            </span>
                                            <span className="text-2xl font-black text-emerald-700">
                                                {quickResults.maxBunk85} <span className="text-xs font-semibold">classes</span>
                                            </span>
                                        </div>
                                        <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200">
                                            <span className="text-[10px] font-bold uppercase text-amber-800 block">
                                                Safe to Skip (75%)
                                            </span>
                                            <span className="text-2xl font-black text-amber-700">
                                                {quickResults.maxBunk75} <span className="text-xs font-semibold">classes</span>
                                            </span>
                                        </div>
                                    </div>

                                    {/* What If Scenario Breakdown */}
                                    <div className="space-y-2 pt-2 border-t border-slate-100">
                                        <span className="text-xs font-bold text-slate-700 block">
                                            What-If Bunk Projection Table
                                        </span>
                                        <div className="grid grid-cols-5 gap-1.5 text-center">
                                            {quickResults.scenarios.map((sc) => (
                                                <div
                                                    key={sc.bunks}
                                                    className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-700"
                                                >
                                                    <span className="text-[10px] font-bold block text-slate-400">
                                                        +{sc.bunks} Bunk
                                                    </span>
                                                    <span
                                                        className={`text-sm font-black ${
                                                            sc.percent >= 85
                                                                ? 'text-emerald-600'
                                                                : sc.percent >= 75
                                                                ? 'text-amber-600'
                                                                : 'text-rose-600'
                                                        }`}
                                                    >
                                                        {sc.percent}%
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Recovery */}
                                    {quickResults.needed85 > 0 && (
                                        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
                                            <p className="font-bold text-slate-800 mb-1">Recovery Advice:</p>
                                            <p>
                                                Need to attend <strong>{quickResults.needed85}</strong> consecutive classes without bunking to achieve 85% attendance.
                                            </p>
                                        </div>
                                    )}
                                </motion.div>
                            ) : quickResults?.error ? (
                                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 font-bold text-xs text-center">
                                    {quickResults.error}
                                </div>
                            ) : (
                                <div className="bg-white rounded-3xl p-8 border-2 border-dashed border-slate-300 text-center space-y-3">
                                    <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto text-slate-400">
                                        <Flame className="w-6 h-6" />
                                    </div>
                                    <h3 className="font-extrabold text-slate-700 text-lg">Enter Classes Above</h3>
                                    <p className="text-xs text-slate-400 max-w-xs mx-auto">
                                        Enter your conducted and attended classes to see the exact percentage impact of bunking.
                                    </p>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
                    </div>
                </main>
            </div>
        </div>
    );
};

export default BunkSimulator;
