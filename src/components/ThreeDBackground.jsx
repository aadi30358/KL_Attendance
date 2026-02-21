import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';

const ThreeDBackground = () => {
    // Generate a stable set of random stars
    const [stars] = useState(() => {
        return [...Array(80)].map((_, i) => ({
            id: i,
            size: Math.random() * 2 + 1,
            top: `${Math.random() * 100}%`,
            left: `${Math.random() * 100}%`,
            duration: 5 + Math.random() * 5,
            delay: Math.random() * 5,
            opacity: Math.random() * 0.3 + 0.1,
            z: Math.random() * 400 - 200
        }));
    });

    // Highly Animated Floating Blobs
    const blobs = useMemo(() => {
        return [
            { id: 1, color: "bg-indigo-400/30", size: "w-[50rem] h-[50rem]", x: [0, 100, -100, 0], y: [0, -50, 50, 0], duration: 25 },
            { id: 2, color: "bg-purple-300/20", size: "w-[40rem] h-[40rem]", x: [0, -80, 80, 0], y: [0, 100, -100, 0], duration: 30 },
            { id: 3, color: "bg-pink-200/20", size: "w-[35rem] h-[35rem]", x: [0, 50, 50, 0], y: [0, -80, 80, 0], duration: 20 },
            { id: 4, color: "bg-blue-300/20", size: "w-[45rem] h-[45rem]", x: [0, -100, -100, 0], y: [0, 50, -50, 0], duration: 35 },
        ];
    }, []);

    return (
        <div className="fixed inset-0 z-[-1] overflow-hidden bg-slate-50 perspective-2000 pointer-events-none">
            {/* The Base Layer */}
            <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-slate-100" />

            {/* All Animated Blobs */}
            {blobs.map(blob => (
                <motion.div
                    key={blob.id}
                    animate={{
                        x: blob.x,
                        y: blob.y,
                        scale: [1, 1.2, 0.9, 1],
                        rotate: [0, 180, 360],
                    }}
                    transition={{
                        duration: blob.duration,
                        repeat: Infinity,
                        ease: "easeInOut"
                    }}
                    className={`absolute rounded-full blur-[100px] ${blob.color} ${blob.size} opacity-40`}
                    style={{
                        top: `${20 + (blob.id * 15)}%`,
                        left: `${10 + (blob.id * 20)}%`,
                        transformStyle: 'preserve-3d'
                    }}
                />
            ))}

            {/* Floating 3D Starfield */}
            <div className="absolute inset-0 preserve-3d">
                {stars.map(star => (
                    <motion.div
                        key={star.id}
                        initial={{ opacity: 0 }}
                        animate={{
                            opacity: [0, star.opacity, 0],
                            z: [star.z, star.z + 100],
                            y: [0, -20]
                        }}
                        transition={{
                            duration: star.duration,
                            repeat: Infinity,
                            delay: star.delay,
                            ease: "linear"
                        }}
                        className="absolute bg-indigo-300 rounded-full"
                        style={{
                            width: star.size,
                            height: star.size,
                            top: star.top,
                            left: star.left,
                        }}
                    />
                ))}
            </div>

            {/* Grainy Texture */}
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.04] mix-blend-overlay" />
        </div>
    );
};

export default ThreeDBackground;
