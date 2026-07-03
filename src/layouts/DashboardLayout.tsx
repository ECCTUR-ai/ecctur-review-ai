import React, { useState, useEffect, useCallback } from 'react';
import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom';
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
  Globe,
  ShieldCheck,
  Menu,
  FileText
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
  { name: 'Reports', path: '/reports', icon: FileText, permission: 'view:analytics', tKey: 'sidebar.reports' },
  { name: 'WhatsApp', path: '/whatsapp', icon: MessageCircle, permission: 'view:whatsapp', tKey: 'sidebar.whatsapp' },
  { name: 'Settings', path: '/settings', icon: Settings, permission: 'view:settings', tKey: 'sidebar.settings' },
  { name: 'Admin', path: '/admin', icon: ShieldCheck, permission: 'view:users', tKey: 'sidebar.admin' },
];

export default function DashboardLayout() {
  const { hasPermission, permissions, role, userId } = useAuth();
  const navigate = useNavigate();
  const [profileOpen, setProfileOpen] = useState(false);
  const { t, i18n } = useTranslation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isApiOnline, setIsApiOnline] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  
  // Multi-hotel SaaS states
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [currentHotelId, setCurrentHotelId] = useState<string>(
    localStorage.getItem('saas_selected_hotel_id') || ''
  );
  const [currentOrg, setCurrentOrg] = useState<any>({ name: 'GuestReview AI', logoUrl: '' });
  
  const location = useLocation();

  // Load Hotels list on mount
  useEffect(() => {
    const loadHotels = async () => {
      console.log('[Hotel Loader] Initializing...');
      console.log('[Hotel Loader] Supabase URL:', import.meta.env.VITE_SUPABASE_URL);
      try {
        let userHotelsClearance: string[] = [];
        let userOrgId: string | null = null;
        if (userId) {
          try {
            const { userRepository } = await import('@/repositories/userRepository');
            const profile = await userRepository.getUserById(userId);
            userHotelsClearance = profile.hotelIds || [];
            userOrgId = profile.organizationId || null;
            console.log('[Hotel Loader] User clearance hotel IDs:', userHotelsClearance);
            console.log('[Hotel Loader] User organization ID:', userOrgId);
          } catch (e) {
            console.warn('[Hotel Loader] Could not fetch profile clearances:', e);
          }
        }

        // 1. Fetch organizations dynamically
        console.log('[Hotel Loader] Querying organizations...');
        const orgs = await hotelService.getOrganizations();
        console.log('[Hotel Loader] Organizations result:', orgs);
        
        // 2. Find the user's organization, or GuestReview.ai, or fall back to the first one
        const activeOrg = orgs.find(o => o.id === userOrgId) || 
                          orgs.find(o => o.name === 'GuestReview.ai' || o.name === 'ECCTUR') || 
                          orgs[0];
        if (activeOrg) {
          setCurrentOrg(activeOrg);
        }
        const orgId = activeOrg ? activeOrg.id : '7cc77cc7-7cc7-7cc7-7cc7-7cc77cc77cc7';
        console.log('[Hotel Loader] Selected Organization ID:', orgId);

        // 3. Load hotels filtered by resolved organization ID from Supabase
        console.log('[Hotel Loader] Querying hotels...');
        let data = await hotelService.getHotels(orgId);
        console.log('[Hotel Loader] Hotels result:', data);
        console.log('[Hotel Loader] Number of hotels returned:', data.length);

        // Filter hotels list by user's clearance access list (unless Super Admin/Admin)
        const roleLower = role?.toLowerCase();
        const isSuper = roleLower === 'admin' || roleLower === 'super admin';
        if (!isSuper && userHotelsClearance.length > 0) {
          data = data.filter(h => userHotelsClearance.includes(h.id));
          console.log('[Hotel Loader] Filtered hotels by user clearances:', data);
        }
        
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
    if (location.pathname.startsWith('/admin')) {
      return 'Admin Panel';
    }
    const current = sidebarItems.find(item => item.path === location.pathname);
    if (current) {
      return current.name;
    }
    return 'Platform';
  };

  return (
    <div className="min-h-screen flex text-slate-800 bg-[#f8fafc] premium-grid-bg">
      {/* Mobile Sidebar Backdrop */}
      <AnimatePresence>
        {mobileSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMobileSidebarOpen(false)}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 md:hidden"
          />
        )}
      </AnimatePresence>

      {/* Mobile Sidebar Drawer */}
      <AnimatePresence>
        {mobileSidebarOpen && (
          <motion.aside
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-y-0 left-0 w-[260px] bg-white border-r border-slate-200 z-50 md:hidden flex flex-col"
          >
            {/* Logo Section */}
            <div className="h-20 flex items-center justify-between px-6 border-b border-slate-100">
              <div className="flex items-center gap-2">
                {currentOrg.logoUrl ? (
                  <img src={currentOrg.logoUrl} alt="Logo" className="w-8 h-8 rounded-lg object-contain bg-slate-50 p-0.5" />
                ) : (
                  <img src="/branding/logo.png" alt="GuestReview.ai Logo" className="h-8 object-contain" />
                )}
                <span className="font-bold text-base tracking-wide text-slate-800 truncate max-w-[140px]">
                  {currentOrg.name || 'GuestReview.ai'}
                </span>
              </div>
              <button 
                onClick={() => setMobileSidebarOpen(false)}
                className="p-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
            </div>

            {/* Navigation Items */}
            <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
              {sidebarItems.map((item) => {
                if (AUTH_ENABLED && item.permission && !hasPermission(item.permission)) {
                  return null;
                }
                const isActive = item.path === '/'
                  ? location.pathname === '/'
                  : location.pathname.startsWith(item.path);
                const Icon = item.icon;

                return (
                  <Link key={item.path} to={item.path} onClick={() => setMobileSidebarOpen(false)}>
                    <div className="relative group">
                      <div
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                          isActive 
                            ? 'bg-blue-50 border border-blue-100/50 text-blue-600 shadow-sm font-semibold' 
                            : 'border border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                        }`}
                      >
                        <Icon size={20} className={isActive ? 'text-blue-600' : 'text-slate-500'} />
                        <span className="text-sm font-medium">{t(item.tKey)}</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </nav>

            {/* Profile / Footer Section */}
            <div className="p-4 border-t border-slate-100">
              <div className="flex items-center justify-between gap-3 p-2 rounded-xl bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-slate-200 flex items-center justify-center text-slate-700 font-semibold border border-slate-300 shrink-0 uppercase">
                    {role ? role[0] : 'U'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate capitalize">{currentOrg.name || 'GuestReview.ai'}</p>
                    <p className="text-xs text-slate-500 truncate">{role || 'Super Admin'}</p>
                  </div>
                </div>
                <button
                  onClick={async () => { await supabase.auth.signOut(); }}
                  className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-500 hover:text-rose-600 transition-colors shrink-0"
                  title="Sign Out"
                >
                  <LogOut size={14} />
                </button>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Desktop Premium Sidebar */}
      <motion.aside
        animate={{ width: collapsed ? 80 : 260 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className="h-screen sticky top-0 sidebar-glass hidden md:flex flex-col z-20"
      >
        {/* Logo Section */}
        <div className="h-20 flex items-center justify-between px-6 border-b border-slate-100">
          <AnimatePresence mode="wait">
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="flex items-center gap-2"
              >
                {currentOrg.logoUrl ? (
                  <img src={currentOrg.logoUrl} alt="Logo" className="w-8 h-8 rounded-lg object-contain bg-slate-50 p-0.5" />
                ) : (
                  <img src="/branding/logo.png" alt="GuestReview.ai Logo" className="h-8 object-contain" />
                )}
                <span className="font-bold text-base tracking-wide text-slate-800 truncate max-w-[140px]">
                  {currentOrg.name || 'GuestReview.ai'}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
          {collapsed && (
            currentOrg.logoUrl ? (
              <img src={currentOrg.logoUrl} alt="Logo" className="w-8 h-8 rounded-lg object-contain bg-slate-50 p-0.5 mx-auto" />
            ) : (
              <img src="/branding/logo.png" alt="Logo" className="w-8 h-8 object-cover object-left rounded-lg bg-slate-50 p-0.5 mx-auto" />
            )
          )}
          <button 
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 transition-colors shadow-sm cursor-pointer"
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
          {sidebarItems.map((item) => {
            // When AUTH_ENABLED is false (development mode), bypass permission filtering
            if (AUTH_ENABLED && item.permission && !hasPermission(item.permission)) {
              return null;
            }
            const isActive = item.path === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.path);
            const Icon = item.icon;

            return (
              <Link key={item.path} to={item.path}>
                <div className="relative group">
                  <motion.div
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                      isActive 
                        ? 'bg-blue-50 border border-blue-100/50 text-blue-600 shadow-sm font-semibold' 
                        : 'border border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50/80'
                    }`}
                  >
                    <Icon size={20} className={isActive ? 'text-blue-600' : 'text-slate-500 group-hover:text-slate-700'} />
                    {!collapsed && (
                      <span className="text-sm font-medium">{t(item.tKey)}</span>
                    )}
                  </motion.div>
                  {isActive && !collapsed && (
                    <motion.div 
                      layoutId="active-indicator"
                      className="absolute left-0 top-1/4 bottom-1/4 w-1 bg-blue-600 rounded-r"
                    />
                  )}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Profile / Footer Section */}
        <div className="p-4 border-t border-slate-100">
          <div className="flex items-center justify-between gap-3 p-2 rounded-xl bg-slate-50 border border-slate-100">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-slate-200 flex items-center justify-center text-slate-700 font-semibold border border-slate-300 shrink-0 uppercase">
                {role ? role[0] : 'U'}
              </div>
              {!collapsed && (
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate capitalize">{currentOrg.name || 'GuestReview.ai'}</p>
                  <p className="text-xs text-slate-500 truncate">{role || 'Super Admin'}</p>
                </div>
              )}
            </div>
            {!collapsed && (
              <button
                onClick={async () => { await supabase.auth.signOut(); }}
                className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-500 hover:text-rose-600 transition-colors shrink-0"
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
        <header className="min-h-20 py-3 md:py-0 bg-white border-b border-slate-200/80 sticky top-0 z-10 flex flex-col md:flex-row md:items-center justify-between px-4 md:px-8 gap-3">
          <div className="flex items-center justify-between md:justify-start gap-4 w-full md:w-auto">
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
                className="md:hidden p-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 transition-colors"
              >
                <Menu size={16} />
              </button>
              <h1 className="text-sm md:text-lg font-bold text-slate-800 m-0 leading-none">
                {getPageTitle()}
              </h1>
            </div>
            
            <div className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] md:text-xs font-medium border ${
              isApiOnline 
                ? 'bg-emerald-50 border-emerald-200 text-emerald-600' 
                : 'bg-amber-50 border-amber-200 text-amber-600'
            }`}>
              {isApiOnline ? <Wifi size={12} /> : <WifiOff size={12} />}
              <span className="hidden sm:inline">{isApiOnline ? 'API Connected' : 'Demo Offline Mode'}</span>
              <span className="inline sm:hidden">{isApiOnline ? 'Online' : 'Demo'}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-4 justify-between md:justify-end w-full md:w-auto flex-wrap">
            {/* Hotel Switcher Dropdown */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white border border-slate-200 shadow-sm text-slate-700 max-w-[160px] md:max-w-none truncate">
              <Building size={12} className="text-slate-500 shrink-0" />
              {hotels.length > 0 ? (
                <select
                  value={currentHotelId}
                  onChange={(e) => handleHotelChange(e.target.value)}
                  className="bg-transparent border-none text-[11px] md:text-xs text-slate-700 font-semibold focus:outline-none cursor-pointer max-w-[110px] md:max-w-none truncate"
                >
                  {hotels.map((h) => (
                    <option key={h.id} value={h.id} className="bg-white text-slate-700">
                      {h.name}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="text-[11px] md:text-xs text-slate-500 font-semibold">No hotels</span>
              )}
            </div>

            {/* Language Switcher Dropdown */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white border border-slate-200 shadow-sm text-slate-700">
              <Globe size={12} className="text-slate-500 shrink-0" />
              <select
                value={i18n.language}
                onChange={(e) => i18n.changeLanguage(e.target.value)}
                className="bg-transparent border-none text-[11px] md:text-xs text-slate-700 font-semibold focus:outline-none cursor-pointer"
              >
                <option value="en" className="bg-white text-slate-700">EN</option>
                <option value="tr" className="bg-white text-slate-700">TR</option>
                <option value="ru" className="bg-white text-slate-700">RU</option>
              </select>
            </div>

            {/* Notification Center */}
            <div className="relative">
              <button 
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors relative text-slate-600 shadow-sm cursor-pointer"
              >
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-4 h-4 rounded-full bg-blue-600 border border-white flex items-center justify-center text-[9px] font-bold text-white px-1">
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
                    className="absolute right-0 mt-3 w-80 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl z-30 text-slate-800"
                  >
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="text-xs font-bold text-slate-800">Alert Center</h3>
                      {unreadCount > 0 && (
                        <button
                          onClick={handleMarkAllAsRead}
                          className="text-[10px] text-blue-600 hover:text-blue-500 font-semibold"
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
                                ? 'bg-slate-50/50 border-slate-100 text-slate-400' 
                                : 'bg-blue-50/30 border-blue-100 text-slate-800 shadow-sm'
                            }`}
                          >
                            <div className="flex justify-between items-start gap-2">
                              <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${
                                n.type === 'high_risk' ? 'text-rose-600 bg-rose-50' :
                                n.type === 'task_completed' ? 'text-emerald-600 bg-emerald-50' :
                                n.type === 'approval_needed' ? 'text-amber-600 bg-amber-50' :
                                n.type === 'task_assigned' ? 'text-purple-600 bg-purple-50' :
                                'text-blue-600 bg-blue-50'
                              }`}>
                                {n.type.replace('_', ' ')}
                              </span>
                              
                              {!n.isRead && (
                                <button
                                  onClick={() => handleMarkAsRead(n.id)}
                                  className="text-slate-500 hover:text-slate-700 cursor-pointer"
                                  title="Mark as read"
                                >
                                  <Eye size={12} />
                                </button>
                              )}
                            </div>

                            <div>
                              <h4 className="text-xs font-semibold">{n.title}</h4>
                              <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">{n.message}</p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Profile Menu */}
            <div className="w-px h-6 bg-slate-200" />
            <div className="relative">
              <button 
                onClick={() => setProfileOpen(!profileOpen)}
                className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
                title="Profile Menu"
              >
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center border border-slate-200 text-slate-600">
                  <User size={16} className="text-slate-600" />
                </div>
              </button>

              <AnimatePresence>
                {profileOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute right-0 mt-3 w-56 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl z-30 text-slate-800"
                  >
                    <div className="border-b border-slate-100 pb-3 mb-3">
                      <span className="text-xs font-semibold text-slate-800 block truncate capitalize">
                        {role || 'User'}
                      </span>
                      <span className="text-[10px] text-slate-500 block truncate">
                        Corporate Account
                      </span>
                    </div>

                    <button
                      onClick={async () => {
                        setProfileOpen(false);
                        await supabase.auth.signOut();
                        navigate('/login');
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs font-medium text-rose-600 hover:bg-rose-50 flex items-center gap-2 transition-colors cursor-pointer"
                    >
                      <LogOut size={14} />
                      Sign Out
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
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
