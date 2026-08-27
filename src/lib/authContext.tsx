'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '@/types';

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  loading: true,
  login: async () => ({ success: false }),
  logout: () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check saved session in localStorage
    const saved = localStorage.getItem('kangkebab_user_session');
    if (saved) {
      try {
        setCurrentUser(JSON.parse(saved));
      } catch (err) {
        localStorage.removeItem('kangkebab_user_session');
      }
    }
    setLoading(false);
  }, []);

  const login = async (email: string, pass: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/auth', { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } });
      const data = await res.json();
      if (!data.success) return { success: false, error: data.error || 'Gagal memuat data pengguna dari server.' };

      const users: User[] = data.data.users;
      const found = users.find(
        (u) => u.email.toLowerCase() === email.trim().toLowerCase() && (u as any).password === pass
      );

      if (found) {
        setCurrentUser(found);
        localStorage.setItem('kangkebab_user_session', JSON.stringify(found));
        return { success: true };
      }
      return { success: false };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem('kangkebab_user_session');
  };

  return (
    <AuthContext.Provider value={{ currentUser, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
