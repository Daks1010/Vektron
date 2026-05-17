import React from 'react';
import { useStore } from '../store/useStore';
import { MessageSquare, Settings, Menu, Plus, Zap, LogOut } from 'lucide-react';
import { supabase } from '../lib/supabase';

export function Sidebar() {
  const {
    isSidebarOpen,
    toggleSidebar,
    user,
    setUser,
    sessions,
    addSession,
    activeSessionId,
    setActiveSessionId,
    toggleSettings,
  } = useStore();

  const handleNewChat = () => {
    const id = crypto.randomUUID();
    addSession({ id, title: 'New Chat', timestamp: Date.now() });
    setActiveSessionId(id);
  };

  const handleSelectSession = (id: string) => {
    setActiveSessionId(id);
  };

  const handleLogout = async () => {
    if (
      import.meta.env.VITE_SUPABASE_URL &&
      import.meta.env.VITE_SUPABASE_URL !== 'https://placeholder.supabase.co'
    ) {
      await supabase.auth.signOut();
    }
    setUser(null);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="h-14 flex items-center justify-between px-4 border-b border-[#2a2a2e]">
        {isSidebarOpen && (
          <div className="flex items-center gap-2 font-mono font-bold text-lg text-[#f0f0f5]">
            <Zap className="w-5 h-5 text-[#7c6ff7]" />
            <span>Vektron</span>
          </div>
        )}
        <button
          onClick={toggleSidebar}
          className="p-1.5 rounded-md hover:bg-[#2a2a2e] text-[#6b6b7a] hover:text-[#f0f0f5] transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* New Chat Button */}
      <div className="p-3">
        <button
          onClick={handleNewChat}
          className="w-full flex items-center justify-center gap-2 bg-[#7c6ff7] hover:bg-[#6366f1] text-white py-2 px-4 rounded-lg transition-colors font-medium text-sm"
        >
          <Plus className="w-4 h-4" />
          {isSidebarOpen && <span>New Chat</span>}
        </button>
      </div>

      {/* Chat History List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {isSidebarOpen && (
          <div className="px-2 py-1 text-xs font-semibold text-[#6b6b7a] uppercase tracking-wider mb-2">
            Recent Chats
          </div>
        )}

        {sessions.length === 0 && isSidebarOpen && (
          <div className="px-4 py-6 text-center">
            <p className="text-sm text-[#6b6b7a]">No chats yet</p>
            <p className="text-xs text-[#6b6b7a] mt-1">Click New Chat to start</p>
          </div>
        )}

        {sessions.map((session) => (
          <button
            key={session.id}
            onClick={() => handleSelectSession(session.id)}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
              activeSessionId === session.id
                ? 'bg-[#2a2a2e] text-[#f0f0f5]'
                : 'text-[#6b6b7a] hover:bg-[#1e1e22] hover:text-[#f0f0f5]'
            }`}
          >
            <MessageSquare className="w-4 h-4 flex-shrink-0" />
            {isSidebarOpen && (
              <span className="text-sm truncate flex-1">{session.title}</span>
            )}
          </button>
        ))}
      </div>

      {/* Footer */}
      <div className="p-2 border-t border-[#2a2a2e] space-y-1">
        {user && isSidebarOpen && (
          <div className="px-3 py-2 text-xs text-[#6b6b7a] truncate">{user.email}</div>
        )}
        <button
          onClick={toggleSettings}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-[#2a2a2e] text-left group transition-colors"
        >
          <Settings className="w-4 h-4 text-[#6b6b7a] group-hover:text-[#f0f0f5]" />
          {isSidebarOpen && (
            <span className="text-sm text-[#f0f0f5]">Settings</span>
          )}
        </button>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-[#2a2a2e] text-left group transition-colors"
        >
          <LogOut className="w-4 h-4 text-[#6b6b7a] group-hover:text-red-400" />
          {isSidebarOpen && (
            <span className="text-sm text-[#f0f0f5] group-hover:text-red-400">Log Out</span>
          )}
        </button>
      </div>
    </div>
  );
}