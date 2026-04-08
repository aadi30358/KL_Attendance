import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, Bell, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { useAuth } from '../context/useAuth';
import { doc, getDoc } from "firebase/firestore";
import { db } from '../firebase';
import { cn } from '../lib/utils';

const Navbar = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const [announcement, setAnnouncement] = useState("");

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
        // Flag to prevent auto-fetch on the next load
        sessionStorage.setItem('manual_sem_reset', 'true');
        navigate('/attendance-register');
        window.location.reload(); 
    };

    // ... (Keep existing useEffect for announcement and scrolled state)
    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener('scroll', handleScroll);

        const fetchAnnouncement = async () => {
            try {
                const docSnap = await getDoc(doc(db, "config", "announcements"));
                if (docSnap.exists()) {
                    setAnnouncement(docSnap.data().text);
                }
            } catch (e) {
                console.error("Failed to fetch announcement", e);
            }
        };
        fetchAnnouncement();

        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const hasErpSession = !!erpUser;
    const rememberedId = localStorage.getItem('rememberedId');
    const activeId = localStorage.getItem('activeErpUser') || rememberedId;
    const isAuthPage = location.pathname === '/' || location.pathname === '/login';
    const showLogout = (currentUser || hasErpSession) && !isAuthPage;

    const navItems = [
        { name: 'HOME', path: '/' },
        { name: 'ATTENDANCE BY L-T-P-S', path: '/ltps' },
        { name: 'ATTENDANCE WHEN ABSENT', path: '/attendance' },
        ...(hasErpSession ? [] : [
            { name: 'ACADEMIC CALENDAR', path: '/calendar' },
            { name: 'ERP LOGIN', path: '/login', isErpHighlight: true }
        ]),
        ...(hasErpSession ? [{ name: 'ERP DASHBOARD', path: '/login', isMobileOnly: true }] : []),

        ...(currentUser?.email === 'yaswanthadithyareddy11@gmail.com' ? [{ name: 'ADMIN', path: '/admin' }] : []),
        ...(hasErpSession && !isAuthPage ? [{ name: 'CHANGE SEMESTER', path: '/attendance-register', isReset: true }] : []),
        { name: 'INSTALL APP', path: '#install', isPwaInstall: true, hiddenOnMobile: true }
    ];



    const isActive = (path) => location.pathname === path;

    return (
        <header className="fixed top-0 left-0 w-full z-50">
            {/* Top Title Bar */}
            <div className="bg-white w-full py-1.5 px-4 shadow-sm z-50 relative">
                <div className="max-w-7xl mx-auto flex justify-center">
                    <h1 className="text-[#103580] font-serif font-bold text-xs sm:text-sm tracking-wide">
                        Attendance Calculator for KLU students
                    </h1>
                </div>
            </div>

            {/* Announcement Bar */}
            <AnimatePresence>
                {announcement && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        className="bg-slate-900 text-white py-2 px-4 text-center text-xs font-bold tracking-widest uppercase overflow-hidden"
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
                "w-full transition-all duration-300 border-b",
                scrolled ? "bg-white/80 backdrop-blur-lg border-slate-200 shadow-lg py-2" : "bg-[#2196F3] border-transparent py-3"
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
                        <div className="hidden lg:flex items-center gap-8">
                            {navItems.filter(item => !item.isMobileOnly).map((item) => (
                                item.comingSoon ? (

                                    <div
                                        key={item.path}
                                        className={cn(
                                            "relative px-3 py-2 text-[11px] lg:text-xs font-black tracking-wider uppercase rounded-lg transition-all duration-300 whitespace-nowrap lg:whitespace-normal text-center leading-tight max-w-[120px] flex items-center justify-center h-full cursor-not-allowed opacity-60",
                                            scrolled ? "text-slate-400" : "text-white/70"
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
                                            else if (item.isPwaInstall) window.dispatchEvent(new Event('triggerPWAInstall'));
                                            else navigate(item.path);
                                        }}
                                        className={cn(
                                            "px-3 py-2 text-[11px] lg:text-xs font-black tracking-wider uppercase rounded-lg transition-all duration-300 whitespace-nowrap lg:whitespace-normal text-center leading-tight max-w-[120px] flex flex-col items-center justify-center h-full",
                                            scrolled
                                                    ? (isActive(item.path)
                                                        ? "text-indigo-700 bg-indigo-100"
                                                        : item.isErpHighlight
                                                            ? "text-red-600 bg-red-50 border-2 border-red-200 shadow-lg shadow-red-100 animate-pulse ring-2 ring-red-500/20"
                                                            : "text-slate-700 hover:bg-slate-100")
                                                    : (isActive(item.path)
                                                        ? "text-[#2196F3] bg-white shadow-xl transform scale-105"
                                                        : item.isErpHighlight
                                                            ? "text-white bg-red-600 shadow-xl shadow-red-500/40 hover:bg-red-700 border border-red-400 animate-pulse ring-2 ring-white/50"
                                                            : "text-white hover:bg-white/20")
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
                                    scrolled ? "bg-slate-50 border border-slate-200" : "bg-white/10"
                                )}>
                                    {activeId && (
                                        <div className={cn(
                                            "flex items-center gap-2 px-3 py-1.5 rounded-lg font-black text-[10px] tracking-tighter",
                                            scrolled ? "text-slate-900" : "text-white"
                                        )}>
                                            <span className="opacity-50 font-medium tracking-normal text-[9px] uppercase">ID:</span>
                                            {activeId}
                                        </div>
                                    )}
                                    <button
                                        onClick={handleLogout}
                                        title="Logout Dashboard Session"
                                        className={cn(
                                            "flex items-center gap-2 px-3 py-1.5 text-[11px] font-black tracking-wider uppercase rounded-lg transition-all",
                                            scrolled ? "bg-red-50 text-red-600 hover:bg-red-100" : "bg-white/20 text-white hover:bg-white/30"
                                        )}
                                    >
                                        <LogOut className="w-3.5 h-3.5" />
                                        <span>Logout</span>
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Mobile Menu Button */}
                        <div className="lg:hidden flex items-center gap-4">
                            {showLogout && (
                                <button
                                    onClick={handleLogout}
                                    title="Logout"
                                    className={cn("p-2 rounded-xl transition-colors", scrolled ? "text-red-500 hover:bg-red-50" : "text-red-200 hover:bg-white/10")}
                                >
                                    <LogOut className="w-5 h-5" />
                                </button>
                            )}
                            <button
                                onClick={() => setIsOpen(!isOpen)}
                                className={cn("p-2 rounded-xl transition-colors", scrolled ? "text-slate-600 hover:bg-slate-100" : "text-white hover:bg-white/10")}
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
                            className="lg:hidden bg-white border-t border-slate-100 shadow-2xl overflow-hidden"
                        >
                            <div className="px-4 pt-4 pb-6 space-y-2">
                                {showLogout && activeId && (
                                    <div className="mx-4 mb-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Active Student</span>
                                            <span className="text-sm font-black text-slate-900 font-mono tracking-tighter">{activeId}</span>
                                        </div>
                                        <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600">
                                            <Bell className="w-5 h-5 animate-pulse" />
                                        </div>
                                    </div>
                                )}
                                {navItems.filter(item => !item.hiddenOnMobile).map((item) => (

                                    item.comingSoon ? (
                                        <div

                                            key={item.path}
                                            className="block px-4 py-3 rounded-xl text-sm font-bold tracking-widest uppercase transition-all text-slate-400 bg-slate-50 cursor-not-allowed flex justify-between items-center"
                                        >
                                            {item.name}
                                            <span className="text-[10px] bg-amber-500 text-white px-2 py-0.5 rounded-full">SOON</span>
                                        </div>
                                    ) : (
                                    <button
                                        key={item.path}
                                        onClick={() => {
                                            if (item.isReset) handleResetSemester();
                                            else if (item.isPwaInstall) {
                                                window.dispatchEvent(new Event('triggerPWAInstall'));
                                                setIsOpen(false);
                                            }
                                            else {
                                                navigate(item.path);
                                                setIsOpen(false);
                                            }
                                        }}
                                            className={cn(
                                                "block w-full text-left px-4 py-3 rounded-xl text-sm font-bold tracking-widest uppercase transition-all flex flex-col",
                                                    isActive(item.path)
                                                        ? "bg-indigo-50 text-indigo-600"
                                                        : item.isErpHighlight
                                                            ? "bg-red-600 text-white border-2 border-red-400 animate-pulse shadow-lg ring-2 ring-white/20"
                                                            : "text-slate-600 hover:bg-slate-50"
                                            )}
                                    >
                                        <span>{item.name}</span>
                                        {item.subText && (
                                            <span className="text-[10px] mt-1 text-slate-500 font-mono normal-case break-all">
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
