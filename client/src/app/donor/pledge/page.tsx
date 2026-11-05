'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { donorApi } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { Heart, Droplet, CheckCircle2, Award, AlertCircle, AlertTriangle, ShieldCheck, Scale, Trash2, X, Check, ArrowRight, ExternalLink, } from 'lucide-react';
interface OrganType {
    id: number;
    code: string;
    name: string;
    category: string;
    max_viability_hours: number;
    allow_living_donor: boolean;
}
interface PledgeSelection {
    organ_type_id: number;
    consent_type: 'DECEASED' | 'LIVING';
}
interface ModalTarget {
    organ: OrganType;
    consentType: 'DECEASED' | 'LIVING';
}
export default function DonorPledgePage() {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const [organTypes, setOrganTypes] = useState<OrganType[]>([]);
    const [pledges, setPledges] = useState<PledgeSelection[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [revoking, setRevoking] = useState(false);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [modalTarget, setModalTarget] = useState<ModalTarget | null>(null);
    const [isDeclarationChecked, setIsDeclarationChecked] = useState(false);
    const [isRevokeAllOpen, setIsRevokeAllOpen] = useState(false);
    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/auth/login');
            return;
        }
        const loadData = async () => {
            try {
                const [typesRes, myPledgesRes] = await Promise.all([
                    donorApi.getOrganTypes(),
                    donorApi.getMyPledges(),
                ]);
                if (typesRes.success) {
                    setOrganTypes(Array.isArray(typesRes.data) ? typesRes.data : []);
                }
                if (myPledgesRes.success) {
                    const rawPledges = Array.isArray(myPledgesRes.data?.pledges)
                        ? myPledgesRes.data.pledges
                        : Array.isArray(myPledgesRes.data)
                            ? myPledgesRes.data
                            : [];
                    const current = rawPledges
                        .filter((p: any) => p.status === 'ACTIVE' || p.is_active !== false)
                        .map((p: any) => ({
                        organ_type_id: p.organ_type_id,
                        consent_type: (p.consent_type === 'LIVING_ALLOWED' || p.consent_type === 'LIVING') ? 'LIVING' : 'DECEASED',
                    }));
                    setPledges(current);
                }
            }
            catch (err: any) {
                setError(err.message || 'Failed to load pledge data.');
            }
            finally {
                setLoading(false);
            }
        };
        if (user)
            loadData();
    }, [user, authLoading, router]);
    const isSelected = (organTypeId: number, consentType: 'DECEASED' | 'LIVING') => {
        return pledges.some((p) => p.organ_type_id === organTypeId && p.consent_type === consentType);
    };
    const handleTileClick = (organ: OrganType, consentType: 'DECEASED' | 'LIVING') => {
        setError(null);
        setSuccessMsg(null);
        if (isSelected(organ.id, consentType)) {
            setPledges((prev) => prev.filter((p) => !(p.organ_type_id === organ.id && p.consent_type === consentType)));
        }
        else {
            setModalTarget({ organ, consentType });
            setIsDeclarationChecked(false);
        }
    };
    const handleConfirmModalPledge = () => {
        if (!modalTarget || !isDeclarationChecked)
            return;
        const { organ, consentType } = modalTarget;
        setPledges((prev) => {
            const exists = prev.some((p) => p.organ_type_id === organ.id && p.consent_type === consentType);
            if (!exists) {
                return [...prev, { organ_type_id: organ.id, consent_type: consentType }];
            }
            return prev;
        });
        setModalTarget(null);
        setIsDeclarationChecked(false);
    };
    const scrollToTop = () => {
        if (typeof window !== 'undefined') {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };
    const handlePledgeOrgans = async () => {
        setSaving(true);
        setError(null);
        setSuccessMsg(null);
        scrollToTop();
        try {
            await donorApi.savePledges(pledges);
            setSuccessMsg(pledges.length > 0
                ? 'Your organ donation pledges have been saved to your donor card and registry!'
                : 'Your donation directives have been updated and all pledges have been revoked.');
            scrollToTop();
        }
        catch (err: any) {
            setError(err.message || 'Failed to pledge organs.');
            scrollToTop();
        }
        finally {
            setSaving(false);
        }
    };
    const handleRevokeAllConfirm = async () => {
        setRevoking(true);
        setError(null);
        setSuccessMsg(null);
        try {
            await donorApi.revokeAllPledges();
            setPledges([]);
            setIsRevokeAllOpen(false);
            setSuccessMsg('All of your organ donation pledges have been successfully revoked.');
            scrollToTop();
        }
        catch (err: any) {
            setError(err.message || 'Failed to revoke pledges.');
            scrollToTop();
        }
        finally {
            setRevoking(false);
        }
    };
    const livingAllowedOrgans = organTypes.filter((o) => o.allow_living_donor);
    const deceasedAllowedOrgans = organTypes;
    const getOrganDisplayName = (organ: OrganType, consentType: 'DECEASED' | 'LIVING') => {
        if (organ.code === 'KIDNEY' || organ.name.toLowerCase().includes('kidney')) {
            return consentType === 'LIVING' ? 'Kidney' : 'Kidneys';
        }
        if (organ.code === 'BLOOD' || organ.name.toLowerCase().includes('blood')) {
            return 'Blood';
        }
        return organ.name;
    };
    const getOrganImage = (organ: OrganType): string | null => {
        const code = (organ.code || '').toUpperCase();
        const name = (organ.name || '').toUpperCase();
        if (code.includes('HEART') || name.includes('HEART'))
            return '/images/heart.png';
        if (code.includes('LUNG') || name.includes('LUNG'))
            return '/images/lungs.png';
        if (code.includes('LIVER') || name.includes('LIVER'))
            return '/images/liver.png';
        if (code.includes('KIDNEY') || name.includes('KIDNEY'))
            return '/images/kidneys.png';
        if (code.includes('PANCREAS') || name.includes('PANCREAS'))
            return '/images/pancreas.png';
        if (code.includes('CORNEA') || code.includes('EYE') || name.includes('CORNEA') || name.includes('EYE'))
            return '/images/cornea_eye.png';
        if (code.includes('BONE_MARROW') || code.includes('MARROW') || name.includes('MARROW'))
            return '/images/bone_marrow.png';
        if (code.includes('BLOOD') || name.includes('BLOOD'))
            return '/images/blood.png';
        return null;
    };
    const getOrganSubtitle = (organ: OrganType, consentType: 'DECEASED' | 'LIVING'): string => {
        const code = (organ.code || '').toUpperCase();
        if (code.includes('HEART'))
            return 'Vital Thoracic Organ';
        if (code.includes('LUNG'))
            return 'Respiratory Paired Organs';
        if (code.includes('LIVER'))
            return consentType === 'LIVING' ? 'Regenerative Lobe Segment' : 'Complete Hepatic Organ';
        if (code.includes('KIDNEY'))
            return consentType === 'LIVING' ? 'Single Paired Kidney' : 'Both Renal Organs';
        if (code.includes('PANCREAS'))
            return 'Endocrine Gland System';
        if (code.includes('CORNEA') || code.includes('EYE'))
            return 'Ocular Sight-Restoring Tissue';
        if (code.includes('BONE_MARROW'))
            return 'Hematopoietic Stem Cells';
        if (code.includes('BLOOD'))
            return 'Whole Blood & Cellular Units';
        return `${organ.category.replace(/_/g, ' ')}`;
    };
    return (<div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full transition-colors duration-200">
      <div className="space-y-8">

        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-200 dark:border-slate-800 gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-transparent dark:border-amber-900/50 text-xs font-semibold mb-2">
              <Award className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400"/>
              Donor Pledge Directory
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight transition-colors">
              Organ & Tissue Donation Consent Directive
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 transition-colors">
              Select organs and tissues you pledge to donate. Click any tile to review legal directives and confirm your pledge. Click again to deselect.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/donor/card" className="px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm transition-all">
              <Award className="w-4 h-4 text-amber-400"/>
              View Digital Donor Card
            </Link>
          </div>
        </div>

        {error && (<div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0"/>
            <span>{error}</span>
          </div>)}

        {successMsg && (<div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-300 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500"/>
              <span className="font-semibold">{successMsg}</span>
            </div>
            {pledges.length > 0 && !successMsg.toLowerCase().includes('revok') && (<Link href="/donor/card" className="font-bold underline text-emerald-800 dark:text-emerald-400 hover:text-emerald-900 shrink-0 ml-3">
                Inspect Donor Card →
              </Link>)}
          </div>)}

        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-xs transition-colors">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white transition-colors">
              1. Living Donation Allowed (Permitted While Alive)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 transition-colors">
              Medically safe procedures where a healthy adult can donate a segment without compromising long-term life (e.g., One Kidney, Liver lobe, Bone Marrow, or Blood).
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {livingAllowedOrgans.map((organ) => {
            const active = isSelected(organ.id, 'LIVING');
            const organImg = getOrganImage(organ);
            return (<div key={organ.id} onClick={() => handleTileClick(organ, 'LIVING')} className={`group p-5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between select-none ${active
                    ? 'border-emerald-500 dark:border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/50 shadow-xs shadow-emerald-500/10 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                  <div>

                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-100/60 dark:bg-emerald-950/70 border border-emerald-200/50 dark:border-emerald-800/50 px-2 py-0.5 rounded-md">
                        Living
                      </span>
                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors shrink-0 ${active
                    ? 'bg-emerald-600 border-emerald-600 text-white'
                    : 'border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/60'}`}>
                        {active && <CheckCircle2 className="w-3.5 h-3.5 stroke-[3]"/>}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-slate-900 dark:text-white text-base sm:text-lg mb-1 leading-snug">
                          {getOrganDisplayName(organ, 'LIVING')}
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Viability: {organ.max_viability_hours}h
                        </p>
                      </div>

                      {organImg && (<img src={organImg} alt={organ.name} className="w-16 h-16 sm:w-20 sm:h-20 object-contain shrink-0 select-none pointer-events-none transition-transform duration-200 group-hover:scale-105"/>)}
                    </div>
                  </div>

                  <div className={`mt-4 pt-3 border-t border-slate-100 dark:border-slate-700/60 text-xs font-medium transition-colors ${active ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-slate-500 dark:text-slate-400'}`}>
                    {active ? '✓ Pledged (Click to Deselect)' : '+ Click to Pledge'}
                  </div>
                </div>);
        })}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-xs transition-colors">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white transition-colors">
              2. Deceased Donation Allowed (Post-Mortem Consent)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 transition-colors">
              Advance directive instructing doctors and next of kin that upon brain death or cardiac arrest, these organs and tissues may be retrieved to save lives.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {deceasedAllowedOrgans.map((organ) => {
            const active = isSelected(organ.id, 'DECEASED');
            const organImg = getOrganImage(organ);
            return (<div key={organ.id} onClick={() => handleTileClick(organ, 'DECEASED')} className={`group p-5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between select-none ${active
                    ? 'border-rose-500 dark:border-rose-500 bg-rose-50/60 dark:bg-rose-950/50 shadow-xs shadow-rose-500/10 ring-2 ring-rose-500/20'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                  <div>

                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 bg-rose-100/60 dark:bg-rose-950/70 border border-rose-200/50 dark:border-rose-800/50 px-2 py-0.5 rounded-md">
                        Deceased
                      </span>
                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors shrink-0 ${active
                    ? 'bg-rose-600 border-rose-600 text-white'
                    : 'border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/60'}`}>
                        {active && <CheckCircle2 className="w-3.5 h-3.5 stroke-[3]"/>}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-slate-900 dark:text-white text-base sm:text-lg mb-1 leading-snug">
                          {getOrganDisplayName(organ, 'DECEASED')}
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Shelf-Life: {organ.max_viability_hours}h
                        </p>
                      </div>

                      {organImg && (<img src={organImg} alt={organ.name} className="w-16 h-16 sm:w-20 sm:h-20 object-contain shrink-0 select-none pointer-events-none transition-transform duration-200 group-hover:scale-105"/>)}
                    </div>
                  </div>

                  <div className={`mt-4 pt-3 border-t border-slate-100 dark:border-slate-700/60 text-xs font-medium transition-colors ${active ? 'text-rose-600 dark:text-rose-400 font-semibold' : 'text-slate-500 dark:text-slate-400'}`}>
                    {active ? '✓ Pledged (Click to Deselect)' : '+ Click to Pledge'}
                  </div>
                </div>);
        })}
          </div>
        </div>

        <div className="sticky bottom-6 z-30 w-full max-w-3xl mx-auto px-2 sm:px-0">
          <div className="px-5 sm:px-7 py-3 rounded-full backdrop-blur-2xl backdrop-saturate-150 bg-white/75 dark:bg-slate-900/75 border border-white/60 dark:border-white/10 shadow-2xl shadow-slate-900/10 dark:shadow-black/60 ring-1 ring-black/5 dark:ring-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 transition-all duration-300">
            <div className="flex items-center gap-3">
              <span className="relative flex h-3 w-3 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300 select-none">
                <strong className="text-slate-900 dark:text-white font-bold">{pledges.length}</strong> organ donation {pledges.length === 1 ? 'directive' : 'directives'} selected
              </span>
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
              {pledges.length > 0 && (<button type="button" onClick={() => setIsRevokeAllOpen(true)} className="px-4 py-2 rounded-full bg-rose-50/80 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900/70 border border-rose-200/80 dark:border-rose-800/60 text-rose-700 dark:text-rose-300 font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95">
                  <Trash2 className="w-3.5 h-3.5"/>
                  Revoke All Pledges
                </button>)}

              <button type="button" onClick={handlePledgeOrgans} disabled={saving} className="px-6 py-2.5 rounded-full bg-gradient-to-r from-rose-600 to-red-500 hover:from-rose-500 hover:to-red-600 text-white font-semibold text-xs shadow-md shadow-rose-500/25 flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer active:scale-95">
                <Heart className="w-4 h-4 fill-white"/>
                {saving ? 'Recording Pledges...' : 'Pledge Organs'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {modalTarget && (<div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto transition-colors">

            <button onClick={() => {
                setModalTarget(null);
                setIsDeclarationChecked(false);
            }} className="absolute top-5 right-5 p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
              <X className="w-5 h-5"/>
            </button>

            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0 pr-2">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider border ${modalTarget.consentType === 'LIVING'
                ? 'bg-emerald-100/70 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                : 'bg-rose-100/70 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800'}`}>
                    <Heart className="w-3 h-3 fill-current"/>
                    {modalTarget.consentType === 'LIVING' ? 'Living Donation Directive' : 'Deceased Donation Directive'}
                  </span>
                  <span className="text-[11px] text-slate-400 dark:text-slate-500">
                    Viability: {modalTarget.organ.max_viability_hours}h
                  </span>
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                  Pledge Declaration: {getOrganDisplayName(modalTarget.organ, modalTarget.consentType)}
                </h3>
              </div>

              {getOrganImage(modalTarget.organ) && (<img src={getOrganImage(modalTarget.organ)!} alt={modalTarget.organ.name} className="w-16 h-16 sm:w-20 sm:h-20 object-contain shrink-0 select-none pointer-events-none"/>)}
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-xs text-slate-600 dark:text-slate-300 space-y-2 leading-relaxed">
              <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-500"/>
                What You Are Signing Up For
              </div>
              {modalTarget.consentType === 'LIVING' ? (<p>
                  You are expressing your informed willingness to donate a segment or paired component of your{' '}
                  <strong className="text-slate-900 dark:text-white">
                    {getOrganDisplayName(modalTarget.organ, 'LIVING')}
                  </strong>{' '}
                  while living. Living donation is an elective, voluntary procedure requiring rigorous clinical screenings, psychosocial assessments, and independent medical board approval to guarantee zero health detriment to you.
                </p>) : (<p>
                  You are establishing an advance humanitarian directive instructing treating physicians and transplant teams that upon certified brain death or cardiac arrest, your{' '}
                  <strong className="text-slate-900 dark:text-white">
                    {getOrganDisplayName(modalTarget.organ, 'DECEASED')}
                  </strong>{' '}
                  may be retrieved to save terminal patients on the transplant waitlist.
                </p>)}
            </div>

            <div className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300">
              <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Scale className="w-4 h-4 text-indigo-500"/>
                Legal Framework & Donor Rights
              </div>
              <ul className="space-y-1.5 pl-1 list-none">
                <li className="flex items-start gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5"/>
                  <span>
                    <strong>Unconditional Right to Revoke:</strong> You retain the full legal right to modify or revoke this pledge at any time with immediate effect on this portal without giving any reason.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5"/>
                  <span>
                    <strong>Non-Commercial Humanitarian Act:</strong> Organ donation is strictly voluntary and non-commercial; buying or selling organs is strictly prohibited.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5"/>
                  <span>
                    <strong>Your Medical Care is Uncompromised:</strong> Healthcare teams are duty-bound to deliver maximum life-saving care to you at all times; organ donation is only considered after life cannot be saved.
                  </span>
                </li>
              </ul>
            </div>

            <div className="pt-2">
              <label className="flex items-start gap-3 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-rose-50/40 dark:bg-rose-950/20 hover:bg-rose-50/70 dark:hover:bg-rose-950/40 cursor-pointer transition-colors">
                <input type="checkbox" checked={isDeclarationChecked} onChange={(e) => setIsDeclarationChecked(e.target.checked)} className="mt-1 w-4 h-4 rounded text-rose-600 focus:ring-rose-500 border-slate-300 dark:border-slate-600 cursor-pointer shrink-0"/>
                <span className="text-xs font-medium text-slate-800 dark:text-slate-200 leading-snug select-none">
                  &ldquo;I solemnly affirm my voluntary humanitarian pledge to donate my{' '}
                  <strong className="text-rose-600 dark:text-rose-400 font-bold">
                    {getOrganDisplayName(modalTarget.organ, modalTarget.consentType)}
                  </strong>{' '}
                  ({modalTarget.consentType === 'LIVING' ? 'Living' : 'Deceased'} category) to save human lives and bring healing to those in critical need. I understand my legal rights and know that I retain the unconditional right to modify or revoke this pledge at any time.&rdquo;
                </span>
              </label>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button type="button" onClick={() => {
                setModalTarget(null);
                setIsDeclarationChecked(false);
            }} className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer">
                Cancel
              </button>
              <button type="button" onClick={handleConfirmModalPledge} disabled={!isDeclarationChecked} className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-500 hover:from-rose-500 hover:to-red-600 text-white font-semibold text-xs shadow-md shadow-rose-500/20 flex items-center gap-1.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">
                <Heart className="w-3.5 h-3.5 fill-white"/>
                Pledge {getOrganDisplayName(modalTarget.organ, modalTarget.consentType)}
              </button>
            </div>
          </div>
        </div>)}

      {isRevokeAllOpen && (<div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-5 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 dark:bg-rose-950/70 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 border border-rose-200 dark:border-rose-900/50">
                <AlertTriangle className="w-5 h-5"/>
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Revoke All Pledges?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  This action will withdraw all active donation directives.
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700/60">
              Are you sure you want to revoke all your organ donation directives? This will remove all pledged organs from your Digital Donor Card and update your status in the Organ Registry. You are welcome to pledge again at any time.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button type="button" onClick={() => setIsRevokeAllOpen(false)} disabled={revoking} className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer">
                Keep Pledges
              </button>
              <button type="button" onClick={handleRevokeAllConfirm} disabled={revoking} className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs shadow-md shadow-rose-600/20 flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer">
                <Trash2 className="w-3.5 h-3.5"/>
                {revoking ? 'Revoking...' : 'Yes, Revoke All Pledges'}
              </button>
            </div>
          </div>
        </div>)}
    </div>);
}
