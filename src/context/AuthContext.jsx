import { useState, useEffect } from "react";
import { onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { auth } from "../firebase";
import { AuthContext } from "./useAuth";
import { erpService } from "../services/erpService";

export function AuthProvider({ children }) {
    const [currentUser, setCurrentUser] = useState(() => auth.currentUser || null);
    const [erpUser, setErpUser] = useState(() => {
        try {
            const active = localStorage.getItem('activeErpUser');
            const html = localStorage.getItem('erpDashboardHtml');
            if (active && html && !html.includes('site-error') && !html.includes('id="login-form"')) {
                return active;
            }
            return null;
        } catch {
            return null;
        }
    });
    const [loading, setLoading] = useState(() => !auth.currentUser);

    // Sign in with Google
    function signInWithGoogle() {
        const provider = new GoogleAuthProvider();
        return signInWithPopup(auth, provider);
    }

    // Comprehensive synchronous and async logout: Ends active session, preserves saved data
    async function logout(studentId = null) {
        const targetId = studentId || erpUser || localStorage.getItem('activeErpUser') || localStorage.getItem('rememberedId') || '';
        
        try {
            if (targetId) {
                fetch(`/api/user-data/${encodeURIComponent(targetId)}/logout`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                }).catch(() => null);
            }
        } catch { /* ignore */ }

        try {
            if (typeof erpService?.clearStoredErpCookies === 'function') {
                erpService.clearStoredErpCookies();
            }
        } catch (e) {
            console.warn("[Auth] Cookie cleanup:", e);
        }

        // Clear active ERP session data
        sessionStorage.removeItem('adminLoggedOut');
        sessionStorage.removeItem('erp_authenticated');
        sessionStorage.removeItem('admin_token');
        sessionStorage.removeItem('manual_sem_reset');
        if (targetId) {
            sessionStorage.removeItem(`erp_verified_${targetId}`);
        }

        // Clear in-memory / session credentials while preserving saved timetable, CGPA, and attendance
        localStorage.removeItem('erpDashboardHtml');
        localStorage.removeItem('sessionCookie');
        localStorage.removeItem('isAdminAuthenticated');

        // Notify app components that live ERP session ended while preserving saved records
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('kl_active_profile_updated'));
            window.dispatchEvent(new CustomEvent('kl_friends_updated'));
            window.dispatchEvent(new Event('storage'));
        }

        // Sign out Firebase Auth cleanly if active
        try {
            if (auth.currentUser) {
                await signOut(auth);
            }
        } catch (err) {
            console.warn("[Auth] SignOut error notice:", err);
        }
    }

    // ERP Account Disconnect or Complete Data Deletion
    async function disconnectErpAccount(studentId = null, deleteData = true) {
        const targetId = studentId || erpUser || localStorage.getItem('activeErpUser') || localStorage.getItem('rememberedId') || '';

        try {
            if (targetId) {
                await fetch(`/api/user-data/${encodeURIComponent(targetId)}/disconnect`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ deleteData })
                }).catch(() => null);
            }
        } catch { /* ignore */ }

        if (deleteData && targetId) {
            try {
                const keysToRemove = [];
                for (let i = 0; i < localStorage.length; i++) {
                    const k = localStorage.key(i);
                    if (k && (k.includes(targetId) || k.startsWith('kl_timetable_') || k.startsWith('kl_grades_') || k.startsWith('cgpa_') || k.startsWith('kleData_'))) {
                        keysToRemove.push(k);
                    }
                }
                keysToRemove.forEach(k => localStorage.removeItem(k));
                localStorage.removeItem('original_my_id');
                localStorage.removeItem('rememberedId');
                localStorage.removeItem('activeErpUser');
                localStorage.removeItem('userProfile');
                localStorage.removeItem('kleData');
                localStorage.removeItem('cgpa_data');
                localStorage.removeItem('grades');
            } catch { /* ignore */ }
        }

        setErpUser(null);
        setCurrentUser(null);
        await logout(targetId);
    }

    useEffect(() => {
        // Safety timer ensures instant UI display (50ms max)
        const timer = setTimeout(() => {
            setLoading(false);
        }, 50);

        const unsubscribe = onAuthStateChanged(auth, (user) => {
            clearTimeout(timer);
            setCurrentUser(user);
            setLoading(false);
        }, (err) => {
            clearTimeout(timer);
            console.warn("[Auth] Auth state error:", err);
            setLoading(false);
        });

        return () => {
            unsubscribe();
            clearTimeout(timer);
        };
    }, []);

    const value = {
        currentUser,
        erpUser,
        setErpUser,
        signInWithGoogle,
        logout,
        disconnectErpAccount,
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
}
