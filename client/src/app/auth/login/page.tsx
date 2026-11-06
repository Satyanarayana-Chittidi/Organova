'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Heart, Lock, Mail, AlertCircle, ArrowRight, Hospital, User, Eye, EyeOff } from 'lucide-react';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, logout } = useAuth();

  const initialPortal =
    searchParams.get('portal') === 'hospital' || searchParams.get('role') === 'hospital'
      ? 'hospital'
      : 'user';
  const [portal, setPortal] = useState<'user' | 'hospital'>(initialPortal);

  useEffect(() => {
    const p = searchParams.get('portal') || searchParams.get('role');
    if (p === 'hospital') {
      setPortal('hospital');
    } else if (p === 'user') {
      setPortal('user');
    }
  }, [searchParams]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const user = await login(email, password);

      if (user.role === 'ADMIN') {
        await logout();
        setError('Administrative accounts must authenticate directly via the designated Master Control Gateway.');
        return;
      } else if (user.role === 'HOSPITAL') {
        router.push('/hospital/matches');
      } else {
        router.push('/');
      }
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-6 bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
        <div className="grid grid-cols-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl">
          <button
            type="button"
            onClick={() => {
              setPortal('user');
              setError(null);
            }}
            className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              portal === 'user'
                ? 'bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            Citizen Login
          </button>
          <button
            type="button"
            onClick={() => {
              setPortal('hospital');
              setError(null);
            }}
            className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              portal === 'hospital'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Hospital className="w-3.5 h-3.5" />
            Hospital Login
          </button>
        </div>

        <div className="text-center">
          {portal === 'hospital' ? (
            <>
              <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white mx-auto mb-4 shadow-md shadow-blue-500/20">
                <Hospital className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                Hospital Portal Sign In
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Clinical coordinators, surgeons & medical staff
              </p>
            </>
          ) : (
            <>
              <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 dark:border-slate-700 p-0 mx-auto mb-4 shadow-md shadow-rose-500/10 overflow-hidden flex items-center justify-center">
                <img src="/images/logo.png" alt="Platform Logo" className="w-full h-full object-contain" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                Sign In to Platform
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Access your donor pledge, digital card, and emergency requisitions
              </p>
            </>
          )}
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={portal === 'hospital' ? 'coordinator@hospital.org' : 'you@domain.com'}
                className={`w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white bg-white dark:bg-slate-800 placeholder:text-slate-400 dark:placeholder:text-slate-500 font-medium focus:outline-hidden ${
                  portal === 'hospital'
                    ? 'focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                    : 'focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20'
                }`}
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Password
              </label>
              <Link
                href="#"
                className={`text-xs hover:underline ${
                  portal === 'hospital'
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-3" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className={`w-full pl-9 pr-10 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white bg-white dark:bg-slate-800 placeholder:text-slate-400 dark:placeholder:text-slate-500 font-medium focus:outline-hidden ${
                  portal === 'hospital'
                    ? 'focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                    : 'focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 focus:outline-hidden cursor-pointer p-0.5 rounded transition-colors"
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3 rounded-xl text-white font-semibold text-sm shadow-md flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer ${
              portal === 'hospital'
                ? 'bg-blue-600 hover:bg-blue-500 shadow-blue-500/20'
                : 'bg-gradient-to-r from-rose-600 to-red-500 hover:from-rose-500 hover:to-red-600 shadow-rose-500/20'
            }`}
          >
            {loading
              ? 'Authenticating...'
              : portal === 'hospital'
              ? 'Sign In to Hospital Portal'
              : 'Sign In'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 text-center">
          {portal === 'hospital' ? (
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Don&apos;t have an account yet?{' '}
              <Link
                href="/hospital/register"
                className="font-semibold text-blue-600 dark:text-blue-400 hover:underline"
              >
                Register a Medical Facility
              </Link>
            </p>
          ) : (
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Don&apos;t have an account yet?{' '}
              <Link
                href="/auth/register"
                className="font-semibold text-rose-600 dark:text-rose-400 hover:underline"
              >
                Register as Citizen or Donor
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center py-12 px-4">
          <div className="w-10 h-10 border-4 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
