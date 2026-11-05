'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { Heart, Lock, Mail, KeyRound, AlertCircle, ArrowRight, CheckCircle2 } from 'lucide-react';
export default function RegisterPage() {
    const router = useRouter();
    const { refreshUser } = useAuth();
    const [step, setStep] = useState<1 | 2>(1);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [otp, setOtp] = useState('');
    const [loading, setLoading] = useState(false);
    const [otpSuccess, setOtpSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const handleInitiate = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);
        try {
            await authApi.register({ email, password });
            setStep(2);
        }
        catch (err: any) {
            setError(err.message || 'Registration failed. Email might already be taken.');
        }
        finally {
            setLoading(false);
        }
    };
    const handleVerifyOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);
        try {
            await authApi.verifyOtp({ email, otp });
            setOtpSuccess(true);
            await refreshUser();
            setTimeout(() => {
                router.push('/citizen/profile/edit?from=signup');
            }, 700);
        }
        catch (err: any) {
            setError(err.message || 'Invalid or expired OTP. Please try again.');
        }
        finally {
            setLoading(false);
        }
    };
    return (<div className="flex-1 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 dark:border-slate-700 p-0 mx-auto mb-4 shadow-md shadow-rose-500/10 overflow-hidden flex items-center justify-center">
            <img src="/images/logo.png" alt="Platform Logo" className="w-full h-full object-contain"/>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            {step === 1 ? 'Join as Citizen Donor' : 'Verify Your Email OTP'}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {step === 1
            ? 'Pledge organs, save lives, and generate your digital donor card'
            : `We sent a 6-digit code to ${email}`}
          </p>
        </div>

        {error && (<div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0"/>
            <span>{error}</span>
          </div>)}

        {otpSuccess && (<div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/50 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2 animate-pulse">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400"/>
            <span className="font-semibold">✓ OTP Verified! Redirecting to complete additional details...</span>
          </div>)}

        {step === 1 ? (<form onSubmit={handleInitiate} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-3"/>
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@domain.com" className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white bg-white dark:bg-slate-800 placeholder:text-slate-400 dark:placeholder:text-slate-500 font-medium focus:outline-hidden focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"/>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-3"/>
                <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white bg-white dark:bg-slate-800 placeholder:text-slate-400 dark:placeholder:text-slate-500 font-medium focus:outline-hidden focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"/>
              </div>
            </div>

            <button type="submit" disabled={loading} className="w-full py-3 rounded-xl bg-gradient-to-r from-rose-600 to-red-500 hover:from-rose-500 hover:to-red-600 text-white font-semibold text-sm shadow-md shadow-rose-500/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer">
              {loading ? 'Sending Code...' : 'Continue to Verification'}
              <ArrowRight className="w-4 h-4"/>
            </button>
          </form>) : (<form onSubmit={handleVerifyOtp} className="space-y-4">
            <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/50 border border-blue-100 dark:border-blue-900/50 text-blue-700 dark:text-blue-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-blue-500 dark:text-blue-400"/>
              <span>In local dev, the 6-digit OTP code is logged directly to your server terminal.</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Enter 6-Digit OTP</label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-3"/>
                <input type="text" required maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="123456" className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-lg tracking-widest font-mono text-center text-slate-900 dark:text-white bg-white dark:bg-slate-800 placeholder:text-slate-400 dark:placeholder:text-slate-500 font-bold focus:outline-hidden focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"/>
              </div>
            </div>

            <button type="submit" disabled={loading} className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-600 text-white font-semibold text-sm shadow-md shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer">
              {loading ? 'Verifying...' : 'Verify OTP & Complete Profile'}
              <ArrowRight className="w-4 h-4"/>
            </button>

            <button type="button" onClick={() => setStep(1)} className="w-full text-center text-xs text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200">
              ← Back to change email
            </button>
          </form>)}

        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 text-center">
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Already have an account?{' '}
            <Link href="/auth/login" className="font-semibold text-rose-600 dark:text-rose-400 hover:underline">
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>);
}
