import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { auth as authApi, setToken } from '@/lib/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  const checkUserAuth = useCallback(async () => {
    setIsLoadingAuth(true);
    setAuthError(null);
    try {
      const currentUser = await authApi.me();
      setUser(currentUser);
      setIsAuthenticated(true);
    } catch (err) {
      setUser(null);
      setIsAuthenticated(false);
      if (err.status === 401 || err.status === 403) {
        setToken(null);
      }
    } finally {
      setIsLoadingAuth(false);
      setAuthChecked(true);
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('ds_token');
    if (token) {
      checkUserAuth();
    } else {
      setIsLoadingAuth(false);
      setAuthChecked(true);
    }
  }, [checkUserAuth]);

  const logout = () => {
    setToken(null);
    setUser(null);
    setIsAuthenticated(false);
    window.location.href = '/';
  };

  const navigateToLogin = () => {
    window.location.href = '/admin/access?returnTo=' + encodeURIComponent(window.location.pathname);
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoadingAuth,
      isLoadingPublicSettings: false,
      authError,
      authChecked,
      logout,
      navigateToLogin,
      checkUserAuth,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
