import { createContext, useContext, useState } from "react";
import api from "../api/api";
import { useNavigate } from "react-router-dom";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const token = localStorage.getItem("token");
    const role = localStorage.getItem("role");
    return token && role ? { role } : null;
  });

  const navigate = useNavigate();

  async function login(email, password) {
    const res = await api.post("/auth/login", {
      email,
      password,
    });

    localStorage.setItem("token", res.data.token);
    localStorage.setItem("role", res.data.role);

    setUser({ role: res.data.role });

    if (res.data.role === "USER") {
      navigate("/user/dashboard");
    } else {
      navigate("/owner/dashboard");
    }
  }

  async function register({ name, phone, email, password, role }) {
    await api.post("/auth/register", {
      name,
      phone,
      email,
      password,
      role,
    });

    navigate("/auth");
  }

  function logout() {
    localStorage.clear();
    setUser(null);
    navigate("/auth");
  }

  return (
    <AuthContext.Provider
      value={{ user, login, register, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
