import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, UserPlus, Users, User, Trash2, ArrowRight, AlertTriangle } from 'lucide-react';
import { getSavedFriends, deleteFriend, getActiveProfileDetails, setActiveProfileId, getMyProfile } from '../services/friendsService';
import { useMaintenance } from '../services/useMaintenance';
import AddFriendModal from './AddFriendModal';
import FriendCaptchaModal from './FriendCaptchaModal';
import { useAuth } from '../context/useAuth';

export default function FriendsManagerModal({ isOpen, onClose }) {
    const { setErpUser } = useAuth();
    const { isMaintenance, maintenanceConfig } = useMaintenance();
    const [friends, setFriends] = useState(() => getSavedFriends());
    const [myProfile, setMyProfile] = useState(() => getMyProfile());
    const [activeProfile, setActiveProfile] = useState(() => getActiveProfileDetails());
    const [showAddModal, setShowAddModal] = useState(false);
    const [targetFriendForCaptcha, setTargetFriendForCaptcha] = useState(null);

    // Sync friends on updates or custom events
    useEffect(() => {
        const updateList = () => {
            setFriends(getSavedFriends());
            setMyProfile(getMyProfile());
            setActiveProfile(getActiveProfileDetails());
        };

        window.addEventListener('kl_friends_updated', updateList);
        window.addEventListener('kl_active_profile_updated', updateList);
        window.addEventListener('storage', updateList);

        return () => {
            window.removeEventListener('kl_friends_updated', updateList);
            window.removeEventListener('kl_active_profile_updated', updateList);
            window.removeEventListener('storage', updateList);
        };
    }, []);

    if (!isOpen) return null;

    const handleDelete = (e, friendId) => {
        e.stopPropagation();
        if (window.confirm('Are you sure you want to remove this saved friend profile?')) {
            deleteFriend(friendId);
            setFriends(getSavedFriends());
        }
    };

    const handleSwitchToMe = () => {
        const myId = localStorage.getItem('rememberedId');
        setActiveProfileId('main');
        if (myId && typeof setErpUser === 'function') {
            setErpUser(myId);
        }
        onClose();
        window.location.reload();
    };

    const handleCheckAttendance = (profile) => {
        if (isMaintenance) {
            alert(maintenanceConfig?.message || 'ERP login is currently under maintenance. Direct login is paused.');
            return;
        }
        setTargetFriendForCaptcha(profile);
    };

    return (
        <>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs font-sans">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border-2 border-slate-900 relative overflow-hidden transform-gpu max-h-[90vh] flex flex-col"
                >
                    {/* Close */}
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-800 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                        <X className="w-5 h-5" />
                    </button>

                    {/* Header */}
                    <div className="text-center mb-4 shrink-0">
                        <div className="w-14 h-14 mx-auto mb-2 rounded-2xl bg-gradient-to-tr from-pink-100 via-purple-100 to-indigo-100 border-2 border-slate-900 flex items-center justify-center text-indigo-700 shadow-sm">
                            <Users className="w-7 h-7" />
                        </div>
                        <h3 className="text-xl font-black text-slate-900 tracking-tight">
                            Friend Attendance Switcher
                        </h3>
                        <p className="text-xs text-slate-500 font-medium mt-1">
                            Switch and check attendance with just Captcha verification!
                        </p>
                    </div>

                    {/* ERP Maintenance Notice */}
                    {isMaintenance && (
                        <div className="mb-4 p-3.5 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-300 text-amber-950 shadow-xs shrink-0">
                            <div className="flex items-start gap-3">
                                <div className="p-2 rounded-xl bg-amber-500 text-white shrink-0 mt-0.5 shadow-xs">
                                    <AlertTriangle className="w-5 h-5 stroke-[2.5]" />
                                </div>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <h4 className="text-xs sm:text-sm font-black text-amber-900 tracking-tight">
                                            {maintenanceConfig?.title || 'ERP Under Maintenance'}
                                        </h4>
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-200/90 text-amber-900 border border-amber-300">
                                            Unable to Login
                                        </span>
                                    </div>
                                    <p className="text-[11px] sm:text-xs text-amber-800 font-semibold mt-1 leading-relaxed">
                                        {maintenanceConfig?.message || 'KL ERP login is currently undergoing scheduled maintenance. Direct authentication and live sync are temporarily paused.'}
                                    </p>
                                    {maintenanceConfig?.eta && (
                                        <div className="mt-2 text-[10px] sm:text-[11px] font-bold text-amber-900 bg-amber-100/90 px-2.5 py-1 rounded-lg inline-block border border-amber-200">
                                            <span>Note: </span>
                                            <span className="font-extrabold">{maintenanceConfig.eta}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Currently Viewing Banner */}
                    <div className="mb-4 p-3 bg-slate-50 border-2 border-slate-200 rounded-2xl flex items-center justify-between gap-3 shrink-0">
                        <div className="flex items-center gap-2.5">
                            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm">
                                {activeProfile?.isFriend ? <Users className="w-5 h-5 text-white" /> : <User className="w-5 h-5 text-white" />}
                            </div>
                            <div>
                                <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider block">
                                    Currently Viewing
                                </span>
                                <span className="text-sm font-black text-slate-900">
                                    {activeProfile?.label || 'Adithya'}
                                </span>
                            </div>
                        </div>

                        {activeProfile?.isFriend && (
                            <button
                                onClick={handleSwitchToMe}
                                className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer"
                            >
                                Switch to Me
                            </button>
                        )}
                    </div>

                    {/* Profiles List Scrollable */}
                    <div className="flex-1 overflow-y-auto space-y-3 pr-1 mb-4">
                        {/* 1. User's Own Account */}
                        {myProfile && (
                            <div>
                                <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider px-1 mb-1.5">
                                    <span>My Profile</span>
                                    <span className="text-[10px] text-indigo-600 font-extrabold">Instant Captcha Verification</span>
                                </div>

                                <div
                                    onClick={() => handleCheckAttendance(myProfile)}
                                    className={`p-3.5 rounded-2xl border-2 transition-all flex items-center justify-between gap-3 cursor-pointer ${
                                        !activeProfile?.isFriend
                                            ? 'bg-indigo-50/80 border-indigo-600 shadow-md ring-2 ring-indigo-200'
                                            : 'bg-white border-slate-200 hover:border-indigo-400 hover:bg-slate-50 shadow-xs'
                                    }`}
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-10 h-10 rounded-xl bg-indigo-100 border border-indigo-200 flex items-center justify-center shrink-0">
                                            <User className="w-5 h-5 text-indigo-700" />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-1.5">
                                                <h4 className="font-black text-sm text-slate-900 truncate">
                                                    {myProfile.nickname || 'Adithya'}
                                                </h4>
                                                {!activeProfile?.isFriend && (
                                                    <span className="bg-indigo-600 text-white text-[9px] font-black uppercase px-2 py-0.5 rounded-full shrink-0">
                                                        Active
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-slate-500 font-bold truncate">
                                                ID: {myProfile.studentId || '2400030358'}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0">
                                        {isMaintenance ? (
                                            <span className="px-2.5 py-1 bg-amber-100 border border-amber-300 text-amber-900 text-[10px] font-black rounded-xl">
                                                Unable to Login
                                            </span>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleCheckAttendance(myProfile);
                                                }}
                                                className="px-3 py-1.5 bg-slate-900 hover:bg-indigo-600 text-white text-xs font-black rounded-xl transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
                                                title="Check my attendance with Captcha"
                                            >
                                                <span>Check</span>
                                                <ArrowRight className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 2. Friends Section */}
                        <div>
                            <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider px-1 mb-1.5">
                                <span>Saved Friends ({friends.length})</span>
                            </div>

                            {friends.length === 0 ? (
                                <div className="p-5 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                                    <Users className="w-7 h-7 text-slate-400 mx-auto mb-1.5" />
                                    <p className="text-xs font-bold text-slate-700 mb-0.5">No friends saved yet</p>
                                    <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                                        Save your friend&apos;s details once to check their attendance with just Captcha!
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {friends.map((friend) => {
                                        const isActive = activeProfile?.id === friend.id;
                                        return (
                                            <div
                                                key={friend.id}
                                                onClick={() => handleCheckAttendance(friend)}
                                                className={`p-3.5 rounded-2xl border-2 transition-all flex items-center justify-between gap-3 cursor-pointer ${
                                                    isActive
                                                        ? 'bg-indigo-50/80 border-indigo-600 shadow-md ring-2 ring-indigo-200'
                                                        : 'bg-white border-slate-200 hover:border-indigo-400 hover:bg-slate-50 shadow-xs'
                                                }`}
                                            >
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                                                        <Users className="w-5 h-5 text-slate-600" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-1.5">
                                                            <h4 className="font-black text-sm text-slate-900 truncate">
                                                                {friend.nickname}
                                                            </h4>
                                                            {isActive && (
                                                                <span className="bg-indigo-600 text-white text-[9px] font-black uppercase px-2 py-0.5 rounded-full shrink-0">
                                                                    Active
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-xs text-slate-500 font-bold truncate">
                                                            ID: {friend.studentId}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2 shrink-0">
                                                    {isMaintenance ? (
                                                        <span className="px-2.5 py-1 bg-amber-100 border border-amber-300 text-amber-900 text-[10px] font-black rounded-xl">
                                                            Unable to Login
                                                        </span>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleCheckAttendance(friend);
                                                            }}
                                                            className="px-3 py-1.5 bg-slate-900 hover:bg-indigo-600 text-white text-xs font-black rounded-xl transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
                                                            title="Check this friend's attendance"
                                                        >
                                                            <span>Check</span>
                                                            <ArrowRight className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}

                                                    <button
                                                        type="button"
                                                        onClick={(e) => handleDelete(e, friend.id)}
                                                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                                        title="Remove friend"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="shrink-0 pt-2 border-t border-slate-100 flex gap-2">
                        <button
                            type="button"
                            onClick={() => setShowAddModal(true)}
                            className="flex-1 py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-black text-xs sm:text-sm rounded-xl shadow-lg shadow-indigo-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                        >
                            <UserPlus className="w-4 h-4" />
                            <span>Add Friend Details</span>
                        </button>
                    </div>
                </motion.div>
            </div>

            {/* Add Friend Submodal */}
            <AddFriendModal
                isOpen={showAddModal}
                onClose={() => setShowAddModal(false)}
                onFriendSaved={(newFriend) => {
                    setFriends(getSavedFriends());
                    setShowAddModal(false);
                    // Open captcha immediately to check their attendance
                    setTargetFriendForCaptcha(newFriend);
                }}
            />

            {/* Captcha-Only Modal */}
            <FriendCaptchaModal
                friend={targetFriendForCaptcha}
                isOpen={Boolean(targetFriendForCaptcha)}
                onClose={() => setTargetFriendForCaptcha(null)}
                onSuccess={() => {
                    setActiveProfile(getActiveProfileDetails());
                    setTargetFriendForCaptcha(null);
                    onClose();
                }}
            />
        </>
    );
}
