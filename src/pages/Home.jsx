import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useMotionValue, useSpring, useTransform, useScroll, AnimatePresence } from 'framer-motion';
import { ArrowRight, Calculator, Calendar, Clock, Sparkles, Activity, CalendarDays, Bot, Flame, LogIn, Wrench, X } from 'lucide-react';

// --- Ultra-Advanced 3D Parallax Card ---
const ThreeDParallaxCard = ({ children, className = "", icon: Icon, colorClass, to, accentColor, activeBorderColor = "border-indigo-600", hoverBorderColor = "hover:border-indigo-600", onClick, isUnderMaintenance = false }) => {
    const [isClicked, setIsClicked] = useState(false);
    const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' ? window.innerWidth < 1024 : false);
    const ref = useRef(null);
    const x = useMotionValue(0);
    const y = useMotionValue(0);

    useEffect(() => {
        const updateMobile = () => setIsMobile(window.innerWidth < 1024);
        window.addEventListener('resize', updateMobile, { passive: true });
        return () => window.removeEventListener('resize', updateMobile);
    }, []);

    const mouseXSpring = useSpring(x, { stiffness: 300, damping: 30 });
    const mouseYSpring = useSpring(y, { stiffness: 300, damping: 30 });

    const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["15deg", "-15deg"]);
    const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-15deg", "15deg"]);

    // Internal element parallax
    const iconX = useTransform(mouseXSpring, [-0.5, 0.5], ["15px", "-15px"]);
    const iconY = useTransform(mouseYSpring, [-0.5, 0.5], ["15px", "-15px"]);

    const handleMouseMove = (e) => {
        if (isMobile || !ref.current) return;
        const rect = ref.current.getBoundingClientRect();
        x.set((e.clientX - rect.left) / rect.width - 0.5);
        y.set((e.clientY - rect.top) / rect.height - 0.5);
    };

    const handleMouseLeave = () => {
        if (isMobile) return;
        x.set(0);
        y.set(0);
    };

    const CardContent = (
        <motion.div
            ref={ref}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            style={isMobile ? {} : {
                rotateY,
                rotateX,
                transformStyle: "preserve-3d",
            }}
            whileHover={isMobile ? {} : { y: -6, scale: 1.01 }}
            className={`relative h-full transition-transform duration-200 ease-out group transform-gpu ${className}`}
        >
            {/* Dynamic Depth Background - Disabled on mobile to preserve GPU memory */}
            <div
                className={`hidden sm:block absolute inset-0 rounded-[2rem] sm:rounded-[2.5rem] opacity-20 sm:opacity-30 blur-xl sm:blur-2xl transition-colors duration-500 pointer-events-none ${colorClass.replace('text', 'bg')}`}
            />

            <div
                onClick={(e) => {
                    setIsClicked(!isClicked);
                    if (onClick) onClick(e);
                }}
                className={`relative h-full bg-white dark:bg-[#1e293b] sm:bg-white/80 dark:sm:bg-[#1e293b]/95 sm:backdrop-blur-xl border-2 transition-colors duration-300 rounded-[2rem] sm:rounded-[2.5rem] p-5 sm:p-7 shadow-xl hover:shadow-2xl overflow-hidden flex flex-col justify-between z-10 cursor-pointer touch-pan-y ${
                    isClicked ? activeBorderColor : `border-black dark:border-slate-700/60 ${hoverBorderColor}`
                }`}
            >
                {/* Shine Effect */}
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white/80 dark:from-white/5 via-transparent to-transparent opacity-50 pointer-events-none" />

                <div className="relative z-10 transform-style-3d flex flex-col justify-between h-full flex-1">
                    <div className="flex justify-between items-start mb-4 sm:mb-6">
                        <motion.div
                            style={isMobile ? {} : { x: iconX, y: iconY, transform: "translateZ(40px)" }}
                            className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center shadow-lg ${accentColor} shrink-0`}
                        >
                            <Icon className={`w-7 h-7 sm:w-8 sm:h-8 text-white`} />
                        </motion.div>
                        {isUnderMaintenance ? (
                            <motion.div
                                style={isMobile ? {} : { transform: "translateZ(30px)" }}
                                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 flex items-center justify-center text-amber-600 dark:text-amber-400 shadow-2xs shrink-0"
                                title="Under Maintenance"
                            >
                                <Wrench className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600 dark:text-amber-400" />
                            </motion.div>
                        ) : to ? (
                            <motion.div
                                style={isMobile ? {} : { transform: "translateZ(30px)" }}
                                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700/60 flex items-center justify-center text-slate-700 dark:text-slate-200 group-hover:bg-slate-900 group-hover:text-white dark:group-hover:bg-indigo-600 dark:group-hover:text-white transition-colors duration-300 shrink-0"
                            >
                                <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 -rotate-45 group-hover:rotate-0 transition-transform duration-300" />
                            </motion.div>
                        ) : null}
                    </div>

                    <motion.div style={isMobile ? {} : { transform: "translateZ(30px)" }} className="flex-1 flex flex-col justify-between">
                        {children}
                    </motion.div>
                </div>
            </div>
        </motion.div>
    );

    if (to) {
        return <Link to={to} onClick={onClick} className="h-full block perspective-1000">{CardContent}</Link>;
    }
    return <div onClick={onClick} className="h-full perspective-1000">{CardContent}</div>;
};

// --- Responsive Animated Typewriter Text ---
const TypewriterText = ({
    text,
    speed = 80,
    delay = 150,
    className = "",
    cursorClassName = "bg-indigo-600 dark:bg-indigo-400",
    hideCursorOnComplete = false,
}) => {
    const [displayedText, setDisplayedText] = useState("");
    const [showCursor, setShowCursor] = useState(true);

    useEffect(() => {
        let timeoutId = null;
        let intervalId = null;
        let cursorTimeoutId = null;
        let currentIndex = 0;

        setDisplayedText("");
        setShowCursor(true);

        timeoutId = setTimeout(() => {
            intervalId = setInterval(() => {
                currentIndex++;
                setDisplayedText(text.slice(0, currentIndex));

                if (currentIndex >= text.length) {
                    clearInterval(intervalId);
                    intervalId = null;

                    if (hideCursorOnComplete) {
                        cursorTimeoutId = setTimeout(() => {
                            setShowCursor(false);
                        }, 1200);
                    }
                }
            }, speed);
        }, delay);

        return () => {
            clearTimeout(timeoutId);
            if (intervalId) clearInterval(intervalId);
            if (cursorTimeoutId) clearTimeout(cursorTimeoutId);
        };
    }, [text, speed, delay, hideCursorOnComplete]);

    return (
        <span className={`inline-block relative ${className}`}>
            <span>{displayedText}</span>
            {showCursor && (
                <motion.span
                    animate={{ opacity: [1, 0, 1] }}
                    transition={{
                        duration: 0.65,
                        repeat: Infinity,
                        ease: "linear",
                    }}
                    className={`inline-block w-[2.5px] sm:w-[3.5px] h-[0.85em] ml-1 sm:ml-1.5 rounded-xs align-baseline ${cursorClassName}`}
                />
            )}
        </span>
    );
};

// --- Exam Countdowns Configuration for all Batches ---
const BATCH_COUNTDOWNS = [
    {
        id: 'y24',
        name: 'Y23 & Y24 Batch',
        shortName: 'Y23 & Y24',
        title: 'Y23 & Y24 [2026-2027] Odd Sem. Countdown for Exams',
        barColor: 'bg-indigo-600',
        years: 'III & IV Year UG Engineering',
        exams: [
            {
                id: 'semIn1',
                label: 'Sem-In 1',
                date: '07 Sep',
                target: new Date('2026-09-07T00:00:00'),
                color: 'from-blue-400 to-indigo-600',
                shadow: 'shadow-blue-200',
                activeBorder: 'border-indigo-600',
                hoverBorder: 'hover:border-indigo-600'
            },
            {
                id: 'labSemIn',
                label: 'Lab Sem-In',
                date: '12 Oct',
                target: new Date('2026-10-12T00:00:00'),
                color: 'from-emerald-400 to-teal-600',
                shadow: 'shadow-emerald-200',
                activeBorder: 'border-emerald-600',
                hoverBorder: 'hover:border-emerald-600'
            },
            {
                id: 'semIn2',
                label: 'Sem-In 2',
                date: '09 Nov',
                target: new Date('2026-11-09T00:00:00'),
                color: 'from-violet-400 to-fuchsia-600',
                shadow: 'shadow-violet-200',
                activeBorder: 'border-violet-600',
                hoverBorder: 'hover:border-violet-600'
            },
            {
                id: 'semEnd',
                label: 'Sem End',
                date: '16 Nov',
                target: new Date('2026-11-16T00:00:00'),
                color: 'from-amber-400 to-orange-600',
                shadow: 'shadow-amber-200',
                activeBorder: 'border-amber-500',
                hoverBorder: 'hover:border-amber-500'
            }
        ]
    },
    {
        id: 'y25',
        name: 'Y25 Regular Batch',
        shortName: 'Y25 Regular',
        title: 'Y25 Regular [2026-2027] Odd Sem. Countdown for Exams',
        barColor: 'bg-emerald-600',
        years: 'II Year UG Engineering (Semester Scheme)',
        exams: [
            {
                id: 'semIn1',
                label: 'Sem-In 1',
                date: '20 Aug',
                target: new Date('2026-08-20T00:00:00'),
                color: 'from-blue-400 to-indigo-600',
                shadow: 'shadow-blue-200',
                activeBorder: 'border-indigo-600',
                hoverBorder: 'hover:border-indigo-600'
            },
            {
                id: 'semIn2',
                label: 'Sem-In 2',
                date: '28 Sep',
                target: new Date('2026-09-28T00:00:00'),
                color: 'from-violet-400 to-fuchsia-600',
                shadow: 'shadow-violet-200',
                activeBorder: 'border-violet-600',
                hoverBorder: 'hover:border-violet-600'
            },
            {
                id: 'labSemIn',
                label: 'Lab Sem-In',
                date: '12 Oct',
                target: new Date('2026-10-12T00:00:00'),
                color: 'from-emerald-400 to-teal-600',
                shadow: 'shadow-emerald-200',
                activeBorder: 'border-emerald-600',
                hoverBorder: 'hover:border-emerald-600'
            },
            {
                id: 'semEnd',
                label: 'Sem End',
                date: '16 Nov',
                target: new Date('2026-11-16T00:00:00'),
                color: 'from-amber-400 to-orange-600',
                shadow: 'shadow-amber-200',
                activeBorder: 'border-amber-500',
                hoverBorder: 'hover:border-amber-500'
            }
        ]
    },
    {
        id: 'y25_tri',
        name: 'Y25 Tri-Sem Batch',
        shortName: 'Y25 Tri-Sem',
        title: 'Y25 Tri-Sem [2026-2027] Trimester Countdown for Exams',
        barColor: 'bg-purple-600',
        years: 'II Year UG Engineering (Trimester 4 & 5 Scheme)',
        exams: [
            {
                id: 'tri4Lab',
                label: 'Lab Exams (Tri-4)',
                date: '12 Oct',
                target: new Date('2026-10-12T00:00:00'),
                color: 'from-blue-400 to-indigo-600',
                shadow: 'shadow-blue-200',
                activeBorder: 'border-indigo-600',
                hoverBorder: 'hover:border-indigo-600'
            },
            {
                id: 'tri4End',
                label: 'Tri-4 End + Hack',
                date: '26 Oct',
                target: new Date('2026-10-26T00:00:00'),
                color: 'from-emerald-400 to-teal-600',
                shadow: 'shadow-emerald-200',
                activeBorder: 'border-emerald-600',
                hoverBorder: 'hover:border-emerald-600'
            },
            {
                id: 'tri5Mid',
                label: 'Mid Term (Tri-5)',
                date: '14 Dec',
                target: new Date('2026-12-14T00:00:00'),
                color: 'from-violet-400 to-fuchsia-600',
                shadow: 'shadow-violet-200',
                activeBorder: 'border-violet-600',
                hoverBorder: 'hover:border-violet-600'
            },
            {
                id: 'tri5Lab',
                label: 'Lab Exams (Tri-5)',
                date: '18 Jan',
                target: new Date('2027-01-18T00:00:00'),
                color: 'from-amber-400 to-orange-600',
                shadow: 'shadow-amber-200',
                activeBorder: 'border-amber-500',
                hoverBorder: 'hover:border-amber-500'
            }
        ]
    }
];

// --- Countdown Component ---
const ExamCountdownSection = () => {
    const [activeBatchId, setActiveBatchId] = useState('y24');
    const [currentTime, setCurrentTime] = useState(new Date());
    const [selectedCard, setSelectedCard] = useState(null);

    useEffect(() => {
        const t = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(t);
    }, []);

    const handleBatchChange = (batchId) => {
        setActiveBatchId(batchId);
        setSelectedCard(null);
    };

    const calcTime = (target) => {
        const diff = target - currentTime;
        if (diff <= 0) {
            return { days: 0, hours: 0, mins: 0, secs: 0, isPassed: true };
        }
        return {
            days: Math.floor(diff / (1000 * 60 * 60 * 24)),
            hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
            mins: Math.floor((diff / 1000 / 60) % 60),
            secs: Math.floor((diff / 1000) % 60),
            isPassed: false
        };
    };

    const activeBatch = BATCH_COUNTDOWNS.find((b) => b.id === activeBatchId) || BATCH_COUNTDOWNS[0];

    return (
        <div className="w-full mt-14 sm:mt-24 relative z-10">
            {/* Top Bar: Upside Options + Full Academic Calendar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 sm:mb-8 px-1 sm:px-4">
                {/* Upside Options */}
                <div className="flex items-center gap-2 sm:gap-2.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                    {BATCH_COUNTDOWNS.map((b) => {
                        const isActive = activeBatchId === b.id;
                        return (
                            <button
                                key={b.id}
                                onClick={() => handleBatchChange(b.id)}
                                className={`px-3.5 sm:px-4 py-2 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-black transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 border-2 shrink-0 ${
                                    isActive
                                        ? 'bg-slate-900 dark:bg-indigo-600 text-white border-black dark:border-indigo-400/50 shadow-md scale-[1.02]'
                                        : 'bg-white dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border-black/30 dark:border-slate-700'
                                }`}
                            >
                                <span>{b.shortName}</span>
                                {isActive && (
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                )}
                            </button>
                        );
                    })}
                </div>

                <Link
                    to="/calendar"
                    className="text-xs sm:text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 flex items-center gap-1.5 self-start sm:self-auto group"
                >
                    <span>Full Academic Calendar</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </Link>
            </div>

            {/* Section Title */}
            <div className="flex items-center gap-3 sm:gap-4 mb-6 sm:mb-8 px-1 sm:px-4">
                <div className={`h-7 sm:h-9 w-1 sm:w-1.5 ${activeBatch.barColor} rounded-full transition-colors duration-300 shrink-0`} />
                <div>
                    <h2 className="text-xl sm:text-3xl font-bold text-slate-900 dark:text-white leading-snug">
                        {activeBatch.title}
                    </h2>
                    <p className="text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                        {activeBatch.years}
                    </p>
                </div>
            </div>

            {/* Exactly 4 Cards - Smooth animated transition when changing batch */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={activeBatch.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.25 }}
                    className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6"
                >
                    {activeBatch.exams.map((item, idx) => {
                        const time = calcTime(item.target);
                        const isSelected = selectedCard === idx;

                        return (
                            <motion.div
                                key={item.id}
                                whileHover={{ scale: 1.03, y: -6 }}
                                whileTap={{ scale: 0.97 }}
                                onClick={() => setSelectedCard(isSelected ? null : idx)}
                                className={`group relative bg-white dark:bg-[#1e293b] rounded-[1.75rem] sm:rounded-[2rem] border-2 cursor-pointer transition-all duration-300 shadow-md hover:shadow-xl ${item.shadow} ${
                                    isSelected ? item.activeBorder : `border-black dark:border-slate-700/60 ${item.hoverBorder}`
                                }`}
                            >
                                {/* Gradient Border Effect */}
                                <div className={`absolute inset-0 bg-gradient-to-br ${item.color} rounded-[1.75rem] sm:rounded-[2rem] opacity-0 group-hover:opacity-100 blur transition-opacity duration-300 -z-10`} />

                                {/* Card Content */}
                                <div className="relative bg-white dark:bg-[#1e293b] rounded-[1.6rem] sm:rounded-[1.85rem] p-4 sm:p-6 h-full flex flex-col justify-between z-10">
                                    <div className="flex justify-between items-start mb-4 sm:mb-6">
                                        <div>
                                            <h4 className="font-extrabold text-slate-800 dark:text-white text-base sm:text-lg tracking-tight">{item.label}</h4>
                                            <div className={`mt-1.5 inline-flex px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full bg-gradient-to-r ${item.color} bg-opacity-10 opacity-90`}>
                                                <span className="text-[10px] font-bold text-white uppercase tracking-wider">{item.date}</span>
                                            </div>
                                        </div>
                                        <div className={`p-2 rounded-full bg-gradient-to-br ${item.color} text-white shadow-md shrink-0`}>
                                            <Clock className="w-4 h-4" />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-4 gap-1.5 sm:gap-2 text-center">
                                        {[
                                            ['Day', time.days],
                                            ['Hrs', time.hours],
                                            ['Min', time.mins],
                                            ['Sec', time.secs]
                                        ].map(([l, v], i) => (
                                            <div key={i} className="flex flex-col items-center">
                                                <div className="bg-slate-50 dark:bg-slate-800/80 w-full rounded-xl py-2 sm:py-3 border border-slate-100 dark:border-slate-700/60 group-hover:border-slate-200 dark:group-hover:border-slate-600 transition-colors">
                                                    <span className="block text-lg sm:text-xl font-black text-slate-800 dark:text-slate-100 leading-none mb-1">{v}</span>
                                                </div>
                                                <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase mt-1">{l}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </motion.div>
            </AnimatePresence>
        </div>
    );
};

// --- Staggered Text Animation (Word-level for mobile performance) ---
const StaggeredText = ({ text, className, delay = 0 }) => {
    const words = text.split(" ");

    return (
        <motion.span
            className={`inline-flex flex-wrap justify-center gap-x-2 sm:gap-x-3 ${className}`}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-20px" }}
            variants={{
                visible: { transition: { staggerChildren: 0.08, delayChildren: delay } }
            }}
        >
            {words.map((word, wordIndex) => (
                <motion.span
                    key={wordIndex}
                    variants={{
                        hidden: { opacity: 0, y: 20 },
                        visible: { opacity: 1, y: 0 }
                    }}
                    transition={{ type: "spring", damping: 15, stiffness: 120 }}
                    className="inline-block"
                >
                    {word}
                </motion.span>
            ))}
        </motion.span>
    );
};

import SEO from '../components/SEO';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { subscribeCrossDomainSync } from '../services/crossDomainSync';

export default function Home() {
    const [plutoMaintenanceModal, setPlutoMaintenanceModal] = useState(false);
    const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' ? window.innerWidth < 768 : false);
    const [maintenanceConfig, setMaintenanceConfig] = useState({ enabled: false });

    useEffect(() => {
        let unsub = null;
        try {
            unsub = onSnapshot(doc(db, 'config', 'maintenance'), (docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setMaintenanceConfig(data);
                } else {
                    setMaintenanceConfig({ enabled: false });
                }
            }, (err) => console.warn('[Home] Maintenance sync notice:', err));
        } catch {
            // ignore
        }

        const unsubCross = subscribeCrossDomainSync((event) => {
            if (event.type === 'MAINTENANCE_UPDATE' && event.data) {
                setMaintenanceConfig(event.data);
            }
        });

        const handleStorage = (e) => {
            if (e.key === 'kl_erp_maintenance') {
                try {
                    setMaintenanceConfig(e.newValue ? JSON.parse(e.newValue) : { enabled: false });
                } catch {
                    // ignore
                }
            }
        };
        window.addEventListener('storage', handleStorage);

        return () => {
            if (unsub) unsub();
            if (unsubCross) unsubCross();
            window.removeEventListener('storage', handleStorage);
        };
    }, []);

    useEffect(() => {
        const check = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', check, { passive: true });
        return () => window.removeEventListener('resize', check);
    }, []);

    const { scrollY } = useScroll();
    const heroY = useTransform(scrollY, [0, 500], [0, 150]);
    const heroOpacity = useTransform(scrollY, [0, 300], [1, 0]);

    // Preload calendars in the background while user is on Home page
    useEffect(() => {
        ['/calendar_y24_hd.webp', '/calendar_y25_hd.webp', '/calendar_y25_tri_hd.webp'].forEach((src) => {
            const img = new Image();
            img.src = src;
        });
    }, []);

    // Use state initializer to ensure stable random values (idempotent)
    const [particles] = useState(() => {
        return [...Array(8)].map((_, i) => ({
            id: i,
            width: Math.random() * 40 + 20,
            height: Math.random() * 40 + 20,
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            duration: Math.random() * 10 + 20
        }));
    });

    return (
        <div className="relative min-h-screen bg-[#FAFAFA] dark:bg-[#0b1120] selection:bg-indigo-500 selection:text-white transition-colors duration-200">
            <SEO
                title="Home | Master Academic Journey"
                description="Track attendance, calculate LTPS, and ace your exams with the KL Attendance Manager."
            />

            {/* --- High-Performance Ambient Background --- */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-slate-50 to-white dark:from-[#0b1120] dark:to-[#0f172a] opacity-90" />

                {/* Ambient Soft Glows - Static and GPU-composited for 60fps responsiveness */}
                <div className="hidden sm:block absolute -top-[10%] -left-[5%] w-[45vw] h-[45vw] rounded-full bg-gradient-to-r from-indigo-100 via-purple-100 to-pink-100 dark:from-indigo-950/30 dark:via-purple-950/20 dark:to-transparent blur-3xl opacity-40 pointer-events-none" />
                <div className="hidden sm:block absolute top-[35%] -right-[10%] w-[40vw] h-[40vw] rounded-full bg-gradient-to-l from-blue-100 via-teal-100 to-emerald-100 dark:from-blue-950/25 dark:via-indigo-950/25 dark:to-transparent blur-3xl opacity-30 pointer-events-none" />
                {/* Lightweight non-blurred static gradient on mobile */}
                <div className="sm:hidden absolute top-0 left-0 w-full h-72 bg-gradient-to-b from-indigo-50/50 dark:from-indigo-950/20 to-transparent pointer-events-none" />

                {/* Lightweight Floating Particles (Desktop Only - hardware friendly, no expensive backdrop-blur) */}
                <div className="hidden lg:block absolute inset-0 pointer-events-none overflow-hidden">
                    {particles.map((p) => (
                        <motion.div
                            key={p.id}
                            className="absolute rounded-full bg-gradient-to-br from-indigo-100/40 to-slate-200/30 dark:from-slate-700/30 dark:to-slate-800/20 border border-white/40 dark:border-slate-700/40"
                            style={{
                                width: p.width,
                                height: p.height,
                                left: p.left,
                                top: p.top,
                                zIndex: -1
                            }}
                            animate={{
                                y: [0, -35, 0],
                                opacity: [0.3, 0.6, 0.3]
                            }}
                            transition={{
                                duration: p.duration,
                                repeat: Infinity,
                                ease: "easeInOut"
                            }}
                        />
                    ))}
                </div>

                <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-[0.02] mix-blend-overlay" />
            </div>

            <main className="relative max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 pt-28 sm:pt-36 pb-20 flex flex-col items-center w-full">

                {/* --- Hero Section --- */}
                <motion.div
                    style={isMobile ? {} : { y: heroY, opacity: heroOpacity }}
                    className="relative z-10 w-full text-center flex flex-col items-center mb-16 sm:mb-28"
                >
                    <motion.div
                        initial={{ scale: 0, rotate: -180 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ type: "spring", stiffness: 200, damping: 20 }}
                        className="w-20 h-20 mb-8 rounded-3xl bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-700/70 shadow-2xl shadow-indigo-200 dark:shadow-none flex items-center justify-center relative group"
                    >
                        <div className="absolute inset-0 bg-indigo-500 dark:bg-indigo-600 rounded-3xl blur-xl opacity-20 group-hover:opacity-40 transition-opacity" />
                        <Sparkles className="w-10 h-10 text-indigo-600 dark:text-indigo-400 animate-pulse-slow" />
                    </motion.div>

                    <h1 className="text-3xl sm:text-6xl lg:text-8xl font-black text-slate-900 dark:text-white tracking-tight leading-tight sm:leading-[0.9] mb-6 sm:mb-8 relative perspective-1000 flex flex-col items-center px-2">
                        <div className="mb-1 sm:mb-2 min-h-[1.15em] flex items-center justify-center">
                            <TypewriterText
                                text="Master Your"
                                delay={180}
                                speed={95}
                                hideCursorOnComplete={true}
                                className="text-slate-900 dark:text-white"
                                cursorClassName="bg-slate-900 dark:bg-white"
                            />
                        </div>
                        <div className="relative inline-block">
                            <StaggeredText
                                text="Academic Journey"
                                className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-600 dark:from-indigo-400 dark:via-violet-400 dark:to-indigo-300 animate-gradient bg-300-percent"
                                delay={0.8}
                            />
                            <motion.div
                                className="absolute -top-8 -right-2 sm:-top-12 sm:-right-4 text-4xl sm:text-6xl opacity-50 blur-[1px] pointer-events-none"
                                animate={{ y: [0, -12, 0], rotate: [8, -8, 8] }}
                                transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                            >
                                🚀
                            </motion.div>
                        </div>
                    </h1>

                    <div className="text-sm sm:text-xl text-slate-500 dark:text-slate-400 font-medium max-w-xl leading-relaxed mb-8 sm:mb-12 px-3 text-center min-h-[2.5rem] sm:min-h-[3.2rem] flex items-center justify-center">
                        <TypewriterText
                            text="The next-generation academic suite for KLU students."
                            delay={750}
                            speed={42}
                            className="text-slate-500 dark:text-slate-400"
                            cursorClassName="bg-indigo-600 dark:bg-indigo-400"
                        />
                    </div>

                    <div className="flex flex-row flex-wrap justify-center gap-3 sm:gap-4 w-full max-w-lg px-3">
                        <Link to="/ltps" className="flex-1 min-w-[125px]">
                            <motion.button
                                whileHover={{ scale: 1.04 }}
                                whileTap={{ scale: 0.96 }}
                                className="w-full py-3.5 px-3 sm:px-5 bg-slate-900 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white rounded-2xl font-bold shadow-xl shadow-slate-900/25 flex items-center justify-center gap-1.5 sm:gap-2 group text-xs sm:text-sm whitespace-nowrap"
                            >
                                <Calculator className="w-4 h-4 group-hover:rotate-12 transition-transform shrink-0" />
                                <span>LTPS Engine</span>
                            </motion.button>
                        </Link>
                        <Link to="/bunk-simulator" className="flex-1 min-w-[125px]">
                            <motion.button
                                whileHover={{ scale: 1.04 }}
                                whileTap={{ scale: 0.96 }}
                                className="w-full py-3.5 px-3 sm:px-5 bg-gradient-to-r from-sky-500 to-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-sky-500/25 flex items-center justify-center gap-1.5 sm:gap-2 group text-xs sm:text-sm whitespace-nowrap border border-sky-400/30"
                            >
                                <Flame className="w-4 h-4 text-sky-100 group-hover:scale-110 transition-transform shrink-0 animate-pulse" />
                                <span>Bunk Simulator</span>
                            </motion.button>
                        </Link>
                        <Link to="/login" className="flex-1 min-w-[125px]">
                            <motion.button
                                whileHover={{ scale: 1.04 }}
                                whileTap={{ scale: 0.96 }}
                                className={`w-full py-3.5 px-3 sm:px-5 ${
                                    maintenanceConfig?.enabled
                                        ? 'bg-gradient-to-r from-amber-500 to-orange-500 shadow-amber-500/25 border-amber-400/30'
                                        : 'bg-gradient-to-r from-rose-500 to-pink-500 shadow-rose-500/25 border-rose-400/30'
                                } text-white rounded-2xl font-bold shadow-lg flex items-center justify-center gap-1.5 sm:gap-2 group text-xs sm:text-sm whitespace-nowrap border`}
                            >
                                {maintenanceConfig?.enabled ? (
                                    <>
                                        <Wrench className="w-4 h-4 text-white group-hover:rotate-12 transition-transform shrink-0" />
                                        <span>ERP (Maintenance)</span>
                                    </>
                                ) : (
                                    <>
                                        <LogIn className="w-4 h-4 text-white group-hover:scale-110 transition-transform shrink-0" />
                                        <span>ERP Login</span>
                                    </>
                                )}
                            </motion.button>
                        </Link>
                    </div>
                </motion.div>

                {/* --- 3D Grid Section --- */}
                <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-8 perspective-2000">

                    {/* 1. LTPS Engine - Large Card */}
                    <div className="md:col-span-2 min-h-[280px] sm:min-h-[320px] md:h-[380px]">

                        <ThreeDParallaxCard
                            to="/ltps"
                            icon={Calculator}
                            colorClass="text-indigo-500"
                            accentColor="bg-indigo-600"
                            activeBorderColor="border-indigo-600"
                            hoverBorderColor="hover:border-indigo-600"
                        >
                            <div>
                                <h3 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mb-2">L-T-P-S Logic Engine</h3>
                                <p className="text-slate-500 dark:text-slate-400 text-sm sm:text-base mb-6 max-w-sm">Precision calculation based on the latest KLU weightage algorithms. Visualize your grades in 3D.</p>
                            </div>

                            {/* Detailed 3D Mockup inside Card */}
                            <div className="absolute -bottom-2 -right-2 sm:bottom-6 sm:right-6 w-28 h-20 sm:w-44 sm:h-28 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-inner p-3 transform rotate-y-12 rotate-x-12 translate-z-10 flex flex-col gap-2 opacity-80 group-hover:opacity-100 transition-opacity pointer-events-none">
                                <div className="w-full h-2 bg-indigo-200 dark:bg-indigo-500/40 rounded-full" />
                                <div className="w-3/4 h-2 bg-indigo-200 dark:bg-indigo-500/40 rounded-full" />
                                <div className="mt-auto flex gap-2">
                                    <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-indigo-500/20 dark:bg-indigo-500/30" />
                                    <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-indigo-500/20 dark:bg-indigo-500/30" />
                                </div>
                            </div>
                        </ThreeDParallaxCard>
                    </div>

                    {/* 2. Pluto AI Coding Assistant - Active */}
                    <div className="min-h-[260px] sm:min-h-[280px] md:h-[380px]">

                        <ThreeDParallaxCard
                            to="/pluto"
                            icon={Bot}
                            colorClass="text-sky-500"
                            accentColor="bg-gradient-to-tr from-sky-500 to-indigo-600"
                            activeBorderColor="border-sky-500"
                            hoverBorderColor="hover:border-sky-500"
                        >
                            <div className="flex flex-col h-full justify-between">
                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5">
                                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                            <span>Live Bot</span>
                                        </span>
                                        <span className="text-[10px] font-mono font-bold text-slate-400">
                                            @PlutoSpark_bot
                                        </span>
                                    </div>
                                    <h3 className="text-2xl font-black text-slate-900 mb-1.5 flex items-center gap-2">
                                        <span>Pluto AI</span>
                                    </h3>
                                    <p className="text-slate-500 text-xs sm:text-sm mb-4">AI coding & DSA mentor for students on Telegram.</p>
                                </div>

                                <div className="w-full py-2.5 sm:py-3 bg-sky-50 group-hover:bg-sky-100 text-sky-900 rounded-xl font-bold text-xs sm:text-sm text-center border-2 border-black transition-colors flex items-center justify-center gap-1.5 shadow-sm mt-auto">
                                    <Bot className="w-4 h-4 text-sky-600" />
                                    <span>Launch Pluto AI</span>
                                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                                </div>
                            </div>
                        </ThreeDParallaxCard>
                    </div>

                    {/* 3. Bunk Simulator Card */}
                    <div className="md:col-span-2 min-h-[280px] sm:min-h-[300px] md:h-[360px]">
                        <ThreeDParallaxCard
                            to="/bunk-simulator"
                            icon={Flame}
                            colorClass="text-rose-500"
                            accentColor="bg-gradient-to-tr from-rose-600 to-pink-500"
                            activeBorderColor="border-rose-600"
                            hoverBorderColor="hover:border-rose-600"
                        >
                            <div className="flex flex-col h-full justify-between">
                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="px-2.5 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60 text-[10px] font-black uppercase tracking-wider">
                                            KLU Weightage Simulator
                                        </span>
                                        <span className="text-[10px] font-mono font-bold text-slate-400 dark:text-slate-400">
                                            Safe Zone vs Detained
                                        </span>
                                    </div>
                                    <h3 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mb-2">Bunk Simulator</h3>
                                    <p className="text-slate-500 dark:text-slate-400 text-sm sm:text-base max-w-md">Simulate skipping classes before you bunk. Computes exact percentage drop across Lecture, Tutorial, Practical, & Skill components.</p>
                                </div>
                                <div className="w-full py-2.5 sm:py-3 bg-rose-50 dark:bg-rose-950/40 group-hover:bg-rose-100 dark:group-hover:bg-rose-900/50 text-rose-900 dark:text-rose-200 rounded-xl font-bold text-xs sm:text-sm text-center border-2 border-black dark:border-rose-800/60 transition-colors flex items-center justify-center gap-1.5 shadow-sm mt-auto">
                                    <Flame className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                                    <span>Launch Bunk Simulator</span>
                                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                                </div>
                            </div>
                        </ThreeDParallaxCard>
                    </div>

                    {/* 4. ERP Login Card */}
                    <div className="min-h-[280px] sm:min-h-[300px] md:h-[360px]">
                        <ThreeDParallaxCard
                            to="/login"
                            icon={maintenanceConfig?.enabled ? Wrench : LogIn}
                            colorClass={maintenanceConfig?.enabled ? "text-amber-500" : "text-rose-500"}
                            accentColor={maintenanceConfig?.enabled ? "bg-gradient-to-tr from-amber-500 to-orange-500" : "bg-gradient-to-tr from-rose-600 to-pink-500"}
                            activeBorderColor={maintenanceConfig?.enabled ? "border-amber-500" : "border-rose-600"}
                            hoverBorderColor={maintenanceConfig?.enabled ? "hover:border-amber-500" : "hover:border-rose-600"}
                            isUnderMaintenance={Boolean(maintenanceConfig?.enabled)}
                        >
                            <div className="flex flex-col h-full justify-between">
                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className={`px-2.5 py-0.5 rounded-full ${
                                            maintenanceConfig?.enabled
                                                ? 'bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/60'
                                                : 'bg-rose-100 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800/60'
                                        } border text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5`}>
                                            {maintenanceConfig?.enabled && (
                                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                            )}
                                            {maintenanceConfig?.enabled ? 'Maintenance Active' : 'Instant Sync'}
                                        </span>
                                        <span className="text-[10px] font-mono font-bold text-slate-400 dark:text-slate-400">
                                            {maintenanceConfig?.enabled ? 'Offline' : 'Live Portal'}
                                        </span>
                                    </div>
                                    <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mb-1.5">
                                        {maintenanceConfig?.enabled ? 'ERP Maintenance' : 'ERP Login'}
                                    </h3>
                                    <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mb-3">
                                        {maintenanceConfig?.enabled
                                            ? (maintenanceConfig.message || 'ERP login is temporarily paused for system maintenance. Click to view status.')
                                            : 'Connect to KL ERP to auto-fetch attendance records and check eligibility without manual entry.'}
                                    </p>
                                </div>

                                <div className={`w-full py-2.5 sm:py-3 ${
                                    maintenanceConfig?.enabled
                                        ? 'bg-amber-50 dark:bg-amber-950/40 group-hover:bg-amber-100 dark:group-hover:bg-amber-900/50 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-800/60'
                                        : 'bg-rose-50 dark:bg-rose-950/40 group-hover:bg-rose-100 dark:group-hover:bg-rose-900/50 text-rose-900 dark:text-rose-200 border-black dark:border-rose-800/60'
                                } rounded-xl font-bold text-xs sm:text-sm text-center border-2 transition-colors flex items-center justify-center gap-1.5 shadow-sm mt-auto`}>
                                    {maintenanceConfig?.enabled ? (
                                        <>
                                            <Wrench className="w-4 h-4 text-amber-600 dark:text-amber-400 animate-bounce" />
                                            <span>Under Maintenance — View Status</span>
                                            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                                        </>
                                    ) : (
                                        <>
                                            <LogIn className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                                            <span>Login to ERP</span>
                                            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                                        </>
                                    )}
                                </div>
                            </div>
                        </ThreeDParallaxCard>
                    </div>

                    {/* 5. Public Holidays 2026 */}
                    <div className="min-h-[280px] sm:min-h-[300px] md:h-[360px]">
                        <ThreeDParallaxCard
                            to="/holidays"
                            icon={CalendarDays}
                            colorClass="text-amber-500"
                            accentColor="bg-amber-500"
                            activeBorderColor="border-amber-500"
                            hoverBorderColor="hover:border-amber-500"
                        >
                            <div className="flex flex-col h-full justify-between">
                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/50 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-800/60 text-[10px] font-black uppercase tracking-wider">
                                            11 Holidays
                                        </span>
                                        <span className="text-[10px] font-mono font-bold text-slate-400 dark:text-slate-400">
                                            Year 2026
                                        </span>
                                    </div>
                                    <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mb-1">
                                        Public Holidays
                                    </h3>
                                    <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mb-3">
                                        Official General Holidays Schedule.
                                    </p>
                                </div>

                                <div className="w-full py-2.5 sm:py-3 bg-amber-50 dark:bg-amber-950/40 group-hover:bg-amber-100 dark:group-hover:bg-amber-900/50 text-amber-900 dark:text-amber-200 rounded-xl font-bold text-xs sm:text-sm text-center border-2 border-black dark:border-amber-800/60 transition-colors flex items-center justify-center gap-1.5 shadow-sm mt-auto">
                                    <span>View Holiday List (11)</span>
                                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                                </div>
                            </div>
                        </ThreeDParallaxCard>
                    </div>

                    {/* 6. Calendar */}
                    <div className="min-h-[280px] sm:min-h-[300px] md:h-[360px]">
                        <ThreeDParallaxCard
                            to="/calendar"
                            colorClass="text-purple-500"
                            accentColor="bg-purple-600"
                            icon={Calendar}
                            activeBorderColor="border-purple-600"
                            hoverBorderColor="hover:border-purple-600"
                        >
                            <div className="flex flex-col h-full justify-between">
                                <div>
                                    <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mb-2">Calendar</h3>
                                    <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mb-3">Official KLU Schedule 2026–27.</p>
                                </div>
                                <div className="w-full py-2.5 sm:py-3 bg-slate-50 dark:bg-slate-800/60 group-hover:bg-slate-100 dark:group-hover:bg-slate-700/60 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-xs sm:text-sm text-center border-2 border-black dark:border-slate-700/60 transition-colors flex items-center justify-center gap-1.5 shadow-sm mt-auto">
                                    <span>View Y24 / Y25 / Tri-Sem</span>
                                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                                </div>
                            </div>
                        </ThreeDParallaxCard>
                    </div>

                    {/* 7. Total Attendance Live Status */}
                    <div className="min-h-[280px] sm:min-h-[300px] md:h-[360px]">
                        <ThreeDParallaxCard
                            to="/attendance"
                            colorClass="text-emerald-500"
                            accentColor="bg-emerald-600"
                            icon={Activity}
                            activeBorderColor="border-emerald-600"
                            hoverBorderColor="hover:border-emerald-600"
                        >
                            <div className="flex flex-col h-full justify-between">
                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-900 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800/60 text-[10px] font-black uppercase tracking-wider">
                                            Live Tracker
                                        </span>
                                    </div>
                                    <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mb-2">Total Attendance</h3>
                                    <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mb-3">Track cumulative attendance, safe zone margins, and recovery classes.</p>
                                </div>
                                <div className="w-full py-2.5 sm:py-3 bg-emerald-50 dark:bg-emerald-950/40 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-900/50 text-emerald-900 dark:text-emerald-200 rounded-xl font-bold text-xs sm:text-sm text-center border-2 border-black dark:border-emerald-800/60 transition-colors flex items-center justify-center gap-1.5 shadow-sm mt-auto">
                                    <span>Check Attendance Status</span>
                                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                                </div>
                            </div>
                        </ThreeDParallaxCard>
                    </div>

                </div>

                <ExamCountdownSection />

            </main>

            {/* Pluto Maintenance Notice Modal */}
            <AnimatePresence>
                {plutoMaintenanceModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm"
                        onClick={() => setPlutoMaintenanceModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.92, opacity: 0, y: 16 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.92, opacity: 0, y: 16 }}
                            transition={{ type: "spring", stiffness: 350, damping: 25 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-white dark:bg-[#1e293b] rounded-3xl p-6 sm:p-8 max-w-md w-full border-2 border-black dark:border-slate-700/80 shadow-2xl relative overflow-hidden"
                        >
                            <button
                                onClick={() => setPlutoMaintenanceModal(false)}
                                className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                aria-label="Close"
                            >
                                <X className="w-5 h-5" />
                            </button>

                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800/60 flex items-center justify-center text-amber-700 dark:text-amber-400 shrink-0">
                                    <Wrench className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                                </div>
                                <div>
                                    <span className="px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 text-[10px] font-black uppercase tracking-wider">
                                        Under Maintenance
                                    </span>
                                    <h4 className="text-xl font-black text-slate-900 dark:text-white mt-0.5">Pluto AI is Offline</h4>
                                </div>
                            </div>

                            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-6">
                                Pluto AI coding mentor is currently undergoing scheduled infrastructure upgrades and system maintenance. Opening the assistant is temporarily paused. Please check back later!
                            </p>

                            <button
                                onClick={() => setPlutoMaintenanceModal(false)}
                                className="w-full py-3 bg-slate-900 hover:bg-black dark:bg-indigo-600 dark:hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-md active:scale-98 cursor-pointer"
                            >
                                Got it, Thanks
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
