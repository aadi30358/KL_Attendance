import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Eye, EyeOff, Save, Check, Users, User, Edit3, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { saveFriend, saveMyProfile, decodePassword, setActiveProfileId } from '../services/friendsService';

function AddFriendForm({ initialFriend, isMyProfile, onClose, onFriendSaved }) {
    const navigate = useNavigate();
    const isSelf = isMyProfile || initialFriend?.id === 'main';

    const [customName, setCustomName] = useState(() => {
        if (initialFriend) return initialFriend.nickname || initialFriend.name || '';
        return isSelf ? 'My Account' : '';
    });

    const [studentId, setStudentId] = useState(() => initialFriend?.studentId || '');
    const [password, setPassword] = useState(() => {
        return initialFriend?.password ? decodePassword(initialFriend.password) : '';
    });

    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [savedSuccess, setSavedSuccess] = useState(false);

    const handleSave = (e) => {
        if (e) e.preventDefault();
        setError('');

        const cleanId = studentId.trim();
        const cleanName = customName.trim();
        const cleanPass = password.trim();

        if (!cleanName) {
            setError('Please enter a name for this profile.');
            return;
        }

        if (!cleanId) {
            setError('Please enter the Student ID number.');
            return;
        }

        if (!cleanPass && !initialFriend?.password) {
            setError('Please enter the ERP password to save.');
            return;
        }

        try {
            let saved;
            if (isSelf) {
                saved = saveMyProfile({
                    nickname: cleanName,
                    studentId: cleanId,
                    password: cleanPass
                });
            } else {
                saved = saveFriend({
                    id: initialFriend?.id,
                    nickname: cleanName,
                    studentId: cleanId,
                    password: cleanPass
                });
            }

            // Immediately set active ERP user to this saved profile so Attendance Register loads them
            try {
                localStorage.setItem('activeErpUser', cleanId);
                const profId = saved?.id || (isSelf ? 'main' : cleanId);
                setActiveProfileId(profId);
                const currentYr = `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`;
                if (!localStorage.getItem(`manualYear_${cleanId}`)) {
                    localStorage.setItem(`manualYear_${cleanId}`, currentYr);
                }
                if (!localStorage.getItem(`manualSem_${cleanId}`)) {
                    localStorage.setItem(`manualSem_${cleanId}`, 'Odd');
                }
                window.dispatchEvent(new CustomEvent('kl_active_profile_updated', { detail: { profileId: profId, studentId: cleanId } }));
                window.dispatchEvent(new CustomEvent('kl_profile_switched', { detail: { profile: saved, studentId: cleanId } }));
            } catch { /* ignore */ }

            setSavedSuccess(true);
            setTimeout(() => {
                setSavedSuccess(false);
                if (onFriendSaved) {
                    onFriendSaved(saved);
                }
                onClose();
                // Always redirect to Attendance Register (odd sem and year) and prompt Captcha immediately
                navigate('/attendance-register', { state: { openCaptcha: true, targetFriend: saved } });
                window.dispatchEvent(new CustomEvent('kl_open_captcha', { detail: { targetFriend: saved } }));
            }, 500);
        } catch (err) {
            setError(err.message || 'Failed to save details.');
        }
    };

    return (
        <>
            {/* Header */}
            <div className="text-center mb-5">
                <div className="w-12 h-12 mx-auto mb-2 rounded-2xl bg-indigo-50 border-2 border-slate-900 flex items-center justify-center shadow-sm">
                    {isSelf ? (
                        <User className="w-6 h-6 text-indigo-700" />
                    ) : (
                        <Users className="w-6 h-6 text-indigo-700" />
                    )}
                </div>
                <h3 className="text-xl font-black text-slate-900 tracking-tight">
                    {isSelf
                        ? initialFriend?.studentId ? 'Edit My Profile' : 'Set Up My Profile'
                        : initialFriend ? 'Edit Friend Details' : 'Add Friend Details'}
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-1">
                    {isSelf
                        ? 'Save your primary Student ID & Password for fast 1-click Captcha logins.'
                        : 'Enter name, ID, and password. Saved locally in browser for quick Captcha logins.'}
                </p>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
                {/* Custom / Editable Name Field */}
                <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                        <label className="text-[11px] font-black uppercase tracking-wider text-slate-700">
                            {isSelf ? '1. Your Display Name' : '1. Friend Name / Nickname'}
                        </label>
                        <span className="text-xs font-bold text-indigo-600 flex items-center gap-1">
                            <Edit3 className="w-3 h-3" />
                            <span>Name</span>
                        </span>
                    </div>
                    <input
                        type="text"
                        value={customName}
                        onChange={(e) => setCustomName(e.target.value)}
                        placeholder={isSelf ? 'e.g. My Account / Yaswanth' : "Enter friend's name (e.g. Alex, Rahul, Adithya...)"}
                        autoComplete="off"
                        className="w-full bg-slate-50 border-2 border-slate-300 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100 rounded-xl py-3 px-4 text-slate-900 font-bold text-sm transition-all"
                    />
                </div>

                {/* Student ID */}
                <div className="space-y-1.5">
                    <label className="text-[11px] font-black uppercase tracking-wider text-slate-700 block">
                        2. Student ID Number
                    </label>
                    <input
                        type="text"
                        value={studentId}
                        onChange={(e) => setStudentId(e.target.value)}
                        placeholder="e.g. 2400030123"
                        autoComplete="off"
                        className="w-full bg-slate-50 border-2 border-slate-300 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100 rounded-xl py-3 px-4 text-slate-900 font-bold text-sm transition-all"
                    />
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                    <label className="text-[11px] font-black uppercase tracking-wider text-slate-700 block">
                        3. ERP Password
                    </label>
                    <div className="relative">
                        <input
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder={initialFriend ? "Enter new password or keep existing" : "Enter ERP password"}
                            autoComplete="off"
                            className="w-full bg-slate-50 border-2 border-slate-300 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100 rounded-xl py-3 px-4 pr-11 text-slate-900 font-bold text-sm transition-all"
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors p-1 cursor-pointer"
                        >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                    </div>
                    <p className="text-[10px] text-slate-500 font-medium flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>Saved in your browser only so you won&apos;t need to re-type it.</span>
                    </p>
                </div>

                {/* Error */}
                {error && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-bold">
                        {error}
                    </div>
                )}

                {/* Save Button */}
                <button
                    type="submit"
                    disabled={savedSuccess}
                    className={`w-full py-3.5 font-black text-sm rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98 ${
                        savedSuccess
                            ? 'bg-emerald-600 text-white shadow-emerald-600/25'
                            : 'bg-slate-900 hover:bg-slate-800 text-white shadow-slate-900/25'
                    }`}
                >
                    {savedSuccess ? (
                        <>
                            <Check className="w-4 h-4 text-white" />
                            <span>Saved Successfully!</span>
                        </>
                    ) : (
                        <>
                            <Save className="w-4 h-4" />
                            <span>Save Details</span>
                        </>
                    )}
                </button>
            </form>
        </>
    );
}

export default function AddFriendModal({ isOpen, onClose, onFriendSaved, initialFriend = null, isMyProfile = false }) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs font-sans">
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border-2 border-slate-900 relative overflow-hidden transform-gpu max-h-[92vh] overflow-y-auto"
            >
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-800 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
                >
                    <X className="w-5 h-5" />
                </button>

                <AddFriendForm
                    key={`${initialFriend?.id || (isMyProfile ? 'main' : 'new')}-${initialFriend?.studentId || ''}`}
                    initialFriend={initialFriend}
                    isMyProfile={isMyProfile}
                    onClose={onClose}
                    onFriendSaved={onFriendSaved}
                />
            </motion.div>
        </div>
    );
}
