import React, { useState, useEffect } from 'react';
import { X, Eye, EyeOff, Key, Save } from 'lucide-react';
import { useStore } from '../store/useStore';

interface Keys {
  openai: string;
  anthropic: string;
  google: string;
  xai: string;
  ollamaUrl: string;
}

const DEFAULT_KEYS: Keys = {
  openai: '',
  anthropic: '',
  google: '',
  xai: '',
  ollamaUrl: 'http://localhost:11434',
};

export function SettingsModal() {
  const { isSettingsOpen, toggleSettings } = useStore();
  const [keys, setKeys] = useState<Keys>(DEFAULT_KEYS);
  const [savedKeys, setSavedKeys] = useState<Keys>(DEFAULT_KEYS);
  const [show, setShow] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState(false);

  // Load keys from localStorage on open
  useEffect(() => {
    if (isSettingsOpen) {
      const stored = localStorage.getItem('vektron_keys');
      if (stored) {
        const parsed = { ...DEFAULT_KEYS, ...JSON.parse(stored) };
        setKeys(parsed);
        setSavedKeys(parsed);
      }
    }
  }, [isSettingsOpen]);

  if (!isSettingsOpen) return null;

  const handleSave = () => {
    localStorage.setItem('vektron_keys', JSON.stringify(keys));
    setSavedKeys({ ...keys });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleClose = () => {
    toggleSettings();
  };

  const toggleShow = (field: string) => {
    setShow((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const isSaved = (field: keyof Keys) =>
    savedKeys[field] && savedKeys[field].length > 0;

  const fields: { key: keyof Keys; label: string; placeholder: string; isUrl?: boolean }[] = [
    { key: 'openai', label: 'OpenAI API Key', placeholder: 'sk-...' },
    { key: 'anthropic', label: 'Anthropic API Key', placeholder: 'sk-ant-...' },
    { key: 'google', label: 'Google API Key', placeholder: 'AIza...' },
    { key: 'xai', label: 'xAI API Key', placeholder: 'xai-...' },
    { key: 'ollamaUrl', label: 'Ollama URL', placeholder: 'http://localhost:11434', isUrl: true },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 bg-[#141416] border border-[#2a2a2e] rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a2e]">
          <div className="flex items-center gap-2">
            <Key className="w-5 h-5 text-[#7c6ff7]" />
            <h2 className="text-lg font-semibold text-[#f0f0f5]">API Keys (BYOK)</h2>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg hover:bg-[#2a2a2e] text-[#6b6b7a] hover:text-[#f0f0f5] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-[#6b6b7a]">
            Keys are stored locally in your browser and never sent to any server except the respective provider.
          </p>

          {fields.map(({ key, label, placeholder, isUrl }) => (
            <div key={key}>
              <div className="flex items-center gap-2 mb-1.5">
                <label className="text-sm font-medium text-[#f0f0f5]">{label}</label>
                {isSaved(key) && (
                  <span className="flex items-center gap-1 text-xs text-emerald-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                    Saved
                  </span>
                )}
              </div>
              <div className="relative">
                <input
                  type={isUrl || show[key] ? 'text' : 'password'}
                  value={keys[key]}
                  onChange={(e) => setKeys((prev) => ({ ...prev, [key]: e.target.value }))}
                  placeholder={placeholder}
                  className="w-full bg-[#0d0d0f] border border-[#2a2a2e] rounded-lg px-3 py-2.5 text-sm text-[#f0f0f5] placeholder-[#6b6b7a] focus:outline-none focus:border-[#7c6ff7] focus:ring-1 focus:ring-[#7c6ff7] transition-all pr-10"
                />
                {!isUrl && (
                  <button
                    type="button"
                    onClick={() => toggleShow(key)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6b6b7a] hover:text-[#f0f0f5] transition-colors"
                  >
                    {show[key] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#2a2a2e] flex items-center justify-between">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm text-[#6b6b7a] hover:text-[#f0f0f5] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-5 py-2 bg-[#7c6ff7] hover:bg-[#6366f1] text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Save className="w-4 h-4" />
            {saved ? 'Saved!' : 'Save Keys'}
          </button>
        </div>
      </div>
    </div>
  );
}