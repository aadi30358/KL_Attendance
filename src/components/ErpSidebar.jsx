import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    User, 
    Users, 
    UserPlus,
    X, 
    ShieldCheck,
    CalendarDays,
    BarChart3,
    GraduationCap,
    SlidersHorizontal,
    AlertTriangle,
    Calculator,
    Calendar,
    Award,
    Trash2
} from 'lucide-react';
import { 
    getMyProfile, 
    getSavedFriends, 
    getAllProfiles,
    getActiveProfileDetails,
    deleteFriend,
    setActiveProfileId
} from '../services/friendsService';
import { setStoredErpCookies, clearStoredErpCookies } from '../services/erpService';
import { useMaintenance } from '../services/useMaintenance';
import FriendsManagerModal from './FriendsManagerModal';
import AddFriendModal from './AddFriendModal';
import FriendCaptchaModal from './FriendCaptchaModal';

export default function ErpSidebar({ 
    isOpen, 
    onToggle, 
    onSelectProfile, 
    onAddNewProfile,
    activePage = 'attendance-register'
}) {
    const navigate = useNavigate();
    const location = useLocation();
    const { isMaintenance, maintenanceConfig } = useMaintenance();
    const [allProfiles, setAllProfiles] = useState(() => getAllProfiles());
    const [activeProfile, setActiveProfile] = useState(() => getActiveProfileDetails());
    const [showFriendsManager, setShowFriendsManager] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingProfile, setEditingProfile] = useState(null);
    const [isEditingSelf, setIsEditingSelf] = useState(false);
    const [captchaTarget, setCaptchaTarget] = useState(null);

    // Sync profiles across the app whenever storage or events update
    useEffect(() => {
        const sync = () => {
            setAllProfiles(getAllProfiles());
            setActiveProfile(getActiveProfileDetails());
        };
        window.addEventListener('kl_friends_updated', sync);
        window.addEventListener('kl_active_profile_updated', sync);
        window.addEventListener('storage', sync);
        return () => {
            window.removeEventListener('kl_friends_updated', sync);
            window.removeEventListener('kl_active_profile_updated', sync);
            window.removeEventListener('storage', sync);
        };
    }, []);

    const handleNavigation = (path) => {
        if (onToggle && window.innerWidth < 1024) {
            onToggle();
        }
        navigate(path);
    };

    const handleChangeSelection = () => {
        sessionStorage.setItem('manual_sem_reset', 'true');
        window.dispatchEvent(new CustomEvent('kl_reset_selection'));
        if (location.pathname !== '/attendance-register') {
            navigate('/attendance-register');
        }
        if (onToggle && window.innerWidth < 1024) {
            onToggle();
        }
    };

    const currentPath = location.pathname;

    const navItems = [
        {
            id: 'attendance',
            label: 'Attendance Register',
            badge: 'Live',
            badgeClass: 'bg-emerald-500 text-white',
            icon: BarChart3,
            isActive: currentPath === '/attendance-register' || activePage === 'attendance-register',
            onClick: () => handleNavigation('/attendance-register')
        },
        {
            id: 'timetable',
            label: 'Class Timetable',
            badge: 'ERP',
            badgeClass: 'bg-indigo-100 text-indigo-700',
            icon: CalendarDays,
            isActive: currentPath === '/timetable' || activePage === 'timetable',
            onClick: () => handleNavigation('/timetable')
        },
        {
            id: 'grades',
            label: 'Grades & CGPA',
            badge: 'Scorecard',
            badgeClass: 'bg-amber-100 text-amber-800',
            icon: GraduationCap,
            isActive: currentPath === '/grades' || currentPath === '/cgpa' || activePage === 'grades',
            onClick: () => handleNavigation('/grades')
        },
        {
            id: 'bunk',
            label: 'Bunk Simulator',
            badge: 'What-If',
            badgeClass: 'bg-purple-100 text-purple-700',
            icon: Calculator,
            isActive: currentPath === '/bunk-simulator' || currentPath === '/bunk' || activePage === 'bunk',
            onClick: () => handleNavigation('/bunk-simulator')
        },
        {
            id: 'selection',
            label: 'Change Selection',
            badge: 'Sem / Year',
            badgeClass: 'bg-slate-200 text-slate-700',
            icon: SlidersHorizontal,
            isActive: false,
            onClick: handleChangeSelection
        }
    ];

    const handleSwitchProfile = (profile) => {
        const sid = profile?.studentId || profile?.username || (profile?.id !== 'main' ? profile?.id : '');
        const pid = profile?.id || 'main';
        setActiveProfileId(pid);
        if (sid) {
            localStorage.setItem('activeErpUser', sid);
            const savedCookie = localStorage.getItem(`erp_cookie_${sid}`);
            if (savedCookie) {
                setStoredErpCookies(savedCookie, sid);
            } else {
                clearStoredErpCookies();
            }
        }
        setActiveProfile(getActiveProfileDetails());
        window.dispatchEvent(new CustomEvent('kl_active_profile_updated', { detail: pid }));
        window.dispatchEvent(new CustomEvent('kl_profile_switched', { detail: { profile, studentId: sid } }));
        if (onSelectProfile) onSelectProfile(profile);
    };

    const handleQuickTimetable = (profile) => {
        handleSwitchProfile(profile);
        handleNavigation('/timetable');
    };

    const handleQuickGrades = (profile) => {
        handleSwitchProfile(profile);
        handleNavigation('/grades');
    };

    const handleQuickAttendance = (profile) => {
        handleSwitchProfile(profile);
        setCaptchaTarget(profile);
    };

    const handleDeleteFriend = (e, friendId) => {
        e.stopPropagation();
        if (window.confirm('Are you sure you want to remove this saved friend profile?')) {
            deleteFriend(friendId);
            setAllProfiles(getAllProfiles());
            setActiveProfile(getActiveProfileDetails());
        }
    };

    const sidebarContent = (
        <div className="h-full flex flex-col bg-white text-slate-800 font-sans border-r border-slate-200/80 shadow-xs w-72 sm:w-80 select-none">
            {/* Mobile Drawer Top Bar (Hidden on desktop) */}
            <div className="lg:hidden bg-[#0088cc] text-white px-4 py-3 flex items-center justify-between shadow-xs shrink-0">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center p-0.5 shadow-xs shrink-0">
                        <img
                            src="/Koneru Lakshmaiah University Logo Banner.png"
                            alt="KLU"
                            className="w-full h-full object-contain"
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="font-serif italic font-extrabold text-lg text-white tracking-wider">
                            KLERP
                        </span>
                        <span className="text-[10px] bg-white/20 text-white font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">
                            PORTAL
                        </span>
                    </div>
                </div>

                {onToggle && (
                    <button
                        onClick={onToggle}
                        className="p-1 rounded-lg text-white/90 hover:text-white hover:bg-white/20 transition-colors cursor-pointer"
                        title="Close Sidebar"
                    >
                        <X className="w-5 h-5" />
                    </button>
                )}
            </div>

            {/* Portal Navigation Items (Dedicated Pages for Each Service) */}
            <div className="p-3 border-b border-slate-100 bg-slate-50/60 space-y-1 shrink-0">
                {navItems.map((item) => {
                    const Icon = item.icon;
                    return (
                        <button
                            key={item.id}
                            type="button"
                            onClick={item.onClick}
                            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                item.isActive
                                    ? 'bg-indigo-600 text-white shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900 hover:bg-white border border-transparent hover:border-slate-200'
                            }`}
                        >
                            <div className="flex items-center gap-2.5">
                                <Icon className={`w-4 h-4 ${item.isActive ? 'text-white' : 'text-slate-500'}`} />
                                <span>{item.label}</span>
                            </div>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-black uppercase ${
                                item.isActive
                                    ? 'bg-white/20 text-white'
                                    : item.badgeClass
                            }`}>
                                {item.badge}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Scrollable Body - Saved Accounts with balanced, comfortable spacing */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {/* ERP Maintenance Notice */}
                {isMaintenance && (
                    <div className="p-3 rounded-2xl bg-amber-50 border-2 border-amber-300 text-amber-950 text-xs shadow-2xs">
                        <div className="flex items-center gap-1.5 font-black text-amber-900 text-xs">
                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                            <span>ERP Under Maintenance</span>
                        </div>
                        <p className="mt-1 text-[11px] font-semibold text-amber-800 leading-snug">
                            {maintenanceConfig?.message || 'Direct login is temporarily paused.'}
                        </p>
                    </div>
                )}

                {/* Controlled balanced spacing above Saved Accounts */}
                <div className="mt-5 sm:mt-6 pt-3 border-t border-slate-200/70">
                    <div className="rounded-2xl border border-slate-200/90 bg-slate-50/80 p-2.5 shadow-2xs">
                        <div className="flex items-center justify-between mb-2 px-0.5">
                            <div className="flex items-center gap-1.5">
                                <Users className="w-3.5 h-3.5 text-indigo-600" />
                                <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider">
                                    Saved Accounts ({allProfiles.length})
                                </span>
                            </div>

                            <button
                                type="button"
                                onClick={() => {
                                    if (onAddNewProfile) onAddNewProfile();
                                    setEditingProfile(null);
                                    setIsEditingSelf(false);
                                    setShowAddModal(true);
                                }}
                                className="text-[10px] font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/90 px-2 py-0.5 rounded-lg transition-all cursor-pointer flex items-center gap-1 shadow-2xs active:scale-95"
                                title="Add friend details (no limit)"
                            >
                                <UserPlus className="w-3 h-3 text-emerald-600" />
                                <span>Add Friend</span>
                            </button>
                        </div>

                        <div className="space-y-1.5">
                            {allProfiles.length === 0 ? (
                                <div className="p-3 text-center rounded-xl border border-dashed border-slate-300 bg-white/80">
                                    <Users className="w-5 h-5 mx-auto text-slate-400 mb-1" />
                                    <p className="text-xs font-bold text-slate-700">No saved accounts yet</p>
                                    <p className="text-[10px] text-slate-500 mt-0.5">Click &ldquo;+ Add Friend&rdquo; above to save an account for 1-click access.</p>
                                </div>
                            ) : (
                                allProfiles.map((profile) => {
                                    const isSelf = profile.id === 'main' || !profile.isFriend;
                                    const isActive = activeProfile ? (
                                        activeProfile.id === profile.id || 
                                        (!activeProfile.isFriend && isSelf) ||
                                        (Boolean(activeProfile.studentId) && Boolean(profile.studentId) && activeProfile.studentId === profile.studentId)
                                    ) : false;

                                    return (
                                        <div
                                            key={profile.id || profile.studentId}
                                            className={`p-2 rounded-xl border transition-all ${
                                                isActive
                                                    ? 'bg-gradient-to-r from-indigo-50/90 to-white border-indigo-400 shadow-2xs ring-1 ring-indigo-200'
                                                    : 'bg-white border-slate-200 hover:border-indigo-300 shadow-2xs'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between gap-1.5">
                                                <div className="flex items-center gap-1.5 min-w-0">
                                                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-[10px] shadow-2xs shrink-0 ${
                                                        isSelf 
                                                            ? 'bg-indigo-600 text-white' 
                                                            : 'bg-purple-100 text-purple-700 border border-purple-200'
                                                    }`}>
                                                        {isSelf ? <User className="w-3 h-3" /> : <Users className="w-3 h-3" />}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-1">
                                                            <span className="text-[11px] font-black text-slate-900 truncate">
                                                                {profile.nickname || (isSelf ? 'My Account' : 'Buddy')}
                                                            </span>
                                                            {isActive && (
                                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                                                            )}
                                                        </div>
                                                        <p className={`text-[9px] font-mono font-bold truncate leading-none ${
                                                            isSelf ? 'text-indigo-700' : 'text-purple-700'
                                                        }`}>
                                                            ID: {profile.studentId || ''}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-1 shrink-0">
                                                    <span className={`text-[8px] font-black uppercase tracking-wider px-1 py-0.5 rounded ${
                                                        isSelf
                                                            ? 'bg-emerald-100 text-emerald-800'
                                                            : 'bg-purple-100 text-purple-800'
                                                    }`}>
                                                        {isSelf ? 'Primary' : 'Friend'}
                                                    </span>
                                                    {!isActive && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleSwitchProfile(profile)}
                                                            className="text-[9px] font-bold text-indigo-600 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 px-1.5 py-0.5 rounded border border-indigo-200 transition-all cursor-pointer shadow-2xs"
                                                        >
                                                            Switch
                                                        </button>
                                                    )}
                                                    {!isSelf && (
                                                        <button
                                                            type="button"
                                                            onClick={(e) => handleDeleteFriend(e, profile.id)}
                                                            className="p-0.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
                                                            title="Delete friend profile"
                                                        >
                                                            <Trash2 className="w-3 h-3" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Direct Actions: Timetable, CGPA, Attend */}
                                            <div className="mt-1.5 pt-1 border-t border-slate-100 flex items-center gap-1">
                                                <button
                                                    type="button"
                                                    onClick={() => handleQuickTimetable(profile)}
                                                    className="flex-1 py-1 px-1 bg-blue-50/90 hover:bg-blue-100 text-blue-700 border border-blue-200/70 text-[9px] font-bold rounded-md transition-all flex items-center justify-center gap-1 shadow-2xs cursor-pointer active:scale-95"
                                                    title="View timetable without captcha"
                                                >
                                                    <Calendar className="w-2.5 h-2.5 text-blue-600 shrink-0" />
                                                    <span>Timetable</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleQuickGrades(profile)}
                                                    className="flex-1 py-1 px-1 bg-amber-50/90 hover:bg-amber-100 text-amber-800 border border-amber-200/70 text-[9px] font-bold rounded-md transition-all flex items-center justify-center gap-1 shadow-2xs cursor-pointer active:scale-95"
                                                    title="View grades & CGPA without captcha"
                                                >
                                                    <Award className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                                                    <span>CGPA</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleQuickAttendance(profile)}
                                                    className="flex-1 py-1 px-1 bg-slate-900 hover:bg-indigo-600 text-white text-[9px] font-bold rounded-md transition-all flex items-center justify-center gap-1 shadow-2xs cursor-pointer active:scale-95"
                                                    title="Check attendance with captcha verification"
                                                >
                                                    <ShieldCheck className="w-2.5 h-2.5 text-indigo-300 shrink-0" />
                                                    <span>Attend</span>
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Footer Info */}
            <div className="p-2.5 bg-slate-50/70 border-t border-slate-100 text-center shrink-0">
                <p className="text-[10px] text-slate-400 font-medium flex items-center justify-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-emerald-600" />
                    <span>Credentials secured in browser</span>
                </p>
            </div>

            {/* Full Friends & Profiles Manager Modal */}
            <FriendsManagerModal
                isOpen={showFriendsManager}
                onClose={() => setShowFriendsManager(false)}
            />

            {/* Add / Edit Profile Modal */}
            <AddFriendModal
                isOpen={showAddModal}
                initialFriend={editingProfile}
                isMyProfile={isEditingSelf}
                onClose={() => {
                    setShowAddModal(false);
                    setEditingProfile(null);
                    setIsEditingSelf(false);
                }}
                onFriendSaved={(newProfile) => {
                    setAllProfiles(getAllProfiles());
                    setActiveProfile(getActiveProfileDetails());
                    setShowAddModal(false);
                    setEditingProfile(null);
                    setIsEditingSelf(false);
                    if (newProfile?.studentId) {
                        try {
                            localStorage.setItem('activeErpUser', newProfile.studentId);
                        } catch { /* ignore */ }
                    }
                    navigate('/attendance-register');
                }}
            />

            {/* Captcha-Only Quick Verification Modal */}
            <FriendCaptchaModal
                friend={captchaTarget}
                isOpen={Boolean(captchaTarget)}
                onClose={() => setCaptchaTarget(null)}
                onSuccess={() => {
                    setActiveProfile(getActiveProfileDetails());
                    setCaptchaTarget(null);
                    navigate('/attendance-register');
                }}
            />
        </div>
    );

    return (
        <>
            {/* Desktop Docked Sidebar */}
            <div className="hidden lg:block h-screen sticky top-0 shrink-0 z-30">
                {sidebarContent}
            </div>

            {/* Mobile Drawer Overlay */}
            <AnimatePresence>
                {isOpen && (
                    <div className="lg:hidden fixed inset-0 z-50 flex">
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={onToggle}
                            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs"
                        />

                        {/* Slide-out Sidebar Panel */}
                        <motion.div
                            initial={{ x: '-100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '-100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                            className="relative z-10 h-full max-w-[85vw]"
                        >
                            {sidebarContent}
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </>
    );
}
