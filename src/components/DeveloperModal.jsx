import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Globe, ExternalLink, Sparkles } from 'lucide-react';
import { FaGithub, FaLinkedin, FaInstagram, FaTelegram } from 'react-icons/fa6';
import { getPortfolioUrl } from '../services/consolePortfolio';

const SOCIAL_OPTIONS = [
    {
        id: 'portfolio',
        name: 'Portfolio Website',
        subtitle: 'Projects, skills & interactive resume',
        icon: Globe,
        color: 'from-indigo-600 to-violet-600',
        textColor: 'text-indigo-600 dark:text-indigo-400',
        bgHover: 'hover:bg-indigo-50/80 dark:hover:bg-indigo-950/40',
        borderColor: 'border-indigo-500/30',
        badge: 'Recommended',
        getUrl: () => getPortfolioUrl()
    },
    {
        id: 'instagram',
        name: 'Instagram',
        subtitle: '@adithyareddy.7',
        icon: FaInstagram,
        color: 'from-pink-500 via-rose-500 to-purple-600',
        textColor: 'text-pink-600 dark:text-pink-400',
        bgHover: 'hover:bg-pink-50/80 dark:hover:bg-pink-950/40',
        borderColor: 'border-pink-500/30',
        getUrl: () => 'https://www.instagram.com/adithyareddy.7/'
    },
    {
        id: 'linkedin',
        name: 'LinkedIn',
        subtitle: 'Yaswanth Adithya Reddy',
        icon: FaLinkedin,
        color: 'from-blue-600 to-sky-600',
        textColor: 'text-blue-600 dark:text-blue-400',
        bgHover: 'hover:bg-blue-50/80 dark:hover:bg-blue-950/40',
        borderColor: 'border-blue-500/30',
        getUrl: () => 'https://www.linkedin.com/in/garlapati-yaswanth-adithya-reddy-226108367'
    },
    {
        id: 'github',
        name: 'GitHub',
        subtitle: '@aadi30358 • Repositories & Code',
        icon: FaGithub,
        color: 'from-slate-800 to-slate-950',
        textColor: 'text-slate-900 dark:text-slate-100',
        bgHover: 'hover:bg-slate-100/80 dark:hover:bg-slate-800/40',
        borderColor: 'border-slate-400/30',
        getUrl: () => 'https://github.com/aadi30358'
    },
    {
        id: 'telegram',
        name: 'Telegram',
        subtitle: '@kl2400030358 • Instant Chat',
        icon: FaTelegram,
        color: 'from-sky-500 to-blue-600',
        textColor: 'text-sky-600 dark:text-sky-400',
        bgHover: 'hover:bg-sky-50/80 dark:hover:bg-sky-950/40',
        borderColor: 'border-sky-500/30',
        getUrl: () => 'https://t.me/kl2400030358'
    }
];

export const DeveloperModal = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [justOpenedPortfolio, setJustOpenedPortfolio] = useState(false);

    useEffect(() => {
        const handleOpen = (e) => {
            setIsOpen(true);
            if (e?.detail?.openedPortfolio) {
                setJustOpenedPortfolio(true);
            }
        };

        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && isOpen) {
                setIsOpen(false);
            }
        };

        window.addEventListener('kl_open_dev_modal', handleOpen);
        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('kl_open_dev_modal', handleOpen);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen]);

    const openLink = (url) => {
        window.open(url, '_blank', 'noopener,noreferrer');
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 select-none">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setIsOpen(false)}
                        className="fixed inset-0 bg-slate-950/70 backdrop-blur-md"
                    />

                    {/* Dialog Container */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        transition={{ type: "spring", duration: 0.3, bounce: 0.1 }}
                        className="relative w-full max-w-[420px] bg-white dark:bg-[#0f172a] rounded-2xl sm:rounded-3xl border border-slate-900/10 dark:border-slate-800 shadow-2xl overflow-hidden z-10 my-auto max-h-[92vh] flex flex-col"
                    >
                        {/* Header Gradient Strip */}
                        <div className="h-1.5 w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 shrink-0" />

                        {/* Modal Header */}
                        <div className="p-4 sm:p-4.5 pb-2 sm:pb-2.5 flex items-start justify-between shrink-0">
                            <div className="flex items-center gap-2.5 sm:gap-3">
                                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 shrink-0">
                                    <Sparkles className="w-5 h-5 animate-pulse" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-1.5">
                                        <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight leading-tight">
                                            Developer Info
                                        </h2>
                                        <span className="text-[9px] bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 font-bold px-1.5 py-0.2 rounded-full border border-indigo-200 dark:border-indigo-800">
                                            F12
                                        </span>
                                    </div>
                                    <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium">
                                        Yaswanth Adithya Reddy • Connect & Explore
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="w-10 h-10 min-w-[40px] min-h-[40px] rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer flex items-center justify-center touch-manipulation"
                                title="Close (Esc)"
                                aria-label="Close dialog"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Notice if portfolio auto-opened */}
                        {justOpenedPortfolio && (
                            <div className="mx-4 sm:mx-4.5 mb-2 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 rounded-xl text-emerald-800 dark:text-emerald-300 text-[10.5px] sm:text-[11px] font-semibold flex items-center gap-2 shrink-0">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping shrink-0" />
                                <span>Portfolio link launched in a new tab! Choose any social handle below:</span>
                            </div>
                        )}

                        {/* List of Developer Destination Links */}
                        <div className="p-4 sm:p-4.5 pt-1 space-y-1.5 sm:space-y-2 max-h-[50vh] sm:max-h-[54vh] overflow-y-auto scrollbar-thin">
                            {SOCIAL_OPTIONS.map((item) => {
                                const Icon = item.icon;
                                const url = item.getUrl();
                                return (
                                    <button
                                        key={item.id}
                                        onClick={() => openLink(url)}
                                        className={`w-full p-2.5 sm:p-3 rounded-xl border ${item.borderColor} ${item.bgHover} bg-slate-50/70 dark:bg-slate-800/40 transition-all duration-150 flex items-center justify-between group cursor-pointer text-left active:scale-[0.99]`}
                                    >
                                        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                                            <div className={`w-8 h-8 sm:w-8.5 sm:h-8.5 rounded-lg bg-gradient-to-tr ${item.color} flex items-center justify-center text-white shadow-sm shrink-0`}>
                                                <Icon className="w-4 h-4" />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                                                        {item.name}
                                                    </span>
                                                    {item.badge && (
                                                        <span className="text-[8px] font-black uppercase tracking-wider bg-indigo-500 text-white px-1.5 py-0.5 rounded-full shadow-2xs">
                                                            {item.badge}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate">
                                                    {item.subtitle}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors ml-2 shrink-0">
                                            <ExternalLink className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Modal Footer */}
                        <div className="p-3 sm:p-3.5 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10.5px] sm:text-[11px] text-slate-500 dark:text-slate-400 font-medium px-4 sm:px-4.5 shrink-0">
                            <span>Type <code className="text-indigo-600 dark:text-indigo-400 font-mono font-bold">portfolio()</code> in Console</span>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="px-4 py-2 min-h-[38px] rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors cursor-pointer text-xs touch-manipulation active:scale-95 shadow-2xs"
                            >
                                Close
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};
