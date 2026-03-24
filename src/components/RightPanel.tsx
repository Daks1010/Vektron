import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { Settings, Key, Cpu, ToggleLeft, ToggleRight, X, Loader2, CheckCircle2 } from 'lucide-react';

export function RightPanel() {
  const { isRightPanelOpen, toggleRightPanel, models, setModels } = useStore();
  const [keys, setKeys] = useState({ openai: '', anthropic: '', google: '', ollamaUrl: 'http://localhost:11434' });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const storedKeys = localStorage.getItem('vektron_keys');
    if (storedKeys) {
      try {
        setKeys(JSON.parse(storedKeys));
      } catch (e) {}
    }
  }, []);

  if (!isRightPanelOpen) return null;

  const handleToggleModel = (id: string) => {
    setModels(
      models.map((m) => (m.id === id ? { ...m, enabled: !m.enabled } : m))
    );
  };

  const handleSaveKeys = async () => {
    setSaving(true);
    setSaved(false);
    
    // In a real app, we would validate each key via the backend here
    // For now, just save to localStorage
    localStorage.setItem('vektron_keys', JSON.stringify(keys));
    
    setTimeout(() => {
      setSaving(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }, 1000);
  };

  return (
    <div className="flex flex-col h-full bg-[#141416] border-l border-[#2a2a2e]">
      <div className="h-14 flex items-center justify-between px-4 border-b border-[#2a2a2e]">
        <h2 className="font-semibold text-sm text-[#f0f0f5] uppercase tracking-wider">
          Model Management
        </h2>
        <button
          onClick={toggleRightPanel}
          className="p-1.5 rounded-md hover:bg-[#2a2a2e] text-[#6b6b7a] hover:text-[#f0f0f5] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Cloud Models */}
        <section>
          <h3 className="text-xs font-semibold text-[#6b6b7a] uppercase tracking-wider mb-3 flex items-center gap-2">
            <Cpu className="w-4 h-4" /> Cloud Models
          </h3>
          <div className="space-y-2">
            {models
              .filter((m) => m.provider !== 'ollama')
              .map((model) => (
                <div
                  key={model.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-[#0d0d0f] border border-[#2a2a2e]"
                >
                  <div className="flex flex-col flex-1 mr-4">
                    <span className="text-sm font-medium text-[#f0f0f5]">
                      {model.name}
                    </span>
                    <span className="text-xs text-[#6b6b7a] capitalize mb-2">
                      {model.provider}
                    </span>
                    {model.enabled && (
                      <input
                        type="text"
                        placeholder="System prompt / Role..."
                        value={model.rolePrompt || ''}
                        onChange={(e) => {
                          setModels(models.map(m => m.id === model.id ? { ...m, rolePrompt: e.target.value } : m));
                        }}
                        className="w-full bg-[#141416] border border-[#2a2a2e] rounded px-2 py-1 text-xs text-[#f0f0f5] focus:border-[#7c6ff7] outline-none"
                      />
                    )}
                  </div>
                  <button
                    onClick={() => handleToggleModel(model.id)}
                    className={`transition-colors ${
                      model.enabled ? 'text-[#22c55e]' : 'text-[#6b6b7a]'
                    }`}
                  >
                    {model.enabled ? (
                      <ToggleRight className="w-6 h-6" />
                    ) : (
                      <ToggleLeft className="w-6 h-6" />
                    )}
                  </button>
                </div>
              ))}
          </div>
        </section>

        {/* Local Models */}
        <section>
          <h3 className="text-xs font-semibold text-[#6b6b7a] uppercase tracking-wider mb-3 flex items-center gap-2">
            <Cpu className="w-4 h-4" /> Local Models (Ollama)
          </h3>
          <div className="space-y-2">
            {models
              .filter((m) => m.provider === 'ollama')
              .map((model) => (
                <div
                  key={model.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-[#0d0d0f] border border-[#2a2a2e]"
                >
                  <div className="flex flex-col flex-1 mr-4">
                    <span className="text-sm font-medium text-[#f0f0f5]">
                      {model.name}
                    </span>
                    <span className="text-xs text-[#22c55e] mb-2">Connected</span>
                    {model.enabled && (
                      <input
                        type="text"
                        placeholder="System prompt / Role..."
                        value={model.rolePrompt || ''}
                        onChange={(e) => {
                          setModels(models.map(m => m.id === model.id ? { ...m, rolePrompt: e.target.value } : m));
                        }}
                        className="w-full bg-[#141416] border border-[#2a2a2e] rounded px-2 py-1 text-xs text-[#f0f0f5] focus:border-[#7c6ff7] outline-none"
                      />
                    )}
                  </div>
                  <button
                    onClick={() => handleToggleModel(model.id)}
                    className={`transition-colors ${
                      model.enabled ? 'text-[#22c55e]' : 'text-[#6b6b7a]'
                    }`}
                  >
                    {model.enabled ? (
                      <ToggleRight className="w-6 h-6" />
                    ) : (
                      <ToggleLeft className="w-6 h-6" />
                    )}
                  </button>
                </div>
              ))}
          </div>
          <button 
            onClick={async () => {
              try {
                const res = await fetch('/api/v1/models/ollama', {
                  headers: { 'x-ollama-url': keys.ollamaUrl }
                });
                if (res.ok) {
                  const data = await res.json();
                  if (data.models) {
                    const newModels = data.models.map((m: any) => ({
                      id: m.name,
                      name: m.name,
                      provider: 'ollama',
                      enabled: true
                    }));
                    
                    // Merge with existing
                    const existingNonOllama = models.filter(m => m.provider !== 'ollama');
                    setModels([...existingNonOllama, ...newModels]);
                  }
                }
              } catch (e) {
                console.error(e);
              }
            }}
            className="mt-2 text-xs text-[#7c6ff7] hover:underline w-full text-left"
          >
            Refresh local models...
          </button>
        </section>

        {/* BYOK Settings */}
        <section>
          <h3 className="text-xs font-semibold text-[#6b6b7a] uppercase tracking-wider mb-3 flex items-center gap-2">
            <Key className="w-4 h-4" /> API Keys (BYOK)
          </h3>
          <div className="space-y-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-[#f0f0f5]">OpenAI Key</label>
              <input
                type="password"
                value={keys.openai}
                onChange={(e) => setKeys({ ...keys, openai: e.target.value })}
                placeholder="sk-..."
                className="w-full bg-[#0d0d0f] border border-[#2a2a2e] rounded-md px-3 py-1.5 text-sm text-[#f0f0f5] focus:border-[#7c6ff7] focus:ring-1 focus:ring-[#7c6ff7] outline-none transition-all"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-[#f0f0f5]">Anthropic Key</label>
              <input
                type="password"
                value={keys.anthropic}
                onChange={(e) => setKeys({ ...keys, anthropic: e.target.value })}
                placeholder="sk-ant-..."
                className="w-full bg-[#0d0d0f] border border-[#2a2a2e] rounded-md px-3 py-1.5 text-sm text-[#f0f0f5] focus:border-[#7c6ff7] focus:ring-1 focus:ring-[#7c6ff7] outline-none transition-all"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-[#f0f0f5]">Google Gemini Key</label>
              <input
                type="password"
                value={keys.google}
                onChange={(e) => setKeys({ ...keys, google: e.target.value })}
                placeholder="AIza..."
                className="w-full bg-[#0d0d0f] border border-[#2a2a2e] rounded-md px-3 py-1.5 text-sm text-[#f0f0f5] focus:border-[#7c6ff7] focus:ring-1 focus:ring-[#7c6ff7] outline-none transition-all"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-[#f0f0f5]">Ollama Base URL</label>
              <input
                type="text"
                value={keys.ollamaUrl}
                onChange={(e) => setKeys({ ...keys, ollamaUrl: e.target.value })}
                placeholder="http://localhost:11434"
                className="w-full bg-[#0d0d0f] border border-[#2a2a2e] rounded-md px-3 py-1.5 text-sm text-[#f0f0f5] focus:border-[#7c6ff7] focus:ring-1 focus:ring-[#7c6ff7] outline-none transition-all"
              />
            </div>
            
            <button
              onClick={handleSaveKeys}
              disabled={saving}
              className="w-full bg-[#2a2a2e] hover:bg-[#3f3f46] text-[#f0f0f5] py-2 rounded-md text-sm font-medium transition-colors mt-2 flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle2 className="w-4 h-4 text-[#22c55e]" /> : 'Save Keys'}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
