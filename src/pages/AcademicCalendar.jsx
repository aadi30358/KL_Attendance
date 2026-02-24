import { useState } from 'react';
import { Calendar, Download, X, Maximize2, Sparkles, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function AcademicCalendar() {
    const [isModalOpen, setIsModalOpen] = useState(false);

    const handleClose = () => {
        setIsModalOpen(false);
    };

    return (
        <div className="relative min-h-screen bg-[#FAFAFA] overflow-hidden selection:bg-indigo-500 selection:text-white perspective-root-lg">
            {/* --- Advanced Ambient Background --- */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-slate-50 to-white opacity-80" />
                <motion.div
                    animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.4, 0.3], rotate: [0, 90, 0] }}
                    transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                    className="absolute -top-[10%] -right-[10%] w-[60vw] h-[60vw] rounded-full bg-blue-100/30 blur-[100px]"
                />
                <motion.div
                    animate={{ x: [0, 100, 0], opacity: [0.2, 0.3, 0.2] }}
                    transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute bottom-[20%] -left-[10%] w-[50vw] h-[50vw] rounded-full bg-indigo-100/30 blur-[100px]"
                />
            </div>

            <div className="relative z-10 max-w-6xl mx-auto py-12 px-4 sm:px-6 lg:px-8 flex flex-col items-center">
                {/* Header */}
                <motion.div
                    className="text-center mb-16"
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8 }}
                >
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-slate-200 shadow-sm mb-6">
                        <Sparkles className="w-4 h-4 text-indigo-500 animate-pulse" />
                        <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">Academic Year 2025-26</span>
                    </div>
                    <h1 className="text-4xl sm:text-6xl font-black text-slate-900 tracking-tight flex items-center justify-center gap-4">
                        <Calendar className="w-10 h-10 sm:w-16 sm:h-16 text-indigo-600 drop-shadow-xl" />
                        Academic Calendar
                    </h1>
                    <p className="mt-6 text-xl text-slate-500 font-medium max-w-2xl mx-auto leading-relaxed">
                        The definitive schedule for II, III, and IV year B.Tech programs. Plan your journey with precision.
                    </p>
                </motion.div>

                {/* Main Preview Card */}
                <motion.div
                    className="relative w-full aspect-[4/3] sm:aspect-video bg-white/60 backdrop-blur-xl rounded-[2.5rem] shadow-2xl border border-white/60 overflow-hidden group cursor-pointer transition-transform duration-300 hover:-translate-y-2"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    onClick={() => setIsModalOpen(true)}
                >
                    {/* Hover Overlay */}
                    <div className="absolute inset-0 bg-indigo-900/0 group-hover:bg-indigo-900/10 transition-all duration-500 z-10 flex flex-col items-center justify-center">
                        <div className="opacity-0 group-hover:opacity-100 transform translate-y-6 group-hover:translate-y-0 transition-all duration-500 flex flex-col items-center gap-4">
                            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-2xl">
                                <Maximize2 className="w-8 h-8 text-indigo-600" />
                            </div>
                            <span className="px-6 py-2 bg-white/90 rounded-full text-sm font-black text-slate-900 uppercase tracking-widest shadow-xl">
                                Explore Full View
                            </span>
                        </div>
                    </div>

                    <img
                        src="/academic_calendar.jpg"
                        alt="Academic Calendar Preview"
                        className="w-full h-full object-cover sm:object-contain p-4 transition-transform duration-700"
                    />

                    {/* Corner Tag */}
                    <div className="absolute bottom-6 right-6 z-20">
                        <div className="px-4 py-2 bg-indigo-600/90 backdrop-blur-md border border-indigo-400/30 text-white rounded-xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg">
                            KLU Official Release
                        </div>
                    </div>
                </motion.div>

                {/* Bottom Actions */}
                <motion.div
                    className="mt-12 flex flex-col sm:flex-row items-center gap-6"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                >
                    <a
                        href="/academic_calendar.pdf"
                        download="KLU_Academic_Calendar_26.pdf"
                        className="group relative px-10 py-5 bg-slate-900 text-white rounded-2xl font-bold flex items-center gap-3 shadow-2xl shadow-slate-200 transition-all hover:bg-black hover:scale-105"
                    >
                        <Download className="w-5 h-5 group-hover:-translate-y-1 transition-transform" />
                        Download High-Res PDF
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-ping" />
                    </a>

                    <a
                        href="/academic_calendar.pdf"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group px-10 py-5 bg-white text-slate-700 border border-slate-200 rounded-2xl font-bold flex items-center gap-3 shadow-lg shadow-slate-100 transition-all hover:bg-slate-50 hover:scale-105 hover:border-indigo-200 hover:text-indigo-600"
                    >
                        <ExternalLink className="w-5 h-5" />
                        <span>View PDF</span>
                    </a>

                    <p className="text-sm text-slate-400 font-bold uppercase tracking-widest">
                        Updated Dec 2025
                    </p>
                </motion.div>
            </div>

            {/* Premium Fullscreen Viewer */}
            <AnimatePresence>
                {isModalOpen && (
                    <motion.div
                        className="fixed inset-0 z-[100] bg-white/95 backdrop-blur-2xl flex items-center justify-center overflow-hidden"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        {/* Control Bar */}
                        <div className="absolute top-8 right-8 z-50">
                            <button onClick={handleClose} className="p-3 text-white bg-slate-900 hover:bg-red-500 rounded-xl transition-all shadow-lg">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        {/* PDF Viewer */}
                        <div className="w-full h-full p-4 md:p-12 flex items-center justify-center">
                            <object
                                data="/academic_calendar.pdf#view=FitH"
                                type="application/pdf"
                                className="w-full h-full rounded-2xl shadow-2xl border border-slate-200 bg-slate-100"
                                title="Academic Calendar PDF"
                            >
                                <iframe
                                    src="/academic_calendar.pdf#view=FitH"
                                    className="w-full h-full rounded-2xl border-none"
                                    title="Academic Calendar PDF Fallback"
                                />
                            </object>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
