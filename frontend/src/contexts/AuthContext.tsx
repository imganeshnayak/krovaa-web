import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { AuthUser, getCurrentUser, loginUser as apiLogin, loginWithTelegram as apiTelegramLogin, logoutUser as apiLogout, registerUser as apiRegister } from "@/lib/api";

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
    const rawUser = localStorage.getItem("authUser");
    return rawUser ? (JSON.parse(rawUser) as AuthUser) : null;
  } catch {
    return null;
  }
};

const persistSession = (token: string, user: AuthUser) => {
  localStorage.setItem("authToken", token);
  localStorage.setItem("authUser", JSON.stringify(user));
};

const clearSession = () => {
  localStorage.removeItem("authToken");
  localStorage.removeItem("authUser");
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => readCachedUser());
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("authToken"));
  const [isLoading, setIsLoading] = useState(() => !localStorage.getItem("authToken"));

  useEffect(() => {
    const restoreSession = async () => {
      const storedToken = localStorage.getItem("authToken");
      const cachedUser = readCachedUser();

      if (storedToken) {
        setToken(storedToken);
        if (cachedUser) {
          setUser(cachedUser);
        }

        try {
          const userData = await getCurrentUser();
          setUser(userData);
          persistSession(storedToken, userData);
        } catch (error) {
          const status = (error as { status?: number })?.status;
          if (status === 401 || status === 403) {
            clearSession();
            setToken(null);
            setUser(null);
          } else if (cachedUser) {
            setUser(cachedUser);
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
      setToken(response.token || "cookie_session");
      setUser(response.user);
      persistSession(response.token || "cookie_session", response.user);
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
      persistSession(response.token || "cookie_session", response.user);
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
      persistSession(response.token || "cookie_session", response.user);
      return response.user;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await apiLogout();
    } catch (error) {
      console.error("Logout failed", error);
    }

    setUser(null);
    setToken(null);
    clearSession();
  };

  const refreshUser = async () => {
    try {
      const userData = await getCurrentUser();
      setUser(userData);
      persistSession(token || "cookie_session", userData);
    } catch {
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
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
