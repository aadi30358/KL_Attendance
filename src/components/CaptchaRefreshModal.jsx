import React, { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, RefreshCw, X, ShieldAlert, Check } from 'lucide-react';
import { getCredentials } from "../utils/storage";
import { getFormData, API_CONFIG } from "../config/api.js";

export default function CaptchaRefreshModal({ onClose, onSuccess }) {
  const [captchaUrl, setCaptchaUrl] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [captchaInput, setCaptchaInput] = useState("");
  const [captchaLoading, setCaptchaLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const loadCaptcha = useCallback(async () => {
    setCaptchaLoading(true);
    setError("");
    
    try {
      const response = await fetch(API_CONFIG.CAPTCHA_URL, {
        credentials: 'include',
        headers: { 'Accept': 'image/svg+xml, application/json' }
      });

      if (!response.ok) {
        if (response.status === 404) throw new Error("Captcha endpoint not found (404). Is the server running?");
        if (response.status === 504) throw new Error("Gateway Timeout (504). Backend unreachable.");
        throw new Error(`HTTP ${response.status}: Failed to load`);
      }
      
      const contentType = response.headers.get('content-type');
      let imageUrl;

      if (contentType && contentType.includes('svg')) {
        const svgText = await response.text();
        imageUrl = `data:image/svg+xml;utf8,${encodeURIComponent(svgText)}`;
      } else {
        const blob = await response.blob();
        imageUrl = URL.createObjectURL(blob);
      }
      
      setCaptchaUrl(imageUrl);
      
      // Get session ID from headers if available
      const sid = response.headers.get('x-session-id');
      setSessionId(sid || `session_${Date.now()}`);
      
    } catch (err) {
      console.error("Captcha Error:", err);
      setError(err.message || "Failed to load CAPTCHA. Check if backend is running on port 3000.");
    } finally {
      setCaptchaLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCaptcha();
  }, [loadCaptcha]);

  const handleRefresh = async (e) => {
    if (e) e.preventDefault();
    
    const creds = getCredentials();
    if (!creds) {
      setError("No saved credentials. Please login again.");
      setTimeout(() => onClose(), 2000);
      return;
    }

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

    // Get stored semester and academic year
    const storedSemester = localStorage.getItem("semester") || "Even";
    const storedAcademicYear = localStorage.getItem("academicYear") || "2024-25";

    try {
      const response = await fetch(API_CONFIG.FETCH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: creds.idNumber || creds.username,
          password: creds.password,
          captcha: captchaInput,
          semester: storedSemester,
          academicYear: storedAcademicYear,
          sessionId: sessionId
        }),
        credentials: 'include'
      });
      
      const data = await response.json();
      
      if (data.success) {
        // If server returns timetable object, use it. Otherwise, assume it's just a trigger.
        const attendanceData = data.attendance && Object.keys(data.attendance).length > 0 
          ? data.attendance 
          : JSON.parse(localStorage.getItem(`attendance_${creds.idNumber || creds.username}`) || "{}");
          
        onSuccess(attendanceData);
        onClose();

      } else {
        setError(data.message || "ReSync failed");
        loadCaptcha();
        setCaptchaInput("");
      }
    } catch (err) {
      setError("Error syncing timetable. Check connection.");
      loadCaptcha();
      setCaptchaInput("");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[2000] p-4" onClick={onClose}>
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="bg-white rounded-[2.5rem] p-8 w-full max-w-md shadow-2xl relative border-[3px] border-slate-900 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-200">
            <RefreshCw size={24} className={`text-white ${isLoading ? 'animate-spin' : ''}`} />
          </div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">ReSync Attendance</h2>
          <p className="text-slate-500 text-sm font-medium mt-1">Enter the new CAPTCHA to update</p>

        </div>

        <button 
          onClick={onClose}
          className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-900 transition-colors"
        >
          <X size={20} />
        </button>

        <form onSubmit={handleRefresh} className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-2xl text-xs font-bold flex items-center gap-2">
              <ShieldAlert size={14} />
              {error}
            </div>
          )}

          <div className="flex flex-col items-center gap-4">
            <div className="w-full bg-slate-100 rounded-2xl h-16 flex items-center justify-center overflow-hidden relative border-2 border-slate-100">
              {captchaLoading ? (
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
            
            <button
              type="button"
              onClick={loadCaptcha}
              disabled={isLoading || captchaLoading}
              className="text-xs font-black text-indigo-600 hover:text-indigo-700 disabled:opacity-50 flex items-center gap-2 uppercase tracking-widest"
            >
              <RefreshCw size={12} />
              Refresh CAPTCHA
            </button>
          </div>

          <div className="relative">
            <input
              type="text"
              placeholder="Type CAPTCHA here"
              value={captchaInput}
              onChange={(e) => setCaptchaInput(e.target.value)}
              className="w-full bg-white border-2 border-slate-100 rounded-2xl py-4 px-5 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 transition-all font-black tracking-widest text-center text-lg shadow-sm"
              onKeyPress={(e) => e.key === "Enter" && handleRefresh()}
              disabled={isLoading}
              autoFocus
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
              disabled={isLoading || captchaLoading}
              className="flex-1 py-4 rounded-2xl bg-indigo-600 text-white font-black hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading ? <Loader2 className="animate-spin" size={20} /> : <><Check size={20}/> ReSync</>}
            </button>
          </div>
        </form>

        <div className="mt-8 text-center">
          <p className="text-[10px] text-slate-400 font-medium">
            Note: This triggers a high-speed refresh <br/> from the primary attendance server.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
