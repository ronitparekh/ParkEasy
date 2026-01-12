import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children, role }) {
  const { user } = useAuth();

  const token = localStorage.getItem("token");
  const userRole = String(user?.role ?? "")
    .trim()
    .toUpperCase();
  const requiredRole = String(role ?? "")
    .trim()
    .toUpperCase();

  if (!token || !userRole) return <Navigate to="/auth" replace />;

  if (requiredRole && userRole !== requiredRole) {
    if (userRole === "USER") {
      return <Navigate to="/user/dashboard" replace />;
    }
    if (userRole === "OWNER") {
      return <Navigate to="/owner/dashboard" replace />;
    }
    return <Navigate to="/auth" replace />;
  }

  return children;
}
