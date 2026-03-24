import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { Send, Bot, User, Cpu, Settings2, Plus, Square } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  modelId?: string;
  timestamp: number;
}

export function ChatArea() {
  const { isRightPanelOpen, toggleRightPanel, models, setModels } = useStore();
  const [input, setInput] = useState('');
  const [showModelSelect, setShowModelSelect] = useState(false);
  const [modelSearch, setModelSearch] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content:
        'Hello! I am Vektron, your AI team workspace. Tag **@ollama** for your local Ollama (or pick a pulled model like **@qwen3.5:9b**), tag other models with `@`, or ask a question and I will route it to the best model.',
      modelId: 'system',
      timestamp: Date.now(),
    },
  ]);
  const [isTyping, setIsTyping] = useState(false);
  /** True while routing, waiting, or streaming a reply (enables Stop and blocks Send). */
  const [isGenerating, setIsGenerating] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/v1/models/ollama')
      .then((r) => r.json())
      .then((data: { models?: { id: string; name: string; provider: string }[] }) => {
        if (cancelled || !data.models?.length) return;
        setModels((prev) => {
          const seen = new Set(prev.map((m) => m.id));
          const extra = data.models!
            .filter((m) => !seen.has(m.id))
            .map((m) => ({
              id: m.id,
              name: m.name,
              provider: 'ollama' as const,
              enabled: true,
            }));
          return extra.length ? [...prev, ...extra] : prev;
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [setModels]);

  const handleSend = async () => {
    if (isGenerating) return;
    if (!input.trim()) return;

    if (input.trim().startsWith('/debate ')) {
      const topic = input.trim().replace('/debate ', '');
      
      const debateMsg: Message = {
        id: Date.now().toString(),
        role: 'user',
        content: `*Started a debate on:* ${topic}`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, debateMsg]);
      setInput('');
      setIsTyping(true);
      setIsGenerating(true);
      const debateAbort = new AbortController();
      abortControllerRef.current = debateAbort;

      try {
        const response = await fetch('/api/v1/debate/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ topic }),
          signal: debateAbort.signal,
        });
        
        const data = await response.json();
        
        const assistantMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `Debate session started! (Session ID: ${data.session_id})\n\n**Topic:** ${topic}\n\n*Models are preparing their opening statements...*`,
          modelId: 'system',
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } catch (e: unknown) {
        if ((e as Error)?.name !== 'AbortError') console.error(e);
      } finally {
        setIsTyping(false);
        setIsGenerating(false);
        abortControllerRef.current = null;
      }
      return;
    }

    const newUserMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, newUserMsg]);
    setInput('');
    setIsTyping(true);
    setIsGenerating(true);
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    let streamingAssistantId: string | null = null;

    try {
      // 1. Auto-route if no specific model is tagged
      let targetModelId = 'gpt-4o'; // default
      let reasoning = '';
      
      const match = newUserMsg.content.match(/@([a-zA-Z0-9_.:-]+)/);
      if (match) {
        const tag = match[1];
        const taggedModel =
          models.find((m) => m.id === tag) ||
          models.find(
            (m) =>
              m.id.includes(tag) || m.name.toLowerCase().includes(tag.toLowerCase()),
          );
        if (taggedModel) {
          targetModelId = taggedModel.id;
        }
      } else {
        const routeRes = await fetch('/api/v1/chat/route', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: newUserMsg.content }),
          signal: abortController.signal,
        });
        if (routeRes.ok) {
          const routeData = await routeRes.json();
          targetModelId = routeData.modelId;
          reasoning = routeData.reasoning;
        }
      }

      const targetModel = models.find((m) => m.id === targetModelId);

      const newAssistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: reasoning ? `*Auto-routed: ${reasoning}*\n\n` : '',
        modelId: targetModelId,
        timestamp: Date.now(),
      };
      streamingAssistantId = newAssistantMsg.id;

      setMessages((prev) => [...prev, newAssistantMsg]);
      setIsTyping(false);

      const storedKeys = localStorage.getItem('vektron_keys');
      const keys = storedKeys ? JSON.parse(storedKeys) : {};

      const response = await fetch('/api/v1/chat/message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-openai-key': keys.openai || '',
          'x-anthropic-key': keys.anthropic || '',
          'x-google-key': keys.google || '',
          'x-ollama-url': keys.ollamaUrl || '',
        },
        body: JSON.stringify({
          messages: [...messages, newUserMsg].map((m) => ({
            role: m.role,
            content: m.content,
          })),
          modelId: targetModelId,
          rolePrompt: targetModel?.rolePrompt,
        }),
        signal: abortController.signal,
      });

      if (!response.ok) throw new Error('Network response was not ok');
      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (abortController.signal.aborted) {
          await reader.cancel().catch(() => {});
          break;
        }
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // keep the last partial line in the buffer
        
        for (const line of lines) {
          if (line.trim() === '') continue;
          if (line.startsWith('data: ')) {
            const dataStr = line.replace('data: ', '');
            if (dataStr === '[DONE]') break;
            
            try {
              const data = JSON.parse(dataStr);
              if (data.error) {
                console.error(data.error);
                setMessages(prev => prev.map(m => m.id === newAssistantMsg.id ? { ...m, content: m.content + `\n\n**Error:** ${data.error}` } : m));
                break;
              }
              if (data.content) {
                setMessages(prev => prev.map(m => m.id === newAssistantMsg.id ? { ...m, content: m.content + data.content } : m));
              }
            } catch (e) {
              console.error('Error parsing stream data', e);
            }
          }
        }
      }
    } catch (error: unknown) {
      const err = error as Error & { name?: string };
      if (err?.name === 'AbortError') {
        if (streamingAssistantId) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === streamingAssistantId
                ? {
                    ...m,
                    content:
                      m.content +
                      (m.content.includes('*Generation stopped.*')
                        ? ''
                        : '\n\n*Generation stopped.*'),
                  }
                : m,
            ),
          );
        }
      } else if (streamingAssistantId) {
        console.error('Error sending message:', error);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === streamingAssistantId
              ? {
                  ...m,
                  content:
                    m.content +
                    `\n\n**Error:** ${err?.message || 'Request failed'}`,
                }
              : m,
          ),
        );
      } else {
        console.error('Error sending message:', error);
      }
    } finally {
      setIsTyping(false);
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  };

  const handleStop = () => {
    abortControllerRef.current?.abort();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showModelSelect) {
      if (e.key === 'Escape') {
        setShowModelSelect(false);
        return;
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const filteredModels = models.filter(m => m.id.toLowerCase().includes(modelSearch.toLowerCase()) || m.name.toLowerCase().includes(modelSearch.toLowerCase()));
        if (filteredModels.length > 0) {
          insertModel(filteredModels[0].id);
        }
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isGenerating) handleSend();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInput(val);
    
    const cursor = e.target.selectionStart;
    const textBeforeCursor = val.slice(0, cursor);
    const match = textBeforeCursor.match(/@([a-zA-Z0-9_.:-]*)$/);
    
    if (match) {
      setShowModelSelect(true);
      setModelSearch(match[1]);
    } else {
      setShowModelSelect(false);
    }
  };

  const insertModel = (modelId: string) => {
    const cursor = textareaRef.current?.selectionStart || input.length;
    const textBeforeCursor = input.slice(0, cursor);
    const textAfterCursor = input.slice(cursor);
    
    const newTextBefore = textBeforeCursor.replace(/@([a-zA-Z0-9_.:-]*)$/, `@${modelId} `);
    setInput(newTextBefore + textAfterCursor);
    setShowModelSelect(false);
    
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const newCursorPos = newTextBefore.length;
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  };

  const getModelColor = (modelId?: string) => {
    switch (modelId) {
      case 'gpt-4o': return 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10';
      case 'claude-3-5-sonnet': return 'text-amber-400 border-amber-400/30 bg-amber-400/10';
      case 'gemini-1.5-pro': return 'text-blue-400 border-blue-400/30 bg-blue-400/10';
      case 'ollama': return 'text-cyan-400 border-cyan-400/30 bg-cyan-400/10';
      default:
        if (modelId?.includes(':') || modelId?.startsWith('qwen') || modelId?.startsWith('llama')) {
          return 'text-cyan-400 border-cyan-400/30 bg-cyan-400/10';
        }
        return 'text-indigo-400 border-indigo-400/30 bg-indigo-400/10';
    }
  };

  const getModelName = (modelId?: string) => {
    if (modelId === 'system') return 'Vektron Auto-Router';
    const model = models.find((m) => m.id === modelId);
    return model ? model.name : modelId || 'Unknown Model';
  };

  return (
    <div className="flex flex-col h-full bg-[#0d0d0f] relative">
      {/* Header */}
      <div className="h-14 flex items-center justify-between px-6 border-b border-[#2a2a2e] bg-[#141416]/80 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <h1 className="font-semibold text-lg text-[#f0f0f5]">Current Session</h1>
          <span className="px-2 py-0.5 rounded-full bg-[#2a2a2e] text-xs font-medium text-[#6b6b7a]">
            {models.length} models
          </span>
        </div>
        <button
          onClick={toggleRightPanel}
          className={`p-2 rounded-md transition-colors ${
            isRightPanelOpen ? 'bg-[#7c6ff7] text-white' : 'hover:bg-[#2a2a2e] text-[#6b6b7a] hover:text-[#f0f0f5]'
          }`}
        >
          <Settings2 className="w-5 h-5" />
        </button>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-4 max-w-4xl mx-auto ${
              msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'
            }`}
          >
            {/* Avatar */}
            <div className="flex-shrink-0 mt-1">
              {msg.role === 'user' ? (
                <div className="w-8 h-8 rounded-full bg-[#7c6ff7] flex items-center justify-center">
                  <User className="w-5 h-5 text-white" />
                </div>
              ) : (
                <div className={`w-8 h-8 rounded-full flex items-center justify-center border ${getModelColor(msg.modelId)}`}>
                  {msg.modelId === 'system' ? <Cpu className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>
              )}
            </div>

            {/* Message Content */}
            <div className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} max-w-[80%]`}>
              {msg.role === 'assistant' && (
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-[#6b6b7a]">
                    {getModelName(msg.modelId)}
                  </span>
                  {msg.modelId !== 'system' && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border uppercase tracking-wider ${getModelColor(msg.modelId)}`}>
                      {msg.modelId}
                    </span>
                  )}
                </div>
              )}
              <div
                className={`px-4 py-3 rounded-2xl ${
                  msg.role === 'user'
                    ? 'bg-[#2a2a2e] text-[#f0f0f5] rounded-tr-sm'
                    : 'bg-[#141416] border border-[#2a2a2e] text-[#f0f0f5] rounded-tl-sm'
                }`}
              >
                <div className="prose prose-invert prose-sm max-w-none prose-pre:bg-[#0d0d0f] prose-pre:border prose-pre:border-[#2a2a2e]">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {msg.content}
                  </ReactMarkdown>
                </div>
              </div>
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex gap-4 max-w-4xl mx-auto">
            <div className="flex-shrink-0 mt-1">
              <div className="w-8 h-8 rounded-full flex items-center justify-center border border-[#2a2a2e] bg-[#141416]">
                <Bot className="w-4 h-4 text-[#6b6b7a] animate-pulse" />
              </div>
            </div>
            <div className="flex flex-col items-start">
              <div className="px-4 py-3 rounded-2xl bg-[#141416] border border-[#2a2a2e] rounded-tl-sm flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-[#6b6b7a] animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 rounded-full bg-[#6b6b7a] animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 rounded-full bg-[#6b6b7a] animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-[#0d0d0f] border-t border-[#2a2a2e]">
        <div className="max-w-4xl mx-auto relative">
          {showModelSelect && (
            <div className="absolute bottom-full left-12 mb-2 w-64 bg-[#141416] border border-[#2a2a2e] rounded-xl shadow-2xl overflow-hidden z-20">
              <div className="px-3 py-2 border-b border-[#2a2a2e] text-xs font-medium text-[#6b6b7a] uppercase tracking-wider">
                Select a model
              </div>
              <div className="max-h-48 overflow-y-auto p-1">
                {models
                  .filter(m => m.id.toLowerCase().includes(modelSearch.toLowerCase()) || m.name.toLowerCase().includes(modelSearch.toLowerCase()))
                  .map(m => (
                    <button
                      key={m.id}
                      onClick={() => insertModel(m.id)}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-[#2a2a2e] flex items-center gap-2 transition-colors"
                    >
                      <div className={`w-6 h-6 rounded flex items-center justify-center border ${getModelColor(m.id)}`}>
                        <Bot className="w-3 h-3" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm text-[#f0f0f5]">{m.name}</span>
                        <span className="text-[10px] text-[#6b6b7a] uppercase">{m.provider}</span>
                      </div>
                    </button>
                  ))}
                {models.filter(m => m.id.toLowerCase().includes(modelSearch.toLowerCase()) || m.name.toLowerCase().includes(modelSearch.toLowerCase())).length === 0 && (
                  <div className="px-3 py-4 text-center text-sm text-[#6b6b7a]">
                    No models found
                  </div>
                )}
              </div>
            </div>
          )}
          <div className="flex items-end gap-2 bg-[#141416] border border-[#2a2a2e] rounded-xl p-2 focus-within:border-[#7c6ff7] focus-within:ring-1 focus-within:ring-[#7c6ff7] transition-all">
            <button className="p-2 text-[#6b6b7a] hover:text-[#f0f0f5] transition-colors rounded-lg hover:bg-[#2a2a2e]">
              <Plus className="w-5 h-5" />
            </button>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Message Vektron... Use @ to tag a model, / for commands"
              className="flex-1 max-h-48 min-h-[44px] bg-transparent border-none focus:ring-0 resize-none py-2.5 text-[#f0f0f5] placeholder-[#6b6b7a] text-sm"
              rows={1}
              style={{ height: 'auto' }}
            />
            {isGenerating ? (
              <button
                type="button"
                onClick={handleStop}
                className="p-2 bg-[#3f3f46] hover:bg-[#52525b] text-[#f4f4f5] rounded-lg transition-colors flex-shrink-0 flex items-center gap-1.5 px-3"
                title="Stop generating"
              >
                <Square className="w-4 h-4 fill-current" />
                <span className="text-xs font-medium">Stop</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSend}
                disabled={!input.trim()}
                className="p-2 bg-[#7c6ff7] hover:bg-[#6366f1] disabled:bg-[#2a2a2e] disabled:text-[#6b6b7a] text-white rounded-lg transition-colors flex-shrink-0"
              >
                <Send className="w-5 h-5" />
              </button>
            )}
          </div>
          <div className="text-center mt-2 text-xs text-[#6b6b7a]">
            Vektron can make mistakes. Consider verifying important information.
          </div>
        </div>
      </div>
    </div>
  );
}
