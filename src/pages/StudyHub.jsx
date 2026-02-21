import { useState, useEffect, useRef, useCallback } from 'react';
import { FileText, Copy, Check, Send, Bot, User, Loader2, GraduationCap, BrainCircuit, MessageSquare, Sparkles, BookOpen } from 'lucide-react';
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { APP_CONFIG } from '../config';

const SYSTEM_PROMPT_SUMMARIZER = `
You are an advanced AI-powered academic synthesizer. Your goal is to transform lecture notes into high-impact study materials.

**INSTRUCTIONS:**
1. **Analyze** the input text for key academic concepts, theories, and arguments.
2. **Synthesize** the information into a structured summary.
3. **Format** the output using strict Markdown for readability.

**OUTPUT STRUCTURE:**
# 📑 Executive Summary
> A concise 2-3 sentence overview of the core topic.

## 🗝️ Key Concepts & Definitions
- **Concept Name**: Definition and context.
- **Concept Name**: Definition and context.

## 🧠 Core Principles & Theories
- Detailed explanation of major theories or mechanisms mentioned.
- Connect ideas logically.

## 🚨 Critical Takeaways
- Important points likely to appear in exams.
- Essential conclusions.

**RULES:**
- Maintain academic tone but ensure clarity.
- Do not oversimplify complex ideas; explain them.
- If the input is too short, provide a brief expansion on the topic if possible.
`;

const SYSTEM_PROMPT_TUTOR = `
You are a friendly yet highly knowledgeable AI University Tutor.
- **Goal**: Help students understand complex topics, solve problems, and prepare for exams.
- **Style**: Socratic method (ask guiding questions) mixed with direct explanations.
- **Tone**: Encouraging, Patient, Intellectual.
- **Format**: Use Markdown for code snippets or math formulas.
- **Context**: The student is likely viewing this in the 'Study Hub', so they are focused on learning.
`;

// --- Simple 3D Card Component ---
const ThreeDCard = ({ children, className }) => {
    const x = useMotionValue(0);
    const y = useMotionValue(0);
    const mouseXSpring = useSpring(x);
    const mouseYSpring = useSpring(y);
    const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["5deg", "-5deg"]);
    const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-5deg", "5deg"]);

    const handleMouseMove = (e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        x.set(mouseX / width - 0.5);
        y.set(mouseY / height - 0.5);
    };

    return (
        <motion.div
            onMouseMove={handleMouseMove}
            onMouseLeave={() => { x.set(0); y.set(0); }}
            style={{ rotateY, rotateX, transformStyle: "preserve-3d" }}
            className={`transition-all duration-200 ease-out ${className}`}
        >
            <div style={{ transform: "translateZ(20px)" }}>{children}</div>
        </motion.div>
    );
};

export default function StudyHub() {
    // --- Shared AI Helper ---
    const generateGeminiResponse = useCallback(async (prompt, systemContext) => {
        try {
            const apiBase = APP_CONFIG.API_URL || "";
            const response = await fetch(`${apiBase}/api/ai/gemini`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ role: "user", parts: [{ text: prompt }] }],
                    systemInstruction: systemContext,
                    model: "gemini-1.5-pro"
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "AI Proxy Error");
            }

            const data = await response.json();
            return data.text;

        } catch (error) {
            // Keep error logging generic for security
            throw new Error("AI Connection Failed. Please try again later.");
        }
    }, []);

    // --- Summarizer State ---
    const [notesInput, setNotesInput] = useState("");
    const [summaryOutput, setSummaryOutput] = useState("");
    const [isSummarizing, setIsSummarizing] = useState(false);
    const [copySuccess, setCopySuccess] = useState(false);

    const handleSummarize = async () => {
        if (!notesInput.trim()) return;
        setIsSummarizing(true);
        setSummaryOutput("");
        try {
            const result = await generateGeminiResponse(notesInput, SYSTEM_PROMPT_SUMMARIZER);
            setSummaryOutput(result);
        } catch (err) {
            setSummaryOutput(`### ⚠️ Error\n${err.message}. Please check your internet connection or API key.`);
        } finally {
            setIsSummarizing(false);
        }
    };

    const handleCopy = () => {
        if (!summaryOutput) return;
        navigator.clipboard.writeText(summaryOutput);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
    };

    // --- AI Tutor State ---
    const [tutorInput, setTutorInput] = useState("");
    const [tutorMessages, setTutorMessages] = useState([
        { id: 1, text: "Hello! I'm your AI Tutor. Paste a question or a topic you're struggling with, and let's break it down together.", sender: 'bot' }
    ]);
    const [isTutorThinking, setIsTutorThinking] = useState(false);
    const tutorScrollRef = useRef(null);

    useEffect(() => {
        if (tutorScrollRef.current) {
            tutorScrollRef.current.scrollTop = tutorScrollRef.current.scrollHeight;
        }
    }, [tutorMessages]);

    const handleTutorAsk = async () => {
        if (!tutorInput.trim()) return;
        const userMsg = { id: Date.now(), text: tutorInput, sender: 'user' };
        setTutorMessages(prev => [...prev, userMsg]);
        setTutorInput("");
        setIsTutorThinking(true);

        try {
            const result = await generateGeminiResponse(userMsg.text, SYSTEM_PROMPT_TUTOR);
            setTutorMessages(prev => [...prev, { id: Date.now() + 1, text: result, sender: 'bot' }]);
        } catch {
            setTutorMessages(prev => [...prev, { id: Date.now() + 1, text: "I'm having trouble connecting right now. Please try again.", sender: 'bot' }]);
        } finally {
            setIsTutorThinking(false);
        }
    };

    return (
        <div className="relative min-h-screen bg-[#FAFAFA] overflow-hidden selection:bg-indigo-500 selection:text-white perspective-root-lg">
            {/* --- Advanced Ambient Background --- */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-slate-50 to-white opacity-80" />
                <motion.div
                    animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3], rotate: [0, 45, 0] }}
                    transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                    className="absolute -top-[20%] -left-[10%] w-[70vw] h-[70vw] rounded-full bg-amber-100/40 blur-[120px]"
                />
                <motion.div
                    animate={{ x: [0, 50, 0], opacity: [0.2, 0.4, 0.2] }}
                    transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute top-[40%] -right-[20%] w-[60vw] h-[60vw] rounded-full bg-indigo-100/40 blur-[120px]"
                />
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-overlay" />
            </div>

            <div className="relative z-10 max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8">

                {/* Header */}
                <motion.header
                    className="mb-12 text-center sm:text-left"
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8 }}
                >
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-slate-200 shadow-sm mb-4">
                        <Sparkles className="w-4 h-4 text-amber-500 animate-spin-slow" />
                        <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">AI Powered V2.0</span>
                    </div>
                    <h1 className="text-5xl sm:text-6xl font-black text-slate-900 tracking-tight flex flex-col sm:flex-row items-center gap-3 justify-center sm:justify-start">
                        <span className="relative inline-block">
                            Study Hub
                            <GraduationCap className="hidden sm:block absolute -top-8 -right-8 w-12 h-12 text-slate-200 rotate-12" />
                        </span>
                    </h1>
                    <p className="text-slate-500 mt-4 text-xl max-w-2xl font-medium leading-relaxed">
                        Your intelligent academic companion. Summarize notes instantly or chat with your personal 24/7 tutor.
                    </p>
                </motion.header>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 perspective-1000">

                    {/* 1. Smart Notes & Summarizer */}
                    <ThreeDCard className="h-full">
                        <div className="h-full bg-white/80 backdrop-blur-xl rounded-[2.5rem] shadow-2xl shadow-amber-100/50 border border-white/60 flex flex-col overflow-hidden group hover:shadow-amber-200/50 transition-shadow duration-300">
                            <div className="relative p-8 pb-0">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-amber-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 opacity-50 pointer-events-none" />
                                <div className="relative z-10 flex items-center gap-4 mb-2">
                                    <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-200">
                                        <FileText className="w-6 h-6 text-white" />
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-bold text-slate-900">Notes Synthesizer</h2>
                                        <p className="text-slate-400 text-sm font-bold uppercase tracking-wider">AI Summarization Model</p>
                                    </div>
                                </div>
                            </div>

                            <div className="p-8 flex-1 flex flex-col gap-6 relative z-10">
                                <div className="relative group/textarea">
                                    <div className="absolute inset-0 bg-gradient-to-r from-amber-200 to-orange-200 rounded-2xl blur opacity-20 group-hover/textarea:opacity-30 transition-opacity" />
                                    <textarea
                                        value={notesInput}
                                        onChange={(e) => setNotesInput(e.target.value)}
                                        className="relative w-full h-56 p-6 border border-amber-100 rounded-2xl focus:ring-4 focus:ring-amber-50 focus:border-amber-300 resize-none text-slate-700 bg-white/90 placeholder:text-slate-300 transition-all text-sm leading-relaxed shadow-sm outline-none"
                                        placeholder="Paste your chaotic lecture notes here..."
                                    ></textarea>
                                </div>

                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wide">
                                        <BookOpen className="w-4 h-4" />
                                        {notesInput.length > 0 ? `${notesInput.split(' ').length} Words` : 'Waiting for input'}
                                    </div>
                                    <motion.button
                                        onClick={handleSummarize}
                                        disabled={isSummarizing || !notesInput.trim()}
                                        className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-slate-900 to-slate-800 text-white hover:from-slate-800 hover:to-slate-700 rounded-xl font-bold transition-all shadow-xl shadow-slate-200 disabled:opacity-50 disabled:cursor-not-allowed group"
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                    >
                                        {isSummarizing ? (
                                            <> <Loader2 className="w-4 h-4 animate-spin" /> Processing </>
                                        ) : (
                                            <>
                                                <BrainCircuit className="w-4 h-4 group-hover:rotate-12 transition-transform" />
                                                Summarize
                                                +                                            </>
                                        )}
                                    </motion.button>
                                </div>

                                <AnimatePresence>
                                    {summaryOutput && (
                                        <motion.div
                                            className="relative mt-2 bg-amber-50/50 backdrop-blur-sm rounded-2xl border border-amber-100/50 p-6 shadow-inner"
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                        >
                                            <div className="absolute top-4 right-4 z-10">
                                                <button
                                                    onClick={handleCopy}
                                                    className="p-2 bg-white rounded-lg shadow-sm hover:shadow-md text-amber-500 transition-all"
                                                    title="Copy"
                                                >
                                                    {copySuccess ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                                </button>
                                            </div>
                                            <div className="prose prose-sm prose-amber max-w-none prose-headings:font-bold prose-headings:text-slate-800 prose-p:text-slate-600">
                                                <ReactMarkdown>{summaryOutput}</ReactMarkdown>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>
                    </ThreeDCard>

                    {/* 2. AI Tutor Chat */}
                    <ThreeDCard className="h-full">
                        <div className="h-full bg-white/80 backdrop-blur-xl rounded-[2.5rem] shadow-2xl shadow-indigo-100/50 border border-white/60 flex flex-col overflow-hidden h-[700px] lg:h-auto hover:shadow-indigo-200/50 transition-shadow duration-300">
                            <div className="relative p-8 pb-0">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 opacity-50 pointer-events-none" />
                                <div className="relative z-10 flex items-center gap-4 mb-2">
                                    <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200">
                                        <MessageSquare className="w-6 h-6 text-white" />
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-bold text-slate-900">Personal Tutor</h2>
                                        <p className="text-slate-400 text-sm font-bold uppercase tracking-wider">Gemini 1.5 Pro</p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 space-y-6 relative z-10 scrollbar-hide" ref={tutorScrollRef}>
                                {tutorMessages.map((msg) => (
                                    <motion.div
                                        key={msg.id}
                                        className={`flex gap-4 ${msg.sender === 'user' ? 'flex-row-reverse' : ''}`}
                                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                    >
                                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm transform rotate-3 ${msg.sender === 'user' ? 'bg-slate-900' : 'bg-white border border-indigo-100'}`}>
                                            {msg.sender === 'user' ? <User className="w-5 h-5 text-white" /> : <Bot className="w-6 h-6 text-indigo-500" />}
                                        </div>
                                        <div className={`p-5 rounded-2xl text-sm max-w-[85%] shadow-sm leading-relaxed relative ${msg.sender === 'user'
                                            ? 'bg-gradient-to-br from-indigo-600 to-violet-600 text-white rounded-tr-sm shadow-indigo-200'
                                            : 'bg-white text-slate-600 border border-slate-100 rounded-tl-sm prose prose-sm max-w-none shadow-sm'
                                            }`}>
                                            {msg.sender === 'user' ? msg.text : <ReactMarkdown>{msg.text}</ReactMarkdown>}
                                        </div>
                                    </motion.div>
                                ))}
                                {isTutorThinking && (
                                    <motion.div
                                        className="flex gap-4"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                    >
                                        <div className="w-10 h-10 rounded-2xl bg-white border border-indigo-100 flex items-center justify-center flex-shrink-0 shadow-sm animate-pulse">
                                            <Bot className="w-6 h-6 text-indigo-400" />
                                        </div>
                                        <div className="bg-white px-6 py-4 rounded-2xl rounded-tl-sm border border-slate-100 flex gap-1.5 items-center shadow-sm">
                                            <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                                            <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                                            <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                                        </div>
                                    </motion.div>
                                )}
                            </div>

                            <div className="p-6 bg-white/50 border-t border-slate-100 relative backdrop-blur-sm">
                                <div className="relative group/input">
                                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-200 to-violet-200 rounded-2xl blur opacity-20 group-hover/input:opacity-40 transition-opacity" />
                                    <input
                                        type="text"
                                        value={tutorInput}
                                        onChange={(e) => setTutorInput(e.target.value)}
                                        onKeyPress={(e) => e.key === 'Enter' && handleTutorAsk()}
                                        placeholder="Ask a question..."
                                        className="relative w-full pl-6 pr-14 py-4 bg-white border-none rounded-2xl text-sm focus:ring-2 focus:ring-indigo-100 shadow-sm text-slate-700 font-medium placeholder:text-slate-400 outline-none"
                                    />
                                </div>
                                <motion.button
                                    onClick={handleTutorAsk}
                                    disabled={!tutorInput.trim() || isTutorThinking}
                                    className="absolute right-8 top-8 p-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:bg-slate-300 shadow-lg shadow-indigo-200"
                                    whileHover={{ scale: 1.1, rotate: -10 }}
                                    whileTap={{ scale: 0.9 }}
                                >
                                    <Send className="w-4 h-4" />
                                </motion.button>
                            </div>
                        </div>
                    </ThreeDCard>
                </div>
            </div>
        </div>
    );
}
