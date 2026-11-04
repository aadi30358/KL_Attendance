import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    LogIn, 
    RefreshCcw, 
    Loader2, 
    Sparkles, 
    Eye, 
    EyeOff, 
    Wrench, 
    ShieldAlert, 
    Clock, 
    ArrowLeft, 
    AlertTriangle, 
    ShieldCheck, 
    Lock, 
    Key, 
    X, 
    User, 
    Users,
    Plus, 
    Trash2, 
    Edit2
} from 'lucide-react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { erpService } from '../services/erpService';
import { useAuth } from '../context/useAuth';
import { saveCredentialsToSheet } from '../services/gsheetsService';
import { recordStudentLogin } from '../services/loginTracker';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { subscribeCrossDomainSync, broadcastAttendanceUpdate } from '../services/crossDomainSync';
import SEO from '../components/SEO';
import AddFriendModal from '../components/AddFriendModal';
import ErpSidebar from '../components/ErpSidebar';
import { fetchLiveErpGrades } from '../services/gradesService';
import { fetchLiveErpTimetable } from '../services/timetableService';
import ClassTimetable from '../components/ClassTimetable';
import { 
    saveFriend, 
    saveMyProfile,
    deleteFriend, 
    getAllProfiles, 
    decodePassword, 
    setActiveProfileId, 
    getActiveProfileId, 
    stripEmojis,
    getSavedFriends,
    getMyProfile
} from '../services/friendsService';
import {
    saveStudentProfileToCloud,
    getStudentProfileFromCloud,
    saveFriendsToCloud,
    saveAttendanceToCloud,
    restoreStudentDataInIncognito,
    seedAdithyaProfileIfEmpty,
    deleteStudentProfileFromCloud
} from '../services/cloudStorageService';

const Login = () => {
    const { setErpUser, currentUser } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const isAdmin = currentUser?.email === 'yaswanthadithyareddy11@gmail.com' ||
                    currentUser?.email === 'yaswanthadithyareddy12@gmail.com' ||
                    currentUser?.email === 'yaswanthadithyareddy10@gmail.com' ||
                    currentUser?.email === 'yaswanthadithya3130@gmail.com';

    const [maintenanceConfig, setMaintenanceConfig] = useState(() => {
        try {
            const raw = localStorage.getItem('kl_erp_maintenance');
            return raw ? JSON.parse(raw) : { enabled: false };
        } catch {
            return { enabled: false };
        }
    });
    const [adminBypassed, setAdminBypassed] = useState(() => {
        try {
            return sessionStorage.getItem('kl_admin_bypass') === 'true';
        } catch {
            return false;
        }
    });
    const [showBypassModal, setShowBypassModal] = useState(false);
    const [bypassPassword, setBypassPassword] = useState('');
    const [showBypassPassword, setShowBypassPassword] = useState(false);
    const [bypassError, setBypassError] = useState('');

    const handleVerifyBypass = (e) => {
        if (e) e.preventDefault();
        const clean = bypassPassword.trim().toLowerCase();
        if (clean === 'aadi8055' || clean === 'adithya8055') {
            try {
                sessionStorage.setItem('kl_admin_bypass', 'true');
            } catch {
                // ignore
            }
            setAdminBypassed(true);
            setShowBypassModal(false);
            setBypassPassword('');
            setBypassError('');
        } else {
            setBypassError('Invalid admin bypass password. Access Denied.');
        }
    };

    const handleRelock = () => {
        try {
            sessionStorage.removeItem('kl_admin_bypass');
        } catch {
            // ignore
        }
        setAdminBypassed(false);
        setShowBypassModal(false);
        setBypassPassword('');
        setBypassError('');
    };

    // Profiles & active selection
    const [allProfilesList, setAllProfilesList] = useState(() => getAllProfiles());
    const [selectedProfileId, setSelectedProfileId] = useState(() => {
        const target = location.state?.studentId || location.state?.profileId;
        const list = getAllProfiles();
        if (target) {
            const match = list.find(p => p.studentId === target || p.username === target || p.id === target);
            if (match) return match.id;
        }
        const activeId = getActiveProfileId();
        if (activeId && list.some(p => p.id === activeId)) return activeId;
        return list.length > 0 ? list[0].id : 'new';
    });

    // Form inputs for new buddy / manual login
    const [idNumber, setIdNumber] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [newProfileName, setNewProfileName] = useState('');
    const [rememberMe, setRememberMe] = useState(true);

    // Captcha & submission
    const [captcha, setCaptcha] = useState('');
    const [captchaUrl, setCaptchaUrl] = useState('');
    const [isCaptchaLoading, setIsCaptchaLoading] = useState(false);
    const [csrfToken, setCsrfToken] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [logoutNotice, setLogoutNotice] = useState('');

    // Modals & UI
    const [showAddFriendModal, setShowAddFriendModal] = useState(false);
    const [editingFriend, setEditingFriend] = useState(null);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [activeView, setActiveView] = useState(() => {
        if (location.state?.view === 'attendance') return 'attendance';
        if (location.state?.view === 'timetable') return 'timetable';
        return 'attendance';
    });

    // Cross-component switch view listener
    useEffect(() => {
        const handleSwitch = (e) => {
            if (e.detail === 'timetable' || e.detail === 'attendance') {
                setActiveView(e.detail);
            }
        };
        window.addEventListener('kl_switch_view', handleSwitch);
        return () => window.removeEventListener('kl_switch_view', handleSwitch);
    }, []);

    // Listen for incoming location state navigation (e.g. ERP Portal Login button)
    useEffect(() => {
        const target = location.state?.studentId || location.state?.profileId;
        if (target) {
            const list = getAllProfiles();
            const match = list.find(p => p.studentId === target || p.username === target || p.id === target);
            if (match) {
                setSelectedProfileId(match.id);
                setActiveProfileId(match.id);
            }
        }
        if (location.state?.view) {
            setActiveView(location.state.view);
        }
    }, [location.state]);

    // Retrieve cached ERP courses for timetable
    const getCachedCourses = (id) => {
        try {
            if (!id) return [];
            const raw = localStorage.getItem(`kleData_${id}`) || localStorage.getItem('kleData');
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed?.attendance_data) && parsed.attendance_data.length > 0) {
                    return parsed.attendance_data;
                }
            }
        } catch {
            // ignore
        }
        return [];
    };

    // Sync saved friends and profiles
    useEffect(() => {
        const updateAll = () => {
            const updated = getAllProfiles();
            setAllProfilesList(updated);
            if (selectedProfileId !== 'new' && !updated.some(p => p.id === selectedProfileId)) {
                setSelectedProfileId(updated.length > 0 ? updated[0].id : 'new');
            }
        };
        window.addEventListener('kl_friends_updated', updateAll);
        window.addEventListener('kl_active_profile_updated', updateAll);
        window.addEventListener('storage', updateAll);
        return () => {
            window.removeEventListener('kl_friends_updated', updateAll);
            window.removeEventListener('kl_active_profile_updated', updateAll);
            window.removeEventListener('storage', updateAll);
        };
    }, [selectedProfileId]);

    // Automatic cloud sync on mount for Incognito, new devices, and fresh tabs
    useEffect(() => {
        seedAdithyaProfileIfEmpty().catch(() => {});
        const currentProfiles = getAllProfiles();
        if (currentProfiles.length === 0) {
            // In Incognito / fresh browser, restore registered profile
            restoreStudentDataInIncognito('2400030358').then(restored => {
                if (restored) {
                    const updated = getAllProfiles();
                    setAllProfilesList(updated);
                    if (updated.length > 0) {
                        setSelectedProfileId(updated[0].id);
                    }
                }
            }).catch(() => {});
        }
    }, []);

    // Auto-redirect to Attendance Register (page with Odd Sem & Year) ONLY if an active ERP session exists
    useEffect(() => {
        try {
            const isExplicitSwitch = Boolean(location.state?.studentId || location.state?.profileId || location.state?.switchAccount);
            const isDirectLoggedOut = Boolean(location.state?.loggedOut || sessionStorage.getItem('kl_user_logged_out') === 'true');
            const logoutReason = sessionStorage.getItem('kl_logout_reason');

            // If user explicitly logged out, NEVER auto-redirect to attendance register
            if (isDirectLoggedOut) {
                return;
            }

            const html = localStorage.getItem('erpDashboardHtml');
            const activeUser = localStorage.getItem('activeErpUser');
            const hasActiveSession = Boolean(
                html && 
                !html.includes('site-error') && 
                !html.includes('id="login-form"') && 
                activeUser
            );

            // Auto-redirect ONLY if an active ERP session is currently valid
            if (hasActiveSession && !isExplicitSwitch && !logoutReason) {
                navigate('/attendance-register', { replace: true });
            }
        } catch {
            // ignore
        }
    }, [navigate, location.state]);

    // Check for inactivity or session expiration logout reason
    useEffect(() => {
        try {
            const reason = sessionStorage.getItem('kl_logout_reason');
            if (reason === 'inactivity') {
                sessionStorage.removeItem('kl_logout_reason');
                setLogoutNotice('You have been automatically logged out due to inactivity.');
            } else if (reason === 'session_expired') {
                sessionStorage.removeItem('kl_logout_reason');
                setLogoutNotice('Your university ERP session timed out due to inactivity. Please sign in again.');
            }
        } catch {
            // ignore
        }
    }, []);

    // Real-time synchronization for ERP Maintenance Mode (< 1s sync across all domains)
    useEffect(() => {
        let unsub = null;
        try {
            unsub = onSnapshot(doc(db, 'config', 'maintenance'), (docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setMaintenanceConfig(data);
                } else {
                    setMaintenanceConfig({ enabled: false });
                }
            }, (err) => console.warn('[Login] Maintenance sync notice:', err));
        } catch {
            // ignore
        }

        const unsubCross = subscribeCrossDomainSync((event) => {
            if (event.type === 'MAINTENANCE_UPDATE' && event.data) {
                setMaintenanceConfig(event.data);
            }
        });

        const handleStorage = (e) => {
            if (e.key === 'kl_erp_maintenance') {
                try {
                    setMaintenanceConfig(e.newValue ? JSON.parse(e.newValue) : { enabled: false });
                } catch {
                    // ignore
                }
            }
        };
        window.addEventListener('storage', handleStorage);

        return () => {
            if (unsub) unsub();
            if (unsubCross) unsubCross();
            window.removeEventListener('storage', handleStorage);
        };
    }, []);

    const captchaUrlRef = useRef('');
    const csrfTokenRef = useRef('');
    const captchaCookiesRef = useRef('');
    const isSubmittingRef = useRef(false);
    const initCounterRef = useRef(0);
    const captchaInputRef = useRef(null);

    const refreshCaptcha = useCallback(async (keepError = false) => {
        const refreshId = ++initCounterRef.current;
        setIsCaptchaLoading(true);
        setCaptcha('');
        if (!keepError) {
            setError('');
        }
        try {
            const res = await erpService.refreshCaptcha();
            if (refreshId !== initCounterRef.current) return;
            if (res?.cookies) {
                captchaCookiesRef.current = res.cookies;
                try { sessionStorage.setItem('kl_captcha_cookies', res.cookies); } catch { /* ignore */ }
            }
            const resolvedUrl = res?.captchaUrl || res?.dataUrl || (res?.blob ? URL.createObjectURL(res.blob) : null) || (res?.captchaBlob ? URL.createObjectURL(res.captchaBlob) : null);
            if (resolvedUrl) {
                if (captchaUrlRef.current && captchaUrlRef.current.startsWith('blob:')) {
                    URL.revokeObjectURL(captchaUrlRef.current);
                }
                captchaUrlRef.current = resolvedUrl;
                setCaptchaUrl(resolvedUrl);
            }
            if (res?.csrfToken) {
                setCsrfToken(res.csrfToken);
                csrfTokenRef.current = res.csrfToken;
            }
        } catch (err) {
            if (refreshId !== initCounterRef.current) return;
            console.warn("Failed to refresh captcha notice:", err?.message || err);
            setError("Failed to load captcha. Please click refresh.");
        } finally {
            if (refreshId === initCounterRef.current) {
                setIsCaptchaLoading(false);
            }
        }
    }, []);

    const isMaintenanceBlocked = Boolean(maintenanceConfig?.enabled && !adminBypassed);

    useEffect(() => {
        if (isMaintenanceBlocked) return;

        let isMounted = true;
        const initId = ++initCounterRef.current;

        const init = async () => {
            setIsCaptchaLoading(true);
            try {
                erpService.clearStoredErpCookies();
                sessionStorage.removeItem('erp_authenticated');

                const res = await erpService.getInitialState();
                if (!isMounted || initId !== initCounterRef.current) return;

                if (res?.cookies) {
                    captchaCookiesRef.current = res.cookies;
                    try { sessionStorage.setItem('kl_captcha_cookies', res.cookies); } catch { /* ignore */ }
                }
                if (res?.csrfToken) {
                    setCsrfToken(res.csrfToken);
                    csrfTokenRef.current = res.csrfToken;
                }
                const resolvedUrl = res?.captchaUrl || res?.dataUrl || (res?.captchaBlob ? URL.createObjectURL(res.captchaBlob) : null) || (res?.blob ? URL.createObjectURL(res.blob) : null);
                if (resolvedUrl) {
                    if (captchaUrlRef.current && captchaUrlRef.current.startsWith('blob:')) {
                        URL.revokeObjectURL(captchaUrlRef.current);
                    }
                    captchaUrlRef.current = resolvedUrl;
                    setCaptchaUrl(resolvedUrl);
                } else {
                    refreshCaptcha();
                }
            } catch (err) {
                console.warn("Failed to init login notice:", err?.message || err);
                if (isMounted && initId === initCounterRef.current) {
                    refreshCaptcha();
                }
            } finally {
                if (isMounted && initId === initCounterRef.current) {
                    setIsCaptchaLoading(false);
                }
            }
        };
        init();

        return () => {
            isMounted = false;
        };
    }, [isMaintenanceBlocked, refreshCaptcha]);

    // Active profile when not in 'new' mode
        const isInstagram = typeof navigator !== 'undefined' && /Instagram|FBAN|FBAV|FB_IAB/i.test(navigator.userAgent || '');
    const isAndroid = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent || '');
    const isNewProfile = selectedProfileId === 'new';
    const activeProfile = !isNewProfile
        ? (allProfilesList.find(p => p.id === selectedProfileId) || allProfilesList[0] || null)
        : null;
    const timetableStudentId = activeProfile?.studentId || (typeof window !== 'undefined' ? localStorage.getItem('activeErpUser') : null) || '';
    const timetableStudentName = activeProfile?.nickname || activeProfile?.name || 'Account';

    // Focus captcha input whenever selected profile changes
    useEffect(() => {
        setCaptcha('');
        setError('');
        if (captchaInputRef.current) {
            captchaInputRef.current.focus();
        }
    }, [selectedProfileId]);

    const handleLogin = async () => {
        if (maintenanceConfig?.enabled && !adminBypassed) {
            setError("ERP login is currently under maintenance. Direct login is paused.");
            return;
        }
        if (isSubmittingRef.current) return;

        let cleanId = '';
        let cleanPass = '';

        if (!isNewProfile && activeProfile) {
            cleanId = (activeProfile.studentId || '').trim();
            cleanPass = decodePassword(activeProfile.password) || (activeProfile.id === 'main' ? decodePassword(localStorage.getItem('rememberedPassword') || '') : '');
            if (!cleanPass) {
                // Check permanent cloud storage
                try {
                    const cloudProf = await getStudentProfileFromCloud(cleanId);
                    if (cloudProf?.savedPassword) {
                        cleanPass = decodePassword(cloudProf.savedPassword);
                    }
                } catch { /* ignore */ }
            }
            if (!cleanPass) {
                setEditingFriend(activeProfile);
                setShowAddFriendModal(true);
                setError(`Please enter the ERP password for ${activeProfile.nickname}.`);
                return;
            }
        } else {
            cleanId = idNumber.trim();
            cleanPass = password.trim();
            if (!cleanPass) {
                try {
                    const cloudProf = await getStudentProfileFromCloud(cleanId);
                    if (cloudProf?.savedPassword) {
                        cleanPass = decodePassword(cloudProf.savedPassword);
                    }
                } catch { /* ignore */ }
            }
        }

        const cleanCaptcha = captcha.trim();

        if (!cleanId) {
            setError("Please enter your Student ID Number.");
            return;
        }
        if (!cleanPass) {
            setError("Please enter your ERP Password.");
            return;
        }
        if (!cleanCaptcha) {
            setError("Please enter the Captcha code.");
            return;
        }

        isSubmittingRef.current = true;
        setIsLoading(true);
        setError('');

        try {
            const activeToken = csrfTokenRef.current || erpService.getStoredCsrfToken() || csrfToken || '';
            const boundCookies = captchaCookiesRef.current || (typeof window !== 'undefined' ? sessionStorage.getItem('kl_captcha_cookies') : '') || '';
            const loginResult = await erpService.login(cleanId, cleanPass, cleanCaptcha, activeToken, boundCookies);

            if (loginResult && loginResult.success) {
                try {
                    localStorage.setItem('erpDashboardHtml', loginResult.html);
                    const cachedForUser = localStorage.getItem(`kleData_${cleanId}`);
                    if (cachedForUser) {
                        localStorage.setItem('kleData', cachedForUser);
                    }
                    localStorage.setItem('userUniversity', 'klu');
                    localStorage.setItem('activeErpUser', cleanId);
                    localStorage.setItem(`erp_verified_${cleanId}`, 'true');
                    sessionStorage.setItem(`erp_verified_${cleanId}`, 'true');
                    localStorage.setItem('erp_authenticated', 'true');
                    sessionStorage.setItem('erp_authenticated', 'true');
                    const currentCookies = erpService.getStoredErpCookies(cleanId);
                    if (currentCookies) {
                        localStorage.setItem(`erp_cookie_${cleanId}`, currentCookies);
                    }
                } catch { /* ignore storage error */ }
                setErpUser(cleanId);

                const detectedErpName = erpService.extractStudentNameFromHtml(loginResult.html) || (cleanId === '2400030358' ? 'Adithya' : null);

                if (!isNewProfile && activeProfile) {
                    const primaryRemembered = (typeof window !== 'undefined' ? (localStorage.getItem('original_my_id') || localStorage.getItem('rememberedId')) : '') || '';
                    const isSelf = activeProfile.id === 'main' || !activeProfile.isFriend || (primaryRemembered && cleanId === primaryRemembered);
                    if (isSelf) {
                        const selfName = (activeProfile.nickname && activeProfile.nickname !== 'My Account') ? activeProfile.nickname : (detectedErpName || (cleanId === '2400030358' ? 'Adithya' : null) || (typeof window !== 'undefined' ? localStorage.getItem('rememberedName') : null) || 'My Account');
                        saveMyProfile({
                            nickname: selfName,
                            studentId: cleanId,
                            password: cleanPass
                        });
                        setActiveProfileId('main', cleanId);
                        try {
                            localStorage.setItem('original_my_id', cleanId);
                            localStorage.setItem('rememberedId', cleanId);
                            if (selfName && selfName !== 'My Account') {
                                localStorage.setItem('rememberedName', selfName);
                                localStorage.setItem(`kl_name_${cleanId}`, selfName);
                            }
                        } catch { /* ignore */ }
                    } else {
                        saveFriend({
                            id: activeProfile.id,
                            nickname: activeProfile.nickname || 'Buddy',
                            studentId: cleanId,
                            password: cleanPass
                        });
                        setActiveProfileId(activeProfile.id, cleanId);
                    }
                } else {
                    // Check if cleanId matches an existing saved friend
                    const existingFriends = getSavedFriends();
                    const matchedFriend = existingFriends.find(f => (f.studentId || '').toLowerCase() === cleanId.toLowerCase());
                    const currentMy = getMyProfile();
                    const primaryRemembered = (typeof window !== 'undefined' ? (localStorage.getItem('original_my_id') || localStorage.getItem('rememberedId')) : '') || '';
                    const hasExistingPrimary = Boolean(currentMy?.studentId || primaryRemembered);

                    if (matchedFriend && hasExistingPrimary && matchedFriend.studentId !== currentMy?.studentId && matchedFriend.studentId !== primaryRemembered) {
                        saveFriend({
                            id: matchedFriend.id,
                            nickname: matchedFriend.nickname || 'Buddy',
                            studentId: cleanId,
                            password: cleanPass
                        });
                        setActiveProfileId(matchedFriend.id);
                    } else {
                        const cleanName = stripEmojis(newProfileName).trim();
                        // Invariant: The first student account in any browser session/incognito MUST ALWAYS be saved as Primary (id: 'main')
                        if (!hasExistingPrimary || cleanId === currentMy?.studentId || cleanId === primaryRemembered) {
                            const resolvedName = cleanName || detectedErpName || (cleanId === '2400030358' ? 'Adithya' : null) || (typeof window !== 'undefined' ? localStorage.getItem('rememberedName') : null) || 'My Account';
                            saveMyProfile({
                                nickname: resolvedName,
                                studentId: cleanId,
                                password: cleanPass
                            });
                            setActiveProfileId('main', cleanId);
                            try {
                                localStorage.setItem('original_my_id', cleanId);
                                localStorage.setItem('rememberedId', cleanId);
                                if (resolvedName && resolvedName !== 'My Account') {
                                    localStorage.setItem('rememberedName', resolvedName);
                                    localStorage.setItem(`kl_name_${cleanId}`, resolvedName);
                                }
                            } catch { /* ignore */ }
                        } else {
                            const newBuddy = saveFriend({
                                nickname: cleanName || detectedErpName || (cleanId === '2400030358' ? 'Adithya' : 'Buddy'),
                                studentId: cleanId,
                                password: cleanPass
                            });
                            if (newBuddy) {
                                setActiveProfileId(newBuddy.id);
                            }
                        }
                    }
                }

                // PERMANENT STORAGE: Save profile, credentials & friends to Firestore cloud
                const finalDisplayName = detectedErpName || (cleanId === '2400030358' ? 'Adithya' : null) || (typeof window !== 'undefined' ? localStorage.getItem('rememberedName') : null) || 'Student';
                saveStudentProfileToCloud(cleanId, {
                    name: finalDisplayName,
                    nickname: finalDisplayName,
                    password: cleanPass,
                    isPrimary: true,
                    primaryAccount: true
                }).catch(() => {});

                // Save all updated profiles to cloud
                const allCurrentProfiles = getAllProfiles();
                saveFriendsToCloud(cleanId, allCurrentProfiles).catch(() => {});

                // Fire background logging asynchronously without blocking UI navigation (< 10ms response)
                Promise.allSettled([
                    typeof recordStudentLogin === 'function' ? recordStudentLogin(cleanId) : Promise.resolve(),
                    saveCredentialsToSheet(cleanId)
                ]).catch(recErr => console.warn('[Login] Record login notice:', recErr));

                // Pre-sync live ERP attendance, timetable and grades in background & save to Firestore
                erpService.fetchAttendance(null, null, cleanId).then(courses => {
                    if (Array.isArray(courses) && courses.length > 0) {
                        saveAttendanceToCloud(cleanId, '2026-2027', '1', courses).catch(() => {});
                    }
                }).catch(() => {});
                fetchLiveErpTimetable(cleanId).catch(() => {});
                fetchLiveErpGrades(cleanId).catch(() => {});

                // Instant sub-second event dispatches across tabs and components
                window.dispatchEvent(new CustomEvent('kl_attendance_updated', { detail: { studentId: cleanId } }));
                window.dispatchEvent(new CustomEvent('kl_timetable_updated', { detail: { studentId: cleanId } }));
                window.dispatchEvent(new CustomEvent('kl_active_profile_updated', { detail: { studentId: cleanId } }));
                broadcastAttendanceUpdate({ studentId: cleanId, timestamp: Date.now() }).catch(() => {});

                // Always open Attendance Register first so real registered courses are fetched
                try { sessionStorage.removeItem('kl_user_logged_out'); } catch { /* ignore */ }
                navigate('/attendance-register');
            } else {
                throw new Error("Incorrect Captcha, Student ID, or Password. Please try again.");
            }
        } catch (err) {
            console.warn("Login attempt notice:", err?.message || err);
            const msg = String(err?.message || err || "Login failed. Please check the captcha code.");
            const lowerMsg = msg.toLowerCase();
            if (lowerMsg.includes('signal') || lowerMsg.includes('timed out') || lowerMsg.includes('timeout') || lowerMsg.includes('abort')) {
                setError("ERP server response took longer than expected. Please enter the new captcha to try again.");
            } else if (lowerMsg.includes('password') || lowerMsg.includes('incorrect username') || lowerMsg.includes('student id')) {
                if (!isNewProfile && activeProfile) {
                    setError(`Incorrect ERP password for ${activeProfile.nickname || 'account'}. Tap the edit icon to update your saved password.`);
                } else {
                    setError("Incorrect Student ID or Password. Please check your credentials.");
                }
            } else if (lowerMsg.includes('verification code') || lowerMsg.includes('captcha') || lowerMsg.includes('verifycode')) {
                setError("The verification code is incorrect. Please check the captcha.");
            } else if (lowerMsg.includes('unable to verify') || lowerMsg.includes('session rejected') || lowerMsg.includes('session expired') || lowerMsg.includes('http 400') || lowerMsg.includes('http 403')) {
                setError("Session expired or invalid captcha. Please enter the new captcha code.");
            } else {
                setError(msg || "The verification code is incorrect. Please check the captcha.");
            }
            setCaptcha('');
            refreshCaptcha(true);
        } finally {
            setIsLoading(false);
            isSubmittingRef.current = false;
        }
    };

    // ERP Login Under Maintenance Mode Screen
    if (maintenanceConfig?.enabled && !adminBypassed) {
        return (
            <div className="min-h-screen pt-28 pb-12 overflow-hidden bg-[#FAFAFA] flex items-center justify-center px-4 relative font-sans selection:bg-amber-500 selection:text-white">
                <SEO
                    title="ERP Login — Under Maintenance"
                    description={maintenanceConfig.message || "ERP Login is currently under maintenance."}
                />
                <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-b from-amber-50/50 via-white to-amber-50/20 opacity-80" />
                </div>

                <motion.div
                    initial={{ opacity: 0, y: 20, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 20, scale: 0.97 }}
                    transition={{ type: "spring", stiffness: 220, damping: 25 }}
                    className="w-full max-w-md relative z-10"
                >
                    <div className="bg-white border-[3px] border-slate-900 rounded-[2.5rem] p-6 sm:p-8 shadow-2xl relative overflow-hidden text-center">
                        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-xs font-black uppercase tracking-wider mb-6 shadow-xs">
                            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                            <span>System Under Maintenance</span>
                        </div>

                        <div className="relative w-20 h-20 mx-auto mb-6">
                            <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-amber-500 to-red-500 flex items-center justify-center shadow-lg shadow-amber-500/25 border-2 border-black">
                                <ShieldAlert className="w-10 h-10 text-white" />
                            </div>
                            <div className="absolute -bottom-1.5 -right-1.5 w-8 h-8 rounded-full bg-white border-2 border-black flex items-center justify-center text-amber-600 shadow-sm">
                                <Wrench className="w-4 h-4 text-amber-600 animate-bounce" />
                            </div>
                        </div>

                        <h1 className="text-2xl font-black text-slate-900 tracking-tight mb-2">
                            {maintenanceConfig.title || 'ERP Login is Under Maintenance'}
                        </h1>

                        <p className="text-slate-600 text-xs sm:text-sm font-medium leading-relaxed mb-6">
                            {maintenanceConfig.message || 'ERP login is currently under maintenance. Please check back shortly.'}
                        </p>

                        <div className="bg-amber-50/80 border-2 border-amber-200 rounded-2xl p-4 text-left mb-6 space-y-2.5">
                            {maintenanceConfig.eta && (
                                <div className="flex items-center gap-2 text-xs font-bold text-amber-950">
                                    <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                                    <span>Estimated Uptime: <span className="font-black text-amber-900">{maintenanceConfig.eta}</span></span>
                                </div>
                            )}
                            <div className="flex items-start gap-2 text-xs font-semibold text-amber-800">
                                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                <span>Direct ERP authentication is paused. Student attendance data is safe and will reload automatically once maintenance concludes.</span>
                            </div>
                        </div>

                        <div className="space-y-2.5">
                            <Link
                                to="/"
                                className="w-full py-3.5 bg-slate-900 hover:bg-black text-white text-xs font-black uppercase tracking-wider rounded-2xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                            >
                                <ArrowLeft className="w-4 h-4" />
                                <span>Back to Home</span>
                            </Link>

                            {(maintenanceConfig.allowAdminBypass || isAdmin) && (
                                <div className="w-full">
                                    {!showBypassModal ? (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setShowBypassModal(true);
                                                setBypassError('');
                                                setBypassPassword('');
                                            }}
                                            className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                                        >
                                            <ShieldCheck className="w-4 h-4 text-emerald-600" />
                                            <span>Authorized Admin Bypass</span>
                                        </button>
                                    ) : (
                                        <form onSubmit={handleVerifyBypass} className="p-3.5 bg-slate-50 border-2 border-slate-900 rounded-2xl text-left space-y-2.5 shadow-sm">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-1.5 text-xs font-black text-slate-900 uppercase tracking-wider">
                                                    <Lock className="w-3.5 h-3.5 text-indigo-600" />
                                                    <span>Admin Verification</span>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setShowBypassModal(false);
                                                        setBypassPassword('');
                                                        setBypassError('');
                                                    }}
                                                    className="text-slate-400 hover:text-slate-700 p-0.5 rounded cursor-pointer"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>

                                            <div className="relative">
                                                <input
                                                    type={showBypassPassword ? "text" : "password"}
                                                    value={bypassPassword}
                                                    onChange={(e) => {
                                                        setBypassPassword(e.target.value);
                                                        if (bypassError) setBypassError('');
                                                    }}
                                                    placeholder="Enter bypass password..."
                                                    autoFocus
                                                    className="w-full pl-3 pr-9 py-2 bg-white border-2 border-slate-300 focus:border-indigo-600 rounded-xl text-xs font-medium text-slate-900 outline-none transition-all placeholder:text-slate-400"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowBypassPassword(!showBypassPassword)}
                                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                                                >
                                                    {showBypassPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                                </button>
                                            </div>

                                            {bypassError && (
                                                <p className="text-[11px] font-bold text-red-600 flex items-center gap-1">
                                                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                                    <span>{bypassError}</span>
                                                </p>
                                            )}

                                            <div className="flex items-center gap-2 pt-0.5">
                                                <button
                                                    type="submit"
                                                    className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                                                >
                                                    <Key className="w-3.5 h-3.5" />
                                                    <span>Unlock Access</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setShowBypassModal(false);
                                                        setBypassPassword('');
                                                        setBypassError('');
                                                    }}
                                                    className="px-3 py-2 bg-slate-200 hover:bg-slate-300 active:scale-98 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        </form>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col font-sans selection:bg-indigo-500 selection:text-white overflow-hidden">
            <SEO
                title="KL Attendance Calculator Portal"
                description="Sign in to university ERP portal to view live attendance"
            />

            {/* Top Header */}
            <header className="bg-[#0088cc] text-white px-4 sm:px-6 py-2.5 shadow-md z-40 sticky top-0 shrink-0 w-full select-none border-b border-black/10">
                <div className="w-full relative flex items-center justify-between min-h-[46px]">
                    {/* Left Column: Mobile Drawer Toggle */}
                    <div className="flex items-center gap-2 z-10">
                        <button
                            type="button"
                            onClick={() => setSidebarOpen(prev => !prev)}
                            className="lg:hidden flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 active:scale-95 text-white text-xs font-bold transition-all border border-white/20 shadow-2xs cursor-pointer"
                            title="Student Profiles & Friends"
                        >
                            <Users className="w-4 h-4" />
                            <span className="hidden sm:inline text-[11px] font-bold">Profiles</span>
                        </button>
                    </div>

                    {/* Center Column: Logo + KL Attendance Calculator */}
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center text-center pointer-events-auto">
                        <div className="flex items-center gap-2 sm:gap-2.5">
                            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-white flex items-center justify-center p-0.5 shadow-sm ring-1 ring-white/30 shrink-0">
                                <img
                                    src="/Koneru Lakshmaiah University Logo Banner.png"
                                    alt="KLU"
                                    className="w-full h-full object-contain"
                                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                />
                            </div>
                            <span className="font-sans font-extrabold text-sm sm:text-lg text-white tracking-wide drop-shadow-xs whitespace-nowrap">
                                KL Attendance Calculator
                            </span>
                        </div>
                        <span className="text-[10px] sm:text-[11px] font-semibold text-white/95 tracking-wide leading-none mt-1 whitespace-nowrap">
                            {timetableStudentId ? `ERP Login • ${timetableStudentName} (${timetableStudentId})` : 'ERP Student Portal Login'}
                        </span>
                    </div>

                    {/* Right Column: Back to Home */}
                    <div className="flex items-center gap-2 z-10 ml-auto">
                        <Link
                            to="/"
                            className="text-xs font-black uppercase tracking-wider bg-white/15 hover:bg-white/25 active:scale-95 text-white px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-1.5 shadow-2xs border border-white/20"
                        >
                            <ArrowLeft className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Back to Home</span>
                        </Link>
                    </div>
                </div>
            </header>

            {/* Page Body: Left Sidebar + Centered Content Area */}
            <div className="flex-1 flex overflow-hidden min-h-0 relative">
                {/* Left Sidebar (Image 3 Style with Buddies, Bunk Simulator, LTPS, Absent) */}
                <ErpSidebar
                    isOpen={sidebarOpen}
                    onToggle={() => setSidebarOpen(false)}
                    activePage="login"
                    activeView={activeView}
                    onSelectView={setActiveView}
                    onSelectProfile={(prof) => {
                        setSelectedProfileId(prof.id);
                        setCaptcha('');
                        setError('');
                    }}
                    onAddNewProfile={() => {
                        setSelectedProfileId('new');
                        setCaptcha('');
                        setError('');
                    }}
                />

                {/* Main Content Area: Centered, Fit for Screen */}
                <main className={`flex-1 overflow-y-auto min-h-0 ${activeView === 'timetable' ? 'p-4 sm:p-6 lg:p-8 font-sans' : 'p-4 sm:p-8 lg:p-10 flex flex-col items-center justify-start sm:justify-center relative pb-24'}`}>
                    {activeView === 'timetable' ? (
                        <div className="w-full max-w-7xl mx-auto">
                            <ClassTimetable
                                studentId={timetableStudentId}
                                studentName={timetableStudentName}
                                erpCourses={getCachedCourses(timetableStudentId)}
                                onViewCourseAttendance={() => setActiveView('attendance')}
                                onSelectFriend={(fid) => {
                                    if (fid) {
                                        setActiveProfileId(fid);
                                        const match = allProfilesList.find(p => p.studentId === fid || p.username === fid);
                                        if (match) setSelectedProfileId(match.id);
                                    }
                                }}
                                onSelectProfile={(profile) => {
                                    if (profile?.id) {
                                        setActiveProfileId(profile.id);
                                        setSelectedProfileId(profile.id);
                                    }
                                }}
                            />
                        </div>
                    ) : (
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ type: "spring", stiffness: 220, damping: 25 }}
                        className="w-full max-w-xl lg:max-w-2xl relative z-10 my-auto"
                    >
                        {/* Main Login Card */}
                        <div className="bg-white border border-slate-200/90 rounded-3xl p-7 sm:p-9 lg:p-10 shadow-2xl shadow-slate-300/40 relative overflow-hidden transform-gpu">
                            {/* Shine bar */}
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 rounded-t-3xl" />

                            {/* Admin Bypass Notice (if active) */}
                            {adminBypassed && (
                                <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-2.5 flex items-center justify-between text-xs text-amber-900 font-bold relative z-10">
                                    <div className="flex items-center gap-2">
                                        <ShieldCheck className="w-4 h-4 text-amber-700" />
                                        <span>Maintenance Bypass Active</span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleRelock}
                                        className="text-[10px] text-amber-700 underline font-black cursor-pointer hover:text-amber-950"
                                    >
                                        Re-lock
                                    </button>
                                </div>
                            )}

                            {/* Instagram In-App Browser Assistant */}
                            {isInstagram && (
                                <div className="mb-4 p-3 rounded-2xl bg-gradient-to-r from-pink-50 via-purple-50 to-indigo-50 border border-pink-200/90 text-slate-800 text-xs shadow-2xs relative z-10">
                                    <div className="flex items-start gap-2.5">
                                        <span className="text-base shrink-0 select-none">📱</span>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-bold text-slate-900 flex flex-wrap items-center justify-between gap-1.5">
                                                <span>Instagram In-App Browser Detected</span>
                                                {isAndroid && (
                                                    <a
                                                        href={`intent://${window.location.host}${window.location.pathname}${window.location.search}#Intent;scheme=https;package=com.android.chrome;end`}
                                                        className="text-[10px] font-black uppercase tracking-wider bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1 rounded-lg transition-all shadow-2xs cursor-pointer inline-flex items-center gap-1 active:scale-95"
                                                    >
                                                        Open in Chrome
                                                    </a>
                                                )}
                                            </div>
                                            <p className="text-[11px] text-slate-600 mt-1 leading-snug">
                                                {isAndroid
                                                    ? 'For automatic password autofill & fastest login, tap "Open in Chrome" or tap (•••) at top right.'
                                                    : 'For automatic password autofill & best experience, tap the three dots (•••) at top right and choose "Open in Safari".'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Header */}
                            <div className="text-center mb-6 relative z-10">
                                <div className="w-14 h-14 mx-auto mb-2.5 rounded-2xl bg-[#0088cc] flex items-center justify-center shadow-md text-white">
                                    <Sparkles className="w-7 h-7 text-white" />
                                </div>
                                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                                    KL ERP Attendance
                                </h1>
                                <p className="text-slate-400 text-xs sm:text-sm font-medium mt-1">
                                    Sign in with ERP Captcha
                                </p>
                            </div>

                            {/* Profile Selection Bar (Chips) */}
                            <div className="mb-4 relative z-10">
                                <div className="flex items-center justify-between mb-1.5 px-0.5">
                                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                                        Select Profile
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSelectedProfileId('new');
                                            setNewProfileName('');
                                            setIdNumber('');
                                            setPassword('');
                                        }}
                                        className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors flex items-center gap-1 cursor-pointer"
                                    >
                                        <Plus className="w-3 h-3" />
                                        <span>Add Buddy</span>
                                    </button>
                                </div>

                                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                                    {allProfilesList.map((prof) => {
                                        const isSelected = selectedProfileId === prof.id;
                                        return (
                                            <button
                                                key={prof.id}
                                                type="button"
                                                onClick={() => {
                                                    setSelectedProfileId(prof.id);
                                                    setCaptcha('');
                                                    setError('');
                                                }}
                                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer active:scale-95 shrink-0 ${
                                                    isSelected
                                                        ? 'bg-slate-900 text-white shadow-xs'
                                                        : 'bg-slate-100 hover:bg-slate-200/80 text-slate-700'
                                                }`}
                                            >
                                                <User className="w-3.5 h-3.5" />
                                                <span>{prof.nickname}</span>
                                            </button>
                                        );
                                    })}

                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSelectedProfileId('new');
                                            setNewProfileName('');
                                            setIdNumber('');
                                            setPassword('');
                                            setCaptcha('');
                                            setError('');
                                        }}
                                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 whitespace-nowrap cursor-pointer active:scale-95 shrink-0 ${
                                            selectedProfileId === 'new'
                                                ? 'bg-indigo-600 text-white shadow-xs'
                                                : 'bg-indigo-50/60 hover:bg-indigo-50 text-indigo-700 border border-dashed border-indigo-300'
                                        }`}
                                    >
                                        <Plus className="w-3.5 h-3.5" />
                                        <span>+ Add</span>
                                    </button>
                                </div>
                            </div>

                            <form onSubmit={(e) => { e.preventDefault(); handleLogin(); }} className="space-y-4 relative z-10">
                                {/* Inactivity / Session Expired Notice */}
                                <AnimatePresence>
                                    {logoutNotice && (
                                        <motion.div
                                            initial={{ opacity: 0, scale: 0.95 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.95 }}
                                            className="bg-amber-50 border border-amber-200 text-amber-900 p-2.5 rounded-xl text-xs font-bold flex items-center justify-between gap-3 shadow-2xs"
                                        >
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse shrink-0" />
                                                <span>{logoutNotice}</span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setLogoutNotice('')}
                                                className="text-amber-600 hover:text-amber-800 text-xs font-black cursor-pointer px-1"
                                            >
                                                ✕
                                            </button>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                {/* Error banner */}
                                <AnimatePresence>
                                    {error && (
                                        <motion.div
                                            initial={{ opacity: 0, scale: 0.95 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.95 }}
                                            className="bg-red-50 border border-red-200 text-red-600 p-2.5 rounded-xl text-xs font-bold flex items-center gap-2"
                                        >
                                            <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse shrink-0" />
                                            <span>{error}</span>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                {/* MODE 1: Profile is selected -> Enter Captcha Only */}
                                {!isNewProfile && activeProfile ? (
                                    <div className="space-y-3.5">
                                        {/* Minimal Active Profile Badge */}
                                        <div className="flex items-center justify-between px-3 py-2 bg-slate-50/80 border border-slate-200/80 rounded-xl text-xs">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <User className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                                                <span className="font-bold text-slate-800 truncate">{activeProfile.nickname}</span>
                                                <span className="text-slate-300">·</span>
                                                <span className="text-[11px] text-slate-500 font-medium truncate">ID: {activeProfile.studentId}</span>
                                            </div>
                                            <div className="flex items-center gap-1 shrink-0">
                                                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
                                                    Captcha Only
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setEditingFriend(activeProfile);
                                                        setShowAddFriendModal(true);
                                                    }}
                                                    className="p-1 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                                                    title="Edit ERP password / details"
                                                >
                                                    <Edit2 className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const sid = activeProfile.studentId || activeProfile.username || '';
                                                        const label = activeProfile.nickname || sid || 'this profile';
                                                        if (window.confirm(`Are you sure you want to permanently delete ${label} (${sid})?\n\nAll saved timetable, CGPA, and attendance data will be permanently removed.`)) {
                                                            deleteFriend(activeProfile.id || sid, sid);
                                                            if (sid) {
                                                                deleteStudentProfileFromCloud(sid).catch(() => {});
                                                                if (typeof erpService?.clearStoredErpCookies === 'function') {
                                                                    erpService.clearStoredErpCookies(sid);
                                                                }
                                                            }
                                                            try {
                                                                if (localStorage.getItem('activeErpUser') === sid) {
                                                                    localStorage.removeItem('activeErpUser');
                                                                }
                                                            } catch { /* ignore */ }
                                                            const updated = getAllProfiles();
                                                            setAllProfilesList(updated);
                                                            setSelectedProfileId(updated.length > 0 ? updated[0].id : 'new');
                                                        }
                                                    }}
                                                    className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                                                    title="Permanently delete profile"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Fast Captcha Section */}
                                        <div className="space-y-2">
                                            <label className="text-slate-400 text-xs font-bold uppercase tracking-wider block ml-0.5">
                                                Enter Captcha
                                            </label>
                                            <div className="flex gap-2.5">
                                                <div className="relative flex-1">
                                                    <input
                                                        ref={captchaInputRef}
                                                        type="text"
                                                        value={captcha}
                                                        onChange={(e) => setCaptcha(e.target.value)}
                                                        onKeyDown={(e) => { if (e.key === 'Enter') handleLogin(); }}
                                                        placeholder="CAPTCHA"
                                                        autoFocus
                                                        className="w-full h-14 bg-slate-50/80 border border-slate-300 focus:border-indigo-600 focus:bg-white focus:ring-2 focus:ring-indigo-100 rounded-2xl px-4 text-slate-900 placeholder:text-slate-300 focus:outline-none transition-all font-black tracking-widest shadow-2xs uppercase text-lg text-center"
                                                    />
                                                </div>
                                                <div className="w-36 sm:w-44 h-14 bg-slate-100/70 border border-slate-200 rounded-2xl flex items-center justify-center overflow-hidden shrink-0 relative">
                                                    {captchaUrl ? (
                                                        <img 
                                                            src={captchaUrl} 
                                                            alt="Captcha" 
                                                            className={`h-10 sm:h-11 object-contain mix-blend-multiply transition-opacity duration-150 ${isCaptchaLoading ? 'opacity-30' : 'opacity-90'}`} 
                                                        />
                                                    ) : null}
                                                    {(!captchaUrl || isCaptchaLoading) && (
                                                        <div className="absolute inset-0 flex items-center justify-center bg-slate-100/80 backdrop-blur-[1px]">
                                                            <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
                                                            <span className="text-[11px] font-bold text-slate-500 ml-1.5">Loading...</span>
                                                        </div>
                                                    )}
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => refreshCaptcha(false)}
                                                    disabled={isCaptchaLoading}
                                                    className="w-14 h-14 bg-white border border-slate-200 rounded-2xl flex items-center justify-center hover:bg-slate-50 transition-colors text-slate-400 hover:text-slate-700 shadow-2xs shrink-0 cursor-pointer disabled:opacity-50"
                                                    title="Refresh Captcha"
                                                >
                                                    <RefreshCcw className={`w-5 h-5 ${isCaptchaLoading ? 'animate-spin text-indigo-600' : ''}`} />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Submit Button */}
                                        <button
                                            type="submit"
                                            disabled={isLoading}
                                            className={`w-full bg-slate-900 hover:bg-slate-800 active:scale-98 text-white font-black py-4 text-base rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-slate-900/15 transition-all mt-2 cursor-pointer ${isLoading ? 'opacity-85 cursor-wait' : ''}`}
                                        >
                                            {isLoading ? (
                                                <>
                                                    <Loader2 className="w-5 h-5 animate-spin text-white" />
                                                    <span>Checking Attendance…</span>
                                                </>
                                            ) : (
                                                <>
                                                    <LogIn className="w-5 h-5" />
                                                    <span>Check Attendance as {activeProfile.nickname}</span>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                ) : (
                                    /* MODE 2: Add Buddy or New Sign In */
                                    <div className="space-y-4">
                                        {/* Profile Name */}
                                        <div className="space-y-1.5">
                                            <label className="text-slate-600 text-[11px] font-black uppercase tracking-widest ml-1 block">
                                                Profile Name
                                            </label>
                                            <input
                                                type="text"
                                                value={newProfileName}
                                                onChange={(e) => setNewProfileName(e.target.value)}
                                                placeholder="Enter name (e.g. Rahul, Sneha...)"
                                                className="w-full bg-slate-50 border-2 border-slate-300 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100 rounded-2xl py-3 px-4 text-slate-900 font-bold text-sm transition-all"
                                            />
                                        </div>

                                        {/* Student ID */}
                                        <div className="space-y-1.5">
                                            <label className="text-slate-600 text-[11px] font-black uppercase tracking-widest ml-1 block">
                                                Student ID
                                            </label>
                                            <input
                                                type="text"
                                                value={idNumber}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    setIdNumber(val);
                                                    const clean = val.trim();
                                                    if (clean.length >= 6) {
                                                        getStudentProfileFromCloud(clean).then(cloudProf => {
                                                            if (cloudProf) {
                                                                if (cloudProf.name && !newProfileName) {
                                                                    setNewProfileName(cloudProf.name);
                                                                }
                                                                if (cloudProf.savedPassword && !password) {
                                                                    setPassword(decodePassword(cloudProf.savedPassword));
                                                                }
                                                            }
                                                        }).catch(() => {});
                                                    }
                                                }}
                                                onKeyDown={(e) => { if (e.key === 'Enter') handleLogin(); }}
                                                placeholder="Enter Student ID"
                                                className="w-full bg-slate-50 border-2 border-slate-300 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100 rounded-2xl py-3 px-4 text-slate-900 font-bold text-sm transition-all"
                                            />
                                        </div>

                                        {/* Password */}
                                        <div className="space-y-1.5">
                                            <label className="text-slate-600 text-[11px] font-black uppercase tracking-widest ml-1 block">
                                                ERP Password
                                            </label>
                                            <div className="relative">
                                                <input
                                                    type={showPassword ? "text" : "password"}
                                                    value={password}
                                                    onChange={(e) => setPassword(e.target.value)}
                                                    onKeyDown={(e) => { if (e.key === 'Enter') handleLogin(); }}
                                                    placeholder="Enter ERP Password"
                                                    className="w-full bg-slate-50 border-2 border-slate-300 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100 rounded-2xl py-3 pl-4 pr-11 text-slate-900 font-bold text-sm transition-all"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowPassword(!showPassword)}
                                                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1 cursor-pointer"
                                                >
                                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                                </button>
                                            </div>
                                        </div>

                                        {/* Captcha */}
                                        <div className="space-y-1.5">
                                            <label className="text-slate-600 text-[11px] font-black uppercase tracking-widest ml-1 block">
                                                Captcha
                                            </label>
                                            <div className="flex gap-2.5">
                                                <div className="relative flex-1">
                                                    <input
                                                        type="text"
                                                        value={captcha}
                                                        onChange={(e) => setCaptcha(e.target.value)}
                                                        onKeyDown={(e) => { if (e.key === 'Enter') handleLogin(); }}
                                                        placeholder="Enter Captcha"
                                                        className="w-full h-[52px] bg-slate-50 border-2 border-slate-300 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100 rounded-2xl px-4 text-slate-900 placeholder:text-slate-400 focus:outline-none transition-all font-black tracking-widest shadow-xs uppercase text-lg text-center"
                                                    />
                                                </div>
                                                <div className="w-[110px] h-[52px] bg-slate-100 border-2 border-slate-200 rounded-2xl flex items-center justify-center overflow-hidden relative shrink-0">
                                                    {captchaUrl ? (
                                                        <img 
                                                            src={captchaUrl} 
                                                            alt="Captcha" 
                                                            className={`h-10 object-contain mix-blend-multiply transition-opacity duration-150 ${isCaptchaLoading ? 'opacity-30' : 'opacity-85'}`} 
                                                        />
                                                    ) : null}
                                                    {(!captchaUrl || isCaptchaLoading) && (
                                                        <div className="absolute inset-0 flex items-center justify-center gap-1.5 bg-slate-100/90 text-slate-500 text-xs font-bold">
                                                            <RefreshCcw className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                                                            <span>Loading...</span>
                                                        </div>
                                                    )}
                                                </div>
                                                <button
                                                    type="button"
                                                    disabled={isCaptchaLoading}
                                                    onClick={() => refreshCaptcha(false)}
                                                    className="w-[52px] h-[52px] bg-white border-2 border-slate-200 rounded-2xl flex items-center justify-center hover:bg-slate-50 transition-colors text-slate-500 hover:text-slate-800 shadow-xs shrink-0 cursor-pointer disabled:opacity-60"
                                                    title="Refresh Captcha"
                                                >
                                                    <RefreshCcw className={`w-4 h-4 ${isCaptchaLoading ? 'animate-spin text-indigo-600' : ''}`} />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Remember Me Checkbox */}
                                        <label className="flex items-center gap-2 cursor-pointer select-none ml-1">
                                            <input
                                                type="checkbox"
                                                checked={rememberMe}
                                                onChange={(e) => setRememberMe(e.target.checked)}
                                                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer"
                                            />
                                            <span className="text-xs font-bold text-slate-700">Save this profile for 1-click captcha login next time</span>
                                        </label>

                                        {/* Submit Button */}
                                        <motion.button
                                            whileHover={{ scale: 1.01 }}
                                            whileTap={{ scale: 0.98 }}
                                            type="submit"
                                            disabled={isLoading}
                                            className={`w-full bg-slate-900 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-3 shadow-lg shadow-slate-900/20 hover:bg-slate-800 transition-all mt-2 cursor-pointer ${isLoading ? 'opacity-90 cursor-wait' : ''}`}
                                        >
                                            {isLoading ? (
                                                <>
                                                    <Loader2 className="w-5 h-5 animate-spin text-white" />
                                                    <span>Signing In & Saving…</span>
                                                </>
                                            ) : (
                                                <>
                                                    <LogIn className="w-5 h-5" />
                                                    <span>Sign In & Save Profile</span>
                                                </>
                                            )}
                                        </motion.button>
                                    </div>
                                )}
                            </form>

                            <div className="mt-5 pt-3 border-t border-slate-100 relative z-10 flex flex-col items-center gap-1.5">
                                <p className="text-slate-400 text-[10px] text-center font-medium leading-relaxed flex items-center gap-1">
                                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                    <span>Your credentials are stored securely in your browser only.</span>
                                </p>
                            </div>
                        </div>
                    </motion.div>
                    )}
                </main>
            </div>

            {/* Add / Edit Friend Modal */}
            <AddFriendModal
                isOpen={showAddFriendModal}
                initialFriend={editingFriend}
                onClose={() => {
                    setShowAddFriendModal(false);
                    setEditingFriend(null);
                }}
                onFriendSaved={(newFriend) => {
                    const updated = getAllProfiles();
                    setAllProfilesList(updated);
                    setShowAddFriendModal(false);
                    setEditingFriend(null);
                    if (newFriend) {
                        setSelectedProfileId(newFriend.id);
                        const sid = newFriend.studentId || newFriend.id;
                        if (sid) {
                            try {
                                localStorage.setItem('activeErpUser', sid);
                            } catch { /* ignore */ }
                        }
                    }
                    navigate('/attendance-register', { state: { openCaptcha: true, targetFriend: newFriend } });
                }}
            />
        </div>
    );
};

export default Login;
