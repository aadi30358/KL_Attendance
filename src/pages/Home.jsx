import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useMotionValue, useSpring, useTransform, useScroll } from 'framer-motion';
import { ArrowRight, Calculator, BookOpen, ShieldCheck, Calendar, TrendingUp, Clock, Sparkles, Activity } from 'lucide-react';
import ERPLoginCard from '../components/ERPLoginCard';

// --- Ultra-Advanced 3D Parallax Card ---
const ThreeDParallaxCard = ({ children, className, icon: Icon, colorClass, to, accentColor }) => {
    const ref = useRef(null);
    const x = useMotionValue(0);
    const y = useMotionValue(0);

    const mouseXSpring = useSpring(x, { stiffness: 300, damping: 30 });
    const mouseYSpring = useSpring(y, { stiffness: 300, damping: 30 });

    const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["15deg", "-15deg"]);
    const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-15deg", "15deg"]);

    // Internal element parallax
    const iconX = useTransform(mouseXSpring, [-0.5, 0.5], ["15px", "-15px"]);
    const iconY = useTransform(mouseYSpring, [-0.5, 0.5], ["15px", "-15px"]);

    const bgX = useTransform(mouseXSpring, [-0.5, 0.5], ["-20px", "20px"]);
    const bgY = useTransform(mouseYSpring, [-0.5, 0.5], ["-20px", "20px"]);

    const handleMouseMove = (e) => {
        if (!ref.current) return;
        const rect = ref.current.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        x.set(mouseX / width - 0.5);
        y.set(mouseY / height - 0.5);
    };

    const handleMouseLeave = () => {
        x.set(0);
        y.set(0);
    };

    const CardContent = (
        <motion.div
            ref={ref}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            style={{
                rotateY,
                rotateX,
                transformStyle: "preserve-3d",
            }}
            className={`relative h-full transition-all duration-200 ease-out group ${className}`}
        >
            {/* Dynamic Depth Background */}
            <motion.div
                style={{ x: bgX, y: bgY, transform: "translateZ(-50px)" }}
                className={`absolute inset-0 rounded-[2.5rem] opacity-30 blur-2xl transition-colors duration-500 ${colorClass.replace('text', 'bg')}`}
            />

            <div className="relative h-full bg-white/80 backdrop-blur-xl border border-white/60 rounded-[2.5rem] p-6 sm:p-8 shadow-2xl overflow-hidden flex flex-col justify-between z-10">
                {/* Shine Effect */}
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white/80 via-transparent to-transparent opacity-50 pointer-events-none" />

                <div className="relative z-10 transform-style-3d">
                    <div className="flex justify-between items-start mb-6">
                        <motion.div
                            style={{ x: iconX, y: iconY, transform: "translateZ(40px)" }}
                            className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg ${accentColor}`}
                        >
                            <Icon className={`w-8 h-8 text-white`} />
                        </motion.div>
                        {to && (
                            <motion.div
                                style={{ transform: "translateZ(30px)" }}
                                className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-slate-900 group-hover:text-white transition-colors duration-300"
                            >
                                <ArrowRight className="w-5 h-5 -rotate-45 group-hover:rotate-0 transition-transform duration-300" />
                            </motion.div>
                        )}
                    </div>

                    <motion.div style={{ transform: "translateZ(30px)" }}>
                        {children}
                    </motion.div>
                </div>
            </div>
        </motion.div>
    );

    if (to) {
        return <Link to={to} className="h-full block perspective-1000">{CardContent}</Link>;
    }
    return <div className="h-full perspective-1000">{CardContent}</div>;
};

// --- Animated Counter ---
const TypewriterText = ({ text, delay = 0 }) => {
    const letters = Array.from(text);
    return (
        <motion.span className="inline-block whitespace-nowrap">
            {letters.map((letter, index) => (
                <motion.span
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                        duration: 0.2,
                        delay: delay + index * 0.05,
                        type: "spring"
                    }}
                    className="inline-block"
                >
                    {letter === " " ? "\u00A0" : letter}
                </motion.span>
            ))}
        </motion.span>
    );
};

// --- Countdown Component ---
const ExamCountdownSection = () => {
    const [timeLeft, setTimeLeft] = useState({});

    useEffect(() => {
        const calculateTimeLeft = () => {
            const now = new Date();
            const dates = {
                semIn1: new Date('2026-02-02T00:00:00'),
                labSemIn: new Date('2026-03-09T00:00:00'),
                semIn2: new Date('2026-04-13T00:00:00'),
                semEnd: new Date('2026-04-20T00:00:00'),
            };
            const calc = (target) => {
                const diff = target - now;
                if (diff <= 0) return { days: 0, hours: 0, mins: 0, secs: 0 };
                return {
                    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
                    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
                    mins: Math.floor((diff / 1000 / 60) % 60),
                    secs: Math.floor((diff / 1000) % 60),
                };
            };
            setTimeLeft({
                semIn1: calc(dates.semIn1),
                labSemIn: calc(dates.labSemIn),
                semIn2: calc(dates.semIn2),
                semEnd: calc(dates.semEnd),
            });
        };
        const t = setInterval(calculateTimeLeft, 1000);
        calculateTimeLeft();
        return () => clearInterval(t);
    }, []);

    const items = [
        { label: "Sem-In 1", date: "02 Feb", time: timeLeft.semIn1, color: "from-blue-400 to-indigo-600", shadow: "shadow-blue-200" },
        { label: "Lab Sem-In", date: "09 Mar", time: timeLeft.labSemIn, color: "from-emerald-400 to-teal-600", shadow: "shadow-emerald-200" },
        { label: "Sem-In 2", date: "13 Apr", time: timeLeft.semIn2, color: "from-violet-400 to-fuchsia-600", shadow: "shadow-violet-200" },
        { label: "Sem End", date: "20 Apr", time: timeLeft.semEnd, color: "from-amber-400 to-orange-600", shadow: "shadow-amber-200" }
    ];

    return (
        <div className="w-full mt-32 relative z-10">
            <div className="flex items-center gap-4 mb-10 px-4">
                <div className="h-10 w-1 bg-indigo-600 rounded-full" />
                <h2 className="text-3xl font-bold text-slate-900">Y24 Even Sem. Countdown for Exams</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {items.map((item, idx) => (
                    <motion.div
                        key={idx}
                        initial={{ opacity: 0, y: 50 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: "-50px" }}
                        transition={{ delay: idx * 0.1 }}
                        whileHover={{ scale: 1.05, y: -10 }}
                        whileTap={{ scale: 0.95 }}
                        className={`group relative bg-white rounded-[2rem] p-1 shadow-lg hover:shadow-2xl transition-all duration-300 ${item.shadow}`}
                    >
                        {/* Gradient Border Effect */}
                        <div className={`absolute inset-0 bg-gradient-to-br ${item.color} rounded-[2rem] opacity-0 group-hover:opacity-100 blur transition-opacity duration-300`} />

                        {/* Card Content */}
                        <div className="relative bg-white rounded-[1.8rem] p-6 h-full border border-slate-100 flex flex-col justify-between z-10">
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <h4 className="font-extrabold text-slate-800 text-lg tracking-tight">{item.label}</h4>
                                    <div className={`mt-2 inline-flex px-3 py-1 rounded-full bg-gradient-to-r ${item.color} bg-opacity-10 opacity-80`}>
                                        <span className="text-[10px] font-bold text-white uppercase tracking-wider">{item.date}</span>
                                    </div>
                                </div>
                                <div className={`p-2 rounded-full bg-gradient-to-br ${item.color} text-white shadow-md`}>
                                    <Clock className="w-4 h-4" />
                                </div>
                            </div>

                            <div className="grid grid-cols-4 gap-2 text-center">
                                {[
                                    ['Day', item.time?.days || 0],
                                    ['Hrs', item.time?.hours || 0],
                                    ['Min', item.time?.mins || 0],
                                    ['Sec', item.time?.secs || 0]
                                ].map(([l, v], i) => (
                                    <div key={i} className="flex flex-col items-center">
                                        <div className="bg-slate-50 w-full rounded-xl py-3 border border-slate-100 group-hover:border-slate-200 transition-colors">
                                            <span className="block text-xl font-black text-slate-800 leading-none mb-1">{v}</span>
                                        </div>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase mt-1.5">{l}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
};

// --- Staggered Text Animation ---
const StaggeredText = ({ text, className, delay = 0 }) => {
    // Split text into words to handle spacing correctly, then letters
    const words = text.split(" ");

    return (
        <motion.span
            className={`inline-flex flex-wrap justify-center gap-x-3 ${className}`}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={{
                visible: { transition: { staggerChildren: 0.05, delayChildren: delay } }
            }}
        >
            {words.map((word, wordIndex) => (
                <span key={wordIndex} className="inline-flex">
                    {word.split("").map((char, charIndex) => (
                        <motion.span
                            key={`${wordIndex}-${charIndex}`}
                            variants={{
                                hidden: { opacity: 0, y: 50, rotateX: -90 },
                                visible: { opacity: 1, y: 0, rotateX: 0 }
                            }}
                            transition={{ type: "spring", damping: 10, stiffness: 100 }}
                            className="inline-block origin-bottom"
                        >
                            {char}
                        </motion.span>
                    ))}
                </span>
            ))}
        </motion.span>
    );
};

import SEO from '../components/SEO';

export default function Home() {
    const { scrollY } = useScroll();
    const heroY = useTransform(scrollY, [0, 500], [0, 150]);
    const heroOpacity = useTransform(scrollY, [0, 300], [1, 0]);

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
        <div className="relative min-h-[calc(100vh-5rem)] overflow-hidden bg-[#FAFAFA] selection:bg-indigo-500 selection:text-white perspective-root-lg">
            <SEO
                title="Home | Master Academic Journey"
                description="Track attendance, calculate LTPS, and ace your exams with the KL Attendance Manager."
            />

            {/* --- Advanced Ambient Background --- */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-slate-50 to-white opacity-80" />

                {/* Aurora Borealis Effect */}
                <motion.div
                    animate={{
                        scale: [1, 1.2, 1],
                        opacity: [0.3, 0.5, 0.3],
                        filter: ["hue-rotate(0deg)", "hue-rotate(90deg)", "hue-rotate(0deg)"]
                    }}
                    transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                    className="absolute -top-[30%] -left-[10%] w-[80vw] h-[80vw] rounded-full bg-gradient-to-r from-indigo-200 via-purple-200 to-pink-200 blur-[150px]"
                />

                <motion.div
                    animate={{
                        x: [0, 100, 0],
                        opacity: [0.2, 0.4, 0.2]
                    }}
                    transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute top-[40%] -right-[20%] w-[60vw] h-[60vw] rounded-full bg-gradient-to-l from-blue-200 via-teal-200 to-emerald-200 blur-[150px]"
                />

                {/* 3D Floating Particles */}
                <div className="absolute inset-0 preserve-3d">
                    {particles.map((p) => (
                        <motion.div
                            key={p.id}
                            className="absolute rounded-full bg-gradient-to-br from-white to-slate-100 shadow-xl border border-white/50 backdrop-blur-md"
                            style={{
                                width: p.width,
                                height: p.height,
                                left: p.left,
                                top: p.top,
                                zIndex: -1
                            }}
                            animate={{
                                y: [0, -100, 0],
                                rotateX: [0, 180, 360],
                                rotateY: [0, 180, 360]
                            }}
                            transition={{
                                duration: p.duration,
                                repeat: Infinity,
                                ease: "linear"
                            }}
                        />
                    ))}
                </div>

                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-overlay" />
            </div>

            <main className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 flex flex-col items-center">

                {/* --- Hero Section --- */}
                <motion.div
                    style={{ y: heroY, opacity: heroOpacity }}
                    className="relative z-10 w-full text-center flex flex-col items-center mb-32"
                >
                    <motion.div
                        initial={{ scale: 0, rotate: -180 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ type: "spring", stiffness: 200, damping: 20 }}
                        className="w-20 h-20 mb-8 rounded-3xl bg-white shadow-2xl shadow-indigo-200 flex items-center justify-center relative group"
                    >
                        <div className="absolute inset-0 bg-indigo-500 rounded-3xl blur-xl opacity-20 group-hover:opacity-40 transition-opacity" />
                        <Sparkles className="w-10 h-10 text-indigo-600 animate-pulse-slow" />
                    </motion.div>

                    <h1 className="text-4xl sm:text-6xl lg:text-8xl font-black text-slate-900 tracking-tighter leading-[0.9] mb-8 relative perspective-1000 flex flex-col items-center">
                        <div className="mb-2">
                            <StaggeredText text="Master Your" className="text-slate-900" delay={0.2} />
                        </div>
                        <div className="relative inline-block">
                            <StaggeredText
                                text="Academic Journey"
                                className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-600 animate-gradient bg-300-percent"
                                delay={0.8}
                            />
                            <motion.div
                                className="absolute -top-12 -right-4 text-6xl opacity-50 blur-[2px]"
                                animate={{ y: [0, -20, 0], rotate: [10, -10, 10] }}
                                transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                            >
                                🚀
                            </motion.div>
                        </div>
                    </h1>

                    <div className="text-xl text-slate-500 font-medium max-w-2xl leading-relaxed mb-12 h-8">
                        <TypewriterText text="The next-generation academic suite for KLU students." delay={0.5} />
                    </div>

                    <div className="flex gap-4 perspective-1000">
                        <Link to="/ltps">
                            <motion.button
                                whileHover={{ scale: 1.05, translateZ: 20 }}
                                whileTap={{ scale: 0.95 }}
                                className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-bold shadow-2xl shadow-slate-900/30 flex items-center gap-2 group"
                            >
                                <Calculator className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                                Launch Engine
                            </motion.button>
                        </Link>
                        <Link to="/attendance">
                            <motion.button
                                whileHover={{ scale: 1.05, translateZ: 20 }}
                                whileTap={{ scale: 0.95 }}
                                className="px-8 py-4 bg-white text-slate-900 border border-slate-200 rounded-2xl font-bold shadow-xl flex items-center gap-2 group hover:border-indigo-200"
                            >
                                <Activity className="w-5 h-5 text-indigo-500 group-hover:scale-110 transition-transform" />
                                Live Status
                            </motion.button>
                        </Link>
                    </div>
                </motion.div>

                {/* --- 3D Grid Section --- */}
                <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-8 perspective-2000">

                    {/* 1. LTPS Engine - Large Card */}
                    <div className="md:col-span-2 h-[400px]">
                        <ThreeDParallaxCard
                            to="/ltps"
                            icon={Calculator}
                            colorClass="text-indigo-500"
                            accentColor="bg-indigo-600"
                        >
                            <h3 className="text-2xl sm:text-3xl font-black text-slate-900 mb-2">L-T-P-S Logic Engine</h3>
                            <p className="text-slate-500 text-sm sm:text-lg mb-8 max-w-sm">Precision calculation based on the latest KLU weightage algorithms. Visualize your grades in 3D.</p>

                            {/* Detailed 3D Mockup inside Card */}
                            <div className="absolute -bottom-2 -right-2 sm:bottom-6 sm:right-6 w-32 h-24 sm:w-48 sm:h-32 bg-slate-100 rounded-xl border border-slate-200 shadow-inner p-3 transform rotate-y-12 rotate-x-12 translate-z-10 flex flex-col gap-2 opacity-80 group-hover:opacity-100 transition-opacity">
                                <div className="w-full h-2 bg-indigo-200 rounded-full" />
                                <div className="w-3/4 h-2 bg-indigo-200 rounded-full" />
                                <div className="mt-auto flex gap-2">
                                    <div className="w-8 h-8 rounded-lg bg-indigo-500/20" />
                                    <div className="w-8 h-8 rounded-lg bg-indigo-500/20" />
                                </div>
                            </div>
                        </ThreeDParallaxCard>
                    </div>

                    {/* 2. Status Check */}
                    <div className="h-[400px]">
                        <ThreeDParallaxCard
                            to="/attendance"
                            icon={ShieldCheck}
                            colorClass="text-emerald-500"
                            accentColor="bg-emerald-600"
                        >
                            <h3 className="text-2xl font-black text-slate-900 mb-2">Safe Zone</h3>
                            <p className="text-slate-500 mb-6">Real-time detention risk analysis.</p>

                            <div className="w-full bg-slate-100 rounded-full h-4 overflow-hidden border border-slate-200 relative group-hover:shadow-lg transition-shadow">
                                <motion.div
                                    className="absolute inset-0 bg-emerald-500"
                                    initial={{ width: 0 }}
                                    whileInView={{ width: "85%" }}
                                    transition={{ duration: 1.5, delay: 0.5 }}
                                />
                            </div>
                            <div className="mt-2 flex justify-between text-[10px] font-bold uppercase text-slate-400">
                                <span>Risk</span>
                                <span className="text-emerald-600">Safe</span>
                            </div>
                        </ThreeDParallaxCard>
                    </div>

                    {/* 3. Study Hub */}
                    <div className="h-[350px]">
                        <ThreeDParallaxCard
                            to="/study"
                            icon={BookOpen}
                            colorClass="text-amber-500"
                            accentColor="bg-amber-500"
                        >
                            <h3 className="text-2xl font-black text-slate-900 mb-2">Study Hub</h3>
                            <p className="text-slate-500">Manage notes & academic portfolio.</p>
                            <div className="mt-4 flex gap-2">
                                <span className="px-3 py-1 bg-amber-50 text-amber-700 rounded-lg text-xs font-bold">Notes</span>
                                <span className="px-3 py-1 bg-amber-50 text-amber-700 rounded-lg text-xs font-bold">AI Tutor</span>
                            </div>
                        </ThreeDParallaxCard>
                    </div>

                    {/* 4. Predictions */}
                    <div className="h-[350px]">
                        <ThreeDParallaxCard
                            icon={TrendingUp}
                            colorClass="text-sky-500"
                            accentColor="bg-sky-500"
                        >
                            <h3 className="text-2xl font-black text-slate-900 mb-2">AI Predict</h3>
                            <p className="text-slate-500 mb-4">Future attendance modeling.</p>
                            <span className="inline-block px-3 py-1 bg-slate-100 text-slate-500 rounded-lg text-xs font-bold border border-slate-200">Coming Soon</span>
                        </ThreeDParallaxCard>
                    </div>

                    {/* 5. Calendar */}
                    <div className="h-[350px]">
                        <ThreeDParallaxCard
                            colorClass="text-purple-500"
                            accentColor="bg-purple-600"
                            icon={Calendar}
                        >
                            <div className="flex flex-col h-full justify-between">
                                <div>
                                    <h3 className="text-2xl font-black text-slate-900 mb-2">Calendar</h3>
                                    <p className="text-slate-500 text-sm">Official KLU Schedule 2025.</p>
                                </div>
                                <a
                                    href="/academic_calendar.pdf"
                                    target="_blank"
                                    className="w-full py-3 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl font-bold text-center border border-slate-200 transition-colors"
                                >
                                    Download PDF
                                </a>
                            </div>
                        </ThreeDParallaxCard>
                    </div>

                    {/* 6. ERP Access Card */}
                    <div className="md:col-span-3 flex justify-center mt-8">
                        <ERPLoginCard />
                    </div>

                </div>

                <ExamCountdownSection />

            </main>
        </div>
    );
}
