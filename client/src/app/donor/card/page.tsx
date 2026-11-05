'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { donorApi, getAvatarUrl } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import OrganImage from '@/components/OrganImage';
import { Heart, Award, ShieldCheck, Printer, ArrowLeft, Phone, Droplet, User, AlertCircle, } from 'lucide-react';
export default function DigitalDonorCardPage() {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const [card, setCard] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [errorCode, setErrorCode] = useState<string | null>(null);
    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/auth/login');
            return;
        }
        const fetchCard = async () => {
            try {
                const res = await donorApi.getDonorCard();
                if (res.success && res.data) {
                    setCard(res.data);
                }
            }
            catch (err: any) {
                setError(err.message || 'Please complete your citizen profile to generate your donor card.');
                setErrorCode(err.data?.code || null);
            }
            finally {
                setLoading(false);
            }
        };
        if (user)
            fetchCard();
    }, [user, authLoading, router]);
    const handlePrint = () => {
        window.print();
    };
    if (loading) {
        return (<div className="flex-1 flex items-center justify-center p-12 text-slate-500 dark:text-slate-400 text-sm">
        Generating official Digital Donor Card...
      </div>);
    }
    const isNoPledges = errorCode === 'NO_PLEDGES' ||
        (error && /no active pledges|pledge at least one organ|no pledges/i.test(error));
    if (isNoPledges) {
        return (<div className="max-w-xl mx-auto py-16 px-4">
        <div className="p-8 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs text-center transition-colors space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
            <Heart className="w-7 h-7 fill-rose-500/20"/>
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            No Organ Pledges Recorded Yet
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
            Pledging your organs takes less than 60 seconds and can save up to 8 lives. Please pledge at least one organ to generate your official Digital Donor Card.
          </p>
          <div className="pt-2">
            <Link href="/donor/pledge" className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-500 hover:from-rose-500 hover:to-red-600 text-white font-semibold text-xs shadow-md shadow-rose-500/20 transition-all cursor-pointer">
              <Award className="w-4 h-4"/>
              Pledge Organs Now
            </Link>
          </div>
        </div>
      </div>);
    }
    if (error || !card) {
        return (<div className="max-w-xl mx-auto py-16 px-4">
        <div className="p-8 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs text-center transition-colors space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
            <AlertCircle className="w-7 h-7"/>
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Incomplete Profile Details</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
            {error || 'You need to complete your profile with an emergency next-of-kin contact before issuing your card.'}
          </p>
          <div className="pt-2">
            <Link href="/citizen/profile/edit" className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs shadow-md shadow-rose-500/20 transition-all">
              Complete Profile Now
            </Link>
          </div>
        </div>
      </div>);
    }
    const rawPledges = Array.isArray(card.pledges) ? card.pledges : [];
    const livingPledges = rawPledges.filter((p: any) => p.consent_type === 'LIVING' ||
        p.consent_type === 'LIVING_ALLOWED' ||
        p.consentType === 'LIVING' ||
        p.consentType === 'LIVING_ALLOWED');
    const deceasedPledges = rawPledges.filter((p: any) => p.consent_type === 'DECEASED' ||
        p.consent_type === 'DECEASED_ONLY' ||
        p.consentType === 'DECEASED' ||
        p.consentType === 'DECEASED_ONLY');
    const formatPledgeName = (p: any, type: 'LIVING' | 'DECEASED') => {
        const name = p.organ_name || p.organName || '';
        const code = (p.organ_code || p.organCode || name).toUpperCase();
        if (code.includes('KIDNEY')) {
            return type === 'LIVING' ? 'Kidney' : 'Kidneys';
        }
        if (code.includes('BLOOD') || name.toLowerCase().includes('blood')) {
            return 'Blood';
        }
        return name;
    };
    return (<div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 w-full">
      <div className="flex items-center justify-between mb-8 print:hidden">
        <Link href="/donor/pledge" className="text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center gap-1.5 transition-colors">
          <ArrowLeft className="w-4 h-4"/>
          Back to Pledge Directive
        </Link>

        <button onClick={handlePrint} className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:border dark:border-slate-700 text-white font-semibold text-xs flex items-center gap-2 shadow-xs transition-all cursor-pointer">
          <Printer className="w-4 h-4"/>
          Print / Save Official Card
        </button>
      </div>

      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 text-white rounded-3xl p-6 sm:p-10 shadow-2xl border border-slate-700/60 relative overflow-hidden print:border-black print:text-black print:bg-white print:shadow-none">

        <div className="absolute -right-16 -bottom-16 w-80 h-80 rounded-full bg-rose-600/10 blur-3xl pointer-events-none"></div>

        <div className="flex items-start justify-between border-b border-slate-700/80 pb-6 mb-6">
          <div className="flex items-center gap-3.5">
            <div className="w-14 h-14 rounded-2xl bg-white border border-slate-700 p-0 shadow-md flex items-center justify-center overflow-hidden shrink-0">
              <img src="/images/logo.png" alt="Organova Logo" className="w-full h-full object-contain"/>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold tracking-widest text-amber-400 block">
                Organova • National Donor Registry
              </span>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                Digital Donor Card
              </h2>
            </div>
          </div>

          <div className="text-right">
            <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30">
              <ShieldCheck className="w-3 h-3"/>
              VERIFIED PLEDGE
            </div>
            <span className="text-[10px] font-mono text-slate-400 block mt-1">
              ID: {card.donor_card_id || card.donorRegistryId}
            </span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-6 mb-6 pb-6 border-b border-slate-700/80">

          {(card.avatar_url || card.avatarUrl) ? (<img src={getAvatarUrl(card.avatar_url || card.avatarUrl)!} alt={card.full_name || card.fullName} className="w-20 h-20 rounded-2xl object-cover border-2 border-white/30 shadow-md shrink-0"/>) : (<div className="w-20 h-20 rounded-2xl bg-rose-600/30 border border-rose-500/40 text-rose-300 flex items-center justify-center font-black text-2xl shrink-0">
              {(card.full_name || card.fullName || 'D').charAt(0).toUpperCase()}
            </div>)}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 flex-1">
            <div>
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Donor Full Name</span>
              <span className="text-sm font-bold text-white block mt-0.5">{card.full_name || card.fullName}</span>
            </div>

            <div>
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Blood Group</span>
              <span className="text-base font-black text-rose-400 block mt-0.5">{card.blood_group || card.bloodGroup}</span>
            </div>

            <div>
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Date of Birth</span>
              <span className="text-xs font-semibold text-slate-200 block mt-0.5">
                {(card.date_of_birth || card.dateOfBirth) ? String(card.date_of_birth || card.dateOfBirth).split('T')[0] : 'N/A'}
              </span>
            </div>

            <div>
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Gender</span>
              <span className="text-xs font-semibold text-slate-200 block mt-0.5">{card.gender}</span>
            </div>
          </div>
        </div>

        <div className="space-y-4 mb-6 pb-6 border-b border-slate-700/80">
          {livingPledges.length > 0 && (<div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 block mb-2">
                • Living Donation Directives (Permitted In Lifetime):
              </span>
              <div className="flex flex-wrap gap-2">
                {livingPledges.map((p: any, idx: number) => (<span key={p.organ_code || p.organCode || idx} className="px-2.5 py-1 rounded-lg bg-emerald-950/60 border border-emerald-800/80 text-emerald-300 text-xs font-semibold inline-flex items-center gap-1.5">
                    <OrganImage organ={p.organ_name || p.organName || p.organ_code || p.organCode} size="xs" showContainer={false}/>
                    <span>{formatPledgeName(p, 'LIVING')}</span>
                  </span>))}
              </div>
            </div>)}

          {deceasedPledges.length > 0 && (<div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-rose-400 block mb-2">
                • Deceased Donation Directives (Post-Mortem Consent):
              </span>
              <div className="flex flex-wrap gap-2">
                {deceasedPledges.map((p: any, idx: number) => (<span key={p.organ_code || p.organCode || idx} className="px-2.5 py-1 rounded-lg bg-rose-950/60 border border-rose-800/80 text-rose-300 text-xs font-semibold inline-flex items-center gap-1.5">
                    <OrganImage organ={p.organ_name || p.organName || p.organ_code || p.organCode} size="xs" showContainer={false}/>
                    <span>{formatPledgeName(p, 'DECEASED')}</span>
                  </span>))}
              </div>
            </div>)}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-slate-400">
          <div>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1">
              Designated Emergency Next-of-Kin:
            </span>
            <p className="text-slate-200 font-semibold">{card.emergency_contact_name || card.emergencyContact?.name || 'Registered'}</p>
            <p className="text-slate-300 flex items-center gap-1 mt-0.5">
              <Phone className="w-3 h-3 text-rose-400"/>
              {card.emergency_contact_phone || card.emergencyContact?.phone || 'Verified on file'}
            </p>
          </div>

          <div className="text-[10px] leading-relaxed text-slate-400 sm:text-right">
            <span>
              This digital card records the voluntary humanitarian pledge of the cardholder. Authorized hospital coordinators and clinical teams can verify registered donation directives directly on the platform.
            </span>
          </div>
        </div>
      </div>
    </div>);
}
