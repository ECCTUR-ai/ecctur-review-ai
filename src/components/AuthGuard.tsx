import React, { useEffect, useState, createContext, useContext } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { rbacService } from '@/services/rbacService';
import { ShieldAlert } from 'lucide-react';

interface AuthContextType {
  userId: string | null;
  role: string | null;
  permissions: string[];
  loading: boolean;
  hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextType>({
  userId: null,
  role: null,
  permissions: [],
  loading: true,
  hasPermission: () => false
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Initial load
    const loadSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setUserId(session.user.id);
          const rbac = await rbacService.getUserRoleAndPermissions(session.user.id);
          setRole(rbac.role);
          setPermissions(rbac.permissions);
        } else {
          setUserId(null);
          setRole(null);
          setPermissions([]);
        }
      } catch (err) {
        console.error('Error loading session:', err);
      } finally {
        setLoading(false);
      }
    };

    loadSession();

    // 2. Auth state subscription
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setLoading(true);
      if (session?.user) {
        setUserId(session.user.id);
        const rbac = await rbacService.getUserRoleAndPermissions(session.user.id);
        setRole(rbac.role);
        setPermissions(rbac.permissions);
      } else {
        setUserId(null);
        setRole(null);
        setPermissions([]);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const hasPermission = (permission: string): boolean => {
    if (role?.toLowerCase() === 'super admin') return true;
    return permissions.includes(permission);
  };

  return (
    <AuthContext.Provider value={{ userId, role, permissions, loading, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
}

interface AuthGuardProps {
  children: React.ReactNode;
  requiredPermission?: string;
}

export function AuthGuard({ children, requiredPermission }: AuthGuardProps) {
  const { userId, hasPermission, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#060814] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-t-blue-500 border-white/[0.04] animate-spin" />
      </div>
    );
  }

  if (!userId) {
    return <Navigate to="/login" replace />;
  }

  if (requiredPermission && !hasPermission(requiredPermission)) {
    return (
      <div className="min-h-[60vh] flex flex-col justify-center items-center text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
          <ShieldAlert size={22} />
        </div>
        <div className="space-y-1.5 max-w-sm">
          <h3 className="text-sm font-bold text-slate-200">Access Denied</h3>
          <p className="text-xs text-slate-400">
            You do not possess the required permission clearance ({requiredPermission}) to view this workspace.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
