import React from 'react';
import { Sidebar } from './Sidebar';
import { ChatArea } from './ChatArea';
import { RightPanel } from './RightPanel';
import { useStore } from '../store/useStore';

export function Layout() {
  const { isSidebarOpen, isRightPanelOpen } = useStore();

  return (
    <div className="flex h-screen w-full bg-[#0d0d0f] text-[#f0f0f5] overflow-hidden font-sans">
      {/* Left Sidebar */}
      <div
        className={`transition-all duration-300 ease-in-out border-r border-[#2a2a2e] bg-[#141416] ${
          isSidebarOpen ? 'w-64' : 'w-16'
        } flex-shrink-0 flex flex-col`}
      >
        <Sidebar />
      </div>

      {/* Center Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#0d0d0f]">
        <ChatArea />
      </div>

      {/* Right Panel */}
      <div
        className={`transition-all duration-300 ease-in-out border-l border-[#2a2a2e] bg-[#141416] ${
          isRightPanelOpen ? 'w-80' : 'w-0 border-l-0'
        } flex-shrink-0 flex flex-col overflow-hidden`}
      >
        <RightPanel />
      </div>
    </div>
  );
}
