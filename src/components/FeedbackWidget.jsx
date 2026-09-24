import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    MessageSquarePlus, 
    X, 
    Send, 
    CheckCircle2, 
    Sparkles, 
    Bug, 
    Lightbulb, 
    Heart, 
    Shield
} from 'lucide-react';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/useAuth';

const CATEGORIES = [
    { id: 'suggestion', label: 'Idea', icon: Lightbulb, color: 'text-amber-500 bg-amber-50 border-amber-200' },
    { id: 'bug', label: 'Bug Report', icon: Bug, color: 'text-red-500 bg-red-50 border-red-200' },
    { id: 'feature', label: 'Feature Request', icon: Sparkles, color: 'text-indigo-500 bg-indigo-50 border-indigo-200' },
    { id: 'compliment', label: 'Compliment', icon: Heart, color: 'text-pink-500 bg-pink-50 border-pink-200' }
];

export default function FeedbackWidget() {
    const [isOpen, setIsOpen] = useState(false);
    const [category, setCategory] = useState('suggestion');
    const [message, setMessage] = useState('');
    const [anonymous, setAnonymous] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState('');

    const location = useLocation();
    const { currentUser, erpUser } = useAuth();

    const activeId = localStorage.getItem('activeErpUser') || localStorage.getItem('rememberedId') || erpUser?.id || '';
    const userEmail = currentUser?.email || '';

    const handleOpen = () => {
        setIsOpen(true);
        setSubmitted(false);
        setError('');
    };

    const handleClose = () => {
        setIsOpen(false);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const trimmed = message.trim();
        if (!trimmed) {
            setError('Please enter your feedback before submitting.');
            return;
        }

        const feedbackId = `fb_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        const timestamp = new Date().toISOString();

        const feedbackRecord = {
            id: feedbackId,
            category,
            message: trimmed,
            page: location.pathname,
            timestamp,
            studentId: anonymous ? 'Anonymous' : (activeId || 'Guest'),
            userEmail: anonymous ? '' : userEmail,
            userAgent: navigator.userAgent
        };

        // 1. Instant 0ms response - show success immediately with zero lag!
        setSubmitted(true);
        setMessage('');
        setError('');

        // 2. Save to local storage synchronously
        try {
            const stored = JSON.parse(localStorage.getItem('kl_user_feedbacks') || '[]');
            stored.unshift(feedbackRecord);
            localStorage.setItem('kl_user_feedbacks', JSON.stringify(stored.slice(0, 100)));
        } catch {
            // Ignore storage quota errors
        }

        // 3. Broadcast in real-time to open Admin tabs (instant 0ms update)
        try {
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('kl_new_feedback', { detail: feedbackRecord }));
                if ('BroadcastChannel' in window) {
                    const bc = new BroadcastChannel('kl_portal_sync');
                    bc.postMessage({ type: 'FEEDBACK_EVENT', data: feedbackRecord });
                    setTimeout(() => bc.close(), 1000);
                }
            }
        } catch {
            // ignore
        }

        // 4. Dispatch to Firestore in the background (non-blocking)
        setDoc(doc(db, 'feedback', feedbackId), {
            ...feedbackRecord,
            createdAt: serverTimestamp()
        }).catch(fsErr => {
            console.warn('Firestore feedback background save notice:', fsErr);
        });

        // 4. Auto-dismiss after 1.8 seconds
        setTimeout(() => {
            setIsOpen(false);
            setSubmitted(false);
        }, 1800);
    };

    return (
        <>
            {/* Floating Trigger Button */}
            <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.3 }}
                className="fixed bottom-10 right-3.5 sm:bottom-6 sm:right-6 z-40"
            >
                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleOpen}
                    className="flex items-center gap-1.5 sm:gap-2 bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-700 text-white px-2.5 py-1.5 sm:px-3.5 sm:py-2.5 rounded-full shadow-md sm:shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 transition-all border border-white/20 group"
                    aria-label="Provide Feedback"
                >
                    <div className="relative">
                        <MessageSquarePlus className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-white transition-transform group-hover:rotate-12" />
                        <span className="absolute -top-0.5 -right-0.5 sm:-top-1 sm:-right-1 w-1.5 h-1.5 sm:w-2 sm:h-2 bg-emerald-400 rounded-full animate-ping" />
                        <span className="absolute -top-0.5 -right-0.5 sm:-top-1 sm:-right-1 w-1.5 h-1.5 sm:w-2 sm:h-2 bg-emerald-400 rounded-full" />
                    </div>
                    <span className="text-[11px] sm:text-xs font-bold tracking-wide pr-0.5 sm:pr-1">Feedback</span>
                </motion.button>
            </motion.div>

            {/* Modal Dialog */}
            <AnimatePresence>
                {isOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={handleClose}
                            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
                        />

                        {/* Modal Box */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.92, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.92, y: 20 }}
                            transition={{ type: 'spring', duration: 0.4, bounce: 0.2 }}
                            className="relative w-full max-w-lg bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden z-10 max-h-[90vh] overflow-y-auto"
                        >
                            {/* Header Gradient Top Bar */}
                            <div className="bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-700 p-4 sm:p-6 text-white relative">
                                <button
                                    onClick={handleClose}
                                    className="absolute top-4 right-4 sm:top-5 sm:right-5 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                                    aria-label="Close"
                                >
                                    <X className="w-4 h-4 sm:w-5 sm:h-5" />
                                </button>
                                <div className="flex items-center gap-2 sm:gap-2.5 mb-1">
                                    <div className="p-1.5 sm:p-2 bg-white/15 rounded-xl backdrop-blur-md">
                                        <MessageSquarePlus className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                                    </div>
                                    <h2 className="text-base sm:text-lg font-black tracking-tight">Share Your Feedback</h2>
                                </div>
                                <p className="text-[11px] sm:text-xs text-indigo-100 font-medium">
                                    Help us improve your KL Attendance & ERP experience.
                                </p>
                            </div>

                            {/* Modal Body */}
                            <div className="p-4 sm:p-6">
                                {submitted ? (
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        className="py-8 text-center"
                                    >
                                        <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4 ring-8 ring-emerald-50/50">
                                            <CheckCircle2 className="w-9 h-9 text-emerald-600" />
                                        </div>
                                        <h3 className="text-xl font-black text-slate-900 mb-1.5">Thank You!</h3>
                                        <p className="text-xs text-slate-500 font-medium max-w-xs mx-auto mb-6">
                                            Your feedback has been saved and helps make KL Attendance Calculator even better for everyone.
                                        </p>
                                        <button
                                            onClick={handleClose}
                                            className="px-6 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-all"
                                        >
                                            Close
                                        </button>
                                    </motion.div>
                                ) : (
                                    <form onSubmit={handleSubmit} className="space-y-4">
                                        {/* Category Selector */}
                                        <div>
                                            <label className="block text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">
                                                What is this about?
                                            </label>
                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                                {CATEGORIES.map((cat) => {
                                                    const Icon = cat.icon;
                                                    const isSelected = category === cat.id;
                                                    return (
                                                        <button
                                                            key={cat.id}
                                                            type="button"
                                                            onClick={() => setCategory(cat.id)}
                                                            className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl border text-xs font-bold transition-all ${
                                                                isSelected
                                                                    ? `${cat.color} ring-2 ring-indigo-500/20 shadow-sm font-black`
                                                                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                                                            }`}
                                                        >
                                                            <Icon className="w-3.5 h-3.5 shrink-0" />
                                                            <span className="truncate">{cat.label}</span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* Message Textarea */}
                                        <div>
                                            <div className="flex justify-between items-center mb-1.5">
                                                <label className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                                                    Your Message
                                                </label>
                                                <span className="text-[10px] text-slate-400 font-mono">
                                                    {message.length}/1000
                                                </span>
                                            </div>
                                            <textarea
                                                rows={4}
                                                maxLength={1000}
                                                value={message}
                                                onChange={(e) => setMessage(e.target.value)}
                                                placeholder="Share your thoughts, suggestions, or report any issues..."
                                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 resize-none font-medium"
                                            />
                                        </div>

                                        {/* User Identity Info / Anonymous Option */}
                                        <div className="flex items-center justify-between text-xs bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
                                            <div className="flex items-center gap-1.5 text-slate-600 font-semibold">
                                                <Shield className="w-3.5 h-3.5 text-slate-400" />
                                                <span>
                                                    {anonymous ? 'Submitting Anonymously' : activeId ? `ID: ${activeId}` : 'Guest Student'}
                                                </span>
                                            </div>
                                            <label className="flex items-center gap-1.5 cursor-pointer text-slate-500 hover:text-slate-700 select-none">
                                                <input
                                                    type="checkbox"
                                                    checked={anonymous}
                                                    onChange={(e) => setAnonymous(e.target.checked)}
                                                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                                                />
                                                <span className="text-[11px] font-medium">Keep Anonymous</span>
                                            </label>
                                        </div>

                                        {/* Error Alert */}
                                        {error && (
                                            <p className="text-xs font-semibold text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-xl">
                                                {error}
                                            </p>
                                        )}

                                        {/* Submit Button */}
                                        <div className="flex gap-2 pt-1">
                                            <button
                                                type="button"
                                                onClick={handleClose}
                                                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                type="submit"
                                                disabled={!message.trim()}
                                                className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-bold py-2.5 rounded-xl shadow-md transition-all shadow-indigo-500/20 active:scale-95"
                                            >
                                                <Send className="w-3.5 h-3.5" />
                                                <span>Submit Feedback</span>
                                            </button>
                                        </div>
                                    </form>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </>
    );
}
