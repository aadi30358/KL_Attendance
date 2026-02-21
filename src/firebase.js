import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
    apiKey: "AIzaSyCrIvwPCEETzRJFMzRNZaifzJfMroSvg08",
    authDomain: "kl-attendance-e0e7a.firebaseapp.com",
    projectId: "kl-attendance-e0e7a",
    storageBucket: "kl-attendance-e0e7a.firebasestorage.app",
    messagingSenderId: "706848587164",
    appId: "1:706848587164:web:5c9b812af063f098085c59",
    measurementId: "G-3RHZ6FT8RM"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
export const db = getFirestore(app);
export const auth = getAuth(app);

export default app;
