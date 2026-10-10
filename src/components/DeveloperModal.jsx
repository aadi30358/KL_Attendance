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
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 select-none">
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
                        initial={{ opacity: 0, scale: 0.95, y: 15 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 15 }}
                        transition={{ type: "spring", duration: 0.35, bounce: 0.15 }}
                        className="relative w-full max-w-lg bg-white dark:bg-[#0f172a] rounded-3xl border-2 border-slate-900/10 dark:border-slate-800 shadow-2xl overflow-hidden z-10"
                    >
                        {/* Header Gradient Strip */}
                        <div className="h-2 w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />

                        {/* Modal Header */}
                        <div className="p-6 pb-4 flex items-start justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/25">
                                    <Sparkles className="w-6 h-6 animate-pulse" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                                            Developer Info
                                        </h2>
                                        <span className="text-[10px] bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 font-bold px-2 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-800">
                                            F12
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                                        Yaswanth Adithya Reddy • Connect & Explore
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                title="Close (Esc)"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Notice if portfolio auto-opened */}
                        {justOpenedPortfolio && (
                            <div className="mx-6 mb-3 px-3.5 py-2 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 rounded-xl text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping shrink-0" />
                                <span>Portfolio link launched in a new tab! Choose any social handle below:</span>
                            </div>
                        )}

                        {/* List of Developer Destination Links */}
                        <div className="p-6 pt-2 space-y-2.5 max-h-[60vh] overflow-y-auto">
                            {SOCIAL_OPTIONS.map((item) => {
                                const Icon = item.icon;
                                const url = item.getUrl();
                                return (
                                    <button
                                        key={item.id}
                                        onClick={() => openLink(url)}
                                        className={`w-full p-3.5 rounded-2xl border ${item.borderColor} ${item.bgHover} bg-slate-50/60 dark:bg-slate-800/40 transition-all duration-200 flex items-center justify-between group cursor-pointer text-left`}
                                    >
                                        <div className="flex items-center gap-3.5 min-w-0">
                                            <div className={`w-10 h-10 rounded-xl bg-gradient-to-tr ${item.color} flex items-center justify-center text-white shadow-md shrink-0`}>
                                                <Icon className="w-5 h-5" />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-black text-slate-900 dark:text-white">
                                                        {item.name}
                                                    </span>
                                                    {item.badge && (
                                                        <span className="text-[9px] font-black uppercase tracking-wider bg-indigo-500 text-white px-2 py-0.5 rounded-full shadow-2xs">
                                                            {item.badge}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono truncate">
                                                    {item.subtitle}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors ml-2 shrink-0">
                                            <ExternalLink className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-medium px-6">
                            <span>Type <code className="text-indigo-600 dark:text-indigo-400 font-mono font-bold">portfolio()</code> in Console</span>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors cursor-pointer"
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
