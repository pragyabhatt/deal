import React, { createContext, useState, useEffect, useContext } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [accessToken, setAccessToken] = useState(() => localStorage.getItem('access_token'));
  const [refreshToken, setRefreshToken] = useState(() => localStorage.getItem('refresh_token'));
  const [loading, setLoading] = useState(true);

  // Recover session on mount
  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser && accessToken) {
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, [accessToken]);

  const login = async (username, password) => {
    const formData = new FormData();
    formData.append('username', username);
    formData.append('password', password);

    const response = await fetch('/api/auth/login', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.detail || 'Failed to authenticate');
    }

    const data = await response.json();
    
    // Save to state
    setAccessToken(data.access_token);
    setRefreshToken(data.refresh_token);
    const userData = { username: data.username, role: data.role };
    setUser(userData);

    // Save to storage
    localStorage.setItem('access_token', data.access_token);
    localStorage.setItem('refresh_token', data.refresh_token);
    localStorage.setItem('user', JSON.stringify(userData));
    
    return userData;
  };

  const logout = async () => {
    if (refreshToken) {
      const formData = new FormData();
      formData.append('refresh_token', refreshToken);
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          body: formData,
        });
      } catch (e) {
        console.error('Logout request failed', e);
      }
    }

    // Clear state
    setAccessToken(null);
    setRefreshToken(null);
    setUser(null);

    // Clear storage
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
  };

  // Dedicated secure HTTP fetcher wrapping API requests
  const apiFetch = async (url, options = {}) => {
    let token = accessToken;
    
    // Auto refresh mechanism helper
    const makeRequest = async (tokenToUse) => {
      const headers = {
        ...options.headers,
      };
      
      if (tokenToUse) {
        headers['Authorization'] = `Bearer ${tokenToUse}`;
      }
      
      return await fetch(url, {
        ...options,
        headers,
      });
    };

    let res = await makeRequest(token);

    // If unauthorized, token might have expired (15-min limit)
    // Attempt automatic refresh of access token using refresh token (7-day lifespan)
    if (res.status === 401 && refreshToken) {
      try {
        const formData = new FormData();
        formData.append('refresh_token', refreshToken);
        
        const refreshRes = await fetch('/api/auth/refresh', {
          method: 'POST',
          body: formData,
        });

        if (refreshRes.ok) {
          const refreshData = await refreshRes.json();
          const newAccess = refreshData.access_token;
          
          setAccessToken(newAccess);
          localStorage.setItem('access_token', newAccess);
          
          // Re-attempt original request with new access token
          res = await makeRequest(newAccess);
        } else {
          // Refresh token expired or revoked, force logout
          logout();
        }
      } catch (err) {
        console.error('Auto token refresh failed', err);
        logout();
      }
    }

    return res;
  };

  const value = {
    user,
    accessToken,
    loading,
    login,
    logout,
    apiFetch,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
export default AuthContext;
