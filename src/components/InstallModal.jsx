import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Download,
    CheckCircle2,
    Smartphone,
    Monitor,
    Share,
    Sparkles,
    X,
    ArrowRight,
    ExternalLink,
    Zap,
    RotateCcw,
    Check
} from 'lucide-react';
import {
    isStandaloneMode,
    isIOSDevice,
    isAndroidDevice,
    isDesktopDevice,
    hasDeferredPrompt,
    promptNativePwaInstall,
    downloadDesktopLauncher,
    markAlreadyInstalled,
    isMarkedInstalled
} from '../services/pwaInstallManager';

export const InstallModal = () => {
    const [isOpen, setIsOpen] = useState(false);
    // Views: 'choose', 'installing', 'pc_installed', 'android_guide', 'ios_guide', 'already_installed'
    const [currentView, setCurrentView] = useState('choose');
    const [downloadedShortcut, setDownloadedShortcut] = useState(false);
    const [nativePromptTriggered, setNativePromptTriggered] = useState(false);

    const isStandalone = isStandaloneMode();
    const isIOS = isIOSDevice();
    const isAndroid = isAndroidDevice();
    const isDesktop = isDesktopDevice();

    useEffect(() => {
        const handleOpen = (e) => {
            const initial = e?.detail?.initialTab;
            if (initial === 'already') {
                setCurrentView('already_installed');
            } else {
                setCurrentView('choose');
            }
            setDownloadedShortcut(false);
            setNativePromptTriggered(false);
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

    // Handle "Install" action — triggers automatic download and installation
    const handleInstallClick = async () => {
        // 1. Try native browser installation prompt if available
        if (hasDeferredPrompt()) {
            setNativePromptTriggered(true);
            const res = await promptNativePwaInstall();
            if (res.success) {
                setCurrentView('already_installed');
                return;
            }
        }

        // 2. Automatically download on PC/Desktop
        if (isDesktop) {
            downloadDesktopLauncher();
            setDownloadedShortcut(true);
            setCurrentView('pc_installed');
            return;
        }

        // 3. Mobile handling
        if (isIOS) {
            setCurrentView('ios_guide');
            return;
        }

        if (isAndroid) {
            setCurrentView('android_guide');
            return;
        }

        // Fallback default
        downloadDesktopLauncher();
        setCurrentView('pc_installed');
    };

    // Handle "Already Installed" action
    const handleAlreadyInstalledClick = () => {
        markAlreadyInstalled();
        setCurrentView('already_installed');
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
                    {/* Top Decorative Header Accent */}
                    <div className="h-1.5 w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-400" />

                    {/* Modal Close Button */}
                    <button
                        onClick={handleCloseModal}
                        className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors z-20 cursor-pointer"
                        aria-label="Close modal"
                    >
                        <X className="w-5 h-5" />
                    </button>

                    {/* ────────────────── VIEW 1: CHOOSE (2 QUESTIONS) ────────────────── */}
                    {currentView === 'choose' && (
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

                            {/* Two Options / Questions Cards */}
                            <div className="space-y-3.5">
                                {/* Option 1: Install / Download */}
                                <div
                                    onClick={handleInstallClick}
                                    className="group relative p-4 sm:p-5 rounded-2xl border-2 border-indigo-500/40 hover:border-indigo-600 dark:border-indigo-500/30 dark:hover:border-indigo-400 bg-gradient-to-br from-indigo-50/60 via-white to-sky-50/40 dark:from-indigo-950/30 dark:via-slate-900 dark:to-slate-900 transition-all cursor-pointer shadow-sm hover:shadow-md hover:scale-[1.01] active:scale-[0.99]"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-start gap-3.5">
                                            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-indigo-600/30 group-hover:scale-110 transition-transform">
                                                <Download className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                                                        Install
                                                    </span>
                                                    <span className="text-[10px] font-black bg-indigo-600 text-white px-2 py-0.5 rounded-full tracking-wider uppercase">
                                                        Auto-Download
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
                                            <ArrowRight className="w-4 h-4" />
                                        </div>
                                    </div>
                                </div>

                                {/* Option 2: Already Installed */}
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
                                                    Already have the app? Tap here to see how to launch it or manage your shortcut.
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
                    )}

                    {/* ────────────────── VIEW 2: PC DOWNLOADED / INSTALLED ────────────────── */}
                    {currentView === 'pc_installed' && (
                        <div className="p-6 sm:p-7 text-center">
                            <div className="w-14 h-14 rounded-2xl bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-4 shadow-inner">
                                <Download className="w-7 h-7 animate-bounce" />
                            </div>
                            <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">
                                Desktop App Downloaded!
                            </h3>
                            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-sm mx-auto mb-5 leading-relaxed">
                                <span className="font-bold text-indigo-600 dark:text-indigo-400">&apos;KL_Attendance.url&apos;</span> has been automatically downloaded to your PC.
                            </p>

                            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-4 text-left border border-slate-200/80 dark:border-slate-700/60 space-y-3 mb-6 text-xs text-slate-700 dark:text-slate-300">
                                <div className="flex items-start gap-2.5">
                                    <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-black text-[11px] flex items-center justify-center shrink-0 mt-0.5">1</span>
                                    <span>Open your <b>Downloads</b> folder and double-click <b>KL_Attendance.url</b> to launch anytime.</span>
                                </div>
                                <div className="flex items-start gap-2.5">
                                    <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-black text-[11px] flex items-center justify-center shrink-0 mt-0.5">2</span>
                                    <span>
                                        Or click the <span className="font-bold text-indigo-600 dark:text-indigo-400">Install icon (⊕ or ⬇)</span> in your browser&apos;s address bar to install as a full standalone desktop app.
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => downloadDesktopLauncher()}
                                    className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                                >
                                    <Download className="w-3.5 h-3.5" />
                                    <span>Download Again</span>
                                </button>
                                <button
                                    onClick={handleCloseModal}
                                    className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
                                >
                                    Done
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ────────────────── VIEW 3: ANDROID GUIDE ────────────────── */}
                    {currentView === 'android_guide' && (
                        <div className="p-6 sm:p-7 text-center">
                            <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-4">
                                <Smartphone className="w-7 h-7" />
                            </div>
                            <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">
                                Install on Android
                            </h3>
                            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-5 leading-relaxed">
                                Add KL Attendance directly to your home screen in 2 quick steps:
                            </p>

                            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-4 text-left border border-slate-200/80 dark:border-slate-700/60 space-y-3 mb-6 text-xs text-slate-700 dark:text-slate-300">
                                <div className="flex items-start gap-2.5">
                                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-black text-[11px] flex items-center justify-center shrink-0 mt-0.5">1</span>
                                    <span>Tap the <b>three dots (⋮)</b> menu icon in the top right corner of Chrome.</span>
                                </div>
                                <div className="flex items-start gap-2.5">
                                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-black text-[11px] flex items-center justify-center shrink-0 mt-0.5">2</span>
                                    <span>Select <span className="font-bold text-emerald-600 dark:text-emerald-400">&apos;Install app&apos;</span> or <span className="font-bold text-emerald-600 dark:text-emerald-400">&apos;Add to Home screen&apos;</span>.</span>
                                </div>
                            </div>

                            <button
                                onClick={handleCloseModal}
                                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
                            >
                                Got it
                            </button>
                        </div>
                    )}

                    {/* ────────────────── VIEW 4: IOS GUIDE ────────────────── */}
                    {currentView === 'ios_guide' && (
                        <div className="p-6 sm:p-7 text-center">
                            <div className="w-14 h-14 rounded-2xl bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-4">
                                <Share className="w-7 h-7" />
                            </div>
                            <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">
                                Install on iPhone &amp; iPad
                            </h3>
                            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-5 leading-relaxed">
                                Safari requires adding directly to your iOS Home Screen:
                            </p>

                            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-4 text-left border border-slate-200/80 dark:border-slate-700/60 space-y-3 mb-6 text-xs text-slate-700 dark:text-slate-300">
                                <div className="flex items-start gap-2.5">
                                    <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-black text-[11px] flex items-center justify-center shrink-0 mt-0.5">1</span>
                                    <span>Tap the <span className="font-bold text-indigo-600 dark:text-indigo-400">Share icon (⎋)</span> at the bottom bar of Safari.</span>
                                </div>
                                <div className="flex items-start gap-2.5">
                                    <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-black text-[11px] flex items-center justify-center shrink-0 mt-0.5">2</span>
                                    <span>Scroll down and tap <span className="font-bold text-indigo-600 dark:text-indigo-400">&apos;Add to Home Screen&apos; (+)</span>.</span>
                                </div>
                                <div className="flex items-start gap-2.5">
                                    <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-black text-[11px] flex items-center justify-center shrink-0 mt-0.5">3</span>
                                    <span>Tap <span className="font-bold text-indigo-600 dark:text-indigo-400">&apos;Add&apos;</span> in the top right corner.</span>
                                </div>
                            </div>

                            <button
                                onClick={handleCloseModal}
                                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
                            >
                                Got it
                            </button>
                        </div>
                    )}

                    {/* ────────────────── VIEW 5: ALREADY INSTALLED ────────────────── */}
                    {currentView === 'already_installed' && (
                        <div className="p-6 sm:p-7 text-center">
                            <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-4 shadow-sm">
                                <Check className="w-7 h-7 stroke-[3]" />
                            </div>
                            <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mb-2">
                                You&apos;re All Set!
                            </h3>
                            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-sm mx-auto mb-5 leading-relaxed">
                                KL Attendance is already installed on your device. You have 0.1s offline access ready at any time!
                            </p>

                            {/* Device Launch Tips */}
                            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-4 text-left border border-slate-200/80 dark:border-slate-700/60 space-y-3 mb-6 text-xs text-slate-700 dark:text-slate-300">
                                <div className="flex items-start gap-2.5">
                                    <Smartphone className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                                    <span><b>On Mobile:</b> Check your phone&apos;s Home Screen or App Drawer for the &apos;KL Attendance&apos; icon.</span>
                                </div>
                                <div className="flex items-start gap-2.5">
                                    <Monitor className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
                                    <span><b>On PC:</b> Look in your Windows Start Menu, Desktop, or Chrome/Edge Apps list.</span>
                                </div>
                            </div>

                            <div className="flex flex-col sm:flex-row items-center gap-2.5">
                                <button
                                    onClick={() => {
                                        window.location.href = '/';
                                        handleCloseModal();
                                    }}
                                    className="w-full sm:flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5"
                                >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                    <span>Launch Dashboard</span>
                                </button>
                                <button
                                    onClick={() => setCurrentView('choose')}
                                    className="w-full sm:flex-1 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
                                >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                    <span>Re-download / Install</span>
                                </button>
                            </div>
                        </div>
                    )}
                </motion.div>
            </div>
        </AnimatePresence>
    );
};
