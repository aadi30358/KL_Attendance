import React, { useState, useEffect } from 'react';

const PWAInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  const [isIOS, setIsIOS] = useState(false);
  const [useFallback, setUseFallback] = useState(false);
  const [isInApp, setIsInApp] = useState(false);

  useEffect(() => {
    // Check if app is already running in standalone mode (installed)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    
    // Detect iOS
    const ua = navigator.userAgent || navigator.vendor || window.opera;
    const isIOSDevice = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
    setIsIOS(isIOSDevice);

    // Detect Restricted In-App Browsers (Instagram, FB, WhatsApp, LinkedIn)
    const isInAppBrowser = /Instagram|FBAN|FBAV|WhatsApp|LinkedInApp/.test(ua);
    setIsInApp(isInAppBrowser);

    // If already installed, never show the prompt
    if (isStandalone) {
      setShowInstallPrompt(false);
      return;
    }

    // ULTRA AGGRESSIVE TIMER: Force show after 1 second if not standalone
    const timer = setTimeout(() => {
      if (!isStandalone) {
        setUseFallback(true);
        setShowInstallPrompt(true);
      }
    }, 1000);

    const handleBeforeInstallPrompt = (e) => {
      console.log('PWA: browser-native install event fired');
      e.preventDefault();
      setDeferredPrompt(e);
      setUseFallback(false);
      setShowInstallPrompt(true);
      clearTimeout(timer);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setShowInstallPrompt(false);
      setIsInstalling(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      clearTimeout(timer);
    };
  }, [deferredPrompt]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    setIsInstalling(true);
    try {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
    } catch (error) {
      console.error('PWA: Installation failed:', error);
    } finally {
      setIsInstalling(false);
      setDeferredPrompt(null);
      setShowInstallPrompt(false);
    }
  };

  const handleDismiss = () => {
    setShowInstallPrompt(false);
  };

  if (!showInstallPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-white border-[3px] border-slate-900 rounded-[2.5rem] shadow-2xl p-6 z-[9999] backdrop-blur-xl bg-white/95">
      <div className="flex items-start space-x-4">
        <div className="flex-shrink-0">
          <div className={`w-14 h-14 ${isInApp ? 'bg-amber-500' : 'bg-indigo-600'} rounded-2xl flex items-center justify-center shadow-lg`}>
            {isInApp ? (
               <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
               </svg>
            ) : (
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            )}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-xl font-black text-slate-900 tracking-tight">
            {isInApp ? "Restricted Browser" : "Install KL Attendance"}
          </h3>
          <p className="text-sm text-slate-500 font-medium mt-1 leading-relaxed">
            {isInApp 
              ? "Installation is blocked in this app. Please open the link in Chrome or Safari to install."
              : useFallback 
                ? (isIOS ? "Tap 'Share' and 'Add to Home Screen' for the best experience." : "Find 'Install App' in your browser's menu to install.")
                : "Install now for full attendance tracking and dashboard features."}
          </p>
        </div>
        <button
          onClick={handleDismiss}
          className="flex-shrink-0 text-slate-400 hover:text-slate-900 transition-colors p-1"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      
      {isInApp ? (
         <div className="mt-6 bg-amber-50 rounded-2xl p-4 border border-amber-100">
            <p className="text-xs font-bold text-amber-700 uppercase tracking-widest mb-1">In-App Browser Detected</p>
            <p className="text-[13px] text-amber-900 font-medium">
               1. Tap the 3 dots (⋮) or (⋯)<br/>
               2. Select <b>'Open in Chrome'</b> or <b>'Open in Safari'</b>
            </p>
         </div>
      ) : !useFallback ? (
        <div className="mt-6 flex space-x-3">
          <button
            onClick={handleInstallClick}
            disabled={isInstalling}
            className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-sm font-black py-4 px-4 rounded-2xl transition-all duration-200 shadow-lg"
          >
            {isInstalling ? 'Installing...' : 'Install Now'}
          </button>
          <button
            onClick={handleDismiss}
            className="flex-1 bg-slate-50 hover:bg-slate-100 text-slate-500 text-sm font-bold py-4 px-4 rounded-2xl transition-all"
          >
            Later
          </button>
        </div>
      ) : (
        <div className="mt-6 bg-slate-50 rounded-2xl p-4 border border-slate-100">
           <p className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-2 flex items-center gap-2">
             <span className="w-2 h-2 bg-indigo-500 rounded-full animate-ping" />
             Setup Required
           </p>
           <p className="text-[13px] text-slate-700 font-medium leading-relaxed">
             {isIOS 
               ? "1. Tap 'Share' button at bottom\n2. Scroll down & 'Add to Home Screen'"
               : "Click the menu (⋮) and select 'Install' or 'Add to home screen'."}
           </p>
        </div>
      )}
    </div>
  );


};

export default PWAInstallPrompt;
