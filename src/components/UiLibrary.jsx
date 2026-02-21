
import { motion } from 'framer-motion';
import { ChevronRight, Loader2 } from 'lucide-react';

/**
 * UI SKELETON LIBRARY (Tailwind CSS)
 * ----------------------------------
 * Copy-paste these components to maintain the premium "Jarvis/Glassmorphism" aesthetic
 * across the application.
 */

// 1. Page Wrapper (Standard Layout)
export const PageWrapper = ({ children, className = "" }) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className={`min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8 ${className}`}
    >
        <div className="max-w-7xl mx-auto space-y-8">
            {children}
        </div>
    </motion.div>
);

// 2. Glass Card (The "Premium" Container)
export const GlassCard = ({ children, className = "", hoverEffect = false }) => (
    <motion.div
        className={`bg-white/80 backdrop-blur-xl border border-white/20 shadow-xl rounded-3xl p-6 relative overflow-hidden ${className}`}
        whileHover={hoverEffect ? { y: -5, shadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)" } : {}}
    >
        <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent pointer-events-none" />
        <div className="relative z-10">
            {children}
        </div>
    </motion.div>
);

// 3. Section Header (With Gradient Text)
export const SectionHeader = ({ title, subtitle, icon: Icon }) => (
    <div className="mb-8 text-center sm:text-left">
        <h2 className="text-3xl font-extrabold text-slate-900 flex items-center gap-3 justify-center sm:justify-start">
            {Icon && <Icon className="w-8 h-8 text-blue-600" />}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
                {title}
            </span>
        </h2>
        {subtitle && <p className="mt-2 text-slate-600 text-lg">{subtitle}</p>}
    </div>
);

// 4. Primary Form Input
export const FormInput = ({ label, ...props }) => (
    <div className="space-y-2">
        {label && <label className="text-sm font-semibold text-slate-700 ml-1">{label}</label>}
        <input
            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none shadow-sm text-slate-700 placeholder:text-slate-400"
            {...props}
        />
    </div>
);

// 5. Gradient Button
export const GradientButton = ({ children, onClick, icon: Icon, isLoading, className = "" }) => (
    <motion.button
        onClick={onClick}
        disabled={isLoading}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className={`px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
        {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : Icon ? <Icon className="w-5 h-5" /> : null}
        {children}
        {!isLoading && !Icon && <ChevronRight className="w-4 h-4 opacity-50" />}
    </motion.button>
);

// 6. Status Chip/Badge
export const StatusChip = ({ status, type = 'neutral' }) => {
    const styles = {
        success: 'bg-green-100 text-green-700 border-green-200',
        warning: 'bg-yellow-100 text-yellow-700 border-yellow-200',
        danger: 'bg-red-100 text-red-700 border-red-200',
        neutral: 'bg-slate-100 text-slate-700 border-slate-200',
        blue: 'bg-blue-100 text-blue-700 border-blue-200'
    };

    return (
        <span className={`px-3 py-1 rounded-full text-xs font-bold border ${styles[type] || styles.neutral} inline-flex items-center gap-1.5`}>
            <span className="w-1.5 h-1.5 rounded-full bg-current opacity-50" />
            {status}
        </span>
    );
};

// 7. Grid Layout Helper
export const GridLayout = ({ children, cols = 3 }) => (
    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-${cols} gap-6`}>
        {children}
    </div>
);
