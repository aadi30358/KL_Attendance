import { useState, useEffect } from 'react';
import { Download, X, Smartphone, WifiOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    openInstallModal,
    isStandaloneMode,
    isMarkedInstalled
} from '../services/pwaInstallManager';

let pwaDismissedInMemory = false;

export const InstallPwaPrompt = () => {
    const [showBanner, setShowBanner] = useState(false);
    const [isOffline, setIsOffline] = useState(!navigator.onLine);
    const isStandalone = isStandaloneMode();

    useEffect(() => {
        // Detect offline/online state
        const handleOnline = () => setIsOffline(false);
        const handleOffline = () => setIsOffline(true);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        const handleInstalled = () => {
            setShowBanner(false);
        };
        window.addEventListener('kl_app_installed_event', handleInstalled);

        // Pop up small whenever website opens (after 1.2s) if not already installed
        const timer = setTimeout(() => {
            if (!isStandalone && !pwaDismissedInMemory && !isMarkedInstalled()) {
                setShowBanner(true);
            }
        }, 1200);

        return () => {
            clearTimeout(timer);
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            window.removeEventListener('kl_app_installed_event', handleInstalled);
        };
    }, [isStandalone]);

    const handleInstallClick = () => {
        // Open the unified 2-question Install Modal
        openInstallModal('choose');
    };

    const handleDismiss = () => {
        setShowBanner(false);
        pwaDismissedInMemory = true;
    };

    // If running inside the installed standalone PWA, don't show the prompt
    if (isStandalone) return null;

    return (
        <>
            {/* Offline Notification Pill */}
            <AnimatePresence>
                {isOffline && (
                    <motion.div
                        initial={{ opacity: 0, y: -40 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -40 }}
                        className="fixed top-18 left-1/2 -translate-x-1/2 z-50 bg-amber-500 text-slate-950 font-bold text-xs sm:text-sm px-4 py-1.5 rounded-full shadow-lg flex items-center gap-2 border border-amber-300"
                    >
                        <WifiOff className="w-4 h-4 animate-pulse" />
                        <span>Offline Mode Active · Cached attendance available</span>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Small Sleek Install Pop-up - Compact on mobile so it never obstructs content */}
            <AnimatePresence>
                {showBanner && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        transition={{ type: "spring", stiffness: 350, damping: 25 }}
                        className="fixed bottom-20 right-3 sm:right-6 sm:bottom-20 z-40 max-w-[275px] sm:max-w-none sm:w-80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200/90 dark:border-slate-800 shadow-xl p-2 sm:p-3 rounded-xl sm:rounded-2xl flex items-center justify-between gap-2 sm:gap-3 text-slate-900 dark:text-white"
                    >
                        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                            <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-gradient-to-tr from-indigo-600 to-sky-500 flex items-center justify-center shrink-0 shadow-xs">
                                <Smartphone className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[11px] sm:text-xs font-black text-slate-900 dark:text-white truncate leading-tight">Install App</p>
                                <p className="text-[9px] sm:text-[10px] text-slate-500 dark:text-slate-400 font-medium truncate">Fast 0.1s offline access</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                            <button
                                onClick={handleInstallClick}
                                className="px-2.5 py-1 sm:px-3 sm:py-1.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-bold shadow-xs transition-all flex items-center gap-1 cursor-pointer"
                            >
                                <Download className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                                <span>Install</span>
                            </button>
                            <button
                                onClick={handleDismiss}
                                className="p-0.5 sm:p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-md sm:rounded-lg transition-colors cursor-pointer"
                                aria-label="Dismiss"
                            >
                                <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
};
