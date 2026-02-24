import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { Megaphone, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const AnnouncementBanner = () => {
    const [announcement, setAnnouncement] = useState("");
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        // Real-time listener for announcements
        const unsub = onSnapshot(doc(db, "config", "global"), (doc) => {
            if (doc.exists()) {
                setAnnouncement(doc.data().announcement);
            }
        }, (error) => {
            // Suppress "Missing or insufficient permissions" error for unauthenticated (not logged in) users
            console.log("Announcement banner hidden (auth required)");
        });
        return () => unsub();
    }, []);

    if (!announcement || !isVisible) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="bg-blue-600 text-white py-3 px-4 relative z-[60]"
            >
                <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-1.5 bg-white/20 rounded-lg animate-pulse">
                            <Megaphone className="w-4 h-4" />
                        </div>
                        <p className="text-sm font-bold tracking-wide italic">
                            <span className="opacity-70 not-italic mr-2">NOTICE:</span>
                            {announcement}
                        </p>
                    </div>
                    <button
                        onClick={() => setIsVisible(false)}
                        className="p-1 hover:bg-white/20 rounded-full transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </motion.div>
        </AnimatePresence>
    );
};

export default AnnouncementBanner;
