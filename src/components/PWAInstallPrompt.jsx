import React, { useState, useEffect } from 'react';

const PWAInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  useEffect(() => {
    // Check if app is already running in standalone mode (installed)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    
    // If already installed, never show the prompt
    if (isStandalone) {
      console.log('PWA: Already in standalone mode.');
      setShowInstallPrompt(false);
      return;
    }

    const handleBeforeInstallPrompt = (e) => {
      console.log('PWA: beforeinstallprompt received!');
      // Prevent automatic behavior
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallPrompt(true);
    };

    const handleAppInstalled = () => {
      console.log('PWA: Successfully installed on device.');
      setDeferredPrompt(null);
      setShowInstallPrompt(false);
      setIsInstalling(false);
    };

    const handleManualTrigger = () => {
      console.log('PWA: Manual trigger requested.');
      if (deferredPrompt) {
        setShowInstallPrompt(true);
      } else {
        console.warn('PWA: Manual trigger failed - no deferredPrompt available.');
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('triggerPWAInstall', handleManualTrigger);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('triggerPWAInstall', handleManualTrigger);
    };
  }, [deferredPrompt]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      console.error('PWA: Install clicked but no deferredPrompt found.');
      return;
    }
    
    setIsInstalling(true);
    
    try {
      console.log('PWA: Triggering browser install prompt.');
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
    console.log('PWA: User dismissed the prompt UI.');
    setShowInstallPrompt(false);
    // REMOVED sessionStorage suppression to allow re-prompt on refresh as requested
  };

  if (!showInstallPrompt) return null;



  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 bg-white border-[3px] border-slate-900 rounded-[2rem] shadow-2xl p-6 z-[9999] backdrop-blur-xl bg-white/90">
      <div className="flex items-start space-x-4">
        <div className="flex-shrink-0">
          <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100">
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-black text-slate-900 tracking-tight">
            Install KL Attendance
          </h3>
          <p className="text-sm text-slate-500 font-medium mt-1 leading-relaxed">
            Add to home screen for quick access and offline use.
          </p>
        </div>
        <button
          onClick={handleDismiss}
          className="flex-shrink-0 text-slate-400 hover:text-slate-900 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="mt-6 flex space-x-3">
        <button
          onClick={handleInstallClick}
          disabled={isInstalling}
          className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-sm font-black py-3 px-4 rounded-xl transition-all duration-200 shadow-lg shadow-indigo-100 flex items-center justify-center gap-2"
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
          className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-bold py-3 px-4 rounded-xl transition-all duration-200"
        >
          Later
        </button>
      </div>
    </div>
  );
};

export default PWAInstallPrompt;
