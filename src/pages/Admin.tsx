import React, { useState } from 'react';
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
  Sparkles
} from 'lucide-react';

export default function Admin() {
  const [activeTab, setActiveTab] = useState<'users' | 'hotels' | 'org' | 'integrations'>('users');
  const [toast, setToast] = useState<string | null>(null);

  // Load Data
  const { data: users, loading: usersLoading, refetch: refetchUsers } = useFetch(() => adminService.getAllUsers());
  const { data: roles } = useFetch(() => adminService.getRoles());
  const { data: hotels, refetch: refetchHotels } = useFetch(() => hotelService.getHotels());
  const { data: orgs, refetch: refetchOrgs } = useFetch(() => hotelService.getOrganizations());
  const { data: integrations, refetch: refetchIntegrations } = useFetch(() => adminService.getSettings());

  console.log('[Admin Page] Loaded roles data:', roles);

  // Current Organization
  const currentOrg = orgs?.[0] || { id: '7cc77cc7-7cc7-7cc7-7cc7-7cc77cc77cc7', name: 'ECCTUR', createdAt: '' };

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

  // Form States - Hotel
  const [isAddingHotel, setIsAddingHotel] = useState(false);
  const [editingHotel, setEditingHotel] = useState<Hotel | null>(null);
  const [hotelName, setHotelName] = useState('');
  const [hotelOrgId, setHotelOrgId] = useState(currentOrg.id);

  // Form States - Organization
  const [isEditingOrg, setIsEditingOrg] = useState(false);
  const [orgName, setOrgName] = useState(currentOrg.name);

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
        password: isAddingUser ? userPassword : undefined
      };

      if (isAddingUser) {
        await adminService.addUser(payload);
        triggerToast('User created successfully');
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
  };

  const handleOpenEditHotel = (h: Hotel) => {
    setEditingHotel(h);
    setIsAddingHotel(false);
    setHotelName(h.name);
    setHotelOrgId(h.organizationId);
  };

  const handleSaveHotel = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isAddingHotel) {
        await adminService.addHotel({ name: hotelName, organizationId: hotelOrgId });
        triggerToast('Hotel added successfully');
      } else if (editingHotel) {
        await adminService.editHotel(editingHotel.id, { name: hotelName, organizationId: hotelOrgId });
        triggerToast('Hotel updated successfully');
      }

      setIsAddingHotel(false);
      setEditingHotel(null);
      refetchHotels();
    } catch (err: any) {
      console.error(err);
      triggerToast(`Error: ${err.message || 'Operation failed'}`);
    }
  };

  // Org Actions
  const handleSaveOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await adminService.editOrganizationName(currentOrg.id, orgName);
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
      <div className="border-b border-white/[0.04] pb-6 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-slate-100 m-0">Admin Settings</h1>
          <p className="text-xs text-slate-400 mt-1.5">
            Manage users, hotels, organization profiles, and connected external pipelines.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/[0.06] gap-2">
        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold uppercase tracking-wider border-b-2 transition-all ${
            activeTab === 'users' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users size={14} />
          User Management
        </button>
        <button
          onClick={() => setActiveTab('hotels')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold uppercase tracking-wider border-b-2 transition-all ${
            activeTab === 'hotels' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Building size={14} />
          Hotel Management
        </button>
        <button
          onClick={() => setActiveTab('org')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold uppercase tracking-wider border-b-2 transition-all ${
            activeTab === 'org' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Building2 size={14} />
          Organization
        </button>
        <button
          onClick={() => setActiveTab('integrations')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold uppercase tracking-wider border-b-2 transition-all ${
            activeTab === 'integrations' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sliders size={14} />
          Integrations & Roles
        </button>
      </div>

      {/* Tab Contents */}
      <div className="space-y-6">
        {/* TAB 1: USER MANAGEMENT */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            {/* User Form Panel (Add / Edit) */}
            {(isAddingUser || editingUser) && (
              <div className="glass-panel p-6 rounded-2xl border border-blue-500/20 bg-slate-950/40 relative card-glow">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                    <UserCheck size={16} className="text-blue-400" />
                    {isAddingUser ? 'Add User Profile' : 'Edit User Profile'}
                  </h3>
                  <button 
                    onClick={() => { setIsAddingUser(false); setEditingUser(null); }}
                    className="p-1 rounded-lg hover:bg-white/[0.04] text-slate-400 hover:text-slate-200"
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
                        placeholder="email@ecctur.ai"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-white/[0.06] text-xs focus:outline-none focus:border-blue-500 text-slate-300 placeholder:text-slate-600"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">First Name</label>
                      <input
                        type="text"
                        value={userFirstName}
                        onChange={(e) => setUserFirstName(e.target.value)}
                        placeholder="John"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-white/[0.06] text-xs focus:outline-none focus:border-blue-500 text-slate-300 placeholder:text-slate-600"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Last Name</label>
                      <input
                        type="text"
                        value={userLastName}
                        onChange={(e) => setUserLastName(e.target.value)}
                        placeholder="Doe"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-white/[0.06] text-xs focus:outline-none focus:border-blue-500 text-slate-300 placeholder:text-slate-600"
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
                          className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-white/[0.06] text-xs focus:outline-none focus:border-blue-500 text-slate-300 placeholder:text-slate-600"
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
                          className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-white/[0.06] text-xs focus:outline-none focus:border-blue-500 text-slate-300 placeholder:text-slate-600"
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
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-white/[0.06] text-xs focus:outline-none focus:border-blue-500 text-slate-300"
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
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-white/[0.06] text-xs focus:outline-none focus:border-blue-500 text-slate-300"
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
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-white/[0.06] text-xs focus:outline-none focus:border-blue-500 text-slate-300"
                      >
                        {orgs?.map((o) => (
                          <option key={o.id} value={o.id} className="bg-[#090b16] text-slate-300">
                            {o.name}
                          </option>
                        ))}
                      </select>
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
                                : 'bg-slate-900 border-white/[0.06] text-slate-400 hover:text-slate-200'
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

                  <div className="flex justify-end gap-2 pt-2 border-t border-white/[0.04]">
                    <button
                      type="button"
                      onClick={() => { setIsAddingUser(false); setEditingUser(null); }}
                      className="px-4 py-2 border border-white/[0.06] hover:bg-white/[0.04] text-slate-400 hover:text-slate-200 font-medium text-xs rounded-xl"
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
              <div className="h-16 flex items-center justify-between px-6 border-b border-white/[0.04]">
                <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2 m-0">
                  <Users size={16} className="text-blue-400" />
                  Corporate User Profiles ({users?.length || 0})
                </h3>
                <button
                  onClick={handleOpenAddUser}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 transition-colors text-white font-medium text-xs rounded-xl"
                >
                  <Plus size={14} />
                  Add User
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-white/[0.04] text-slate-400 font-medium bg-white/[0.01]">
                      <th className="p-4 pl-6">Name</th>
                      <th className="p-4">Email</th>
                      <th className="p-4">Assigned Role</th>
                      <th className="p-4">Clearance status</th>
                      <th className="p-4">Assigned Hotels</th>
                      <th className="p-4 pr-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usersLoading ? (
                      <tr>
                        <td colSpan={6} className="p-12 text-center text-slate-500">
                          <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-slate-600" />
                          Loading user directories...
                        </td>
                      </tr>
                    ) : users?.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-12 text-center text-slate-500">
                          No corporate user accounts found. Add one to begin.
                        </td>
                      </tr>
                    ) : (
                      users?.map((u) => (
                        <tr key={u.id} className="border-b border-white/[0.03] hover:bg-white/[0.01] transition-colors text-slate-300">
                          <td className="p-4 pl-6 font-semibold">
                            {u.firstName || u.lastName ? `${u.firstName || ''} ${u.lastName || ''}`.trim() : 'N/A'}
                          </td>
                          <td className="p-4">{u.email}</td>
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
                                    <span key={hId} className="px-1.5 py-0.5 rounded bg-slate-800 text-[9px] text-slate-400 border border-white/[0.04]">
                                      {name}
                                    </span>
                                  );
                                })}
                              </div>
                            ) : (
                              <span className="text-slate-500">No hotel clearances</span>
                            )}
                          </td>
                          <td className="p-4 pr-6 text-right flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenEditUser(u)}
                              className="p-1 rounded hover:bg-white/[0.04] text-slate-400 hover:text-slate-200 transition-colors"
                              title="Edit User"
                            >
                              <Edit3 size={14} />
                            </button>
                            <button
                              onClick={() => handleDeleteUser(u.id)}
                              className="p-1 rounded hover:bg-white/[0.04] text-rose-400 hover:text-rose-300 transition-colors"
                              title="Delete User"
                            >
                              <Trash2 size={14} />
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

        {/* TAB 2: HOTEL MANAGEMENT */}
        {activeTab === 'hotels' && (
          <div className="space-y-6">
            {/* Hotel Form Panel */}
            {(isAddingHotel || editingHotel) && (
              <div className="glass-panel p-6 rounded-2xl border border-blue-500/20 bg-slate-950/40 relative card-glow">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                    <Building size={16} className="text-blue-400" />
                    {isAddingHotel ? 'Add Hotel' : 'Edit Hotel'}
                  </h3>
                  <button 
                    onClick={() => { setIsAddingHotel(false); setEditingHotel(null); }}
                    className="p-1 rounded-lg hover:bg-white/[0.04] text-slate-400 hover:text-slate-200"
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
                        placeholder="ECCTUR Deluxe Resort"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-white/[0.06] text-xs focus:outline-none focus:border-blue-500 text-slate-300 placeholder:text-slate-600"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Parent Organization</label>
                      <select
                        value={hotelOrgId}
                        onChange={(e) => setHotelOrgId(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-white/[0.06] text-xs focus:outline-none focus:border-blue-500 text-slate-300"
                      >
                        {orgs?.map((o) => (
                          <option key={o.id} value={o.id} className="bg-[#090b16] text-slate-300">
                            {o.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-white/[0.04]">
                    <button
                      type="button"
                      onClick={() => { setIsAddingHotel(false); setEditingHotel(null); }}
                      className="px-4 py-2 border border-white/[0.06] hover:bg-white/[0.04] text-slate-400 hover:text-slate-200 font-medium text-xs rounded-xl"
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
              <div className="h-16 flex items-center justify-between px-6 border-b border-white/[0.04]">
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
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-white/[0.04] text-slate-400 font-medium bg-white/[0.01]">
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
                            {orgs?.find(o => o.id === h.organizationId)?.name || 'ECCTUR'}
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
                              className="p-1 rounded hover:bg-white/[0.04] text-slate-400 hover:text-slate-200 transition-colors"
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
        {activeTab === 'org' && (
          <div className="space-y-6 max-w-2xl">
            {/* Organization Edit Card */}
            <div className="glass-panel p-6 rounded-2xl relative overflow-hidden card-glow space-y-6">
              <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <Building2 size={16} className="text-blue-400" />
                Corporate Organization Profile
              </h3>

              <form onSubmit={handleSaveOrg} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Organization Name</label>
                  {isEditingOrg ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        required
                        value={orgName}
                        onChange={(e) => setOrgName(e.target.value)}
                        className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-900 border border-white/[0.06] text-xs focus:outline-none focus:border-blue-500 text-slate-300"
                      />
                      <button
                        type="button"
                        onClick={() => { setIsEditingOrg(false); setOrgName(currentOrg.name); }}
                        className="px-3 border border-white/[0.06] hover:bg-white/[0.04] text-slate-400 hover:text-slate-200 rounded-xl"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex justify-between items-center p-3 rounded-xl bg-slate-900 border border-white/[0.06]">
                      <span className="text-sm font-semibold text-slate-200">{currentOrg.name}</span>
                      <button
                        type="button"
                        onClick={() => setIsEditingOrg(true)}
                        className="p-1.5 rounded-lg hover:bg-white/[0.04] text-blue-400 hover:text-blue-300"
                      >
                        <Edit3 size={14} />
                      </button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div className="p-4 rounded-xl bg-slate-900/50 border border-white/[0.04]">
                    <span className="text-slate-500 block">Organization ID</span>
                    <span className="font-mono text-[10px] text-slate-300 block mt-1 truncate">{currentOrg.id}</span>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-900/50 border border-white/[0.04]">
                    <span className="text-slate-500 block">Associated Hotels count</span>
                    <span className="font-semibold text-slate-300 block mt-1">{hotels?.length || 0} active hotels</span>
                  </div>
                </div>

                {isEditingOrg && (
                  <div className="flex justify-end gap-2 pt-2 border-t border-white/[0.04]">
                    <button
                      type="submit"
                      className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 transition-colors text-white font-medium text-xs rounded-xl"
                    >
                      <Save size={14} />
                      Save Changes
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
        {activeTab === 'integrations' && (
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
                  <div key={item.id} className="flex justify-between items-center p-3.5 rounded-xl bg-slate-900 border border-white/[0.06]">
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
                          : 'bg-slate-950 border-white/[0.06] text-slate-400 hover:text-slate-200'
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
                  <div key={r.id} className="p-3.5 rounded-xl bg-slate-900/50 border border-white/[0.04] space-y-1">
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
