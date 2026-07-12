import React, { useState, useEffect, useCallback } from 'react';
import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import { notificationService } from '@/services/notificationService';
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
  Bell,
  User,
  LogOut,
  CheckSquare,
  Eye,
  Menu,
  FileText,
  Sparkles,
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
  { name: 'AI Operations', path: '/ai-replies', icon: Sparkles, permission: 'view:reviews', tKey: 'sidebar.ai_replies' },
  { name: 'Tasks', path: '/tasks', icon: CheckSquare, permission: 'view:tasks', tKey: 'sidebar.tasks' },
  { name: 'Departments', path: '/departments', icon: Building2, permission: 'view:departments', tKey: 'sidebar.departments' },
  { name: 'Analytics', path: '/analytics', icon: TrendingUp, permission: 'view:analytics', tKey: 'sidebar.analytics' },
  { name: 'Reports', path: '/reports', icon: FileText, permission: 'view:analytics', tKey: 'sidebar.reports' },
  { name: 'WhatsApp', path: '/whatsapp', icon: MessageCircle, permission: 'view:whatsapp', tKey: 'sidebar.whatsapp' },
  { name: 'Settings', path: '/settings', icon: Settings, permission: 'view:settings', tKey: 'sidebar.settings' },
  { name: 'Admin', path: '/admin', icon: Settings, permission: 'view:users', tKey: 'sidebar.admin' },
];

export default function DashboardLayout() {
  const { hasPermission, permissions, role, roleKey, userId, hotelIds: authHotelIds, organizationId: authOrgId, email } = useAuth();
  const isTrueSuperAdmin = email === 'cemil.sezgin@ecctur.com';
  const navigate = useNavigate();
  const [profileOpen, setProfileOpen] = useState(false);
  const { t, i18n } = useTranslation();
  const [collapsed, setCollapsed] = useState(true);
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

  // Load Hotels list on mount and when authentication details change
  useEffect(() => {
    if (!userId) return;
    const loadHotels = async () => {
      if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_URL.includes('placeholder')) {
        console.warn('Supabase credentials missing or placeholder used.');
        setIsApiOnline(false);
        return;
      }
      try {
        const userHotelsClearance = authHotelIds || [];
        const userOrgId = authOrgId || null;

        // 1. Fetch organizations dynamically
        const orgs = await hotelService.getOrganizations();
        
        // 2. Find active organization
        const activeOrg = orgs.find(o => o.id === userOrgId) || orgs[0];
        if (activeOrg) {
          setCurrentOrg(activeOrg);
        }

        // 3. Fetch hotels for that organization (fetch all if true super admin)
        const allHotels = await hotelService.getHotels(isTrueSuperAdmin ? undefined : activeOrg?.id);
        
        const filteredHotels = (isTrueSuperAdmin || roleKey === 'super_admin')
          ? allHotels
          : allHotels.filter(h => userHotelsClearance.includes(h.id));
        
        setHotels(filteredHotels);
        setIsApiOnline(true);
        
        // Ensure currentHotelId is valid
        let targetHotelId = currentHotelId;
        if (filteredHotels.length === 1) {
          const singleHotel = filteredHotels[0];
          targetHotelId = singleHotel.id;
          setCurrentHotelId(singleHotel.id);
          localStorage.setItem('saas_selected_hotel_id', singleHotel.id);
        } else if (!currentHotelId || !filteredHotels.find(h => h.id === currentHotelId)) {
          const firstHotel = filteredHotels[0];
          if (firstHotel) {
            targetHotelId = firstHotel.id;
            setCurrentHotelId(firstHotel.id);
            localStorage.setItem('saas_selected_hotel_id', firstHotel.id);
          }
        }
      } catch (err) {
        console.error('Error loading organization context:', err);
        setIsApiOnline(false);
      }
    };
    loadHotels();
  }, [userId, authHotelIds, authOrgId, roleKey, email]);

  const fetchNotifications = useCallback(async () => {
    try {
      const data = await notificationService.getNotifications(currentHotelId || undefined);
      setNotifications(data);
      setUnreadCount(data.filter(n => !n.isRead).length);
    } catch (e) {
      console.error('Failed to load notifications:', e);
    }
  }, [currentHotelId]);

  // Load organization context dynamically when active hotel changes
  useEffect(() => {
    if (!currentHotelId || !hotels || hotels.length === 0) return;
    const activeHotel = hotels.find(h => h.id === currentHotelId);
    if (activeHotel) {
      const loadOrg = async () => {
        try {
          const orgs = await hotelService.getOrganizations();
          const targetOrg = orgs.find(o => o.id === activeHotel.organizationId);
          if (targetOrg) {
            setCurrentOrg(targetOrg);
          }
        } catch (err) {
          console.error('Failed to load active hotel organization:', err);
        }
      };
      loadOrg();
    }
  }, [currentHotelId, hotels]);

  useEffect(() => {
    if (!currentHotelId) return;
    fetchNotifications();

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
    <div className="min-h-screen flex text-[#151827] bg-[#F6F8FC] premium-grid-bg">
      {/* Mobile Sidebar Drawer Backdrop */}
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
            className="fixed inset-y-0 left-0 w-[270px] bg-white border-r border-[#E8EAF0] z-50 md:hidden flex flex-col"
          >
            {/* Logo Section */}
            <div className="h-20 flex items-center justify-between px-6 border-b border-[#E8EAF0]">
              <div className="flex items-center gap-2.5">
                {currentOrg.logoUrl ? (
                  <img src={currentOrg.logoUrl} alt="Logo" className="w-8 h-8 rounded-lg object-contain bg-slate-50 p-1 border border-[#E8EAF0]" />
                ) : (
                  <img src="/branding/logo.png" alt="GuestReview.ai Logo" className="h-8 object-contain" />
                )}
                <span className="font-bold text-base tracking-wide text-[#151827] truncate max-w-[140px]">
                  {currentOrg.name || 'GuestReview.ai'}
                </span>
              </div>
              <button 
                onClick={() => setMobileSidebarOpen(false)}
                className="p-1.5 rounded-xl border border-[#E8EAF0] bg-slate-50 hover:bg-slate-100 text-[#151827] transition-all cursor-pointer"
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
                if (item.path === '/admin' && roleKey !== 'super_admin' && roleKey !== 'admin') {
                  return null;
                }
                const isActive = item.path === '/'
                  ? location.pathname === '/'
                  : location.pathname.startsWith(item.path);
                const Icon = item.icon;

                return (
                  <Link key={item.path} to={item.path} onClick={() => setMobileSidebarOpen(false)}>
                    <div
                      className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-200 ${
                        isActive 
                          ? 'bg-[#F0EDFF] border border-[#F0EDFF] text-[#6D5DF6] font-semibold' 
                          : 'border border-transparent text-zinc-500 hover:text-[#151827] hover:bg-slate-50'
                      }`}
                    >
                      <Icon size={20} className={isActive ? 'text-[#6D5DF6]' : 'text-zinc-555'} />
                      <span className="text-sm font-medium">{t(item.tKey)}</span>
                    </div>
                  </Link>
                );
              })}
            </nav>

            {/* Profile / Footer Section */}
            <div className="p-4 border-t border-[#E8EAF0]">
              <div className="flex items-center justify-between gap-3 p-2.5 rounded-2xl bg-slate-50 border border-[#E8EAF0]">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold shrink-0 uppercase">
                    {role ? role[0] : 'U'}
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-bold text-[#151827] truncate capitalize">{currentOrg.name || 'GuestReview.ai'}</p>
                    <p className="text-xs text-zinc-500 truncate">{role || 'Super Admin'}</p>
                  </div>
                </div>
                <button
                  onClick={async () => { await supabase.auth.signOut(); }}
                  className="p-2 rounded-xl hover:bg-rose-50 text-zinc-500 hover:text-rose-600 transition-colors shrink-0 cursor-pointer"
                  title="Sign Out"
                >
                  <LogOut size={15} />
                </button>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Desktop Premium Sidebar (Hover Expanding & Floating Glassmorphism) */}
      <div className="h-screen sticky top-0 hidden md:flex items-center z-20 pl-4">
        <motion.aside
          onMouseEnter={() => setCollapsed(false)}
          onMouseLeave={() => setCollapsed(true)}
          animate={{ width: collapsed ? 84 : 260 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="h-[calc(100vh-2rem)] rounded-[24px] bg-white border border-[#E8EAF0] shadow-md flex flex-col overflow-hidden"
        >
          {/* Logo Section */}
          <div className="h-20 flex items-center justify-between px-6 border-b border-[#E8EAF0]">
            <AnimatePresence mode="wait">
              {!collapsed ? (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="flex items-center gap-2.5"
                >
                  {currentOrg.logoUrl ? (
                    <img src={currentOrg.logoUrl} alt="Logo" className="w-8 h-8 rounded-lg object-contain bg-slate-50 p-1 border border-[#E8EAF0]" />
                  ) : (
                    <img src="/branding/logo.png" alt="GuestReview.ai Logo" className="h-8 object-contain" />
                  )}
                  <span className="font-bold text-base tracking-wide text-[#151827] truncate max-w-[140px]">
                    {currentOrg.name || 'GuestReview.ai'}
                  </span>
                </motion.div>
              ) : (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mx-auto"
                >
                  {currentOrg.logoUrl ? (
                    <img src={currentOrg.logoUrl} alt="Logo" className="w-8 h-8 rounded-lg object-contain bg-slate-50 p-1 border border-[#E8EAF0]" />
                  ) : (
                    <img src="/branding/logo.png" alt="Logo" className="w-8 h-8 object-cover object-left rounded-lg bg-slate-50 p-1 border border-[#E8EAF0]" />
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Navigation Items */}
          <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
            {sidebarItems.map((item) => {
              if (AUTH_ENABLED && item.permission && !hasPermission(item.permission)) {
                return null;
              }
              if (item.path === '/admin' && roleKey !== 'super_admin' && roleKey !== 'admin') {
                return null;
              }
              const isActive = item.path === '/'
                ? location.pathname === '/'
                : location.pathname.startsWith(item.path);
              const Icon = item.icon;

              return (
                <Link key={item.path} to={item.path}>
                  <div className="relative group px-1">
                    <div
                      className={`flex items-center gap-3 px-3.5 py-3 rounded-2xl transition-all duration-200 ${
                        isActive 
                          ? 'bg-[#F0EDFF] border border-[#F0EDFF] text-[#6D5DF6] font-semibold' 
                          : 'border border-transparent text-zinc-500 hover:text-[#151827] hover:bg-slate-50'
                      }`}
                    >
                      <Icon size={18} className={isActive ? 'text-[#6D5DF6]' : 'text-zinc-500 group-hover:text-[#151827]'} />
                      {!collapsed && (
                        <span className="text-sm font-medium whitespace-nowrap">{t(item.tKey)}</span>
                      )}
                    </div>
                    {isActive && (
                      <motion.div 
                        layoutId="active-indicator"
                        className="absolute left-0 top-1/4 bottom-1/4 w-1 bg-[#6D5DF6] rounded-r"
                      />
                    )}
                  </div>
                </Link>
              );
            })}
          </nav>

          {/* Hotel Switcher & Profile Section */}
          <div className="p-3 border-t border-[#E8EAF0] space-y-2 bg-slate-50">
            {/* Hotel Switcher Dropdown (Only visible when expanded, or icon when collapsed) */}
            {!collapsed && hotels.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-white border border-[#E8EAF0] text-[#151827]">
                <Building size={14} className="text-[#6D5DF6] shrink-0" />
                <select
                  value={currentHotelId}
                  onChange={(e) => handleHotelChange(e.target.value)}
                  className="bg-transparent border-none text-xs text-[#151827] font-semibold focus:outline-none cursor-pointer w-full"
                >
                  {hotels.map((h) => (
                    <option key={h.id} value={h.id} className="bg-white text-[#151827]">
                      {h.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Profile Dropdown */}
            <div className="flex items-center justify-between gap-2.5 p-2 rounded-2xl bg-white border border-[#E8EAF0]">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold shrink-0 uppercase">
                  {role ? role[0] : 'U'}
                </div>
                {!collapsed && (
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-xs font-bold text-[#151827] truncate capitalize">{currentOrg.name || 'GuestReview.ai'}</p>
                    <p className="text-[10px] text-zinc-500 truncate">{role || 'Super Admin'}</p>
                  </div>
                )}
              </div>
              {!collapsed && (
                <button
                  onClick={async () => { await supabase.auth.signOut(); }}
                  className="p-1.5 rounded-lg hover:bg-rose-50 text-zinc-500 hover:text-rose-600 transition-colors shrink-0 cursor-pointer"
                  title="Sign Out"
                >
                  <LogOut size={13} />
                </button>
              )}
            </div>
          </div>
        </motion.aside>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Premium Light Header */}
        <header className="min-h-20 py-3 md:py-0 bg-white border-b border-[#E8EAF0] sticky top-0 z-10 flex flex-col md:flex-row md:items-center justify-between px-6 md:px-8 gap-3">
          <div className="flex items-center justify-between md:justify-start gap-4 w-full md:w-auto">
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
                className="md:hidden p-2 rounded-xl border border-[#E8EAF0] bg-slate-50 hover:bg-slate-100 text-[#151827] transition-colors"
              >
                <Menu size={16} />
              </button>
              <h1 className="text-base md:text-lg font-black text-[#151827] m-0 leading-none">
                {getPageTitle()}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-4 justify-between md:justify-end w-full md:w-auto flex-wrap">
            {/* Header Hotel Switcher (Only on Mobile/Collapsed) */}
            {(collapsed || mobileSidebarOpen) && hotels.length > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-50 border border-[#E8EAF0] text-[#151827] max-w-[160px] md:max-w-none truncate">
                <Building size={12} className="text-zinc-500 shrink-0" />
                <select
                  value={currentHotelId}
                  onChange={(e) => handleHotelChange(e.target.value)}
                  className="bg-transparent border-none text-[11px] md:text-xs text-[#151827] font-semibold focus:outline-none cursor-pointer max-w-[110px] md:max-w-none truncate"
                >
                  {hotels.map((h) => (
                    <option key={h.id} value={h.id} className="bg-white text-[#151827]">
                      {h.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Language Switcher Dropdown */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-50 border border-[#E8EAF0] text-[#151827]">
              <Globe size={12} className="text-zinc-500 shrink-0" />
              <select
                value={i18n.language}
                onChange={(e) => i18n.changeLanguage(e.target.value)}
                className="bg-transparent border-none text-[11px] md:text-xs text-[#151827] font-semibold focus:outline-none cursor-pointer"
              >
                <option value="en" className="bg-white text-[#151827]">EN</option>
                <option value="tr" className="bg-white text-[#151827]">TR</option>
                <option value="ru" className="bg-white text-[#151827]">RU</option>
              </select>
            </div>

            {/* Notification Center */}
            <div className="relative">
              <button 
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className="p-2 rounded-xl border border-[#E8EAF0] bg-slate-50 hover:bg-slate-100 transition-colors relative text-zinc-650 shadow-sm cursor-pointer"
              >
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-4 h-4 rounded-full bg-[#6D5DF6] flex items-center justify-center text-[9px] font-bold text-white px-1">
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
                    className="absolute right-0 mt-3 w-80 rounded-2xl border border-[#E8EAF0] bg-white p-4 shadow-xl z-30 text-[#151827]"
                  >
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="text-xs font-bold text-[#151827]">Alert Center</h3>
                      {unreadCount > 0 && (
                        <button
                          onClick={handleMarkAllAsRead}
                          className="text-[10px] text-[#6D5DF6] hover:text-[#5b4ee4] font-semibold cursor-pointer"
                        >
                          Mark all as read
                        </button>
                      )}
                    </div>

                    <div className="space-y-2 max-h-72 overflow-y-auto pr-1 scrollbar-thin">
                      {notifications.length === 0 ? (
                        <div className="text-center py-6 text-zinc-400 text-xs">
                          No notifications received.
                        </div>
                      ) : (
                        notifications.map((n) => (
                          <div 
                            key={n.id} 
                            className={`p-2.5 rounded-xl border transition-all relative flex flex-col gap-1.5 ${
                              n.isRead 
                                ? 'bg-slate-50 border-[#E8EAF0] text-zinc-555' 
                                : 'bg-[#F0EDFF] border-[#6D5DF6]/20 text-[#151827] shadow-sm'
                            }`}
                          >
                            <div className="flex justify-between items-start gap-2">
                              <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${
                                n.type === 'high_risk' ? 'text-rose-600 bg-rose-50 border border-rose-200' :
                                n.type === 'task_completed' ? 'text-emerald-600 bg-emerald-50 border border-emerald-200' :
                                n.type === 'approval_needed' ? 'text-amber-600 bg-amber-50 border border-amber-200' :
                                n.type === 'task_assigned' ? 'text-purple-600 bg-purple-50 border border-purple-200' :
                                'text-[#6D5DF6] bg-[#F0EDFF] border border-[#6D5DF6]/20'
                              }`}>
                                {n.type.replace('_', ' ')}
                              </span>
                              
                              {!n.isRead && (
                                <button
                                  onClick={() => handleMarkAsRead(n.id)}
                                  className="text-zinc-500 hover:text-[#151827] cursor-pointer"
                                  title="Mark as read"
                                >
                                  <Eye size={12} />
                                </button>
                              )}
                            </div>

                            <div>
                              <h4 className="text-xs font-bold text-[#151827]">{n.title}</h4>
                              <p className="text-[10px] text-zinc-500 mt-0.5 leading-relaxed">{n.message}</p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Profile Dropdown Header */}
            <div className="w-px h-6 bg-[#E8EAF0]" />
            <div className="relative">
              <button 
                onClick={() => setProfileOpen(!profileOpen)}
                className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
                title="Profile Menu"
              >
                <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center border border-[#E8EAF0] text-[#151827]">
                  <User size={16} className="text-zinc-500" />
                </div>
              </button>

              <AnimatePresence>
                {profileOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute right-0 mt-3 w-56 rounded-2xl border border-[#E8EAF0] bg-white p-4 shadow-xl z-30 text-[#151827]"
                  >
                    <div className="border-b border-[#E8EAF0] pb-3 mb-3">
                      <span className="text-xs font-bold text-[#151827] block truncate capitalize">
                        {role || 'User'}
                      </span>
                      <span className="text-[10px] text-zinc-500 block truncate">
                        Corporate Account
                      </span>
                    </div>

                    <button
                      onClick={async () => {
                        setProfileOpen(false);
                        await supabase.auth.signOut();
                        navigate('/login');
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-rose-500 hover:bg-rose-50 flex items-center gap-2 transition-colors cursor-pointer"
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
        <main className="flex-1 p-6 md:p-8 overflow-y-auto max-w-7xl mx-auto w-full">
          <Outlet context={{ setIsApiOnline, currentHotelId, hotels }} />
        </main>
      </div>
    </div>
  );
}
