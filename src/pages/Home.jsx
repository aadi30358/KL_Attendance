import { useState, useEffect, useRef, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, useMotionValue, useSpring, useTransform, useScroll, AnimatePresence } from 'framer-motion';
import { ArrowRight, Calculator, Calendar, Clock, Sparkles, CalendarDays, Bot, Flame, LogIn, Wrench, X, MapPin, Coffee, Utensils, Compass, User, Users, UserPlus, Key, BarChart3, ShieldCheck } from 'lucide-react';
import { getStudentTimetable, getLiveClassStatus, cleanRoomNumber, getSubjectName, getPresentAcademicYearAndSem, getTruePresentAcademicYearAndSem, DAYS_OF_WEEK, KLU_SESSIONS } from '../services/timetableService';
import { getActiveProfileDetails, getAllProfiles, setActiveProfileId, getSavedFriends, getSavedProfilesWithCredentials, profileHasCredentials, getEffectiveSavedProfile } from '../services/friendsService';
import { hasActiveErpSession } from '../services/erpService';
import AddFriendModal from '../components/AddFriendModal';
import FriendCaptchaModal from '../components/FriendCaptchaModal';

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
            {/* Dynamic Depth Background - hardware-accelerated for zero lag */}
            <div
                className={`hidden sm:block absolute inset-0 rounded-[2rem] sm:rounded-[2.5rem] opacity-20 blur-lg transition-colors duration-500 pointer-events-none ${colorClass.replace('text', 'bg')}`}
            />

            <div
                onClick={(e) => {
                    setIsClicked(!isClicked);
                    if (onClick) onClick(e);
                }}
                className={`relative h-full bg-white dark:bg-[#1e293b] border-2 transition-colors duration-300 rounded-[2rem] sm:rounded-[2.5rem] p-5 sm:p-7 shadow-lg hover:shadow-xl overflow-hidden flex flex-col justify-between z-10 cursor-pointer touch-pan-y ${
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

    // Live Class Tracking State & Hook (High-performance 15s interval, pauses when backgrounded)
    const [nowTick, setNowTick] = useState(() => Date.now());

    useEffect(() => {
        let timer = null;
        const startTimer = () => {
            if (!timer) {
                timer = setInterval(() => {
                    if (typeof document !== 'undefined' && document.hidden) return;
                    setNowTick(Date.now());
                }, 15000);
            }
        };
        const stopTimer = () => {
            if (timer) {
                clearInterval(timer);
                timer = null;
            }
        };
        const handleVisibility = () => {
            if (typeof document !== 'undefined' && document.hidden) {
                stopTimer();
            } else {
                setNowTick(Date.now());
                startTimer();
            }
        };

        startTimer();
        document.addEventListener('visibilitychange', handleVisibility);
        return () => {
            stopTimer();
            document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, []);

    const navigate = useNavigate();
    const [allProfiles, setAllProfiles] = useState(() => getAllProfiles());
    const [activeProfile, setActiveProfile] = useState(() => getActiveProfileDetails());
    const [showAddFriendModal, setShowAddFriendModal] = useState(false);
    const [captchaAttendanceTarget, setCaptchaAttendanceTarget] = useState(null);
    const [timetableTick, setTimetableTick] = useState(0);

    useEffect(() => {
        const updateProfiles = () => {
            const updated = getAllProfiles();
            setAllProfiles(updated);
            setActiveProfile(getActiveProfileDetails());
        };
        const handleTimetableUpdate = () => {
            setTimetableTick(t => t + 1);
        };
        window.addEventListener('kl_friends_updated', updateProfiles);
        window.addEventListener('kl_profile_switched', updateProfiles);
        window.addEventListener('kl_active_profile_updated', updateProfiles);
        window.addEventListener('kl_timetable_updated', handleTimetableUpdate);
        window.addEventListener('storage', updateProfiles);
        return () => {
            window.removeEventListener('kl_friends_updated', updateProfiles);
            window.removeEventListener('kl_profile_switched', updateProfiles);
            window.removeEventListener('kl_active_profile_updated', updateProfiles);
            window.removeEventListener('kl_timetable_updated', handleTimetableUpdate);
            window.removeEventListener('storage', updateProfiles);
        };
    }, []);

    // All saved accounts (Primary Account + any saved friends with valid IDs)
    const savedAccounts = useMemo(() => {
        return allProfiles.filter(p => Boolean((p.studentId || p.username || '').trim()));
    }, [allProfiles]);

    const hasAnySavedLogins = savedAccounts.length > 0;

    // Resolve effective saved profile:
    // If the currently selected profile is saved, use it.
    // Otherwise, automatically pick the first saved profile available.
    const effectiveProfile = useMemo(() => {
        if (activeProfile && (activeProfile.studentId || activeProfile.username)) {
            const found = savedAccounts.find(p => (p.id === activeProfile.id) || (p.studentId && p.studentId === activeProfile.studentId));
            if (found) return found;
            return activeProfile;
        }
        if (savedAccounts.length > 0) {
            return savedAccounts[0];
        }
        return null;
    }, [activeProfile, savedAccounts]);

    // Student ID: ONLY the saved account's ID, never arbitrary hardcoded fallbacks
    const activeStudentId = effectiveProfile?.studentId || effectiveProfile?.username || null;
    const hasSavedCredentials = Boolean(activeStudentId);

    const handleSwitchLiveProfile = (profile) => {
        const pid = profile?.id || 'main';
        const sid = profile?.studentId || profile?.username || '';
        if (sid) {
            try {
                localStorage.setItem('activeErpUser', sid);
            } catch { /* ignore */ }
        }
        setActiveProfileId(pid, sid);
        setActiveProfile(profile);
        window.dispatchEvent(new CustomEvent('kl_active_profile_updated', { detail: { profileId: pid, studentId: sid } }));
        window.dispatchEvent(new CustomEvent('kl_profile_switched', { detail: { profile, studentId: sid } }));
    };

    const handleQuickCheckAttendance = (profileToVerify = null) => {
        const target = profileToVerify || effectiveProfile || activeProfile;
        const targetSid = target?.studentId || target?.username || '';
        if (hasActiveErpSession(targetSid)) {
            navigate('/attendance-register');
            return;
        }
        if (target) {
            setCaptchaAttendanceTarget(target);
        } else {
            navigate('/login');
        }
    };

    const truePresentInfo = useMemo(() => {
        return getTruePresentAcademicYearAndSem(activeStudentId);
    }, [activeStudentId]);

    const [selectedSemOverride, setSelectedSemOverride] = useState(null);
    const [selectedYearOverride, setSelectedYearOverride] = useState(null);

    // Whenever active student changes, reset override so present sem is ALWAYS default
    useEffect(() => {
        setSelectedSemOverride(null);
        setSelectedYearOverride(null);
    }, [activeStudentId]);

    const activeYear = selectedYearOverride || truePresentInfo.year;
    const rawSem = selectedSemOverride || truePresentInfo.sem;

    const activeSem = useMemo(() => {
        const s = rawSem;
        if (s === 'Summer') return 'Summer Term';
        if (s === 'Term3') return 'Tri Sem / Term 3';
        if (s === 'Even') return 'Even Sem';
        return 'Odd Sem';
    }, [rawSem]);

    const isPresentSem = activeYear === truePresentInfo.year && rawSem === truePresentInfo.sem;

    const studentTimetable = useMemo(() => {
        void timetableTick;
        if (!activeStudentId) return {};
        return getStudentTimetable(activeStudentId, [], activeYear, activeSem);
    }, [activeStudentId, activeYear, activeSem, timetableTick]);

    const liveClassStatus = useMemo(() => {
        void nowTick;
        if (!activeStudentId) return null;
        return getLiveClassStatus(studentTimetable, activeStudentId);
    }, [studentTimetable, activeStudentId, nowTick]);

    const getCourseTitle = (slot) => {
        if (!slot) return '';
        const raw = (slot.rawCode || slot.code || '').replace(/-[LPTS]$/, '').trim();
        const baseName = getSubjectName(raw) || getSubjectName(slot.code) || slot.displayName || slot.title;
        if (!baseName || baseName === raw || baseName === slot.code) {
            if (raw.includes('24EDS3308')) return 'Embedded AI – Edge Intelligence and TinyML';
            if (raw.includes('24GMI3101')) return 'Principles of Deep Neural Computation';
            if (raw.includes('23EC1202')) return 'Digital Design and Computer Architecture';
        }
        return baseName || raw || slot.code;
    };

    const [displayMode, setDisplayMode] = useState('codes'); // 'codes' | 'aliases'
    const [editingFriend, setEditingFriend] = useState(null);

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
                        <Link
                            to={(() => {
                                try {
                                    const html = localStorage.getItem('erpDashboardHtml');
                                    const activeUser = localStorage.getItem('activeErpUser');
                                    const hasData = Boolean(
                                        (activeUser && localStorage.getItem(`kleData_${activeUser}`)) ||
                                        localStorage.getItem('kleData')
                                    );
                                    return (html && !html.includes('site-error')) || hasData ? '/attendance-register' : '/login';
                                } catch {
                                    return '/login';
                                }
                            })()}
                            className="flex-1 min-w-[125px]"
                        >
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
                                        <span>ERP Attendance</span>
                                    </>
                                )}
                            </motion.button>
                        </Link>
                    </div>
                </motion.div>

                {/* --- Live Class Tracker Widget (Present & After Class) --- */}
                <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="w-full max-w-4xl mb-6 sm:mb-8 z-20"
                >
                    <div className="bg-white/95 dark:bg-[#1e293b]/95 backdrop-blur-md text-slate-900 dark:text-white rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 border border-slate-200/90 dark:border-slate-700/80 shadow-md shadow-indigo-100/30 dark:shadow-none relative overflow-hidden transition-all duration-300">
                        {/* Soft Glow accent */}
                        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent dark:from-indigo-500/15 dark:via-purple-500/10 blur-3xl pointer-events-none" />

                        {/* Top Header */}
                        <div className="flex flex-wrap items-center justify-between gap-2.5 mb-3 pb-2.5 border-b border-slate-100 dark:border-slate-700/60">
                            <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800/60 flex items-center justify-center shadow-2xs">
                                    <Compass className="w-3.5 h-3.5 animate-spin-slow" />
                                </div>
                                <div>
                                    <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-1.5 leading-none">
                                        <span>Live Class Navigator</span>
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
                                    </h3>
                                    <p className="text-[10px] sm:text-[10.5px] text-slate-500 dark:text-slate-400 font-medium leading-none mt-1">
                                        Real-time lecture tracking & next class countdown
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                {hasAnySavedLogins && (
                                    <button
                                        type="button"
                                        onClick={() => handleQuickCheckAttendance(effectiveProfile)}
                                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/80 dark:hover:bg-emerald-900 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold transition-all border border-emerald-200/80 dark:border-emerald-700/60 shadow-2xs cursor-pointer active:scale-95"
                                        title="Check Attendance (Captcha Only)"
                                    >
                                        <BarChart3 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                        <span>Check Attendance</span>
                                    </button>
                                )}
                                <Link
                                    to="/timetable"
                                    className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-indigo-50/80 hover:bg-indigo-100 dark:bg-indigo-950/80 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 text-[11px] font-bold transition-all border border-indigo-200/80 dark:border-indigo-700/60 shadow-2xs group"
                                >
                                    <span>View Full Timetable</span>
                                    <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                                </Link>
                            </div>
                        </div>

                        {!hasAnySavedLogins ? (
                            <div className="py-8 px-4 text-center space-y-3">
                                <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/60 flex items-center justify-center mx-auto shadow-2xs">
                                    <Compass className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                                </div>
                                <div className="max-w-md mx-auto space-y-1">
                                    <h4 className="text-base font-black text-slate-900 dark:text-white">
                                        Login Required to Track Live Classes
                                    </h4>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                        Sign in to ERP or save your credentials to view ongoing lectures, room numbers, and next class countdown in real-time.
                                    </p>
                                </div>
                                <div className="pt-1">
                                    <Link
                                        to="/login"
                                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white transition-all shadow-md shadow-indigo-500/20 cursor-pointer"
                                    >
                                        <LogIn className="w-3.5 h-3.5" />
                                        <span>Login to ERP</span>
                                        <ArrowRight className="w-3.5 h-3.5" />
                                    </Link>
                                </div>
                            </div>
                        ) : (
                            <>
                                {/* Profile & Friend Switcher Tabs */}
                                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 mb-2.5 scrollbar-none">
                                    {savedAccounts.map((p) => {
                                        const isSelected = effectiveProfile ? (effectiveProfile.id === p.id) : (p.id === 'main');
                                        const pName = p.nickname || p.name || 'Account';
                                        const pId = p.studentId || p.username;
                                        return (
                                            <button
                                                key={p.id || pId}
                                                type="button"
                                                onClick={() => handleSwitchLiveProfile(p)}
                                                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 border ${
                                                    isSelected
                                                        ? 'bg-blue-600 hover:bg-blue-700 text-white border-blue-600 shadow-xs shadow-blue-500/25'
                                                        : 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/80 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-200/80 dark:border-slate-700/80'
                                                }`}
                                            >
                                                {p.isFriend ? <Users className="w-3 h-3" /> : <User className="w-3 h-3" />}
                                                <span>{pName}</span>
                                                {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
                                            </button>
                                        );
                                    })}

                                    <button
                                        type="button"
                                        onClick={() => {
                                            setEditingFriend(null);
                                            setShowAddFriendModal(true);
                                        }}
                                        className="px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 shrink-0 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/60 shadow-2xs"
                                    >
                                        <UserPlus className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                        <span>+ Add Friend</span>
                                    </button>
                                </div>

                                {/* Prominent Active Profile, Year/Sem & Time Badge */}
                                <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/60 mb-3 text-[11px]">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                        <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse shrink-0" />
                                        <span className="text-slate-500 dark:text-slate-400 font-medium">Viewing Live Schedule:</span>
                                        <span className="font-extrabold text-indigo-700 dark:text-indigo-300">
                                            {effectiveProfile?.nickname || 'My Account'}
                                        </span>
                                        <span className="text-[10px] font-mono text-slate-700 dark:text-slate-200 font-bold bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 shadow-2xs">
                                            ID: {activeStudentId}
                                        </span>
                                        <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800/60 px-2 py-0.5 rounded-full flex items-center gap-1 shadow-2xs">
                                            <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                                            <span>{isPresentSem ? 'Present Sem' : 'Selected Sem'}</span>
                                            <span>•</span>
                                            <span>{activeSem}</span>
                                        </span>
                                    </div>

                                    {liveClassStatus && (
                                        <div className="flex items-center gap-1.5 text-[10.5px] font-semibold text-slate-500 dark:text-slate-400">
                                            <span>{liveClassStatus.istDateString}</span>
                                            <span>•</span>
                                            <span className="font-mono font-bold text-indigo-600 dark:text-sky-400">{liveClassStatus.istTimeString}</span>
                                        </div>
                                    )}
                                </div>

                                {liveClassStatus && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                            {/* Column 1: Present / Ongoing Class or Free Period / Break */}
                            <div className="p-4 sm:p-5 rounded-2xl bg-[#090d16] text-white border border-slate-800/90 flex flex-col justify-between gap-3 shadow-xl hover:border-slate-700/80 transition-all">
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="flex items-center gap-2 text-[10px] sm:text-[11px] font-mono font-bold uppercase tracking-wider text-cyan-400/90">
                                            <span className={`w-2 h-2 rounded-full ${liveClassStatus.currentClass ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse' : 'bg-slate-500'}`} />
                                            <span>
                                                {liveClassStatus.currentClass
                                                    ? 'ONGOING CLASS (NOW)'
                                                    : liveClassStatus.isLunch
                                                    ? 'LUNCH BREAK'
                                                    : liveClassStatus.isFreePeriod
                                                    ? 'FREE PERIOD / BREAK'
                                                    : liveClassStatus.isBeforeCollege
                                                    ? 'UPCOMING TODAY'
                                                    : liveClassStatus.isDayEnded
                                                    ? 'CLASSES CONCLUDED'
                                                    : 'WEEKEND / NO CLASSES'}
                                            </span>
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono font-bold text-xs sm:text-[12.5px] text-cyan-400 tracking-wide">
                                                {liveClassStatus.istTimeWithSecondsString || liveClassStatus.istTimeString}
                                            </span>
                                        </div>
                                    </div>

                                    {liveClassStatus.currentClass ? (
                                        <div className="space-y-1.5 pt-0.5">
                                            <h4
                                                className="text-lg sm:text-xl font-black text-white leading-tight tracking-tight line-clamp-1"
                                                title={getCourseTitle(liveClassStatus.currentClass)}
                                            >
                                                {getCourseTitle(liveClassStatus.currentClass)}
                                            </h4>
                                            <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-300 pt-0.5">
                                                <span className="text-indigo-300 font-semibold text-xs">
                                                    {liveClassStatus.currentClass.slotId} ({liveClassStatus.currentClass.time})
                                                </span>
                                                {liveClassStatus.currentClass.room && (
                                                    <>
                                                        <span className="text-slate-500 font-bold">•</span>
                                                        <span className="inline-flex items-center gap-1 text-amber-400 font-bold text-xs">
                                                            <MapPin className="w-3.5 h-3.5 text-amber-400" />
                                                            <span>Room {cleanRoomNumber(liveClassStatus.currentClass.room)}</span>
                                                        </span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    ) : liveClassStatus.isLunch ? (
                                        <div className="space-y-1 py-1">
                                            <div className="flex items-center gap-2 text-amber-300 font-bold text-sm">
                                                <Utensils className="w-4 h-4 text-amber-400" />
                                                <span>Lunch Break (12:45 PM – 01:45 PM)</span>
                                            </div>
                                            <p className="text-xs text-slate-400">
                                                Afternoon academic sessions commence shortly.
                                            </p>
                                        </div>
                                    ) : liveClassStatus.isFreePeriod ? (
                                        <div className="space-y-1 py-1">
                                            <div className="flex items-center gap-2 text-sky-300 font-bold text-sm">
                                                <Coffee className="w-4 h-4 text-sky-400" />
                                                <span>Free Period / Library Break</span>
                                            </div>
                                            <p className="text-xs text-slate-400">
                                                No lecture scheduled right now. Review notes or prepare for the next session.
                                            </p>
                                        </div>
                                    ) : liveClassStatus.isBeforeCollege ? (
                                        <div className="space-y-1 py-1">
                                            <h4 className="text-sm font-bold text-slate-200 tracking-tight">
                                                Classes Begin Today at {liveClassStatus.firstClassToday?.time || '7:10 AM'}
                                            </h4>
                                            {liveClassStatus.firstClassToday ? (
                                                <p className="text-xs text-sky-400 font-medium leading-relaxed">
                                                    First Class: {liveClassStatus.firstClassToday.slotId} ({liveClassStatus.firstClassToday.time}) · {getCourseTitle(liveClassStatus.firstClassToday)} {liveClassStatus.firstClassToday.room ? `@ Room ${cleanRoomNumber(liveClassStatus.firstClassToday.room)}` : ''}
                                                </p>
                                            ) : null}
                                        </div>
                                    ) : liveClassStatus.isDayEnded ? (
                                        <div className="space-y-1 py-1">
                                            <h4 className="text-sm font-bold text-slate-200 tracking-tight">
                                                All Classes Completed for Today
                                            </h4>
                                            {liveClassStatus.nextWorkingDayFirstClass ? (
                                                <p className="text-xs text-sky-400 font-medium leading-relaxed">
                                                    Next Class: {liveClassStatus.nextWorkingDayFirstClass.relativeDay || liveClassStatus.nextWorkingDayFirstClass.day} {liveClassStatus.nextWorkingDayFirstClass.time} · {getCourseTitle(liveClassStatus.nextWorkingDayFirstClass)} {liveClassStatus.nextWorkingDayFirstClass.room ? `@ Room ${cleanRoomNumber(liveClassStatus.nextWorkingDayFirstClass.room)}` : ''}
                                                </p>
                                            ) : (
                                                <p className="text-xs text-slate-400">
                                                    All periods for today have concluded. Rest up and prepare for upcoming classes.
                                                </p>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="space-y-1 py-1">
                                            <h4 className="text-sm font-bold text-slate-200 tracking-tight">
                                                No Classes Scheduled Today ({liveClassStatus.dayName})
                                            </h4>
                                            {liveClassStatus.nextWorkingDayFirstClass ? (
                                                <p className="text-xs text-sky-400 font-medium leading-relaxed">
                                                    Next Class: {liveClassStatus.nextWorkingDayFirstClass.relativeDay || liveClassStatus.nextWorkingDayFirstClass.day} {liveClassStatus.nextWorkingDayFirstClass.time} · {getCourseTitle(liveClassStatus.nextWorkingDayFirstClass)} {liveClassStatus.nextWorkingDayFirstClass.room ? `@ Room ${cleanRoomNumber(liveClassStatus.nextWorkingDayFirstClass.room)}` : ''}
                                                </p>
                                            ) : (
                                                <p className="text-xs text-slate-400">
                                                    Enjoy your weekend / break!
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {liveClassStatus.currentClass ? (
                                    <div className="space-y-1.5 pt-1">
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="text-slate-400 font-medium">
                                                Class in progress ({liveClassStatus.currentClass.progressPercent || 0}%)
                                            </span>
                                            <span className="text-emerald-400 font-bold font-mono text-xs">
                                                {liveClassStatus.currentClass.minutesRemaining}m {liveClassStatus.currentClass.secondsRemaining ?? 0}s left
                                            </span>
                                        </div>
                                        <div className="w-full bg-[#18233d] rounded-full h-1.5 overflow-hidden">
                                            <div
                                                className="bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-400 h-full rounded-full transition-all duration-1000 ease-linear shadow-[0_0_8px_rgba(129,140,248,0.6)]"
                                                style={{ width: `${liveClassStatus.currentClass.progressPercent || 0}%` }}
                                            />
                                        </div>
                                    </div>
                                ) : null}
                            </div>

                            {/* Column 2: After Class (Upcoming Next Class) */}
                            <div className="p-4 sm:p-5 rounded-2xl bg-[#090d16] text-white border border-slate-800/90 flex flex-col justify-between gap-3 shadow-xl hover:border-slate-700/80 transition-all">
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] sm:text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400">
                                            NEXT CLASS (UPCOMING)
                                        </span>
                                        {liveClassStatus.nextClass ? (
                                            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[#181d38] text-indigo-300 border border-indigo-700/60 font-mono tracking-wider">
                                                {liveClassStatus.nextClass.minutesUntil <= 60 ? `Starts in ${liveClassStatus.nextClass.minutesUntil}m` : 'Next Up'}
                                            </span>
                                        ) : liveClassStatus.isBeforeCollege ? (
                                            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[#181d38] text-sky-300 border border-sky-700/60 font-mono tracking-wider">
                                                First Period
                                            </span>
                                        ) : liveClassStatus.isWeekendOrNoClass ? (
                                            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-800/80 text-slate-400 border border-slate-700 font-mono">
                                                Weekend
                                            </span>
                                        ) : (
                                            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-800/80 text-slate-400 border border-slate-700 font-mono">
                                                Concluded
                                            </span>
                                        )}
                                    </div>

                                    {liveClassStatus.nextClass ? (
                                        <div className="space-y-1.5 pt-0.5">
                                            <h4
                                                className="text-lg sm:text-xl font-black text-white leading-tight tracking-tight line-clamp-1"
                                                title={getCourseTitle(liveClassStatus.nextClass)}
                                            >
                                                {getCourseTitle(liveClassStatus.nextClass)}
                                            </h4>
                                            <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-300 pt-0.5">
                                                <span className="text-indigo-300 font-semibold text-xs">
                                                    {liveClassStatus.nextClass.slotId} ({liveClassStatus.nextClass.time})
                                                </span>
                                                {liveClassStatus.nextClass.room && (
                                                    <>
                                                        <span className="text-slate-500 font-bold">•</span>
                                                        <span className="inline-flex items-center gap-1 text-amber-400 font-bold text-xs">
                                                            <MapPin className="w-3.5 h-3.5 text-amber-400" />
                                                            <span>Room {cleanRoomNumber(liveClassStatus.nextClass.room)}</span>
                                                        </span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    ) : liveClassStatus.isBeforeCollege && liveClassStatus.firstClassToday ? (
                                        <div className="space-y-1.5 pt-0.5">
                                            <h4
                                                className="text-lg sm:text-xl font-black text-white leading-tight tracking-tight line-clamp-1"
                                                title={getCourseTitle(liveClassStatus.firstClassToday)}
                                            >
                                                {getCourseTitle(liveClassStatus.firstClassToday)}
                                            </h4>
                                            <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-300 pt-0.5">
                                                <span className="text-indigo-300 font-semibold text-xs">
                                                    {liveClassStatus.firstClassToday.slotId} ({liveClassStatus.firstClassToday.time})
                                                </span>
                                                {liveClassStatus.firstClassToday.room && (
                                                    <>
                                                        <span className="text-slate-500 font-bold">•</span>
                                                        <span className="inline-flex items-center gap-1 text-amber-400 font-bold text-xs">
                                                            <MapPin className="w-3.5 h-3.5 text-amber-400" />
                                                            <span>Room {cleanRoomNumber(liveClassStatus.firstClassToday.room)}</span>
                                                        </span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    ) : liveClassStatus.nextWorkingDayFirstClass ? (
                                        <div className="space-y-1.5 pt-0.5">
                                            <h4
                                                className="text-base sm:text-lg font-black text-white leading-tight tracking-tight line-clamp-1"
                                                title={getCourseTitle(liveClassStatus.nextWorkingDayFirstClass)}
                                            >
                                                {liveClassStatus.nextWorkingDayFirstClass.relativeDay}: {getCourseTitle(liveClassStatus.nextWorkingDayFirstClass)}
                                            </h4>
                                            <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-300 pt-0.5">
                                                <span className="text-indigo-300 font-semibold text-xs">
                                                    {liveClassStatus.nextWorkingDayFirstClass.slotId} ({liveClassStatus.nextWorkingDayFirstClass.time})
                                                </span>
                                                {liveClassStatus.nextWorkingDayFirstClass.room && (
                                                    <>
                                                        <span className="text-slate-500 font-bold">•</span>
                                                        <span className="inline-flex items-center gap-1 text-amber-400 font-bold text-xs">
                                                            <MapPin className="w-3.5 h-3.5 text-amber-400" />
                                                            <span>Room {cleanRoomNumber(liveClassStatus.nextWorkingDayFirstClass.room)}</span>
                                                        </span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-1 py-1">
                                            <h4 className="text-sm font-bold text-slate-300 tracking-tight">
                                                No More Classes Scheduled Today
                                            </h4>
                                            <p className="text-xs text-slate-400 leading-relaxed">
                                                All periods for today have been completed.
                                            </p>
                                        </div>
                                    )}
                                </div>

                                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400 mt-2">
                                    <span className="truncate max-w-[200px] sm:max-w-xs">
                                        Previous: {liveClassStatus.previousClass ? (
                                            <strong className="text-slate-300 font-semibold">
                                                {getCourseTitle(liveClassStatus.previousClass)}{liveClassStatus.previousClass.room ? ` (Rm ${cleanRoomNumber(liveClassStatus.previousClass.room)})` : ''}
                                            </strong>
                                        ) : (liveClassStatus.isDayEnded && liveClassStatus.todaySchedule.length > 0) ? (
                                            <strong className="text-slate-300 font-semibold">
                                                {getCourseTitle(liveClassStatus.todaySchedule[liveClassStatus.todaySchedule.length - 1])}
                                            </strong>
                                        ) : (
                                            <span className="text-slate-500 font-medium">None</span>
                                        )}
                                    </span>
                                    <span className="font-mono text-white font-bold shrink-0 text-xs">
                                        {liveClassStatus.nextClass ? liveClassStatus.nextClass.time : (liveClassStatus.nextWorkingDayFirstClass ? `${liveClassStatus.nextWorkingDayFirstClass.relativeDay} ${liveClassStatus.nextWorkingDayFirstClass.time.split('–')[0].trim()}` : 'None')}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}

                        {/* ── Present Sem Default Timetable (Week Matrix Only) with Generous Gap ── */}
                        {!hasAnySavedLogins ? (
                            /* Notice when there are NO saved logins in the website */
                            <div className="mt-8 pt-6 border-t border-slate-200/70 dark:border-slate-700/60">
                                <div className="p-6 sm:p-8 rounded-2xl bg-gradient-to-br from-indigo-50/70 via-white to-slate-50 dark:from-slate-800/80 dark:via-slate-800/50 dark:to-slate-800/80 border border-indigo-100 dark:border-slate-700 text-center space-y-4 shadow-2xs">
                                    <div className="w-12 h-12 rounded-2xl bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/60 flex items-center justify-center mx-auto shadow-2xs">
                                        <CalendarDays className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                                    </div>
                                    <div className="max-w-md mx-auto space-y-1.5">
                                        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-100/80 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-[10px] font-black uppercase tracking-wider">
                                            <Key className="w-3 h-3" />
                                            <span>Login Required</span>
                                        </div>
                                        <h4 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                                            Login to View Your Timetable
                                        </h4>
                                        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                                            After login you can see your personalized weekly timetable, class timings, and classrooms here.
                                        </p>
                                    </div>
                                    <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                                        <Link
                                            to="/login"
                                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 active:scale-95 text-white transition-all shadow-md shadow-indigo-500/25 cursor-pointer"
                                        >
                                            <LogIn className="w-4 h-4" />
                                            <span>Login to ERP</span>
                                            <ArrowRight className="w-4 h-4" />
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        ) : hasSavedCredentials ? (
                            <div className="mt-8 pt-6 border-t border-slate-200/70 dark:border-slate-700/60 space-y-4">
                                {/* Section Header matching Image 2 */}
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <CalendarDays className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                                            <h4 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                                                <span>Weekly Timetable</span>
                                                <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-200/80 dark:border-indigo-800 px-2 py-0.5 rounded-md">
                                                    {effectiveProfile?.nickname || 'Account'} · {activeYear} · {activeSem}
                                                </span>
                                            </h4>
                                        </div>
                                        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                                            Class schedules, classrooms, and timing breakdown for ID: {activeStudentId}
                                        </p>
                                    </div>

                                    {/* View Controls: Semester Pills, Codes vs Aliases & View Full Timetable Link */}
                                    <div className="flex flex-wrap items-center gap-2">
                                        {/* Semester Selector Pills (Default is always Present Sem) */}
                                        <div className="inline-flex bg-slate-100 dark:bg-slate-800/90 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700/80">
                                            {[
                                                { key: 'Odd', label: 'Odd Sem' },
                                                { key: 'Even', label: 'Even Sem' },
                                                { key: 'Summer', label: 'Summer Term' },
                                                { key: 'Term3', label: 'Tri Sem' }
                                            ].map((semOption) => {
                                                const isSelected = rawSem === semOption.key;
                                                const isTruePresent = truePresentInfo.sem === semOption.key;
                                                return (
                                                    <button
                                                        key={semOption.key}
                                                        type="button"
                                                        onClick={() => {
                                                            if (isTruePresent) {
                                                                setSelectedSemOverride(null);
                                                            } else {
                                                                setSelectedSemOverride(semOption.key);
                                                            }
                                                        }}
                                                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                                                            isSelected
                                                                ? 'bg-white dark:bg-slate-700 text-indigo-900 dark:text-white shadow-2xs'
                                                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                                        }`}
                                                    >
                                                        {isTruePresent && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" title="Present Semester" />}
                                                        <span>{semOption.label}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        {/* Codes vs Aliases Toggle */}
                                        <div className="inline-flex bg-slate-100 dark:bg-slate-800/90 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700/80">
                                            <button
                                                type="button"
                                                onClick={() => setDisplayMode('codes')}
                                                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                                    displayMode === 'codes'
                                                        ? 'bg-white dark:bg-slate-700 text-indigo-900 dark:text-white shadow-2xs'
                                                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                                }`}
                                            >
                                                Codes
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setDisplayMode('aliases')}
                                                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                                    displayMode === 'aliases'
                                                        ? 'bg-white dark:bg-slate-700 text-indigo-900 dark:text-white shadow-2xs'
                                                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                                }`}
                                            >
                                                Aliases 🏷️
                                            </button>
                                        </div>

                                        {/* View Full Timetable Option (matching Image 3) */}
                                        <Link
                                            to="/timetable"
                                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/80 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 text-xs font-bold transition-all border border-indigo-200/90 dark:border-indigo-700/60 shadow-2xs group"
                                            title="Open full timetable page"
                                        >
                                            <span>View Full Timetable</span>
                                            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                                        </Link>
                                    </div>
                                </div>

                                {/* Compact Week Matrix Table (fits mobile with smooth horizontal scroll) */}
                                <div className="rounded-2xl border border-slate-200/90 dark:border-slate-700/70 overflow-hidden bg-white dark:bg-slate-900/60 shadow-2xs">
                                    <div className="overflow-x-auto scrollbar-thin">
                                        <table className="w-full text-xs border-collapse text-center">
                                            <thead>
                                                <tr className="border-b border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-800/80">
                                                    <th className="sticky left-0 bg-slate-100 dark:bg-slate-800 text-center p-2.5 border-r border-slate-200 dark:border-slate-700 z-20 w-16 min-w-[64px]">
                                                        <span className="text-[10px] sm:text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                                                            Day
                                                        </span>
                                                    </th>
                                                    {KLU_SESSIONS.map((sess) => (
                                                        <th
                                                            key={sess.id}
                                                            className="p-1.5 sm:p-2 min-w-[100px] w-[100px] sm:min-w-[115px] sm:w-[115px] border-r border-slate-200 dark:border-slate-700/80 text-center font-bold text-slate-700 dark:text-slate-300 align-middle"
                                                        >
                                                            <div className="inline-block px-1.5 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800/60 bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 font-bold text-[10px] mb-0.5">
                                                                {sess.id}
                                                            </div>
                                                            <div className="text-[9px] text-slate-500 dark:text-slate-400 font-normal font-mono whitespace-nowrap">
                                                                {sess.start}–{sess.end}
                                                            </div>
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>

                                            <tbody className="divide-y divide-slate-200 dark:divide-slate-700/70">
                                                {DAYS_OF_WEEK.map((day) => {
                                                    const slots = studentTimetable[day] || [];
                                                    const isToday = liveClassStatus.dayName === day;

                                                    return (
                                                        <tr
                                                            key={day}
                                                            className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors ${
                                                                isToday ? 'bg-indigo-50/30 dark:bg-indigo-950/20' : ''
                                                            }`}
                                                        >
                                                            <td
                                                                className={`sticky left-0 p-2.5 border-r border-slate-200 dark:border-slate-700 font-bold z-10 ${
                                                                    isToday
                                                                        ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-900 dark:text-indigo-200'
                                                                        : 'bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200'
                                                                }`}
                                                            >
                                                                <span className="block text-[11px] font-black uppercase">{day.slice(0, 3)}</span>
                                                                {isToday && (
                                                                    <span className="text-[8px] font-black text-indigo-600 dark:text-sky-400 block mt-0.5">
                                                                        TODAY
                                                                    </span>
                                                                )}
                                                            </td>

                                                            {KLU_SESSIONS.map((sess) => {
                                                                const classItem = slots.find(
                                                                    (s) => s.period === sess.slot || s.slotId === sess.id || (s.period <= sess.slot && sess.slot <= (s.periodEnd || (s.period + (s.span || 1) - 1)))
                                                                );
                                                                if (!classItem) {
                                                                    return (
                                                                        <td
                                                                            key={sess.id}
                                                                            className="p-2 border-r border-slate-200 dark:border-slate-700/70 text-slate-300 dark:text-slate-600 font-mono text-center text-xs"
                                                                        >
                                                                            —
                                                                        </td>
                                                                    );
                                                                }

                                                                const isLab =
                                                                    (classItem.component || classItem.type || '').toLowerCase().includes('pract') ||
                                                                    classItem.code.endsWith('-P');
                                                                const isSkill =
                                                                    (classItem.component || classItem.type || '').toLowerCase().includes('skill') ||
                                                                    classItem.code.endsWith('-S');
                                                                const isTut =
                                                                    (classItem.component || classItem.type || '').toLowerCase().includes('tut') ||
                                                                    classItem.code.endsWith('-T');

                                                                const displayTitle =
                                                                    displayMode === 'codes'
                                                                        ? classItem.code
                                                                        : getSubjectName(classItem.rawCode || classItem.code) || classItem.code;

                                                                return (
                                                                    <td
                                                                        key={sess.id}
                                                                        className={`p-2 border-r border-slate-200 dark:border-slate-700/70 align-middle ${
                                                                            isLab
                                                                                ? 'bg-emerald-50/85 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-200'
                                                                                : isSkill
                                                                                ? 'bg-purple-50/85 dark:bg-purple-950/40 text-purple-950 dark:text-purple-200'
                                                                                : isTut
                                                                                ? 'bg-amber-50/85 dark:bg-amber-950/40 text-amber-950 dark:text-amber-200'
                                                                                : 'bg-blue-50/85 dark:bg-blue-950/40 text-blue-950 dark:text-blue-200'
                                                                        }`}
                                                                    >
                                                                        <div className="space-y-0.5">
                                                                            <div
                                                                                className="font-bold text-[10px] leading-snug line-clamp-2 text-slate-900 dark:text-slate-100"
                                                                                title={displayTitle}
                                                                            >
                                                                                {displayTitle}
                                                                            </div>
                                                                            <div className="text-[9px] text-slate-600 dark:text-slate-400 font-medium leading-tight truncate">
                                                                                {classItem.section ? `${classItem.section} · ` : ''}
                                                                                {classItem.room ? `Rm ${cleanRoomNumber(classItem.room)}` : ''}
                                                                            </div>
                                                                        </div>
                                                                    </td>
                                                                );
                                                            })}
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            /* Prompt card when credentials are not saved for this friend */
                            <div className="mt-6 p-6 sm:p-7 rounded-2xl bg-gradient-to-br from-indigo-50/50 via-slate-50 to-purple-50/30 dark:from-slate-800/60 dark:via-slate-800/40 dark:to-slate-800/60 border border-indigo-100 dark:border-slate-700/80 text-center space-y-3.5 shadow-2xs">
                                <div className="w-10 h-10 rounded-2xl bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/60 flex items-center justify-center mx-auto shadow-2xs">
                                    <Key className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                                </div>
                                <div className="max-w-md mx-auto space-y-1">
                                    <h4 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                                        Save Credentials for {activeProfile?.nickname || 'Friend'} to View Timetable
                                    </h4>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                        The full weekly timetable for the present semester ({activeYear} · {activeSem}) is automatically displayed here when ERP credentials are saved for this account.
                                    </p>
                                </div>
                                <div className="pt-1 flex items-center justify-center gap-2.5">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setEditingFriend(activeProfile);
                                            setShowAddFriendModal(true);
                                        }}
                                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white transition-all shadow-md shadow-indigo-500/20 cursor-pointer"
                                    >
                                        <Key className="w-3.5 h-3.5" />
                                        <span>Save Credentials</span>
                                    </button>
                                    <Link
                                        to="/timetable"
                                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-all shadow-2xs"
                                    >
                                        <span>View Full Timetable</span>
                                        <ArrowRight className="w-3.5 h-3.5" />
                                    </Link>
                                </div>
                            </div>
                        )}
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

            {/* Add Friend Modal from Live Class Navigator */}
            <AddFriendModal
                isOpen={showAddFriendModal}
                initialFriend={editingFriend}
                isMyProfile={editingFriend?.id === 'main'}
                onClose={() => {
                    setShowAddFriendModal(false);
                    setEditingFriend(null);
                }}
                onFriendSaved={(newFriend) => {
                    setShowAddFriendModal(false);
                    setEditingFriend(null);
                    if (newFriend) {
                        handleSwitchLiveProfile(newFriend);
                        const sid = newFriend.studentId || newFriend.id;
                        if (sid) {
                            try {
                                localStorage.setItem('activeErpUser', sid);
                            } catch { /* ignore */ }
                        }
                    }
                    navigate('/attendance-register');
                }}
            />

            {/* Quick Attendance Captcha Verification Modal */}
            <FriendCaptchaModal
                friend={captchaAttendanceTarget}
                isOpen={Boolean(captchaAttendanceTarget)}
                onClose={() => setCaptchaAttendanceTarget(null)}
                onSuccess={() => {
                    setCaptchaAttendanceTarget(null);
                    navigate('/attendance-register');
                }}
            />
        </div>
    );
}
