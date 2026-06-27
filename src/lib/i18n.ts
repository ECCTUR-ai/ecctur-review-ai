import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

const resources = {
  en: {
    translation: {
      sidebar: {
        dashboard: 'Dashboard',
        reviews: 'Reviews',
        tasks: 'Tasks',
        departments: 'Departments',
        analytics: 'Analytics',
        whatsapp: 'WhatsApp',
        settings: 'Settings',
        logout: 'Sign Out'
      },
      dashboard: {
        title: 'Dashboard Overview',
        subtitle: 'SaaS Multi-Hotel Feedback & Operational Workspace Manager',
        recentReviews: 'Recent Live Reviews',
        operationalTasks: 'Operational Tasks',
        openTasks: 'Open Tasks',
        overdueTasks: 'Overdue Tasks',
        pending: 'pending',
        delayed: 'delayed',
        viewAll: 'View All',
        open: 'open',
        integrationChannels: 'Integration Channels',
        integrationNotice: 'Integrations require OAuth client setup in GCP / TripAdvisor Portal.',
        metrics: {
          totalReviews: 'Total Reviews',
          averageRating: 'Average Rating',
          draftReviews: 'Draft Reviews',
          publishedReviews: 'Published Reviews',
          highPriority: 'High Priority Reviews',
          aiResponseRate: 'AI Response Rate'
        }
      },
      reviews: {
        title: 'Review Console',
        subtitle: 'Manage and approve multi-channel guest comments & AI drafted responses.',
        search: 'Search comments...',
        sync: 'Sync Channels',
        export: 'Export Data',
        loading: 'Loading reviews workspace...',
        empty: 'No guest reviews matched the current filter conditions.'
      },
      tasks: {
        title: 'Task Workspace',
        subtitle: 'Follow up operational corrections triggered by negative reviews or high priority alerts.',
        search: 'Search tasks...',
        empty: 'No tasks assigned yet.'
      },
      settings: {
        title: 'System Settings',
        subtitle: 'Configure hotel information, OAuth credentials, and AI automation engines.'
      }
    }
  },
  tr: {
    translation: {
      sidebar: {
        dashboard: 'Kontrol Paneli',
        reviews: 'Yorumlar',
        tasks: 'Görevler',
        departments: 'Departmanlar',
        analytics: 'Analitik',
        whatsapp: 'WhatsApp',
        settings: 'Ayarlar',
        logout: 'Çıkış Yap'
      },
      dashboard: {
        title: 'Kontrol Paneline Genel Bakış',
        subtitle: 'SaaS Çoklu Otel Geri Bildirim ve Operasyonel Çalışma Alanı Yöneticisi',
        recentReviews: 'Son Canlı Yorumlar',
        operationalTasks: 'Operasyonel Görevler',
        openTasks: 'Açık Görevler',
        overdueTasks: 'Geciken Görevler',
        pending: 'bekleyen',
        delayed: 'gecikmiş',
        viewAll: 'Tümünü Gör',
        open: 'açık',
        integrationChannels: 'Entegrasyon Kanalları',
        integrationNotice: 'Entegrasyonlar GCP / TripAdvisor Portalı üzerinden OAuth kurulumu gerektirir.',
        metrics: {
          totalReviews: 'Toplam Yorum',
          averageRating: 'Ortalama Puan',
          draftReviews: 'Taslak Yorumlar',
          publishedReviews: 'Yayınlanan Yorumlar',
          highPriority: 'Yüksek Öncelikli Yorumlar',
          aiResponseRate: 'Yapay Zeka Yanıt Oranı'
        }
      },
      reviews: {
        title: 'Yorum Konsolu',
        subtitle: 'Çok kanallı misafir yorumlarını ve AI tarafından hazırlanan taslak yanıtları yönetin.',
        search: 'Yorumlarda ara...',
        sync: 'Kanalları Eşitle',
        export: 'Veriyi Dışa Aktar',
        loading: 'Yorum çalışma alanı yükleniyor...',
        empty: 'Mevcut filtre koşullarına uygun misafir yorumu bulunamadı.'
      },
      tasks: {
        title: 'Görev Çalışma Alanı',
        subtitle: 'Olumsuz yorumlar veya yüksek öncelikli uyarılar tarafından tetiklenen operasyonel düzeltmeleri takip edin.',
        search: 'Görevlerde ara...',
        empty: 'Henüz atanan görev bulunmuyor.'
      },
      settings: {
        title: 'Sistem Ayarları',
        subtitle: 'Otel bilgilerini, OAuth kimlik bilgilerini ve AI otomasyon motorlarını yapılandırın.'
      }
    }
  },
  ru: {
    translation: {
      sidebar: {
        dashboard: 'Панель управления',
        reviews: 'Отзывы',
        tasks: 'Задачи',
        departments: 'Отделы',
        analytics: 'Аналитика',
        whatsapp: 'WhatsApp',
        settings: 'Настройки',
        logout: 'Выйти'
      },
      dashboard: {
        title: 'Обзор панели управления',
        subtitle: 'SaaS Менеджер отзывов отелей и операционного рабочего пространства',
        recentReviews: 'Последние отзывы в реальном времени',
        operationalTasks: 'Операционные задачи',
        openTasks: 'Открытые задачи',
        overdueTasks: 'Просроченные задачи',
        pending: 'ожидает',
        delayed: 'просрочено',
        viewAll: 'Показать все',
        open: 'открыто',
        integrationChannels: 'Интеграционные каналы',
        integrationNotice: 'Для интеграции требуется настройка клиента OAuth на портале GCP / TripAdvisor.',
        metrics: {
          totalReviews: 'Всего отзывов',
          averageRating: 'Средняя оценка',
          draftReviews: 'Черновики ответов',
          publishedReviews: 'Опубликованные ответы',
          highPriority: 'Важные отзывы',
          aiResponseRate: 'Индекс ИИ-ответов'
        }
      },
      reviews: {
        title: 'Консоль отзывов',
        subtitle: 'Управляйте и утверждайте многоканальные комментарии гостей и ответы, составленные ИИ.',
        search: 'Поиск комментариев...',
        sync: 'Синхронизировать',
        export: 'Экспорт данных',
        loading: 'Загрузка рабочего пространства отзывов...',
        empty: 'Нет отзывов гостей, соответствующих текущим условиям фильтра.'
      },
      tasks: {
        title: 'Рабочее пространство задач',
        subtitle: 'Отслеживайте операционные исправления, вызванные негативными отзывами или предупреждениями с высоким приоритетом.',
        search: 'Поиск задач...',
        empty: 'Задач пока не назначено.'
      },
      settings: {
        title: 'Настройки системы',
        subtitle: 'Настройка информации об отеле, учетных данных OAuth и модулей автоматизации ИИ.'
      }
    }
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage']
    },
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;
