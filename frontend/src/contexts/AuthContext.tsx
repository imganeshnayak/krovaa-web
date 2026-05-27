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

const readCachedUser = () => {
  try {
    const rawUser = localStorage.getItem('authUser');
    return rawUser ? JSON.parse(rawUser) as AuthUser : null;
  } catch {
    return null;
  }
};

const persistSession = (token: string, user: AuthUser) => {
  localStorage.setItem('authToken', token);
  localStorage.setItem('authUser', JSON.stringify(user));
};

const clearSession = () => {
  localStorage.removeItem('authToken');
  localStorage.removeItem('authUser');
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
<<<<<<< HEAD
  const [user, setUser] = useState<AuthUser | null>(() => readCachedUser());
  const [token, setToken] = useState<string | null>(localStorage.getItem('authToken'));
  const [isLoading, setIsLoading] = useState(() => !localStorage.getItem('authToken'));
=======
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
>>>>>>> ee2d0fe7d18be5d32b2c610c7fbe95a0649a9269

  // Restore user on mount via cookie
  useEffect(() => {
    const restoreSession = async () => {
<<<<<<< HEAD
      const storedToken = localStorage.getItem('authToken');
      const cachedUser = readCachedUser();

      if (storedToken) {
        setToken(storedToken);
        if (cachedUser) {
          setUser(cachedUser);
          setIsLoading(false);
        }
        try {
          const userData = await getCurrentUser();
          setUser(userData);
          localStorage.setItem('authUser', JSON.stringify(userData));
        } catch (error) {
          // Only clear token on explicit auth errors; keep token for transient failures
          const status = (error as any)?.status;
          if (status === 401 || status === 403) {
            clearSession();
            setToken(null);
            setUser(null);
          } else {
            // transient error (network/provider); keep token and schedule a retry
            setTimeout(async () => {
              try {
                const retryUser = await getCurrentUser();
                setUser(retryUser);
                localStorage.setItem('authUser', JSON.stringify(retryUser));
              } catch (e) {
                // On retry failure, don't aggressively clear token here
              }
            }, 3000);
          }
        }
=======
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
>>>>>>> ee2d0fe7d18be5d32b2c610c7fbe95a0649a9269
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
<<<<<<< HEAD
      persistSession(response.token, response.user);
=======
>>>>>>> ee2d0fe7d18be5d32b2c610c7fbe95a0649a9269
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
<<<<<<< HEAD
      persistSession(response.token, response.user);
=======
>>>>>>> ee2d0fe7d18be5d32b2c610c7fbe95a0649a9269
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
<<<<<<< HEAD
      persistSession(response.token, response.user);
=======
>>>>>>> ee2d0fe7d18be5d32b2c610c7fbe95a0649a9269
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
<<<<<<< HEAD
    clearSession();
=======
    // Clean up old localStorage if present
    localStorage.removeItem('authToken');
>>>>>>> ee2d0fe7d18be5d32b2c610c7fbe95a0649a9269
  };

  const refreshUser = async () => {
    try {
      const userData = await getCurrentUser();
      setUser(userData);
<<<<<<< HEAD
      localStorage.setItem('authUser', JSON.stringify(userData));
=======
      setToken("cookie_session");
>>>>>>> ee2d0fe7d18be5d32b2c610c7fbe95a0649a9269
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
