import { useEffect, useState, useCallback } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase, getProfile } from '../lib/supabase';
import { useRunStore } from '../stores/runStore';
import type { Profile } from '../types';

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const { setProfile, setLoading: setStoreLoading, reset } = useRunStore();

  // Load user profile
  const loadProfile = useCallback(async (userId: string) => {
    try {
      const profile = await getProfile(userId);
      setProfile(profile as Profile);
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  }, [setProfile]);

  // Initialize auth state
  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        loadProfile(session.user.id);
      }

      setLoading(false);
      setStoreLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (event === 'SIGNED_IN' && session?.user) {
          await loadProfile(session.user.id);
        } else if (event === 'SIGNED_OUT') {
          reset();
        }

        setLoading(false);
        setStoreLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [loadProfile, setStoreLoading, reset]);

  // Sign up with email
  const signUp = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) throw error;
    return data;
  };

  // Sign in with email
  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    return data;
  };

  // Sign in with magic link
  const signInWithMagicLink = async (email: string) => {
    const { data, error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: 'runna://auth-callback',
      },
    });

    if (error) throw error;
    return data;
  };

  // Sign out
  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  // Refresh profile
  const refreshProfile = async () => {
    if (user) {
      await loadProfile(user.id);
    }
  };

  return {
    session,
    user,
    loading,
    signUp,
    signIn,
    signInWithMagicLink,
    signOut,
    refreshProfile,
  };
}
