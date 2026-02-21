import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, RotateCcw, History, ArrowLeft, ArrowRight, Star, CheckCircle, Calculator, ExternalLink, Copy } from 'lucide-react';
import jsPDF from 'jspdf';
import { cn } from '../lib/utils';
import Confetti from 'react-confetti';
import { doc, getDoc } from "firebase/firestore";
import { db } from '../firebase';

const LTPSCalculator = () => {
    const [subject, setSubject] = useState('');
    const [lect, setLect] = useState('');
    const [tut, setTut] = useState('');
    const [pract, setPract] = useState('');
    const [skill, setSkill] = useState('');
    const [attendancePercentage, setAttendancePercentage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [analysis, setAnalysis] = useState(null);
    const [history, setHistory] = useState([]);
    const [showHistory, setShowHistory] = useState(false);
    const [currentHistoryPage, setCurrentHistoryPage] = useState(0);
    const [showConfetti, setShowConfetti] = useState(false);
    const [windowSize, setWindowSize] = useState({
        width: window.innerWidth,
        height: window.innerHeight,
    });

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

    const [weights, setWeights] = useState({
        lecture: 100,
        tutorial: 25,
        practical: 50,
        skilling: 25
    });

    useEffect(() => {
        const fetchWeights = async () => {
            try {
                const docSnap = await getDoc(doc(db, "config", "weights"));
                if (docSnap.exists()) {
                    setWeights(docSnap.data());
                }
            } catch (e) {
                console.error("Failed to load custom weights from Firebase", e);
            }
        };
        fetchWeights();
    }, []);

    const ITEMS_PER_PAGE = windowSize.width > 768 ? 6 : 3;
    const totalPages = Math.ceil(history.length / ITEMS_PER_PAGE);

    const getAttendanceStatus = (percentage) => {
        if (percentage >= 85) return 'Excellent';
        if (percentage >= 75) return 'Good';
        if (percentage >= 65) return 'Average';
        return 'Needs Improvement';
    };

    const getComponentAnalysis = () => {
        const analysis = [];
        const enteredComponents = {
            Lecture: lect !== '' ? parseFloat(lect) : null,
            Tutorial: tut !== '' ? parseFloat(tut) : null,
            Practical: pract !== '' ? parseFloat(pract) : null,
            Skilling: skill !== '' ? parseFloat(skill) : null
        };

        Object.entries(enteredComponents).forEach(([component, value]) => {
            if (value !== null) {
                if (value >= 85) {
                    analysis.push(`${component}: Excellent (${value}%) ⭐⭐⭐`);
                } else if (value >= 75) {
                    analysis.push(`${component}: Good (${value}%) ⭐⭐`);
                } else {
                    analysis.push(`${component}: Needs improvement (${value}%) ⭐`);
                }
            }
        });

        return analysis;
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
        if (lect !== '') enteredComponents.push({ name: 'Lecture', value: parseFloat(lect) });
        if (tut !== '') enteredComponents.push({ name: 'Tutorial', value: parseFloat(tut) });
        if (pract !== '') enteredComponents.push({ name: 'Practical', value: parseFloat(pract) });
        if (skill !== '') enteredComponents.push({ name: 'Skilling', value: parseFloat(skill) });

        enteredComponents.sort((a, b) => a.value - b.value);

        enteredComponents.forEach(comp => {
            if (comp.value < 75) {
                recommendations.push(`${comp.name} attendance is critical at ${comp.value}% - needs immediate attention`);
                recommendations.push(`Aim to attend next 5 ${comp.name} sessions consistently`);
            }
        });

        return recommendations;
    };

    const handleInputChange = (setter) => (event) => {
        const value = event.target.value;
        if (value === '' || (parseFloat(value) >= 0 && parseFloat(value) <= 100)) {
            setter(value);
            setErrorMessage('');
        } else {
            setErrorMessage('Please enter a value between 0 and 100');
        }
    };

    const resetForm = () => {
        setSubject('');
        setLect('');
        setTut('');
        setPract('');
        setSkill('');
        setAttendancePercentage('');
        setErrorMessage('');
        setAnalysis(null);
        setShowConfetti(false);
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
        doc.text(`Overall Attendance: ${attendancePercentage}%`, 20, 50);
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
        let totalWeight = 0;
        let totalScore = 0;

        const components = [
            { value: lect, weight: weights.lecture },
            { value: tut, weight: weights.tutorial },
            { value: pract, weight: weights.practical },
            { value: skill, weight: weights.skilling }
        ];

        let hasValidInput = false;
        components.forEach(comp => {
            if (comp.value !== '') {
                hasValidInput = true;
                if (parseFloat(comp.value) < 0 || parseFloat(comp.value) > 100) {
                    setErrorMessage('Please enter valid percentages between 0 and 100');
                    return;
                }
                totalWeight += comp.weight;
                totalScore += parseFloat(comp.value) * (comp.weight / 100);
            }
        });

        if (!hasValidInput) {
            setErrorMessage('Please enter at least one component');
            return;
        }

        const calculatedPercentage = (totalScore / totalWeight) * 100;
        const roundedPercentage = calculatedPercentage.toFixed(2);

        setAttendancePercentage(roundedPercentage);
        setErrorMessage('');

        const componentValues = {
            lect: parseFloat(lect) || 0,
            tut: parseFloat(tut) || 0,
            pract: parseFloat(pract) || 0,
            skill: parseFloat(skill) || 0
        };

        const newAnalysis = {
            status: getAttendanceStatus(calculatedPercentage),
            componentAnalysis: getComponentAnalysis(),
            recommendations: getRecommendation(calculatedPercentage)
        };

        setAnalysis(newAnalysis);

        if (parseFloat(roundedPercentage) >= 85) {
            setShowConfetti(true);
            setTimeout(() => setShowConfetti(false), 5000);
        }

        setHistory(prev => [{
            subject,
            percentage: roundedPercentage,
            timestamp: new Date().toLocaleString(),
            components: componentValues,
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
            className="min-h-screen bg-slate-100 py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden"
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
                                placeholder="e.g. Mathematics"
                                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {[
                                { label: 'Lecture (L)', value: lect, setter: setLect, weight: 100 },
                                { label: 'Tutorial (T)', value: tut, setter: setTut, weight: 25 },
                                { label: 'Practical (P)', value: pract, setter: setPract, weight: 50 },
                                { label: 'Skilling (S)', value: skill, setter: setSkill, weight: 25 }
                            ].map((input, idx) => (
                                <motion.div key={idx} className="space-y-2" initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: idx * 0.1 }}>
                                    <div className="flex justify-between">
                                        <label className="text-sm font-medium text-slate-700">{input.label}</label>
                                        <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded">Weight: {input.weight}%</span>
                                    </div>
                                    <input
                                        type="number"
                                        value={input.value}
                                        onChange={handleInputChange(input.setter)}
                                        placeholder="0-100"
                                        className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                    />
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
                                        <div className="text-6xl font-extrabold mb-2">{attendancePercentage}%</div>
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

                {/* ERP Quick Access Section */}
                <motion.div
                    className="relative overflow-hidden bg-white/80 backdrop-blur-xl border border-white/60 rounded-3xl p-8 shadow-xl"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                >
                    <div className="relative z-10">
                        <div className="mb-8 flex items-start justify-between">
                            <div>
                                <h3 className="text-2xl font-bold text-slate-900 flex items-center gap-3 mb-2">
                                    <span className="p-2 bg-blue-50 rounded-lg">
                                        <ExternalLink className="w-6 h-6 text-blue-600" />
                                    </span>
                                    Sync with KLU ERP
                                </h3>
                                <p className="text-slate-500 max-w-lg">
                                    For accurate results, copy your exact attendance percentages from the official portal.
                                </p>
                            </div>
                            <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 bg-green-50 border border-green-200 rounded-full text-green-700 text-xs font-bold uppercase tracking-wider">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                Official Link
                            </div>
                        </div>

                        {/* Step-by-Step Guide */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                            {[
                                { step: "1", title: "Open Portal", desc: "Launch new ERP", icon: "🚀" },
                                { step: "2", title: "Login", desc: "Use student ID", icon: "🔐" },
                                { step: "3", title: "Copy Data", desc: "Paste % below", icon: "📋" }
                            ].map((item, idx) => (
                                <div key={idx} className="group bg-slate-50 border border-slate-100 p-4 rounded-2xl hover:bg-blue-50 hover:border-blue-100 transition-colors">
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="text-2xl">{item.icon}</span>
                                        <span className="text-3xl font-bold text-slate-200 group-hover:text-blue-200 transition-colors">{item.step}</span>
                                    </div>
                                    <div className="font-bold text-slate-800">{item.title}</div>
                                    <div className="text-xs text-slate-500">{item.desc}</div>
                                </div>
                            ))}
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col sm:flex-row gap-4">
                            <a
                                href="https://newerp.kluniversity.in/index.php"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-1 group relative px-6 py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-3"
                            >
                                <span>Open KLU ERP</span>
                                <ExternalLink className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </a>

                            <button
                                className="flex-1 px-6 py-4 bg-white border-2 border-slate-100 hover:border-slate-300 text-slate-700 hover:text-slate-900 rounded-xl font-bold transition-all flex items-center justify-center gap-3"
                                onClick={() => {
                                    navigator.clipboard.writeText('https://newerp.kluniversity.in/index.php');
                                    alert('URL copied to clipboard! 📋');
                                }}
                            >
                                <Copy className="w-4 h-4" />
                                <span>Copy Link</span>
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>
        </motion.div>
    );
};

export default LTPSCalculator;
