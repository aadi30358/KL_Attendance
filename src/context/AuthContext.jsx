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

    // Comprehensive synchronous and async logout
    async function logout() {
        try {
            if (typeof erpService?.clearStoredErpCookies === 'function') {
                erpService.clearStoredErpCookies();
            }
        } catch (e) {
            console.warn("[Auth] Cookie cleanup:", e);
        }

        // Aggressively clear all ERP session data synchronously
        sessionStorage.setItem('adminLoggedOut', 'true');
        sessionStorage.removeItem('erp_authenticated');
        sessionStorage.removeItem('admin_token');
        sessionStorage.removeItem('manual_sem_reset');

        localStorage.removeItem('activeErpUser');
        localStorage.removeItem('erpDashboardHtml');
        localStorage.removeItem('kleData');
        localStorage.removeItem('userUniversity');
        localStorage.removeItem('userProfile');
        localStorage.removeItem('sessionCookie');
        localStorage.removeItem('isAdminAuthenticated');
        localStorage.removeItem('admin_token');

        try {
            Object.keys(localStorage).forEach(key => {
                if (key.startsWith('kleData_') || key.startsWith('attendance_')) {
                    localStorage.removeItem(key);
                }
            });
        } catch {
            // ignore
        }

        setErpUser(null);
        setCurrentUser(null);

        // Sign out Firebase Auth cleanly
        try {
            await signOut(auth);
        } catch (err) {
            console.warn("[Auth] SignOut error notice:", err);
        }
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
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
}
