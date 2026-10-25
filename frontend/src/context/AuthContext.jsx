import { createContext, useContext, useEffect, useState } from "react";
import { getCurrentUser } from "../services/auth";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem("user");
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const [token, setToken] = useState(() => {
    return localStorage.getItem("token");
  });

  useEffect(() => {
    const loadUser = async () => {
      const savedToken = localStorage.getItem("token");

      if (!savedToken) {
        return;
      }

      try {
        const currentUser = await getCurrentUser();

        setUser(currentUser);
        localStorage.setItem("user", JSON.stringify(currentUser));
      } catch {
        logout();
      }
    };

    loadUser();
  }, []);

  const login = (userData, jwtToken) => {
    setUser(userData);
    setToken(jwtToken);

    localStorage.setItem("token", jwtToken);
    localStorage.setItem("user", JSON.stringify(userData));
  };

  const logout = () => {
    setUser(null);
    setToken(null);

    localStorage.removeItem("token");
    localStorage.removeItem("user");
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}