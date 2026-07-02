import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useFetch } from '@/hooks/useFetch';
import { adminService } from '@/services/adminService';
import { hotelService } from '@/services/hotelService';
import { UserProfile, Hotel, Role, IntegrationSetting, Organization } from '@/types';
import { 
  Users, 
  Building, 
  Building2, 
  Settings, 
  Sliders, 
  Plus, 
  Edit3, 
  Save, 
  X, 
  ShieldCheck, 
  Database,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  UserCheck,
  Power,
  Trash2,
  Sparkles,
  MapPin
} from 'lucide-react';
import { useAuth } from '@/components/AuthGuard';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';

export default function Admin() {
  const { t } = useTranslation();
  const { role } = useAuth();
  const roleNameLower = role?.toLowerCase() || 'staff';
  const isSuperOrAdmin = roleNameLower === 'super admin' || roleNameLower === 'admin';

  const location = useLocation();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'users' | 'hotels' | 'org' | 'integrations' | 'onboarding' | 'google-locations'>(() => {
    return window.location.pathname === '/admin/google-locations' ? 'google-locations' : 'users';
  });
  const [toast, setToast] = useState<string | null>(null);

  const handleTabChange = (tab: 'users' | 'hotels' | 'org' | 'integrations' | 'onboarding' | 'google-locations') => {
    setActiveTab(tab);
    if (tab === 'google-locations') {
      navigate('/admin/google-locations');
    } else {
      navigate('/admin');
    }
  };

  // Sync from URL to activeTab
  useEffect(() => {
    if (location.pathname === '/admin/google-locations') {
      if (activeTab !== 'google-locations') {
        setActiveTab('google-locations');
      }
    } else if (location.pathname === '/admin') {
      if (activeTab === 'google-locations') {
        setActiveTab('users');
      }
    }
  }, [location.pathname, activeTab]);

  // Form States - Customer Onboarding Wizard
  const [wizardStep, setWizardStep] = useState(1);
  const [onboardOrgName, setOnboardOrgName] = useState('');
  const [onboardOrgContact, setOnboardOrgContact] = useState('');
  const [onboardOrgPhone, setOnboardOrgPhone] = useState('');
  const [onboardOrgEmail, setOnboardOrgEmail] = useState('');
  const [onboardOrgLogoUrl, setOnboardOrgLogoUrl] = useState('');
  const [onboardOrgTaxOffice, setOnboardOrgTaxOffice] = useState('');
  const [onboardOrgTaxNumber, setOnboardOrgTaxNumber] = useState('');
  const [onboardOrgAddress, setOnboardOrgAddress] = useState('');

  const [onboardHotelName, setOnboardHotelName] = useState('');
  const [onboardHotelMaps, setOnboardHotelMaps] = useState('');
  const [onboardHotelAddress, setOnboardHotelAddress] = useState('');
  const [onboardHotelPhone, setOnboardHotelPhone] = useState('');
  const [onboardHotelWebsite, setOnboardHotelWebsite] = useState('');
  const [onboardHotelCity, setOnboardHotelCity] = useState('');
  const [onboardHotelCountry, setOnboardHotelCountry] = useState('');
  const [onboardHotelTimezone, setOnboardHotelTimezone] = useState('Europe/Istanbul');
  const [onboardHotelLang, setOnboardHotelLang] = useState('tr');

  const [onboardGoogleConnected, setOnboardGoogleConnected] = useState(false);
  const [onboardTripadvisorLink, setOnboardTripadvisorLink] = useState('');
  const [onboardWhatsappNumber, setOnboardWhatsappNumber] = useState('');
  const [onboardEmailIntegration, setOnboardEmailIntegration] = useState('');

  const [onboardUsers, setOnboardUsers] = useState<any[]>([
    { firstName: '', lastName: '', email: '', password: '', phone: '', title: '', role: 'Hotel Manager' }
  ]);

  const [onboardAILang, setOnboardAILang] = useState('tr');
  const [onboardAITone, setOnboardAITone] = useState<'official' | 'warm' | 'premium'>('warm');
  const [onboardAIAutoDraft, setOnboardAIAutoDraft] = useState(true);
  const [onboardAILowRatingAlert, setOnboardAILowRatingAlert] = useState(true);

  const [isOnboardingSaving, setIsOnboardingSaving] = useState(false);
  const [isOnboardLogoUploading, setIsOnboardLogoUploading] = useState(false);

  // Google Locations state variables
  const [googleLocations, setGoogleLocations] = useState<any[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [locationsError, setLocationsError] = useState<string | null>(null);
  const [selectedHotelForGoogle, setSelectedHotelForGoogle] = useState<string>('');
  const [connectingLocationId, setConnectingLocationId] = useState<string | null>(null);

  useEffect(() => {
    if (activeTab === 'google-locations') {
      fetchGoogleLocations();
    }
  }, [activeTab]);

  const fetchGoogleLocations = async () => {
    setLoadingLocations(true);
    setLocationsError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Oturum bilgisi bulunamadı.');

      const res = await fetch('/api/admin-google-locations', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await res.json();
      console.log('[Google Locations API Response]', data);
      
      if (!res.ok) {
        const errorMsg = data.reason
          ? `${data.error || 'Hata'} (Hata Nedeni: ${data.reason})`
          : (data.error || 'Lokasyonlar yüklenemedi.');
        throw new Error(errorMsg);
      }

      setGoogleLocations(data.locations || []);
    } catch (err: any) {
      console.error(err);
      setLocationsError(err.message || 'Lokasyon yükleme hatası.');
    } finally {
      setLoadingLocations(false);
    }
  };

  const handleConnectLocation = async (loc: any) => {
    if (!selectedHotelForGoogle) {
      alert('Lütfen işlem yapılacak oteli seçin.');
      return;
    }
    setConnectingLocationId(loc.locationId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Oturum bilgisi bulunamadı.');

      const res = await fetch('/api/admin-connect-location', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          hotelId: selectedHotelForGoogle,
          googleAccountId: loc.accountId,
          googleLocationId: loc.locationId,
          googleBusinessName: loc.businessName
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Bağlantı işlemi başarısız.');
      }

      setToast('Google lokasyonu başarıyla otele bağlandı.');
      refetchHotels(); // Refresh hotel list mapping details
      setTimeout(() => setToast(null), 4000);
    } catch (err: any) {
      console.error(err);
      alert(`Hata: ${err.message || 'Bağlantı yapılırken bir hata oluştu.'}`);
    } finally {
      setConnectingLocationId(null);
    }
  };

  const handleOnboardLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsOnboardLogoUploading(true);
    try {
      const fileName = `logos/onboard-${Date.now()}-${file.name}`;
      const { data, error: uploadErr } = await supabase.storage
        .from('organization-assets')
        .upload(fileName, file, {
          upsert: true,
          contentType: file.type
        });

      if (uploadErr) throw uploadErr;

      const { data: { publicUrl } } = supabase.storage
        .from('organization-assets')
        .getPublicUrl(fileName);

      setOnboardOrgLogoUrl(publicUrl);
      triggerToast('Logo uploaded successfully');
    } catch (err: any) {
      console.error(err);
      triggerToast(`Logo upload failed: ${err.message}`);
    } finally {
      setIsOnboardLogoUploading(false);
    }
  };

  const validateOnboardStep = (): boolean => {
    if (wizardStep === 1) {
      if (!onboardOrgName.trim()) { triggerToast('Şirket Adı gereklidir.'); return false; }
      if (!onboardOrgEmail.trim()) { triggerToast('Şirket E-postası gereklidir.'); return false; }
      return true;
    }
    if (wizardStep === 2) {
      if (!onboardHotelName.trim()) { triggerToast('Otel Adı gereklidir.'); return false; }
      if (!onboardHotelCity.trim() || !onboardHotelCountry.trim()) { triggerToast('Şehir ve Ülke gereklidir.'); return false; }
      return true;
    }
    if (wizardStep === 4) {
      for (let i = 0; i < onboardUsers.length; i++) {
        const u = onboardUsers[i];
        if (!u.firstName.trim() || !u.lastName.trim()) {
          triggerToast(`Kullanıcı ${i + 1} için Ad ve Soyad alanları doldurulmalıdır.`);
          return false;
        }
        if (!u.email.trim() || !u.email.includes('@')) {
          triggerToast(`Kullanıcı ${i + 1} için geçerli bir E-posta girilmelidir.`);
          return false;
        }
        if (!u.password || u.password.length < 8) {
          triggerToast(`Kullanıcı ${i + 1} şifresi en az 8 karakter olmalıdır.`);
          return false;
        }
      }
      return true;
    }
    return true;
  };

  const handleTriggerOnboarding = async () => {
    setIsOnboardingSaving(true);
    try {
      const payload = {
        org: {
          name: onboardOrgName,
          logoUrl: onboardOrgLogoUrl,
          taxOffice: onboardOrgTaxOffice,
          taxNumber: onboardOrgTaxNumber,
          phone: onboardOrgPhone,
          email: onboardOrgEmail,
          address: onboardOrgAddress
        },
        hotel: {
          name: onboardHotelName,
          googleMapsLink: onboardHotelMaps,
          address: onboardHotelAddress,
          phone: onboardHotelPhone,
          website: onboardHotelWebsite,
          city: onboardHotelCity,
          country: onboardHotelCountry,
          timezone: onboardHotelTimezone,
          defaultLanguage: onboardHotelLang
        },
        connections: {
          googleConnected: onboardGoogleConnected,
          tripadvisorLink: onboardTripadvisorLink,
          whatsappNumber: onboardWhatsappNumber,
          emailIntegration: onboardEmailIntegration
        },
        users: onboardUsers,
        aiSettings: {
          responseLanguage: onboardAILang,
          tone: onboardAITone,
          autoRespond: onboardAIAutoDraft,
          lowRatingAlerts: onboardAILowRatingAlert
        }
      };

      await adminService.onboardCustomer(payload);
      triggerToast('Müşteri kurulumu başarıyla tamamlandı');
      
      setWizardStep(1);
      setOnboardOrgName('');
      setOnboardOrgContact('');
      setOnboardOrgPhone('');
      setOnboardOrgEmail('');
      setOnboardOrgLogoUrl('');
      setOnboardOrgTaxOffice('');
      setOnboardOrgTaxNumber('');
      setOnboardOrgAddress('');
      setOnboardHotelName('');
      setOnboardHotelMaps('');
      setOnboardHotelAddress('');
      setOnboardHotelPhone('');
      setOnboardHotelWebsite('');
      setOnboardHotelCity('');
      setOnboardHotelCountry('');
      setOnboardUsers([{ firstName: '', lastName: '', email: '', password: '', phone: '', title: '', role: 'Hotel Manager' }]);
      
      handleTabChange('users');
      refetchUsers();
      refetchOrgs();
      refetchHotels();
    } catch (err: any) {
      console.error(err);
      triggerToast(`Kurulum Hatası (Adım ${wizardStep}): ${err.message || 'Bilinmeyen bir hata oluştu.'}`);
    } finally {
      setIsOnboardingSaving(false);
    }
  };

  // Load Data
  const { data: users, loading: usersLoading, refetch: refetchUsers } = useFetch(() => adminService.getAllUsers());
  const { data: roles } = useFetch(() => adminService.getRoles());
  const { data: hotels, refetch: refetchHotels } = useFetch(() => hotelService.getHotels());
  const { data: orgs, refetch: refetchOrgs } = useFetch(() => hotelService.getOrganizations());
  const { data: integrations, refetch: refetchIntegrations } = useFetch(() => adminService.getSettings());

  console.log('[Admin Page] Loaded roles data:', roles);

  // Current Organization
  const currentOrg = orgs?.[0] || { id: '7cc77cc7-7cc7-7cc7-7cc7-7cc77cc77cc7', name: 'GuestReview.ai', createdAt: '' };

  // Form States - User
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [userEmail, setUserEmail] = useState('');
  const [userFirstName, setUserFirstName] = useState('');
  const [userLastName, setUserLastName] = useState('');
  const [userStatus, setUserStatus] = useState<'active' | 'inactive'>('active');
  const [userRoleId, setUserRoleId] = useState('');
  const [userHotelIds, setUserHotelIds] = useState<string[]>([]);
  const [userOrgId, setUserOrgId] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [userConfirmPassword, setUserConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [userPhone, setUserPhone] = useState('');
  const [userTitle, setUserTitle] = useState('');
  const [userDepartment, setUserDepartment] = useState('');
  const [userAvatarUrl, setUserAvatarUrl] = useState('');
  const [userLanguage, setUserLanguage] = useState('tr');
  const [userTimezone, setUserTimezone] = useState('Europe/Istanbul');

  // Form States - Hotel
  const [isAddingHotel, setIsAddingHotel] = useState(false);
  const [editingHotel, setEditingHotel] = useState<Hotel | null>(null);
  const [hotelName, setHotelName] = useState('');
  const [hotelOrgId, setHotelOrgId] = useState(currentOrg.id);
  const [hotelGoogleMapsLink, setHotelGoogleMapsLink] = useState('');

  // Form States - Organization
  const [isEditingOrg, setIsEditingOrg] = useState(false);
  const [orgName, setOrgName] = useState(currentOrg.name);
  const [orgLogoUrl, setOrgLogoUrl] = useState('');
  const [orgTaxOffice, setOrgTaxOffice] = useState('');
  const [orgTaxNumber, setOrgTaxNumber] = useState('');
  const [orgPhone, setOrgPhone] = useState('');
  const [orgEmail, setOrgEmail] = useState('');
  const [orgWebsite, setOrgWebsite] = useState('');
  const [orgAddress, setOrgAddress] = useState('');
  const [orgCountry, setOrgCountry] = useState('');
  const [orgCity, setOrgCity] = useState('');
  const [orgCurrency, setOrgCurrency] = useState('TRY');
  const [orgDefaultLanguage, setOrgDefaultLanguage] = useState('tr');

  useEffect(() => {
    if (orgs && orgs.length > 0) {
      const org = orgs[0];
      setOrgName(org.name || '');
      setOrgLogoUrl(org.logoUrl || '');
      setOrgTaxOffice(org.taxOffice || '');
      setOrgTaxNumber(org.taxNumber || '');
      setOrgPhone(org.phone || '');
      setOrgEmail(org.email || '');
      setOrgWebsite(org.website || '');
      setOrgAddress(org.address || '');
      setOrgCountry(org.country || '');
      setOrgCity(org.city || '');
      setOrgCurrency(org.currency || 'TRY');
      setOrgDefaultLanguage(org.defaultLanguage || 'tr');
    }
  }, [orgs]);

  // Show toast helper
  const triggerToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // User Actions
  const handleOpenAddUser = () => {
    setIsAddingUser(true);
    setEditingUser(null);
    setUserEmail('');
    setUserFirstName('');
    setUserLastName('');
    setUserStatus('active');
    setUserRoleId(roles?.[0]?.id || '');
    setUserHotelIds([]);
    setUserOrgId(currentOrg.id);
    setUserPassword('');
    setUserConfirmPassword('');
    setShowPassword(false);
    setUserPhone('');
    setUserTitle('');
    setUserDepartment('');
    setUserAvatarUrl('');
    setUserLanguage('tr');
    setUserTimezone('Europe/Istanbul');
  };

  const handleOpenEditUser = (user: UserProfile) => {
    setEditingUser(user);
    setIsAddingUser(false);
    setUserEmail(user.email);
    setUserFirstName(user.firstName || '');
    setUserLastName(user.lastName || '');
    setUserStatus(user.status);
    setUserRoleId(user.roleId || '');
    setUserHotelIds(user.hotelIds || []);
    setUserOrgId(user.organizationId || currentOrg.id);
    setUserPhone(user.phone || '');
    setUserTitle(user.title || '');
    setUserDepartment(user.department || '');
    setUserAvatarUrl(user.avatarUrl || '');
    setUserLanguage(user.language || 'tr');
    setUserTimezone(user.timezone || 'Europe/Istanbul');
    setUserPassword('');
    setUserConfirmPassword('');
    setShowPassword(false);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isAddingUser) {
        if (!userPassword) {
          triggerToast('Password is required');
          return;
        }
        if (userPassword.length < 8) {
          triggerToast('Password must be at least 8 characters long');
          return;
        }
        if (userPassword !== userConfirmPassword) {
          triggerToast('Passwords do not match');
          return;
        }
      }

      const payload = {
        email: userEmail,
        firstName: userFirstName,
        lastName: userLastName,
        status: userStatus,
        roleId: userRoleId || undefined,
        hotelIds: userHotelIds,
        organizationId: userOrgId || undefined,
        password: isAddingUser ? userPassword : undefined,
        phone: userPhone || undefined,
        title: userTitle || undefined,
        department: userDepartment || undefined,
        avatarUrl: userAvatarUrl || undefined,
        language: userLanguage || undefined,
        timezone: userTimezone || undefined
      };

      if (isAddingUser) {
        await adminService.addUser(payload);
        triggerToast(t('admin.users.toastCreated'));
      } else if (editingUser) {
        await adminService.editUser(editingUser.id, payload);
        triggerToast('User updated successfully');
      }

      setIsAddingUser(false);
      setEditingUser(null);
      refetchUsers();
    } catch (err: any) {
      console.error(err);
      triggerToast(`Error: ${err.message || 'Operation failed'}`);
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this user profile and revoke their login?')) return;
    try {
      await adminService.deleteUser(id);
      triggerToast('User profile deleted successfully');
      refetchUsers();
    } catch (err: any) {
      console.error(err);
      triggerToast(`Error: ${err.message || 'Failed to delete user'}`);
    }
  };

  const handleToggleHotelAccess = (hotelId: string) => {
    if (userHotelIds.includes(hotelId)) {
      setUserHotelIds(userHotelIds.filter(id => id !== hotelId));
    } else {
      setUserHotelIds([...userHotelIds, hotelId]);
    }
  };

  // Hotel Actions
  const handleOpenAddHotel = () => {
    setIsAddingHotel(true);
    setEditingHotel(null);
    setHotelName('');
    setHotelOrgId(currentOrg.id);
    setHotelGoogleMapsLink('');
  };

  const handleOpenEditHotel = (h: Hotel) => {
    setEditingHotel(h);
    setIsAddingHotel(false);
    setHotelName(h.name);
    setHotelOrgId(h.organizationId);
    setHotelGoogleMapsLink(h.googleMapsUrl || h.googleMapsLink || '');
  };

  const handleSaveHotel = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      console.log('[DEBUG-ADMIN-SAVE] Saving hotel values:');
      console.log('  - State hotelGoogleMapsLink:', hotelGoogleMapsLink);
      console.log('  - Parameter googleMapsUrl sent to adminService:', hotelGoogleMapsLink);

      if (isAddingHotel) {
        await adminService.addHotel({ name: hotelName, organizationId: hotelOrgId, googleMapsUrl: hotelGoogleMapsLink });
        triggerToast('Hotel added successfully');
      } else if (editingHotel) {
        await adminService.editHotel(editingHotel.id, { name: hotelName, organizationId: hotelOrgId, googleMapsUrl: hotelGoogleMapsLink });
        triggerToast('Hotel updated successfully');
      }

      setIsAddingHotel(false);
      setEditingHotel(null);
      setHotelGoogleMapsLink('');
      refetchHotels();
    } catch (err: any) {
      console.error(err);
      triggerToast(`Error: ${err.message || 'Operation failed'}`);
    }
  };

  // Org Actions
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingLogo(true);
    try {
      const fileName = `logos/${currentOrg.id}-${Date.now()}-${file.name}`;
      const { data, error: uploadError } = await supabase.storage
        .from('organization-assets')
        .upload(fileName, file, {
          upsert: true,
          contentType: file.type
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('organization-assets')
        .getPublicUrl(fileName);

      setOrgLogoUrl(publicUrl);
      triggerToast('Logo uploaded successfully');
    } catch (err: any) {
      console.error(err);
      triggerToast(`Logo upload failed: ${err.message}`);
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleSaveOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await adminService.updateOrganization(currentOrg.id, {
        name: orgName,
        logoUrl: orgLogoUrl || undefined,
        taxOffice: orgTaxOffice || undefined,
        taxNumber: orgTaxNumber || undefined,
        phone: orgPhone || undefined,
        email: orgEmail || undefined,
        website: orgWebsite || undefined,
        address: orgAddress || undefined,
        country: orgCountry || undefined,
        city: orgCity || undefined,
        currency: orgCurrency || undefined,
        defaultLanguage: orgDefaultLanguage || undefined
      });
      triggerToast('Organization updated successfully');
      setIsEditingOrg(false);
      refetchOrgs();
    } catch (err: any) {
      console.error(err);
      triggerToast(`Error: ${err.message || 'Operation failed'}`);
    }
  };

  // Toggle Integration Status
  const handleToggleIntegration = async (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'connected' ? 'disconnected' : 'connected';
    try {
      await adminService.updateSettingStatus(id, nextStatus);
      triggerToast('Integration updated successfully');
      refetchIntegrations();
    } catch (err: any) {
      console.error(err);
      triggerToast(`Error: ${err.message || 'Operation failed'}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="border-b border-slate-200 pb-6 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-slate-100 m-0">{t('admin.title')}</h1>
          <p className="text-xs text-slate-400 mt-1.5">
            Manage users, hotels, organization profiles, and connected external pipelines.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-2">
        <button
          onClick={() => handleTabChange('users')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold uppercase tracking-wider border-b-2 transition-all ${
            activeTab === 'users' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users size={14} />
          {t('admin.tabs.users')}
        </button>
        {isSuperOrAdmin && (
          <button
            onClick={() => handleTabChange('hotels')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold uppercase tracking-wider border-b-2 transition-all ${
              activeTab === 'hotels' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Building size={14} />
            {t('admin.tabs.hotels')}
          </button>
        )}
        {(isSuperOrAdmin || roleNameLower === 'hotel manager') && (
          <button
            onClick={() => handleTabChange('org')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold uppercase tracking-wider border-b-2 transition-all ${
              activeTab === 'org' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Building2 size={14} />
            {t('admin.tabs.org')}
          </button>
        )}
        {isSuperOrAdmin && (
          <>
            <button
              onClick={() => handleTabChange('integrations')}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold uppercase tracking-wider border-b-2 transition-all ${
                activeTab === 'integrations' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sliders size={14} />
              {t('admin.tabs.integrations')}
            </button>
            <button
              onClick={() => handleTabChange('onboarding')}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold uppercase tracking-wider border-b-2 transition-all ${
                activeTab === 'onboarding' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sparkles size={14} />
              {t('admin.tabs.onboarding')}
            </button>
            <button
              onClick={() => handleTabChange('google-locations')}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold uppercase tracking-wider border-b-2 transition-all ${
                activeTab === 'google-locations' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <MapPin size={14} />
              <span>Google Lokasyonları</span>
            </button>
          </>
        )}
      </div>

      {/* Tab Contents */}
      <div className="space-y-6">
        {/* TAB 1: USER MANAGEMENT */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            {/* User Form Panel (Add / Edit) */}
            {(isAddingUser || editingUser) && (
              <div className="glass-panel p-6 rounded-2xl border border-blue-500/20 bg-slate-50/40 relative card-glow">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                    <UserCheck size={16} className="text-blue-400" />
                    {isAddingUser ? 'Add User Profile' : 'Edit User Profile'}
                  </h3>
                  <button 
                    onClick={() => { setIsAddingUser(false); setEditingUser(null); }}
                    className="p-1 rounded-lg hover:bg-slate-50 text-slate-400 hover:text-slate-200"
                  >
                    <X size={14} />
                  </button>
                </div>

                <form onSubmit={handleSaveUser} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Corporate Email</label>
                      <input
                        type="email"
                        required
                        value={userEmail}
                        onChange={(e) => setUserEmail(e.target.value)}
                        placeholder="email@guestreview.ai"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs focus:outline-none focus:border-blue-500 text-slate-300 placeholder:text-slate-400"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">First Name</label>
                      <input
                        type="text"
                        value={userFirstName}
                        onChange={(e) => setUserFirstName(e.target.value)}
                        placeholder="John"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs focus:outline-none focus:border-blue-500 text-slate-300 placeholder:text-slate-400"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Last Name</label>
                      <input
                        type="text"
                        value={userLastName}
                        onChange={(e) => setUserLastName(e.target.value)}
                        placeholder="Doe"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs focus:outline-none focus:border-blue-500 text-slate-300 placeholder:text-slate-400"
                      />
                    </div>
                  </div>

                  {isAddingUser && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center">
                          <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Password</label>
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="text-[10px] text-blue-400 hover:text-blue-300 font-semibold"
                          >
                            {showPassword ? 'Hide' : 'Show'}
                          </button>
                        </div>
                        <input
                          type={showPassword ? 'text' : 'password'}
                          required
                          value={userPassword}
                          onChange={(e) => setUserPassword(e.target.value)}
                          placeholder="At least 8 characters"
                          className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs focus:outline-none focus:border-blue-500 text-slate-300 placeholder:text-slate-400"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide block">Confirm Password</label>
                        <input
                          type={showPassword ? 'text' : 'password'}
                          required
                          value={userConfirmPassword}
                          onChange={(e) => setUserConfirmPassword(e.target.value)}
                          placeholder="Re-enter password"
                          className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs focus:outline-none focus:border-blue-500 text-slate-300 placeholder:text-slate-400"
                        />
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Assigned Security Role</label>
                      <select
                        value={userRoleId}
                        onChange={(e) => setUserRoleId(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs focus:outline-none focus:border-blue-500 text-slate-300"
                      >
                        {roles?.map((r) => (
                          <option key={r.id} value={r.id} className="bg-[#090b16] text-slate-300">
                            {r.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Access Clearance Status</label>
                      <select
                        value={userStatus}
                        onChange={(e) => setUserStatus(e.target.value as any)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs focus:outline-none focus:border-blue-500 text-slate-300"
                      >
                        <option value="active" className="bg-[#090b16] text-slate-300">Active (Grant platform access)</option>
                        <option value="inactive" className="bg-[#090b16] text-slate-300">Inactive (Revoke platform access)</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Parent Organization</label>
                      <select
                        value={userOrgId}
                        onChange={(e) => setUserOrgId(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs focus:outline-none focus:border-blue-500 text-slate-300"
                      >
                        {orgs?.map((o) => (
                          <option key={o.id} value={o.id} className="bg-[#090b16] text-slate-300">
                            {o.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Row 3: Contact & Department Details */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{t('admin.users.phone')}</label>
                      <input
                        type="text"
                        value={userPhone}
                        onChange={(e) => setUserPhone(e.target.value)}
                        placeholder="+90 555 123 4567"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs focus:outline-none focus:border-blue-500 text-slate-300 placeholder:text-slate-400"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{t('admin.users.title')}</label>
                      <input
                        type="text"
                        value={userTitle}
                        onChange={(e) => setUserTitle(e.target.value)}
                        placeholder="Guest Relations Specialist"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs focus:outline-none focus:border-blue-500 text-slate-300 placeholder:text-slate-400"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{t('admin.users.department')}</label>
                      <input
                        type="text"
                        value={userDepartment}
                        onChange={(e) => setUserDepartment(e.target.value)}
                        placeholder="Front Office"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs focus:outline-none focus:border-blue-500 text-slate-300 placeholder:text-slate-400"
                      />
                    </div>
                  </div>

                  {/* Row 4: Avatar, Language & Timezone */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{t('admin.users.avatarUrl')}</label>
                      <input
                        type="text"
                        value={userAvatarUrl}
                        onChange={(e) => setUserAvatarUrl(e.target.value)}
                        placeholder="https://example.com/avatar.jpg"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs focus:outline-none focus:border-blue-500 text-slate-300 placeholder:text-slate-400"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{t('admin.users.language')}</label>
                      <select
                        value={userLanguage}
                        onChange={(e) => setUserLanguage(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs focus:outline-none focus:border-blue-500 text-slate-300"
                      >
                        <option value="tr" className="bg-[#090b16] text-slate-300">Türkçe</option>
                        <option value="en" className="bg-[#090b16] text-slate-300">English</option>
                        <option value="ru" className="bg-[#090b16] text-slate-300">Русский</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{t('admin.users.timezone')}</label>
                      <input
                        type="text"
                        value={userTimezone}
                        onChange={(e) => setUserTimezone(e.target.value)}
                        placeholder="Europe/Istanbul"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs focus:outline-none focus:border-blue-500 text-slate-300 placeholder:text-slate-400"
                      />
                    </div>
                  </div>

                  {/* Assign Hotel Access clearances */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide block">Hotel Access Permissions</label>
                    <div className="flex flex-wrap gap-2">
                      {hotels?.map((h) => {
                        const hasAccess = userHotelIds.includes(h.id);
                        return (
                          <button
                            key={h.id}
                            type="button"
                            onClick={() => handleToggleHotelAccess(h.id)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
                              hasAccess 
                                ? 'bg-blue-600/10 border-blue-500/30 text-blue-400' 
                                : 'bg-white border-slate-200 text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            {h.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {isAddingUser && (
                    <div className="p-3.5 rounded-xl bg-blue-500/[0.02] border border-blue-500/10 text-[10px] text-blue-400 leading-relaxed">
                      <div className="font-semibold flex items-center gap-1 mb-1">
                        <Sparkles size={11} />
                        <span>Corporate Email Invitation</span>
                      </div>
                      <span>
                        Adding a user will automatically register them in Supabase Auth and issue a secure email invitation.
                      </span>
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={() => { setIsAddingUser(false); setEditingUser(null); }}
                      className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-400 hover:text-slate-200 font-medium text-xs rounded-xl"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 transition-colors text-white font-medium text-xs rounded-xl"
                    >
                      <Save size={14} />
                      Save Profile
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Users List Card */}
            <div className="glass-panel rounded-2xl relative overflow-hidden card-glow">
              <div className="h-16 flex items-center justify-between px-6 border-b border-slate-200">
                <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2 m-0">
                  <Users size={16} className="text-blue-400" />
                  {t('admin.users.profilesCount', { count: users?.length || 0 })}
                </h3>
                {isSuperOrAdmin && (
                  <button
                    onClick={handleOpenAddUser}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 transition-colors text-white font-medium text-xs rounded-xl"
                  >
                    <Plus size={14} />
                    {t('admin.users.addUser')}
                  </button>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 font-medium bg-white/[0.01]">
                      <th className="p-4 pl-6">Name</th>
                      <th className="p-4">Email</th>
                      <th className="p-4">{t('admin.users.phone')}</th>
                      <th className="p-4">{t('admin.users.title')}</th>
                      <th className="p-4">{t('admin.users.assignedRole')}</th>
                      <th className="p-4">{t('admin.users.clearanceStatus')}</th>
                      <th className="p-4">{t('admin.users.assignedHotels')}</th>
                      <th className="p-4 pr-6 text-right">{t('admin.users.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usersLoading ? (
                      <tr>
                        <td colSpan={8} className="p-12 text-center text-slate-500">
                          <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-slate-600" />
                          Loading user directories...
                        </td>
                      </tr>
                    ) : users?.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-12 text-center text-slate-500">
                          {t('admin.users.empty')}
                        </td>
                      </tr>
                    ) : (
                      users?.map((u) => (
                        <tr key={u.id} className="border-b border-white/[0.03] hover:bg-white/[0.01] transition-colors text-slate-300">
                          <td className="p-4 pl-6 font-semibold">
                            {u.firstName || u.lastName ? `${u.firstName || ''} ${u.lastName || ''}`.trim() : 'N/A'}
                          </td>
                          <td className="p-4">{u.email}</td>
                          <td className="p-4 text-slate-400">{u.phone || '-'}</td>
                          <td className="p-4 text-slate-400">
                            {u.title ? (
                              <span className="font-medium text-slate-300">
                                {u.title} {u.department ? `(${u.department})` : ''}
                              </span>
                            ) : (
                              u.department || '-'
                            )}
                          </td>
                          <td className="p-4">
                            <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 font-semibold border border-blue-500/20 text-[10px]">
                              {u.roleName || 'No Role'}
                            </span>
                          </td>
                          <td className="p-4">
                            <span className={`px-2 py-0.5 rounded font-semibold text-[10px] uppercase border ${
                              u.status === 'active' 
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                                : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                            }`}>
                              {u.status}
                            </span>
                          </td>
                          <td className="p-4 max-w-xs truncate">
                            {u.hotelIds && u.hotelIds.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {u.hotelIds.map(hId => {
                                  const name = hotels?.find(h => h.id === hId)?.name || 'Unknown';
                                  return (
                                    <span key={hId} className="px-1.5 py-0.5 rounded bg-slate-800 text-[9px] text-slate-400 border border-slate-200">
                                      {name}
                                    </span>
                                  );
                                })}
                              </div>
                            ) : (
                              <span className="text-slate-500">No hotel clearances</span>
                            )}
                          </td>
                           <td className="p-4 pr-6 text-right flex items-center justify-end gap-1.5 font-mono text-[10px]">
                            {isSuperOrAdmin ? (
                              <>
                                <button
                                  onClick={() => handleOpenEditUser(u)}
                                  className="p-1 rounded hover:bg-slate-50 text-slate-400 hover:text-slate-200 transition-colors"
                                  title="Edit User"
                                >
                                  <Edit3 size={14} />
                                </button>
                                <button
                                  onClick={() => handleDeleteUser(u.id)}
                                  className="p-1 rounded hover:bg-slate-50 text-rose-400 hover:text-rose-300 transition-colors"
                                  title="Delete User"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </>
                            ) : (
                              <span className="text-slate-500">Read Only</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: HOTEL MANAGEMENT */}
        {isSuperOrAdmin && activeTab === 'hotels' && (
          <div className="space-y-6">
            {/* Hotel Form Panel */}
            {(isAddingHotel || editingHotel) && (
              <div className="glass-panel p-6 rounded-2xl border border-blue-500/20 bg-slate-50/40 relative card-glow">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                    <Building size={16} className="text-blue-400" />
                    {isAddingHotel ? 'Add Hotel' : 'Edit Hotel'}
                  </h3>
                  <button 
                    onClick={() => { setIsAddingHotel(false); setEditingHotel(null); }}
                    className="p-1 rounded-lg hover:bg-slate-50 text-slate-400 hover:text-slate-200"
                  >
                    <X size={14} />
                  </button>
                </div>

                <form onSubmit={handleSaveHotel} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Hotel Name</label>
                      <input
                        type="text"
                        required
                        value={hotelName}
                        onChange={(e) => setHotelName(e.target.value)}
                        placeholder="Demo Hotel"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs focus:outline-none focus:border-blue-500 text-slate-300 placeholder:text-slate-400"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Parent Organization</label>
                      <select
                        value={hotelOrgId}
                        onChange={(e) => setHotelOrgId(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs focus:outline-none focus:border-blue-500 text-slate-300"
                      >
                        {orgs?.map((o) => (
                          <option key={o.id} value={o.id} className="bg-[#090b16] text-slate-300">
                            {o.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Google Maps Link</label>
                    <input
                      type="url"
                      value={hotelGoogleMapsLink}
                      onChange={(e) => setHotelGoogleMapsLink(e.target.value)}
                      placeholder="https://www.google.com/maps/place/..."
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs focus:outline-none focus:border-blue-500 text-slate-300 placeholder:text-slate-400"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={() => { setIsAddingHotel(false); setEditingHotel(null); }}
                      className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-400 hover:text-slate-200 font-medium text-xs rounded-xl"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 transition-colors text-white font-medium text-xs rounded-xl"
                    >
                      <Save size={14} />
                      Save Hotel
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Hotels List Card */}
            <div className="glass-panel rounded-2xl relative overflow-hidden card-glow">
              <div className="h-16 flex items-center justify-between px-6 border-b border-slate-200">
                <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2 m-0">
                  <Building size={16} className="text-blue-400" />
                  Hotels List ({hotels?.length || 0})
                </h3>
                <button
                  onClick={handleOpenAddHotel}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 transition-colors text-white font-medium text-xs rounded-xl"
                >
                  <Plus size={14} />
                  Add Hotel
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 font-medium bg-white/[0.01]">
                      <th className="p-4 pl-6">Hotel Name</th>
                      <th className="p-4">Hotel ID</th>
                      <th className="p-4">Organization</th>
                      <th className="p-4">Connection status</th>
                      <th className="p-4 pr-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hotels?.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-12 text-center text-slate-500">
                          No hotels cataloged. Add one to begin.
                        </td>
                      </tr>
                    ) : (
                      hotels?.map((h) => (
                        <tr key={h.id} className="border-b border-white/[0.03] hover:bg-white/[0.01] transition-colors text-slate-300">
                          <td className="p-4 pl-6 font-semibold">{h.name}</td>
                          <td className="p-4 font-mono text-[10px] text-slate-500">{h.id}</td>
                          <td className="p-4">
                            {orgs?.find(o => o.id === h.organizationId)?.name || 'GuestReview.ai'}
                          </td>
                          <td className="p-4">
                            <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                              <CheckCircle size={12} />
                              Online
                            </span>
                          </td>
                          <td className="p-4 pr-6 text-right">
                            <button
                              onClick={() => handleOpenEditHotel(h)}
                              className="p-1 rounded hover:bg-slate-50 text-slate-400 hover:text-slate-200 transition-colors"
                              title="Edit Hotel"
                            >
                              <Edit3 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: ORGANIZATION */}
        {(isSuperOrAdmin || roleNameLower === 'hotel manager') && activeTab === 'org' && (
          <div className="space-y-6 max-w-4xl">
            {/* Organization Edit Card */}
            <div className="glass-panel p-6 rounded-2xl relative overflow-hidden card-glow space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2 m-0">
                  <Building2 size={16} className="text-blue-400" />
                  {t('admin.org.title')}
                </h3>
                {!isSuperOrAdmin && (
                  <span className="px-3 py-1 rounded-full bg-white border border-slate-200 text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
                    {t('admin.org.viewOnly')}
                  </span>
                )}
              </div>

              <form onSubmit={handleSaveOrg} className="space-y-6">
                {/* Logo Section */}
                <div className="p-4 rounded-xl bg-slate-500 border border-slate-200 flex flex-col md:flex-row items-center gap-4.5">
                  <div className="relative group w-20 h-20 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                    {orgLogoUrl ? (
                      <img src={orgLogoUrl} alt="Logo Preview" className="w-full h-full object-contain" />
                    ) : (
                      <Building2 size={28} className="text-slate-600" />
                    )}
                  </div>
                  <div className="space-y-1 text-center md:text-left flex-1">
                    <span className="text-xs font-semibold text-slate-200 block">{t('admin.org.logo')}</span>
                    <span className="text-[10px] text-slate-500 block">PNG, JPG formats supported. Keep size under 2MB.</span>
                    {isSuperOrAdmin && (
                      <div className="pt-2 flex items-center gap-3">
                        <label className="px-3.5 py-2 border border-slate-200 hover:bg-slate-50 text-slate-300 hover:text-slate-100 rounded-xl cursor-pointer text-xs font-semibold inline-flex items-center gap-1.5 transition-colors">
                          <Plus size={14} />
                          {isUploadingLogo ? t('admin.org.logoUploading') : t('admin.org.logo')}
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleLogoUpload}
                            className="hidden"
                            disabled={isUploadingLogo}
                          />
                        </label>
                      </div>
                    )}
                  </div>
                </div>

                {/* Grid Inputs */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Name */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{t('admin.org.name')}</label>
                    <input
                      type="text"
                      required
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      disabled={!isSuperOrAdmin}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs focus:outline-none focus:border-blue-500 text-slate-300 disabled:opacity-60"
                    />
                  </div>

                  {/* Tax Office */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{t('admin.org.taxOffice')}</label>
                    <input
                      type="text"
                      value={orgTaxOffice}
                      onChange={(e) => setOrgTaxOffice(e.target.value)}
                      disabled={!isSuperOrAdmin}
                      placeholder="Maslak V.D."
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs focus:outline-none focus:border-blue-500 text-slate-300 disabled:opacity-60"
                    />
                  </div>

                  {/* Tax Number */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{t('admin.org.taxNumber')}</label>
                    <input
                      type="text"
                      value={orgTaxNumber}
                      onChange={(e) => setOrgTaxNumber(e.target.value)}
                      disabled={!isSuperOrAdmin}
                      placeholder="1234567890"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs focus:outline-none focus:border-blue-500 text-slate-300 disabled:opacity-60"
                    />
                  </div>

                  {/* Phone */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{t('admin.org.phone')}</label>
                    <input
                      type="text"
                      value={orgPhone}
                      onChange={(e) => setOrgPhone(e.target.value)}
                      disabled={!isSuperOrAdmin}
                      placeholder="+90 212 123 45 67"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs focus:outline-none focus:border-blue-500 text-slate-300 disabled:opacity-60"
                    />
                  </div>

                  {/* Email */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{t('admin.org.email')}</label>
                    <input
                      type="email"
                      value={orgEmail}
                      onChange={(e) => setOrgEmail(e.target.value)}
                      disabled={!isSuperOrAdmin}
                      placeholder="info@company.com"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs focus:outline-none focus:border-blue-500 text-slate-300 disabled:opacity-60"
                    />
                  </div>

                  {/* Website */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{t('admin.org.website')}</label>
                    <input
                      type="text"
                      value={orgWebsite}
                      onChange={(e) => setOrgWebsite(e.target.value)}
                      disabled={!isSuperOrAdmin}
                      placeholder="https://company.com"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs focus:outline-none focus:border-blue-500 text-slate-300 disabled:opacity-60"
                    />
                  </div>

                  {/* Country */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{t('admin.org.country')}</label>
                    <input
                      type="text"
                      value={orgCountry}
                      onChange={(e) => setOrgCountry(e.target.value)}
                      disabled={!isSuperOrAdmin}
                      placeholder="Türkiye"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs focus:outline-none focus:border-blue-500 text-slate-300 disabled:opacity-60"
                    />
                  </div>

                  {/* City */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{t('admin.org.city')}</label>
                    <input
                      type="text"
                      value={orgCity}
                      onChange={(e) => setOrgCity(e.target.value)}
                      disabled={!isSuperOrAdmin}
                      placeholder="İstanbul"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs focus:outline-none focus:border-blue-500 text-slate-300 disabled:opacity-60"
                    />
                  </div>

                  {/* Currency */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{t('admin.org.currency')}</label>
                    <select
                      value={orgCurrency}
                      onChange={(e) => setOrgCurrency(e.target.value)}
                      disabled={!isSuperOrAdmin}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs focus:outline-none focus:border-blue-500 text-slate-300 disabled:opacity-60"
                    >
                      <option value="TRY">TRY (₺)</option>
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="GBP">GBP (£)</option>
                    </select>
                  </div>

                  {/* Default Language */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{t('admin.org.defaultLanguage')}</label>
                    <select
                      value={orgDefaultLanguage}
                      onChange={(e) => setOrgDefaultLanguage(e.target.value)}
                      disabled={!isSuperOrAdmin}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs focus:outline-none focus:border-blue-500 text-slate-300 disabled:opacity-60"
                    >
                      <option value="tr">Türkçe</option>
                      <option value="en">English</option>
                      <option value="ru">Русский</option>
                    </select>
                  </div>
                </div>

                {/* Address */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{t('admin.org.address')}</label>
                  <textarea
                    value={orgAddress}
                    onChange={(e) => setOrgAddress(e.target.value)}
                    disabled={!isSuperOrAdmin}
                    placeholder="Company headquarters address..."
                    rows={3}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs focus:outline-none focus:border-blue-500 text-slate-300 disabled:opacity-60 resize-none"
                  />
                </div>

                {/* Info block IDs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-2">
                  <div className="p-4 rounded-xl bg-white/30 border border-slate-200">
                    <span className="text-slate-500 block">Organization ID</span>
                    <span className="font-mono text-[10px] text-slate-400 block mt-1 truncate">{currentOrg.id}</span>
                  </div>
                  <div className="p-4 rounded-xl bg-white/30 border border-slate-200">
                    <span className="text-slate-500 block">Associated Hotels count</span>
                    <span className="font-semibold text-slate-400 block mt-1">{hotels?.length || 0} active hotels</span>
                  </div>
                </div>

                {isSuperOrAdmin && (
                  <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
                    <button
                      type="submit"
                      className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 transition-colors text-white font-medium text-xs rounded-xl"
                    >
                      <Save size={14} />
                      {t('admin.org.save')}
                    </button>
                  </div>
                )}
              </form>
            </div>

            {/* Organization Hotels Card */}
            <div className="glass-panel p-6 rounded-2xl relative overflow-hidden card-glow space-y-4">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                Hotels Managed under {currentOrg.name}
              </h4>
              <div className="divide-y divide-white/[0.04]">
                {hotels?.map(h => (
                  <div key={h.id} className="py-3 flex justify-between items-center text-xs text-slate-300">
                    <span className="font-semibold">{h.name}</span>
                    <span className="text-[10px] font-mono text-slate-500">{h.id}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: INTEGRATIONS & ROLES */}
        {isSuperOrAdmin && activeTab === 'integrations' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Integrations Card */}
            <div className="glass-panel p-6 rounded-2xl relative overflow-hidden card-glow space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2 m-0">
                  <Settings size={16} className="text-blue-400" />
                  Integration settings
                </h3>
                <p className="text-slate-500 text-[10px] mt-1">Connect or disable system automation integrations.</p>
              </div>

              <div className="space-y-4">
                {integrations?.map((item) => (
                  <div key={item.id} className="flex justify-between items-center p-3.5 rounded-xl bg-white border border-slate-200">
                    <div className="space-y-0.5">
                      <span className="text-xs font-semibold text-slate-200 block">{item.name}</span>
                      <span className="text-[10px] text-slate-500 flex items-center gap-1">
                        {item.id === 'google_business' && <Database size={10} />}
                        {item.id === 'whatsapp' && <Users size={10} />}
                        {item.id === 'n8n' && <Sliders size={10} />}
                        {item.id === 'supabase' && <CheckCircle size={10} />}
                        Sync status: <span className="text-slate-400 capitalize">{item.status}</span>
                      </span>
                    </div>

                    <button
                      onClick={() => handleToggleIntegration(item.id, item.status)}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                        item.status === 'connected'
                          ? 'bg-blue-600/10 border-blue-500/30 text-blue-400 hover:bg-blue-600/20'
                          : 'bg-slate-50 border-slate-200 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Power size={12} />
                      {item.status === 'connected' ? 'Disconnect' : 'Connect'}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Roles List Card */}
            <div className="glass-panel p-6 rounded-2xl relative overflow-hidden card-glow space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2 m-0">
                  <ShieldCheck size={16} className="text-purple-400" />
                  Security Roles Clearance Definitions
                </h3>
                <p className="text-slate-500 text-[10px] mt-1">System user roles and access capabilities.</p>
              </div>

              <div className="space-y-3.5 max-h-[350px] overflow-y-auto pr-1 scrollbar-thin">
                {roles?.map((r) => (
                  <div key={r.id} className="p-3.5 rounded-xl bg-slate-500 border border-slate-200 space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-semibold text-slate-200">{r.name}</span>
                      <span className="text-[9px] font-mono text-slate-500">{r.id.split('-')[0]}...</span>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-normal m-0">{r.description || 'No description provided.'}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: CUSTOMER ONBOARDING WIZARD */}
        {isSuperOrAdmin && activeTab === 'onboarding' && (
          <div className="space-y-6 max-w-4xl">
            {/* Wizard Header Progress Bar */}
            <div className="glass-panel p-6 rounded-2xl relative overflow-hidden card-glow space-y-4">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-blue-400 uppercase tracking-wider">Müşteri Kurulum Sihirbazı</span>
                <span className="text-slate-400 font-medium">Adım {wizardStep} / 6</span>
              </div>
              <div className="w-full bg-white rounded-full h-1.5 overflow-hidden border border-slate-200">
                <div 
                  className="bg-gradient-to-r from-blue-600 to-indigo-500 h-full transition-all duration-300"
                  style={{ width: `${(wizardStep / 6) * 100}%` }}
                />
              </div>
              <div className="grid grid-cols-6 gap-2 text-center text-[9px] font-semibold text-slate-500 uppercase tracking-wide">
                <span className={wizardStep >= 1 ? 'text-blue-400' : ''}>Şirket</span>
                <span className={wizardStep >= 2 ? 'text-blue-400' : ''}>Otel</span>
                <span className={wizardStep >= 3 ? 'text-blue-400' : ''}>Platformlar</span>
                <span className={wizardStep >= 4 ? 'text-blue-400' : ''}>Kullanıcılar</span>
                <span className={wizardStep >= 5 ? 'text-blue-400' : ''}>AI Ayarları</span>
                <span className={wizardStep >= 6 ? 'text-blue-400' : ''}>Özet</span>
              </div>
            </div>

            {/* Wizard Body Cards */}
            <div className="glass-panel p-6 rounded-2xl relative overflow-hidden card-glow space-y-6">
              {/* STEP 1: Şirket Bilgileri */}
              {wizardStep === 1 && (
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                    <Building2 size={16} className="text-blue-400" />
                    Şirket Bilgileri (Company Details)
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Şirket Adı *</label>
                      <input 
                        type="text"
                        required
                        value={onboardOrgName}
                        onChange={(e) => setOnboardOrgName(e.target.value)}
                        placeholder="Örn. GuestReview.ai Group"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs focus:outline-none focus:border-blue-500 text-slate-300"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Yetkili Kişi</label>
                      <input 
                        type="text"
                        value={onboardOrgContact}
                        onChange={(e) => setOnboardOrgContact(e.target.value)}
                        placeholder="Ad Soyad"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs focus:outline-none focus:border-blue-500 text-slate-300"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Telefon</label>
                      <input 
                        type="text"
                        value={onboardOrgPhone}
                        onChange={(e) => setOnboardOrgPhone(e.target.value)}
                        placeholder="+90 212 ..."
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs focus:outline-none focus:border-blue-500 text-slate-300"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Şirket E-postası *</label>
                      <input 
                        type="email"
                        required
                        value={onboardOrgEmail}
                        onChange={(e) => setOnboardOrgEmail(e.target.value)}
                        placeholder="info@guestreview.ai"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs focus:outline-none focus:border-blue-500 text-slate-300"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Vergi Dairesi</label>
                      <input 
                        type="text"
                        value={onboardOrgTaxOffice}
                        onChange={(e) => setOnboardOrgTaxOffice(e.target.value)}
                        placeholder="Maslak V.D."
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs focus:outline-none focus:border-blue-500 text-slate-300"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Vergi Numarası</label>
                      <input 
                        type="text"
                        value={onboardOrgTaxNumber}
                        onChange={(e) => setOnboardOrgTaxNumber(e.target.value)}
                        placeholder="1234567890"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs focus:outline-none focus:border-blue-500 text-slate-300"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Şirket Adresi</label>
                    <textarea 
                      value={onboardOrgAddress}
                      onChange={(e) => setOnboardOrgAddress(e.target.value)}
                      placeholder="Şirket merkez adresi..."
                      rows={2}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs focus:outline-none focus:border-blue-500 text-slate-300 resize-none"
                    />
                  </div>
                  {/* Logo Upload Section */}
                  <div className="p-4 rounded-xl bg-slate-500 border border-slate-200 flex items-center gap-4">
                    <div className="w-16 h-16 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                      {onboardOrgLogoUrl ? (
                        <img src={onboardOrgLogoUrl} alt="Onboard logo" className="w-full h-full object-contain" />
                      ) : (
                        <Building2 size={24} className="text-slate-600" />
                      )}
                    </div>
                    <div className="space-y-1 flex-1">
                      <span className="text-xs font-semibold text-slate-200 block">{t('admin.org.logo')}</span>
                      <label className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-300 hover:text-slate-100 rounded-xl cursor-pointer text-xs font-semibold inline-flex items-center gap-1.5 transition-colors">
                        <Plus size={12} />
                        {isOnboardLogoUploading ? t('admin.org.logoUploading') : t('admin.org.logo')}
                        <input 
                          type="file"
                          accept="image/*"
                          onChange={handleOnboardLogoUpload}
                          className="hidden"
                          disabled={isOnboardLogoUploading}
                        />
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2: Otel Bilgileri */}
              {wizardStep === 2 && (
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                    <Building size={16} className="text-blue-400" />
                    Otel Bilgileri (Hotel Information)
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Otel Adı *</label>
                      <input 
                        type="text"
                        required
                        value={onboardHotelName}
                        onChange={(e) => setOnboardHotelName(e.target.value)}
                        placeholder="Örn. Montana Beach Resort"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs focus:outline-none focus:border-blue-500 text-slate-300"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Google Maps Linki</label>
                      <input 
                        type="text"
                        value={onboardHotelMaps}
                        onChange={(e) => setOnboardHotelMaps(e.target.value)}
                        placeholder="https://maps.google.com/..."
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs focus:outline-none focus:border-blue-500 text-slate-300"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Telefon</label>
                      <input 
                        type="text"
                        value={onboardHotelPhone}
                        onChange={(e) => setOnboardHotelPhone(e.target.value)}
                        placeholder="+90 242 ..."
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs focus:outline-none focus:border-blue-500 text-slate-300"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Web Sitesi</label>
                      <input 
                        type="text"
                        value={onboardHotelPhone}
                        onChange={(e) => setOnboardHotelWebsite(e.target.value)}
                        placeholder="https://hotelname.com"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs focus:outline-none focus:border-blue-500 text-slate-300"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Şehir *</label>
                      <input 
                        type="text"
                        required
                        value={onboardHotelCity}
                        onChange={(e) => setOnboardHotelCity(e.target.value)}
                        placeholder="Antalya"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs focus:outline-none focus:border-blue-500 text-slate-300"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Ülke *</label>
                      <input 
                        type="text"
                        required
                        value={onboardHotelCountry}
                        onChange={(e) => setOnboardHotelCountry(e.target.value)}
                        placeholder="Türkiye"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs focus:outline-none focus:border-blue-500 text-slate-300"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Saat Dilimi</label>
                      <input 
                        type="text"
                        value={onboardHotelTimezone}
                        onChange={(e) => setOnboardHotelTimezone(e.target.value)}
                        placeholder="Europe/Istanbul"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs focus:outline-none focus:border-blue-500 text-slate-300"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Varsayılan Dil</label>
                      <select 
                        value={onboardHotelLang}
                        onChange={(e) => setOnboardHotelLang(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs focus:outline-none focus:border-blue-500 text-slate-300"
                      >
                        <option value="tr">Türkçe</option>
                        <option value="en">English</option>
                        <option value="ru">Русский</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Adres</label>
                    <textarea 
                      value={onboardHotelAddress}
                      onChange={(e) => setOnboardHotelAddress(e.target.value)}
                      placeholder="Montana Beach Resort, Kemer / Antalya"
                      rows={2}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs focus:outline-none focus:border-blue-500 text-slate-300 resize-none"
                    />
                  </div>
                </div>
              )}

              {/* STEP 3: Platform Bağlantıları */}
              {wizardStep === 3 && (
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                    <Sliders size={16} className="text-blue-400" />
                    Platform Bağlantıları (Platform Connections)
                  </h4>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-3 rounded-xl bg-white border border-slate-200">
                      <div className="space-y-0.5">
                        <span className="text-xs font-semibold text-slate-200 block">Google Business Profile</span>
                        <span className="text-[10px] text-slate-500">Google Haritalar yorum senkronizasyonu.</span>
                      </div>
                      <button 
                        type="button"
                        onClick={() => setOnboardGoogleConnected(!onboardGoogleConnected)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                          onboardGoogleConnected 
                            ? 'bg-blue-600/10 border-blue-500/30 text-blue-400'
                            : 'bg-slate-50 border-slate-200 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {onboardGoogleConnected ? 'Bağlı (Connected)' : 'Bağla (Connect)'}
                      </button>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">TripAdvisor Otel Linki</label>
                      <input 
                        type="text"
                        value={onboardTripadvisorLink}
                        onChange={(e) => setOnboardTripadvisorLink(e.target.value)}
                        placeholder="https://www.tripadvisor.com.tr/Hotel_Review-..."
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs focus:outline-none focus:border-blue-500 text-slate-300"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">WhatsApp Business Numarası</label>
                      <input 
                        type="text"
                        value={onboardWhatsappNumber}
                        onChange={(e) => setOnboardWhatsappNumber(e.target.value)}
                        placeholder="+905551234567"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs focus:outline-none focus:border-blue-500 text-slate-300"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">E-posta Entegrasyonu</label>
                      <input 
                        type="email"
                        value={onboardEmailIntegration}
                        onChange={(e) => setOnboardEmailIntegration(e.target.value)}
                        placeholder="feedback@guestreview.ai"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs focus:outline-none focus:border-blue-500 text-slate-300"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 4: Kullanıcılar */}
              {wizardStep === 4 && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="text-sm font-semibold text-slate-200 flex items-center gap-2 m-0">
                      <Users size={16} className="text-blue-400" />
                      Kurumsal Kullanıcılar (Users Directory)
                    </h4>
                    <button 
                      type="button"
                      onClick={() => setOnboardUsers([...onboardUsers, { firstName: '', lastName: '', email: '', password: '', phone: '', title: '', role: 'Staff' }])}
                      className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 transition-colors text-white text-xs font-semibold rounded-xl"
                    >
                      <Plus size={12} />
                      Kullanıcı Ekle
                    </button>
                  </div>

                  <div className="space-y-4">
                    {onboardUsers.map((u, i) => (
                      <div key={i} className="p-4 rounded-xl bg-slate-500 border border-slate-200 space-y-3 relative">
                        {onboardUsers.length > 1 && (
                          <button 
                            type="button"
                            onClick={() => setOnboardUsers(onboardUsers.filter((_, idx) => idx !== i))}
                            className="absolute top-4 right-4 p-1 rounded hover:bg-rose-500/10 text-rose-400 hover:text-rose-300"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Kullanıcı #{i + 1}</span>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div className="space-y-1">
                            <label className="text-[9px] font-semibold text-slate-400 uppercase">Ad *</label>
                            <input 
                              type="text"
                              required
                              value={u.firstName}
                              onChange={(e) => {
                                const newUsers = [...onboardUsers];
                                newUsers[i].firstName = e.target.value;
                                setOnboardUsers(newUsers);
                              }}
                              placeholder="Ad"
                              className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs focus:outline-none focus:border-blue-500 text-slate-300"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-semibold text-slate-400 uppercase">Soyad *</label>
                            <input 
                              type="text"
                              required
                              value={u.lastName}
                              onChange={(e) => {
                                const newUsers = [...onboardUsers];
                                newUsers[i].lastName = e.target.value;
                                setOnboardUsers(newUsers);
                              }}
                              placeholder="Soyad"
                              className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs focus:outline-none focus:border-blue-500 text-slate-300"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-semibold text-slate-400 uppercase">E-posta *</label>
                            <input 
                              type="email"
                              required
                              value={u.email}
                              onChange={(e) => {
                                const newUsers = [...onboardUsers];
                                newUsers[i].email = e.target.value;
                                setOnboardUsers(newUsers);
                              }}
                              placeholder="email@hotel.com"
                              className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs focus:outline-none focus:border-blue-500 text-slate-300"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-semibold text-slate-400 uppercase">Şifre * (min. 8 krkt)</label>
                            <input 
                              type="password"
                              required
                              value={u.password}
                              onChange={(e) => {
                                const newUsers = [...onboardUsers];
                                newUsers[i].password = e.target.value;
                                setOnboardUsers(newUsers);
                              }}
                              placeholder="Şifre"
                              className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs focus:outline-none focus:border-blue-500 text-slate-300"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-semibold text-slate-400 uppercase">Rol *</label>
                            <select 
                              value={u.role}
                              onChange={(e) => {
                                const newUsers = [...onboardUsers];
                                newUsers[i].role = e.target.value;
                                setOnboardUsers(newUsers);
                              }}
                              className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs focus:outline-none focus:border-blue-500 text-slate-300"
                            >
                              <option value="Super Admin">Super Admin</option>
                              <option value="Admin">Admin</option>
                              <option value="Hotel Manager">Hotel Manager</option>
                              <option value="Staff">Staff</option>
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-semibold text-slate-400 uppercase">Telefon</label>
                            <input 
                              type="text"
                              value={u.phone}
                              onChange={(e) => {
                                const newUsers = [...onboardUsers];
                                newUsers[i].phone = e.target.value;
                                setOnboardUsers(newUsers);
                              }}
                              placeholder="+90555..."
                              className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs focus:outline-none focus:border-blue-500 text-slate-300"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* STEP 5: AI Ayarları */}
              {wizardStep === 5 && (
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                    <Sparkles size={16} className="text-blue-400" />
                    AI Otomasyon Ayarları (AI Automation Settings)
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Otel Cevap Dili</label>
                      <select 
                        value={onboardAILang}
                        onChange={(e) => setOnboardAILang(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs focus:outline-none focus:border-blue-500 text-slate-300"
                      >
                        <option value="tr">Türkçe</option>
                        <option value="en">English</option>
                        <option value="ru">Русский</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">AI Yanıt Tonu</label>
                      <select 
                        value={onboardAITone}
                        onChange={(e) => setOnboardAITone(e.target.value as any)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs focus:outline-none focus:border-blue-500 text-slate-300"
                      >
                        <option value="official">Resmi (Official / Formal)</option>
                        <option value="warm">Samimi (Warm / Friendly)</option>
                        <option value="premium">Lüks (Premium / Executive)</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-4 pt-2">
                    <div className="flex justify-between items-center p-3 rounded-xl bg-white border border-slate-200">
                      <div className="space-y-0.5">
                        <span className="text-xs font-semibold text-slate-200 block">Otomatik Taslak Cevap</span>
                        <span className="text-[10px] text-slate-500">Yapay zeka gelen yorumlar için otomatik taslak cevap üretsin.</span>
                      </div>
                      <input 
                        type="checkbox"
                        checked={onboardAIAutoDraft}
                        onChange={(e) => setOnboardAIAutoDraft(e.target.checked)}
                        className="w-4 h-4 text-blue-600 bg-white border-slate-200 rounded focus:ring-blue-500 focus:ring-2 focus:ring-offset-slate-900"
                      />
                    </div>

                    <div className="flex justify-between items-center p-3 rounded-xl bg-white border border-slate-200">
                      <div className="space-y-0.5">
                        <span className="text-xs font-semibold text-slate-200 block">Düşük Puan Uyarısı</span>
                        <span className="text-[10px] text-slate-500">Düşük puanlı yorumlarda sisteme anlık uyarı düşsün.</span>
                      </div>
                      <input 
                        type="checkbox"
                        checked={onboardAILowRatingAlert}
                        onChange={(e) => setOnboardAILowRatingAlert(e.target.checked)}
                        className="w-4 h-4 text-blue-600 bg-white border-slate-200 rounded focus:ring-blue-500 focus:ring-2 focus:ring-offset-slate-900"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 6: Kurulum Özeti */}
              {wizardStep === 6 && (
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                    <CheckCircle size={16} className="text-blue-400" />
                    Kurulum Özeti & Onay (Setup Verification)
                  </h4>
                  <div className="divide-y divide-white/[0.04] text-xs space-y-3.5">
                    <div className="pt-2">
                      <span className="font-bold text-slate-400 uppercase tracking-wide block text-[10px] mb-1.5">Şirket Profil Bilgileri</span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-300">
                        <div><span className="text-slate-500">Şirket Adı:</span> {onboardOrgName}</div>
                        <div><span className="text-slate-500">E-posta:</span> {onboardOrgEmail}</div>
                        <div><span className="text-slate-500">Telefon:</span> {onboardOrgPhone || 'N/A'}</div>
                        <div><span className="text-slate-500">Vergi Dairesi/No:</span> {onboardOrgTaxOffice || 'N/A'} / {onboardOrgTaxNumber || 'N/A'}</div>
                      </div>
                    </div>

                    <div className="pt-3">
                      <span className="font-bold text-slate-400 uppercase tracking-wide block text-[10px] mb-1.5">Otel Profil Bilgileri</span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-300">
                        <div><span className="text-slate-500">Otel Adı:</span> {onboardHotelName}</div>
                        <div><span className="text-slate-500">Şehir / Ülke:</span> {onboardHotelCity} / {onboardHotelCountry}</div>
                        <div><span className="text-slate-500">Saat Dilimi:</span> {onboardHotelTimezone}</div>
                        <div><span className="text-slate-500">Varsayılan Dil:</span> {onboardHotelLang}</div>
                      </div>
                    </div>

                    <div className="pt-3">
                      <span className="font-bold text-slate-400 uppercase tracking-wide block text-[10px] mb-1.5">Oluşturulacak Kullanıcılar ({onboardUsers.length})</span>
                      <div className="space-y-1">
                        {onboardUsers.map((u, idx) => (
                          <div key={idx} className="text-slate-300 font-mono text-[11px] bg-slate-500 p-2 rounded-xl border border-white/[0.02]">
                            #{idx + 1}: {u.firstName} {u.lastName} ({u.email}) - <span className="text-blue-400 font-semibold">{u.role}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="pt-3">
                      <span className="font-bold text-slate-400 uppercase tracking-wide block text-[10px] mb-1.5">AI Otomasyonu</span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-300">
                        <div><span className="text-slate-500">Yanıt Dili:</span> {onboardAILang}</div>
                        <div><span className="text-slate-500">Cevap Tonu:</span> <span className="capitalize">{onboardAITone}</span></div>
                        <div><span className="text-slate-500">Otomatik Taslak:</span> {onboardAIAutoDraft ? 'Açık' : 'Kapalı'}</div>
                        <div><span className="text-slate-500">Düşük Puan Uyarısı:</span> {onboardAILowRatingAlert ? 'Açık' : 'Kapalı'}</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Step Navigation Controls */}
              <div className="flex justify-between items-center pt-4 border-t border-slate-200">
                <button
                  type="button"
                  disabled={wizardStep === 1 || isOnboardingSaving}
                  onClick={() => setWizardStep(wizardStep - 1)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-400 hover:text-slate-200 font-semibold text-xs rounded-xl disabled:opacity-50 transition-colors"
                >
                  Geri
                </button>
                {wizardStep < 6 ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (validateOnboardStep()) {
                        setWizardStep(wizardStep + 1);
                      }
                    }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-xl transition-colors"
                  >
                    İleri
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={isOnboardingSaving}
                    onClick={handleTriggerOnboarding}
                    className="flex items-center gap-1.5 px-5 py-2 bg-gradient-to-tr from-blue-600 to-indigo-500 hover:from-blue-500 hover:to-indigo-400 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-500/25 transition-all disabled:opacity-50"
                  >
                    {isOnboardingSaving ? 'Kurulum Yapılıyor...' : 'Kurulumu Tamamla'}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {isSuperOrAdmin && activeTab === 'google-locations' && (
          <div className="space-y-6">
            <div className="glass-panel p-6 rounded-2xl relative overflow-hidden card-glow space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-200">
                <div>
                  <h3 className="text-sm font-semibold text-slate-200 m-0">Google My Business Lokasyonları</h3>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Google Business API'ye bağlı hesaplarınızdaki lokasyonları listeleyip, reviewAI paneline otellerinizi bağlayın.
                  </p>
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <select
                    value={selectedHotelForGoogle}
                    onChange={(e) => setSelectedHotelForGoogle(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs focus:outline-none text-slate-300 min-h-[36px] w-full sm:w-56"
                  >
                    <option value="">-- Bağlanacak Otel Seçin --</option>
                    {hotels?.map((h: Hotel) => (
                      <option key={h.id} value={h.id}>
                        {h.name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={fetchGoogleLocations}
                    disabled={loadingLocations}
                    className="flex items-center justify-center p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-400 hover:text-slate-200 transition-colors min-w-[36px] min-h-[36px]"
                    title="Yenile"
                  >
                    <RefreshCw size={14} className={loadingLocations ? 'animate-spin' : ''} />
                  </button>
                </div>
              </div>

              {loadingLocations ? (
                <div className="p-12 text-center text-xs text-slate-500">
                  Google Business verileri çekiliyor, lütfen bekleyin...
                </div>
              ) : locationsError ? (
                <div className="p-6 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
                  {locationsError}
                </div>
              ) : googleLocations.length === 0 ? (
                <div className="p-12 text-center text-xs text-slate-500">
                  Google lokasyonu bulunamadı. Lütfen Google Business hesabınızda lokasyon tanımlı olduğundan emin olun.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs min-w-[700px]">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-400 font-semibold">
                        <th className="p-3">İşletme Adı</th>
                        <th className="p-3">Lokasyon ID</th>
                        <th className="p-3">Hesap ID</th>
                        <th className="p-3">Adres</th>
                        <th className="p-3 text-right">İşlem</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.02]">
                      {googleLocations.map((loc) => {
                        const connectedHotels = hotels?.filter((h: Hotel) => h.googleLocationId === loc.locationId) || [];
                        const isConnected = connectedHotels.length > 0;
                        const isConnecting = connectingLocationId === loc.locationId;

                        return (
                          <tr key={loc.locationId} className="hover:bg-white/[0.01] transition-colors">
                            <td className="p-3 font-semibold text-slate-200">{loc.businessName}</td>
                            <td className="p-3 font-mono text-slate-400 text-[10px]">{loc.locationId}</td>
                            <td className="p-3 font-mono text-slate-500 text-[10px]">{loc.accountId}</td>
                            <td className="p-3 text-slate-400 text-[11px] max-w-xs truncate" title={loc.address}>{loc.address}</td>
                            <td className="p-3 text-right">
                              {isConnected ? (
                                <div className="inline-flex flex-col items-end gap-1">
                                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold text-[9px] uppercase tracking-wider">
                                    Bağlı
                                  </span>
                                  <span className="text-[9px] text-slate-500 font-medium">
                                    ({connectedHotels.map((h: Hotel) => h.name).join(', ')})
                                  </span>
                                </div>
                              ) : (
                                <button
                                  onClick={() => handleConnectLocation(loc)}
                                  disabled={isConnecting || !selectedHotelForGoogle}
                                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white disabled:text-slate-500 font-semibold text-xs rounded-xl shadow-md hover:shadow-blue-500/15 disabled:shadow-none transition-all"
                                >
                                  {isConnecting ? 'Bağlanıyor...' : 'Otele Bağla'}
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Floating Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 px-4 py-3 rounded-xl bg-[#0c0f22] border border-blue-500/20 text-blue-400 text-xs font-semibold shadow-2xl z-50 animate-bounce">
          {toast}
        </div>
      )}
    </div>
  );
}
