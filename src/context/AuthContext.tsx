import React, { createContext, useContext, useEffect, useState } from 'react';
import { signInWithPopup, signOut as firebaseSignOut } from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase';
import { apiFetch, setAuthToken } from '../lib/api';

export interface UserAccount {
  id: string;
  email: string;
  fullName: string;
  mobile: string;
  roles: string[];
  activeRole: 'customer' | 'shopkeeper' | 'super_admin';
}

interface AuthContextValue {
  user: UserAccount | null;
  shopkeeper: { shopName: string; gstin?: string | null; shopAddress?: string } | null;
  loading: boolean;
  refreshUser: () => Promise<void>;
  loginWithGoogle: () => Promise<UserAccount>;
  loginWithEmail: (
    email: string,
    password: string,
    portal?: 'customer' | 'shopkeeper'
  ) => Promise<UserAccount>;
  registerCustomer: (payload: {
    fullName: string;
    mobile: string;
    email: string;
    password: string;
  }) => Promise<UserAccount>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({} as AuthContextValue);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserAccount | null>(null);
  const [shopkeeper, setShopkeeper] = useState<{
    shopName: string;
    gstin?: string | null;
    shopAddress?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    try {
      const res = await apiFetch<{ user: UserAccount | null; shopkeeper?: typeof shopkeeper }>(
        '/api/auth/me'
      );
      setUser(res.user);
      setShopkeeper(res.shopkeeper || null);
    } catch {
      setUser(null);
      setShopkeeper(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const loginWithGoogle = async () => {
    const cred = await signInWithPopup(auth, googleAuthProvider);
    const idToken = await cred.user.getIdToken();
    const res = await apiFetch<{ user: UserAccount; token: string }>('/api/auth/google', {
      method: 'POST',
      headers: { Authorization: `Bearer ${idToken}` },
    });
    setAuthToken(res.token);
    setUser(res.user);
    await refreshUser();
    return res.user;
  };

  const loginWithEmail = async (
    email: string,
    password: string,
    portal?: 'customer' | 'shopkeeper'
  ) => {
    const res = await apiFetch<{ user: UserAccount; token: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, portal }),
    });
    setAuthToken(res.token);
    setUser(res.user);
    await refreshUser();
    return res.user;
  };

  const registerCustomer = async (payload: {
    fullName: string;
    mobile: string;
    email: string;
    password: string;
  }) => {
    const res = await apiFetch<{ user: UserAccount; token: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setAuthToken(res.token);
    setUser(res.user);
    await refreshUser();
    return res.user;
  };

  const logout = async () => {
    await apiFetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
    await firebaseSignOut(auth).catch(() => undefined);
    setAuthToken(null);
    setUser(null);
    setShopkeeper(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        shopkeeper,
        loading,
        refreshUser,
        loginWithGoogle,
        loginWithEmail,
        registerCustomer,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
