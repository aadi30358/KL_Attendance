import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    UserPlus, 
    User, 
    Users, 
    X, 
    Edit2, 
    Trash2, 
    ShieldCheck,
    CalendarDays,
    BarChart3,
    GraduationCap,
    SlidersHorizontal,
    AlertTriangle
} from 'lucide-react';
import { 
    getMyProfile,
    getSavedFriends, 
    getActiveProfileDetails, 
    deleteFriend 
} from '../services/friendsService';
import { useMaintenance } from '../services/useMaintenance';
import AddFriendModal from './AddFriendModal';
import FriendCaptchaModal from './FriendCaptchaModal';

export default function ErpSidebar({ 
    isOpen, 
    onToggle, 
    onSelectProfile, 
    onAddNewProfile,
    activeView = 'attendance',
    onSelectView 
}) {
    const navigate = useNavigate();
    const { isMaintenance, maintenanceConfig } = useMaintenance();
    const [myProfile, setMyProfile] = useState(() => getMyProfile());
    const [friends, setFriends] = useState(() => getSavedFriends());
    const [activeProfile, setActiveProfile] = useState(() => getActiveProfileDetails());
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingProfile, setEditingProfile] = useState(null);
    const [isEditingSelf, setIsEditingSelf] = useState(false);
    const [captchaTarget, setCaptchaTarget] = useState(null);

    // Sync profiles across the app whenever storage or events update
    useEffect(() => {
        const sync = () => {
            setMyProfile(getMyProfile());
            setFriends(getSavedFriends());
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

    // Handle Add Friend click (placed last)
    const handleAddFriendClick = () => {
        if (onAddNewProfile) {
            onAddNewProfile();
            if (onToggle) onToggle();
        } else {
            setEditingProfile(null);
            setIsEditingSelf(false);
            setShowAddModal(true);
        }
    };

    // Profile Click (Self or Friend)
    const handleProfileClick = (profile) => {
        if (isMaintenance) {
            alert(maintenanceConfig?.message || 'ERP login is currently under maintenance. Direct login is paused.');
            return;
        }

        if (onSelectProfile) {
            onSelectProfile(profile);
            if (onToggle) onToggle();
            return;
        }

        // Fast Captcha Login: open verification modal if credentials exist
        if (profile.password || profile.hasSavedPassword) {
            setCaptchaTarget(profile);
        } else {
            // Setup or edit credentials first
            setEditingProfile(profile);
            setIsEditingSelf(profile.id === 'main');
            setShowAddModal(true);
        }
    };

    // Edit Profile
    const handleEditProfile = (e, profile, isSelf = false) => {
        e.stopPropagation();
        setEditingProfile(profile);
        setIsEditingSelf(isSelf || profile.id === 'main');
        setShowAddModal(true);
    };

    // Delete Friend
    const handleDeleteFriend = (e, friendId) => {
        e.stopPropagation();
        if (window.confirm('Delete this saved friend profile?')) {
            deleteFriend(friendId);
            setFriends(getSavedFriends());
            setActiveProfile(getActiveProfileDetails());
        }
    };

    const isSelfActive = activeProfile?.id === 'main' || !activeProfile?.isFriend;

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

            {/* Dedicated Portal Navigation: Attendance Register vs Class Timetable */}
            <div className="p-3 border-b border-slate-100 bg-slate-50/60 space-y-1 shrink-0">
                <button
                    type="button"
                    onClick={() => {
                        if (onSelectView) onSelectView('attendance');
                        window.dispatchEvent(new CustomEvent('kl_switch_view', { detail: 'attendance' }));
                        if (window.innerWidth < 1024 && onToggle) onToggle();
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        activeView === 'attendance'
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-white'
                    }`}
                >
                    <div className="flex items-center gap-2.5">
                        <BarChart3 className="w-4 h-4" />
                        <span>Attendance Register</span>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-black uppercase ${
                        activeView === 'attendance' ? 'bg-white/20 text-white' : 'bg-slate-200/80 text-slate-600'
                    }`}>
                        Live
                    </span>
                </button>

                <button
                    type="button"
                    onClick={() => {
                        if (onSelectView) onSelectView('timetable');
                        window.dispatchEvent(new CustomEvent('kl_switch_view', { detail: 'timetable' }));
                        if (window.innerWidth < 1024 && onToggle) onToggle();
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        activeView === 'timetable'
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-white'
                    }`}
                >
                    <div className="flex items-center gap-2.5">
                        <CalendarDays className="w-4 h-4" />
                        <span>Class Timetable</span>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-black uppercase ${
                        activeView === 'timetable' ? 'bg-white/20 text-white' : 'bg-indigo-100 text-indigo-700'
                    }`}>
                        ERP
                    </span>
                </button>

                {/* Grades & CGPA View */}
                <button
                    type="button"
                    onClick={() => {
                        navigate('/grades');
                        if (window.innerWidth < 1024 && onToggle) onToggle();
                    }}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-white transition-all cursor-pointer border border-transparent hover:border-slate-200"
                    title="View Grades, SGPA and Cumulative CGPA"
                >
                    <div className="flex items-center gap-2.5">
                        <GraduationCap className="w-4 h-4 text-amber-500" />
                        <span>Grades & CGPA</span>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase bg-amber-50 text-amber-700 border border-amber-200">
                        Scorecard
                    </span>
                </button>

                {/* Change Selection (Matching Image 1 in Sidebar) */}
                <button
                    type="button"
                    onClick={() => {
                        window.dispatchEvent(new CustomEvent('kl_reset_selection'));
                        if (window.innerWidth < 1024 && onToggle) onToggle();
                    }}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-white transition-all cursor-pointer border border-transparent hover:border-slate-200"
                    title="Change Academic Year or Semester"
                >
                    <div className="flex items-center gap-2.5">
                        <SlidersHorizontal className="w-4 h-4 text-slate-500" />
                        <span>Change Selection</span>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase bg-slate-100 text-slate-500">
                        Sem / Year
                    </span>
                </button>
            </div>

            {/* Desktop Flush Top Header (Clean slate/white border beneath main navigation) */}
            <div className="hidden lg:flex items-center justify-between px-4 py-3 bg-slate-50/70 border-b border-slate-100 shrink-0">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                    <Users className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Student Profiles</span>
                </div>
                <span className="text-[10px] font-bold text-slate-400 bg-white px-2 py-0.5 rounded-full border border-slate-200/60">
                    {friends.length + 1} Saved
                </span>
            </div>

            {/* Scrollable Container */}
            <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
                
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
                        <span className="mt-2 inline-block text-[9px] font-black uppercase tracking-wider bg-amber-200/90 text-amber-900 px-2 py-0.5 rounded-md border border-amber-300">
                            Unable to Login
                        </span>
                    </div>
                )}

                {/* 1. MY PROFILE */}
                <div>
                    <div className="flex items-center justify-between mb-2 px-1">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                            My Profile
                        </span>
                        {isSelfActive && (
                            <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                <span>Active</span>
                            </span>
                        )}
                    </div>

                    {/* My Profile Card */}
                    <div
                        onClick={() => handleProfileClick(myProfile)}
                        className={`group px-3 py-2.5 rounded-xl border transition-all flex items-center justify-between gap-2 cursor-pointer ${
                            isSelfActive
                                ? 'bg-indigo-50/70 border-indigo-400 shadow-2xs ring-1 ring-indigo-300'
                                : 'bg-white border-slate-200/90 hover:border-slate-300 hover:bg-slate-50/70'
                        }`}
                    >
                        <div className="flex items-center gap-2.5 min-w-0">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                isSelfActive ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                            }`}>
                                <User className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-bold text-slate-900 truncate">
                                        {myProfile?.nickname || 'My Account'}
                                    </span>
                                    {isSelfActive && (
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                                    )}
                                </div>
                                <span className="text-[10px] text-slate-500 font-medium block truncate">
                                    ID: {myProfile?.studentId || 'Not Set'}
                                </span>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={(e) => handleEditProfile(e, myProfile, true)}
                            className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                            title="Edit My Profile"
                        >
                            <Edit2 className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>

                {/* 2. FRIENDS */}
                <div>
                    <div className="flex items-center justify-between mb-2 px-1">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                            Friends
                        </span>
                        <span className="text-[10px] text-slate-400 font-semibold">
                            {friends.length} {friends.length === 1 ? 'saved' : 'saved'}
                        </span>
                    </div>

                    {/* Friends List or Clean Empty Text */}
                    {friends.length === 0 ? (
                        <div className="py-4 px-3 text-center rounded-xl bg-slate-50/60 border border-slate-100">
                            <p className="text-xs text-slate-500 font-medium">No friends saved yet.</p>
                        </div>
                    ) : (
                        <div className="space-y-1.5">
                            {friends.map((friend) => {
                                const isActive = activeProfile?.id === friend.id;
                                return (
                                    <div
                                        key={friend.id}
                                        onClick={() => handleProfileClick(friend)}
                                        className={`group px-3 py-2.5 rounded-xl border transition-all flex items-center justify-between gap-2 cursor-pointer ${
                                            isActive
                                                ? 'bg-indigo-50/70 border-indigo-400 shadow-2xs ring-1 ring-indigo-300'
                                                : 'bg-white border-slate-200/90 hover:border-slate-300 hover:bg-slate-50/70'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                                isActive ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                                            }`}>
                                                <Users className="w-4 h-4" />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-xs font-bold text-slate-900 truncate">
                                                        {friend.nickname || friend.label || 'Friend'}
                                                    </span>
                                                    {isActive && (
                                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                                                    )}
                                                </div>
                                                <span className="text-[10px] text-slate-500 font-medium block truncate">
                                                    ID: {friend.studentId}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-1 shrink-0">
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (friend.password || friend.hasSavedPassword) {
                                                        setCaptchaTarget(friend);
                                                    } else {
                                                        handleEditProfile(e, friend, false);
                                                    }
                                                }}
                                                className="p-1 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 rounded-md transition-colors cursor-pointer"
                                                title="Connect ERP & Fetch Live Data (Captcha)"
                                            >
                                                <ShieldCheck className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={(e) => handleEditProfile(e, friend, false)}
                                                className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                                                title="Edit Friend"
                                            >
                                                <Edit2 className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={(e) => handleDeleteFriend(e, friend.id)}
                                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                                                title="Delete Friend"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* 3. ADD FRIEND OPTION (PLACED LAST) */}
                <div className="pt-1">
                    <button
                        type="button"
                        onClick={handleAddFriendClick}
                        className="w-full py-2.5 px-3 rounded-xl border border-dashed border-indigo-300/80 bg-indigo-50/30 hover:bg-indigo-50 hover:border-indigo-400 text-indigo-700 font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs active:scale-98"
                    >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>Add Friend</span>
                    </button>
                </div>
            </div>

            {/* Bottom Footer Info */}
            <div className="p-3 bg-slate-50/70 border-t border-slate-100 text-center shrink-0">
                <p className="text-[10px] text-slate-400 font-medium flex items-center justify-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-emerald-600" />
                    <span>Credentials secured in browser</span>
                </p>
            </div>

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
                onFriendSaved={(saved) => {
                    setMyProfile(getMyProfile());
                    setFriends(getSavedFriends());
                    setShowAddModal(false);
                    setEditingProfile(null);
                    setIsEditingSelf(false);
                    if (saved) {
                        setCaptchaTarget(saved);
                    }
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
