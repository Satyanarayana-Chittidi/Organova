'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { hubApi } from '@/lib/api';
import { Hospital, Building2, ShieldCheck, MapPin, Phone, Mail, Lock, FileText, AlertCircle, CheckCircle2, ArrowRight, } from 'lucide-react';
export default function HubRegisterPage() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [hubType] = useState<'HOSPITAL'>('HOSPITAL');
    const [name, setName] = useState('');
    const [licenseNumber, setLicenseNumber] = useState('');
    const [contactPhone, setContactPhone] = useState('');
    const [addressLine, setAddressLine] = useState('');
    const [city, setCity] = useState('');
    const [state, setState] = useState('');
    const [pincode, setPincode] = useState('');
    const [latitude, setLatitude] = useState('17.4325');
    const [longitude, setLongitude] = useState('78.4071');
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);
        try {
            await hubApi.register({
                email,
                password,
                hub_type: hubType,
                name,
                license_number: licenseNumber,
                contact_phone: contactPhone,
                address_line: addressLine,
                city,
                state,
                pincode,
                latitude: parseFloat(latitude),
                longitude: parseFloat(longitude),
            });
            setSubmitted(true);
        }
        catch (err: any) {
            setError(err.message || 'Registration failed. Check if license or email already exists.');
        }
        finally {
            setLoading(false);
        }
    };
    return (<div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 w-full">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 sm:p-10 transition-colors">
        <div className="text-center max-w-lg mx-auto mb-8">
          <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center mx-auto mb-3 shadow-md shadow-blue-500/20">
            <Hospital className="w-6 h-6"/>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Institutional Onboarding Dossier
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Register your Hospital or Medical Center on the organ donation and matching platform.
          </p>
        </div>

        {error && (<div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-300 text-xs flex items-center gap-2 mb-6">
            <AlertCircle className="w-4 h-4 shrink-0"/>
            <span>{error}</span>
          </div>)}

        {submitted ? (<div className="p-8 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6"/>
            </div>
            <h3 className="text-lg font-bold text-emerald-900 dark:text-emerald-200">Application Submitted for Platform Verification</h3>
            <p className="text-xs text-emerald-700 dark:text-emerald-300 max-w-md mx-auto leading-relaxed">
              Your facility application has been registered with status <strong>PENDING_APPROVAL</strong>. Once platform administrators verify your accreditation credentials, you can sign in to coordinate inventory and matching.
            </p>
            <Link href="/auth/login" className="inline-block px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs transition-colors">
              Sign In to Your Account
            </Link>
          </div>) : (<form onSubmit={handleSubmit} className="space-y-6">

            <div className="p-3.5 rounded-2xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-900/50 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
                <Hospital className="w-5 h-5"/>
              </div>
              <div>
                <span className="text-xs font-bold text-blue-950 dark:text-blue-200 block">
                  Accredited Hospital & Medical Center
                </span>
                <span className="text-[11px] text-blue-800/80 dark:text-blue-300/80 block">
                  Integrated facility management for organ procurement, transplantation, and blood banking
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Official Facility Name</label>
                <input type="text" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Apollo Multi-Specialty Hospital" className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white bg-white dark:bg-slate-800 placeholder:text-slate-400 dark:placeholder:text-slate-500 font-medium focus:outline-hidden focus:border-blue-500"/>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Medical License / Accreditation Number</label>
                <input type="text" required value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} placeholder="e.g. NABH-TX-2026-081" className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white bg-white dark:bg-slate-800 placeholder:text-slate-400 dark:placeholder:text-slate-500 font-mono uppercase focus:outline-hidden focus:border-blue-500"/>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Official Contact Phone</label>
                <input type="tel" required value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="+91-11-26588500" className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white bg-white dark:bg-slate-800 placeholder:text-slate-400 dark:placeholder:text-slate-500 font-medium focus:outline-hidden focus:border-blue-500"/>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
              <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-3 uppercase tracking-wider">
                Institutional Coordinator Login Credentials
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Official Coordinator Email</label>
                  <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="coordinator@hospital.org" className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white bg-white dark:bg-slate-800 placeholder:text-slate-400 dark:placeholder:text-slate-500 font-medium focus:outline-hidden focus:border-blue-500"/>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Account Password</label>
                  <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white bg-white dark:bg-slate-800 placeholder:text-slate-400 dark:placeholder:text-slate-500 font-medium focus:outline-hidden focus:border-blue-500"/>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
              <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-3 uppercase tracking-wider">
                Physical Location & Haversine Distance Coordinates
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-3">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Address Line</label>
                  <input type="text" required value={addressLine} onChange={(e) => setAddressLine(e.target.value)} placeholder="Street, Campus, Sector" className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white bg-white dark:bg-slate-800 placeholder:text-slate-400 dark:placeholder:text-slate-500 font-medium focus:outline-hidden focus:border-blue-500"/>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">City</label>
                  <input type="text" required value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Hyderabad" className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white bg-white dark:bg-slate-800 placeholder:text-slate-400 dark:placeholder:text-slate-500 font-medium focus:outline-hidden focus:border-blue-500"/>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">State</label>
                  <input type="text" required value={state} onChange={(e) => setState(e.target.value)} placeholder="e.g. Telangana" className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white bg-white dark:bg-slate-800 placeholder:text-slate-400 dark:placeholder:text-slate-500 font-medium focus:outline-hidden focus:border-blue-500"/>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Pincode</label>
                  <input type="text" required value={pincode} onChange={(e) => setPincode(e.target.value)} placeholder="500001" className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white bg-white dark:bg-slate-800 placeholder:text-slate-400 dark:placeholder:text-slate-500 font-medium focus:outline-hidden focus:border-blue-500"/>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Latitude</label>
                  <input type="number" step="any" required value={latitude} onChange={(e) => setLatitude(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white bg-white dark:bg-slate-800 placeholder:text-slate-400 dark:placeholder:text-slate-500 font-medium focus:outline-hidden focus:border-blue-500"/>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Longitude</label>
                  <input type="number" step="any" required value={longitude} onChange={(e) => setLongitude(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white bg-white dark:bg-slate-800 placeholder:text-slate-400 dark:placeholder:text-slate-500 font-medium focus:outline-hidden focus:border-blue-500"/>
                </div>
              </div>
            </div>

            <button type="submit" disabled={loading} className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer">
              <ShieldCheck className="w-5 h-5"/>
              {loading ? 'Submitting Application...' : 'Submit Institutional Registration'}
            </button>
          </form>)}
      </div>
    </div>);
}
