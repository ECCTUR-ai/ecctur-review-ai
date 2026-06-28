import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import DashboardLayout from '@/layouts/DashboardLayout';
import Dashboard from '@/pages/Dashboard';
import Reviews from '@/pages/Reviews';
import Departments from '@/pages/Departments';
import Analytics from '@/pages/Analytics';
import WhatsApp from '@/pages/WhatsApp';
import Settings from '@/pages/Settings';
import Tasks from '@/pages/Tasks';
import Login from '@/pages/Login';
import Admin from '@/pages/Admin';
import { AuthProvider, AuthGuard, useAuth } from '@/components/AuthGuard';

// Environment flag (VITE_AUTH_ENABLED) controls authentication flow
const AUTH_ENABLED = import.meta.env.VITE_AUTH_ENABLED === 'true';

// Redirect authenticated users away from /login
function LoginRouteWrapper() {
  const { userId, loading } = useAuth();

  // If auth is disabled, bypass loading and redirect to dashboard instantly
  if (!AUTH_ENABLED) {
    return <Navigate to="/" replace />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#060814] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-t-blue-500 border-white/[0.04] animate-spin" />
      </div>
    );
  }

  // Redirect to dashboard if user session is active
  if (userId) {
    return <Navigate to="/" replace />;
  }

  return <Login />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginRouteWrapper />} />
          
          <Route element={<DashboardLayout />}>
            <Route
              path="/"
              element={
                <AuthGuard requiredPermission="view:dashboard">
                  <Dashboard />
                </AuthGuard>
              }
            />
            <Route
              path="/reviews"
              element={
                <AuthGuard requiredPermission="view:reviews">
                  <Reviews />
                </AuthGuard>
              }
            />
            <Route
              path="/tasks"
              element={
                <AuthGuard requiredPermission="view:tasks">
                  <Tasks />
                </AuthGuard>
              }
            />
            <Route
              path="/departments"
              element={
                <AuthGuard requiredPermission="view:departments">
                  <Departments />
                </AuthGuard>
              }
            />
            <Route
              path="/analytics"
              element={
                <AuthGuard requiredPermission="view:analytics">
                  <Analytics />
                </AuthGuard>
              }
            />
            <Route
              path="/whatsapp"
              element={
                <AuthGuard requiredPermission="view:whatsapp">
                  <WhatsApp />
                </AuthGuard>
              }
            />
            <Route
              path="/settings"
              element={
                <AuthGuard requiredPermission="view:settings">
                  <Settings />
                </AuthGuard>
              }
            />
            <Route
              path="/admin"
              element={
                <AuthGuard requiredPermission="view:settings">
                  <Admin />
                </AuthGuard>
              }
            />
          </Route>
          
          {/* Fallback wildcard route redirects unmatched paths back to root */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
