import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const firebaseConfig = {
    apiKey: "AIzaSyD43vdxh1aaOQryt1eFLIWUrrzdEAJYapk",
    authDomain: "klattendancecalculator.firebaseapp.com",
    projectId: "klattendancecalculator",
    storageBucket: "klattendancecalculator.firebasestorage.app",
    messagingSenderId: "520615716740",
    appId: "1:520615716740:web:3bf3428fd57027d3b45fd1",
    measurementId: "G-P1KQRTN2GM"
};

async function syncDeployment() {
    try {
        const versionPath = path.resolve(__dirname, '../dist/version.json');
        let versionData = { version: Date.now(), buildTime: new Date().toISOString() };
        if (fs.existsSync(versionPath)) {
            versionData = JSON.parse(fs.readFileSync(versionPath, 'utf8'));
        }

        const app = initializeApp(firebaseConfig);
        const db = getFirestore(app);

        const writePromises = Promise.all([
            setDoc(doc(db, 'config', 'deployment'), {
                version: Number(versionData.version),
                buildTime: versionData.buildTime,
                deployedAt: new Date().toISOString()
            }, { merge: true }),
            setDoc(doc(db, 'config', 'sync'), {
                type: 'DEPLOYMENT_EVENT',
                data: versionData,
                timestamp: Date.now()
            }, { merge: true })
        ]);

        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Firestore sync timed out after 3s (continuing with deployment)')), 3000)
        );

        await Promise.race([writePromises, timeoutPromise]);

        console.log('✓ Deployment version successfully registered in Firestore for 0ms cross-domain sync:', versionData.version);
        process.exit(0);
    } catch (err) {
        console.warn('Deployment doc registration note (continuing build):', err.message);
        process.exit(0);
    }
}

syncDeployment();
