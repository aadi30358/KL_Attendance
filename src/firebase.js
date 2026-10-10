import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { initializeAuth, inMemoryPersistence } from "firebase/auth";

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

// Initialize services with in-memory persistence to keep client storage (IndexedDB) 100% clean
export const db = getFirestore(app);
export const auth = initializeAuth(app, {
    persistence: inMemoryPersistence
});

export default app;
