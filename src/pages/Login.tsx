import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Lock, Mail, AlertCircle, Sparkles, ArrowLeft, CheckCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function Login() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isResetMode, setIsResetMode] = useState(false);
  const navigate = useNavigate();

  const [orgLogo, setOrgLogo] = useState<string | null>(null);
  const [orgName, setOrgName] = useState<string>('GuestReview.ai');

  useEffect(() => {
    supabase
      .from('organizations')
      .select('name, logo_url')
      .limit(1)
      .then(({ data }) => {
        if (data && data.length > 0) {
          setOrgName(data[0].name || 'GuestReview.ai');
          setOrgLogo(data[0].logo_url || null);
        }
      });
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      console.log('[Login Page] Attempting signInWithPassword for:', email);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      console.log('LOGIN_RESPONSE', data, error);

      if (error) {
        console.log('LOGIN_ERROR_FULL', error);

        let message =
          error?.message ||
          (error as any)?.error_description ||
          (error as any)?.details ||
          (error as any)?.hint ||
          String(error);

        if (message === '{}' || message === '[object Object]') {
          message = 'Internal Server Error (500). Supabase failed to authenticate. The password hash might be corrupted.';
        }

        setError(message);
        setLoading(false);
        return;
      }

      console.log('LOGIN_SUCCESS');
      navigate('/');
    } catch (err: any) {
      console.error('[Login Page] handleLogin caught exception:', err);
      console.log('LOGIN_ERROR_FULL', err);
      
      let message =
        err?.message ||
        err?.error_description ||
        err?.details ||
        err?.hint ||
        String(err);

      if (message === '{}' || message === '[object Object]') {
        message = 'Internal Server Error (500). Supabase failed to authenticate. The password hash might be corrupted.';
      }

      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/login`
      });

      if (resetError) throw resetError;
      setSuccess('Reset instructions sent! Please check your email.');
    } catch (err: any) {
      setError(err.message || 'Failed to send password reset request.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#060814] flex flex-col justify-center items-center p-6 relative overflow-hidden">
      {/* Background Gradient Accents */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/3 w-[300px] h-[300px] bg-purple-600/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md space-y-8 z-10">
        {/* Logo Strip */}
        <div className="text-center space-y-3">
          {orgLogo ? (
            <img src={orgLogo} alt="Logo" className="w-16 h-16 rounded-2xl object-contain mx-auto shadow-lg bg-white/5 p-1" />
          ) : (
            <img src="/branding/logo.png" alt="GuestReview.ai Logo" className="h-10 object-contain mx-auto" />
          )}
          <h2 className="text-2xl font-bold tracking-tight text-slate-100 uppercase">{orgName}</h2>
          <p className="text-xs text-slate-400">
            SaaS Multi-Hotel Feedback & Operational Workspace Manager
          </p>
        </div>

        {/* Card Panel */}
        <div className="glass-panel p-8 rounded-3xl border border-white/[0.06] bg-[#090b16]/95 shadow-2xl space-y-6">
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-slate-200">
              {isResetMode ? t('login.resetPassword') : t('login.welcome')}
            </h3>
            <p className="text-[11px] text-slate-500">
              {isResetMode 
                ? t('login.resetSub') 
                : t('login.loginSub')}
            </p>
          </div>

          {error && (
            <div className="p-3.5 rounded-xl border border-rose-500/25 bg-rose-950/20 text-rose-400 text-xs flex items-start gap-2.5">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3.5 rounded-xl border border-emerald-500/25 bg-emerald-950/20 text-emerald-400 text-xs flex items-start gap-2.5">
              <CheckCircle size={16} className="shrink-0 mt-0.5" />
              <span>{success}</span>
            </div>
          )}

          {isResetMode ? (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400 font-medium block">{t('login.email')}</label>
                <div className="relative">
                  <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@guestreview.ai"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-white/[0.06] text-xs focus:outline-none focus:border-blue-500 text-slate-300 placeholder:text-slate-600"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 mt-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2"
              >
                {loading ? t('login.sendingRequest') : t('login.sendResetLink')}
              </button>

              <button
                type="button"
                onClick={() => { setIsResetMode(false); setError(null); setSuccess(null); }}
                className="w-full text-center text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center justify-center gap-1.5 mt-2"
              >
                <ArrowLeft size={12} />
                {t('login.backToSignIn')}
              </button>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400 font-medium block">{t('login.email')}</label>
                <div className="relative">
                  <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@guestreview.ai"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-white/[0.06] text-xs focus:outline-none focus:border-blue-500 text-slate-300 placeholder:text-slate-600"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs text-slate-400 font-medium block">{t('login.password')}</label>
                  <button
                    type="button"
                    onClick={() => { setIsResetMode(true); setError(null); setSuccess(null); }}
                    className="text-[11px] text-blue-400 hover:text-blue-300 font-semibold"
                  >
                    {t('login.forgotPassword')}
                  </button>
                </div>
                <div className="relative">
                  <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-white/[0.06] text-xs focus:outline-none focus:border-blue-500 text-slate-300 placeholder:text-slate-600"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 mt-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2"
              >
                {loading ? t('login.authenticating') : t('login.signIn')}
              </button>
            </form>
          )}

          <div className="p-3.5 rounded-xl bg-blue-500/[0.02] border border-blue-500/10 text-[10px] text-blue-400 leading-relaxed">
            <div className="font-semibold flex items-center gap-1 mb-1">
              <Sparkles size={11} />
              <span>{t('login.multiTenantAccess')}</span>
            </div>
            <span>
              {t('login.multiTenantSub')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
