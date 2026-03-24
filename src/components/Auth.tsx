import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useStore } from '../store/useStore';
import { Zap, Mail, Lock, Loader2 } from 'lucide-react';

export function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (!import.meta.env.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL === 'https://placeholder.supabase.co') {
        // Mock authentication for preview mode
        useStore.getState().setUser({ id: 'preview-user', email: email || 'preview@example.com' } as any);
        return;
      }

      const { error } = isLogin
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

      if (error) throw error;
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0d0d0f] flex items-center justify-center p-4 font-sans text-[#f0f0f5]">
      <div className="w-full max-w-md bg-[#141416] border border-[#2a2a2e] rounded-2xl p-8 shadow-2xl">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 bg-[#7c6ff7]/20 rounded-xl flex items-center justify-center mb-4 border border-[#7c6ff7]/30">
            <Zap className="w-6 h-6 text-[#7c6ff7]" />
          </div>
          <h1 className="text-2xl font-bold font-mono tracking-tight">Vektron</h1>
          <p className="text-[#6b6b7a] text-sm mt-2 text-center">
            Universal AI Team Workspace
          </p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}
          
          <div className="space-y-1">
            <label className="text-xs font-medium text-[#6b6b7a] uppercase tracking-wider">Email</label>
            <div className="relative">
              <Mail className="w-5 h-5 text-[#6b6b7a] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#0d0d0f] border border-[#2a2a2e] rounded-lg pl-10 pr-4 py-2.5 text-sm focus:border-[#7c6ff7] focus:ring-1 focus:ring-[#7c6ff7] outline-none transition-all"
                placeholder="you@example.com"
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-[#6b6b7a] uppercase tracking-wider">Password</label>
            <div className="relative">
              <Lock className="w-5 h-5 text-[#6b6b7a] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#0d0d0f] border border-[#2a2a2e] rounded-lg pl-10 pr-4 py-2.5 text-sm focus:border-[#7c6ff7] focus:ring-1 focus:ring-[#7c6ff7] outline-none transition-all"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#7c6ff7] hover:bg-[#6366f1] text-white py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 mt-6 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (isLogin ? 'Sign In' : 'Create Account')}
          </button>
        </form>

        <div className="mt-6 text-center flex flex-col gap-2">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-sm text-[#6b6b7a] hover:text-[#f0f0f5] transition-colors"
          >
            {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
          </button>
          
          <button
            onClick={() => useStore.getState().setUser({ id: 'preview-user', email: 'preview@example.com' } as any)}
            className="text-xs text-[#7c6ff7] hover:underline transition-colors mt-4"
          >
            Skip Auth (Preview Mode)
          </button>
        </div>
      </div>
    </div>
  );
}
