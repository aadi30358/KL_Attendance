import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Upload, FileText, CheckCircle, AlertCircle, LogOut, Trash2 } from 'lucide-react';

import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from '../firebase';
import { useAuth } from '../context/useAuth';

const AdminDashboard = () => {
    const { currentUser } = useAuth();
    const isGoogleAdmin = currentUser?.email === 'yaswanthadithyareddy11@gmail.com';
    const [isLocalAdmin, setIsLocalAdmin] = useState(() => localStorage.getItem('isAdminAuthenticated') === 'true');
    const isAuthenticated = isGoogleAdmin || isLocalAdmin;

    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [selectedFile, setSelectedFile] = useState(null);
    const [uploadStatus, setUploadStatus] = useState(''); // 'uploading', 'success', 'error'
    const [announcement, setAnnouncement] = useState('');
    const [ltpsWeights, setLtpsWeights] = useState({
        lecture: 100,
        tutorial: 25,
        practical: 50,
        skilling: 25
    });

    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const announceSnap = await getDoc(doc(db, "config", "global"));
                if (announceSnap.exists() && announceSnap.data().announcement) {
                    setAnnouncement(announceSnap.data().announcement);
                }

                const weightsSnap = await getDoc(doc(db, "config", "weights"));
                if (weightsSnap.exists()) {
                    setLtpsWeights(weightsSnap.data());
                }
            } catch (err) {
                console.error("Error fetching config:", err);
            }
        };
        fetchConfig();
    }, []);

    const handleLogin = (e) => {
        e.preventDefault();
        if (username === 'aadi' && password === 'adithya3130') {
            setIsLocalAdmin(true);
            localStorage.setItem('isAdminAuthenticated', 'true');
            setError('');
        } else {
            setError('Invalid username or password');
        }
    };

    const handleLogout = () => {
        setIsLocalAdmin(false);
        localStorage.removeItem('isAdminAuthenticated');
        setUsername('');
        setPassword('');
    };

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            if (file.type === 'application/pdf' && file.size <= 5 * 1024 * 1024) {
                setSelectedFile(file);
                setUploadStatus('');
                setError('');
            } else {
                setSelectedFile(null);
                setError('Please upload a PDF file smaller than 5MB.');
            }
        }
    };

    const handleUpload = async () => {
        if (!selectedFile) {
            setError('No file selected for upload.');
            return;
        }

        setUploadStatus('uploading');
        setError('');

        try {
            await new Promise(resolve => setTimeout(resolve, 1500));
            localStorage.setItem('academic_calendar_pdf', 'uploaded_file_data_or_url');
            setUploadStatus('success');
            setSelectedFile(null);
        } catch {
            setError('Failed to upload calendar. Please try again.');
            setUploadStatus('error');
        }
    };

    const handleResetCalendar = () => {
        localStorage.removeItem('academic_calendar_pdf');
        setSelectedFile(null);
        setUploadStatus('');
        setError('Calendar reset to default (if any).');
    };

    const handleSaveAnnouncement = async () => {
        try {
            await setDoc(doc(db, "config", "global"), { announcement }, { merge: true });
            alert('Announcement updated successfully!');
        } catch (e) {
            console.error(e);
            alert('Failed to save announcement');
        }
    };

    const handleSaveWeights = async () => {
        try {
            await setDoc(doc(db, "config", "weights"), ltpsWeights);
            alert('Calculation weights updated successfully!');
        } catch (e) {
            console.error(e);
            alert('Failed to save weights');
        }
    };

    const handleWeightChange = (key, value) => {
        setLtpsWeights(prev => ({
            ...prev,
            [key]: parseFloat(value) || 0
        }));
    };

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-600" />
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-white p-10 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.05)] border border-slate-100 w-full max-w-md relative z-10"
                >
                    <div className="text-center mb-10">
                        <div className="w-20 h-20 bg-blue-50 rounded-[2rem] flex items-center justify-center mx-auto mb-6">
                            <Lock className="w-10 h-10 text-blue-600" />
                        </div>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Admin Access</h1>
                        <p className="text-slate-400 font-medium mt-3">Enter your credentials to manage the website</p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-8" autoComplete="off">
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Login ID</label>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:ring-4 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all font-bold text-slate-700 placeholder:text-slate-300"
                                placeholder="Enter Login ID"
                                autoComplete="off"
                            />
                        </div>
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Password</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:ring-4 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all font-bold text-slate-700 placeholder:text-slate-300"
                                placeholder="Enter password"
                                autoComplete="new-password"
                            />
                        </div>

                        {error && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="text-red-500 text-xs font-black flex items-center gap-2 bg-red-50 p-4 rounded-xl border border-red-100"
                            >
                                <AlertCircle className="w-4 h-4 shrink-0" />
                                {error}
                            </motion.div>
                        )}

                        <button
                            type="submit"
                            className="w-full bg-[#2563EB] hover:bg-blue-700 text-white font-black py-5 rounded-[2rem] transition-all shadow-xl shadow-blue-200 hover:scale-[1.02] active:scale-[0.98]"
                        >
                            Login
                        </button>
                    </form>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-100 p-6">
            <div className="max-w-4xl mx-auto space-y-8">
                <div className="flex justify-between items-center">
                    <h1 className="text-3xl font-bold text-slate-900">Admin Dashboard</h1>
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-red-50 hover:text-red-600 transition-colors"
                    >
                        <LogOut className="w-4 h-4" /> Logout
                    </button>
                </div>

                <div className="grid md:grid-cols-2 gap-6">

                    {/* 1. Academic Calendar Management */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6"
                    >
                        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2 mb-4">
                            <FileText className="w-6 h-6 text-blue-600" />
                            Academic Calendar
                        </h2>

                        <div className="space-y-4">
                            <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center hover:border-blue-400 transition-colors bg-slate-50/50">
                                <input
                                    type="file"
                                    id="calendar-upload"
                                    accept="application/pdf"
                                    onChange={handleFileChange}
                                    className="hidden"
                                />
                                <label
                                    htmlFor="calendar-upload"
                                    className="cursor-pointer flex flex-col items-center gap-2"
                                >
                                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                                        <Upload className="w-6 h-6 text-blue-600" />
                                    </div>
                                    <span className="text-blue-600 font-medium">Upload PDF</span>
                                    <span className="text-xs text-slate-400">{selectedFile ? selectedFile.name : 'Max 5MB'}</span>
                                </label>
                            </div>

                            <AnimatePresence>
                                {selectedFile && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="bg-blue-50 p-3 rounded-lg flex items-center justify-between text-sm"
                                    >
                                        <div className="flex items-center gap-2">
                                            <FileText className="w-4 h-4 text-blue-600" />
                                            <span className="font-medium text-slate-700">{selectedFile.name}</span>
                                        </div>
                                        <button
                                            onClick={() => setSelectedFile(null)}
                                            className="text-slate-400 hover:text-red-500"
                                        >
                                            x
                                        </button>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <div className="flex gap-2">
                                <button
                                    onClick={handleUpload}
                                    disabled={!selectedFile || uploadStatus === 'uploading'}
                                    className={`flex-1 py-2 rounded-lg font-medium text-sm transition-colors ${!selectedFile
                                        ? 'bg-slate-100 text-slate-400'
                                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                                        }`}
                                >
                                    {uploadStatus === 'uploading' ? '...' : 'Update'}
                                </button>
                                <button
                                    onClick={handleResetCalendar}
                                    className="px-3 py-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>

                            <AnimatePresence>
                                {uploadStatus === 'success' && (
                                    <motion.p
                                        initial={{ opacity: 0, y: 5 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0 }}
                                        className="text-xs text-green-600 flex items-center gap-1"
                                    >
                                        <CheckCircle className="w-3 h-3" /> Updated!
                                    </motion.p>
                                )}
                                {error && uploadStatus === 'error' && (
                                    <motion.p
                                        initial={{ opacity: 0, y: 5 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0 }}
                                        className="text-xs text-red-600 flex items-center gap-1"
                                    >
                                        <AlertCircle className="w-3 h-3" /> {error}
                                    </motion.p>
                                )}
                            </AnimatePresence>
                        </div>
                    </motion.div>

                    {/* 2. Site Announcement */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6"
                    >
                        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2 mb-4">
                            <AlertCircle className="w-6 h-6 text-yellow-500" />
                            Global Announcement
                        </h2>
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-semibold text-slate-500 uppercase">Banner Text</label>
                                <textarea
                                    value={announcement}
                                    onChange={(e) => setAnnouncement(e.target.value)}
                                    placeholder="Enter urgent updates here..."
                                    className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none h-32 resize-none"
                                />
                            </div>
                            <button
                                onClick={handleSaveAnnouncement}
                                className="w-full py-2 bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800 transition-colors text-sm"
                            >
                                Save Announcement
                            </button>
                        </div>
                    </motion.div>

                    {/* 3. LTPS Weights Configuration */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:col-span-2"
                    >
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                <CheckCircle className="w-6 h-6 text-purple-600" />
                                L-T-P-S Calculation Weights
                            </h2>
                            <button
                                onClick={() => {
                                    setLtpsWeights({ lecture: 100, tutorial: 25, practical: 50, skilling: 25 });
                                }}
                                className="text-xs text-slate-500 hover:text-red-500 underline"
                            >
                                Reset to Default
                            </button>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {Object.entries(ltpsWeights).map(([key, val]) => (
                                <div key={key}>
                                    <label className="text-xs font-bold text-slate-500 uppercase block mb-1">{key}</label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            value={val}
                                            onChange={(e) => handleWeightChange(key, e.target.value)}
                                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-lg font-bold text-slate-800 focus:ring-2 focus:ring-purple-500 outline-none"
                                        />
                                        <span className="absolute right-3 top-2.5 text-slate-400 text-sm">%</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="mt-6">
                            <button
                                onClick={handleSaveWeights}
                                className="w-full sm:w-auto px-6 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors text-sm"
                            >
                                Update Logic
                            </button>
                        </div>
                    </motion.div>

                </div>


            </div>
        </div>
    );
};

export default AdminDashboard;
