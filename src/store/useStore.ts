import { create } from 'zustand';
import { User } from '@supabase/supabase-js';

interface AppState {
  user: User | null;
  setUser: (user: User | null) => void;
  models: ModelConfig[];
  setModels: (
    models: ModelConfig[] | ((prev: ModelConfig[]) => ModelConfig[]),
  ) => void;
  activeSessionId: string | null;
  setActiveSessionId: (id: string | null) => void;
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
  isRightPanelOpen: boolean;
  toggleRightPanel: () => void;
}

export interface ModelConfig {
  id: string;
  name: string;
  provider: 'openai' | 'anthropic' | 'google' | 'ollama' | 'custom';
  role?: string;
  rolePrompt?: string;
  enabled: boolean;
}

export const useStore = create<AppState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  models: [
    { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai', enabled: true },
    { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'anthropic', enabled: true },
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', provider: 'google', enabled: true },
    { id: 'ollama', name: 'Ollama (local)', provider: 'ollama', enabled: true },
  ],
  setModels: (models) =>
    set((state) => ({
      models: typeof models === 'function' ? models(state.models) : models,
    })),
  activeSessionId: null,
  setActiveSessionId: (id) => set({ activeSessionId: id }),
  isSidebarOpen: true,
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  isRightPanelOpen: false,
  toggleRightPanel: () => set((state) => ({ isRightPanelOpen: !state.isRightPanelOpen })),
}));
