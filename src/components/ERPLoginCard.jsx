import { motion } from 'framer-motion';
import { LogIn, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ERPLoginCard = () => {
    const navigate = useNavigate();

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="w-full max-w-sm bg-[#0a0a0a] border border-red-900/30 rounded-[2rem] p-8 shadow-2xl relative overflow-hidden group"
        >
            {/* Ambient Red Glow */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-red-600/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-red-600/20 transition-colors" />

            {/* Sparkles Decoration */}
            <motion.div
                animate={{
                    scale: [1, 1.2, 1],
                    opacity: [0.3, 0.6, 0.3],
                    rotate: [0, 45, 0]
                }}
                transition={{ duration: 4, repeat: Infinity }}
                className="absolute top-10 right-10 text-yellow-500/40"
            >
                <Sparkles className="w-6 h-6" />
            </motion.div>

            <motion.div
                animate={{
                    y: [0, -10, 0],
                    opacity: [0.2, 0.4, 0.2]
                }}
                transition={{ duration: 3, repeat: Infinity, delay: 1 }}
                className="absolute bottom-20 left-1/2 text-yellow-500/30"
            >
                <Sparkles className="w-4 h-4" />
            </motion.div>

            <div className="relative z-10">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 rounded-lg bg-red-600/10">
                        <LogIn className="w-6 h-6 text-red-500" />
                    </div>
                    <h2 className="text-2xl font-black text-white tracking-tight">ERP Login</h2>
                </div>

                <p className="text-gray-400 text-sm mb-8 leading-relaxed">
                    Connect to KL ERP to fetch data automatically
                </p>

                <ul className="space-y-4 mb-10">
                    {[
                        "Securely login to university ERP",
                        "Auto-fetch attendance and timetable",
                        "Check eligibility without manual entry"
                    ].map((item, idx) => (
                        <li key={idx} className="flex items-start gap-3">
                            <div className="w-1.5 h-1.5 rounded-full bg-red-500 mt-2 shrink-0" />
                            <span className="text-gray-300 text-sm font-medium leading-tight">{item}</span>
                        </li>
                    ))}
                </ul>

                <motion.button
                    whileHover={{ scale: 1.02, backgroundColor: '#dc2626' }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => navigate('/login')}
                    className="w-full py-4 bg-red-600 text-white font-black rounded-2xl shadow-xl shadow-red-900/20 transition-all"
                >
                    Login to ERP
                </motion.button>
            </div>
        </motion.div>
    );
};

export default ERPLoginCard;
