import { BrowserRouter, Routes, Route } from "react-router-dom";

import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";


// User pages
import UserDashboard from "./pages/user/Dashboard";
import Booking from "./pages/user/Booking";
import Payment from "./pages/user/Payment";
import History from "./pages/user/History";

// Owner pages
import OwnerDashboard from "./pages/owner/Dashboard";
import OwnerParkings from "./pages/owner/Parkings";
import AddParking from "./pages/owner/AddParking";
import OwnerBookings from "./pages/owner/Bookings";
import GateScan from "./pages/owner/GateScan";

// Context & protection
import ProtectedRoute from "./components/ProtectedRoute";
import { AuthProvider } from "./context/AuthContext";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
            {/* Public routes */}
            <Route path="/" element={<Landing />} />
            <Route path="/auth" element={<Auth />} />

            {/* USER ROUTES */}
            <Route
              path="/user/dashboard"
              element={
                <ProtectedRoute role="USER">
                  <UserDashboard />
                </ProtectedRoute>
              }
            />

            <Route
              path="/user/booking"
              element={
                <ProtectedRoute role="USER">
                  <Booking />
                </ProtectedRoute>
              }
            />

            <Route
              path="/user/payment"
              element={
                <ProtectedRoute role="USER">
                  <Payment />
                </ProtectedRoute>
              }
            />

            <Route
              path="/user/history"
              element={
                <ProtectedRoute role="USER">
                  <History />
                </ProtectedRoute>
              }
            />

            {/* OWNER ROUTES */}
            <Route
              path="/owner/dashboard"
              element={
                <ProtectedRoute role="OWNER">
                  <OwnerDashboard />
                </ProtectedRoute>
              }
            />

            <Route
              path="/owner/parkings"
              element={
                <ProtectedRoute role="OWNER">
                  <OwnerParkings />
                </ProtectedRoute>
              }
            />

            <Route
              path="/owner/add-parking"
              element={
                <ProtectedRoute role="OWNER">
                  <AddParking />
                </ProtectedRoute>
              }
            />

            <Route
              path="/owner/bookings"
              element={
                <ProtectedRoute role="OWNER">
                  <OwnerBookings />
                </ProtectedRoute>
              }
            />

            <Route
              path="/owner/gate-scan"
              element={
                <ProtectedRoute role="OWNER">
                  <GateScan />
                </ProtectedRoute>
              }
            />
            
            {/* Not Found Route */}
            <Route path="*" element={<NotFound />} />

          </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
