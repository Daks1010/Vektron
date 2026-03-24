/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect } from 'react';
import { Layout } from './components/Layout';
import { Auth } from './components/Auth';
import { useStore } from './store/useStore';
import { supabase } from './lib/supabase';

export default function App() {
  const { user, setUser } = useStore();

  useEffect(() => {
    if (!import.meta.env.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL === 'https://placeholder.supabase.co') return;

    // Check active sessions and sets the user
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    }).catch(console.error);

    // Listen for changes on auth state (logged in, signed out, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription?.unsubscribe();
  }, [setUser]);

  if (!user) {
    return <Auth />;
  }

  return <Layout />;
}
