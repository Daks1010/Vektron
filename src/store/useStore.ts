import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '@supabase/supabase-js';

export interface ChatSession {
  id: string;
  title: string;
  timestamp: number;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  modelId?: string;
  timestamp: number;
}

export interface ModelConfig {
  id: string;
  name: string;
  provider: 'openai' | 'anthropic' | 'google' | 'ollama' | 'custom';
  role?: string;
  rolePrompt?: string;
  enabled: boolean;
}

interface AppState {
  user: User | null;
  setUser: (user: User | null) => void;
  models: ModelConfig[];
  setModels: (models: ModelConfig[] | ((prev: ModelConfig[]) => ModelConfig[])) => void;
  sessions: ChatSession[];
  activeSessionId: string | null;
  setActiveSessionId: (id: string | null) => void;
  addSession: (session: ChatSession) => void;
  updateSessionTitle: (id: string, title: string) => void;
  sessionMessages: Record<string, Message[]>;
  addMessage: (sessionId: string, message: Message) => void;
  getMessages: (sessionId: string) => Message[];
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
  isRightPanelOpen: boolean;
  toggleRightPanel: () => void;
  isSettingsOpen: boolean;
  toggleSettings: () => void;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      user: null,
      setUser: (user) => set({ user }),
      models: [
        { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai', enabled: true },
        { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5', provider: 'anthropic', enabled: true },
        { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', provider: 'google', enabled: true },
        { id: 'ollama', name: 'Ollama (local)', provider: 'ollama', enabled: true },
      ],
      setModels: (models) =>
        set((state) => ({
          models: typeof models === 'function' ? models(state.models) : models,
        })),
      sessions: [],
      activeSessionId: null,
      setActiveSessionId: (id) => set({ activeSessionId: id }),
      addSession: (session) =>
        set((state) => ({ sessions: [session, ...state.sessions] })),
      updateSessionTitle: (id, title) =>
        set((state) => ({
          sessions: state.sessions.map((s) => s.id === id ? { ...s, title } : s),
        })),
      sessionMessages: {},
      addMessage: (sessionId, message) =>
        set((state) => ({
          sessionMessages: {
            ...state.sessionMessages,
            [sessionId]: [...(state.sessionMessages[sessionId] || []), message],
          },
        })),
      getMessages: (sessionId) => get().sessionMessages[sessionId] || [],
      isSidebarOpen: true,
      toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
      isRightPanelOpen: false,
      toggleRightPanel: () => set((state) => ({ isRightPanelOpen: !state.isRightPanelOpen })),
      isSettingsOpen: false,
      toggleSettings: () => set((state) => ({ isSettingsOpen: !state.isSettingsOpen })),
    }),
    {
      name: 'vektron-store',
      partialize: (state) => ({
        sessions: state.sessions,
        activeSessionId: state.activeSessionId,
        sessionMessages: state.sessionMessages,
      }),
    }
  )
);