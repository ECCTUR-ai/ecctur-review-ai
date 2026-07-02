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
        reports: 'Reports',
        whatsapp: 'WhatsApp',
        settings: 'Settings',
        admin: 'Admin Panel',
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
        empty: 'No guest reviews matched the current filter conditions.',
        import30Days: 'Import last 30 days reviews'
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
      },
      admin: {
        title: 'Admin Settings',
        tabs: {
          users: 'User Management',
          hotels: 'Hotel Management',
          org: 'Organization',
          integrations: 'Integrations & Roles',
          onboarding: 'Customer Onboarding'
        },
        users: {
          profilesCount: 'Corporate User Profiles ({{count}})',
          addUser: 'Add User',
          assignedRole: 'Assigned Role',
          clearanceStatus: 'Clearance status',
          assignedHotels: 'Assigned Hotels',
          actions: 'Actions',
          empty: 'No corporate user accounts found. Add one to begin.',
          toastCreated: 'User created successfully',
          accessDenied: 'Access Denied',
          missingPermission: 'You do not possess the required permission clearance ({{permission}}) to view this workspace.',
          phone: 'Phone Number',
          title: 'Job Title / Role',
          department: 'Department',
          avatarUrl: 'Avatar Photo URL',
          language: 'Language Preference',
          timezone: 'Time Zone'
        },
        org: {
          title: 'Corporate Organization Profile',
          name: 'Company Name',
          taxOffice: 'Tax Office',
          taxNumber: 'Tax Number',
          phone: 'Phone',
          email: 'Email',
          website: 'Website',
          address: 'Address',
          country: 'Country',
          city: 'City',
          currency: 'Currency',
          defaultLanguage: 'Default Language',
          logo: 'Company Logo',
          logoUploading: 'Uploading Logo...',
          save: 'Save Organization Details',
          viewOnly: 'View Only (Insufficient Permissions to Edit)'
        }
      },
      login: {
        welcome: 'Welcome Back',
        signIn: 'Sign In',
        email: 'Email Address',
        password: 'Password',
        forgotPassword: 'Forgot Password?',
        resetPassword: 'Reset Password',
        backToSignIn: 'Back to Sign In',
        resetSub: 'Enter your corporate email to receive password reset instructions.',
        loginSub: "Sign in to access your hotel's command console.",
        sendResetLink: 'Send Reset Link',
        sendingRequest: 'Sending Request...',
        authenticating: 'Authenticating...',
        multiTenantAccess: 'Multi-Tenant Access Rule',
        multiTenantSub: 'Sign in with your corporate email. Roles and department clearances are automatically assigned via your user profile.'
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
        reports: 'Raporlar',
        whatsapp: 'WhatsApp',
        settings: 'Ayarlar',
        admin: 'Yönetici Paneli',
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
        empty: 'Mevcut filtre koşullarına uygun misafir yorumu bulunamadı.',
        import30Days: 'Son 30 Gün Yorumlarını İçe Aktar'
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
      },
      admin: {
        title: 'Yönetici Ayarları',
        tabs: {
          users: 'Kullanıcı Yönetimi',
          hotels: 'Otel Yönetimi',
          org: 'Organizasyon',
          integrations: 'Entegrasyonlar ve Roller',
          onboarding: 'Yeni Müşteri Kurulumu'
        },
        users: {
          profilesCount: 'Kurumsal Kullanıcı Profilleri ({{count}})',
          addUser: 'Kullanıcı Ekle',
          assignedRole: 'Atanan Rol',
          clearanceStatus: 'Erişim Durumu',
          assignedHotels: 'Atanan Oteller',
          actions: 'İşlemler',
          empty: 'Kurumsal kullanıcı hesabı bulunamadı. Başlamak için bir tane ekleyin.',
          toastCreated: 'Kullanıcı başarıyla oluşturuldu',
          accessDenied: 'Erişim Reddedildi',
          missingPermission: 'Bu çalışma alanını görüntülemek için gerekli yetkiniz ({{permission}}) bulunmuyor.',
          phone: 'Telefon Numarası',
          title: 'Görev / Ünvan',
          department: 'Departman',
          avatarUrl: 'Profil Fotoğrafı URL',
          language: 'Dil Tercihi',
          timezone: 'Saat Dilimi'
        },
        org: {
          title: 'Kurumsal Şirket Bilgileri',
          name: 'Şirket Adı',
          taxOffice: 'Vergi Dairesi',
          taxNumber: 'Vergi Numarası',
          phone: 'Telefon',
          email: 'E-posta',
          website: 'Web Sitesi',
          address: 'Adres',
          country: 'Ülke',
          city: 'Şehir',
          currency: 'Para Birimi',
          defaultLanguage: 'Varsayılan Dil',
          logo: 'Şirket Logosu',
          logoUploading: 'Logo Yükleniyor...',
          save: 'Şirket Bilgilerini Kaydet',
          viewOnly: 'Görüntüleme Modu (Düzenleme Yetkiniz Yok)'
        }
      },
      login: {
        welcome: 'Tekrar Hoş Geldiniz',
        signIn: 'Giriş Yap',
        email: 'E-posta Adresi',
        password: 'Şifre',
        forgotPassword: 'Şifrenizi mi unuttunuz?',
        resetPassword: 'Şifreyi Sıfırla',
        backToSignIn: 'Giriş Yap Ekranına Dön',
        resetSub: 'Şifre sıfırlama talimatlarını almak için kurumsal e-posta adresinizi girin.',
        loginSub: 'Otelinize ait yönetim konsoluna erişmek için giriş yapın.',
        sendResetLink: 'Sıfırlama Bağlantısı Gönder',
        sendingRequest: 'İstek Gönderiliyor...',
        authenticating: 'Doğrulanıyor...',
        multiTenantAccess: 'Çoklu Otel Erişim Kuralı',
        multiTenantSub: 'Kurumsal e-postanız ile giriş yapın. Roller ve departman yetkileri kullanıcı profiliniz üzerinden otomatik olarak atanır.'
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
        admin: 'Панель администратора',
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
        empty: 'Нет отзывов гостей, соответствующих текущим условиям фильтра.',
        import30Days: 'Импортировать отзывы за 30 дней'
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
      },
      admin: {
        title: 'Настройки администратора',
        tabs: {
          users: 'Управление пользователями',
          hotels: 'Управление отелями',
          org: 'Организация',
          integrations: 'Интеграции и роли',
          onboarding: 'Онбординг клиентов'
        },
        users: {
          profilesCount: 'Профили пользователей ({{count}})',
          addUser: 'Добавить пользователя',
          assignedRole: 'Назначенная роль',
          clearanceStatus: 'Статус доступа',
          assignedHotels: 'Назначенные отели',
          actions: 'Действия',
          empty: 'Пользователи не найдены. Добавьте первого.',
          toastCreated: 'Пользователь успешно создан',
          accessDenied: 'Доступ запрещен',
          missingPermission: 'У вас нет необходимых прав ({{permission}}) для просмотра этой страницы.',
          phone: 'Номер телефона',
          title: 'Должность / Звание',
          department: 'Департамент',
          avatarUrl: 'URL аватара',
          language: 'Языковые предпочтения',
          timezone: 'Часовой пояс'
        },
        org: {
          title: 'Профиль корпоративной организации',
          name: 'Название компании',
          taxOffice: 'Налоговый орган',
          taxNumber: 'Налоговый номер',
          phone: 'Телефон',
          email: 'Электронная почта',
          website: 'Веб-сайт',
          address: 'Адрес',
          country: 'Страна',
          city: 'Город',
          currency: 'Валюта',
          defaultLanguage: 'Язык по умолчанию',
          logo: 'Логотип компании',
          logoUploading: 'Загрузка логотипа...',
          save: 'Сохранить информацию о компании',
          viewOnly: 'Только для чтения (Недостаточно прав для редактирования)'
        }
      },
      login: {
        welcome: 'С возвращением',
        signIn: 'Войти',
        email: 'Электронная почта',
        password: 'Пароль',
        forgotPassword: 'Забыли пароль?',
        resetPassword: 'Сбросить пароль',
        backToSignIn: 'Вернуться к входу',
        resetSub: 'Введите ваш корпоративный email для получения ссылки сброса пароля.',
        loginSub: 'Войдите для доступа к панели управления отеля.',
        sendResetLink: 'Отправить ссылку',
        sendingRequest: 'Отправка запроса...',
        authenticating: 'Авторизация...',
        multiTenantAccess: 'Правило многоарендного доступа',
        multiTenantSub: 'Войдите с корпоративной почтой. Роли и права отделов назначаются автоматически.'
      }
    }
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'tr',
    lng: 'tr', // Force default language to be Turkish
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage']
    },
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;
