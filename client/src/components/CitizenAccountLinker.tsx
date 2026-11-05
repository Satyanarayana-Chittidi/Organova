'use client';
import React, { useState, useEffect } from 'react';
import { hubApi } from '@/lib/api';
import { User, Search, PlusCircle, AlertCircle, Copy, Check, ShieldCheck, X, KeyRound, RefreshCw, } from 'lucide-react';
export interface LinkedCitizen {
    id: string;
    email: string;
    full_name: string;
    blood_group: string;
    date_of_birth?: string;
    phone_number?: string;
    temp_password?: string;
}
interface CitizenAccountLinkerProps {
    label: string;
    sublabel?: string;
    selectedUser: LinkedCitizen | null;
    onSelectUser: (user: LinkedCitizen | null) => void;
    onBloodGroupSelected?: (bg: string) => void;
    allowAnonymous?: boolean;
    onSelectAnonymous?: () => void;
}
export function calculateTempPassword(fullName: string, dob: string): string {
    const cleanName = (fullName || '').trim();
    const firstName = cleanName.split(/\s+/)[0]?.replace(/[^a-zA-Z]/g, '').toLowerCase() || 'user';
    const prefix = firstName.length >= 4 ? firstName.slice(0, 4) : firstName;
    let year = '2000';
    if (dob) {
        const parts = dob.split(/[-/]/);
        if (parts[0] && parts[0].length === 4) {
            year = parts[0];
        }
        else {
            const parsed = new Date(dob).getFullYear();
            if (!isNaN(parsed))
                year = String(parsed);
        }
    }
    return `${prefix}${year}`;
}
export default function CitizenAccountLinker({ label, sublabel, selectedUser, onSelectUser, onBloodGroupSelected, }: CitizenAccountLinkerProps) {
    const [mode, setMode] = useState<'SEARCH' | 'CREATE'>('SEARCH');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [searching, setSearching] = useState(false);
    const [searchError, setSearchError] = useState<string | null>(null);
    const [newFullName, setNewFullName] = useState('');
    const [newEmail, setNewEmail] = useState('');
    const [newDob, setNewDob] = useState('1990-01-01');
    const [newGender, setNewGender] = useState<'MALE' | 'FEMALE' | 'OTHER'>('MALE');
    const [newBloodGroup, setNewBloodGroup] = useState('O+');
    const [newPhone, setNewPhone] = useState('');
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [createdCredential, setCreatedCredential] = useState<{
        email: string;
        tempPassword: string;
    } | null>(null);
    const previewPassword = calculateTempPassword(newFullName, newDob);
    useEffect(() => {
        if (mode !== 'SEARCH')
            return;
        const timer = setTimeout(async () => {
            setSearching(true);
            setSearchError(null);
            try {
                const res = await hubApi.searchCitizens(searchQuery.trim());
                if (res.success) {
                    setSearchResults(Array.isArray(res.data) ? res.data : []);
                }
            }
            catch (err: any) {
                setSearchError(err.message || 'Search failed');
            }
            finally {
                setSearching(false);
            }
        }, 250);
        return () => clearTimeout(timer);
    }, [searchQuery, mode]);
    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreateError(null);
        if (!newFullName.trim()) {
            setCreateError('Full name is required.');
            return;
        }
        if (!newEmail.trim()) {
            setCreateError('Email is required.');
            return;
        }
        setCreating(true);
        try {
            const res = await hubApi.masterRegisterCitizen({
                full_name: newFullName.trim(),
                email: newEmail.trim(),
                date_of_birth: newDob,
                gender: newGender,
                blood_group: newBloodGroup,
                phone_number: newPhone.trim() || undefined,
            });
            if (res.success && res.data?.user) {
                const user = res.data.user;
                const tempPassword = res.data.temp_password || previewPassword;
                const linked: LinkedCitizen = {
                    id: user.id,
                    email: user.email,
                    full_name: user.full_name,
                    blood_group: user.blood_group,
                    date_of_birth: user.date_of_birth,
                    phone_number: user.phone_number,
                    temp_password: tempPassword,
                };
                setCreatedCredential({
                    email: user.email,
                    tempPassword,
                });
                onSelectUser(linked);
                if (onBloodGroupSelected) {
                    onBloodGroupSelected(user.blood_group);
                }
            }
            else {
                throw new Error(res.message || 'Failed to create account.');
            }
        }
        catch (err: any) {
            setCreateError(err.message || 'Failed to create account.');
        }
        finally {
            setCreating(false);
        }
    };
    const generateGuestEmail = () => {
        const cleanFirst = newFullName.trim().split(/\s+/)[0]?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'donor';
        const rand = Math.floor(1000 + Math.random() * 9000);
        setNewEmail(`${cleanFirst}.${rand}@hospital.internal`);
    };
    const handleCopyCredential = () => {
        const pwd = selectedUser?.temp_password || createdCredential?.tempPassword;
        if (!pwd)
            return;
        navigator.clipboard.writeText(pwd);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    if (selectedUser) {
        return (<div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400"/>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  {label}
                </span>
                <span className="px-1.5 py-0.2 rounded-md bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 text-[10px] font-bold">
                  Linked
                </span>
              </div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                {selectedUser.full_name}
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {selectedUser.email}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="px-2.5 py-1 rounded-lg bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 text-xs font-black">
              {selectedUser.blood_group}
            </span>
            <button type="button" onClick={() => {
                onSelectUser(null);
                setCreatedCredential(null);
            }} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer" title="Change or unlink citizen">
              <X className="w-4 h-4"/>
            </button>
          </div>
        </div>

        {(selectedUser.temp_password || createdCredential) && (<div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
              <KeyRound className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0"/>
              <span>
                Initial Password:{' '}
                <strong className="font-mono text-emerald-700 dark:text-emerald-400 text-sm">
                  {selectedUser.temp_password || createdCredential?.tempPassword}
                </strong>
              </span>
            </div>
            <button type="button" onClick={handleCopyCredential} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold transition-colors cursor-pointer shrink-0">
              {copied ? <Check className="w-3 h-3"/> : <Copy className="w-3 h-3"/>}
              {copied ? 'Copied!' : 'Copy Password'}
            </button>
          </div>)}
      </div>);
    }
    return (<div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 space-y-3">

      <div>
        <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
          <User className="w-3.5 h-3.5 text-rose-500"/>
          {label}
        </label>
        {sublabel && (<p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            {sublabel}
          </p>)}
      </div>

      <div className="grid grid-cols-2 p-1 rounded-xl bg-slate-200/80 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold">
        <button type="button" onClick={() => {
            setMode('SEARCH');
            setCreateError(null);
        }} className={`py-1.5 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${mode === 'SEARCH'
            ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}>
          <Search className="w-3.5 h-3.5"/>
          Link Existing Citizen
        </button>

        <button type="button" onClick={() => {
            setMode('CREATE');
            setSearchError(null);
        }} className={`py-1.5 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${mode === 'CREATE'
            ? 'bg-rose-600 text-white shadow-xs'
            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}>
          <PlusCircle className="w-3.5 h-3.5"/>
          Create New Account
        </button>
      </div>

      {mode === 'SEARCH' && (<div className="space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"/>
            <input type="text" placeholder="Search by name, email, or phone..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:border-rose-500 font-medium"/>
          </div>

          {searchError && (<div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 text-xs flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0"/>
              <span>{searchError}</span>
            </div>)}

          <div className="space-y-1.5">
            {searching ? (<div className="py-4 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin"/>
                <span>Searching platform registry...</span>
              </div>) : searchResults.length === 0 ? (<div className="p-3 text-center text-xs text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                <span>No registered citizens found. </span>
                <button type="button" onClick={() => setMode('CREATE')} className="font-bold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer">
                  Create New Account →
                </button>
              </div>) : (searchResults.slice(0, 5).map((c) => (<div key={c.id} onClick={() => {
                    onSelectUser({
                        id: c.id,
                        email: c.email,
                        full_name: c.full_name,
                        blood_group: c.blood_group,
                        date_of_birth: c.date_of_birth,
                        phone_number: c.phone_number,
                    });
                    if (onBloodGroupSelected)
                        onBloodGroupSelected(c.blood_group);
                }} className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-400 dark:hover:border-emerald-600 transition-colors flex items-center justify-between gap-3 cursor-pointer group">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 dark:text-white text-xs truncate">
                        {c.full_name}
                      </span>
                      <span className="px-1.5 py-0.2 rounded-md bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 text-[10px] font-bold">
                        {c.blood_group}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {c.email} {c.phone_number ? `• ${c.phone_number}` : ''}
                    </p>
                  </div>

                  <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 group-hover:translate-x-0.5 transition-transform shrink-0">
                    Select →
                  </span>
                </div>)))}
          </div>
        </div>)}

      {mode === 'CREATE' && (<form onSubmit={handleRegister} className="space-y-3">
          {createError && (<div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 text-xs flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0"/>
              <span>{createError}</span>
            </div>)}

          <div>
            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
              Full Name *
            </label>
            <input type="text" required placeholder="e.g. Ramesh Patel" value={newFullName} onChange={(e) => setNewFullName(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-hidden focus:border-rose-500"/>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                Email Address *
              </label>
              <button type="button" onClick={generateGuestEmail} className="text-[10px] font-semibold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer">
                + Auto-generate Hospital Email
              </button>
            </div>
            <input type="email" required placeholder="e.g. ramesh.patel@gmail.com" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-hidden focus:border-rose-500"/>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                Date of Birth *
              </label>
              <input type="date" required value={newDob} onChange={(e) => setNewDob(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-hidden focus:border-rose-500"/>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                Gender *
              </label>
              <select value={newGender} onChange={(e) => setNewGender(e.target.value as any)} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-900 dark:text-white focus:outline-hidden focus:border-rose-500">
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                Blood Group *
              </label>
              <select value={newBloodGroup} onChange={(e) => setNewBloodGroup(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-rose-600 dark:text-rose-400 focus:outline-hidden focus:border-rose-500">
                {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((bg) => (<option key={bg} value={bg}>
                    {bg}
                  </option>))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                Phone Number (Optional)
              </label>
              <input type="tel" placeholder="e.g. 9876543210" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-hidden focus:border-rose-500"/>
            </div>
          </div>

          <p className="text-[11px] text-slate-500 dark:text-slate-400 pt-1">
            Note: Initial password will be the first 4 letters of first name + birth year (e.g. <span className="font-mono font-bold text-slate-700 dark:text-slate-300">rame1990</span>).
          </p>

          <button type="submit" disabled={creating} className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-xs flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer">
            <PlusCircle className="w-4 h-4"/>
            {creating ? 'Creating Account...' : 'Create & Link Account'}
          </button>
        </form>)}
    </div>);
}
