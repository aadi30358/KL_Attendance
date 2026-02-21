import { useState } from 'react';
import { ChatContext } from './useChat';

export function ChatProvider({ children }) {
    const [isOpen, setIsOpen] = useState(false);

    const openChat = () => setIsOpen(true);
    const closeChat = () => setIsOpen(false);
    const toggleChat = () => setIsOpen(prev => !prev);

    const value = {
        isOpen,
        openChat,
        closeChat,
        toggleChat
    };

    return (
        <ChatContext.Provider value={value}>
            {children}
        </ChatContext.Provider>
    );
}
