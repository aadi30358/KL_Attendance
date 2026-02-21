import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calculator, BrainCircuit, Sparkles } from 'lucide-react';
import { useAttendance } from '../context/useAttendance';
import { GoogleGenerativeAI } from "@google/generative-ai";
import SEO from '../components/SEO';
import { APP_CONFIG } from '../config';

const GEMINI_API_KEY = APP_CONFIG.GEMINI_API_KEY;

const Predictor = () => {
    const { attendanceData } = useAttendance();
    const [futureClasses, setFutureClasses] = useState(20);
    const [absencesPlanning, setAbsencesPlanning] = useState(0);
    const [prediction, setPrediction] = useState(null);
    const [aiInsight, setAiInsight] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const calculatePrediction = () => {
            if (!attendanceData) return;
            const currentAttended = attendanceData.attendedClasses;
            const currentTotal = attendanceData.totalClasses;

            const projectedTotal = currentTotal + parseInt(futureClasses);
            const projectedAttended = currentAttended + (parseInt(futureClasses) - parseInt(absencesPlanning));
            const projectedPercentage = ((projectedAttended / projectedTotal) * 100).toFixed(2);

            setPrediction({
                percentage: projectedPercentage,
                status: projectedPercentage >= 85 ? 'Safe' : (projectedPercentage >= 75 ? 'Warning' : 'Danger'),
                attended: projectedAttended,
                total: projectedTotal
            });
        };

        if (attendanceData && attendanceData.totalClasses > 0) {
            calculatePrediction();
        }
    }, [attendanceData, futureClasses, absencesPlanning]);

    const getAIInsight = async () => {
        if (!prediction) return;
        setIsLoading(true);
        try {
            const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

            const prompt = `
                I am a student at KL University. 
                Current Attendance: ${attendanceData.currentPercentage}% (${attendanceData.attendedClasses}/${attendanceData.totalClasses}).
                Prediction for next ${futureClasses} classes with ${absencesPlanning} absences: ${prediction.percentage}%.
                University Rule: 85% is safe, 75%-85% is condonation, <75% is detained.
                Provide a very brief 2-sentence tactical advice as Jarvis.
            `;

            const result = await model.generateContent(prompt);
            setAiInsight(result.response.text());
        } catch {
            setAiInsight("Unable to sync with Jarvis core for insights.");
        }
        setIsLoading(false);
    };

    return (
        <div className="min-h-screen bg-[#FAFAFA] py-12 px-4 sm:px-6 lg:px-8">
            <SEO title="AI Predictor | Jarvis Academic" description="Predict your attendance future with AI-powered analytics." />

            <div className="max-w-4xl mx-auto">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center mb-12"
                >
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 border border-blue-100 mb-4">
                        <BrainCircuit className="w-4 h-4 text-blue-600" />
                        <span className="text-xs font-bold text-blue-600 uppercase tracking-widest">Powered by Jarvis AI</span>
                    </div>
                    <h1 className="text-4xl font-black text-slate-900 mb-4">Attendance Predictor</h1>
                    <p className="text-slate-500 max-w-xl mx-auto font-medium">
                        Model your academic future. Simulate future attendance scenarios and get AI-driven insights to stay in the Safe Zone.
                    </p>
                </motion.div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Controls */}
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="lg:col-span-1 space-y-6"
                    >
                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
                            <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                                <Calculator className="w-5 h-5 text-blue-500" />
                                Simulation
                            </h3>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Future Classes</label>
                                    <input
                                        type="number"
                                        value={futureClasses}
                                        onChange={(e) => setFutureClasses(e.target.value)}
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Planned Absences</label>
                                    <input
                                        type="number"
                                        value={absencesPlanning}
                                        onChange={(e) => setAbsencesPlanning(e.target.value)}
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none transition-all"
                                    />
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={getAIInsight}
                            disabled={isLoading}
                            className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-xl hover:bg-slate-800 transition-all"
                        >
                            {isLoading ? "Consulting Jarvis..." : <><Sparkles className="w-5 h-5 text-amber-400" /> Get AI Insight</>}
                        </button>
                    </motion.div>

                    {/* Results */}
                    <div className="lg:col-span-2 space-y-6">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className={`p-8 rounded-[2.5rem] border-2 shadow-2xl relative overflow-hidden ${prediction?.status === 'Safe' ? 'bg-green-50 border-green-200 text-green-900' :
                                prediction?.status === 'Warning' ? 'bg-amber-50 border-amber-200 text-amber-900' :
                                    'bg-red-50 border-red-200 text-red-900'
                                }`}
                        >
                            <div className="relative z-10">
                                <p className="text-xs font-bold uppercase tracking-widest opacity-60 mb-2">Projected Status</p>
                                <div className="flex items-end gap-4 mb-4">
                                    <h2 className="text-6xl font-black">{prediction?.percentage}%</h2>
                                    <div className="mb-2 px-3 py-1 bg-white/50 rounded-full text-sm font-bold">
                                        {prediction?.status}
                                    </div>
                                </div>
                                <div className="h-2 w-full bg-black/5 rounded-full overflow-hidden mb-6">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${prediction?.percentage}%` }}
                                        className={`h-full ${prediction?.status === 'Safe' ? 'bg-green-500' :
                                            prediction?.status === 'Warning' ? 'bg-amber-500' : 'bg-red-500'
                                            }`}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-white/40 p-4 rounded-2xl">
                                        <p className="text-[10px] font-bold uppercase opacity-60">Calculated Attendance</p>
                                        <p className="text-xl font-black">{prediction?.attended} / {prediction?.total}</p>
                                    </div>
                                    <div className="bg-white/40 p-4 rounded-2xl">
                                        <p className="text-[10px] font-bold uppercase opacity-60">
                                            {prediction?.percentage >= 85 ? "Safe to Skip (85%)" :
                                                prediction?.percentage >= 75 ? "To reach Safe Zone" : "To reach Condonation"}
                                        </p>
                                        <p className="text-xl font-black">
                                            {prediction?.percentage >= 85
                                                ? Math.floor((prediction?.attended - 0.85 * prediction?.total) / 0.85)
                                                : prediction?.percentage >= 75
                                                    ? Math.ceil((0.85 * prediction?.total - prediction?.attended) / 0.15)
                                                    : Math.ceil((0.75 * prediction?.total - prediction?.attended) / 0.25)} Classes
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </motion.div>

                        <AnimatePresence>
                            {aiInsight && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="bg-white p-6 rounded-3xl shadow-lg border border-blue-100 flex gap-4"
                                >
                                    <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shrink-0">
                                        <BrainCircuit className="w-6 h-6 text-white" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-900 mb-1">Jarvis Insight</h4>
                                        <p className="text-sm text-slate-600 leading-relaxed italic">&quot;{aiInsight}&quot;</p>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Predictor;
