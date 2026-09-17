import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";

const firebaseConfig = {
    apiKey: "AIzaSyD43vdxh1aaOQryt1eFLIWUrrzdEAJYapk",
    authDomain: "klattendancecalculator.firebaseapp.com",
    projectId: "klattendancecalculator",
    storageBucket: "klattendancecalculator.firebasestorage.app",
    messagingSenderId: "520615716740",
    appId: "1:520615716740:web:3bf3428fd57027d3b45fd1",
    measurementId: "G-P1KQRTN2GM"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
export const db = getFirestore(app);
export const auth = getAuth(app);

// Sign in anonymously if enabled in Firebase Console (Authentication > Sign-in method > Anonymous)
signInAnonymously(auth).catch(err => {
    if (err.code === 'auth/configuration-not-found' || err.code === 'auth/admin-restricted-operation') {
        // Safe fallback if Anonymous sign-in provider is disabled in Firebase Console
        console.warn("Firebase Anonymous Auth is not enabled in Firebase Console (Authentication > Sign-in method > Anonymous). Continuing in guest mode.");
    } else {
        console.warn("Firebase Anonymous Auth notice:", err.message || err);
    }
});

export default app;
