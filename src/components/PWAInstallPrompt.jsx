import React, { useState, useEffect } from 'react';

const PWAInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  const [isIOS, setIsIOS] = useState(false);
  const [useFallback, setUseFallback] = useState(false);

  useEffect(() => {
    // Check if app is already running in standalone mode (installed)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    
    // Detect iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(isIOSDevice);

    // If already installed, never show the prompt
    if (isStandalone) {
      console.log('PWA: Already in standalone mode.');
      setShowInstallPrompt(false);
      return;
    }

    // AGGRESSIVE TIMER: If after 3 seconds we don't have a deferredPrompt, force show the fallback UI
    const timer = setTimeout(() => {
      if (!deferredPrompt && !isStandalone) {
        console.log('PWA: Force showing fallback UI (timeout).');
        setUseFallback(true);
        setShowInstallPrompt(true);
      }
    }, 3000);

    const handleBeforeInstallPrompt = (e) => {
      console.log('PWA: beforeinstallprompt received!');
      e.preventDefault();
      setDeferredPrompt(e);
      setUseFallback(false); // We have the real prompt, no need for fallback
      setShowInstallPrompt(true);
      clearTimeout(timer);
    };

    const handleAppInstalled = () => {
      console.log('PWA: Successfully installed on device.');
      setDeferredPrompt(null);
      setShowInstallPrompt(false);
      setIsInstalling(false);
    };

    const handleManualTrigger = () => {
      setShowInstallPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('triggerPWAInstall', handleManualTrigger);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('triggerPWAInstall', handleManualTrigger);
      clearTimeout(timer);
    };
  }, [deferredPrompt]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      // If we're here, we're in fallback mode. 
      // Manual instructions are already shown in the UI.
      return;
    }
    
    setIsInstalling(true);
    
    try {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`PWA: User choice outcome: ${outcome}`);
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
          <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-xl font-black text-slate-900 tracking-tight">
            Install KL Attendance
          </h3>
          <p className="text-sm text-slate-500 font-medium mt-1 leading-relaxed">
            {useFallback 
              ? (isIOS ? "Tap the Share icon and select 'Add to Home Screen' for a desktop-like experience." : "Find 'Install App' in your browser's menu for the best experience.")
              : "Install the app for instant access and a cleaner mobile interface."}
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
      
      {!useFallback ? (
        <div className="mt-6 flex space-x-3">
          <button
            onClick={handleInstallClick}
            disabled={isInstalling}
            className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-sm font-black py-4 px-4 rounded-2xl transition-all duration-200 shadow-lg shadow-indigo-100 flex items-center justify-center gap-2"
          >
            {isInstalling ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Installing...</span>
              </>
            ) : (
              'Install Now'
            )}
          </button>
          <button
            onClick={handleDismiss}
            className="flex-1 bg-slate-50 hover:bg-slate-100 text-slate-500 text-sm font-bold py-4 px-4 rounded-2xl transition-all duration-200"
          >
            Cool
          </button>
        </div>
      ) : (
        <div className="mt-6 bg-slate-50 rounded-2xl p-4 border border-slate-100">
           <p className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-2 flex items-center gap-2">
             <span className="w-2 h-2 bg-indigo-500 rounded-full animate-ping" />
             Instruction Guide
           </p>
           <p className="text-[13px] text-slate-700 font-medium leading-relaxed">
             {isIOS 
               ? "1. Tap 'Share' button at bottom\n2. Scroll down & 'Add to Home Screen'"
               : "Click the 3 dots (⋮) or arrow in your browser bar and select 'Install' or 'Add to home screen'."}
           </p>
        </div>
      )}
    </div>
  );

};

export default PWAInstallPrompt;
