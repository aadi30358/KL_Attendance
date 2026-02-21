import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { RotateCcw, Calculator, LineChart, CheckCircle, AlertTriangle, XCircle, Sparkles, TrendingUp } from 'lucide-react';
import { useAttendance } from '../context/useAttendance';

const ThreeDCard = ({ children, className }) => {
    const x = useMotionValue(0);
    const y = useMotionValue(0);
    const mouseXSpring = useSpring(x);
    const mouseYSpring = useSpring(y);
    const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["3deg", "-3deg"]);
    const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-3deg", "3deg"]);

    const handleMouseMove = (e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        x.set(mouseX / width - 0.5);
        y.set(mouseY / height - 0.5);
    };

    return (
        <motion.div
            onMouseMove={handleMouseMove}
            onMouseLeave={() => { x.set(0); y.set(0); }}
            style={{ rotateY, rotateX, transformStyle: "preserve-3d" }}
            className={`transition-all duration-200 ease-out ${className}`}
        >
            <div style={{ transform: "translateZ(20px)" }}>{children}</div>
        </motion.div>
    );
};

const TotalAttendance = () => {
    const { updateAttendanceData } = useAttendance();
    const [totalClasses, setTotalClasses] = useState('');
    const [attendedClasses, setAttendedClasses] = useState('');
    const [projectedAbsences, setProjectedAbsences] = useState('');
    const [currentPercentage, setCurrentPercentage] = useState(null);
    const [classesNeeded85, setClassesNeeded85] = useState(null);
    const [classesNeeded65, setClassesNeeded65] = useState(null);
    const [error, setError] = useState('');

    const projectedStats = useMemo(() => {
        if (!totalClasses || !attendedClasses || !projectedAbsences || currentPercentage === null) {
            return { percentage: null, error: null };
        }

        const total = parseInt(totalClasses);
        const attended = parseInt(attendedClasses);
        const absences = parseInt(projectedAbsences);

        if (!total || !attended) return { percentage: null, error: null };

        if (absences > attended) {
            return { percentage: null, error: 'Projected absences cannot be more than attended classes' };
        }

        if (absences < 0) {
            return { percentage: null, error: 'Projected absences cannot be negative' };
        }

        const projected = ((attended - absences) / total) * 100;
        return { percentage: Math.round(projected), error: null };

    }, [totalClasses, attendedClasses, projectedAbsences, currentPercentage]);

    const projectedPercentage = projectedStats.percentage;
    const displayError = error || projectedStats.error;

    // Update Context for AI
    useEffect(() => {
        if (currentPercentage !== null) {
            updateAttendanceData({
                totalClasses: parseInt(totalClasses) || 0,
                attendedClasses: parseInt(attendedClasses) || 0,
                projectedAbsences: parseInt(projectedAbsences) || 0,
                currentPercentage: currentPercentage,
                projectedPercentage: projectedPercentage
            });
        }
    }, [currentPercentage, projectedPercentage, totalClasses, attendedClasses, projectedAbsences, updateAttendanceData]);

    const resetForm = () => {
        setTotalClasses('');
        setAttendedClasses('');
        setProjectedAbsences('');
        setCurrentPercentage(null);
        setClassesNeeded85(null);
        setClassesNeeded65(null);
        setError('');
    };

    const calculateClassesNeeded = (current, total, targetPercentage) => {
        const currentAttended = parseInt(current);
        const totalClasses = parseInt(total);
        let classesNeeded = 0;
        let tempTotal = totalClasses;
        let tempPercentage = (currentAttended / tempTotal) * 100;

        while (tempPercentage < targetPercentage && classesNeeded < 100) {
            classesNeeded++;
            tempTotal++;
            tempPercentage = ((currentAttended + classesNeeded) / tempTotal) * 100;
        }

        return classesNeeded;
    };

    const calculateAttendance = () => {
        if (!totalClasses || !attendedClasses) {
            setError('Please enter both total and attended classes');
            return;
        }

        const total = parseInt(totalClasses);
        const attended = parseInt(attendedClasses);

        if (attended > total) {
            setError('Attended classes cannot be more than total classes');
            return;
        }

        setError('');
        const percentage = (attended / total) * 100;
        setCurrentPercentage(Math.round(percentage));

        setClassesNeeded85(calculateClassesNeeded(attended, total, 85));
        setClassesNeeded65(calculateClassesNeeded(attended, total, 75));
    };

    const getStatusInfo = (percentage) => {
        if (percentage >= 85) return { color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100', bar: 'bg-gradient-to-r from-emerald-400 to-teal-400', label: 'Eligible (Safe Zone)', icon: CheckCircle };
        if (percentage >= 75) return { color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100', bar: 'bg-gradient-to-r from-amber-400 to-orange-400', label: 'Condonation Required', icon: AlertTriangle };
        return { color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-100', bar: 'bg-gradient-to-r from-rose-500 to-red-500', label: 'Not Eligible (Detained)', icon: XCircle };
    };

    return (
        <div className="relative min-h-screen bg-[#FAFAFA] overflow-hidden selection:bg-indigo-500 selection:text-white perspective-root-lg">
            {/* --- Advanced Ambient Background --- */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-slate-50 to-white opacity-80" />
                <motion.div
                    animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.5, 0.3], rotate: [0, -45, 0] }}
                    transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
                    className="absolute top-[10%] left-[20%] w-[60vw] h-[60vw] rounded-full bg-emerald-100/40 blur-[120px]"
                />
                <motion.div
                    animate={{ x: [0, -50, 0], opacity: [0.2, 0.4, 0.2] }}
                    transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute bottom-[20%] -left-[10%] w-[50vw] h-[50vw] rounded-full bg-blue-100/40 blur-[120px]"
                />
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-overlay" />
            </div>

            <div className="relative z-10 max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8 space-y-8">

                {/* Header */}
                <motion.div
                    className="text-center mb-12"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5 }}
                >
                    <div className="inline-flex items-center justify-center p-3 bg-white rounded-2xl shadow-lg shadow-indigo-100 mb-6">
                        <Calculator className="w-10 h-10 text-indigo-600" />
                    </div>
                    <h1 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight mb-4">
                        Status Calculator
                    </h1>
                    <p className="text-xl text-slate-500 font-medium max-w-xl mx-auto">
                        Advanced attendance projection engine. Check your safe zone status instantly.
                    </p>
                </motion.div>

                <ThreeDCard className="w-full">
                    <div className="bg-white/80 backdrop-blur-xl rounded-[2.5rem] shadow-2xl shadow-indigo-100/50 border border-white/60 p-8 md:p-10 relative overflow-hidden group hover:shadow-indigo-200/50 transition-all duration-500">
                        {/* Blob Decoration */}
                        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 opacity-60 pointer-events-none" />

                        <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-700 uppercase tracking-wider ml-1">Total Classes</label>
                                    <input
                                        type="number"
                                        value={totalClasses}
                                        onChange={(e) => setTotalClasses(e.target.value)}
                                        placeholder="e.g. 45"
                                        min="0"
                                        className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl text-lg font-bold text-slate-900 focus:ring-4 focus:ring-indigo-100 transition-all shadow-inner outline-none placeholder:font-medium placeholder:text-slate-300"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-700 uppercase tracking-wider ml-1">Attended Classes</label>
                                    <input
                                        type="number"
                                        value={attendedClasses}
                                        onChange={(e) => setAttendedClasses(e.target.value)}
                                        placeholder="e.g. 38"
                                        min="0"
                                        className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl text-lg font-bold text-slate-900 focus:ring-4 focus:ring-indigo-100 transition-all shadow-inner outline-none placeholder:font-medium placeholder:text-slate-300"
                                    />
                                </div>
                            </div>

                            <div className="space-y-6 flex flex-col justify-between">
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-700 uppercase tracking-wider ml-1 flex items-center gap-2">
                                        Projected Absences <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-[10px] rounded-full">Optional</span>
                                    </label>
                                    <input
                                        type="number"
                                        value={projectedAbsences}
                                        onChange={(e) => setProjectedAbsences(e.target.value)}
                                        placeholder="Planned leaves?"
                                        min="0"
                                        className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl text-lg font-bold text-slate-900 focus:ring-4 focus:ring-indigo-100 transition-all shadow-inner outline-none placeholder:font-medium placeholder:text-slate-300"
                                    />
                                </div>

                                <div className="flex gap-4 pt-2">
                                    <motion.button
                                        className="flex-1 bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-bold text-lg py-4 px-6 rounded-2xl shadow-xl shadow-indigo-200 hover:shadow-indigo-300 transition-all flex items-center justify-center gap-2 group"
                                        onClick={calculateAttendance}
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                    >
                                        <TrendingUp className="w-5 h-5 group-hover:-translate-y-1 group-hover:translate-x-1 transition-transform" />
                                        Calculate
                                    </motion.button>
                                    <motion.button
                                        className="bg-white border border-slate-200 text-slate-600 font-bold py-4 px-6 rounded-2xl hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
                                        onClick={resetForm}
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        title="Reset"
                                    >
                                        <RotateCcw className="w-5 h-5" />
                                    </motion.button>
                                </div>
                            </div>
                        </div>

                        <AnimatePresence>
                            {displayError && (
                                <motion.div
                                    className="mt-6 p-4 bg-rose-50 text-rose-600 text-sm font-bold rounded-2xl border border-rose-100 flex items-center gap-3"
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                >
                                    <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                                    {displayError}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </ThreeDCard>

                {currentPercentage !== null && (
                    <motion.div
                        className="space-y-6"
                        initial={{ opacity: 0, y: 40 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ type: "spring", damping: 20 }}
                    >
                        {/* Results Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Current Status */}
                            <ThreeDCard className="h-full">
                                <div className={`relative h-full p-8 rounded-[2.5rem] border overflow-hidden ${getStatusInfo(currentPercentage).bg} ${getStatusInfo(currentPercentage).border}`}>
                                    <div className="relative z-10">
                                        <div className="flex justify-between items-start mb-6">
                                            <div>
                                                <p className="text-sm font-bold opacity-60 uppercase tracking-widest text-slate-800">Current Status</p>
                                                <h2 className={`text-6xl font-black mt-2 tracking-tighter ${getStatusInfo(currentPercentage).color}`}>{currentPercentage}%</h2>
                                            </div>
                                            <div className={`p-4 rounded-2xl bg-white/60 backdrop-blur-md shadow-sm ${getStatusInfo(currentPercentage).color}`}>
                                                {(() => {
                                                    const Icon = getStatusInfo(currentPercentage).icon;
                                                    return <Icon className="w-8 h-8" />;
                                                })()}
                                            </div>
                                        </div>

                                        <div className="w-full bg-white/50 h-4 rounded-full overflow-hidden mb-4 border border-white/20">
                                            <motion.div
                                                className={`h-full ${getStatusInfo(currentPercentage).bar} shadow-lg`}
                                                initial={{ width: 0 }}
                                                animate={{ width: `${Math.min(currentPercentage, 100)}%` }}
                                                transition={{ duration: 1, ease: "circOut" }}
                                            />
                                        </div>
                                        <p className={`font-bold text-lg ${getStatusInfo(currentPercentage).color}`}>
                                            {getStatusInfo(currentPercentage).label}
                                        </p>
                                    </div>
                                </div>
                            </ThreeDCard>

                            {/* Recommendations / Insights */}
                            <ThreeDCard className="h-full">
                                <div className="h-full bg-white rounded-[2.5rem] border border-slate-200 p-8 shadow-xl shadow-slate-200/50 flex flex-col justify-center">
                                    <h3 className="font-bold text-slate-900 text-lg mb-3 flex items-center gap-2">
                                        <Sparkles className="w-5 h-5 text-indigo-500" />
                                        Smart Insight
                                    </h3>
                                    <p className="text-slate-600 font-medium leading-relaxed">
                                        {currentPercentage >= 85 ? (
                                            "Outstanding! You're firmly in the Safe Zone. Keep this up to breeze through to exams."
                                        ) : currentPercentage >= 75 ? (
                                            "Caution. You're in the Condonation Zone. You might need to pay a fee or provide medical certificates."
                                        ) : (
                                            "Critical Alert! You are in the Detention Zone. Immediate attendance is required to recover."
                                        )}
                                    </p>

                                    <div className="mt-6 pt-6 border-t border-slate-100 space-y-3">
                                        {currentPercentage >= 85 ? (
                                            <>
                                                <div className="flex justify-between items-center text-sm font-bold">
                                                    <span className="text-slate-500">Safe to skip (maintaining 85%)</span>
                                                    <span className="text-emerald-600 bg-emerald-50 px-3 py-1 rounded-lg">{Math.floor((parseInt(attendedClasses) - 0.85 * parseInt(totalClasses)) / 0.85)} Classes</span>
                                                </div>
                                                <div className="flex justify-between items-center text-sm font-bold">
                                                    <span className="text-slate-500">Safe to skip (maintaining 75%)</span>
                                                    <span className="text-emerald-600 bg-emerald-50 px-3 py-1 rounded-lg">{Math.floor((parseInt(attendedClasses) - 0.75 * parseInt(totalClasses)) / 0.75)} Classes</span>
                                                </div>
                                            </>
                                        ) : currentPercentage >= 75 ? (
                                            <>
                                                <div className="flex justify-between items-center text-sm font-bold">
                                                    <span className="text-slate-500">To reach Safe Zone (85%)</span>
                                                    <span className="text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg">{classesNeeded85} Classes</span>
                                                </div>
                                                <div className="flex justify-between items-center text-sm font-bold">
                                                    <span className="text-slate-500">Safe to skip (maintaining 75%)</span>
                                                    <span className="text-emerald-600 bg-emerald-50 px-3 py-1 rounded-lg">{Math.floor((parseInt(attendedClasses) - 0.75 * parseInt(totalClasses)) / 0.75)} Classes</span>
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <div className="flex justify-between items-center text-sm font-bold">
                                                    <span className="text-slate-500">To reach Safe Zone (85%)</span>
                                                    <span className="text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg">{classesNeeded85} Classes</span>
                                                </div>
                                                <div className="flex justify-between items-center text-sm font-bold">
                                                    <span className="text-slate-500">To reach Condonation (75%)</span>
                                                    <span className="text-amber-600 bg-amber-50 px-3 py-1 rounded-lg">{classesNeeded65} Classes</span>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </ThreeDCard>
                        </div>

                        {/* Projected Status */}
                        {projectedPercentage !== null && (
                            <ThreeDCard className="w-full">
                                <div className={`p-8 rounded-[2.5rem] border shadow-lg relative overflow-hidden flex items-center justify-between gap-6 ${getStatusInfo(projectedPercentage).bg} ${getStatusInfo(projectedPercentage).border}`}>
                                    <div>
                                        <div className="flex items-center gap-2 mb-2 text-slate-800/70 font-bold uppercase tracking-wide text-xs">
                                            <LineChart className="w-4 h-4" />
                                            <span>Projected Outcome (After {projectedAbsences} Absences)</span>
                                        </div>
                                        <div className="flex items-baseline gap-4">
                                            <h2 className={`text-5xl font-black ${getStatusInfo(projectedPercentage).color}`}>
                                                {projectedPercentage}%
                                            </h2>
                                            <span className={`text-lg font-bold ${getStatusInfo(projectedPercentage).color}`}>
                                                {getStatusInfo(projectedPercentage).label}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="hidden sm:block">
                                        {/* Mini Graph Decoration */}
                                        <div className="flex items-end gap-1 h-16 opacity-50">
                                            <div className={`w-3 h-[40%] rounded-t-sm ${getStatusInfo(projectedPercentage).bar}`} />
                                            <div className={`w-3 h-[60%] rounded-t-sm ${getStatusInfo(projectedPercentage).bar}`} />
                                            <div className={`w-3 h-[30%] rounded-t-sm ${getStatusInfo(projectedPercentage).bar}`} />
                                            <div className={`w-3 h-[80%] rounded-t-sm ${getStatusInfo(projectedPercentage).bar}`} />
                                            <div className={`w-3 h-[100%] rounded-t-sm ${getStatusInfo(projectedPercentage).bar}`} />
                                        </div>
                                    </div>
                                </div>
                            </ThreeDCard>
                        )}
                    </motion.div>
                )}
            </div>
        </div>
    );
};

export default TotalAttendance;
