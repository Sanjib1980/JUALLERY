import React, { useEffect, useState } from 'react';
import { ShoppingBag, Store } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { useAuth } from '../context/AuthContext';

interface AuthPagesProps {
  defaultPortal?: 'customer' | 'shopkeeper';
  queryString?: string;
  onNavigate: (route: string) => void;
  onFeedback: (msg: string) => void;
}

export const AuthPages: React.FC<AuthPagesProps> = ({
  defaultPortal = 'customer',
  queryString = '',
  onNavigate,
  onFeedback,
}) => {
  const { loginWithGoogle, loginWithEmail, registerCustomer } = useAuth();

  const params = new URLSearchParams(queryString);
  const queryPortal = params.get('portal') === 'shopkeeper' ? 'shopkeeper' : defaultPortal;
  const queryMode = params.get('mode');
  const redirectTarget = params.get('redirect');

  const [portal, setPortal] = useState<'customer' | 'shopkeeper'>(queryPortal);
  const [mode, setMode] = useState<'login' | 'register' | 'forgot' | 'reset'>(
    queryMode === 'register' && queryPortal === 'customer'
      ? 'register'
      : queryMode === 'forgot'
      ? 'forgot'
      : 'login'
  );

  const [fullName, setFullName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  useEffect(() => {
    setPortal(queryPortal);
    if (queryMode === 'register' && queryPortal === 'customer') {
      setMode('register');
    } else if (queryMode === 'forgot') {
      setMode('forgot');
    } else {
      setMode('login');
    }
    setError('');
    setInfo('');
  }, [queryPortal, queryMode]);

  const handlePortalChange = (nextPortal: 'customer' | 'shopkeeper') => {
    setPortal(nextPortal);
    if (nextPortal === 'shopkeeper' && mode === 'register') {
      setMode('login');
    }
    setError('');
    setInfo('');
  };

  const handleGoogle = async () => {
    setBusy(true);
    setError('');
    try {
      const u = await loginWithGoogle();
      onFeedback(`Signed in as ${u.fullName}`);
      onNavigate(redirectTarget || '/shop');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Google Sign-In failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setInfo('');

    try {
      if (mode === 'login') {
        const u = await loginWithEmail(email, password, portal);
        if (portal === 'shopkeeper') {
          onFeedback(`Signed in to Shopkeeper Portal as ${u.fullName}`);
          onNavigate(redirectTarget || '/dashboard/manage-products');
        } else {
          onFeedback(`Welcome back, ${u.fullName}! Ready to shop.`);
          onNavigate(redirectTarget || '/shop');
        }
      } else if (mode === 'register') {
        const u = await registerCustomer({ fullName, mobile, email, password });
        onFeedback(`Customer account created for ${u.fullName}`);
        onNavigate(redirectTarget || '/shop');
      } else if (mode === 'forgot') {
        const res = await apiFetch<{ message: string; resetToken?: string }>(
          '/api/auth/forgot-password',
          { method: 'POST', body: JSON.stringify({ email }) }
        );
        setInfo(res.message);
        if (res.resetToken) {
          setResetToken(res.resetToken);
          setMode('reset');
        }
      } else if (mode === 'reset') {
        const res = await apiFetch<{ message: string }>('/api/auth/reset-password', {
          method: 'POST',
          body: JSON.stringify({ token: resetToken, newPassword }),
        });
        setInfo(res.message);
        setMode('login');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Authentication error.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-14">
      <div className="bg-white border border-champagne-200 rounded-2xl p-8 shadow-sm space-y-6">
        {/* Segmented Portal Switcher */}
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-champagne-50 border border-champagne-200 rounded-xl">
          <button
            type="button"
            onClick={() => handlePortalChange('customer')}
            className={`py-2.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer ${
              portal === 'customer'
                ? 'bg-maroon-800 text-champagne-50 shadow-sm'
                : 'text-maroon-900 hover:bg-white'
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Customer Login</span>
          </button>
          <button
            type="button"
            onClick={() => handlePortalChange('shopkeeper')}
            className={`py-2.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer ${
              portal === 'shopkeeper'
                ? 'bg-maroon-900 text-gold-400 shadow-sm'
                : 'text-maroon-900 hover:bg-white'
            }`}
          >
            <Store className="w-4 h-4" />
            <span>Shopkeeper Login</span>
          </button>
        </div>

        <div className="text-center space-y-1">
          <h1 className="font-serif text-3xl text-maroon-900">
            {mode === 'forgot'
              ? 'Forgot Password'
              : mode === 'reset'
              ? 'Reset Password'
              : portal === 'shopkeeper'
              ? 'Shopkeeper Portal Sign In'
              : mode === 'register'
              ? 'Create Customer Account'
              : 'Customer Sign In'}
          </h1>
          <p className="text-xs text-ink/65">
            {portal === 'shopkeeper'
              ? 'Sign in to review products, inspect customer ratings, update stock, and manage orders.'
              : 'Sign in to browse BIS hallmarked jewellery, save wishlists, and place orders.'}
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-3.5 py-2.5 rounded-lg text-xs">
            {error}
          </div>
        )}
        {info && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-3.5 py-2.5 rounded-lg text-xs">
            {info}
          </div>
        )}

        {portal === 'customer' && (mode === 'login' || mode === 'register') && (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={handleGoogle}
              className="w-full border border-champagne-200 bg-champagne-50 hover:bg-champagne-100 text-maroon-900 py-2.5 px-4 rounded-lg text-sm font-semibold transition-colors cursor-pointer disabled:opacity-50"
            >
              Continue with Google
            </button>
            <div className="flex items-center gap-3 text-xs text-ink/45">
              <div className="flex-1 h-px bg-champagne-200" />
              <span>or use email</span>
              <div className="flex-1 h-px bg-champagne-200" />
            </div>
          </>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5 text-sm">
          {mode === 'register' && portal === 'customer' && (
            <>
              <div>
                <label className="block text-xs font-medium text-ink/70 mb-1">Full Name</label>
                <input
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ananya Sharma"
                  className="w-full border border-champagne-200 rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-ink/70 mb-1">Mobile Number</label>
                <input
                  required
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full border border-champagne-200 rounded-lg px-3 py-2"
                />
              </div>
            </>
          )}

          {mode !== 'reset' && (
            <div>
              <label className="block text-xs font-medium text-ink/70 mb-1">
                {portal === 'shopkeeper' ? 'Shopkeeper Email Address' : 'Email Address'}
              </label>
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={
                  portal === 'shopkeeper' ? 'shopkeeper@aureliajewels.com' : 'you@example.com'
                }
                className="w-full border border-champagne-200 rounded-lg px-3 py-2"
              />
            </div>
          )}

          {(mode === 'login' || mode === 'register') && (
            <div>
              <label className="block text-xs font-medium text-ink/70 mb-1">Password</label>
              <input
                required
                type="password"
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 6 characters"
                className="w-full border border-champagne-200 rounded-lg px-3 py-2"
              />
            </div>
          )}

          {mode === 'reset' && (
            <>
              <div>
                <label className="block text-xs font-medium text-ink/70 mb-1">Reset Token</label>
                <input
                  required
                  value={resetToken}
                  onChange={(e) => setResetToken(e.target.value)}
                  className="w-full border border-champagne-200 rounded-lg px-3 py-2 font-mono text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-ink/70 mb-1">New Password</label>
                <input
                  required
                  type="password"
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full border border-champagne-200 rounded-lg px-3 py-2"
                />
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={busy}
            className={`w-full py-2.5 rounded-lg font-semibold transition-colors cursor-pointer disabled:opacity-50 ${
              portal === 'shopkeeper'
                ? 'bg-maroon-900 hover:bg-maroon-800 text-gold-400 border border-gold-500/40'
                : 'bg-maroon-800 hover:bg-maroon-900 text-champagne-50'
            }`}
          >
            {busy
              ? 'Please wait...'
              : mode === 'login'
              ? portal === 'shopkeeper'
                ? 'Sign In & Review Products'
                : 'Sign In & Shop Jewellery'
              : mode === 'register'
              ? 'Create Customer Account'
              : mode === 'forgot'
              ? 'Generate Reset Token'
              : 'Update Password'}
          </button>
        </form>

        <div className="pt-2 border-t border-champagne-100 text-center text-xs space-y-2 text-maroon-800">
          {mode === 'login' ? (
            <>
              <div>
                <button
                  type="button"
                  onClick={() => setMode('forgot')}
                  className="underline cursor-pointer"
                >
                  Forgot password?
                </button>
              </div>
              {portal === 'customer' ? (
                <div>
                  New to showroom?{' '}
                  <button
                    type="button"
                    onClick={() => setMode('register')}
                    className="font-semibold underline cursor-pointer"
                  >
                    Register as Customer
                  </button>
                </div>
              ) : (
                <div className="text-ink/60">
                  Shopkeeper accounts are managed by the Super Admin.
                </div>
              )}
            </>
          ) : (
            <button
              type="button"
              onClick={() => setMode('login')}
              className="underline cursor-pointer"
            >
              Back to Sign In
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
