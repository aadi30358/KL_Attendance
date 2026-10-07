import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, Bell, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { useAuth } from '../context/useAuth';
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { db } from '../firebase';
import { cn } from '../lib/utils';

const Navbar = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const [announcement, setAnnouncement] = useState(() => {
        try {
            return sessionStorage.getItem('kl_announcement') || "";
        } catch {
            return "";
        }
    });
    const [maintenanceConfig, setMaintenanceConfig] = useState(() => {
        try {
            const raw = localStorage.getItem('kl_erp_maintenance');
            return raw ? JSON.parse(raw) : { enabled: true, title: 'ERP Login is Under Maintenance' };
        } catch {
            return { enabled: true, title: 'ERP Login is Under Maintenance' };
        }
    });

    const { currentUser, erpUser, logout } = useAuth(); // Import erpUser here
    const location = useLocation();
    const navigate = useNavigate();

    const handleLogout = async () => {
        try {
            await logout();
            navigate('/login');
            window.location.reload(); // Force full state reset 
        } catch (error) {
            console.error("Logout failed:", error);
        }
    };

    const handleResetSemester = () => {
        const activeId = localStorage.getItem('activeErpUser') || localStorage.getItem('rememberedId');
        if (activeId) {
            localStorage.removeItem(`kleData_${activeId}`);
        }
        localStorage.removeItem('kleData'); // Fallback
        sessionStorage.setItem('manual_sem_reset', 'true');
        window.dispatchEvent(new CustomEvent('kl_reset_selection'));
        navigate('/attendance-register');
        setIsOpen(false);
    };

    // Real-time synchronization for Announcements and Maintenance across all domains (< 1 second)
    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener('scroll', handleScroll, { passive: true });

        // 1. Instant Real-time Announcement stream from Firestore
        let unsubAnnounce = null;
        try {
            unsubAnnounce = onSnapshot(doc(db, "config", "global"), (snap) => {
                if (snap.exists()) {
                    const data = snap.data();
                    const text = data.announcement || data.text || "";
                    setAnnouncement(text);
                    try { 
                        sessionStorage.setItem('kl_announcement', text); 
                    } catch {
                        // ignore storage quota
                    }
                }
            }, () => {
                // Fallback to config/announcements if config/global is not used
                try {
                    getDoc(doc(db, "config", "announcements")).then(docSnap => {
                        if (docSnap.exists()) {
                            const text = docSnap.data().text || docSnap.data().announcement || "";
                            setAnnouncement(text);
                        }
                    }).catch(() => {});
                } catch {
                    // ignore fallback error
                }
            });
        } catch {
            // ignore
        }

        // 2. Real-time ERP Maintenance mode stream
        let unsubMaintenance = null;
        try {
            unsubMaintenance = onSnapshot(doc(db, 'config', 'maintenance'), (snapshot) => {
                if (snapshot.exists()) {
                    const data = snapshot.data();
                    setMaintenanceConfig(data);
                    try { 
                        localStorage.setItem('kl_erp_maintenance', JSON.stringify(data)); 
                    } catch {
                        // ignore storage quota
                    }
                } else {
                    setMaintenanceConfig({ enabled: false });
                }
            }, (err) => {
                console.warn("[Navbar] Maintenance sync notice:", err);
            });
        } catch (err) {
            console.warn("[Navbar] Maintenance listener error:", err);
        }

        // 3. Storage event for multi-tab sync
        const handleStorage = (e) => {
            if (e.key === 'kl_erp_maintenance') {
                try {
                    setMaintenanceConfig(e.newValue ? JSON.parse(e.newValue) : { enabled: false });
                } catch {
                    // ignore parse error
                }
            }
            if (e.key === 'kl_announcement') {
                setAnnouncement(e.newValue || "");
            }
        };
        window.addEventListener('storage', handleStorage);

        // 4. Cross-Domain and BroadcastChannel instant sync (0ms)
        let bc = null;
        if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
            try {
                bc = new BroadcastChannel('kl_portal_sync');
                bc.onmessage = (event) => {
                    if (event.data?.type === 'MAINTENANCE_UPDATE' && event.data.data) {
                        setMaintenanceConfig(event.data.data);
                    } else if (event.data?.type === 'ANNOUNCEMENT_CHANGE' && event.data.data) {
                        setAnnouncement(event.data.data.announcement || event.data.data.text || "");
                    }
                };
            } catch (err) {
                console.warn("[Navbar] BroadcastChannel error:", err);
            }
        }

        return () => {
            window.removeEventListener('scroll', handleScroll);
            window.removeEventListener('storage', handleStorage);
            if (unsubAnnounce) unsubAnnounce();
            if (unsubMaintenance) unsubMaintenance();
            if (bc) bc.close();
        };
    }, []);

    const hasErpSession = !!erpUser;
    const rememberedId = typeof window !== 'undefined' ? localStorage.getItem('rememberedId') : null;
    const activeId = typeof window !== 'undefined' ? (localStorage.getItem('activeErpUser') || rememberedId) : null;
    const isLoginPage = location.pathname === '/login';
    const isLoggedIn = !!(currentUser || hasErpSession || activeId);
    const showLogout = isLoggedIn && !isLoginPage;

    const navItems = [
        { name: 'HOME', path: '/' },
        { name: 'ATTENDANCE BY L-T-P-S', path: '/ltps' },
        { name: 'BUNK SIMULATOR', path: '/bunk-simulator' },
        { name: 'ATTENDANCE WHEN ABSENT', path: '/attendance' },
        { name: 'ACADEMIC CALENDAR', path: '/calendar' },
        ...(!isLoggedIn ? [{ name: 'ERP LOGIN', path: '/login', isErpHighlight: true }] : []),
        ...(currentUser?.email === 'yaswanthadithyareddy11@gmail.com' ? [{ name: 'ADMIN', path: '/admin' }] : []),
        ...(isLoggedIn && !isLoginPage ? [{ name: 'CHANGE SELECTION', path: '/attendance-register', isReset: true }] : [])
    ];

    const isActive = (path) => location.pathname === path;

    return (
        <header className="fixed top-0 left-0 w-full z-50">
            {/* Top Title Bar */}
            <div className="bg-white dark:bg-[#0f172a] w-full py-1.5 px-4 shadow-sm z-50 relative border-b-2 border-black dark:border-slate-800 transition-colors">
                <div className="max-w-7xl mx-auto flex justify-center items-center">
                    <h1 className="text-[#103580] dark:text-indigo-400 font-serif font-bold text-xs sm:text-sm tracking-wide transition-colors">
                        Attendance Calculator for KLU students
                    </h1>
                </div>
            </div>

            {/* ERP Maintenance Scrolling Marquee Ticker */}
            <AnimatePresence>
                {maintenanceConfig?.enabled && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="bg-amber-400 text-slate-950 border-b-2 border-black dark:border-slate-800 py-1 overflow-hidden z-40 relative select-none"
                    >
                        <div className="flex items-center overflow-hidden whitespace-nowrap">
                            <div className="animate-marquee inline-flex items-center gap-10 text-xs font-bold tracking-wide">
                                {[...Array(8)].map((_, idx) => (
                                    <span key={idx} className="inline-flex items-center gap-2">
                                        <span className="text-sm select-none">🚨</span>
                                        <span className="bg-red-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded tracking-wider uppercase shadow-2xs">
                                            NOTICE
                                        </span>
                                        <span className="text-slate-950 font-black">
                                            {maintenanceConfig.title || 'ERP Login is Under Maintenance'}
                                            {maintenanceConfig.eta ? ` (${maintenanceConfig.eta})` : ''}
                                        </span>
                                        <span className="text-slate-500 font-bold mx-1">•</span>
                                    </span>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Announcement Bar */}
            <AnimatePresence>
                {announcement && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        className="bg-slate-900 text-white py-2 px-4 text-center text-xs font-bold tracking-widest uppercase overflow-hidden border-b-2 border-black dark:border-slate-800"
                    >
                        <div className="flex items-center justify-center gap-3 animate-pulse">
                            <Bell className="w-3 h-3 text-amber-400" />
                            <span>{announcement}</span>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Main Navbar */}
            <nav className={cn(
                "w-full transition-all duration-300",
                scrolled
                    ? "bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-lg border-b-2 border-black dark:border-slate-800 shadow-md py-2"
                    : "bg-[#2196F3] dark:bg-[#0f172a] border-b border-transparent dark:border-slate-800 py-3"
            )}>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center">
                        {/* Logo Section */}
                        <Link to="/" className="flex items-center space-x-3 group">
                            <img
                                src="/klu_final_logo.png"
                                alt="KL University Logo"
                                className={cn(
                                    "h-8 lg:h-12 w-auto object-contain transition-all duration-300 group-hover:scale-105"
                                )}
                            />
                        </Link>

                        {/* Desktop Menu */}
                        <div className="hidden lg:flex items-center gap-6">
                            {navItems.filter(item => !item.isMobileOnly).map((item) => (
                                item.comingSoon ? (
                                    <div
                                        key={item.path}
                                        className={cn(
                                            "relative px-3 py-2 text-[11px] lg:text-xs font-black tracking-wider uppercase rounded-lg transition-all duration-300 whitespace-nowrap lg:whitespace-normal text-center leading-tight max-w-[120px] flex items-center justify-center h-full cursor-not-allowed opacity-60",
                                            scrolled ? "text-slate-400 dark:text-slate-500" : "text-white/70"
                                        )}
                                    >
                                        {item.name}
                                        <span className="absolute -top-2 -right-2 text-[9px] bg-amber-500 text-white px-1.5 py-0.5 rounded-full font-bold shadow-sm">SOON</span>
                                    </div>
                                ) : (
                                    <button
                                        key={item.path}
                                        onClick={() => {
                                            if (item.isReset) handleResetSemester();
                                            else if (item.path) navigate(item.path);
                                        }}
                                        className={cn(
                                            "px-3 py-2 text-[11px] lg:text-xs font-black tracking-wider uppercase rounded-lg transition-all duration-300 whitespace-nowrap lg:whitespace-normal text-center leading-tight max-w-[120px] flex flex-col items-center justify-center h-full cursor-pointer",
                                            scrolled
                                                ? (isActive(item.path)
                                                    ? "text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-950/60 dark:border dark:border-indigo-500/40"
                                                    : item.isErpHighlight
                                                        ? "text-red-600 bg-red-50 dark:bg-red-950/40 border-2 border-red-200 dark:border-red-800 shadow-lg shadow-red-100 dark:shadow-none animate-pulse ring-2 ring-red-500/20"
                                                        : "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800")
                                                : (isActive(item.path)
                                                    ? "text-[#2196F3] dark:text-indigo-300 bg-white dark:bg-indigo-950/60 shadow-xl dark:border dark:border-indigo-500/40 transform scale-105"
                                                    : item.isErpHighlight
                                                        ? "text-white bg-red-600 shadow-xl shadow-red-500/40 hover:bg-red-700 border border-red-400 animate-pulse ring-2 ring-white/50"
                                                        : "text-white hover:bg-white/20 dark:text-slate-200 dark:hover:bg-slate-800")
                                        )}
                                    >
                                        <span>{item.name}</span>
                                        {item.subText && (
                                            <span className="text-[9px] mt-0.5 opacity-90 font-mono tracking-tighter normal-case">
                                                ID: {item.subText}
                                            </span>
                                        )}
                                    </button>
                                )
                            ))}


                            {/* Desktop User Account Section */}
                            {showLogout && (
                                <div className={cn(
                                    "flex items-center gap-1 p-1 rounded-xl transition-all",
                                    scrolled ? "bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700" : "bg-white/10 dark:bg-slate-800/60"
                                )}>
                                    {activeId && (
                                        <div className={cn(
                                            "flex items-center gap-2 px-3 py-1.5 rounded-lg font-black text-[10px] tracking-tighter",
                                            scrolled ? "text-slate-900 dark:text-slate-200" : "text-white"
                                        )}>
                                            <span className="opacity-50 font-medium tracking-normal text-[9px] uppercase">ID:</span>
                                            {activeId}
                                        </div>
                                    )}
                                    <button
                                        onClick={handleLogout}
                                        title="Logout Dashboard Session"
                                        className={cn(
                                            "flex items-center gap-2 px-3 py-1.5 text-[11px] font-black tracking-wider uppercase rounded-lg transition-all cursor-pointer",
                                            scrolled ? "bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/60" : "bg-white/20 text-white hover:bg-white/30"
                                        )}
                                    >
                                        <LogOut className="w-3.5 h-3.5" />
                                        <span>Logout</span>
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Mobile Menu Button */}
                        <div className="lg:hidden flex items-center gap-2">

                            {showLogout && (
                                <button
                                    onClick={handleLogout}
                                    title="Logout"
                                    className={cn("p-2 rounded-xl transition-colors cursor-pointer", scrolled ? "text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40" : "text-red-200 hover:bg-white/10")}
                                >
                                    <LogOut className="w-5 h-5" />
                                </button>
                            )}
                            <button
                                onClick={() => setIsOpen(!isOpen)}
                                className={cn("p-2 rounded-xl transition-colors cursor-pointer", scrolled ? "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800" : "text-white hover:bg-white/10")}
                            >
                                {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Mobile Dropdown */}
                <AnimatePresence>
                    {isOpen && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="lg:hidden bg-white dark:bg-[#0f172a] border-t border-slate-100 dark:border-slate-800 shadow-2xl overflow-hidden"
                        >
                            <div className="px-4 pt-4 pb-6 space-y-2">

                                {showLogout && activeId && (
                                    <div className="mx-0 mb-4 p-4 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-100 dark:border-slate-700 flex items-center justify-between">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] text-slate-400 dark:text-slate-400 font-bold uppercase tracking-widest">Active Student</span>
                                            <span className="text-sm font-black text-slate-900 dark:text-indigo-300 font-mono tracking-tighter">{activeId}</span>
                                        </div>
                                        <button
                                            onClick={() => {
                                                setIsOpen(false);
                                                handleLogout();
                                            }}
                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm transition-all"
                                        >
                                            <LogOut className="w-3.5 h-3.5" />
                                            <span>Logout</span>
                                        </button>
                                    </div>
                                )}
                                {navItems.filter(item => !item.hiddenOnMobile).map((item) => (
                                    item.comingSoon ? (
                                        <div
                                            key={item.path}
                                            className="block px-4 py-3 rounded-xl text-sm font-bold tracking-widest uppercase transition-all text-slate-400 dark:text-slate-600 bg-slate-50 dark:bg-slate-800/50 cursor-not-allowed flex justify-between items-center"
                                        >
                                            {item.name}
                                            <span className="text-[10px] bg-amber-500 text-white px-2 py-0.5 rounded-full">SOON</span>
                                        </div>
                                    ) : (
                                        <button
                                            key={item.path}
                                            onClick={() => {
                                                if (item.isReset) handleResetSemester();
                                                else if (item.path) {
                                                    navigate(item.path);
                                                    setIsOpen(false);
                                                }
                                            }}
                                            className={cn(
                                                "block w-full text-left px-4 py-3 rounded-xl text-sm font-black tracking-widest uppercase transition-all flex flex-col cursor-pointer",
                                                item.isErpHighlight
                                                    ? "bg-red-600 text-white border-2 border-red-400 shadow-lg shadow-red-500/25 ring-2 ring-red-500/20 animate-pulse hover:bg-red-700 active:scale-[0.99]"
                                                    : isActive(item.path)
                                                        ? "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300 font-black dark:border dark:border-indigo-500/40"
                                                        : "text-slate-600 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                                            )}
                                        >
                                            <span>{item.name}</span>
                                            {item.subText && (
                                                <span className="text-[10px] mt-1 text-slate-500 dark:text-slate-400 font-mono normal-case break-all">
                                                    ID: {item.subText}
                                                </span>
                                            )}
                                        </button>
                                    )
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </nav>

            {/* Height Spacer to prevent layout jump when sticky */}
            <div className="h-1" />
        </header>
    );
};

export default Navbar;
