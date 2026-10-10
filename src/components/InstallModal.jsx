import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Download,
    CheckCircle2,
    Smartphone,
    Monitor,
    Sparkles,
    X,
    ArrowRight,
    Zap,
    Check
} from 'lucide-react';
import {
    isDesktopDevice,
    isIOSDevice,
    hasDeferredPrompt,
    promptNativePwaInstall,
    downloadDesktopLauncher,
    markAlreadyInstalled,
    isMarkedInstalled
} from '../services/pwaInstallManager';

export const InstallModal = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [downloaded, setDownloaded] = useState(false);

    const navigate = useNavigate();
    const isDesktop = isDesktopDevice();
    const isIOS = isIOSDevice();

    useEffect(() => {
        const handleOpen = () => {
            setDownloading(false);
            setDownloaded(false);
            setIsOpen(true);
        };

        const handleClose = () => {
            setIsOpen(false);
        };

        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && isOpen) {
                setIsOpen(false);
            }
        };

        window.addEventListener('kl_open_install_modal', handleOpen);
        window.addEventListener('kl_close_install_modal', handleClose);
        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('kl_open_install_modal', handleOpen);
            window.removeEventListener('kl_close_install_modal', handleClose);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen]);

    // Option 1: Click "Install" -> Automatically download and install
    const handleInstallClick = async () => {
        setDownloading(true);

        try {
            // 1. Immediately trigger the download
            downloadDesktopLauncher();

            // 2. If native PWA beforeinstallprompt is ready (Android Chrome / Edge / Desktop), trigger it too
            if (hasDeferredPrompt()) {
                promptNativePwaInstall().catch(() => {});
            }

            setDownloaded(true);

            // Automatically close modal after brief visual confirmation
            setTimeout(() => {
                setDownloading(false);
                setIsOpen(false);
            }, 850);
        } catch (err) {
            console.error('Install action error:', err);
            setDownloading(false);
            setIsOpen(false);
        }
    };

    // Option 2: Click "Already Installed" -> Come back to the home screen
    const handleAlreadyInstalledClick = () => {
        markAlreadyInstalled();
        setIsOpen(false);
        navigate('/');
        // Scroll to top of home screen smoothly
        if (typeof window !== 'undefined') {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    const handleCloseModal = () => {
        setIsOpen(false);
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 select-none overflow-y-auto">
                {/* Backdrop */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={handleCloseModal}
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                />

                {/* Modal Container */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 15 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 15 }}
                    transition={{ type: "spring", stiffness: 350, damping: 25 }}
                    className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden z-10 text-slate-900 dark:text-white my-auto"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Top Decorative Gradient Line */}
                    <div className="h-1.5 w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-400" />

                    {/* Modal Close Button */}
                    <button
                        onClick={handleCloseModal}
                        className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors z-20 cursor-pointer"
                        aria-label="Close modal"
                    >
                        <X className="w-5 h-5" />
                    </button>

                    <div className="p-6 sm:p-7">
                        {/* Header */}
                        <div className="flex items-center gap-3.5 mb-5">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 shrink-0">
                                <Smartphone className="w-6 h-6" />
                            </div>
                            <div>
                                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-[10px] font-black uppercase tracking-wider text-indigo-700 dark:text-indigo-300 mb-1">
                                    <Sparkles className="w-3 h-3 text-indigo-500 animate-pulse" />
                                    <span>Official Web App</span>
                                </div>
                                <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
                                    Install KL Attendance
                                </h2>
                            </div>
                        </div>

                        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 font-medium mb-6">
                            Please choose an option below to continue:
                        </p>

                        {/* ONLY THESE TWO OPTIONS */}
                        <div className="space-y-3.5">
                            {/* Option 1: Install & Auto-Download */}
                            <div
                                onClick={handleInstallClick}
                                className="group relative p-4 sm:p-5 rounded-2xl border-2 border-indigo-500/40 hover:border-indigo-600 dark:border-indigo-500/30 dark:hover:border-indigo-400 bg-gradient-to-br from-indigo-50/60 via-white to-sky-50/40 dark:from-indigo-950/30 dark:via-slate-900 dark:to-slate-900 transition-all cursor-pointer shadow-sm hover:shadow-md hover:scale-[1.01] active:scale-[0.99]"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-start gap-3.5">
                                        <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-indigo-600/30 group-hover:scale-110 transition-transform">
                                            {downloaded ? (
                                                <Check className="w-5 h-5 text-emerald-300 stroke-[3]" />
                                            ) : (
                                                <Download className="w-5 h-5" />
                                            )}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                                                    Install
                                                </span>
                                                <span className="text-[10px] font-black bg-indigo-600 text-white px-2 py-0.5 rounded-full tracking-wider uppercase">
                                                    {downloaded ? "Downloaded ✓" : downloading ? "Downloading..." : "Auto-Download"}
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                                                Automatically download and install on Mobile or PC for fast 0.1s instant offline access.
                                            </p>
                                            <div className="flex items-center gap-3 mt-2 text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                                                <span className="flex items-center gap-1">
                                                    <Zap className="w-3 h-3 text-amber-500" /> Fast 0.1s offline
                                                </span>
                                                <span>•</span>
                                                <span className="flex items-center gap-1">
                                                    {isDesktop ? <Monitor className="w-3 h-3" /> : <Smartphone className="w-3 h-3" />}
                                                    {isDesktop ? 'PC Desktop' : isIOS ? 'iPhone / iPad' : 'Android'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                        {downloaded ? (
                                            <Check className="w-4 h-4 text-emerald-600 group-hover:text-white" />
                                        ) : (
                                            <ArrowRight className="w-4 h-4" />
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Option 2: Already Installed -> Comeback to Home Screen */}
                            <div
                                onClick={handleAlreadyInstalledClick}
                                className="group relative p-4 sm:p-5 rounded-2xl border-2 border-slate-200 dark:border-slate-800 hover:border-emerald-500/60 dark:hover:border-emerald-500/50 bg-white dark:bg-slate-900/80 hover:bg-emerald-50/30 dark:hover:bg-emerald-950/10 transition-all cursor-pointer shadow-xs hover:shadow-md hover:scale-[1.01] active:scale-[0.99]"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-start gap-3.5">
                                        <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                                            <CheckCircle2 className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                                                    Already Installed
                                                </span>
                                                {isMarkedInstalled() && (
                                                    <span className="text-[10px] font-black bg-emerald-600 text-white px-2 py-0.5 rounded-full tracking-wider uppercase">
                                                        Active
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                                                Already have the app? Tap here to come back to the home screen.
                                            </p>
                                        </div>
                                    </div>
                                    <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center shrink-0 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                                        <ArrowRight className="w-4 h-4" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer Note */}
                        <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                            <span>No app store account needed</span>
                            <span>Safe • 0 MB Storage</span>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};
