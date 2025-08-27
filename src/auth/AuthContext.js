import React, { createContext, useContext, useState, useEffect } from 'react';

export const SCREEN_ROUTES = {
  user: '/users',
  dashboard: '/dashboard',
  reports: '/reports',
  settings: '/settings',
};

const DEFAULT_ROUTE = '/dashboard';

const AuthContext = createContext();

// Auth Provider Component
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check for existing token on app load
  useEffect(() => {
    const storedToken = localStorage.getItem('authToken');
    const storedUser = localStorage.getItem('userData');
    
    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
    }
    
    setLoading(false);
  }, []);

  // Login function
  const login = (token, userData) => {
    setToken(token);
    setUser(userData);
    
    // Store in localStorage for persistence
    localStorage.setItem('authToken', token);
    localStorage.setItem('userData', JSON.stringify(userData));
  };

  // Logout function
  const logout = () => {
    setToken(null);
    setUser(null);
    
    localStorage.removeItem('authToken');
    localStorage.removeItem('userData');
  };

  // Check if user has specific permission
  const hasPermission = (screen, permission) => {
    if (!user || !user.permissions) return false;
    
    // Check if user has manage permission for all screens
    if (user.permissions['*']?.includes('manage')) return true;
    
    // Check specific screen permissions
    return user.permissions[screen]?.includes(permission) || false;
  };

  // Check if user has any of the provided permissions
  const hasAnyPermission = (screen, permissions) => {
    return permissions.some(permission => hasPermission(screen, permission));
  };

  // Check if user has a specific role
  const hasRole = (roleName) => {
    return user && user.role && user.role.name === roleName;
  };
  // Get the redirect route based on user permissions
const getRedirectRoute = (userData = null) => {
  // Use the passed userData or fall back to context user
  const targetUser = userData || user;
  
  if (!targetUser || !targetUser.permissions) {
    return DEFAULT_ROUTE;
  }
  
  // Check each screen in order of priority
  for (const screen of Object.keys(SCREEN_ROUTES)) {
    
    // Check if the screen exists in permissions and has at least one permission
    if (targetUser.permissions.hasOwnProperty(screen) && 
        Array.isArray(targetUser.permissions[screen]) && 
        targetUser.permissions[screen].length > 0) {
      return SCREEN_ROUTES[screen];
    }
  }
  return DEFAULT_ROUTE;
};


  const value = {
    user,
    token,
    login,
    logout,
    hasPermission,
    hasAnyPermission,
    hasRole,
    getRedirectRoute,
    isAuthenticated: !!token,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Auth context use hook
export const useAuth = () => {
  const context = useContext(AuthContext);
  
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
};