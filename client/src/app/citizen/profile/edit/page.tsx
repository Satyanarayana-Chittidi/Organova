'use client';
import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { citizenApi } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import DateOfBirthInput from '@/components/DateOfBirthInput';
import { User, Phone, MapPin, Save, AlertCircle, ArrowRight, ArrowLeft, UserCheck, CheckCircle2, } from 'lucide-react';
function EditProfileContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const isFromSignup = searchParams.get('from') === 'signup';
    const { user, refreshUser, loading: authLoading } = useAuth();
    const [fullName, setFullName] = useState('');
    const [dateOfBirth, setDateOfBirth] = useState('');
    const [gender, setGender] = useState<'MALE' | 'FEMALE' | 'OTHER' | ''>('');
    const [bloodGroup, setBloodGroup] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [emergencyName, setEmergencyName] = useState('');
    const [emergencyPhone, setEmergencyPhone] = useState('');
    const [addressLine, setAddressLine] = useState('');
    const [city, setCity] = useState('');
    const [state, setState] = useState('');
    const [pincode, setPincode] = useState('');
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(true);
    const [error, setError] = useState<string | null>(null);
    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/auth/login');
            return;
        }
        const loadExistingProfile = async () => {
            try {
                const res = await citizenApi.getProfile();
                if (res.success && res.data) {
                    const p = res.data.profile || res.data;
                    if (p) {
                        if (p.full_name)
                            setFullName(p.full_name);
                        if (p.date_of_birth)
                            setDateOfBirth(String(p.date_of_birth).split('T')[0]);
                        if (p.gender)
                            setGender(p.gender);
                        if (p.blood_group)
                            setBloodGroup(p.blood_group);
                        if (p.phone_number)
                            setPhoneNumber(p.phone_number);
                        if (p.emergency_contact_name)
                            setEmergencyName(p.emergency_contact_name);
                        if (p.emergency_contact_phone)
                            setEmergencyPhone(p.emergency_contact_phone);
                        if (p.address_line)
                            setAddressLine(p.address_line);
                        if (p.city)
                            setCity(p.city);
                        if (p.state)
                            setState(p.state);
                        if (p.pincode)
                            setPincode(p.pincode);
                    }
                }
            }
            catch (err) {
            }
            finally {
                setFetching(false);
            }
        };
        if (user) {
            loadExistingProfile();
        }
    }, [user, authLoading, router]);
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (!dateOfBirth) {
            setError('Please enter your complete Date of Birth (dd/mm/yyyy).');
            return;
        }
        if (!gender) {
            setError('Please select your gender.');
            return;
        }
        if (!bloodGroup) {
            setError('Please select your blood group.');
            return;
        }
        setLoading(true);
        try {
            await citizenApi.saveProfile({
                full_name: fullName,
                date_of_birth: dateOfBirth,
                gender,
                blood_group: bloodGroup,
                phone_number: phoneNumber,
                emergency_contact_name: emergencyName,
                emergency_contact_phone: emergencyPhone,
                address_line: addressLine,
                city,
                state,
                pincode,
            });
            await refreshUser();
            if (isFromSignup) {
                router.push('/');
            }
            else {
                router.push('/citizen/profile');
            }
        }
        catch (err: any) {
            setError(err.message || 'Failed to save profile details.');
            setLoading(false);
        }
    };
    if (authLoading || fetching) {
        return (<div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="w-8 h-8 border-4 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"/>
        <p className="text-xs text-slate-500">Loading details...</p>
      </div>);
    }
    return (<div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 sm:p-10 transition-colors">

        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-100 dark:border-slate-800 gap-4 mb-6">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 text-xs font-semibold mb-2">
              {isFromSignup ? <UserCheck className="w-3.5 h-3.5"/> : <User className="w-3.5 h-3.5"/>}
              {isFromSignup ? 'Step 2 of 2: Profile Demographics (Required)' : 'Citizen Demographics'}
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              {isFromSignup ? 'Complete Additional Details' : 'Edit Additional Details'}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {isFromSignup
            ? 'Please complete your medical demographics and emergency contacts to activate your citizen account and donor eligibility.'
            : 'Update your medical demographics, emergency contacts, or residential address.'}
            </p>
          </div>

          {!isFromSignup && (<div className="flex items-center gap-2 self-start sm:self-auto">
              <Link href="/citizen/profile" className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold text-xs flex items-center gap-1.5 transition-colors">
                <ArrowLeft className="w-3.5 h-3.5"/>
                Back to Profile
              </Link>
            </div>)}
        </div>

        {error && (<div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-300 text-xs flex items-center gap-2 mb-6">
            <AlertCircle className="w-4 h-4 shrink-0"/>
            <span>{error}</span>
          </div>)}

        <form onSubmit={handleSubmit} className="space-y-6">

          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
              <User className="w-4 h-4 text-slate-500 dark:text-slate-400"/>
              1. Personal Identification
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Full Name</label>
                <input type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g. John Doe" className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white bg-white dark:bg-slate-800 placeholder:text-slate-400 dark:placeholder:text-slate-500 font-medium focus:outline-hidden focus:border-rose-500 focus:ring-1 focus:ring-rose-500/20"/>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Date of Birth <span className="text-[11px] text-slate-400 dark:text-slate-500 font-normal ml-1">(dd/mm/yyyy)</span>
                </label>
                <DateOfBirthInput value={dateOfBirth} onChange={setDateOfBirth} required/>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Gender</label>
                <select required value={gender} onChange={(e: any) => setGender(e.target.value)} className={`w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-800 focus:outline-hidden focus:border-rose-500 focus:ring-1 focus:ring-rose-500/20 ${gender ? 'text-slate-900 dark:text-white font-medium' : 'text-slate-400 dark:text-slate-500 font-normal is-placeholder'}`}>
                  <option value="" disabled className="text-slate-400 dark:text-slate-500 font-normal">
                    Select Gender
                  </option>
                  <option value="MALE" className="text-slate-900 dark:text-white font-medium">
                    Male
                  </option>
                  <option value="FEMALE" className="text-slate-900 dark:text-white font-medium">
                    Female
                  </option>
                  <option value="OTHER" className="text-slate-900 dark:text-white font-medium">
                    Other
                  </option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Blood Group</label>
                <select required value={bloodGroup} onChange={(e) => setBloodGroup(e.target.value)} className={`w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-800 focus:outline-hidden focus:border-rose-500 focus:ring-1 focus:ring-rose-500/20 ${bloodGroup ? 'text-slate-900 dark:text-white font-medium' : 'text-slate-400 dark:text-slate-500 font-normal is-placeholder'}`}>
                  <option value="" disabled className="text-slate-400 dark:text-slate-500 font-normal">
                    Select Blood Group
                  </option>
                  {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((bg) => (<option key={bg} value={bg} className="text-slate-900 dark:text-white font-medium">
                      {bg}
                    </option>))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Personal Phone Number</label>
                <input type="tel" required value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="+91-9876543210" className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white bg-white dark:bg-slate-800 placeholder:text-slate-400 dark:placeholder:text-slate-500 font-medium focus:outline-hidden focus:border-rose-500 focus:ring-1 focus:ring-rose-500/20"/>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
              <Phone className="w-4 h-4 text-slate-500 dark:text-slate-400"/>
              2. Emergency Next of Kin Contact
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Emergency Contact Full Name</label>
                <input type="text" required value={emergencyName} onChange={(e) => setEmergencyName(e.target.value)} placeholder="e.g. Jane Doe (Spouse / Parent)" className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white bg-white dark:bg-slate-800 placeholder:text-slate-400 dark:placeholder:text-slate-500 font-medium focus:outline-hidden focus:border-rose-500 focus:ring-1 focus:ring-rose-500/20"/>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Emergency Contact Phone</label>
                <input type="tel" required value={emergencyPhone} onChange={(e) => setEmergencyPhone(e.target.value)} placeholder="+91-9988776655" className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white bg-white dark:bg-slate-800 placeholder:text-slate-400 dark:placeholder:text-slate-500 font-medium focus:outline-hidden focus:border-rose-500 focus:ring-1 focus:ring-rose-500/20"/>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-slate-500 dark:text-slate-400"/>
              3. Permanent Residential Address
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Address Line</label>
                <input type="text" required value={addressLine} onChange={(e) => setAddressLine(e.target.value)} placeholder="Flat/House No., Street Name, Landmark" className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white bg-white dark:bg-slate-800 placeholder:text-slate-400 dark:placeholder:text-slate-500 font-medium focus:outline-hidden focus:border-rose-500 focus:ring-1 focus:ring-rose-500/20"/>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">City</label>
                <input type="text" required value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Mumbai" className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white bg-white dark:bg-slate-800 placeholder:text-slate-400 dark:placeholder:text-slate-500 font-medium focus:outline-hidden focus:border-rose-500 focus:ring-1 focus:ring-rose-500/20"/>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">State</label>
                <input type="text" required value={state} onChange={(e) => setState(e.target.value)} placeholder="e.g. Maharashtra" className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white bg-white dark:bg-slate-800 placeholder:text-slate-400 dark:placeholder:text-slate-500 font-medium focus:outline-hidden focus:border-rose-500 focus:ring-1 focus:ring-rose-500/20"/>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Pincode</label>
                <input type="text" required maxLength={6} value={pincode} onChange={(e) => setPincode(e.target.value)} placeholder="400001" className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white bg-white dark:bg-slate-800 placeholder:text-slate-400 dark:placeholder:text-slate-500 font-medium focus:outline-hidden focus:border-rose-500 focus:ring-1 focus:ring-rose-500/20"/>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
            <div>
              {!isFromSignup && (<Link href="/citizen/profile" className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold text-xs transition-colors flex items-center gap-1.5">
                  <ArrowLeft className="w-3.5 h-3.5"/>
                  Cancel
                </Link>)}
            </div>

            <button type="submit" disabled={loading} className={`px-6 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-500 hover:from-rose-500 hover:to-red-600 text-white font-semibold text-xs shadow-md shadow-rose-500/20 flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer ${isFromSignup ? 'ml-auto' : ''}`}>
              {isFromSignup ? <CheckCircle2 className="w-3.5 h-3.5"/> : <Save className="w-3.5 h-3.5"/>}
              {loading
            ? 'Saving...'
            : isFromSignup
                ? 'Save Details & Continue to Home'
                : 'Save Profile Changes'}
              {isFromSignup && <ArrowRight className="w-3.5 h-3.5"/>}
            </button>
          </div>
        </form>
      </div>
    </div>);
}
export default function EditCitizenProfilePage() {
    return (<Suspense fallback={<div className="max-w-4xl mx-auto px-4 py-16 text-center">
          <div className="w-8 h-8 border-4 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"/>
          <p className="text-xs text-slate-500">Loading profile editor...</p>
        </div>}>
      <EditProfileContent />
    </Suspense>);
}
