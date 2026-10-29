import { useState, useEffect } from 'react';
import { useAuth } from '../context/useAuth';
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from '../firebase';
import { Github, Linkedin, Mail, User, CheckCircle, Save as SaveIcon } from 'lucide-react';
import { motion } from 'framer-motion';

const UserProfile = () => {
    const { currentUser, signInWithGoogle, logout } = useAuth();
    const [links, setLinks] = useState({
        github: '',
        linkedin: '',
        email: ''
    });
    const [isLoading, setIsLoading] = useState(false);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        if (currentUser) {
            const fetchProfile = async () => {
                const docSnap = await getDoc(doc(db, "users", currentUser.uid));
                if (docSnap.exists()) {
                    setLinks(docSnap.data());
                }
            };
            fetchProfile();
        }
    }, [currentUser]);

    const handleSave = async () => {
        if (!currentUser) return;
        setIsLoading(true);
        try {
            // Ensure email is always up to date from auth
            await setDoc(doc(db, "users", currentUser.uid), { ...links, email: currentUser.email }, { merge: true });
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch (e) {
            console.error("Error saving profile", e);
        }
        setIsLoading(false);
    };

    if (!currentUser) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white p-8 rounded-3xl shadow-xl text-center max-w-md w-full"
                >
                    <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6">
                        <User className="w-10 h-10 text-blue-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800 mb-2">Student Profile</h2>
                    <p className="text-slate-500 mb-8">Sign in to manage your profile and sync your data.</p>
                    <button
                        onClick={() => signInWithGoogle()}
                        className="w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-medium transition-all flex items-center justify-center gap-3 shadow-lg hover:shadow-xl"
                    >
                        <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
                        Sign in with Google
                    </button>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6">
            <div className="max-w-xl mx-auto">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden"
                >
                    {/* Header */}
                    <div className="bg-slate-900 p-8 text-center text-white relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-600 to-indigo-700 opacity-50" />
                        <div className="relative z-10">
                            <img
                                src={currentUser.photoURL}
                                alt={currentUser.displayName}
                                className="w-24 h-24 rounded-full border-4 border-white/20 mx-auto mb-4 shadow-xl"
                            />
                            <h1 className="text-2xl font-bold">{currentUser.displayName}</h1>
                            <p className="text-blue-200 text-sm">{currentUser.email}</p>
                        </div>
                    </div>

                    {/* Social Links Form */}
                    <div className="p-8 space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                                <Github className="w-4 h-4" /> GitHub Profile
                            </label>
                            <input
                                type="text"
                                value={links.github}
                                onChange={(e) => setLinks({ ...links, github: e.target.value })}
                                placeholder="https://github.com/username"
                                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                                <Linkedin className="w-4 h-4" /> LinkedIn Profile
                            </label>
                            <input
                                type="text"
                                value={links.linkedin}
                                onChange={(e) => setLinks({ ...links, linkedin: e.target.value })}
                                placeholder="https://linkedin.com/in/username"
                                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>

                        <button
                            onClick={handleSave}
                            disabled={isLoading}
                            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2"
                        >
                            {isLoading ? 'Saving...' : (saved ? <> <CheckCircle className="w-5 h-5" /> Saved! </> : <> <SaveIcon className="w-5 h-5" /> Save Profile </>)}
                        </button>
                    </div>

                    {/* Footer Feature as requested */}
                    <div className="bg-[#8B0000] p-4 flex justify-around items-center text-white">
                        <a href={links.github} target="_blank" rel="noopener noreferrer" className="hover:opacity-80 transition-opacity">
                            <Github className="w-6 h-6" />
                        </a>
                        <a href={links.linkedin} target="_blank" rel="noopener noreferrer" className="hover:opacity-80 transition-opacity">
                            <Linkedin className="w-6 h-6" />
                        </a>
                        <a href={`mailto:${currentUser.email || links.email}`} className="hover:opacity-80 transition-opacity">
                            <Mail className="w-6 h-6" />
                        </a>
                        <div className="hover:opacity-80 transition-opacity cursor-pointer">
                            <User className="w-6 h-6" />
                        </div>
                    </div>
                </motion.div>

                <div className="text-center mt-6">
                    <button onClick={logout} className="text-slate-400 hover:text-red-500 text-sm font-medium">
                        Sign Out
                    </button>
                </div>
            </div>
        </div>
    );
};

export default UserProfile;
