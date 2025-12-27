import { Dispatch, ReactNode, SetStateAction, createContext, useContext, useMemo, useState } from 'react';

export interface AuthUser {
  username: string;
  pin?: string;
  id?: string;
  role?: 'admin' | 'manager' | 'cashier';
}

export interface AuthContextType {
  isAuthenticated: boolean;
  setIsAuthenticated: Dispatch<SetStateAction<boolean>>;
  user: AuthUser | null;
  setUser: Dispatch<SetStateAction<AuthUser | null>>;
}

export const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: Readonly<{ children: ReactNode }>) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);

  const value = useMemo(() => {
    return {
      isAuthenticated,
      setIsAuthenticated,
      user,
      setUser,
    };
  }, [isAuthenticated, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuthContext = (): AuthContextType => {
  const context = useContext(AuthContext);

  if (context === null) {
    throw new Error('useAuthContext must be used within AuthProvider');
  }

  return context;
};
