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

    const { currentUser, logout } = useAuth(); // Import logout here
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

    const hasErpSession = !!localStorage.getItem('erpDashboardHtml');
    const rememberedId = localStorage.getItem('rememberedId');
    const showLogout = currentUser || hasErpSession;

    const navItems = [
        { name: 'HOME', path: '/' },
        { name: 'ATTENDANCE BY L-T-P-S', path: '/ltps' },
        { name: 'ATTENDANCE WHEN ABSENT', path: '/attendance' },
        ...(currentUser?.email === 'yaswanthadithyareddy11@gmail.com' ? [{ name: 'ADMIN', path: '/admin' }] : []),
        { name: 'ACADEMIC CALENDAR', path: '/calendar' },
        {
            name: 'ERP LOGIN',
            subText: hasErpSession && rememberedId ? rememberedId : null,
            path: '/login',
            isErpHighlight: !hasErpSession // Highlight vividly when NOT logged in
        }
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
                            {navItems.map((item) => (
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
                                    <Link
                                        key={item.path}
                                        to={item.path}
                                        className={cn(
                                            "px-3 py-2 text-[11px] lg:text-xs font-black tracking-wider uppercase rounded-lg transition-all duration-300 whitespace-nowrap lg:whitespace-normal text-center leading-tight max-w-[120px] flex flex-col items-center justify-center h-full",
                                            scrolled
                                                ? (isActive(item.path)
                                                    ? "text-indigo-700 bg-indigo-100"
                                                    : item.isErpHighlight
                                                        ? "text-red-700 bg-red-50 border border-red-200 shadow-sm animate-pulse ring-2 ring-red-500/50"
                                                        : "text-slate-700 hover:bg-slate-100")
                                                : (isActive(item.path)
                                                    ? "text-[#2196F3] bg-white shadow-xl transform scale-105"
                                                    : item.isErpHighlight
                                                        ? "text-white bg-red-600 shadow-lg shadow-red-500/50 hover:bg-red-500 border border-red-400 animate-pulse ring-2 ring-white/50"
                                                        : "text-white hover:bg-white/20")
                                        )}
                                    >
                                        <span>{item.name}</span>
                                        {item.subText && (
                                            <span className="text-[9px] mt-0.5 opacity-90 font-mono tracking-tighter normal-case">
                                                ID: {item.subText}
                                            </span>
                                        )}
                                    </Link>
                                )
                            ))}

                            {/* Desktop Logout Button */}
                            {showLogout && (
                                <button
                                    onClick={handleLogout}
                                    title="Logout Dashboard Session"
                                    className={cn(
                                        "flex items-center gap-2 px-3 py-2 text-[11px] lg:text-xs font-black tracking-wider uppercase rounded-lg transition-all duration-300",
                                        scrolled ? "text-red-600 hover:bg-red-50" : "text-red-100 hover:bg-white/20"
                                    )}
                                >
                                    <LogOut className="w-4 h-4" />
                                    <span>Logout</span>
                                </button>
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
                                {navItems.map((item) => (
                                    item.comingSoon ? (
                                        <div
                                            key={item.path}
                                            className="block px-4 py-3 rounded-xl text-sm font-bold tracking-widest uppercase transition-all text-slate-400 bg-slate-50 cursor-not-allowed flex justify-between items-center"
                                        >
                                            {item.name}
                                            <span className="text-[10px] bg-amber-500 text-white px-2 py-0.5 rounded-full">SOON</span>
                                        </div>
                                    ) : (
                                        <Link
                                            key={item.path}
                                            to={item.path}
                                            onClick={() => setIsOpen(false)}
                                            className={cn(
                                                "block px-4 py-3 rounded-xl text-sm font-bold tracking-widest uppercase transition-all flex flex-col",
                                                isActive(item.path)
                                                    ? "bg-indigo-50 text-indigo-600"
                                                    : item.isErpHighlight
                                                        ? "bg-red-50 text-red-700 border border-red-200 animate-pulse shadow-sm ring-1 ring-red-500/50"
                                                        : "text-slate-600 hover:bg-slate-50"
                                            )}
                                        >
                                            <span>{item.name}</span>
                                            {item.subText && (
                                                <span className="text-[10px] mt-1 text-slate-500 font-mono normal-case break-all">
                                                    ID: {item.subText}
                                                </span>
                                            )}
                                        </Link>
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
