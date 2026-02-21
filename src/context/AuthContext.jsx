import { useState, useEffect } from "react";
import { onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { auth } from "../firebase";
import { AuthContext } from "./useAuth";
import { erpService } from "../services/erpService";

export function AuthProvider({ children }) {
    const [currentUser, setCurrentUser] = useState(null);
    const [erpUser, setErpUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // Sign in with Google
    function signInWithGoogle() {
        const provider = new GoogleAuthProvider();
        return signInWithPopup(auth, provider);
    }

    // Logout
    async function logout() {
        // First tell the ERP backend to destroy the actual session cookie
        await erpService.erpLogout();

        // Aggressively clear all ERP session data so no old user data persists 
        // to a newly logged-in user!
        localStorage.removeItem('activeErpUser');
        localStorage.removeItem('erpDashboardHtml');
        localStorage.removeItem('kleData');
        localStorage.removeItem('userUniversity');
        localStorage.removeItem('userProfile');
        localStorage.removeItem('sessionCookie');
        localStorage.removeItem('rememberedId');

        setErpUser(null);
        return signOut(auth);
    }

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setCurrentUser(user);

            // Hydrate ERP user from localStorage if exists
            const savedErpUser = localStorage.getItem('activeErpUser');
            if (savedErpUser) {
                setErpUser(savedErpUser);
            }

            setLoading(false);
        });

        return unsubscribe;
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
