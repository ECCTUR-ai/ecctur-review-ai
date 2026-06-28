import React, { useState, useEffect, useCallback } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import { notificationService } from '@/services/notificationService';
// Environment flag controls auth behavior in UI rendering
const AUTH_ENABLED = import.meta.env.VITE_AUTH_ENABLED === 'true';
import { hotelService } from '@/services/hotelService';
import { AppNotification, Hotel } from '@/types';
import { useAuth } from '@/components/AuthGuard';
import { 
  LayoutDashboard, 
  MessageSquare, 
  Building2, 
  TrendingUp, 
  MessageCircle, 
  Settings, 
  ChevronLeft, 
  ChevronRight,
  Bell,
  Wifi,
  WifiOff,
  User,
  LogOut,
  CheckSquare,
  CheckCircle,
  Eye,
  AlertTriangle,
  Info,
  Building,
  Globe
} from 'lucide-react';

interface SidebarItem {
  name: string;
  path: string;
  icon: React.ComponentType<any>;
  permission: string;
  tKey: string;
}

const sidebarItems: SidebarItem[] = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard, permission: 'view:dashboard', tKey: 'sidebar.dashboard' },
  { name: 'Reviews', path: '/reviews', icon: MessageSquare, permission: 'view:reviews', tKey: 'sidebar.reviews' },
  { name: 'Tasks', path: '/tasks', icon: CheckSquare, permission: 'view:tasks', tKey: 'sidebar.tasks' },
  { name: 'Departments', path: '/departments', icon: Building2, permission: 'view:departments', tKey: 'sidebar.departments' },
  { name: 'Analytics', path: '/analytics', icon: TrendingUp, permission: 'view:analytics', tKey: 'sidebar.analytics' },
  { name: 'WhatsApp', path: '/whatsapp', icon: MessageCircle, permission: 'view:whatsapp', tKey: 'sidebar.whatsapp' },
  { name: 'Settings', path: '/settings', icon: Settings, permission: 'view:settings', tKey: 'sidebar.settings' },
];

export default function DashboardLayout() {
  const { permissions, role } = useAuth();
  const { t, i18n } = useTranslation();
  const [collapsed, setCollapsed] = useState(false);
  const [isApiOnline, setIsApiOnline] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  
  // Multi-hotel SaaS states
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [currentHotelId, setCurrentHotelId] = useState<string>(
    localStorage.getItem('saas_selected_hotel_id') || ''
  );
  
  const location = useLocation();

  // Load Hotels list on mount
  useEffect(() => {
    const loadHotels = async () => {
      console.log('[Hotel Loader] Initializing...');
      console.log('[Hotel Loader] Supabase URL:', import.meta.env.VITE_SUPABASE_URL);
      try {
        // 1. Fetch organizations dynamically
        console.log('[Hotel Loader] Querying organizations...');
        const orgs = await hotelService.getOrganizations();
        console.log('[Hotel Loader] Organizations result:', orgs);
        
        // 2. Find the ECCTUR organization or fall back to the first one
        const eccturOrg = orgs.find(o => o.name === 'ECCTUR') || orgs[0];
        const orgId = eccturOrg ? eccturOrg.id : '7cc77cc7-7cc7-7cc7-7cc7-7cc77cc77cc7';
        console.log('[Hotel Loader] Selected Organization ID:', orgId);

        // 3. Load hotels filtered by current organization ID from Supabase
        console.log('[Hotel Loader] Querying hotels...');
        const data = await hotelService.getHotels(orgId);
        console.log('[Hotel Loader] Hotels result:', data);
        console.log('[Hotel Loader] Number of hotels returned:', data.length);
        
        setHotels(data);
        
        if (data.length > 0) {
          if (data.length === 1) {
            // If only one hotel exists, select it automatically
            setCurrentHotelId(data[0].id);
            localStorage.setItem('saas_selected_hotel_id', data[0].id);
          } else {
            // Restore last selected hotel from localStorage
            const cached = localStorage.getItem('saas_selected_hotel_id');
            if (cached && data.some(h => h.id === cached)) {
              setCurrentHotelId(cached);
            } else {
              setCurrentHotelId(data[0].id);
              localStorage.setItem('saas_selected_hotel_id', data[0].id);
            }
          }
        }
      } catch (err: any) {
        console.error('[Hotel Loader] Query failed with error:', err);
        // Show the error in browser console explicitly
        console.error('[Hotel Loader] Detailed Error object:', JSON.stringify(err, Object.getOwnPropertyNames(err)));
      }
    };
    loadHotels();
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      const data = await notificationService.getNotifications(currentHotelId || undefined);
      setNotifications(data);
      setUnreadCount(data.filter(n => !n.isRead).length);
    } catch (e) {
      console.error('Failed to load notifications:', e);
    }
  }, [currentHotelId]);

  useEffect(() => {
    if (!currentHotelId) return;
    fetchNotifications();

    // Subscribe to realtime changes on notifications table
    const channel = supabase
      .channel('realtime-notifications')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications' },
        () => {
          fetchNotifications();
        }
      )
      .subscribe();

    // Also subscribe to reviews insertion events to automatically persist notifications on client-side
    const reviewsChannel = supabase
      .channel('layout-realtime-reviews')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'reviews' },
        async (payload: any) => {
          const platform = payload.new?.source || 'Google';
          const rating = payload.new?.rating || 5;
          const guestName = payload.new?.guest_name || 'Guest';
          const rHotelId = payload.new?.hotel_id;

          try {
            await notificationService.createNotification({
              type: 'new_review',
              title: `New ${platform} Review Ingested`,
              message: `Received a new ${rating}-star review from ${guestName}.`,
              hotelId: rHotelId
            });

            if (rating <= 2) {
              await notificationService.createNotification({
                type: 'high_risk',
                title: 'High Risk Review Detected',
                message: `Critical alert: Low ${rating}-star rating submitted by ${guestName}.`,
                hotelId: rHotelId
              });
            }
          } catch (err) {
            console.error('Failed to create background notification:', err);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(reviewsChannel);
    };
  }, [currentHotelId, fetchNotifications]);

  const handleMarkAsRead = async (id: string) => {
    try {
      await notificationService.markAsRead(id);
      fetchNotifications();
    } catch (e) {
      console.error(e);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationService.markAllAsRead(currentHotelId || undefined);
      fetchNotifications();
    } catch (e) {
      console.error(e);
    }
  };

  const handleHotelChange = (id: string) => {
    setCurrentHotelId(id);
    localStorage.setItem('saas_selected_hotel_id', id);
  };

  const getPageTitle = () => {
    const current = sidebarItems.find(item => item.path === location.pathname);
    return current ? current.name : 'Platform';
  };

  return (
    <div className="min-h-screen flex text-slate-100 bg-[#060814] premium-grid-bg">
      {/* Premium Sidebar */}
      <motion.aside
        animate={{ width: collapsed ? 80 : 260 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className="h-screen sticky top-0 sidebar-glass flex flex-col z-20"
      >
        {/* Logo Section */}
        <div className="h-20 flex items-center justify-between px-6 border-b border-white/[0.04]">
          <AnimatePresence mode="wait">
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="flex items-center gap-2"
              >
                <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center font-bold text-white shadow-md shadow-blue-500/20">
                  E
                </div>
                <span className="font-semibold text-base tracking-wide bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
                  ECCTUR AI
                </span>
              </motion.div>
            )}
          </AnimatePresence>
          {collapsed && (
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center font-bold text-white mx-auto">
              E
            </div>
          )}
          <button 
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.06] transition-colors"
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
          {sidebarItems.map((item) => {
            // When AUTH_ENABLED is false (development mode), bypass permission filtering
            if (AUTH_ENABLED && item.permission && !permissions.includes(item.permission)) {
              return null;
            }
            const isActive = location.pathname === item.path;
            const Icon = item.icon;

            return (
              <Link key={item.path} to={item.path}>
                <div className="relative group">
                  <motion.div
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                      isActive 
                        ? 'bg-blue-600/10 border border-blue-500/20 text-blue-400 shadow-[inset_0_0_12px_rgba(59,130,246,0.06)]' 
                        : 'border border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/[0.02]'
                    }`}
                  >
                    <Icon size={20} className={isActive ? 'text-blue-400' : 'text-slate-400 group-hover:text-slate-200'} />
                    {!collapsed && (
                      <span className="text-sm font-medium">{t(item.tKey)}</span>
                    )}
                  </motion.div>
                  {isActive && !collapsed && (
                    <motion.div 
                      layoutId="active-indicator"
                      className="absolute left-0 top-1/4 bottom-1/4 w-1 bg-blue-500 rounded-r"
                    />
                  )}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Profile / Footer Section */}
        <div className="p-4 border-t border-white/[0.04]">
          <div className="flex items-center justify-between gap-3 p-2 rounded-xl bg-white/[0.02]">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center text-slate-300 font-semibold border border-white/[0.06] shrink-0 uppercase">
                {role ? role[0] : 'U'}
              </div>
              {!collapsed && (
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate capitalize">{role || 'User'}</p>
                  <p className="text-xs text-slate-500 truncate">ECCTUR Partner</p>
                </div>
              )}
            </div>
            {!collapsed && (
              <button
                onClick={async () => { await supabase.auth.signOut(); }}
                className="p-1.5 rounded-lg hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 transition-colors shrink-0"
                title="Sign Out"
              >
                <LogOut size={14} />
              </button>
            )}
          </div>
        </div>
      </motion.aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Premium Header */}
        <header className="h-20 glass-panel border-b border-white/[0.04] sticky top-0 z-10 flex items-center justify-between px-8">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold text-slate-200 m-0 leading-none">
              {getPageTitle()}
            </h1>
            <div className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
              isApiOnline 
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
            }`}>
              {isApiOnline ? <Wifi size={12} /> : <WifiOff size={12} />}
              {isApiOnline ? 'API Connected' : 'Demo Offline Mode'}
            </div>

            {/* Hotel Switcher Dropdown */}
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-900 border border-white/[0.06]">
              <Building size={12} className="text-slate-400" />
              {hotels.length > 0 ? (
                <select
                  value={currentHotelId}
                  onChange={(e) => handleHotelChange(e.target.value)}
                  className="bg-transparent border-none text-xs text-slate-300 font-semibold focus:outline-none cursor-pointer"
                >
                  {hotels.map((h) => (
                    <option key={h.id} value={h.id} className="bg-[#090b16] text-slate-300">
                      {h.name}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="text-xs text-slate-500 font-semibold">No hotels found</span>
              )}
            </div>

            {/* Language Switcher Dropdown */}
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-900 border border-white/[0.06]">
              <Globe size={12} className="text-slate-400" />
              <select
                value={i18n.language}
                onChange={(e) => i18n.changeLanguage(e.target.value)}
                className="bg-transparent border-none text-xs text-slate-300 font-semibold focus:outline-none cursor-pointer"
              >
                <option value="en" className="bg-[#090b16] text-slate-300">English</option>
                <option value="tr" className="bg-[#090b16] text-slate-300">Türkçe</option>
                <option value="ru" className="bg-[#090b16] text-slate-300">Русский</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Notification Center */}
            <div className="relative">
              <button 
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className="p-2 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.06] transition-colors relative"
              >
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-4 h-4 rounded-full bg-blue-600 border border-[#060814] flex items-center justify-center text-[9px] font-bold text-white px-1">
                    {unreadCount}
                  </span>
                )}
              </button>
              
              <AnimatePresence>
                {notificationsOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute right-0 mt-3 w-80 rounded-2xl border border-white/[0.06] bg-[#0c0f22]/95 backdrop-blur-md p-4 shadow-2xl z-30"
                  >
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="text-xs font-bold text-slate-200">Alert Center</h3>
                      {unreadCount > 0 && (
                        <button
                          onClick={handleMarkAllAsRead}
                          className="text-[10px] text-blue-400 hover:text-blue-300 font-semibold"
                        >
                          Mark all as read
                        </button>
                      )}
                    </div>

                    <div className="space-y-2 max-h-72 overflow-y-auto pr-1 scrollbar-thin">
                      {notifications.length === 0 ? (
                        <div className="text-center py-6 text-slate-500 text-xs">
                          No notifications received.
                        </div>
                      ) : (
                        notifications.map((n) => (
                          <div 
                            key={n.id} 
                            className={`p-2.5 rounded-xl border transition-all relative flex flex-col gap-1.5 ${
                              n.isRead 
                                ? 'bg-white/[0.01] border-white/[0.03] text-slate-400' 
                                : 'bg-blue-500/[0.02] border-blue-500/10 text-slate-200 shadow-sm'
                            }`}
                          >
                            <div className="flex justify-between items-start gap-2">
                              <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${
                                n.type === 'high_risk' ? 'text-rose-400 bg-rose-500/10' :
                                n.type === 'task_completed' ? 'text-emerald-400 bg-emerald-500/10' :
                                n.type === 'approval_needed' ? 'text-amber-400 bg-amber-500/10' :
                                n.type === 'task_assigned' ? 'text-purple-400 bg-purple-500/10' :
                                'text-blue-400 bg-blue-500/10'
                              }`}>
                                {n.type.replace('_', ' ')}
                              </span>
                              
                              {!n.isRead && (
                                <button
                                  onClick={() => handleMarkAsRead(n.id)}
                                  className="text-slate-500 hover:text-slate-300 cursor-pointer"
                                  title="Mark as read"
                                >
                                  <Eye size={12} />
                                </button>
                              )}
                            </div>

                            <div>
                              <h4 className="text-xs font-semibold">{n.title}</h4>
                              <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">{n.message}</p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Profile Menu Placeholder */}
            <div className="w-px h-6 bg-white/[0.08]" />
            <button className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-white/[0.04] transition-colors">
              <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center">
                <User size={16} />
              </div>
            </button>
          </div>
        </header>

        {/* Dynamic Page Outlet */}
        <main className="flex-1 p-8 overflow-y-auto max-w-7xl mx-auto w-full">
          <Outlet context={{ setIsApiOnline, currentHotelId, hotels }} />
        </main>
      </div>
    </div>
  );
}
