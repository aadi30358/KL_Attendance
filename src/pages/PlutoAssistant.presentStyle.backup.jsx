import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    ArrowLeft,
    Bot,
    Sparkles,
    Bug,
    BookOpen,
    Zap,
    RefreshCw,
    Brain,
    Milestone,
    HelpCircle,
    BarChart3,
    Check,
    Copy,
    ExternalLink,
    Send,
    Code2
} from 'lucide-react';
import { FaTelegram } from 'react-icons/fa6';
import SEO from '../components/SEO';

const IMPORTANT_POINTS = [
    {
        icon: Sparkles,
        text: 'Ask coding questions and get solutions'
    },
    {
        icon: Bug,
        text: 'Debug your code and understand the errors'
    },
    {
        icon: BookOpen,
        text: 'Get line-by-line code explanations'
    },
    {
        icon: Zap,
        text: 'Optimize your code and learn better approaches'
    },
    {
        icon: RefreshCw,
        text: 'Convert code between C, C++, Java, Python, JS, Rust, Go & more'
    },
    {
        icon: Brain,
        text: 'Analyze code with dry runs, output prediction & Big-O complexity'
    },
    {
        icon: Milestone,
        text: 'Follow an 18-milestone DSA roadmap'
    },
    {
        icon: HelpCircle,
        text: 'Practice with interactive coding quizzes'
    },
    {
        icon: BarChart3,
        text: 'Track coding progress, streaks, rank & problems solved'
    }
];

const SUPPORTED_LANGUAGES = ['C', 'C++', 'Java', 'Python', 'JavaScript', 'Rust', 'Go', 'SQL'];

export default function PlutoAssistant() {
    const navigate = useNavigate();
    const [copied, setCopied] = useState(false);
    const [copiedCode, setCopiedCode] = useState(false);

    const copyCodeSnippet = () => {
        const code = `public ListNode reverseList(ListNode head) {
    ListNode prev = null;
    ListNode curr = head;

    while (curr != null) {
        ListNode next = curr.next; // 1. Save next node
        curr.next = prev;          // 2. Reverse current pointer
        prev = curr;               // 3. Advance prev
        curr = next;               // 4. Advance curr
    }

    return prev; // New head of reversed list
}`;
        navigator.clipboard.writeText(code);
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 2000);
    };

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    const copyHandle = () => {
        navigator.clipboard.writeText('@PlutoSpark_bot');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="relative min-h-screen bg-[#F8FAFC] text-slate-900 selection:bg-[#229ED9] selection:text-white pb-20 overflow-x-hidden w-full">
            <SEO
                title="Pluto — AI Coding Assistant for Students"
                description="Meet Pluto (@PlutoSpark_bot) — AI-powered coding and DSA assistant on Telegram built especially for students learning programming."
            />

            {/* Ambient Background Lights - Single Telegram Blue Hue */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-[#229ED9]/12 blur-3xl rounded-full" />
                <div className="absolute top-[40%] right-[-10%] w-[450px] h-[450px] bg-[#229ED9]/10 blur-3xl rounded-full" />
            </div>

            {/* Main Content */}
            <div className="relative z-10 w-full max-w-5xl mx-auto pt-20 sm:pt-28 px-3.5 sm:px-6 lg:px-8">

                {/* Top Action Bar */}
                <div className="w-full flex items-center justify-between gap-2 sm:gap-3 mb-6 sm:mb-8">
                    <button
                        onClick={() => navigate(-1)}
                        className="px-3 sm:px-4 py-2 sm:py-2.5 bg-white hover:bg-slate-100 text-slate-900 border-2 border-black rounded-xl text-xs sm:text-sm font-black flex items-center gap-1.5 sm:gap-2 transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:scale-95 hover:-translate-x-0.5 cursor-pointer shrink-0"
                    >
                        <ArrowLeft className="w-4 h-4 shrink-0" />
                        <span>Back</span>
                    </button>

                    <div className="flex items-center gap-1.5 sm:gap-2">
                        <button
                            onClick={copyHandle}
                            className="px-3 sm:px-3.5 py-2 sm:py-2.5 bg-white hover:bg-slate-100 text-slate-800 border-2 border-black rounded-xl text-xs sm:text-sm font-black flex items-center gap-1.5 transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:scale-95 cursor-pointer"
                        >
                            {copied ? (
                                <>
                                    <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#229ED9]" />
                                    <span className="text-[#229ED9] font-black">Copied!</span>
                                </>
                            ) : (
                                <>
                                    <Copy className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-600" />
                                    <span className="hidden sm:inline">@PlutoSpark_bot</span>
                                    <span className="sm:hidden">@Pluto</span>
                                </>
                            )}
                        </button>

                        <a
                            href="https://t.me/PlutoSpark_bot"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3.5 sm:px-5 py-2 sm:py-2.5 bg-[#229ED9] hover:bg-[#198fca] text-white border-2 border-black rounded-xl text-xs sm:text-sm font-black flex items-center gap-1.5 sm:gap-2 transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:scale-95"
                        >
                            <FaTelegram className="w-4 h-4 shrink-0" />
                            <span>Telegram</span>
                            <ExternalLink className="w-3.5 h-3.5 opacity-80 hidden sm:inline" />
                        </a>
                    </div>
                </div>

                {/* Hero Showcase Card */}
                <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35 }}
                    className="w-full bg-white border-2 border-black rounded-3xl p-5 sm:p-10 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] sm:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] relative overflow-hidden mb-8 sm:mb-10"
                >
                    {/* Live Online Badge */}
                    <div className="flex flex-wrap items-center gap-2 mb-3 sm:mb-4">
                        <span className="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 rounded-full bg-sky-50 border border-sky-200 text-[#1474a4] text-[11px] sm:text-xs font-black uppercase tracking-wider">
                            <span className="w-2 h-2 rounded-full bg-[#229ED9] animate-pulse" />
                            <span>AI Coding Assistant for Students</span>
                        </span>
                        <span className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full bg-slate-100 text-slate-700 text-[11px] sm:text-xs font-bold border border-slate-200 font-mono">
                            @PlutoSpark_bot
                        </span>
                    </div>

                    <h1 className="text-2xl sm:text-4xl md:text-5xl font-black text-slate-900 tracking-tight leading-tight mb-3 sm:mb-4">
                        🚀 Introducing Pluto <br />
                        <span className="text-[#229ED9]">
                            — AI Coding Assistant for Students! 🤖💻
                        </span>
                    </h1>

                    <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-3xl mb-6">
                        I’ve built <strong className="text-slate-900 font-bold">Pluto (<a href="https://t.me/PlutoSpark_bot" target="_blank" rel="noopener noreferrer" className="text-[#229ED9] hover:underline font-bold">@PlutoSpark_bot</a>)</strong>, an AI-powered coding assistant that works directly on Telegram and is designed especially for students who are learning programming and DSA.
                    </p>

                    {/* The Core Idea Banner */}
                    <div className="w-full p-4 sm:p-5 bg-slate-900 text-white rounded-2xl border-2 border-black shadow-inner mb-5 sm:mb-6 flex flex-col md:flex-row items-center justify-between gap-3.5 sm:gap-4">
                        <div className="flex items-center gap-2.5 sm:gap-3 w-full min-w-0">
                            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-[#229ED9]/20 flex items-center justify-center shrink-0 border border-[#229ED9]/30">
                                <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-[#229ED9]" />
                            </div>
                            <div className="min-w-0">
                                <div className="text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-sky-400 mb-0.5">The Core Philosophy</div>
                                <div className="text-xs sm:text-base font-bold flex flex-wrap items-center gap-1 sm:gap-2">
                                    <span>Ask</span>
                                    <span className="text-sky-400">→</span>
                                    <span>Get Solution</span>
                                    <span className="text-sky-400">→</span>
                                    <span>Understand Code</span>
                                    <span className="text-sky-400">→</span>
                                    <span className="text-sky-300">Improve Skills 🚀</span>
                                </div>
                            </div>
                        </div>

                        <a
                            href="https://t.me/PlutoSpark_bot"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full md:w-auto px-4 sm:px-5 py-2.5 bg-[#229ED9] hover:bg-[#1a8fc5] text-white font-black rounded-xl text-xs sm:text-sm border border-white/20 flex items-center justify-center gap-2 transition-all shadow-md shrink-0 active:scale-95"
                        >
                            <Send className="w-4 h-4" />
                            <span>Try Pluto on Telegram</span>
                        </a>
                    </div>

                    {/* Quick Benefit Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3 pt-1">
                        <div className="p-3 sm:p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-2.5 sm:gap-3 shadow-sm">
                            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-sky-50 flex items-center justify-center shrink-0 border border-sky-100">
                                <FaTelegram className="w-4 h-4 sm:w-5 sm:h-5 text-[#229ED9]" />
                            </div>
                            <div>
                                <div className="text-xs font-black text-slate-900">Telegram Native</div>
                                <div className="text-[11px] text-slate-500">Zero installation required</div>
                            </div>
                        </div>

                        <div className="p-3 sm:p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-2.5 sm:gap-3 shadow-sm">
                            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-sky-50 flex items-center justify-center shrink-0 border border-sky-100">
                                <Code2 className="w-4 h-4 sm:w-5 sm:h-5 text-[#229ED9]" />
                            </div>
                            <div>
                                <div className="text-xs font-black text-slate-900">Multi-Language</div>
                                <div className="text-[11px] text-slate-500">C, C++, Java, Python, JS & more</div>
                            </div>
                        </div>

                        <div className="p-3 sm:p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-2.5 sm:gap-3 shadow-sm">
                            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-sky-50 flex items-center justify-center shrink-0 border border-sky-100">
                                <Milestone className="w-4 h-4 sm:w-5 sm:h-5 text-[#229ED9]" />
                            </div>
                            <div>
                                <div className="text-xs font-black text-slate-900">18 DSA Milestones</div>
                                <div className="text-[11px] text-slate-500">Structured progressive roadmap</div>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Video Demo & Interactive Telegram Chat Preview */}
                {/* Clear Telegram Live Chat Demonstration */}
                <div className="w-full bg-white border-2 border-black rounded-2xl sm:rounded-3xl p-3.5 sm:p-7 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] sm:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] mb-8 sm:mb-12">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-black pb-3.5 sm:pb-4 mb-4 sm:mb-6">
                        <div className="flex items-center gap-2.5 sm:gap-3">
                            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-[#229ED9] text-white flex items-center justify-center font-black shadow-sm shrink-0">
                                <Bot className="w-5 h-5 sm:w-6 sm:h-6" />
                            </div>
                            <div className="min-w-0">
                                <div className="font-black text-sm sm:text-base text-slate-900 flex items-center gap-2">
                                    <span className="truncate">Pluto AI Assistant</span>
                                    <span className="px-1.5 sm:px-2 py-0.5 rounded-full bg-sky-50 border border-sky-200 text-[#1474a4] text-[9px] sm:text-[10px] font-black uppercase tracking-wider shrink-0">BOT</span>
                                </div>
                                <div className="text-[11px] sm:text-xs text-slate-500 font-medium truncate">@PlutoSpark_bot • 🟢 Online 24/7 on Telegram</div>
                            </div>
                        </div>

                        <a
                            href="https://t.me/PlutoSpark_bot"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full sm:w-auto px-3.5 sm:px-4 py-2 bg-[#229ED9] hover:bg-[#1a8fc5] text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all shrink-0"
                        >
                            <span>Chat on Telegram</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                    </div>

                    {/* Chat Messages */}
                    <div className="space-y-4 sm:space-y-5 font-sans">
                        {/* Student Question Bubble */}
                        <div className="flex justify-end">
                            <div className="max-w-[92%] sm:max-w-lg bg-[#229ED9] text-white rounded-2xl rounded-tr-sm p-3.5 sm:p-4 shadow-sm">
                                <p className="text-xs sm:text-sm font-semibold leading-relaxed">
                                    How do I reverse a Singly Linked List in Java? Can you explain the optimal approach with time and space complexity?
                                </p>
                                <span className="text-[10px] text-sky-100 block text-right mt-1.5 font-medium">10:42 AM ✓✓</span>
                            </div>
                        </div>

                        {/* Pluto Response Bubble */}
                        <div className="flex justify-start w-full">
                            <div className="w-full max-w-full sm:max-w-3xl bg-slate-50 border-2 border-black text-slate-800 rounded-2xl rounded-tl-sm p-3 sm:p-6 shadow-sm space-y-3">
                                <div className="flex items-center gap-2 text-xs sm:text-sm font-black text-[#229ED9]">
                                    <Sparkles className="w-4 h-4 shrink-0" />
                                    <span className="leading-snug">Pluto&apos;s Solution: Iterative 3-Pointer In-Place Reversal</span>
                                </div>

                                <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                                    To reverse a singly linked list in <strong className="text-slate-900 font-bold">O(N) time</strong> and <strong className="text-slate-900 font-bold">O(1) extra space</strong>, we maintain 3 pointers (<code className="bg-white border border-slate-200 px-1.5 py-0.5 rounded font-mono text-slate-900 font-bold">prev</code>, <code className="bg-white border border-slate-200 px-1.5 py-0.5 rounded font-mono text-slate-900 font-bold">curr</code>, and <code className="bg-white border border-slate-200 px-1.5 py-0.5 rounded font-mono text-slate-900 font-bold">next</code>) to flip the pointers in-place:
                                </p>

                                {/* Code Box */}
                                <div className="rounded-xl sm:rounded-2xl bg-slate-900 border-2 border-black overflow-hidden shadow-inner max-w-full">
                                    <div className="flex items-center justify-between px-3 sm:px-4 py-2 bg-slate-800 border-b border-slate-700 text-[10px] sm:text-[11px] font-mono font-bold text-slate-300">
                                        <span>Solution.java</span>
                                        <button
                                            onClick={copyCodeSnippet}
                                            className="hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
                                        >
                                            <Copy className="w-3 h-3" />
                                            <span>{copiedCode ? 'Copied!' : 'Copy Code'}</span>
                                        </button>
                                    </div>
                                    <pre className="p-3 sm:p-4 text-slate-100 font-mono text-[11px] sm:text-xs md:text-sm leading-relaxed overflow-x-auto whitespace-pre">
{`public ListNode reverseList(ListNode head) {
    ListNode prev = null;
    ListNode curr = head;

    while (curr != null) {
        ListNode next = curr.next; // 1. Save next node
        curr.next = prev;          // 2. Reverse current pointer
        prev = curr;               // 3. Advance prev
        curr = next;               // 4. Advance curr
    }

    return prev; // New head of reversed list
}`}
                                    </pre>
                                </div>

                                {/* Complexity Badges */}
                                <div className="flex flex-wrap gap-1.5 sm:gap-2 pt-1">
                                    <div className="px-2.5 sm:px-3 py-1 rounded-lg sm:rounded-xl bg-sky-50 border border-sky-200 text-[#1474a4] text-[11px] sm:text-xs font-black flex items-center gap-1.5">
                                        <span>⏱ Time: O(N)</span>
                                        <span className="text-[10px] sm:text-[11px] font-medium text-slate-500">— Single pass</span>
                                    </div>
                                    <div className="px-2.5 sm:px-3 py-1 rounded-lg sm:rounded-xl bg-sky-50 border border-sky-200 text-[#1474a4] text-[11px] sm:text-xs font-black flex items-center gap-1.5">
                                        <span>💾 Space: O(1)</span>
                                        <span className="text-[10px] sm:text-[11px] font-medium text-slate-500">— In-place</span>
                                    </div>
                                </div>

                                {/* Pluto Pro Tip */}
                                <div className="p-2.5 sm:p-3 rounded-xl bg-sky-50/70 border border-sky-100 text-[11px] sm:text-xs text-slate-700 leading-relaxed">
                                    <strong className="text-slate-900 font-black">💡 Pluto Pro Tip:</strong> Always remember to store <code className="font-mono font-bold text-[#229ED9]">curr.next</code> in a temporary variable before changing the link, otherwise you will lose reference to the rest of the list!
                                </div>

                                <span className="text-[10px] text-slate-400 block text-right">10:42 AM</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Section: What can Pluto help with? */}
                <div className="mb-8 sm:mb-12">
                    <div className="flex items-center gap-2.5 sm:gap-3 mb-4 sm:mb-6">
                        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-[#229ED9] text-white flex items-center justify-center shadow-sm shrink-0">
                            <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 leading-tight">
                                💡 What can Pluto help with?
                            </h2>
                            <p className="text-[11px] sm:text-xs md:text-sm text-slate-500 font-semibold">
                                Core capabilities designed especially for programming & DSA students.
                            </p>
                        </div>
                    </div>

                    {/* Important Points - Clean, Fast to Scan, Perfect on Mobile */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3.5">
                        {IMPORTANT_POINTS.map((item) => {
                            const Icon = item.icon;
                            return (
                                <div
                                    key={item.text}
                                    className="bg-white border-2 border-black rounded-xl sm:rounded-2xl p-3.5 sm:p-4 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] sm:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 transition-transform flex items-center gap-3"
                                >
                                    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-sky-50 border border-sky-200 text-[#229ED9] flex items-center justify-center shrink-0">
                                        <Icon className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                                    </div>
                                    <span className="text-xs sm:text-sm font-bold text-slate-900 leading-snug">
                                        {item.text}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Multi-Language Support Banner */}
                <div className="w-full bg-white border-2 border-black rounded-2xl sm:rounded-3xl p-4 sm:p-8 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] sm:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] mb-8 sm:mb-12">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6">
                        <div className="max-w-md">
                            <span className="px-2.5 py-0.5 rounded-full bg-sky-50 border border-sky-200 text-[#1474a4] text-[10px] font-black uppercase tracking-wider mb-2 inline-block">
                                Polyglot Translation
                            </span>
                            <h3 className="text-lg sm:text-2xl font-black text-slate-900 mb-1.5 sm:mb-2">
                                Multi-Language Mastery
                            </h3>
                            <p className="text-xs sm:text-sm text-slate-600">
                                Seamlessly translate logic and syntax between popular programming languages with idiomatic precision.
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-1.5 sm:gap-2 md:max-w-lg">
                            {SUPPORTED_LANGUAGES.map((lang) => (
                                <div
                                    key={lang}
                                    className="px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl bg-slate-50 border-2 border-black text-xs font-black text-slate-900 flex items-center gap-1.5 shadow-sm"
                                >
                                    <span>{lang}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Dark 3-Step Guide */}
                <div className="w-full bg-slate-900 text-white border-2 border-black rounded-2xl sm:rounded-3xl p-5 sm:p-10 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] sm:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] mb-8 sm:mb-12">
                    <div className="max-w-3xl mb-6 sm:mb-8">
                        <span className="px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full bg-[#229ED9]/20 border border-[#229ED9]/40 text-sky-300 text-[11px] sm:text-xs font-black uppercase tracking-wider mb-2 sm:mb-3 inline-block">
                            Simple & Fast Onboarding
                        </span>
                        <h2 className="text-xl sm:text-3xl font-black mb-1.5 sm:mb-2">
                            How to Start Using Pluto in 3 Steps ⚡
                        </h2>
                        <p className="text-xs sm:text-sm text-slate-300">
                            Zero friction. No credit cards, app stores, or complex installations needed.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-5">
                        <div className="p-4 sm:p-5 rounded-2xl bg-white/5 border border-white/10 flex flex-col justify-between">
                            <div>
                                <div className="w-8 h-8 rounded-full bg-[#229ED9] text-white font-black text-sm flex items-center justify-center mb-2.5 sm:mb-3">
                                    1
                                </div>
                                <h4 className="font-black text-sm sm:text-base mb-1">Open Telegram</h4>
                                <p className="text-xs text-slate-300 leading-relaxed">
                                    Search for <strong className="text-white">@PlutoSpark_bot</strong> directly in Telegram.
                                </p>
                            </div>
                        </div>

                        <div className="p-4 sm:p-5 rounded-2xl bg-white/5 border border-white/10 flex flex-col justify-between">
                            <div>
                                <div className="w-8 h-8 rounded-full bg-[#229ED9] text-white font-black text-sm flex items-center justify-center mb-2.5 sm:mb-3">
                                    2
                                </div>
                                <h4 className="font-black text-sm sm:text-base mb-1">Tap /start</h4>
                                <p className="text-xs text-slate-300 leading-relaxed">
                                    Send <code className="text-sky-300 bg-black/40 px-1 py-0.5 rounded font-mono">/start</code> to initialize and pick your desired track or roadmap.
                                </p>
                            </div>
                        </div>

                        <div className="p-4 sm:p-5 rounded-2xl bg-white/5 border border-white/10 flex flex-col justify-between">
                            <div>
                                <div className="w-8 h-8 rounded-full bg-[#229ED9] text-white font-black text-sm flex items-center justify-center mb-2.5 sm:mb-3">
                                    3
                                </div>
                                <h4 className="font-black text-sm sm:text-base mb-1">Ask & Conquer</h4>
                                <p className="text-xs text-slate-300 leading-relaxed">
                                    Paste questions, debug code, read line-by-line notes, and maintain your streak!
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 sm:mt-8 pt-5 sm:pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
                        <div className="text-xs text-slate-300 text-center sm:text-left">
                            🤖 Direct Link: <a href="https://t.me/PlutoSpark_bot" target="_blank" rel="noopener noreferrer" className="text-sky-400 font-bold hover:underline">t.me/PlutoSpark_bot</a>
                        </div>
                        <a
                            href="https://t.me/PlutoSpark_bot"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full sm:w-auto px-5 sm:px-6 py-2.5 sm:py-3 bg-[#229ED9] hover:bg-[#1a8fc5] text-white font-black rounded-xl text-xs sm:text-sm border-2 border-white flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all"
                        >
                            <FaTelegram className="w-4 h-4 shrink-0" />
                            <span>Start Chatting with Pluto</span>
                            <ExternalLink className="w-3.5 h-3.5 hidden sm:inline" />
                        </a>
                    </div>
                </div>

                {/* Feedback & Community Note */}
                <div className="w-full bg-white border-2 border-black rounded-2xl sm:rounded-3xl p-4 sm:p-8 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] sm:shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-6">
                    <div className="max-w-2xl w-full">
                        <div className="flex items-center gap-2 mb-1.5 sm:mb-2">
                            <span className="text-lg sm:text-xl">💬</span>
                            <h3 className="text-base sm:text-xl font-black text-slate-900">
                                Feedback & Suggestions Welcome
                            </h3>
                        </div>
                        <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                            I’m currently actively improving Pluto and would really appreciate your feedback, suggestions, and bug reports. If you’re learning <strong className="text-slate-900 font-black">Java, Python, C, C++, DSA</strong> or programming, give it a try! 💻🔥
                        </p>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                        <a
                            href="https://t.me/PlutoSpark_bot"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 sm:flex-initial px-4 py-2.5 bg-[#229ED9] hover:bg-[#198fca] text-white border-2 border-black rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:scale-95"
                        >
                            <FaTelegram className="w-4 h-4 shrink-0" />
                            <span>Try Pluto</span>
                        </a>
                        <button
                            onClick={() => navigate(-1)}
                            className="flex-1 sm:flex-initial px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-900 border-2 border-black rounded-xl text-xs sm:text-sm font-black transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:scale-95 cursor-pointer text-center"
                        >
                            Back
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
}
