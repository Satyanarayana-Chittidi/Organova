'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { citizenApi, donorApi, getAvatarUrl } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import AvatarCropperModal from '@/components/AvatarCropperModal';
import OrganImage from '@/components/OrganImage';
import { FindBloodIcon } from '@/components/BloodIcons';
import {
  User,
  Mail,
  Phone,
  MapPin,
  Heart,
  Droplet,
  ShieldCheck,
  Edit3,
  Award,
  CreditCard,
  Plus,
  AlertCircle,
  Eye,
  Activity,
  CheckCircle2,
  X,
  UploadCloud,
  Trash2,
  Maximize2,
  Building2,
  ArrowRight,
  Clock,
  Calendar,
} from 'lucide-react';

export default function CitizenProfilePage() {
  const router = useRouter();
  const { user, refreshUser, loading: authLoading } = useAuth();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [profile, setProfile] = useState<any>(null);
  const [pledges, setPledges] = useState<any[]>([]);
  const [donationHistory, setDonationHistory] = useState<any>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [showCropperModal, setShowCropperModal] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const groupedPledges = React.useMemo(() => {
    const map = new Map<
      string,
      {
        id: number | string;
        organ_code: string;
        organ_name: string;
        category: string;
        hasLiving: boolean;
        hasDeceased: boolean;
      }
    >();

    for (const p of pledges) {
      const code = (p.organ_code || p.organ_name || '').toUpperCase();
      if (!code) continue;

      const isLiving = p.consent_type === 'LIVING' || p.consent_type === 'LIVING_ALLOWED';
      const isDeceased = p.consent_type === 'DECEASED' || p.consent_type === 'DECEASED_ONLY';

      if (!map.has(code)) {
        map.set(code, {
          id: p.id || code,
          organ_code: p.organ_code || code,
          organ_name: p.organ_name || code,
          category: p.category || 'ORGAN',
          hasLiving: isLiving,
          hasDeceased: isDeceased,
        });
      } else {
        const existing = map.get(code)!;
        if (isLiving) existing.hasLiving = true;
        if (isDeceased) existing.hasDeceased = true;
      }
    }

    return Array.from(map.values()).map((item) => {
      let consentLabel = 'Deceased Allowed';
      let badgeStyle = 'bg-rose-50 text-rose-700 border border-rose-200 font-semibold';

      if (item.hasLiving && item.hasDeceased) {
        consentLabel = 'Living & Deceased Allowed';
        badgeStyle = 'bg-emerald-50 text-emerald-800 border border-emerald-300 font-bold';
      } else if (item.hasLiving) {
        consentLabel = 'Living Allowed';
        badgeStyle = 'bg-blue-50 text-blue-700 border border-blue-200 font-semibold';
      } else {
        consentLabel = 'Deceased Allowed';
        badgeStyle = 'bg-rose-50 text-rose-700 border border-rose-200 font-semibold';
      }

      let displayName = item.organ_name || item.organ_code;
      if (item.organ_code === 'KIDNEY' || displayName.toLowerCase().includes('kidney')) {
        displayName = item.hasLiving && !item.hasDeceased ? 'Kidney' : 'Kidneys';
      } else if (item.organ_code === 'BLOOD' || displayName.toLowerCase().includes('blood')) {
        displayName = 'Blood';
      }

      return {
        ...item,
        organ_name: displayName,
        consentLabel,
        badgeStyle,
      };
    });
  }, [pledges]);

  const bloodTransactions = React.useMemo(() => {
    if (!donationHistory) return [];
    const donated = (donationHistory.bloodDonations || []).map((b: any) => ({
      id: `blood-donated-${b.id}`,
      originalId: b.id,
      category: 'DONATED' as const,
      bloodGroup: b.blood_group,
      component: b.component,
      units: b.units_requested,
      hospitalName: b.receiving_hospital_name,
      hospitalCity: b.receiving_hospital_city,
      patientRelationship: b.patient_relationship,
      patientName: b.patient_name,
      status: b.status,
      timestamp: b.fulfilled_at || b.created_at,
    }));
    const received = (donationHistory.bloodRequests || []).map((b: any) => ({
      id: `blood-received-${b.id}`,
      originalId: b.id,
      category: (b.status === 'COMPLETED'
        ? 'RECEIVED'
        : b.status === 'CANCELLED'
        ? 'CANCELLED'
        : 'REQUESTED') as 'RECEIVED' | 'CANCELLED' | 'REQUESTED',
      bloodGroup: b.blood_group,
      component: b.component,
      units: b.units_requested,
      hospitalName: b.destination_hub_name,
      hospitalCity: b.destination_hub_city,
      patientRelationship: b.patient_relationship,
      patientName: b.patient_name,
      status: b.status,
      timestamp: b.fulfilled_at || b.created_at,
      donorName: b.donor_name,
      donorPhone: b.donor_phone,
    }));
    return [...donated, ...received].sort(
      (a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [donationHistory]);

  const organTransactions = React.useMemo(() => {
    if (!donationHistory) return [];
    const donated = (donationHistory.organDonations || []).map((o: any) => ({
      id: `organ-donated-${o.id}`,
      originalId: o.id,
      category: 'DONATED' as const,
      organName: o.organ_name,
      organCode: o.organ_code,
      bloodGroup: o.blood_group,
      hospitalName: o.harvesting_hub_name,
      hospitalCity: o.harvesting_hub_city,
      status: o.status,
      matchStatus: o.match_status,
      recipientHospital: o.recipient_hospital_name,
      timestamp: o.harvested_at,
    }));
    const received = (donationHistory.organRequests || []).map((o: any) => ({
      id: `organ-received-${o.id}`,
      originalId: o.id,
      category: 'RECEIVED' as const,
      organName: o.organ_name,
      organCode: o.organ_code,
      bloodGroup: o.blood_group,
      hospitalName: o.attending_hub_name,
      hospitalCity: o.attending_hub_city,
      status: o.status,
      urgencyTier: o.urgency_tier,
      timestamp: o.created_at,
    }));
    return [...donated, ...received].sort(
      (a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [donationHistory]);

  const hasAnyHistory = bloodTransactions.length > 0 || organTransactions.length > 0;

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login');
      return;
    }

    const loadProfileAndPledges = async () => {
      try {
        setLoading(true);
        const [profileRes, pledgesRes, historyRes] = await Promise.allSettled([
          citizenApi.getProfile(),
          donorApi.getMyPledges(),
          citizenApi.getDonationHistory(),
        ]);

        if (profileRes.status === 'fulfilled' && profileRes.value?.success && profileRes.value.data) {
          const p = profileRes.value.data.profile || profileRes.value.data;
          if (p && (p.full_name || p.gender || p.blood_group)) {
            setProfile(p);
            setAvatarUrl(p.avatar_url || user?.avatar_url || null);
          } else {
            setProfile(null);
            setAvatarUrl(user?.avatar_url || null);
          }
        } else {
          setProfile(null);
          setAvatarUrl(user?.avatar_url || null);
        }

        if (pledgesRes.status === 'fulfilled' && pledgesRes.value?.success) {
          const pData = pledgesRes.value.data;
          const list = Array.isArray(pData?.pledges)
            ? pData.pledges
            : Array.isArray(pData)
            ? pData
            : [];
          setPledges(list);
        } else {
          setPledges([]);
        }

        if (historyRes.status === 'fulfilled' && historyRes.value?.success && historyRes.value.data) {
          setDonationHistory(historyRes.value.data);
        } else {
          setDonationHistory(null);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load citizen records.');
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      loadProfileAndPledges();
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showPhotoModal) {
        setShowPhotoModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showPhotoModal]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setError('Profile picture must be under 10MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setCropImageSrc(reader.result);
        setShowCropperModal(true);
        setError(null);
      }
    };
    reader.onerror = () => {
      setError('Failed to load the selected image.');
    };
    reader.readAsDataURL(file);

    e.target.value = '';
  };

  const handleCropComplete = async (croppedBlob: Blob) => {
    setUploadingAvatar(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('avatar', croppedBlob, 'avatar.jpg');
      const res = await citizenApi.uploadAvatar(formData);
      if (res.success && res.data?.avatar_url) {
        setAvatarUrl(res.data.avatar_url);
        await refreshUser();
        setShowCropperModal(false);
        setCropImageSrc(null);
      } else {
        setError(res.message || 'Failed to upload cropped photo.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to upload profile picture.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleRemoveAvatar = async () => {
    setUploadingAvatar(true);
    setError(null);
    try {
      await citizenApi.removeAvatar();
      setAvatarUrl(null);
      await refreshUser();
      setShowPhotoModal(false);
    } catch (err: any) {
      setError(err.message || 'Failed to remove profile picture.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const getOrganIcon = (code?: string) => {
    return <OrganImage organ={code} size="md" showContainer={false} className="shrink-0" />;
  };

  const calculateAge = (dobString?: string) => {
    if (!dobString) return 'Not provided';
    const birthDate = new Date(dobString);
    if (isNaN(birthDate.getTime())) return 'Not provided';
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return `${age} Years`;
  };

  if (authLoading || loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="w-8 h-8 border-4 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs text-slate-500">Loading citizen profile...</p>
      </div>
    );
  }

  const fullName = profile?.full_name || '';
  const dateOfBirth = profile?.date_of_birth ? String(profile.date_of_birth).split('T')[0] : '';
  const gender = profile?.gender || '';
  const bloodGroup = profile?.blood_group || '';
  const phoneNumber = profile?.phone_number || '';
  const emergencyName = profile?.emergency_contact_name || '';
  const emergencyPhone = profile?.emergency_contact_phone || '';
  const addressLine = profile?.address_line || '';
  const city = profile?.city || '';
  const state = profile?.state || '';
  const pincode = profile?.pincode || '';

  const hasCompleteDetails = Boolean(fullName && bloodGroup && gender);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full transition-colors duration-200 space-y-8">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleAvatarChange}
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
        />

        {error && (
          <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-300 text-xs flex items-center gap-2 mb-6">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-800 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-8 shadow-sm">
          <div className="flex items-center gap-4">
            <div
              onClick={() => setShowPhotoModal(true)}
              className="relative group shrink-0 cursor-pointer rounded-full transition-transform hover:scale-105 active:scale-95"
              title="Click to view or change profile photo"
            >
              {avatarUrl ? (
                <img
                  src={getAvatarUrl(avatarUrl)!}
                  alt={fullName || 'Avatar'}
                  className="w-16 h-16 rounded-full object-cover shadow-md shrink-0 border-2 border-white/20 group-hover:ring-2 group-hover:ring-rose-400 transition-all"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-rose-600 text-white flex items-center justify-center font-black text-2xl shadow-md shrink-0 group-hover:ring-2 group-hover:ring-rose-400 transition-all">
                  {fullName ? fullName.charAt(0).toUpperCase() : (user?.email?.charAt(0).toUpperCase() || 'U')}
                </div>
              )}

              <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <Maximize2 className="w-5 h-5 text-white" />
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold text-white">{fullName || 'Registered Citizen'}</h2>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30">
                  <ShieldCheck className="w-3 h-3" />
                  VERIFIED CITIZEN
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-300 mt-1 font-mono">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                <span>{user?.email}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 divide-x divide-slate-700/80">
            <div className="text-left sm:text-right pr-4">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 block font-semibold">Active Pledges</span>
              <span className="text-xl font-black text-white block leading-tight">{groupedPledges.length} Organs</span>
            </div>
            <div className="pl-4">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 block font-semibold">Blood Group</span>
              <span className="text-2xl font-black text-rose-400 block leading-tight">{bloodGroup || '—'}</span>
            </div>
          </div>
        </div>

        <div className="mb-8">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 transition-colors">
                <Award className="w-4 h-4 text-amber-500" />
                Donor Pledges Registered ({groupedPledges.length})
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Official legal consent recorded on the matching registry</p>
            </div>

            <div className="flex items-center gap-2">
              {groupedPledges.length > 0 && (
                <Link
                  href="/donor/card"
                  className="px-3.5 py-1.5 rounded-xl bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm transition-all"
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  Donor Card
                </Link>
              )}

              <Link
                href="/donor/pledge"
                className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm transition-all"
              >
                <Award className="w-3.5 h-3.5" />
                Pledges
              </Link>
            </div>
          </div>

          {groupedPledges.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {groupedPledges.map((p) => (
                <div
                  key={p.organ_code}
                  className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/80 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between gap-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <OrganImage
                        organ={p.organ_code || p.organ_name}
                        size="md"
                        showContainer={false}
                        className="w-12 h-12 shrink-0 drop-shadow-xs select-none pointer-events-none"
                      />
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                          {p.organ_name || p.organ_code}
                        </h4>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-semibold">
                          {p.category || 'ORGAN'}
                        </span>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold border border-emerald-200 dark:border-emerald-800/60 shrink-0">
                      <CheckCircle2 className="w-2.5 h-2.5" />
                      ACTIVE
                    </span>
                  </div>

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-[11px]">
                    <span className="text-slate-500 dark:text-slate-400">Consent:</span>
                    <span
                      className={`font-semibold px-2 py-0.5 rounded text-[10px] ${p.badgeStyle}`}
                    >
                      {p.consentLabel}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 text-center">
              <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto mb-2.5">
                <Heart className="w-5 h-5 fill-rose-500/20" />
              </div>
              <h4 className="text-xs font-bold text-slate-900 dark:text-white">No Organ Pledges Recorded Yet</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1 mb-4">
                Pledging your organs takes less than 60 seconds and can save up to 8 lives.
              </p>
              <Link
                href="/donor/pledge"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs shadow-sm transition-all"
              >
                <Award className="w-3.5 h-3.5" />
                Pledge Organs Now
              </Link>
            </div>
          )}
        </div>

        <div className="mb-8">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <User className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                Additional Details
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Emergency contacts and verification demographics</p>
            </div>

            {hasCompleteDetails && (
              <Link
                href="/citizen/profile/edit"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors"
              >
                <Edit3 className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                Edit Details
              </Link>
            )}
          </div>

          {!hasCompleteDetails ? (
            <Link
              href="/citizen/profile/edit"
              className="group flex flex-col items-center justify-center p-8 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-rose-400 dark:hover:border-rose-500 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-rose-50/30 dark:hover:bg-rose-950/20 transition-all text-center cursor-pointer block"
            >
              <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 group-hover:border-rose-300 text-rose-600 dark:text-rose-400 flex items-center justify-center shadow-xs mb-3 group-hover:scale-110 transition-transform">
                <Plus className="w-6 h-6 stroke-[2.5]" />
              </div>
              <p className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors">
                Click to give additional details
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                Add your blood group, date of birth, emergency contact, and residential address
              </p>
            </Link>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-6 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                  Personal Information
                </h4>
                <div className="divide-y divide-slate-200/70 dark:divide-slate-700/60 text-xs">
                  <div className="py-2.5 flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Full Name:</span>
                    <span className="font-semibold text-slate-900 dark:text-white">{fullName}</span>
                  </div>
                  <div className="py-2.5 flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Age:</span>
                    <span className="font-semibold text-slate-900 dark:text-white">{calculateAge(dateOfBirth)}</span>
                  </div>
                  <div className="py-2.5 flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Gender:</span>
                    <span className="font-semibold text-slate-900 dark:text-white capitalize">{gender.toLowerCase()}</span>
                  </div>
                  <div className="py-2.5 flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Blood Group:</span>
                    <span className="font-bold text-rose-700 dark:text-rose-400 font-mono">{bloodGroup}</span>
                  </div>
                  <div className="py-2.5 flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Contact Phone:</span>
                    <span className="font-semibold text-slate-900 dark:text-white">{phoneNumber || 'Not provided'}</span>
                  </div>
                </div>
              </div>

              <div className="p-6 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-rose-500" />
                  Emergency Next-of-Kin Contact
                </h4>
                <div className="divide-y divide-slate-200/70 dark:divide-slate-700/60 text-xs">
                  <div className="py-2.5 flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Contact Person:</span>
                    <span className="font-semibold text-slate-900 dark:text-white">{emergencyName}</span>
                  </div>
                  <div className="py-2.5 flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Emergency Phone:</span>
                    <span className="font-semibold text-rose-600 dark:text-rose-400 font-mono">{emergencyPhone}</span>
                  </div>
                  <div className="py-2 text-[11px] text-slate-400 dark:text-slate-500 italic">
                    Essential for family coordination during donor verification and emergency care.
                  </div>
                </div>
              </div>

              <div className="md:col-span-2 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-blue-500" />
                  Permanent Residential Address
                </h4>
                <p className="text-xs text-slate-900 dark:text-slate-200 font-medium">
                  {addressLine ? `${addressLine}, ` : ''}
                  {city ? `${city}, ` : ''}
                  {state ? `${state} ` : ''}
                  {pincode ? `- ${pincode}` : 'Not provided'}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-xs transition-colors space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 dark:bg-rose-950/60 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
                <Droplet className="w-5 h-5 fill-current" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    Blood Transactions History
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50">
                    {bloodTransactions.length}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Voluntary blood donations fulfilled & emergency requisitions requested.
                </p>
              </div>
            </div>

            <Link
              href="/citizen/history?type=blood"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 hover:text-rose-600 dark:hover:text-rose-400 text-xs font-semibold transition-colors self-start sm:self-auto cursor-pointer"
            >
              View Full History Ledger
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-0.5">
                Units Donated
              </span>
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-bold text-slate-900 dark:text-white">
                  {donationHistory?.stats?.totalBloodUnitsDonated || 0}
                </span>
                <span className="text-[11px] text-slate-500">Units</span>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-0.5">
                Requisitions Posted
              </span>
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-bold text-slate-900 dark:text-white">
                  {donationHistory?.stats?.totalBloodRequested || 0}
                </span>
                <span className="text-[11px] text-slate-500">Orders</span>
              </div>
            </div>

            <div className="col-span-2 sm:col-span-1 p-3.5 rounded-2xl bg-rose-50/60 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/40 flex flex-col justify-center">
              <span className="text-[11px] font-semibold text-rose-800 dark:text-rose-300 block mb-0.5">
                Breakdown
              </span>
              <span className="text-xs font-bold text-rose-700 dark:text-rose-400">
                {bloodTransactions.filter((b: any) => b.category === 'DONATED').length} Donated •{' '}
                {bloodTransactions.filter((b: any) => b.category === 'REQUESTED').length} Requested •{' '}
                {bloodTransactions.filter((b: any) => b.category === 'RECEIVED').length} Received
                {bloodTransactions.some((b: any) => b.category === 'CANCELLED') && (
                  <> • {bloodTransactions.filter((b: any) => b.category === 'CANCELLED').length} Cancelled</>
                )}
              </span>
            </div>
          </div>

          {bloodTransactions.length > 0 ? (
            <div className="space-y-3">
              {bloodTransactions.slice(0, 3).map((item: any) => (
                <div
                  key={item.id}
                  className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-start sm:items-center gap-3">
                    <OrganImage
                      organ="BLOOD"
                      size="md"
                      showContainer={false}
                      className="w-11 h-11 shrink-0 drop-shadow-xs mt-0.5 sm:mt-0 select-none pointer-events-none"
                    />
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide ${
                            item.category === 'DONATED'
                              ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                              : item.category === 'CANCELLED'
                              ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                              : item.category === 'RECEIVED'
                              ? 'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                              : 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                          }`}
                        >
                          {item.category === 'DONATED'
                            ? (item.status === 'DONOR_COMMITTED' ? 'Donated (En Route)' : 'Donated')
                            : item.category === 'CANCELLED'
                            ? 'Cancelled'
                            : item.category === 'RECEIVED'
                            ? 'Received'
                            : 'Requested'}
                        </span>
                        <span className="font-bold text-slate-900 dark:text-white text-xs">
                          {item.units} Unit(s) • {item.bloodGroup} ({item.component?.replace(/_/g, ' ') || 'Whole Blood'})
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            item.status === 'COMPLETED'
                              ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                              : item.status === 'DONOR_COMMITTED'
                              ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300'
                              : item.status === 'APPROVED'
                              ? 'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300'
                              : item.status === 'CANCELLED'
                              ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                              : 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300'
                          }`}
                        >
                          {item.status === 'COMPLETED'
                            ? 'Transfusion Completed'
                            : item.status === 'DONOR_COMMITTED'
                            ? 'Donor Committed / En Route'
                            : item.status === 'APPROVED'
                            ? 'Reserved in Blood Bank'
                            : item.status === 'REQUESTED'
                            ? 'Awaiting Volunteer Donor'
                            : item.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Building2 className="w-3 h-3 text-slate-400" />
                          Hospital: {item.hospitalName} {item.hospitalCity ? `(${item.hospitalCity})` : ''}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          {new Date(item.timestamp).toLocaleDateString()}
                        </span>

                        {(item.patientRelationship || item.patientName) && (
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded flex items-center gap-1 font-medium">
                            <User className="w-2.5 h-2.5 text-rose-500" />
                            For: <strong className="capitalize">{item.patientRelationship?.toLowerCase() === 'self' ? 'Myself' : (item.patientRelationship || 'Patient')}</strong>
                            {item.patientName ? ` (${item.patientName})` : ''}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  <Link
                    href={`/blood/donate/${item.originalId}?from=history`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 self-end sm:self-center shrink-0"
                  >
                    Details →
                  </Link>
                </div>
              ))}

              {bloodTransactions.length > 3 && (
                <div className="pt-2 text-center">
                  <Link
                    href="/citizen/history?type=blood"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-600 dark:text-rose-400 hover:underline"
                  >
                    View All {bloodTransactions.length} Blood Transactions
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <div className="p-8 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 text-center">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto mb-3">
                <Droplet className="w-6 h-6 fill-rose-500/20" />
              </div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                No Blood Transactions Recorded Yet
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1 mb-4">
                You haven&apos;t participated in any blood donation drives or submitted emergency blood orders yet.
              </p>
              <div className="flex items-center justify-center gap-3 flex-wrap">
                <Link
                  href="/blood-finder"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs shadow-sm transition-all"
                >
                  <FindBloodIcon className="w-3.5 h-3.5" />
                  View Urgent Emergencies
                </Link>
                <Link
                  href="/blood/emergency"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-xs transition-colors"
                >
                  <Droplet className="w-3.5 h-3.5 text-rose-500" />
                  Request Blood
                </Link>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-xs transition-colors space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    Organ Transplant History
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/50">
                    {organTransactions.length}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Donated organs matched for clinical transplantation & recipient waitlist records.
                </p>
              </div>
            </div>

            <Link
              href="/citizen/history?type=organ"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 hover:text-emerald-600 dark:hover:text-emerald-400 text-xs font-semibold transition-colors self-start sm:self-auto cursor-pointer"
            >
              View Full History Ledger
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-0.5">
                Organs Donated
              </span>
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-bold text-slate-900 dark:text-white">
                  {donationHistory?.stats?.totalOrgansDonated || 0}
                </span>
                <span className="text-[11px] text-slate-500">Organs</span>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-0.5">
                Active Pledges
              </span>
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-bold text-slate-900 dark:text-white">
                  {groupedPledges.length}
                </span>
                <span className="text-[11px] text-slate-500">Pledged</span>
              </div>
            </div>
          </div>

          {organTransactions.length > 0 ? (
            <div className="space-y-3">
              {organTransactions.slice(0, 3).map((item: any) => (
                <div
                  key={item.id}
                  className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-start sm:items-center gap-3">
                    <OrganImage
                      organ={item.organCode || item.organName}
                      size="md"
                      showContainer={false}
                      className="w-11 h-11 shrink-0 drop-shadow-xs mt-0.5 sm:mt-0 select-none pointer-events-none"
                    />
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide ${
                            item.category === 'DONATED'
                              ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                              : 'bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                          }`}
                        >
                          {item.category === 'DONATED' ? 'Donated' : 'Transplant Candidate (Recipient)'}
                        </span>
                        <span className="font-bold text-slate-900 dark:text-white text-xs">
                          {item.organName} ({item.bloodGroup})
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            item.status === 'TRANSPLANTED' || item.status === 'FULFILLED'
                              ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                              : item.status === 'ACCEPTED' || item.status === 'ALLOCATED'
                              ? 'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300'
                              : item.status === 'MATCH_OFFERED' || item.status === 'IN_TRANSIT'
                              ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300'
                              : item.status === 'WAITING_LIST'
                              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/50'
                              : item.status === 'SURGERY_SCHEDULED'
                              ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300'
                              : item.status === 'AVAILABLE'
                              ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {item.status === 'TRANSPLANTED'
                            ? 'Donated & Transplanted'
                            : item.status === 'FULFILLED'
                            ? 'Transplant Received (Completed)'
                            : item.status === 'ACCEPTED'
                            ? 'Transplant Scheduled'
                            : item.status === 'SURGERY_SCHEDULED'
                            ? 'Surgery Scheduled'
                            : item.status === 'MATCH_OFFERED'
                            ? 'Match Offer Under Review'
                            : item.status === 'WAITING_LIST'
                            ? 'On Active Waitlist'
                            : item.status === 'PENDING_VERIFICATION'
                            ? 'Pending Verification'
                            : item.status === 'AVAILABLE'
                            ? 'Donated — In Cold Storage'
                            : item.status === 'ALLOCATED'
                            ? 'Allocated for Transplant'
                            : item.status === 'IN_TRANSIT'
                            ? 'In Transit'
                            : item.status === 'DELIVERED'
                            ? 'Delivered to Hospital'
                            : item.status === 'CANCELLED'
                            ? 'Waitlist Cancelled'
                            : item.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Building2 className="w-3 h-3 text-slate-400" />
                          {item.category === 'DONATED' ? 'Donation Hospital:' : 'Transplant Hospital:'} {item.hospitalName}{' '}
                          {item.hospitalCity ? `(${item.hospitalCity})` : ''}
                        </span>
                        {item.recipientHospital && (
                          <>
                            <span>•</span>
                            <span>Allocated to: {item.recipientHospital}</span>
                          </>
                        )}
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          {new Date(item.timestamp).toLocaleDateString()}
                        </span>

                        {(item.patientRelationship || item.patientName) && (
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded flex items-center gap-1 font-medium">
                            <User className="w-2.5 h-2.5 text-rose-500" />
                            For: <strong className="capitalize">{item.patientRelationship?.toLowerCase() === 'self' ? 'Myself' : (item.patientRelationship || 'Patient')}</strong>
                            {item.patientName ? ` (${item.patientName})` : ''}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  <Link
                    href={`/transplant/record/${item.originalId}?type=${item.category === 'RECEIVED' ? 'request' : 'donation'}&from=profile`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 self-end sm:self-center shrink-0"
                  >
                    Details →
                  </Link>
                </div>
              ))}

              {organTransactions.length > 3 && (
                <div className="pt-2 text-center">
                  <Link
                    href="/citizen/history?type=organ"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                  >
                    View All {organTransactions.length} Organ Records
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <div className="p-8 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 text-center">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-3">
                <Activity className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                No Organ or Transplant Records Yet
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1 mb-4">
                You have no donated organs or active recipient transplant cases on file.
              </p>
              <div className="flex items-center justify-center gap-3 flex-wrap">
                <Link
                  href="/donor/pledge"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-sm transition-all"
                >
                  <Award className="w-3.5 h-3.5" />
                  Pledge Your Organs
                </Link>
                <Link
                  href="/transplant/waitlist-status"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-xs transition-colors"
                >
                  <Clock className="w-3.5 h-3.5 text-emerald-500" />
                  Check Recipient Waitlist
                </Link>
              </div>
            </div>
          )}
        </div>

      {showPhotoModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200 select-none"
          onClick={() => !uploadingAvatar && setShowPhotoModal(false)}
        >
          <button
            type="button"
            disabled={uploadingAvatar}
            onClick={() => setShowPhotoModal(false)}
            className="absolute top-6 right-6 p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer disabled:opacity-50"
            title="Close"
          >
            <X className="w-6 h-6" />
          </button>

          <div
            className="flex flex-col items-center justify-center gap-6 max-w-sm w-full animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative w-64 h-64 sm:w-72 sm:h-72 rounded-full overflow-hidden border-4 border-white/25 shadow-2xl ring-4 ring-black/40 flex items-center justify-center bg-slate-900">
              {avatarUrl ? (
                <img
                  src={getAvatarUrl(avatarUrl)!}
                  alt={fullName || 'Profile Picture'}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-tr from-rose-600 to-red-500 text-white flex items-center justify-center font-black text-7xl">
                  {fullName ? fullName.charAt(0).toUpperCase() : (user?.email?.charAt(0).toUpperCase() || 'U')}
                </div>
              )}

              {uploadingAvatar && (
                <div className="absolute inset-0 bg-black/75 backdrop-blur-xs flex flex-col items-center justify-center text-white gap-2">
                  <div className="w-10 h-10 border-3 border-white border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs font-semibold">Updating photo...</span>
                </div>
              )}
            </div>

            <div className="text-center text-white">
              <h3 className="text-lg font-bold tracking-tight">{fullName || 'Citizen Profile Photo'}</h3>
              <p className="text-xs text-white/70 font-mono mt-0.5">{user?.email}</p>
            </div>

            <div className="flex items-center justify-center gap-3 w-full">
              <button
                type="button"
                disabled={uploadingAvatar}
                onClick={() => fileInputRef.current?.click()}
                className="px-6 py-2.5 rounded-full bg-white hover:bg-slate-100 text-slate-900 font-semibold text-xs shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                <UploadCloud className="w-4 h-4 text-slate-800" />
                {avatarUrl ? 'Upload New' : 'Upload Photo'}
              </button>

              {avatarUrl && (
                <button
                  type="button"
                  disabled={uploadingAvatar}
                  onClick={handleRemoveAvatar}
                  className="px-6 py-2.5 rounded-full bg-white/10 hover:bg-red-500/20 text-white hover:text-red-300 border border-white/20 hover:border-red-400 font-semibold text-xs backdrop-blur-md flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                  Remove
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      <AvatarCropperModal
        isOpen={showCropperModal}
        imageSrc={cropImageSrc}
        onClose={() => {
          setShowCropperModal(false);
          setCropImageSrc(null);
        }}
        onCropComplete={handleCropComplete}
        isUploading={uploadingAvatar}
      />
    </div>
  );
}
