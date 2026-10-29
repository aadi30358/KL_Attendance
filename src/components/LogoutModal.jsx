import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, Trash2, ShieldCheck, X } from 'lucide-react';

export default function LogoutModal({ isOpen, onClose, onConfirm, onDisconnect }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white relative"
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header */}
            <div className="text-center mb-6">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-3 shadow-inner">
                <LogOut className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-black tracking-tight">Account &amp; Session Options</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto">
                Choose how you want to end your current session.
              </p>
            </div>

            {/* Choices */}
            <div className="space-y-3 mb-6">
              {/* Option 1: Application Logout */}
              <button
                type="button"
                onClick={onConfirm}
                className="w-full p-4 rounded-2xl border-2 border-indigo-100 dark:border-indigo-900/60 hover:border-indigo-500 dark:hover:border-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/20 text-left transition-all group flex items-start gap-3 cursor-pointer"
              >
                <div className="p-2 rounded-xl bg-indigo-600 text-white shrink-0 mt-0.5">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                    <span>Application Logout</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300">
                      Recommended
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                    Ends your active login session and clears cookies. Your saved timetable, CGPA, and offline attendance remain preserved in the persistent database.
                  </p>
                </div>
              </button>

              {/* Option 2: Disconnect & Delete Data */}
              <button
                type="button"
                onClick={onDisconnect || onConfirm}
                className="w-full p-4 rounded-2xl border-2 border-rose-100 dark:border-rose-950/60 hover:border-rose-500 dark:hover:border-rose-500 bg-rose-50/30 dark:bg-rose-950/10 text-left transition-all group flex items-start gap-3 cursor-pointer"
              >
                <div className="p-2 rounded-xl bg-rose-600 text-white shrink-0 mt-0.5">
                  <Trash2 className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-sm text-rose-700 dark:text-rose-400">
                    Disconnect ERP &amp; Delete Data
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                    Completely disconnects your university ERP account and wipes your saved timetable, CGPA, and attendance from this device and the server.
                  </p>
                </div>
              </button>
            </div>

            {/* Cancel Button */}
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 rounded-xl font-bold text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

