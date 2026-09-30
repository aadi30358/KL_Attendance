import { useState, useEffect } from 'react';
import { Download, X, Smartphone, WifiOff, Share } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const InstallPwaPrompt = () => {
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [showBanner, setShowBanner] = useState(false);
    const [isIOS, setIsIOS] = useState(false);
    const [isStandalone, setIsStandalone] = useState(false);
    const [isOffline, setIsOffline] = useState(!navigator.onLine);
    const [showIosGuide, setShowIosGuide] = useState(false);

    useEffect(() => {
        // Detect offline/online state
        const handleOnline = () => setIsOffline(false);
        const handleOffline = () => setIsOffline(true);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Detect if already installed as PWA (standalone)
        const checkStandalone = 
            window.matchMedia('(display-mode: standalone)').matches || 
            window.navigator.standalone === true ||
            document.referrer.includes('android-app://');
        setIsStandalone(checkStandalone);

        // Detect iOS
        const userAgent = window.navigator.userAgent.toLowerCase();
        const iOSDevice = /iphone|ipad|ipod/.test(userAgent);
        setIsIOS(iOSDevice);

        // Listen for beforeinstallprompt (Android / Chrome / Edge)
        const handleBeforeInstall = (e) => {
            e.preventDefault();
            setDeferredPrompt(e);
            if (!checkStandalone) {
                setShowBanner(true);
            }
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstall);

        // Pop up small whenever website opens (after 1.2s) if not already installed
        const timer = setTimeout(() => {
            const dismissedThisSession = sessionStorage.getItem('kl_pwa_dismissed_session');
            const dismissedTime = localStorage.getItem('kl_pwa_dismissed_time');
            const dismissedRecently = dismissedTime && (Date.now() - parseInt(dismissedTime, 10) < 24 * 60 * 60 * 1000);
            if (!checkStandalone && !dismissedThisSession && !dismissedRecently) {
                setShowBanner(true);
            }
        }, 1200);

        return () => {
            clearTimeout(timer);
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
        };
    }, []);

    const handleInstallClick = async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') {
                setShowBanner(false);
                setDeferredPrompt(null);
            }
            return;
        }

        if (isIOS) {
            setShowIosGuide(true);
            return;
        }

        // Generic fallback instruction
        alert("To install KL Attendance:\nTap your browser menu (⋮) and select 'Install app' or 'Add to Home screen'.");
    };

    const handleDismiss = () => {
        setShowBanner(false);
        setShowIosGuide(false);
        try {
            sessionStorage.setItem('kl_pwa_dismissed_session', 'true');
            localStorage.setItem('kl_pwa_dismissed_time', Date.now().toString());
        } catch {
            // ignore
        }
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

            {/* Small Sleek Install Pop-up - Positioned above Feedback button so it never obstructs it */}
            <AnimatePresence>
                {showBanner && (
                    <motion.div
                        initial={{ opacity: 0, y: 30, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 30, scale: 0.95 }}
                        transition={{ type: "spring", stiffness: 350, damping: 25 }}
                        className="fixed bottom-24 right-4 left-4 sm:left-auto sm:bottom-20 sm:right-6 sm:w-80 z-40 bg-white/95 backdrop-blur-md border border-slate-200/90 shadow-2xl p-3 rounded-2xl flex items-center justify-between gap-3 text-slate-900"
                    >
                        <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-sky-500 flex items-center justify-center shrink-0 shadow-sm">
                                <Smartphone className="w-4 h-4 text-white" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-xs font-black text-slate-900 truncate">Install App</p>
                                <p className="text-[10px] text-slate-500 font-semibold truncate">Fast 0.1s offline access</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                            <button
                                onClick={handleInstallClick}
                                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1 cursor-pointer"
                            >
                                <Download className="w-3.5 h-3.5" />
                                <span>Install</span>
                            </button>
                            <button
                                onClick={handleDismiss}
                                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg transition-colors cursor-pointer"
                                aria-label="Dismiss"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* iOS Mini Guide Modal */}
            <AnimatePresence>
                {showIosGuide && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-xs"
                        onClick={() => setShowIosGuide(false)}
                    >
                        <motion.div
                            initial={{ y: 50, scale: 0.95 }}
                            animate={{ y: 0, scale: 1 }}
                            exit={{ y: 50, scale: 0.95 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-200 text-center"
                        >
                            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-3">
                                <Share className="w-6 h-6" />
                            </div>
                            <h3 className="text-base font-black text-slate-900 mb-1">Install on iPhone & iPad</h3>
                            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                                1. Tap the <span className="font-bold text-slate-800">Share</span> button at the bottom of Safari.<br />
                                2. Scroll down and tap <span className="font-bold text-indigo-600">&apos;Add to Home Screen&apos;</span>.
                            </p>
                            <button
                                onClick={() => setShowIosGuide(false)}
                                className="w-full py-2.5 bg-slate-900 text-white font-bold text-xs rounded-xl shadow cursor-pointer"
                            >
                                Got it
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
};

