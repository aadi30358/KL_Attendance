import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, RefreshCw, X, ShieldAlert, Check } from 'lucide-react';
import { getCredentials } from '../utils/storage';
import { getFormData, API_CONFIG } from '../config/api';

export default function CaptchaModal({ isOpen, onClose, onSuccess, friendCredentials = null }) {
  const [captchaInput, setCaptchaInput] = useState("");
  const [captchaUrl, setCaptchaUrl] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [imageLoading, setImageLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadCaptcha = useCallback(async () => {
    setImageLoading(true);
    setError("");
    
    try {
      const response = await fetch(API_CONFIG.CAPTCHA_URL);
      if (!response.ok) throw new Error("Failed to load captcha");
      
      const blob = await response.blob();
      
      // Get session ID from headers
      const sessionIdFromHeader = response.headers.get('x-session-id') || 
                                 response.headers.get('X-Session-ID') || 
                                 response.headers.get('X-SESSION-ID');
      
      if (sessionIdFromHeader) {
        setSessionId(sessionIdFromHeader);
      } else {
        // Fallback: use timestamp as session ID
        setSessionId(`session_${Date.now()}`);
      }
      
      const imageUrl = URL.createObjectURL(blob);
      setCaptchaUrl(imageUrl);
      
    } catch (err) {
      setError("Failed to load CAPTCHA");
    } finally {
      setImageLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      setCaptchaInput("");
      setError("");
      loadCaptcha();
    }
  }, [isOpen, loadCaptcha]);

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    
    if (!captchaInput.trim()) {
      setError("Please enter the CAPTCHA");
      return;
    }

    if (!sessionId) {
      setError("CAPTCHA not loaded. Please try again.");
      return;
    }

    setIsLoading(true);
    setError("");

    // Use friend credentials if provided, otherwise use stored credentials
    const creds = friendCredentials || getCredentials();
    if (!creds) {
      setError("Session expired. Please log in again.");
      setIsLoading(false);
      return;
    }

    const semester = friendCredentials ? friendCredentials.semester : (localStorage.getItem("semester") || "Even");
    const academicYear = friendCredentials ? friendCredentials.academicYear : (localStorage.getItem("academicYear") || "2024-25");

    try {
      const form = getFormData(creds.idNumber || creds.username, creds.password, captchaInput, semester, academicYear, sessionId);
      
      const response = await fetch(API_CONFIG.FETCH_URL, {
        method: 'POST',
        body: form
      });
      
      const data = await response.json();
      
      if (data.success) {
        const attendanceData = data.timetable && Object.keys(data.timetable).length > 0 
          ? data.timetable 
          : JSON.parse(localStorage.getItem(`attendance_${creds.idNumber || creds.username}`) || "{}");
          
        onSuccess(attendanceData);
        onClose();

      } else {
        setError(data.message || "Invalid CAPTCHA. Please try again.");
        loadCaptcha();
        setCaptchaInput("");
      }
    } catch (err) {
      setError("Something went wrong. Please check your connection.");
      loadCaptcha();
      setCaptchaInput("");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefreshCaptcha = async () => {
    setRefreshing(true);
    await loadCaptcha();
    setTimeout(() => {
      setRefreshing(false);
    }, 15000);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[2000] p-4" onClick={onClose}>
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="bg-white rounded-[2.5rem] p-8 w-full max-w-md shadow-2xl relative border-[3px] border-slate-900 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
             {/* Header */}
             <div className="text-center mb-8">
              <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-200">
                <RefreshCw size={24} className={`text-white ${isLoading || refreshing ? 'animate-spin' : ''}`} />
              </div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                {friendCredentials ? `Sync ${friendCredentials.name || 'Friend'}'s Data` : 'Sync Attendance'}
              </h2>
              <p className="text-slate-500 text-sm font-medium mt-1">Enter ERP captcha to fetch records</p>

            </div>

            <button 
              onClick={onClose}
              className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-900 transition-colors"
            >
              <X size={20} />
            </button>

            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-2xl text-xs font-bold flex items-center gap-2">
                  <ShieldAlert size={14} />
                  {error}
                </div>
              )}

              <div className="flex flex-col items-center gap-4">
                <div className="w-full bg-slate-100 rounded-2xl h-16 flex items-center justify-center overflow-hidden relative border-2 border-slate-100">
                  {imageLoading ? (
                    <div className="animate-pulse flex gap-2">
                       <div className="w-3 h-3 bg-slate-300 rounded-full" />
                       <div className="w-3 h-3 bg-slate-300 rounded-full" />
                       <div className="w-3 h-3 bg-slate-300 rounded-full" />
                    </div>
                  ) : captchaUrl ? (
                    <img src={captchaUrl} alt="CAPTCHA" className="h-10 object-contain mix-blend-multiply transition-opacity duration-300" />
                  ) : (
                    <span className="text-slate-400 text-xs font-bold">Failed to load</span>
                  )}
                </div>
                
                {refreshing && (
                  <div className="text-[10px] text-amber-500 font-bold bg-amber-50 px-3 py-1 rounded-full flex items-center gap-2 animate-pulse">
                    <Loader2 size={10} className="animate-spin" />
                    Cooldown: Wait 15 seconds to refresh
                  </div>
                )}
                
                <button
                  type="button"
                  onClick={handleRefreshCaptcha}
                  disabled={isLoading || refreshing}
                  className="text-xs font-black text-indigo-600 hover:text-indigo-700 disabled:opacity-50 flex items-center gap-2 uppercase tracking-widest"
                >
                  <RefreshCw size={12} />
                  ReSync CAPTCHA
                </button>
              </div>

              <div className="relative">
                <input
                  type="text"
                  placeholder="Enter CAPTCHA"
                  value={captchaInput}
                  onChange={(e) => setCaptchaInput(e.target.value)}
                  className="w-full bg-white border-2 border-slate-100 rounded-2xl py-4 px-5 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 transition-all font-black tracking-widest text-center text-lg shadow-sm"
                  onKeyPress={(e) => e.key === "Enter" && handleSubmit()}
                  disabled={isLoading}
                />
              </div>

              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isLoading}
                  className="flex-1 py-4 rounded-2xl bg-slate-100 text-slate-600 font-bold hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading || imageLoading}
                  className="flex-1 py-4 rounded-2xl bg-indigo-600 text-white font-black hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isLoading ? <Loader2 className="animate-spin" size={20} /> : <><Check size={20}/> Sync ERP</>}
                </button>
              </div>
            </form>

            <div className="mt-8 text-center">
              <p className="text-[10px] text-slate-400 font-medium">
                Your credentials are never stored. <br/> This sync allows high-speed timetable fetching.
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
