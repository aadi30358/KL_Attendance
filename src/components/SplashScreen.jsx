
import { motion } from 'framer-motion';

export default function SplashScreen() {
    // Fallback: use a gradient if image is not available

    return (
        <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden"
            style={{
                background: 'radial-gradient(ellipse at top, #0f172a 0%, #1e1b4b 50%, #312e81 100%)'
            }}
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
        >
            {/* Premium Animated Background Elements */}
            <div className="absolute inset-0 pointer-events-none">
                {/* Gold shimmer effect */}
                <motion.div
                    animate={{
                        scale: [1, 1.3, 1],
                        opacity: [0.15, 0.25, 0.15],
                        rotate: [0, 120, 240, 360]
                    }}
                    transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
                    className="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full blur-3xl"
                    style={{
                        background: 'radial-gradient(circle, rgba(251,191,36,0.2) 0%, rgba(245,158,11,0.1) 50%, transparent 100%)'
                    }}
                />
                {/* Royal blue accent */}
                <motion.div
                    animate={{
                        scale: [1.2, 1, 1.2],
                        opacity: [0.2, 0.35, 0.2],
                        rotate: [360, 240, 120, 0]
                    }}
                    transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                    className="absolute bottom-1/4 right-1/4 w-[450px] h-[450px] rounded-full blur-3xl"
                    style={{
                        background: 'radial-gradient(circle, rgba(59,130,246,0.25) 0%, rgba(99,102,241,0.15) 50%, transparent 100%)'
                    }}
                />
                {/* Champagne glow */}
                <motion.div
                    animate={{
                        opacity: [0.1, 0.2, 0.1],
                        scale: [1, 1.1, 1]
                    }}
                    transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-3xl"
                    style={{
                        background: 'radial-gradient(circle, rgba(217,119,6,0.15) 0%, transparent 70%)'
                    }}
                />
            </div>

            {/* Main Content */}
            <div className="relative flex flex-col items-center gap-8">
                {/* Rotating Circle Border with Picture */}
                <div className="relative">
                    {/* First rotating premium gradient border - Gold & Royal Blue */}
                    <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                        className="absolute inset-0 rounded-full p-[3px]"
                        style={{
                            background: 'conic-gradient(from 0deg, #fbbf24, #f59e0b, #3b82f6, #6366f1, #8b5cf6, #fbbf24)',
                            width: '230px',
                            height: '230px',
                        }}
                    >
                        <div className="w-full h-full rounded-full" style={{ background: '#1e1b4b' }} />
                    </motion.div>

                    {/* Second rotating gradient border - Champagne & Violet */}
                    <motion.div
                        animate={{ rotate: -360 }}
                        transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
                        className="absolute inset-0 rounded-full p-[3px]"
                        style={{
                            background: 'conic-gradient(from 180deg, #d97706, #fbbf24, #a855f7, #ec4899, #d97706)',
                            width: '230px',
                            height: '230px',
                            opacity: 0.7,
                        }}
                    >
                        <div className="w-full h-full rounded-full" style={{ background: '#1e1b4b' }} />
                    </motion.div>

                    {/* Third subtle shimmer ring */}
                    <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
                        className="absolute inset-0 rounded-full p-[2px]"
                        style={{
                            background: 'conic-gradient(from 90deg, transparent, rgba(251,191,36,0.6), transparent, rgba(59,130,246,0.6), transparent)',
                            width: '230px',
                            height: '230px',
                            opacity: 0.5,
                        }}
                    >
                        <div className="w-full h-full rounded-full" style={{ background: '#1e1b4b' }} />
                    </motion.div>

                    {/* Profile Picture Container with premium border */}
                    <motion.div
                        initial={{ scale: 0, rotate: -180 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{
                            duration: 1,
                            delay: 0.2,
                            type: "spring",
                            stiffness: 200,
                            damping: 15
                        }}
                        className="relative"
                        style={{
                            width: '210px',
                            height: '210px',
                        }}
                    >
                        {/* Premium gradient border wrapper */}
                        <div
                            className="absolute inset-0 rounded-full"
                            style={{
                                padding: '5px',
                                background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 25%, #3b82f6 75%, #8b5cf6 100%)',
                                boxShadow: '0 0 60px rgba(251,191,36,0.4), 0 0 100px rgba(59,130,246,0.3), inset 0 0 20px rgba(251,191,36,0.2)'
                            }}
                        >
                            {/* Inner circle container for perfect image fit */}
                            <div
                                className="w-full h-full rounded-full overflow-hidden relative"
                                style={{
                                    background: '#1e1b4b',
                                    boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.3)'
                                }}
                            >
                                <img
                                    src="/owner.jpg"
                                    alt="Owner"
                                    className="w-full h-full object-cover"
                                    style={{
                                        objectPosition: 'center 20%', // Shift up slightly as requested for better face centering
                                        transform: 'scale(1.15)', // Slightly more zoom for better filling
                                    }}
                                    onError={(e) => {
                                        console.error("Owner image failed to load from /owner.jpg");
                                        e.target.style.display = 'none';
                                        e.target.parentElement.style.background = 'linear-gradient(135deg, #fbbf24 0%, #3b82f6 50%, #8b5cf6 100%)';

                                        // Subtle placeholder icon instead of question mark
                                        const icon = document.createElement('div');
                                        icon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>';
                                        icon.style.cssText = 'position:absolute; inset:0; display:flex; align-items:center; justify-content:center;';
                                        e.target.parentElement.appendChild(icon);
                                    }}
                                />
                                {/* Subtle overlay for depth */}
                                <div
                                    className="absolute inset-0 pointer-events-none"
                                    style={{
                                        background: 'radial-gradient(circle at 30% 30%, rgba(251,191,36,0.1) 0%, transparent 50%)',
                                    }}
                                />
                            </div>
                        </div>

                        {/* Premium pulsing glow effect - Gold & Blue */}
                        <motion.div
                            animate={{
                                scale: [1, 1.3, 1],
                                opacity: [0.4, 0.7, 0.4]
                            }}
                            transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                            className="absolute inset-0 rounded-full blur-3xl -z-10"
                            style={{
                                width: '230px',
                                height: '230px',
                                background: 'radial-gradient(circle, rgba(251,191,36,0.6) 0%, rgba(59,130,246,0.4) 50%, rgba(139,92,246,0.3) 100%)'
                            }}
                        />

                        {/* Running Lines Animation SVG */}
                        <svg className="absolute inset-0 -rotate-90 pointer-events-none" width="230" height="230" viewBox="0 0 230 230" style={{ transform: 'translate(-10px, -10px)', width: '230px', height: '230px' }}>
                            {/* Line 1 - Gold */}
                            <motion.circle
                                cx="115"
                                cy="115"
                                r="112"
                                fill="none"
                                stroke="#fbbf24"
                                strokeWidth="3"
                                strokeLinecap="round"
                                initial={{ pathLength: 0.2, pathOffset: 0 }}
                                animate={{ pathOffset: [0, 1] }}
                                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                                style={{ filter: 'drop-shadow(0 0 8px rgba(251,191,36,0.8))' }}
                            />
                            {/* Line 2 - Royal Blue */}
                            <motion.circle
                                cx="115"
                                cy="115"
                                r="112"
                                fill="none"
                                stroke="#3b82f6"
                                strokeWidth="3"
                                strokeLinecap="round"
                                initial={{ pathLength: 0.15, pathOffset: 0 }}
                                animate={{ pathOffset: [1, 0] }}
                                transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                                style={{ filter: 'drop-shadow(0 0 8px rgba(59,130,246,0.8))' }}
                            />
                            {/* Line 3 - Champagne (Inner) */}
                            <motion.circle
                                cx="115"
                                cy="115"
                                r="108"
                                fill="none"
                                stroke="#d97706"
                                strokeWidth="2"
                                strokeLinecap="round"
                                initial={{ pathLength: 0.1, pathOffset: 0.5 }}
                                animate={{ pathOffset: [0.5, 1.5] }}
                                transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
                                style={{ filter: 'drop-shadow(0 0 5px rgba(217,119,6,0.6))' }}
                            />
                        </svg>
                    </motion.div>
                </div>

                {/* Sparkling Text Effect Container */}
                <div className="relative">
                    {/* App Title with premium gradient text */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, delay: 0.5 }}
                        className="text-center relative z-10"
                    >
                        <h1
                            className="text-4xl sm:text-5xl font-black tracking-tight mb-2"
                            style={{
                                background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 25%, #3b82f6 75%, #8b5cf6 100%)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                backgroundClip: 'text',
                                filter: 'drop-shadow(0 0 20px rgba(251,191,36,0.3))'
                            }}
                        >
                            KL Attendance
                        </h1>
                        <p
                            className="font-semibold text-lg"
                            style={{
                                background: 'linear-gradient(90deg, #fbbf24, #3b82f6)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                backgroundClip: 'text'
                            }}
                        >
                            Your Academic Companion
                        </p>
                    </motion.div>
                </div>

                {/* Premium Loading indicator with gold accent */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.5, delay: 1 }}
                    className="flex gap-2"
                >
                    {[0, 1, 2].map((i) => (
                        <motion.div
                            key={i}
                            animate={{
                                scale: [1, 1.5, 1],
                                opacity: [0.5, 1, 0.5]
                            }}
                            transition={{
                                duration: 1.5,
                                repeat: Infinity,
                                delay: i * 0.2
                            }}
                            className="w-2 h-2 rounded-full"
                            style={{
                                background: i === 1 ? '#fbbf24' : '#3b82f6',
                                boxShadow: i === 1 ? '0 0 10px rgba(251,191,36,0.8)' : '0 0 10px rgba(59,130,246,0.8)'
                            }}
                        />
                    ))}
                </motion.div>
            </div>
        </motion.div>
    );
}
