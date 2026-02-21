import { useState } from 'react';
import { motion } from 'framer-motion';
import { Calculator, RotateCcw } from 'lucide-react';

const SubjectAttendance = () => {
    const [totalClasses, setTotalClasses] = useState('');
    const [attendedClasses, setAttendedClasses] = useState('');
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');

    // Animation variants
    const fadeInUp = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
    };

    const calculateAttendance = () => {
        setError('');
        setResult(null);

        const total = parseInt(totalClasses);
        const attended = parseInt(attendedClasses);

        if (!totalClasses || !attendedClasses) {
            setError('Please enter both values.');
            return;
        }

        if (isNaN(total) || isNaN(attended)) {
            setError('Please enter valid numbers.');
            return;
        }

        if (total <= 0) {
            setError('Total classes must be greater than 0.');
            return;
        }

        if (attended < 0) {
            setError('Attended classes cannot be negative.');
            return;
        }

        if (attended > total) {
            setError('Attended classes cannot be more than total classes.');
            return;
        }

        const percentage = (attended / total) * 100;
        setResult(percentage.toFixed(2));
    };

    const resetFields = () => {
        setTotalClasses('');
        setAttendedClasses('');
        setResult(null);
        setError('');
    };

    return (
        <div className="min-h-[calc(100vh-5rem)] bg-slate-100 py-12 px-4 sm:px-6 lg:px-8 flex flex-col items-center">

            {/* Header - Gradient Blue (Middle Theme) */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-6 px-6 rounded-t-2xl shadow-lg mb-0 text-left relative overflow-hidden"
            >
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl transform translate-x-1/2 -translate-y-1/2" />
                <h1 className="text-2xl font-bold tracking-wider leading-tight relative z-10">
                    SUBJECT <br />
                    <span className="border-b-2 border-white/50 pb-1">ATTENDANCE</span>
                </h1>
            </motion.div>

            <motion.div
                initial="hidden"
                animate="visible"
                variants={fadeInUp}
                className="w-full max-w-2xl bg-white rounded-b-2xl shadow-xl border border-slate-200 p-8"
            >
                <div className="text-center mb-8">
                    <h2 className="text-3xl font-bold text-slate-800">Simple Attendance Calculator</h2>
                    <p className="text-slate-500 mt-2">Calculate your attendance percentage instantly</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    <div className="flex flex-col gap-2 text-left">
                        <label className="text-sm font-semibold text-slate-600">Total Number of Classes</label>
                        <input
                            type="number"
                            placeholder="Enter total classes"
                            value={totalClasses}
                            onChange={(e) => setTotalClasses(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-slate-700 font-medium bg-slate-50"
                        />
                    </div>
                    <div className="flex flex-col gap-2 text-left">
                        <label className="text-sm font-semibold text-slate-600">Classes Attended</label>
                        <input
                            type="number"
                            placeholder="Enter attended classes"
                            value={attendedClasses}
                            onChange={(e) => setAttendedClasses(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-slate-700 font-medium bg-slate-50"
                        />
                    </div>
                </div>

                {error && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="mb-6 p-4 bg-red-50 border border-red-100 text-red-700 rounded-xl text-sm font-bold text-center flex items-center justify-center gap-2"
                    >
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                        {error}
                    </motion.div>
                )}

                {result !== null && (() => {
                    const total = parseInt(totalClasses);
                    const attended = parseInt(attendedClasses);
                    let projectionText = "";
                    let projectionColor = "";

                    if (total === 0) {
                        projectionText = "No classes conducted yet";
                        projectionColor = "text-slate-500 bg-slate-100";
                    } else if (parseFloat(result) < 75) {
                        const needed = Math.ceil((0.75 * total - attended) / 0.25);
                        projectionText = `Attend next ${needed} ${needed === 1 ? 'class' : 'classes'} to reach 75%`;
                        projectionColor = "text-red-700 bg-red-100/50";
                    } else {
                        const bunkable = Math.floor((attended - 0.75 * total) / 0.75);
                        if (bunkable > 0) {
                            projectionText = `Safe to skip next ${bunkable} ${bunkable === 1 ? 'class' : 'classes'}`;
                            projectionColor = "text-emerald-700 bg-emerald-100/50";
                        } else {
                            projectionText = "On Track, don't skip the next class";
                            projectionColor = "text-amber-700 bg-amber-100/50";
                        }
                    }

                    return (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className={`mb-8 p-6 rounded-2xl text-center border ${parseFloat(result) >= 75 ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-red-50 border-red-100 text-red-800'}`}
                        >
                            <p className="text-xs font-bold uppercase tracking-wider opacity-70 mb-2">Your Attendance Score</p>
                            <p className="text-6xl font-black tracking-tight">{result}%</p>
                            <div className="mt-4 flex flex-col items-center gap-2">
                                <p className="text-sm font-semibold px-4 py-1.5 bg-white/60 rounded-full inline-block shadow-sm">
                                    {parseFloat(result) >= 75 ? '🎉 Safe Zone' : '⚠️ Warning: Below 75%'}
                                </p>
                                <p className={`text-sm font-bold px-4 py-1.5 rounded-full inline-block ${projectionColor}`}>
                                    {projectionText}
                                </p>
                            </div>
                        </motion.div>
                    );
                })()}

                <div className="flex flex-col sm:flex-row gap-4 justify-start">
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={calculateAttendance}
                        className="flex-1 sm:flex-none px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-2"
                    >
                        <Calculator className="w-5 h-5" />
                        Calculate
                    </motion.button>

                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={resetFields}
                        className="flex-1 sm:flex-none px-8 py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl shadow-sm transition-all flex items-center justify-center gap-2"
                    >
                        <RotateCcw className="w-5 h-5" />
                        Reset
                    </motion.button>
                </div>
            </motion.div>
        </div>
    );
};

export default SubjectAttendance;
