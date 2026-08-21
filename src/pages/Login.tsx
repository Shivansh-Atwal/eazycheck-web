import React, { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import api from '../utils/api';
import { KeyRound, Mail, Loader2, Building, User } from 'lucide-react';

const Login: React.FC<{ initialMode?: 'login' | 'register' }> = ({ initialMode = 'login' }) => {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [tenantId, setTenantId] = useState(() => {
    const stored = localStorage.getItem('tenantId');
    return stored && stored !== 'public' ? stored : '';
  });
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [developerPassword, setDeveloperPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { login } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const cleanTenantId = tenantId.trim().toLowerCase().replace(/[^a-z0-9]/g, '') || 'public';
    localStorage.setItem('tenantId', cleanTenantId);

    setLoading(true);

    if (mode === 'login') {
      if (!email || !password) {
        setLoading(false);
        return;
      }
      try {
        const response = await api.post('/auth/login', { email, password });
        const { accessToken, refreshToken, user, tenantId: returnedTenantId } = response.data.data;
        if (returnedTenantId) {
          localStorage.setItem('tenantId', returnedTenantId);
        }
        login(user, accessToken, refreshToken);
      } catch (err: any) {
        console.error(err);
        setError(
          err.response?.data?.error || 'Authentication failed. Please verify credentials and Hotel ID.'
        );
      } finally {
        setLoading(false);
      }
    } else {
      if (!tenantId || !email || !password || !fullName || !developerPassword) {
        setError('All registration fields (including Developer Key) are required.');
        setLoading(false);
        return;
      }
      try {
        await api.post('/auth/register-tenant', {
          tenantName: cleanTenantId,
          adminEmail: email,
          adminPassword: password,
          adminFullName: fullName,
          developerPassword,
        });

        setSuccess('New Hotel environment setup completed successfully! You can now sign in.');
        setMode('login');
        setPassword('');
        setDeveloperPassword('');
      } catch (err: any) {
        console.error(err);
        setError(
          err.response?.data?.error || 'Failed to setup new Hotel environment.'
        );
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      {/* Background radial effects */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_500px_at_50%_200px,#3b82f610,transparent)] pointer-events-none" />

      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-8 relative overflow-hidden">
        {/* Glow */}
        <div className="absolute -top-12 -left-12 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl" />

        <div className="text-center mb-6 flex flex-col items-center">
          <img src="/logo.png?v=2" alt="EazyCheck Logo" className="h-16 w-auto object-contain mb-3" />
          <p className="text-sm text-slate-400">Enterprise Multi-Tenant Stay & Booking System</p>
        </div>

        <h2 className="text-xl font-bold text-white text-center mb-6">{mode === 'login' ? 'Sign In' : 'Register New Hotel'}</h2>

        {error && (
          <div className="mb-5 p-4 bg-rose-500/15 border border-rose-500/30 rounded-xl text-sm text-rose-200">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-5 p-4 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-sm text-emerald-250">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Hotel/Tenant ID */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Hotel ID / Tenant ID {mode === 'login' && <span className="text-slate-500">(Optional)</span>}
            </label>
            <div className="relative">
              <Building className="absolute left-3.5 top-3 w-5 h-5 text-slate-500" />
              <input
                type="text"
                required={mode === 'register'}
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value)}
                placeholder={mode === 'login' ? 'e.g. ritz (Leave blank for default)' : 'e.g. ritz (alphanumeric only)'}
                className="w-full normal-case bg-slate-950 border border-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl py-2.5 px-3.5 pl-11 text-sm text-white placeholder-slate-600 outline-none transition-colors"
              />
            </div>
          </div>

          {/* Full Name (Registration only) */}
          {mode === 'register' && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Admin Full Name
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-3 w-5 h-5 text-slate-500" />
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Samuel L. Jackson"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl py-2.5 px-3.5 pl-11 text-sm text-white placeholder-slate-600 outline-none transition-colors"
                />
              </div>
            </div>
          )}

          {/* Email Address */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              {mode === 'login' ? 'Email Address' : 'Admin Email Address'}
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3 w-5 h-5 text-slate-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. admin@ritz.com"
                className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl py-2.5 px-3.5 pl-11 text-sm text-white placeholder-slate-600 outline-none transition-colors"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Password
            </label>
            <div className="relative">
              <KeyRound className="absolute left-3.5 top-3 w-5 h-5 text-slate-500" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl py-2.5 px-3.5 pl-11 text-sm text-white placeholder-slate-600 outline-none transition-colors"
              />
            </div>
          </div>

          {/* Developer Password (Registration only) */}
          {mode === 'register' && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Developer Key / Password
              </label>
              <div className="relative">
                <KeyRound className="absolute left-3.5 top-3 w-5 h-5 text-slate-500" />
                <input
                  type="password"
                  required
                  value={developerPassword}
                  onChange={(e) => setDeveloperPassword(e.target.value)}
                  placeholder="Ask system administrator for key"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl py-2.5 px-3.5 pl-11 text-sm text-white placeholder-slate-650 outline-none transition-colors"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 transition-colors cursor-pointer disabled:cursor-not-allowed text-xs uppercase tracking-wider font-mono mt-2"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            ) : mode === 'login' ? (
              'Sign In'
            ) : (
              'Initialize Setup & Create'
            )}
          </button>
        </form>

        <div className="mt-6 border-t border-slate-800 pt-5 text-center text-xs text-slate-500">
          <p>
            For Subscription contact to{' '}
            <span className="text-slate-350">info.eazycheck.in@gmail.com</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
