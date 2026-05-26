import React, { createContext, useContext, useState, useEffect } from 'react';
import { AuthUser, loginUser as apiLogin, registerUser as apiRegister, loginWithTelegram as apiTelegramLogin, getCurrentUser, logoutUser as apiLogout } from '@/lib/api';

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
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore user on mount via cookie
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const userData = await getCurrentUser();
        setUser(userData);
        // We set a dummy token so other parts of the app know we are logged in,
        // though the actual token is in the HttpOnly cookie.
        setToken("cookie_session");
      } catch (error) {
        // User is not logged in or cookie is invalid
        setToken(null);
        setUser(null);
      }
      setIsLoading(false);
    };

    restoreSession();
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await apiLogin({ email, password });
      setToken(response.token || "cookie_session");
      setUser(response.user);
      return response.user;
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithTelegram = async (data: any) => {
    setIsLoading(true);
    try {
      const response = await apiTelegramLogin(data);
      setToken(response.token || "cookie_session");
      setUser(response.user);
      return response.user;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (username: string, email: string, password: string, displayName: string | undefined, otp: string, profession?: string) => {
    setIsLoading(true);
    try {
      const response = await apiRegister({ username, email, password, display_name: displayName, otp, profession });
      setToken(response.token || "cookie_session");
      setUser(response.user);
      return response.user;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await apiLogout();
    } catch (e) {
      console.error("Logout failed", e);
    }
    setUser(null);
    setToken(null);
    // Clean up old localStorage if present
    localStorage.removeItem('authToken');
  };

  const refreshUser = async () => {
    try {
      const userData = await getCurrentUser();
      setUser(userData);
      setToken("cookie_session");
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
