import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, Bell, LogOut, Download, Check, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { useAuth } from '../context/useAuth';
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { db } from '../firebase';
import { cn } from '../lib/utils';
import { subscribeCrossDomainSync } from '../services/crossDomainSync';
import { openInstallModal, isMarkedInstalled } from '../services/pwaInstallManager';
import FriendsManagerModal from './FriendsManagerModal';
import { getActiveProfileDetails } from '../services/friendsService';

const Navbar = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const [announcement, setAnnouncement] = useState("");
    const [maintenanceConfig, setMaintenanceConfig] = useState({ enabled: false, title: 'ERP Login is Under Maintenance' });
    const [isAppInstalled, setIsAppInstalled] = useState(() => isMarkedInstalled());
    const [showFriendsModal, setShowFriendsModal] = useState(false);
    const [activeProfile, setActiveProfile] = useState(() => getActiveProfileDetails());

    const { currentUser, erpUser, setErpUser, logout } = useAuth(); // Import erpUser here
    const location = useLocation();
    const navigate = useNavigate();

    const handleLogout = async () => {
        try {
            await logout();
            if (typeof setErpUser === 'function') {
                setErpUser(null);
            }
            const currentActiveId = erpUser || (typeof window !== 'undefined' ? localStorage.getItem('activeErpUser') : null);
            if (currentActiveId) {
                localStorage.removeItem(`kleData_${currentActiveId}`);
            }
            localStorage.removeItem('activeErpUser');
            localStorage.removeItem('erpDashboardHtml');
            localStorage.removeItem('kleData');
            sessionStorage.removeItem('erp_authenticated');
            sessionStorage.removeItem('adminLoggedOut');
            window.dispatchEvent(new Event('storage'));
            setIsOpen(false);
            navigate('/login');
        } catch (error) {
            console.error("Logout failed:", error);
            setIsOpen(false);
            navigate('/login');
        }
    };

    const handleResetSemester = () => {
        const activeId = erpUser || (typeof window !== 'undefined' ? localStorage.getItem('activeErpUser') : null);
        if (activeId) {
            localStorage.removeItem(`kleData_${activeId}`);
        }
        localStorage.removeItem('kleData'); // Fallback
        sessionStorage.setItem('manual_sem_reset', 'true');
        window.dispatchEvent(new CustomEvent('kl_reset_selection'));
        if (location.pathname !== '/timetable') {
            navigate('/attendance-register');
        }
        setIsOpen(false);
    };

    // Real-time synchronization for Announcements and Maintenance across all domains (< 1 second)
    useEffect(() => {
        let lastScrolled = window.scrollY > 20;
        const handleScroll = () => {
            const isScrolled = window.scrollY > 20;
            if (isScrolled !== lastScrolled) {
                lastScrolled = isScrolled;
                setScrolled(isScrolled);
            }
        };
        window.addEventListener('scroll', handleScroll, { passive: true });

        // 1. Instant Real-time Announcement stream from Firestore
        let unsubAnnounce = null;
        try {
            unsubAnnounce = onSnapshot(doc(db, "config", "global"), (snap) => {
                if (snap.exists()) {
                    const data = snap.data();
                    const text = data.announcement || data.text || "";
                    setAnnouncement(text);
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

        // 2. Real-time ERP Maintenance mode stream from Firestore
        let unsubMaintenance = null;
        try {
            unsubMaintenance = onSnapshot(doc(db, 'config', 'maintenance'), (snapshot) => {
                if (snapshot.exists()) {
                    const data = snapshot.data();
                    setMaintenanceConfig(data);
                } else {
                    setMaintenanceConfig({ enabled: false });
                }
            }, (err) => {
                console.warn("[Navbar] Maintenance sync notice:", err);
            });
        } catch (err) {
            console.warn("[Navbar] Maintenance listener error:", err);
        }

        // 3. Sub-second Cross-Domain, Window Event, and BroadcastChannel instant sync (0ms)
        const unsubCrossSync = subscribeCrossDomainSync((event) => {
            if (event.type === 'MAINTENANCE_UPDATE' && event.data) {
                setMaintenanceConfig(event.data);
            } else if (event.type === 'ANNOUNCEMENT_CHANGE' && event.data) {
                const text = event.data.announcement || event.data.text || "";
                setAnnouncement(text);
            }
        });

        // 4. Instant synchronization for app install status
        const handleInstalledSync = () => {
            setIsAppInstalled(isMarkedInstalled());
        };
        window.addEventListener('kl_app_installed_event', handleInstalledSync);

        // 5. Instant synchronization for friends & active profile
        const handleProfileSync = () => {
            setActiveProfile(getActiveProfileDetails());
        };
        window.addEventListener('kl_friends_updated', handleProfileSync);
        window.addEventListener('kl_active_profile_updated', handleProfileSync);

        return () => {
            window.removeEventListener('scroll', handleScroll);
            window.removeEventListener('kl_app_installed_event', handleInstalledSync);
            window.removeEventListener('kl_friends_updated', handleProfileSync);
            window.removeEventListener('kl_active_profile_updated', handleProfileSync);
            if (unsubAnnounce) unsubAnnounce();
            if (unsubMaintenance) unsubMaintenance();
            if (unsubCrossSync) unsubCrossSync();
        };
    }, []);

    const activeId = erpUser || (typeof window !== 'undefined' ? localStorage.getItem('activeErpUser') : null);
    const rawHtml = typeof window !== 'undefined' ? localStorage.getItem('erpDashboardHtml') : null;
    const hasValidHtml = Boolean(rawHtml && !rawHtml.includes('site-error') && !rawHtml.includes('id="login-form"'));
    const isErpLoggedIn = Boolean(activeId && hasValidHtml);
    const isErpPortal = location.pathname === '/login' || 
                        location.pathname === '/attendance-register' || 
                        location.pathname === '/timetable' || 
                        location.pathname === '/grades' || 
                        location.pathname === '/cgpa' || 
                        location.pathname === '/bunk-simulator' || 
                        location.pathname === '/bunk';
    const showLogout = isErpLoggedIn && !isErpPortal;

    const navItems = [
        { name: 'HOME', path: '/' },
        { name: 'ATTENDANCE BY L-T-P-S', path: '/ltps' },
        { name: 'ACADEMIC CALENDAR', path: '/calendar' },
        {
            name: isAppInstalled ? 'INSTALLED' : 'INSTALL APP',
            isInstall: true,
            isInstalled: isAppInstalled
        },
        ...(!isErpLoggedIn ? [{
            name: maintenanceConfig?.enabled ? 'ERP (MAINTENANCE)' : 'ERP LOGIN',
            path: '/login',
            isErpHighlight: true,
            isMaintenance: Boolean(maintenanceConfig?.enabled)
        }] : [
            { name: 'ERP ATTENDANCE', path: '/attendance-register', isErpHighlight: true }
        ]),
        ...(currentUser?.email === 'yaswanthadithyareddy11@gmail.com' ? [{ name: 'ADMIN', path: '/admin' }] : [])
    ];

    const isActive = (path) => location.pathname === path;

    // Dedicated KLERP Portal layout on /login and /attendance-register has its own left sidebar and top bar
    if (isErpPortal) {
        return null;
    }

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
                        exit={{ height: 0, opacity: 0 }}
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
                        <Link to="/" className="flex items-center space-x-3 group shrink-0">
                            <picture>
                                <source srcSet="/Koneru%20Lakshmaiah%20University%20Logo%20Banner.webp" type="image/webp" />
                                <img
                                    src="/Koneru%20Lakshmaiah%20University%20Logo%20Banner.png"
                                    alt="Koneru Lakshmaiah University Logo Banner"
                                    width="121"
                                    height="48"
                                    loading="eager"
                                    fetchPriority="high"
                                    decoding="sync"
                                    className={cn(
                                        "h-8 lg:h-12 w-auto object-contain transition-all duration-300 group-hover:scale-105"
                                    )}
                                />
                            </picture>
                        </Link>

                        {/* Desktop Menu */}
                        <div className="hidden lg:flex items-center gap-6">
                            {navItems.filter(item => !item.isMobileOnly).map((item) => (
                                item.isInstall ? (
                                    <button
                                        key="desktop-install-item"
                                        onClick={() => openInstallModal()}
                                        title={item.isInstalled ? "KL Attendance is Installed" : "Install KL Attendance Web App"}
                                        className={cn(
                                            "px-3.5 py-2 text-[11px] lg:text-xs font-black tracking-wider uppercase rounded-xl transition-all duration-300 whitespace-nowrap lg:whitespace-normal text-center leading-tight max-w-[130px] flex items-center justify-center gap-1.5 cursor-pointer shadow-md active:scale-95",
                                            scrolled
                                                ? "bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-sm"
                                                : "bg-white/15 hover:bg-white/25 text-white border border-white/40 shadow-sm"
                                        )}
                                    >
                                        {item.isInstalled ? (
                                            <Check className="w-4 h-4 stroke-[3] shrink-0" />
                                        ) : (
                                            <Download className="w-4 h-4 shrink-0 stroke-[2.5]" />
                                        )}
                                        <span className="font-black drop-shadow-xs">{item.name}</span>
                                    </button>
                                ) : item.comingSoon ? (
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
                                                    : item.isMaintenance
                                                        ? "text-amber-950 bg-amber-200 dark:bg-amber-950/80 border-2 border-amber-400 dark:border-amber-600 shadow-lg shadow-amber-200/50 dark:shadow-none animate-pulse ring-2 ring-amber-500/30"
                                                        : item.isErpHighlight
                                                        ? "text-red-600 bg-red-50 dark:bg-red-950/40 border-2 border-red-200 dark:border-red-800 shadow-lg shadow-red-100 dark:shadow-none animate-pulse ring-2 ring-red-500/20"
                                                        : "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800")
                                                : (isActive(item.path)
                                                    ? "text-[#2196F3] dark:text-indigo-300 bg-white dark:bg-indigo-950/60 shadow-xl dark:border dark:border-indigo-500/40 transform scale-105"
                                                    : item.isMaintenance
                                                        ? "text-slate-950 bg-amber-400 shadow-xl shadow-amber-500/40 hover:bg-amber-300 border border-amber-300 animate-pulse ring-2 ring-white/50"
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


                            {/* Desktop Friends / Profiles Switcher Button */}
                            <button
                                id="desktop-friends-btn"
                                onClick={() => setShowFriendsModal(true)}
                                title={maintenanceConfig?.enabled ? "ERP is under maintenance (Login paused)" : (activeProfile?.isFriend ? `Viewing ${activeProfile.label}` : "Check Friend's Attendance")}
                                className={cn(
                                    "flex items-center gap-1.5 px-3 py-2 rounded-xl font-black text-[11px] uppercase tracking-wider transition-all duration-300 cursor-pointer shadow-md active:scale-95 shrink-0 relative",
                                    activeProfile?.isFriend
                                        ? "bg-pink-100 text-pink-900 border-2 border-pink-400 dark:bg-pink-950/80 dark:text-pink-200 dark:border-pink-600 animate-pulse"
                                        : (scrolled
                                            ? "bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800"
                                            : "bg-white/20 hover:bg-white/30 text-white border border-white/40")
                                )}
                            >
                                <Users className="w-3.5 h-3.5 shrink-0" />
                                <span className="font-black drop-shadow-xs truncate max-w-[100px]">
                                    {activeProfile?.isFriend ? activeProfile.nickname : "Friends"}
                                </span>
                                {maintenanceConfig?.enabled && (
                                    <span className="flex h-2 w-2 relative ml-0.5" title="ERP Under Maintenance">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                                    </span>
                                )}
                            </button>

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
                            {/* Mobile Friends Button */}
                            <button
                                onClick={() => setShowFriendsModal(true)}
                                title={maintenanceConfig?.enabled ? "ERP Under Maintenance" : "Check Friend's Attendance"}
                                className={cn(
                                    "flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl font-black text-[11px] uppercase tracking-wider transition-all cursor-pointer shadow-sm active:scale-95 relative",
                                    activeProfile?.isFriend
                                        ? "bg-pink-100 text-pink-900 border border-pink-300"
                                        : (scrolled ? "bg-indigo-50 text-indigo-700 border border-indigo-200" : "bg-white/15 text-white border border-white/40")
                                )}
                            >
                                <Users className="w-3.5 h-3.5 shrink-0" />
                                <span className="truncate max-w-[60px]">{activeProfile?.isFriend ? activeProfile.nickname : "Friends"}</span>
                                {maintenanceConfig?.enabled && (
                                    <span className="flex h-1.5 w-1.5 relative ml-0.5">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500"></span>
                                    </span>
                                )}
                            </button>

                            {/* Quick Install Button on Mobile Header */}
                            <button
                                onClick={() => openInstallModal()}
                                title={isAppInstalled ? "KL Attendance is Installed" : "Install KL Attendance"}
                                className={cn(
                                    "flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-black text-[11px] uppercase tracking-wider transition-all cursor-pointer shadow-sm active:scale-95",
                                    scrolled
                                        ? "bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700"
                                        : "bg-white/15 hover:bg-white/25 text-white border border-white/40"
                                )}
                            >
                                {isAppInstalled ? (
                                    <Check className="w-3.5 h-3.5 stroke-[3] shrink-0" />
                                ) : (
                                    <Download className="w-3.5 h-3.5 stroke-[2.5] shrink-0" />
                                )}
                                <span className="font-black drop-shadow-xs">{isAppInstalled ? "INSTALLED" : "INSTALL"}</span>
                            </button>

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

                                {/* Mobile Friends Switcher Card */}
                                <button
                                    onClick={() => {
                                        setIsOpen(false);
                                        setShowFriendsModal(true);
                                    }}
                                    className="w-full flex items-center justify-between p-3.5 bg-gradient-to-r from-pink-50 to-indigo-50 dark:from-slate-800 dark:to-slate-800/60 border-2 border-indigo-200 dark:border-slate-700 rounded-2xl text-left cursor-pointer transition-all mb-3 shadow-xs"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-slate-700 flex items-center justify-center shrink-0 relative">
                                            <Users className="w-4 h-4 text-indigo-700 dark:text-indigo-300" />
                                            {maintenanceConfig?.enabled && (
                                                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500 border border-white dark:border-slate-900"></span>
                                                </span>
                                            )}
                                        </div>
                                        <div>
                                            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider block">
                                                {activeProfile?.isFriend ? 'Viewing Friend' : 'Friend Attendance'}
                                            </span>
                                            <span className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                                                <span>{activeProfile?.isFriend ? activeProfile.nickname : "Check Friend's Attendance"}</span>
                                                {maintenanceConfig?.enabled && (
                                                    <span className="text-[9px] bg-amber-400 text-slate-950 font-black px-1.5 py-0.5 rounded tracking-wider uppercase">
                                                        Maint.
                                                    </span>
                                                )}
                                            </span>
                                        </div>
                                    </div>
                                    <span className="text-[10px] bg-indigo-600 text-white font-black px-2.5 py-1 rounded-full uppercase">
                                        {activeProfile?.isFriend ? 'Switch' : 'Open'}
                                    </span>
                                </button>

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
                                    item.isInstall ? (
                                        <button
                                            key="mobile-nav-install"
                                            onClick={() => {
                                                setIsOpen(false);
                                                openInstallModal();
                                            }}
                                            className={cn(
                                                "w-full text-left px-4 py-3 rounded-xl text-sm font-black tracking-widest uppercase transition-all flex items-center justify-between cursor-pointer active:scale-[0.99] border shadow-xs",
                                                "bg-blue-50/80 dark:bg-slate-800/80 text-[#2196F3] dark:text-indigo-400 border-blue-200/80 dark:border-slate-700 hover:bg-blue-100 dark:hover:bg-slate-800"
                                            )}
                                        >
                                            <div className="flex items-center gap-2.5">
                                                {item.isInstalled ? (
                                                    <Check className="w-4 h-4 stroke-[3]" />
                                                ) : (
                                                    <Download className="w-4 h-4 stroke-[2.5]" />
                                                )}
                                                <span className="font-black drop-shadow-xs">{item.name}</span>
                                            </div>
                                            <span className="text-[10px] px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider bg-blue-100 dark:bg-slate-700 text-[#103580] dark:text-indigo-300">
                                                {item.isInstalled ? "Ready" : "0.1s Fast"}
                                            </span>
                                        </button>
                                    ) : item.comingSoon ? (
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
                                                item.isMaintenance
                                                    ? "bg-amber-400 text-slate-950 border-2 border-amber-300 shadow-lg shadow-amber-500/25 ring-2 ring-amber-500/20 animate-pulse hover:bg-amber-300 active:scale-[0.99]"
                                                    : item.isErpHighlight
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

            {/* Friends Manager & Captcha Switcher Modal */}
            <FriendsManagerModal
                isOpen={showFriendsModal}
                onClose={() => setShowFriendsModal(false)}
            />
        </header>
    );
};

export default Navbar;
