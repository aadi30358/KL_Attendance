import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Download, RotateCcw, History, ArrowLeft, ArrowRight, Star, CheckCircle, Calculator, Flame, Clock } from 'lucide-react';
import jsPDF from 'jspdf';
import { cn } from '../lib/utils';
import Confetti from 'react-confetti';


const LTPSCalculator = () => {
    const [subject, setSubject] = useState('');
    const [classData, setClassData] = useState({
        lect: { att: '', cond: '' },
        tut: { att: '', cond: '' },
        pract: { att: '', cond: '' },
        skill: { att: '', cond: '' }
    });
    const [attendancePercentage, setAttendancePercentage] = useState('');
    const [exactPercentage, setExactPercentage] = useState(null);
    const [errorMessage, setErrorMessage] = useState('');
    const [analysis, setAnalysis] = useState(null);
    const [history, setHistory] = useState([]);
    const [showHistory, setShowHistory] = useState(false);
    const [currentHistoryPage, setCurrentHistoryPage] = useState(0);
    const [showConfetti, setShowConfetti] = useState(false);
    const [bunkSim, setBunkSim] = useState({ lect: 0, tut: 0, pract: 0, skill: 0 });
    const [windowSize, setWindowSize] = useState({
        width: window.innerWidth,
        height: window.innerHeight,
    });

    const bunkProjection = useMemo(() => {
        let currentAttW = 0;
        let currentCondW = 0;
        const comps = [
            { k: 'lect', w: 100 },
            { k: 'tut', w: 100 },
            { k: 'pract', w: 50 },
            { k: 'skill', w: 25 }
        ];

        let totalBunks = 0;
        let extraCondW = 0;

        comps.forEach(({ k, w }) => {
            const c = parseInt(classData[k]?.cond, 10) || 0;
            const a = parseInt(classData[k]?.att, 10) || 0;
            const b = parseInt(bunkSim[k], 10) || 0;

            if (c > 0) {
                currentAttW += a * w;
                currentCondW += c * w;
            }
            if (b > 0) {
                totalBunks += b;
                extraCondW += b * w;
            }
        });

        if (currentCondW === 0) return null;

        const currentPct = (currentAttW / currentCondW) * 100;
        const newCondW = currentCondW + extraCondW;
        const newPct = (currentAttW / newCondW) * 100;

        const currentCeil = Math.ceil(currentPct);
        const newCeil = Math.ceil(newPct);
        const drop = parseFloat((currentPct - newPct).toFixed(2));

        return {
            currentCeil,
            newCeil,
            newExact: parseFloat(newPct.toFixed(2)),
            drop,
            totalBunks,
            isSafe: newCeil >= 85,
            isWarning: newCeil >= 75 && newCeil < 85,
            isDanger: newCeil < 75
        };
    }, [classData, bunkSim]);

    useEffect(() => {
        const handleResize = () => {
            setWindowSize({
                width: window.innerWidth,
                height: window.innerHeight,
            });
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Official KL University ERP Component Weights
    // L: 1.0 (100%), T: 1.0 (100%), P: 0.5 (50%), S: 0.25 (25%)
    const weights = {
        lecture: 100,
        tutorial: 100,
        practical: 50,
        skill: 25
    };

    const ITEMS_PER_PAGE = windowSize.width > 768 ? 6 : 3;
    const totalPages = Math.ceil(history.length / ITEMS_PER_PAGE);

    const getAttendanceStatus = (percentage) => {
        if (percentage >= 85) return 'Excellent';
        if (percentage >= 75) return 'Good';
        if (percentage >= 65) return 'Average';
        return 'Needs Improvement';
    };

    const getRecommendation = (percentage) => {
        let recommendations = [];

        if (percentage < 85) {
            const improvement = (85 - percentage).toFixed(2);
            recommendations.push(`Need ${improvement}% improvement to reach excellence`);
            recommendations.push(`Focus on consistent attendance to improve by ${(improvement / 30).toFixed(1)}% per week`);
        } else {
            recommendations.push("Keep up the excellent work!");
        }

        const enteredComponents = [];
        const comps = [
            { name: 'Lecture', att: classData.lect.att, cond: classData.lect.cond },
            { name: 'Tutorial', att: classData.tut.att, cond: classData.tut.cond },
            { name: 'Practical', att: classData.pract.att, cond: classData.pract.cond },
            { name: 'Skill', att: classData.skill.att, cond: classData.skill.cond }
        ];

        comps.forEach(c => {
            if (c.cond !== '' && parseInt(c.cond, 10) > 0) {
                const pct = (parseInt(c.att || 0, 10) / parseInt(c.cond, 10)) * 100;
                enteredComponents.push({ name: c.name, value: pct });
            }
        });

        enteredComponents.sort((a, b) => a.value - b.value);

        enteredComponents.forEach(comp => {
            if (comp.value < 75) {
                recommendations.push(`${comp.name} attendance is critical at ${comp.value.toFixed(1)}% - needs immediate attention`);
                recommendations.push(`Aim to attend next 5 ${comp.name} sessions consistently`);
            }
        });

        return recommendations;
    };

    const handleClassChange = (comp, field) => (event) => {
        const val = event.target.value;
        setClassData(prev => ({
            ...prev,
            [comp]: {
                ...prev[comp],
                [field]: val
            }
        }));
        setErrorMessage('');
    };

    const resetForm = () => {
        setSubject('');
        setClassData({
            lect: { att: '', cond: '' },
            tut: { att: '', cond: '' },
            pract: { att: '', cond: '' },
            skill: { att: '', cond: '' }
        });
        setAttendancePercentage('');
        setExactPercentage(null);
        setErrorMessage('');
        setAnalysis(null);
        setShowConfetti(false);
        setBunkSim({ lect: 0, tut: 0, pract: 0, skill: 0 });
    };

    const generatePDF = () => {
        const doc = new jsPDF();

        doc.setFontSize(24);
        doc.setTextColor(165, 28, 36);
        doc.text('Attendance Report', 20, 20);

        doc.setFontSize(14);
        doc.setTextColor(0, 0, 0);
        if (subject) {
            doc.text(`Subject: ${subject}`, 20, 40);
        }
        const pctText = exactPercentage ? `${attendancePercentage}% (Exact: ${exactPercentage}%)` : `${attendancePercentage}%`;
        doc.text(`Overall Attendance: ${pctText}`, 20, 50);
        doc.text(`Status: ${analysis.status}`, 20, 60);

        doc.setFontSize(16);
        doc.setTextColor(165, 28, 36);
        doc.text('Component Analysis:', 20, 80);
        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);
        analysis.componentAnalysis.forEach((item, index) => {
            doc.text(`• ${item}`, 25, 95 + (index * 10));
        });

        doc.setFontSize(16);
        doc.setTextColor(165, 28, 36);
        doc.text('Recommendations:', 20, 140);
        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);
        analysis.recommendations.forEach((item, index) => {
            doc.text(`• ${item}`, 25, 155 + (index * 10));
        });

        doc.setFontSize(10);
        doc.setTextColor(128, 128, 128);
        doc.text('Generated by KLU Attendance Tracker', 20, 280);
        doc.text(new Date().toLocaleString(), 20, 285);

        doc.save('attendance-report.pdf');
    };

    const calculateTotal = () => {
        const comps = [
            { id: 'lect', name: 'Lecture (L)', att: classData.lect.att, cond: classData.lect.cond, weight: weights.lecture / 100 },
            { id: 'tut', name: 'Tutorial / Theory (T)', att: classData.tut.att, cond: classData.tut.cond, weight: weights.tutorial / 100 },
            { id: 'pract', name: 'Practical (P)', att: classData.pract.att, cond: classData.pract.cond, weight: weights.practical / 100 },
            { id: 'skill', name: 'Skill (S)', att: classData.skill.att, cond: classData.skill.cond, weight: weights.skill / 100 }
        ];

        let totalWeightedAttended = 0;
        let totalWeightedConducted = 0;
        let hasValidInput = false;

        for (const comp of comps) {
            if (comp.cond !== '' || comp.att !== '') {
                hasValidInput = true;
                const cond = parseInt(comp.cond, 10) || 0;
                const att = parseInt(comp.att, 10) || 0;

                if (cond < 0 || att < 0) {
                    setErrorMessage(`Classes cannot be negative for ${comp.name}`);
                    return;
                }
                if (att > cond) {
                    setErrorMessage(`Attended classes (${att}) cannot exceed conducted (${cond}) for ${comp.name}`);
                    return;
                }

                totalWeightedConducted += cond * comp.weight;
                totalWeightedAttended += att * comp.weight;
            }
        }

        if (!hasValidInput || totalWeightedConducted === 0) {
            setErrorMessage('Please enter conducted and attended classes for at least one component');
            return;
        }

        const rawPct = (totalWeightedAttended / totalWeightedConducted) * 100;
        const exact = parseFloat(rawPct.toFixed(2));
        const ceilPct = Math.ceil(rawPct);

        setExactPercentage(exact);
        setAttendancePercentage(ceilPct);
        setErrorMessage('');

        const componentAnalysis = [];
        comps.forEach(comp => {
            if (comp.cond !== '') {
                const cond = parseInt(comp.cond, 10) || 0;
                const att = parseInt(comp.att, 10) || 0;
                const compPct = cond > 0 ? parseFloat(((att / cond) * 100).toFixed(2)) : 0;
                if (compPct >= 85) {
                    componentAnalysis.push(`${comp.name}: Excellent (${att}/${cond} · ${compPct}%) ⭐⭐⭐`);
                } else if (compPct >= 75) {
                    componentAnalysis.push(`${comp.name}: Good (${att}/${cond} · ${compPct}%) ⭐⭐`);
                } else {
                    componentAnalysis.push(`${comp.name}: Needs improvement (${att}/${cond} · ${compPct}%) ⭐`);
                }
            }
        });

        const newAnalysis = {
            status: getAttendanceStatus(ceilPct),
            componentAnalysis,
            recommendations: getRecommendation(ceilPct)
        };
        setAnalysis(newAnalysis);

        if (parseFloat(ceilPct) >= 85) {
            setShowConfetti(true);
            setTimeout(() => setShowConfetti(false), 5000);
        }

        setHistory(prev => [{
            subject,
            percentage: exact,
            erpCeil: ceilPct,
            timestamp: new Date().toLocaleString(),
            components: {
                lect: classData.lect.cond ? `${classData.lect.att}/${classData.lect.cond}` : null,
                tut: classData.tut.cond ? `${classData.tut.att}/${classData.tut.cond}` : null,
                pract: classData.pract.cond ? `${classData.pract.att}/${classData.pract.cond}` : null,
                skill: classData.skill.cond ? `${classData.skill.att}/${classData.skill.cond}` : null,
            },
            status: newAnalysis.status
        }, ...prev]);
    };

    const resultRef = useRef(null);
    useEffect(() => {
        if (attendancePercentage && analysis && resultRef.current) {
            resultRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [attendancePercentage, analysis]);

    return (
        <motion.div
            className="min-h-screen bg-slate-100 py-12 px-4 sm:px-6 lg:px-8 relative"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
        >
            {showConfetti && <Confetti width={windowSize.width} height={windowSize.height} recycle={false} />}

            <div className="max-w-4xl mx-auto space-y-8 relative z-10">
                <div className="text-center">
                    <motion.h1
                        className="text-3xl font-bold text-slate-900 flex items-center justify-center gap-3"
                        initial={{ scale: 0.9 }}
                        animate={{ scale: 1 }}
                        transition={{ duration: 0.5 }}
                    >
                        <Calculator className="w-8 h-8 text-blue-600" />
                        L-T-P-S Calculator
                    </motion.h1>
                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="mt-2 text-slate-600"
                    >
                        Advanced Academic Performance Analytics
                    </motion.p>
                </div>

                <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/60 p-6 md:p-8">
                    <div className="flex justify-end mb-6">
                        <motion.button
                            className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
                            onClick={() => setShowHistory(!showHistory)}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                        >
                            <History className="w-4 h-4" /> {showHistory ? 'Hide History' : 'Show History'}
                        </motion.button>
                    </div>

                    <AnimatePresence>
                        {showHistory && history.length > 0 && (
                            <motion.div
                                className="mb-8 p-4 bg-slate-50 rounded-xl border border-slate-100"
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                            >
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="font-semibold text-slate-700">Calculation History</h3>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setCurrentHistoryPage(p => Math.max(0, p - 1))}
                                            disabled={currentHistoryPage === 0}
                                            className="p-1 hover:bg-slate-200 rounded disabled:opacity-50"
                                        >
                                            <ArrowLeft className="w-4 h-4" />
                                        </button>
                                        <span className="text-sm text-slate-500">{currentHistoryPage + 1} / {totalPages}</span>
                                        <button
                                            onClick={() => setCurrentHistoryPage(p => Math.min(totalPages - 1, p + 1))}
                                            disabled={currentHistoryPage === totalPages - 1}
                                            className="p-1 hover:bg-slate-200 rounded disabled:opacity-50"
                                        >
                                            <ArrowRight className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    {history.slice(currentHistoryPage * ITEMS_PER_PAGE, (currentHistoryPage + 1) * ITEMS_PER_PAGE).map((entry, i) => (
                                        <div key={i} className="flex flex-col sm:flex-row justify-between items-center text-sm p-3 bg-white border border-slate-100 rounded-lg shadow-sm">
                                            <div className="flex flex-col">
                                                <span className="font-medium text-slate-800">{entry.subject || 'Unnamed Subject'}</span>
                                                <span className="text-xs text-slate-400">{entry.timestamp}</span>
                                            </div>
                                            <div className="flex items-center gap-2 mt-2 sm:mt-0">
                                                <Star className="w-4 h-4 text-yellow-400 fill-current" />
                                                <span className="font-bold text-slate-700">{entry.percentage}%</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <motion.div className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">Subject Name (Optional)</label>
                            <input
                                type="text"
                                value={subject}
                                onChange={(e) => setSubject(e.target.value)}
                                placeholder="e.g. SOA PROGRAMMING AND MICROSERVICES"
                                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            {[
                                { id: 'lect', label: 'Lecture (L)', weight: weights.lecture },
                                { id: 'tut', label: 'Tutorial / Theory (T)', weight: weights.tutorial },
                                { id: 'pract', label: 'Practical (P)', weight: weights.practical },
                                { id: 'skill', label: 'Skill (S)', weight: weights.skill }
                            ].map((comp, idx) => (
                                <motion.div
                                    key={comp.id}
                                    className="p-4 rounded-2xl border border-slate-200/80 bg-slate-50/60 space-y-2.5"
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: idx * 0.05 }}
                                >
                                    <div className="flex justify-between items-center">
                                        <label className="text-sm font-bold text-slate-800">{comp.label}</label>
                                        <span className="text-[11px] font-semibold bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full border border-blue-100">
                                            Weight: {comp.weight}%
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <span className="text-[11px] font-bold text-slate-400 block mb-1 uppercase tracking-wider">Attended</span>
                                            <input
                                                type="number"
                                                min="0"
                                                value={classData[comp.id].att}
                                                onChange={handleClassChange(comp.id, 'att')}
                                                placeholder="e.g. 16"
                                                className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-semibold text-slate-800"
                                            />
                                        </div>
                                        <div>
                                            <span className="text-[11px] font-bold text-slate-400 block mb-1 uppercase tracking-wider">Conducted</span>
                                            <input
                                                type="number"
                                                min="0"
                                                value={classData[comp.id].cond}
                                                onChange={handleClassChange(comp.id, 'cond')}
                                                placeholder="e.g. 16"
                                                className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-semibold text-slate-800"
                                            />
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>

                    <div className="mt-8 flex gap-4">
                        <motion.button
                            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
                            onClick={calculateTotal}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                        >
                            <Calculator className="w-5 h-5" /> Calculate
                        </motion.button>
                        <motion.button
                            className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-3 px-6 rounded-xl transition-all flex items-center justify-center gap-2"
                            onClick={resetForm}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                        >
                            <RotateCcw className="w-5 h-5" /> Reset
                        </motion.button>
                    </div>

                    <AnimatePresence>
                        {errorMessage && (
                            <motion.div
                                className="mt-4 p-4 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100 flex items-center gap-2"
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                            >
                                <div className="w-2 h-2 rounded-full bg-red-500" />
                                {errorMessage}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <AnimatePresence>
                        {attendancePercentage && analysis && (
                            <div ref={resultRef}>
                                <motion.div
                                    className={cn(
                                        "mt-8 p-6 rounded-2xl border text-center relative overflow-hidden",
                                        parseFloat(attendancePercentage) >= 75 ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-800"
                                    )}
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                >
                                    <div className="relative z-10">
                                        <div className="flex items-center justify-center gap-3 mb-2">
                                            {parseFloat(attendancePercentage) >= 75 && <CheckCircle className="w-6 h-6" />}
                                            <span className="text-lg font-semibold uppercase tracking-wider">{subject || 'Attendance Status'}</span>
                                        </div>
                                        <div className="text-6xl font-extrabold mb-1">
                                            {exactPercentage !== null ? `${exactPercentage}%` : `${attendancePercentage}%`}
                                        </div>
                                        {exactPercentage !== null && exactPercentage !== attendancePercentage && (
                                            <div className="text-xs sm:text-sm font-semibold opacity-85 mb-3">
                                                Exact: <span className="font-bold">{exactPercentage}%</span> · Official ERP Report: <span className="font-bold">{attendancePercentage}%</span>
                                            </div>
                                        )}
                                        <div className="inline-block px-4 py-1.5 bg-white/50 backdrop-blur rounded-full text-sm font-bold">
                                            {analysis.status}
                                        </div>
                                    </div>
                                </motion.div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                                    <motion.div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm" initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.2 }}>
                                        <h3 className="font-bold text-slate-800 mb-4 border-b pb-2">Component Analysis</h3>
                                        <div className="space-y-2">
                                            {analysis.componentAnalysis.map((item, idx) => (
                                                <p key={idx} className="text-sm text-slate-600 flex items-center gap-2">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                                    {item}
                                                </p>
                                            ))}
                                        </div>
                                    </motion.div>

                                    <motion.div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm" initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.3 }}>
                                        <h3 className="font-bold text-slate-800 mb-4 border-b pb-2">Recommendations</h3>
                                        <div className="space-y-2">
                                            {analysis.recommendations.map((item, idx) => (
                                                <p key={idx} className="text-sm text-slate-600 flex items-center gap-2">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                                    {item}
                                                </p>
                                            ))}
                                        </div>
                                    </motion.div>
                                </div>

                                {/* Interactive Bunk Simulator Section */}
                                <motion.div 
                                    className="bg-white rounded-2xl p-6 border-2 border-slate-900 shadow-md mt-6 space-y-4"
                                    initial={{ y: 20, opacity: 0 }} 
                                    animate={{ y: 0, opacity: 1 }} 
                                    transition={{ delay: 0.35 }}
                                >
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                                        <div className="flex items-center gap-2">
                                            <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                                                <Flame className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <h3 className="font-extrabold text-slate-900 text-base">Quick Bunk Simulation</h3>
                                                <p className="text-xs text-slate-400 font-medium">Test what happens if you skip upcoming classes in this subject</p>
                                            </div>
                                        </div>
                                        <Link 
                                            to="/bunk-simulator" 
                                            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 self-start sm:self-auto flex items-center gap-1"
                                        >
                                            <span>Full Simulator</span>
                                            <ArrowRight className="w-3.5 h-3.5" />
                                        </Link>
                                    </div>

                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                        {[
                                            { id: 'lect', name: 'Lecture', weight: '100%' },
                                            { id: 'tut', name: 'Tutorial', weight: '100%' },
                                            { id: 'pract', name: 'Practical', weight: '50%' },
                                            { id: 'skill', name: 'Skill', weight: '25%' }
                                        ].map(c => {
                                            const condVal = parseInt(classData[c.id]?.cond, 10) || 0;
                                            return (
                                                <div key={c.id} className={`p-3 rounded-xl border ${condVal > 0 ? 'bg-slate-50 border-slate-200' : 'bg-slate-50/50 border-slate-100 opacity-60'}`}>
                                                    <div className="flex justify-between items-center mb-1.5">
                                                        <span className="text-[11px] font-bold text-slate-700">{c.name}</span>
                                                        <span className="text-[9px] font-mono text-slate-400">{c.weight}</span>
                                                    </div>
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[10px] text-slate-500 font-semibold">Bunk:</span>
                                                        <div className="flex items-center gap-1">
                                                            <button
                                                                type="button"
                                                                disabled={condVal <= 0}
                                                                onClick={() => setBunkSim(prev => ({ ...prev, [c.id]: Math.max(0, (prev[c.id] || 0) - 1) }))}
                                                                className={`w-6 h-6 rounded border font-bold text-xs flex items-center justify-center ${
                                                                    condVal <= 0
                                                                        ? 'bg-slate-100 border-slate-200 text-slate-300 cursor-not-allowed'
                                                                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                                                                }`}
                                                            >
                                                                -
                                                            </button>
                                                            <span className={`w-6 text-center font-bold text-xs font-mono ${condVal <= 0 ? 'text-slate-300' : 'text-rose-600'}`}>
                                                                {condVal <= 0 ? 0 : (bunkSim[c.id] || 0)}
                                                            </span>
                                                            <button
                                                                type="button"
                                                                disabled={condVal <= 0}
                                                                onClick={() => setBunkSim(prev => ({ ...prev, [c.id]: (prev[c.id] || 0) + 1 }))}
                                                                className={`w-6 h-6 rounded border font-bold text-xs flex items-center justify-center ${
                                                                    condVal <= 0
                                                                        ? 'bg-slate-100 border-slate-200 text-slate-300 cursor-not-allowed'
                                                                        : 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100'
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

                                    {/* Duration Note */}
                                    <div className="p-3.5 rounded-2xl bg-amber-50/90 border border-amber-200/90 flex items-start gap-3 text-xs text-amber-900 shadow-2xs">
                                        <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                        <div className="space-y-1.5 flex-1">
                                            <p className="font-bold text-amber-950">
                                                Period Duration & Weightage Guide:
                                            </p>
                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                                                <div className="bg-white/95 border border-amber-200 p-2 rounded-xl text-center">
                                                    <span className="text-[10px] text-slate-500 font-bold block uppercase">Lecture (L)</span>
                                                    <span className="font-mono font-black text-amber-950 text-xs">50 mins (100%)</span>
                                                </div>
                                                <div className="bg-white/95 border border-amber-200 p-2 rounded-xl text-center">
                                                    <span className="text-[10px] text-slate-500 font-bold block uppercase">Tutorial (T)</span>
                                                    <span className="font-mono font-black text-amber-950 text-xs">50 mins (100%)</span>
                                                </div>
                                                <div className="bg-white/95 border border-amber-200 p-2 rounded-xl text-center">
                                                    <span className="text-[10px] text-slate-500 font-bold block uppercase">Practical (P)</span>
                                                    <span className="font-mono font-black text-amber-950 text-xs">1.50 (50%)</span>
                                                </div>
                                                <div className="bg-white/95 border border-amber-200 p-2 rounded-xl text-center">
                                                    <span className="text-[10px] text-slate-500 font-bold block uppercase">Skill (S)</span>
                                                    <span className="font-mono font-black text-amber-950 text-xs">1.50 (25%)</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {bunkProjection && bunkProjection.totalBunks > 0 && (
                                        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                                            <div className="flex items-center gap-2.5">
                                                <span className={`px-2.5 py-1 rounded-full text-xs font-black uppercase ${bunkProjection.isSafe ? 'bg-emerald-100 text-emerald-800' : bunkProjection.isWarning ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'}`}>
                                                    {bunkProjection.isSafe ? 'Safe Zone' : bunkProjection.isWarning ? 'Condonation' : 'Detained'}
                                                </span>
                                                <span className="text-xs font-medium text-slate-600">
                                                    After {bunkProjection.totalBunks} bunk{bunkProjection.totalBunks > 1 ? 's' : ''}:
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="text-xl font-black text-slate-900">
                                                    {bunkProjection.newCeil}%
                                                </span>
                                                <span className="text-xs font-bold text-rose-600 font-mono">
                                                    (-{bunkProjection.drop}%)
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </motion.div>

                                <motion.div className="mt-6 flex justify-center" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.4 }}>
                                    <button
                                        onClick={generatePDF}
                                        className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-1"
                                    >
                                        <Download className="w-5 h-5" /> Download Report PDF
                                    </button>
                                </motion.div>
                            </div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </motion.div>
    );
};

export default LTPSCalculator;
