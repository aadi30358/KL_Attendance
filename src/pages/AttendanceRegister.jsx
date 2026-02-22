import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, Calendar, LogOut, ArrowLeft } from 'lucide-react';
import { erpService } from '../services/erpService';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';

// Component weights matching the extension: L=100, T=25, P=50, S=25
const WEIGHTS = { L: 100, T: 25, P: 50, S: 25 };

function getColor(pct) {
    if (pct >= 85) return 'text-emerald-600';
    if (pct >= 75) return 'text-amber-500';
    return 'text-red-500';
}

function getBgStrip(pct) {
    if (pct >= 85) return 'bg-gradient-to-r from-emerald-400 to-teal-500';
    if (pct >= 75) return 'bg-gradient-to-r from-amber-400 to-yellow-400';
    return 'bg-gradient-to-r from-red-400 to-rose-500';
}

function getStatusLabel(pct) {
    if (pct >= 85) return { text: '✓ Safe (85%+)', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' };
    if (pct >= 75) return { text: '⚠ OK (75–85%)', cls: 'bg-amber-50 text-amber-700 ring-amber-200' };
    return { text: '✗ Shortage', cls: 'bg-red-50 text-red-600 ring-red-200' };
}

// ── BunkSimulator sub-component ──────────────────────────────────────
function BunkSimulator({ subject }) {
    const [bunkInput, setBunkInput] = useState('');

    // Always allow these 4 standard options
    const ALL_COMPS = [
        { id: 'L', label: 'Lecture' },
        { id: 'T', label: 'Tutorial' },
        { id: 'P', label: 'Practical' },
        { id: 'S', label: 'Skill' }
    ];

    // Determine available components to see if we can default to one they actually have
    const components = subject.components ? Object.entries(subject.components) : [];
    const hasComponents = components.length > 0;

    // Default to the first component if available, else Lecture
    const [selectedComp, setSelectedComp] = useState(hasComponents ? components[0][0].charAt(0).toUpperCase() : 'L');

    const bunkCount = parseInt(bunkInput) || 0;
    let projectedActual = null;

    if (bunkCount > 0) {
        if (hasComponents) {
            let totalWeightedPct = 0;
            let totalWeight = 0;
            let selectedCompFound = false;

            components.forEach(([compName, data]) => {
                const firstChar = compName ? compName.charAt(0).toUpperCase() : '';
                const w = WEIGHTS[firstChar] || WEIGHTS[compName] || 1;

                let cConducted = data.conducted;
                let cAttended = data.attended;

                if (firstChar === selectedComp || compName === selectedComp) {
                    cConducted += bunkCount;
                    selectedCompFound = true;
                }

                // Recalculate component percent with new conducted count
                const cPercent = cConducted > 0 ? (cAttended / cConducted) * 100 : 0;

                totalWeightedPct += cPercent * w;
                totalWeight += w;
            });

            // If the component hasn't occurred yet, we simulate the drop by adding its weight 
            // and treating it as 0% attended for those bunked classes.
            if (!selectedCompFound) {
                const w = WEIGHTS[selectedComp] || 1;
                const cPercent = 0; // 0% because all classes for it were bunked

                totalWeightedPct += cPercent * w;
                totalWeight += w;
            }

            projectedActual = totalWeight > 0 ? parseFloat((totalWeightedPct / totalWeight).toFixed(2)) : null;
        } else {
            // Fallback for subjects with completely broken component names
            const parts = (subject.attended || '0/0').split('/');
            const attended = parseInt(parts[0]) || 0;
            const total = parseInt(parts[1]) || 0;
            projectedActual = parseFloat(((attended / (total + bunkCount)) * 100).toFixed(2));
        }
    }

    const projColor = projectedActual !== null
        ? (projectedActual >= 85 ? 'text-emerald-600' : projectedActual >= 75 ? 'text-amber-600' : 'text-red-600')
        : '';

    return (
        <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.12em] mb-2">Bunk Simulator</p>
            <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                    <select
                        value={selectedComp}
                        onChange={(e) => setSelectedComp(e.target.value)}
                        className="bg-white border-2 border-indigo-300 text-slate-700 text-xs rounded-xl px-2 py-2 focus:outline-none focus:ring-4 focus:ring-indigo-100 font-bold w-[110px] shrink-0 shadow-sm transition-all cursor-pointer"
                    >
                        {ALL_COMPS.map((comp) => (
                            <option key={comp.id} value={comp.id}>{comp.label}</option>
                        ))}
                    </select>
                    <input
                        type="number"
                        min="0"
                        placeholder="Classes to bunk"
                        value={bunkInput}
                        onChange={e => setBunkInput(e.target.value)}
                        className="flex-1 min-w-0 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 bg-slate-50"
                    />
                    {projectedActual !== null && (
                        <div className={`text-sm font-black tabular-nums shrink-0 ${projColor}`}>
                            → {projectedActual}%
                        </div>
                    )}
                </div>
                {projectedActual !== null && (
                    <p className={`text-[11px] font-semibold mt-1.5 ${projColor}`}>
                        {projectedActual >= 85
                            ? `Still safe ✓ after bunking ${bunkCount} ${selectedComp || 'class'}${bunkCount > 1 ? (selectedComp ? 's' : 'es') : ''}`
                            : projectedActual >= 75
                                ? `⚠ Drops below 85% but above 75% — risky`
                                : `⛔ Will drop below 75% — shortage risk!`}
                    </p>
                )}
                <p className="text-[10px] text-slate-400 italic font-medium mt-2">
                    * Note: The percentage is your Total Average Attendance. It drops differently depending on the component&apos;s weight (e.g. Lecture dropping impacts more than Skill).
                </p>
            </div>
        </div>
    );
}

// ── Main Component ───────────────────────────────────────────────────
const AttendanceRegister = () => {
    const { logout } = useAuth();
    const [year, setYear] = useState('');
    const [semester, setSemester] = useState('');
    const [subjects, setSubjects] = useState([]);
    const [loading, setLoading] = useState(false);
    const [debugHtml, setDebugHtml] = useState(null);
    const [showDashboard, setShowDashboard] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        const kleData = localStorage.getItem('kleData');
        const html = localStorage.getItem('erpDashboardHtml');
        if (kleData) {
            const data = JSON.parse(kleData);
            setSubjects(data.attendance_data);
            setShowDashboard(true);
        } else if (!html) {
            navigate('/login');
        }
    }, [navigate]);

    const handleSearch = async () => {
        if (!year || !semester) { alert('Please select both Year and Semester'); return; }
        setLoading(true); setDebugHtml(null);
        try {
            const data = await erpService.fetchAttendance(year, semester);
            setSubjects(data); setShowDashboard(true);
        } catch (error) {
            if (error.message?.startsWith('DEBUG_HTML:')) { setDebugHtml(error.message.replace('DEBUG_HTML:', '')); setShowDashboard(true); }
            else if (error.message?.startsWith('No table found')) { setDebugHtml(error.message); setShowDashboard(true); }
            else alert('Failed to fetch attendance. Verify your login status.');
        } finally { setLoading(false); }
    };

    const handleBack = () => {
        setShowDashboard(false);
        setSubjects([]);
        setDebugHtml(null);
        localStorage.removeItem('kleData');
    };

    const handleLogoutAction = async () => {
        try {
            await logout();
            localStorage.removeItem('erpDashboardHtml');
            localStorage.removeItem('kleData');
            navigate('/login');
        } catch (e) { console.error(e); }
    };

    // ── DASHBOARD VIEW ──────────────────────────────────────────────
    if (showDashboard) {
        return (
            <div className="min-h-screen bg-slate-50 pt-20 pb-6 px-4 sm:px-6 font-sans">
                <div className="fixed inset-0 -z-10 bg-gradient-to-br from-slate-50 via-white to-indigo-50/30" />

                {/* Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 max-w-7xl mx-auto">
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                            Attendance <span className="text-indigo-600">Dashboard</span>
                        </h1>
                        <p className="text-slate-400 text-sm mt-0.5 font-medium">
                            {year && semester ? `${year} · ${semester} Semester` : 'Current Session'}
                        </p>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                        <button onClick={handleBack} className="flex-1 sm:flex-none px-4 py-2 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-xl hover:bg-indigo-100 hover:text-indigo-800 transition-colors text-sm font-bold shadow-sm flex items-center justify-center gap-2">
                            <ArrowLeft className="w-4 h-4" /> Back to Selection
                        </button>
                        <button onClick={handleLogoutAction} className="flex-1 sm:flex-none px-4 py-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-all flex items-center justify-center gap-2 border border-red-100 text-sm font-bold">
                            <LogOut className="w-4 h-4" />Logout
                        </button>
                    </div>
                </div>



                {/* Debug view */}
                {debugHtml && (
                    <div className="max-w-7xl mx-auto mb-6 bg-white border border-red-200 rounded-2xl p-6 shadow-sm">
                        <h2 className="text-red-500 font-bold mb-4">Debug Output</h2>
                        <textarea readOnly className="w-full h-64 bg-slate-50 text-slate-700 font-mono text-xs p-4 rounded-xl border border-slate-200" value={debugHtml} />
                    </div>
                )}

                {/* Cards Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 max-w-7xl mx-auto">
                    {subjects.map((subject, index) => {
                        const pct = subject.percent;
                        const status = getStatusLabel(pct);

                        return (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.06 }}
                                className="bg-white border-2 border-slate-900 rounded-2xl overflow-hidden shadow hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
                            >
                                {/* Top color strip */}
                                <div className={`h-1.5 w-full ${getBgStrip(pct)}`} />

                                <div className="p-5">
                                    {/* Title row */}
                                    <div className="flex justify-between items-start gap-4 mb-4">
                                        <div className="flex-1 min-w-0">
                                            <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wide leading-snug">{subject.title}</h3>
                                            <p className="text-slate-400 text-[11px] mt-0.5 font-mono">{subject.code}</p>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <div className={`text-3xl font-black tabular-nums leading-none ${getColor(pct)}`}>{pct}%</div>
                                            <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full mt-1.5 ring-1 ${status.cls}`}>
                                                {status.text}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="border-t border-slate-100 mb-4" />

                                    <div className="flex flex-col gap-5">
                                        {/* Components */}
                                        <div>
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.12em] mb-2.5">Components</p>
                                            <div className="space-y-1.5">
                                                {subject.components && Object.entries(subject.components).map(([compName, compData]) => (
                                                    <div key={compName} className="flex justify-between items-center gap-2">
                                                        <span className="text-slate-600 text-xs font-medium">
                                                            {compName === 'L' ? 'Lecture' : compName === 'P' ? 'Practical' : compName === 'T' ? 'Tutorial' : compName === 'S' ? 'Skill' : compName}
                                                        </span>
                                                        <div className="flex items-center gap-1 shrink-0">
                                                            <span className="text-slate-900 text-xs font-bold font-mono">{compData.attended}/{compData.conducted}</span>
                                                            <span className={`text-[10px] font-semibold ${getColor(compData.percent)}`}>({compData.percent}%)</span>
                                                        </div>
                                                    </div>
                                                ))}
                                                {(!subject.components || Object.keys(subject.components).length === 0) && (
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-slate-600 text-xs font-medium">Classes</span>
                                                        <span className="text-slate-900 text-xs font-bold font-mono">{subject.attended}</span>
                                                    </div>
                                                )}
                                                {subject.components && Object.keys(subject.components).length > 0 && (
                                                    <div className="flex justify-between items-center pt-2 border-t border-slate-100 mt-1">
                                                        <span className="text-slate-700 text-xs font-bold">Total (Raw)</span>
                                                        <span className="text-slate-900 text-xs font-bold font-mono">{subject.attended}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Bunk Simulator */}
                                    <BunkSimulator subject={subject} />
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            </div>
        );
    }

    // ── SELECTION FORM ───────────────────────────────────────────────
    return (
        <div className="h-screen overflow-hidden bg-[#FAFAFA] flex items-center justify-center p-4 font-sans relative selection:bg-indigo-500 selection:text-white">
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-slate-50 to-white opacity-80" />
                <motion.div animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }} transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
                    className="absolute -top-[30%] -left-[10%] w-[80vw] h-[80vw] rounded-full bg-gradient-to-r from-indigo-200 via-purple-200 to-pink-200 blur-[150px]" />
                <motion.div animate={{ x: [0, 100, 0], opacity: [0.2, 0.4, 0.2] }} transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
                    className="absolute top-[40%] -right-[20%] w-[60vw] h-[60vw] rounded-full bg-gradient-to-l from-blue-200 via-teal-200 to-emerald-200 blur-[150px]" />
            </div>

            <div className="w-full max-w-md relative z-10">
                <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ type: 'spring', stiffness: 200, damping: 25 }}
                    className="bg-white/80 backdrop-blur-xl border-2 border-slate-900 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-indigo-500 rounded-t-[2.5rem]" />

                    <div className="text-center mb-8 relative z-10">
                        <motion.div initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 200, damping: 20, delay: 0.1 }}
                            className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-200">
                            <BookOpen className="w-8 h-8 text-white" />
                        </motion.div>
                        <h1 className="text-2xl font-black text-slate-900 tracking-tight">KL ERP Attendance</h1>
                        <p className="text-slate-500 text-sm font-medium mt-1">Select your Academic Year and Semester</p>
                    </div>

                    <div className="space-y-5 relative z-10">
                        <div className="space-y-1.5">
                            <label className="text-slate-600 text-xs font-bold uppercase tracking-widest ml-1">Academic Year</label>
                            <div className="relative">
                                <select value={year} onChange={e => setYear(e.target.value)}
                                    className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-2xl py-3.5 px-5 text-slate-700 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all font-medium cursor-pointer">
                                    <option value="">Select Academic Year</option>
                                    <option value="2025-2026">2025-2026</option>
                                    <option value="2024-2025">2024-2025</option>
                                    <option value="2023-2024">2023-2024</option>
                                </select>
                                <Calendar className="absolute right-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-slate-600 text-xs font-bold uppercase tracking-widest ml-1">Semester</label>
                            <div className="relative">
                                <select value={semester} onChange={e => setSemester(e.target.value)}
                                    className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-2xl py-3.5 px-5 text-slate-700 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all font-medium cursor-pointer">
                                    <option value="">Select Semester</option>
                                    <option value="Odd">Odd Sem</option>
                                    <option value="Even">Even Sem</option>
                                    <option value="Summer">Summer Term</option>
                                </select>
                                <BookOpen className="absolute right-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                            </div>
                        </div>

                        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                            onClick={handleSearch} disabled={loading}
                            className="w-full bg-slate-900 text-white font-bold py-4 rounded-2xl shadow-xl shadow-slate-900/20 hover:bg-slate-800 transition-all mt-2 flex items-center justify-center gap-2">
                            {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Get Attendance'}
                        </motion.button>

                        <div className="text-center pt-1">
                            <button onClick={handleLogoutAction} className="text-slate-400 text-sm font-semibold hover:text-slate-700 transition-colors">
                                Back to Login
                            </button>
                        </div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-slate-100 relative z-10">
                        <p className="text-slate-400 text-[10px] text-center font-medium leading-relaxed">
                            This connects to the university ERP system. Your credentials are processed securely.
                        </p>
                    </div>
                </motion.div>
            </div>
        </div>
    );
};

export default AttendanceRegister;
