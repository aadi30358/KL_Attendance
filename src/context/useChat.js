import { createContext, useContext } from 'react';

export const ChatContext = createContext();

export function useChat() {
    return useContext(ChatContext);
}
