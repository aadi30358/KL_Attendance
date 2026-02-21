import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, X, Send, Bot, User, Loader2, MinusCircle } from 'lucide-react';
import { useChat } from '../context/useChat';
import { APP_CONFIG } from '../config';
import ReactMarkdown from 'react-markdown';

const ChatAssistant = () => {
    const { isOpen, toggleChat, closeChat } = useChat();
    const [messages, setMessages] = useState([
        { role: 'assistant', content: "Hello! I'm your KL Academic Assistant. How can I help you today?" }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const scrollRef = useRef(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isOpen]);

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMsg = { role: 'user', content: input };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsLoading(true);

        try {
            // Using raw fetch to Anthropic API
            const response = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': APP_CONFIG.ANTHROPIC_API_KEY,
                    'anthropic-version': '2023-06-01',
                    'dangerously-allow-browser': 'true' // Note: This is usually for the SDK, for raw fetch we just hope for the best or use a proxy if needed
                },
                body: JSON.stringify({
                    model: 'claude-3-haiku-20240307',
                    max_tokens: 1024,
                    messages: [
                        { role: 'user', content: input }
                    ],
                    system: "You are a helpful academic assistant for KL University students. You help with attendance calculation, exam prep, and finding study materials. Be concise and friendly."
                })
            });

            if (!response.ok) {
                // Fallback to Gemini if Anthropic fails (e.g. CORS) or just show error
                throw new Error('Anthropic API call failed');
            }

            const data = await response.json();
            const botMsg = { role: 'assistant', content: data.content[0].text };
            setMessages(prev => [...prev, botMsg]);
        } catch (error) {
            console.error("Chat Error:", error);
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: "I'm having trouble connecting to my AI core right now. Please try again in a moment."
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end">
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.95, transformOrigin: 'bottom right' }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        className="mb-4 w-[380px] h-[550px] bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col"
                    >
                        {/* Header */}
                        <div className="bg-slate-900 p-5 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-indigo-500 flex items-center justify-center">
                                    <Bot className="text-white w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="text-white font-bold text-sm">KL Academic AI</h3>
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                        <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Online</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={toggleChat}
                                    className="p-1.5 text-slate-400 hover:text-white transition-colors"
                                >
                                    <MinusCircle className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={closeChat}
                                    className="p-1.5 text-slate-400 hover:text-white transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {/* Messages */}
                        <div
                            ref={scrollRef}
                            className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50 custom-scrollbar"
                        >
                            {messages.map((msg, idx) => (
                                <motion.div
                                    key={idx}
                                    initial={{ opacity: 0, x: msg.role === 'user' ? 10 : -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                >
                                    <div className={`max-w-[85%] p-4 rounded-2xl text-sm ${msg.role === 'user'
                                        ? 'bg-slate-900 text-white rounded-tr-none'
                                        : 'bg-white text-slate-800 border border-slate-200 rounded-tl-none shadow-sm'
                                        }`}>
                                        <div className="flex items-center gap-2 mb-1 opacity-50 font-bold text-[10px] uppercase">
                                            {msg.role === 'user' ? <User className="w-3 h-3" /> : <Bot className="w-3 h-3" />}
                                            {msg.role}
                                        </div>
                                        <div className="prose prose-sm prose-slate max-w-none">
                                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                            {isLoading && (
                                <div className="flex justify-start">
                                    <div className="bg-white border border-slate-200 p-4 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-2">
                                        <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                                        <span className="text-xs text-slate-500 font-medium">Claude is thinking...</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Input */}
                        <form
                            onSubmit={handleSendMessage}
                            className="p-4 bg-white border-t border-slate-100 flex gap-2"
                        >
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="Ask about attendance or exams..."
                                className="flex-1 bg-slate-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-slate-900 transition-all outline-none"
                            />
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                type="submit"
                                disabled={!input.trim() || isLoading}
                                className="w-12 h-12 bg-slate-900 text-white rounded-xl flex items-center justify-center disabled:opacity-50 disabled:scale-100 transition-all"
                            >
                                <Send className="w-5 h-5" />
                            </motion.button>
                        </form>
                    </motion.div>
                )}
            </AnimatePresence>

            <motion.button
                whileHover={{ scale: 1.1, rotate: 5 }}
                whileTap={{ scale: 0.9 }}
                onClick={toggleChat}
                className={`w-16 h-16 rounded-3xl flex items-center justify-center shadow-2xl transition-all duration-300 ${isOpen ? 'bg-white text-slate-900 rotate-90' : 'bg-slate-900 text-white'
                    }`}
            >
                {isOpen ? <X className="w-8 h-8" /> : (
                    <div className="relative">
                        <MessageSquare className="w-8 h-8" />
                        <motion.div
                            animate={{ scale: [1, 1.2, 1] }}
                            transition={{ duration: 2, repeat: Infinity }}
                            className="absolute -top-1 -right-1 w-3 h-3 bg-indigo-500 rounded-full border-2 border-slate-900"
                        />
                    </div>
                )}
            </motion.button>
        </div>
    );
};

export default ChatAssistant;
