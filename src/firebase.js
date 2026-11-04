import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { initializeAuth, browserLocalPersistence, indexedDBLocalPersistence, inMemoryPersistence } from "firebase/auth";

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

// Initialize Firestore - works across normal, private & incognito tabs
export const db = getFirestore(app);

// Initialize Auth with multi-environment persistence (browserLocal -> indexedDB -> inMemory fallback)
let authInstance;
try {
    authInstance = initializeAuth(app, {
        persistence: [browserLocalPersistence, indexedDBLocalPersistence, inMemoryPersistence]
    });
} catch {
    try {
        authInstance = initializeAuth(app, {
            persistence: inMemoryPersistence
        });
    } catch {
        // Fallback if already initialized
    }
}
export const auth = authInstance;

export default app;
