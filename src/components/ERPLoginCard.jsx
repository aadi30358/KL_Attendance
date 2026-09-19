import { useState } from 'react';
import { motion } from 'framer-motion';
import { LogIn, Sparkles, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ERPLoginCard = () => {
    const navigate = useNavigate();
    const [isClicked, setIsClicked] = useState(false);

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            onClick={() => {
                setIsClicked(!isClicked);
                navigate('/login');
            }}
            className={`w-full h-full bg-[#0a0a0a] border-2 transition-colors duration-300 rounded-[2rem] sm:rounded-[2.5rem] p-5 sm:p-7 shadow-2xl relative overflow-hidden group cursor-pointer flex flex-col justify-between ${
                isClicked ? 'border-red-600' : 'border-black hover:border-red-600'
            }`}
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
                className="absolute top-7 right-7 text-yellow-500/40 pointer-events-none"
            >
                <Sparkles className="w-5 h-5" />
            </motion.div>

            <div className="relative z-10 flex flex-col justify-between h-full flex-1">
                <div>
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 rounded-xl bg-red-600/15 border border-red-500/20 shrink-0">
                            <LogIn className="w-5 h-5 sm:w-6 sm:h-6 text-red-500" />
                        </div>
                        <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">ERP Login</h2>
                    </div>

                    <p className="text-gray-400 text-xs sm:text-sm mb-4 leading-relaxed">
                        Connect to KL ERP to fetch data automatically
                    </p>

                    <ul className="space-y-2 sm:space-y-2.5 mb-5 sm:mb-6">
                        {[
                            "Securely login to university ERP",
                            "Auto-fetch attendance records",
                            "Check eligibility without manual entry"
                        ].map((item, idx) => (
                            <li key={idx} className="flex items-start gap-2.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 shrink-0" />
                                <span className="text-gray-300 text-xs sm:text-sm font-medium leading-tight">{item}</span>
                            </li>
                        ))}
                    </ul>
                </div>

                <motion.button
                    whileHover={{ scale: 1.02, backgroundColor: '#dc2626' }}
                    whileTap={{ scale: 0.98 }}
                    onClick={(e) => {
                        e.stopPropagation();
                        navigate('/login');
                    }}
                    className="w-full py-3 sm:py-3.5 bg-red-600 hover:bg-red-700 text-white text-xs sm:text-sm font-black rounded-xl sm:rounded-2xl shadow-xl shadow-red-900/30 transition-all flex items-center justify-center gap-2 mt-auto cursor-pointer"
                >
                    <span>Login to ERP</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </motion.button>
            </div>
        </motion.div>
    );
};

export default ERPLoginCard;
