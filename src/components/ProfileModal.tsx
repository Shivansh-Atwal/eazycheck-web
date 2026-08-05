import React, { useState, useEffect } from 'react';
import { X, User, KeyRound, Building, Users, Lock, ChevronDown, ChevronUp, Edit2, Check, Loader2, Mail, Phone, MapPin, Save } from 'lucide-react';
import api from '../utils/api';

interface ProfileSummary {
  user: {
    id: string;
    email: string;
    fullName: string;
    role: string;
    tenantId: string;
  };
  summary: {
    totalRooms: number;
    totalEmployees: number;
    employeeNames: string[];
  };
}

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose }) => {
  const [data, setData] = useState<ProfileSummary | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Password change state
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwdLoading, setPwdLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Profile Edit state
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState('');
  const [savingName, setSavingName] = useState(false);

  // Hotel Profile state
  const [hotelProfile, setHotelProfile] = useState<any>(null);
  const [showHotelForm, setShowHotelForm] = useState(false);
  const [hotelName, setHotelName] = useState('');
  const [hotelEmail, setHotelEmail] = useState('');
  const [hotelPhone, setHotelPhone] = useState('');
  const [hotelAddress, setHotelAddress] = useState('');
  const [hotelSaving, setHotelSaving] = useState(false);
  const [hotelMessage, setHotelMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadProfileData();
    } else {
      // Reset state on close
      setShowPasswordForm(false);
      setMessage(null);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setIsEditingName(false);
      setShowHotelForm(false);
      setHotelMessage(null);
    }
  }, [isOpen]);

  const loadProfileData = async () => {
    setLoading(true);
    try {
      const [resSummary, resHotel] = await Promise.all([
        api.get('/auth/profile-summary'),
        api.get('/settings/hotel-profile').catch(() => null)
      ]);
      setData(resSummary.data.data);
      
      if (resHotel && resHotel.data.data) {
        const hp = resHotel.data.data;
        setHotelProfile(hp);
        setHotelName(hp.name || '');
        setHotelEmail(hp.email || '');
        setHotelPhone(hp.phone || '');
        setHotelAddress(hp.address || '');
      }
    } catch (err) {
      console.error('Failed to load profile data', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateHotelProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setHotelMessage(null);
    setHotelSaving(true);
    try {
      const res = await api.put('/settings/hotel-profile', {
        name: hotelName,
        email: hotelEmail,
        phone: hotelPhone,
        address: hotelAddress
      });
      setHotelProfile(res.data.data);
      setHotelMessage({ text: 'Hotel profile updated successfully!', type: 'success' });
      setTimeout(() => setHotelMessage(null), 3000);
    } catch (err: any) {
      setHotelMessage({ text: err.response?.data?.message || 'Failed to update hotel profile', type: 'error' });
    } finally {
      setHotelSaving(false);
    }
  };

  const handleUpdateProfile = async () => {
    if (!editNameValue.trim() || editNameValue === data?.user.fullName) {
      setIsEditingName(false);
      return;
    }
    setSavingName(true);
    try {
      await api.put('/auth/profile', { fullName: editNameValue });
      setData((prev: any) => prev ? { ...prev, user: { ...prev.user, fullName: editNameValue } } : null);
      setIsEditingName(false);
    } catch (err) {
      console.error('Failed to update profile', err);
    } finally {
      setSavingName(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (newPassword !== confirmPassword) {
      setMessage({ text: 'New passwords do not match', type: 'error' });
      return;
    }
    
    setPwdLoading(true);
    try {
      await api.post('/auth/change-password', { currentPassword, newPassword });
      setMessage({ text: 'Password updated successfully!', type: 'success' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setShowPasswordForm(false), 2000);
    } catch (err: any) {
      setMessage({ text: err.response?.data?.message || 'Failed to update password', type: 'error' });
    } finally {
      setPwdLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal Container */}
      <div className="relative w-full max-w-[420px] bg-[#F8F9FC] rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Background Waves (Simulated with absolute shapes) */}
        <div className="absolute top-0 left-0 w-full h-48 overflow-hidden pointer-events-none">
          <div className="absolute -top-20 -left-20 w-64 h-64 bg-blue-50/50 rounded-full mix-blend-multiply filter blur-xl opacity-70"></div>
          <div className="absolute top-10 -right-20 w-72 h-72 bg-indigo-50/50 rounded-full mix-blend-multiply filter blur-xl opacity-70"></div>
          {/* SVG Wave */}
          <svg className="absolute top-0 left-0 w-full h-full text-blue-50/30" viewBox="0 0 100 100" preserveAspectRatio="none">
            <path d="M0,0 L100,0 L100,20 C80,40 20,0 0,20 Z" fill="currentColor"></path>
            <path d="M0,20 C30,40 70,10 100,30 L100,0 L0,0 Z" fill="currentColor" opacity="0.5"></path>
          </svg>
        </div>

        {/* Header / Avatar Area */}
        <div className="relative pt-12 pb-6 px-6 flex flex-col items-center">
          <button 
            onClick={onClose} 
            className="absolute top-6 left-6 w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm text-slate-400 hover:text-slate-100 transition-colors z-10"
          >
            <X className="w-5 h-5" />
          </button>

          {loading ? (
             <div className="w-24 h-24 rounded-full bg-slate-200 animate-pulse mb-4"></div>
          ) : (
            <>
              <div className="relative mb-4 z-10">
                <div className="w-28 h-28 rounded-full bg-white flex items-center justify-center shadow-[0_8px_30px_rgb(0,0,0,0.06)] p-1.5">
                  <div className="w-full h-full rounded-full bg-blue-50 border-[3px] border-blue-100 flex items-center justify-center">
                    <User className="w-12 h-12 text-blue-500" strokeWidth={1.5} />
                  </div>
                </div>
                <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[10px] font-bold uppercase tracking-widest px-4 py-1.5 rounded-full shadow-lg shadow-blue-500/30 whitespace-nowrap">
                  {data?.user.role}
                </div>
              </div>
              
              <div className="relative mt-2 z-10 flex items-center justify-center group h-8">
                {isEditingName ? (
                  <div className="flex items-center bg-white/10 rounded-lg p-1 backdrop-blur-sm border border-slate-200">
                    <input 
                      type="text" 
                      value={editNameValue}
                      onChange={(e) => setEditNameValue(e.target.value)}
                      className="bg-transparent border-none outline-none text-xl font-bold text-slate-100 text-center w-40 px-2"
                      autoFocus
                      onKeyDown={(e) => e.key === 'Enter' && handleUpdateProfile()}
                    />
                    <button 
                      onClick={handleUpdateProfile}
                      disabled={savingName}
                      className="p-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                      {savingName ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    </button>
                    <button 
                      onClick={() => setIsEditingName(false)}
                      disabled={savingName}
                      className="p-1.5 ml-1 bg-slate-200 text-slate-600 rounded-md hover:bg-slate-300 transition-colors disabled:opacity-50"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <h2 className="text-2xl font-bold text-slate-100 tracking-tight">
                      {data?.user.fullName}
                    </h2>
                    <button 
                      onClick={() => {
                        setEditNameValue(data?.user.fullName || '');
                        setIsEditingName(true);
                      }}
                      className="absolute -right-8 opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-blue-500 transition-all rounded-full hover:bg-blue-50"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
              <p className="text-sm text-slate-400 mt-1 z-10">
                {data?.user.email}
              </p>
            </>
          )}
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 pb-6 custom-scrollbar relative z-10 space-y-4">
          {loading ? (
            <div className="flex justify-center items-center py-10">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : data ? (
            <>
              {/* Environment Card */}
              <div className="bg-white rounded-2xl p-4 shadow-[0_2px_10px_rgb(0,0,0,0.02)] border border-slate-100 flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-500 flex items-center justify-center">
                    <Building className="w-6 h-6" strokeWidth={1.5} />
                  </div>
                  <div>
                    <div className="text-[10px] text-emerald-600 font-bold uppercase tracking-widest mb-0.5">Environment</div>
                    <div className="text-lg font-bold text-slate-100 leading-tight truncate max-w-[160px]">{hotelProfile?.name || data.user.tenantId}</div>
                  </div>
                </div>
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <ChevronDown className="w-4 h-4 -rotate-90" />
                </div>
              </div>

              {/* Property Insights */}
              <div className="bg-white rounded-3xl p-5 shadow-[0_2px_10px_rgb(0,0,0,0.02)] border border-slate-100">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-500 flex items-center justify-center">
                    <Building className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-100">Property Insights</h3>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  {/* Total Rooms */}
                  <div className="border border-blue-100 rounded-2xl p-4 relative overflow-hidden bg-white">
                    <div className="w-10 h-10 rounded-xl bg-blue-100/50 text-blue-600 flex items-center justify-center mb-2 z-10 relative">
                      <Building className="w-5 h-5" />
                    </div>
                    <div className="text-3xl font-extrabold text-slate-100 z-10 relative">{data.summary.totalRooms}</div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1 z-10 relative">Total Rooms</div>
                    {/* Wavy bg bottom right */}
                    <div className="absolute -bottom-8 -right-8 w-24 h-24 bg-blue-50/80 rounded-tl-full z-0"></div>
                  </div>
                  
                  {/* Active Staff */}
                  <div className="border border-purple-100 rounded-2xl p-4 relative overflow-hidden bg-white">
                    <div className="w-10 h-10 rounded-xl bg-purple-100/50 text-purple-600 flex items-center justify-center mb-2 z-10 relative">
                      <Users className="w-5 h-5" />
                    </div>
                    <div className="text-3xl font-extrabold text-slate-100 z-10 relative">{data.summary.totalEmployees}</div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1 z-10 relative">Active Staff</div>
                    {/* Wavy bg bottom right */}
                    <div className="absolute -bottom-8 -right-8 w-24 h-24 bg-purple-50/80 rounded-tl-full z-0"></div>
                  </div>
                </div>
              </div>

              {/* Team Members */}
              {data.summary.totalEmployees > 0 && (
                <div className="bg-white rounded-3xl p-5 shadow-[0_2px_10px_rgb(0,0,0,0.02)] border border-slate-100">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-500 flex items-center justify-center">
                        <Users className="w-4 h-4" />
                      </div>
                      <h3 className="text-sm font-bold text-slate-100">Team Members</h3>
                    </div>
                    <button className="text-xs font-semibold text-blue-600 flex items-center hover:text-blue-700">
                      View all <ChevronDown className="w-3 h-3 ml-0.5 -rotate-90" />
                    </button>
                  </div>
                  
                  <div className="space-y-2">
                    {data.summary.employeeNames.slice(0, 3).map((name, i) => {
                      const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
                      return (
                        <div key={i} className="flex items-center justify-between p-3 border border-slate-100 rounded-2xl">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-sm relative">
                              {initials}
                              <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full"></div>
                            </div>
                            <div>
                              <div className="text-sm font-bold text-slate-100">{name}</div>
                              <div className="text-xs text-slate-400 font-medium">Staff</div>
                            </div>
                          </div>
                          <button className="text-slate-400 hover:text-slate-200">
                            <div className="w-5 h-5 flex flex-col items-center justify-center space-y-[2px]">
                              <div className="w-1 h-1 bg-current rounded-full"></div>
                              <div className="w-1 h-1 bg-current rounded-full"></div>
                              <div className="w-1 h-1 bg-current rounded-full"></div>
                            </div>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Hotel Profile Settings */}
              <div className="bg-white rounded-3xl p-5 shadow-[0_2px_10px_rgb(0,0,0,0.02)] border border-slate-100 transition-all">
                <div 
                  className="flex items-center justify-between cursor-pointer" 
                  onClick={() => setShowHotelForm(!showHotelForm)}
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center">
                      <Building className="w-5 h-5" strokeWidth={2} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-100">Hotel Profile</h3>
                      <p className="text-xs text-slate-400 mt-0.5 font-medium">Update hotel name & contact</p>
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-slate-50 text-slate-400 flex items-center justify-center transition-transform">
                    {showHotelForm ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4 -rotate-90" />}
                  </div>
                </div>

                {showHotelForm && (
                  <form onSubmit={handleUpdateHotelProfile} className="mt-5 pt-5 border-t border-slate-100 space-y-4 animate-in slide-in-from-top-2 fade-in duration-200">
                    {hotelMessage && (
                      <div className={`p-3 rounded-xl text-sm border flex items-center ${hotelMessage.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-red-50 border-red-100 text-red-600'}`}>
                        {hotelMessage.text}
                      </div>
                    )}
                    
                    <div className="space-y-3">
                      <div className="relative">
                        <Building className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input 
                          type="text" 
                          required
                          value={hotelName}
                          onChange={(e) => setHotelName(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 focus:border-blue-400 focus:bg-white rounded-xl py-2.5 pl-10 pr-4 text-sm text-slate-100 outline-none transition-all placeholder-slate-400"
                          placeholder="Hotel Name"
                        />
                      </div>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input 
                          type="email" 
                          value={hotelEmail}
                          onChange={(e) => setHotelEmail(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 focus:border-blue-400 focus:bg-white rounded-xl py-2.5 pl-10 pr-4 text-sm text-slate-100 outline-none transition-all placeholder-slate-400"
                          placeholder="Hotel Email"
                        />
                      </div>
                      <div className="relative">
                        <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input 
                          type="text" 
                          value={hotelPhone}
                          onChange={(e) => setHotelPhone(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 focus:border-blue-400 focus:bg-white rounded-xl py-2.5 pl-10 pr-4 text-sm text-slate-100 outline-none transition-all placeholder-slate-400"
                          placeholder="Phone Number"
                        />
                      </div>
                      <div className="relative">
                        <MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input 
                          type="text" 
                          value={hotelAddress}
                          onChange={(e) => setHotelAddress(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 focus:border-blue-400 focus:bg-white rounded-xl py-2.5 pl-10 pr-4 text-sm text-slate-100 outline-none transition-all placeholder-slate-400"
                          placeholder="Address"
                        />
                      </div>
                    </div>

                    <button 
                      type="submit" 
                      disabled={hotelSaving}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-4 rounded-xl text-sm transition-all shadow-md shadow-blue-500/20 disabled:opacity-50 flex items-center justify-center"
                    >
                      {hotelSaving ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <Save className="w-4 h-4 mr-2" />
                      )}
                      Save Details
                    </button>
                  </form>
                )}
              </div>

              {/* Security Settings */}
              <div className="bg-white rounded-3xl p-5 shadow-[0_2px_10px_rgb(0,0,0,0.02)] border border-slate-100 transition-all">
                <div 
                  className="flex items-center justify-between cursor-pointer" 
                  onClick={() => setShowPasswordForm(!showPasswordForm)}
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 rounded-xl bg-orange-50 text-orange-500 flex items-center justify-center">
                      <Lock className="w-5 h-5" strokeWidth={2} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-100">Security Settings</h3>
                      <p className="text-xs text-slate-400 mt-0.5 font-medium">Manage roles, permissions & access</p>
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-slate-50 text-slate-400 flex items-center justify-center transition-transform">
                    {showPasswordForm ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4 -rotate-90" />}
                  </div>
                </div>

                {showPasswordForm && (
                  <form onSubmit={handleChangePassword} className="mt-5 pt-5 border-t border-slate-100 space-y-4 animate-in slide-in-from-top-2 fade-in duration-200">
                    {message && (
                      <div className={`p-3 rounded-xl text-sm border flex items-center ${message.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-red-50 border-red-100 text-red-600'}`}>
                        {message.text}
                      </div>
                    )}
                    
                    <div className="space-y-3">
                      <div className="relative">
                        <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input 
                          type="password" 
                          required
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 focus:border-blue-400 focus:bg-white rounded-xl py-2.5 pl-10 pr-4 text-sm text-slate-100 outline-none transition-all placeholder-slate-400"
                          placeholder="Current Password"
                        />
                      </div>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input 
                          type="password" 
                          required
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 focus:border-blue-400 focus:bg-white rounded-xl py-2.5 pl-10 pr-4 text-sm text-slate-100 outline-none transition-all placeholder-slate-400"
                          placeholder="New Password"
                        />
                      </div>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input 
                          type="password" 
                          required
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 focus:border-blue-400 focus:bg-white rounded-xl py-2.5 pl-10 pr-4 text-sm text-slate-100 outline-none transition-all placeholder-slate-400"
                          placeholder="Confirm New Password"
                        />
                      </div>
                    </div>

                    <button 
                      type="submit" 
                      disabled={pwdLoading}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-4 rounded-xl text-sm transition-all shadow-md shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                    >
                      {pwdLoading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>}
                      Update Password
                    </button>
                  </form>
                )}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default ProfileModal;
