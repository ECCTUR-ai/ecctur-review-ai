import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

const resources = {
  en: {
    translation: {
      sidebar: {
        dashboard: 'Dashboard',
        reviews: 'Reviews',
        ai_replies: 'AI Answer Center',
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
        title: 'Executive Dashboard',
        subtitle: 'Overview of hotel operations, AI insights, and platform sync reports.',
        apiConnectedLabel: 'API Connected',
        noHotels: 'No hotels assigned yet',
        kpi: {
          satisfactionScore: 'Guest Satisfaction Score',
          totalReviews: 'Total Reviews',
          averageRating: 'Average Rating',
          openTasks: 'Open Tasks',
          responseRate: 'Response Rate',
          aiDraftReplies: 'AI Draft Replies',
          lastWeek: 'Compared to Last Week',
          last30Days: 'Last 30 Days',
          allPlatforms: 'All Platforms',
          pendingActions: 'Pending Actions',
          allReviews: 'All Reviews',
          waitingApproval: 'Waiting Approval'
        },
        actions: {
          title: "Today's Critical Actions",
          criticalBadge: 'Critical',
          highBadge: 'High',
          mediumBadge: 'Medium',
          lowBadge: 'Low',
          empty: 'No critical or high priority tasks waiting for resolution today.',
          viewAll: 'View All Tasks'
        },
        performance: {
          title: 'Department Performance',
          period: 'Last 30 Days'
        },
        summary: {
          title: 'AI Operation Summary',
          badge: 'AI Engine'
        },
        taskState: {
          title: 'Task Overview',
          distribution: 'Distribution',
          total: 'Total',
          open: 'Open',
          inProgress: 'In Progress',
          waiting: 'Waiting',
          completed: 'Completed',
          deferred: 'Deferred',
          overdue: 'Overdue',
          unit: 'tasks',
          label: 'Tasks',
          button: 'Go to Tasks'
        },
        trend: {
          title: 'Guest Satisfaction Trend',
          period: 'Weekly Trend',
          google: 'Google',
          booking: 'Booking.com',
          tripadvisor: 'TripAdvisor',
          holidaycheck: 'HolidayCheck',
          hotels: 'Hotels.com'
        },
        riskCenter: {
          title: 'AI Risk Center',
          badge: 'AI Engine',
          reviewsCount: '{{count}} negative reviews in 30 days',
          high: 'High Risk',
          medium: 'Medium Risk',
          low: 'Low Risk',
          inspect: 'Inspect',
          button: 'All Insights'
        },
        competitor: {
          title: 'Competitor Analysis',
          comparison: 'Comparison',
          button: 'Open Competitor Analysis'
        },
        distribution: {
          title: 'Review Distribution (Last 30 Days)',
          sub: 'Rating Distribution',
          reviewsCount: '{{count}} reviews'
        },
        sync: {
          title: 'Last Synchronization Status',
          active: 'Active',
          success: 'Success',
          failed: 'Failed',
          waiting: 'Waiting',
          button: 'Sync Now',
          syncing: 'Syncing...',
          toastTitle: 'Synchronization',
          toastStarted: 'Synchronization started...',
          toastCompleted: 'Synchronization completed successfully.',
          toastFailed: 'Error: Synchronization failed.',
          toastClose: 'Close'
        },
        trends: {
          increasing: 'Increasing',
          stable: 'Stable',
          decreasing: 'Decreasing'
        }
      },
      reviews: {
        title: 'Review Console',
        subtitle: 'Manage and approve multi-channel guest comments & AI drafted responses.',
        search: 'Search by guest name...',
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
        ai_replies: 'AI Cevaplama Merkezi',
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
        title: 'Kontrol Paneli',
        subtitle: 'Otelinizin operasyonel durumu, yapay zeka analizleri ve performans raporları.',
        apiConnectedLabel: 'API Bağlantısı Etkin',
        noHotels: 'Bu kullanıcıya henüz otel atanmamış',
        kpi: {
          satisfactionScore: 'Misafir Memnuniyet Puanı',
          totalReviews: 'Toplam Yorum',
          averageRating: 'Ortalama Puan',
          openTasks: 'Açık Görevler',
          responseRate: 'Yanıtlanma Oranı',
          aiDraftReplies: 'Yapay Zeka Taslakları',
          lastWeek: 'Geçen Haftaya Göre',
          last30Days: 'Son 30 Gün',
          allPlatforms: 'Tüm Platformlar',
          pendingActions: 'Aksiyon Bekleyen',
          allReviews: 'Tüm yorumlarda',
          waitingApproval: 'Onay Bekleyen'
        },
        actions: {
          title: 'Bugün Acil Aksiyonlar',
          criticalBadge: 'Kritik',
          highBadge: 'Yüksek',
          mediumBadge: 'Orta',
          lowBadge: 'Düşük',
          empty: 'Bugün çözüm bekleyen yüksek öncelikli veya kritik görev bulunmuyor.',
          viewAll: 'Tüm görevlere git'
        },
        performance: {
          title: 'Departman Performansı',
          period: 'Son 30 Gün'
        },
        summary: {
          title: 'AI Operasyon Özeti',
          badge: 'Yapay Zeka'
        },
        taskState: {
          title: 'Görev Durumu',
          distribution: 'Dağılım',
          total: 'Toplam',
          open: 'Açık',
          inProgress: 'Devam Ediyor',
          waiting: 'Beklemede',
          completed: 'Tamamlandı',
          deferred: 'Ertelendi',
          overdue: 'Geciken',
          unit: 'adet',
          label: 'Görev',
          button: 'Görevlere git'
        },
        trend: {
          title: 'Misafir Memnuniyet Trendi',
          period: 'Haftalık Trend',
          google: 'Google',
          booking: 'Booking.com',
          tripadvisor: 'TripAdvisor',
          holidaycheck: 'HolidayCheck',
          hotels: 'Hotels.com'
        },
        riskCenter: {
          title: 'Yapay Zeka Risk Merkezi',
          badge: 'Yapay Zeka',
          reviewsCount: 'Son 30 günde {{count}} olumsuz yorum',
          high: 'Yüksek Risk',
          medium: 'Orta Risk',
          low: 'Düşük Risk',
          inspect: 'İncele',
          button: 'Tüm analizleri gör'
        },
        competitor: {
          title: 'Rakip Analizi',
          comparison: 'Karşılaştırma',
          button: 'Rakip analizi detayları'
        },
        distribution: {
          title: 'Yorum Dağılımı (Son 30 Gün)',
          sub: 'Rating Dağılımı',
          reviewsCount: '{{count}} yorum'
        },
        sync: {
          title: 'Son Senkronizasyon Bilgileri',
          active: 'Aktif',
          success: 'Başarılı',
          failed: 'Başarısız',
          waiting: 'Bekliyor',
          button: 'Şimdi Senkronize Et',
          syncing: 'Senkronize ediliyor...',
          toastTitle: 'Senkronizasyon',
          toastStarted: 'Senkronizasyon başlatıldı...',
          toastCompleted: 'Senkronizasyon başarıyla tamamlandı.',
          toastFailed: 'Hata: Senkronizasyon başarısız oldu.',
          toastClose: 'Kapat'
        },
        trends: {
          increasing: 'Yükseliyor',
          stable: 'Sabit',
          decreasing: 'Düşüyor'
        }
      },
      reviews: {
        title: 'Yorum Konsolu',
        subtitle: 'Çok kanallı misafir yorumlarını ve AI tarafından hazırlanan taslak yanıtları yönetin.',
        search: 'Misafir adına göre ara...',
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
        ai_replies: 'Центр ИИ-ответов',
        tasks: 'Задачи',
        departments: 'Отделы',
        analytics: 'Аналитика',
        reports: 'Отчеты',
        whatsapp: 'WhatsApp',
        settings: 'Настройки',
        admin: 'Панель администратора',
        logout: 'Выйти'
      },
      dashboard: {
        title: 'Панель управления',
        subtitle: 'Операционное состояние вашего отеля, анализ ИИ и отчеты о синхронизации платформ.',
        apiConnectedLabel: 'API подключено',
        noHotels: 'Отели не назначены',
        kpi: {
          satisfactionScore: 'Индекс удовлетворенности',
          totalReviews: 'Всего отзывов',
          averageRating: 'Средний балл',
          openTasks: 'Открытые задачи',
          responseRate: 'Индекс ответов',
          aiDraftReplies: 'Черновики ответов ИИ',
          lastWeek: 'По сравнению с прошлой неделей',
          last30Days: 'За последние 30 дней',
          allPlatforms: 'Все платформы',
          pendingActions: 'Ожидают действий',
          allReviews: 'Всего ответов',
          waitingApproval: 'Ожидают подтверждения'
        },
        actions: {
          title: 'Срочные действия на сегодня',
          criticalBadge: 'Критический',
          highBadge: 'Высокий',
          mediumBadge: 'Средний',
          lowBadge: 'Низкий',
          empty: 'Сегодня нет нерешенных критических или высокоприоритетных задач.',
          viewAll: 'Перейти к задачам'
        },
        performance: {
          title: 'Эффективность отделов',
          period: 'За последние 30 дней'
        },
        summary: {
          title: 'Сводка работы ИИ',
          badge: 'Искусственный интеллект'
        },
        taskState: {
          title: 'Статус задач',
          distribution: 'Распределение',
          total: 'Всего',
          open: 'Открыто',
          inProgress: 'В работе',
          waiting: 'Ожидание',
          completed: 'Завершено',
          deferred: 'Отложено',
          overdue: 'Просрочено',
          unit: 'задач',
          label: 'Задачи',
          button: 'Перейти к задачам'
        },
        trend: {
          title: 'Тренд удовлетворенности гостей',
          period: 'Еженедельный тренд',
          google: 'Google',
          booking: 'Booking.com',
          tripadvisor: 'TripAdvisor',
          holidaycheck: 'HolidayCheck',
          hotels: 'Hotels.com'
        },
        riskCenter: {
          title: 'Центр ИИ-рисков',
          badge: 'ИИ-анализ',
          reviewsCount: '{{count}} негативных отзывов за 30 дней',
          high: 'Высокий риск',
          medium: 'Средний риск',
          low: 'Низкий риск',
          inspect: 'Проверить',
          button: 'Посмотреть все инсайты'
        },
        competitor: {
          title: 'Анализ конкурентов',
          comparison: 'Сравнение',
          button: 'Подробнее об анализе конкурентов'
        },
        distribution: {
          title: 'Распределение отзывов (30 дней)',
          sub: 'Распределение рейтинга',
          reviewsCount: '{{count}} отзывов'
        },
        sync: {
          title: 'Статус синхронизации',
          active: 'Активно',
          success: 'Успешно',
          failed: 'Ошибка',
          waiting: 'Ожидание',
          button: 'Синхронизировать сейчас',
          syncing: 'Идет синхронизация...',
          toastTitle: 'Синхронизация',
          toastStarted: 'Синхронизация запущена...',
          toastCompleted: 'Синхронизация успешно завершена.',
          toastFailed: 'Ошибка синхронизации.',
          toastClose: 'Закрыть'
        },
        trends: {
          increasing: 'Растет',
          stable: 'Стабильно',
          decreasing: 'Падает'
        }
      },
      reviews: {
        title: 'Консоль отзывов',
        subtitle: 'Управляйте и утверждайте многоканальные комментарии гостей и ответы, составленные ИИ.',
        search: 'Поиск по имени гостя...',
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
