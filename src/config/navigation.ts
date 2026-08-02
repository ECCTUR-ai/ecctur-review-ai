import React from 'react';
import {
  LayoutDashboard,
  MessageSquare,
  CheckSquare,
  Building2,
  TrendingUp,
  FileText,
  MessageCircle,
  Building,
  Database,
  Sparkles,
  User,
  Settings
} from 'lucide-react';

export interface NavigationItem {
  id: string;
  labelKey: string;
  defaultLabel: string;
  path: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  permission?: string;
  roles?: string[];
}

export interface NavigationGroup {
  id: string;
  labelKey: string;
  defaultLabel: string;
  items: NavigationItem[];
}

export const navigationGroups: NavigationGroup[] = [
  {
    id: 'main',
    labelKey: 'navigation.main',
    defaultLabel: 'ANA MENÜ',
    items: [
      {
        id: 'dashboard',
        labelKey: 'navigation.dashboard',
        defaultLabel: 'Kontrol Paneli',
        path: '/dashboard',
        icon: LayoutDashboard,
        permission: 'view:dashboard'
      },
      {
        id: 'reviews',
        labelKey: 'navigation.reviews',
        defaultLabel: 'Yorumlar',
        path: '/reviews',
        icon: MessageSquare,
        permission: 'view:reviews'
      },
      {
        id: 'tasks',
        labelKey: 'navigation.tasks',
        defaultLabel: 'Görevler',
        path: '/tasks',
        icon: CheckSquare,
        permission: 'view:tasks'
      },
      {
        id: 'departments',
        labelKey: 'navigation.departments',
        defaultLabel: 'Departmanlar',
        path: '/departments',
        icon: Building2,
        permission: 'view:departments'
      },
      {
        id: 'analytics',
        labelKey: 'navigation.analytics',
        defaultLabel: 'Analitik',
        path: '/analytics',
        icon: TrendingUp,
        permission: 'view:analytics'
      },
      {
        id: 'reports',
        labelKey: 'navigation.reports',
        defaultLabel: 'Raporlar',
        path: '/reports',
        icon: FileText,
        permission: 'view:analytics'
      },
      {
        id: 'whatsapp',
        labelKey: 'navigation.whatsapp',
        defaultLabel: 'WhatsApp',
        path: '/whatsapp',
        icon: MessageCircle,
        permission: 'view:whatsapp'
      }
    ]
  },
  {
    id: 'management',
    labelKey: 'navigation.management',
    defaultLabel: 'YÖNETİM',
    items: [
      {
        id: 'hotels',
        labelKey: 'navigation.hotels',
        defaultLabel: 'Oteller',
        path: '/admin/hotels',
        icon: Building,
        roles: ['super_admin', 'admin']
      },
      {
        id: 'integrations',
        labelKey: 'navigation.integrations',
        defaultLabel: 'Entegrasyonlar',
        path: '/integrations',
        icon: Database,
        permission: 'view:settings'
      },
      {
        id: 'ai-settings',
        labelKey: 'navigation.aiSettings',
        defaultLabel: 'AI Ayarları',
        path: '/settings/ai',
        icon: Sparkles,
        permission: 'view:settings'
      },
      {
        id: 'users',
        labelKey: 'navigation.users',
        defaultLabel: 'Kullanıcılar',
        path: '/admin/users',
        icon: User,
        roles: ['super_admin', 'admin']
      },
      {
        id: 'system-settings',
        labelKey: 'navigation.systemSettings',
        defaultLabel: 'Sistem Ayarları',
        path: '/settings/system',
        icon: Settings,
        permission: 'view:settings'
      }
    ]
  }
];
