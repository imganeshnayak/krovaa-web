import React, { createContext, useContext, useState, useEffect } from 'react';
import { AuthUser, loginUser as apiLogin, registerUser as apiRegister, loginWithTelegram as apiTelegramLogin, getCurrentUser } from '@/lib/api';

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  loginWithTelegram: (data: any) => Promise<AuthUser>;
  register: (username: string, email: string, password: string, displayName: string | undefined, otp: string, profession?: string) => Promise<AuthUser>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('authToken'));
  const [isLoading, setIsLoading] = useState(true);

  // Restore user on mount if token exists
  useEffect(() => {
    const restoreSession = async () => {
      const storedToken = localStorage.getItem('authToken');
      if (storedToken) {
        setToken(storedToken);
        try {
          const userData = await getCurrentUser();
          setUser(userData);
        } catch (error) {
          // Only clear token on explicit auth errors; keep token for transient failures
          const status = (error as any)?.status;
          if (status === 401 || status === 403) {
            localStorage.removeItem('authToken');
            setToken(null);
            setUser(null);
          } else {
            // transient error (network/provider); keep token and schedule a retry
            setTimeout(async () => {
              try {
                const retryUser = await getCurrentUser();
                setUser(retryUser);
              } catch (e) {
                // On retry failure, don't aggressively clear token here
              }
            }, 3000);
          }
        }
      }
      setIsLoading(false);
    };

    restoreSession();
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await apiLogin({ email, password });
      setToken(response.token);
      setUser(response.user);
      localStorage.setItem('authToken', response.token);
      return response.user;
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithTelegram = async (data: any) => {
    setIsLoading(true);
    try {
      const response = await apiTelegramLogin(data);
      setToken(response.token);
      setUser(response.user);
      localStorage.setItem('authToken', response.token);
      return response.user;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (username: string, email: string, password: string, displayName: string | undefined, otp: string, profession?: string) => {
    setIsLoading(true);
    try {
      const response = await apiRegister({ username, email, password, display_name: displayName, otp, profession });
      setToken(response.token);
      setUser(response.user);
      localStorage.setItem('authToken', response.token);
      return response.user;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('authToken');
  };

  const refreshUser = async () => {
    if (!token) return;
    try {
      const userData = await getCurrentUser();
      setUser(userData);
    } catch (error) {
      logout();
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, loginWithTelegram, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
