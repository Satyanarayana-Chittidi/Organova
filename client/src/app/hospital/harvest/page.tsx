'use client';
import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { organApi } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import CitizenAccountLinker, { LinkedCitizen } from '@/components/CitizenAccountLinker';
import OrganImage from '@/components/OrganImage';
import { OrganHarvestRegistryIcon } from '@/components/HospitalPortalIcons';
import { Heart, Clock, CheckCircle2, AlertCircle, PlusCircle, ArrowRight, RefreshCw, Search, Building2, Layers, FileText, ChevronDown, Check, Lock, } from 'lucide-react';
export default function HarvestOrganPage() {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const [organTypes, setOrganTypes] = useState<any[]>([]);
    const [activeOrgans, setActiveOrgans] = useState<any[]>([]);
    const [organTypeId, setOrganTypeId] = useState<number | string>('');
    const [isOrganDropdownOpen, setIsOrganDropdownOpen] = useState(false);
    const organDropdownRef = useRef<HTMLDivElement>(null);
    const [bloodGroup, setBloodGroup] = useState<string>('');
    const [harvestedAt, setHarvestedAt] = useState('');
    const [clinicalNotes, setClinicalNotes] = useState('');
    const [selectedDonor, setSelectedDonor] = useState<LinkedCitizen | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<'ALL' | 'AVAILABLE' | 'MATCHING'>('ALL');
    const [submitting, setSubmitting] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);
    const loadData = async () => {
        try {
            const [typesRes, organsRes] = await Promise.all([
                organApi.getTypes(),
                organApi.listOrgans({ only_viable: true }),
            ]);
            if (typesRes.success) {
                const typesList = (Array.isArray(typesRes.data) ? typesRes.data : []).filter((t: any) => t.code !== 'BLOOD' && t.name?.toLowerCase() !== 'blood');
                setOrganTypes(typesList);
            }
            if (organsRes.success) {
                setActiveOrgans(Array.isArray(organsRes.data) ? organsRes.data : []);
            }
        }
        catch (err) { }
        finally {
            setLoading(false);
        }
    };
    useEffect(() => {
        if (!authLoading && (!user || user.role !== 'HOSPITAL')) {
            router.push('/auth/login');
            return;
        }
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        setHarvestedAt(now.toISOString().slice(0, 16));
        if (user)
            loadData();
    }, [user, authLoading]);
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (organDropdownRef.current && !organDropdownRef.current.contains(e.target as Node)) {
                setIsOrganDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);
    const selectedType = organTypeId ? organTypes.find((t) => t.id === Number(organTypeId)) : null;
    const formatCleanNotes = (notes?: string) => {
        if (!notes)
            return '';
        return notes
            .replace(/\[TEST - NEVER EXPIRES\]\s*/gi, '')
            .replace(/\[Demo Graft\]\s*/gi, '')
            .trim();
    };
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccessMsg(null);
        if (!organTypeId) {
            setError('Please select an organ or tissue type.');
            return;
        }
        if (!bloodGroup) {
            setError('Please select the donor blood group.');
            return;
        }
        if (!harvestedAt) {
            setError('Please specify the organ harvest timestamp.');
            return;
        }
        setSubmitting(true);
        try {
            const res = await organApi.harvest({
                organ_type_id: Number(organTypeId),
                donor_user_id: selectedDonor ? selectedDonor.id : undefined,
                blood_group: bloodGroup,
                harvested_at: new Date(harvestedAt).toISOString(),
                clinical_notes: clinicalNotes.trim(),
            });
            const donorNote = selectedDonor
                ? ` Donated by ${selectedDonor.full_name} (${selectedDonor.email}) and recorded in their lifetime impact ledger.`
                : '';
            setSuccessMsg(`Organ successfully logged! Cold ischemia preservation clock started (${res.data?.max_viability_hours || selectedType?.max_viability_hours || 24}h limit).${donorNote}`);
            setOrganTypeId('');
            setBloodGroup('');
            setSelectedDonor(null);
            setClinicalNotes('');
            await loadData();
        }
        catch (err: any) {
            setError(err.message || 'Failed to log harvested organ.');
        }
        finally {
            setSubmitting(false);
        }
    };
    const availableCount = activeOrgans.filter((o) => o.status === 'AVAILABLE').length;
    const matchingCount = activeOrgans.filter((o) => o.status === 'MATCHING').length;
    const filteredOrgans = activeOrgans.filter((organ) => {
        const matchesSearch = !searchTerm.trim() ||
            organ.organ_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            organ.blood_group?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            organ.current_hub_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            organ.current_hub_city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            organ.clinical_notes?.toLowerCase().includes(searchTerm.toLowerCase());
        if (!matchesSearch)
            return false;
        if (filterStatus === 'AVAILABLE')
            return organ.status === 'AVAILABLE';
        if (filterStatus === 'MATCHING')
            return organ.status === 'MATCHING';
        return true;
    });
    const isBloodGroupLocked = !!selectedDonor?.blood_group;
    return (<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full space-y-6">

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Viable Organs</span>
            <Layers className="w-4 h-4 text-slate-400"/>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            {activeOrgans.length}
          </div>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">Total in preservation network</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Available for Matching</span>
            <CheckCircle2 className="w-4 h-4"/>
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
            {availableCount}
          </div>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">Ready for recipient evaluation</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-amber-600 dark:text-amber-400 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">In Allocation Protocol</span>
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
            </span>
          </div>
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400">
            {matchingCount}
          </div>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">20-minute response window active</span>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">

        <div className="xl:col-span-5 col-span-12 bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs transition-colors space-y-6">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 text-xs font-semibold mb-2">
              <OrganHarvestRegistryIcon className="w-4 h-4"/>
              Surgical Procurement
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
              Log Harvested Organ
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Records preservation start time and starts the cold ischemia preservation clock.
            </p>
          </div>

          {error && (<div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0"/>
              <span>{error}</span>
            </div>)}

          {successMsg && (<div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/50 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500 dark:text-emerald-400"/>
              <span>{successMsg}</span>
            </div>)}

          <form onSubmit={handleSubmit} className="space-y-4">

            <div className="relative" ref={organDropdownRef}>
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                Organ / Tissue *
              </label>

              <button type="button" onClick={() => setIsOrganDropdownOpen((prev) => !prev)} className={`w-full min-h-[58px] px-3.5 py-2.5 rounded-xl border bg-white dark:bg-[#0f172a] text-left flex items-center justify-between transition-all cursor-pointer focus:outline-hidden focus:border-rose-500 ${isOrganDropdownOpen
            ? 'border-rose-500 ring-2 ring-rose-500/20'
            : 'border-slate-200 dark:border-slate-700'}`}>
                {selectedType ? (<div className="flex items-center gap-2.5 min-w-0">
                    <OrganImage organ={selectedType.name || selectedType.code} size="sm"/>
                    <div className="min-w-0">
                      <span className="font-bold text-xs text-slate-900 dark:text-white block truncate leading-tight">
                        {selectedType.name}
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 block truncate leading-tight mt-0.5">
                        Lifetime: <strong className="text-slate-700 dark:text-slate-300 font-semibold">{selectedType.max_viability_hours}h</strong> max cold ischemia
                      </span>
                    </div>
                  </div>) : (<div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0 text-slate-400 dark:text-slate-500">
                      <Layers className="w-4 h-4"/>
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-medium text-slate-400 dark:text-slate-500 block truncate leading-tight">
                        Select Organ / Tissue
                      </span>
                      <span className="text-[11px] text-slate-400 dark:text-slate-500 block truncate leading-tight mt-0.5">
                        Choose organ type to log cold ischemia
                      </span>
                    </div>
                  </div>)}
                <ChevronDown className={`w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0 ml-2 transition-transform duration-200 ${isOrganDropdownOpen ? 'rotate-180' : ''}`}/>
              </button>

              {isOrganDropdownOpen && (<div className="absolute left-0 right-0 top-full mt-1.5 z-40 bg-white dark:bg-[#0f172a] rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl overflow-hidden max-h-64 overflow-y-auto animate-in fade-in duration-150 p-1.5 space-y-1">
                  {organTypes.map((t) => {
                const isSelected = String(t.id) === String(organTypeId);
                return (<button key={t.id} type="button" onClick={() => {
                        setOrganTypeId(t.id);
                        setIsOrganDropdownOpen(false);
                        setError(null);
                    }} className={`w-full min-h-[52px] text-left p-2.5 rounded-xl flex items-center justify-between gap-3 transition-colors cursor-pointer ${isSelected
                        ? 'bg-rose-50/80 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 shadow-2xs'
                        : 'hover:bg-slate-100 dark:hover:bg-slate-800/60 border border-transparent'}`}>
                        <div className="flex items-center gap-3 min-w-0">
                          <OrganImage organ={t.name || t.code} size="sm"/>
                          <div className="min-w-0">
                            <span className={`block font-bold text-xs truncate leading-tight ${isSelected ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'}`}>
                              {t.name}
                            </span>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 block truncate leading-tight mt-0.5">
                              Lifetime: <strong className="text-slate-700 dark:text-slate-300 font-semibold">{t.max_viability_hours} Hours</strong> preservation
                            </span>
                          </div>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0"/>}
                      </button>);
            })}
                </div>)}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                    Donor Blood Group *
                  </label>
                  {isBloodGroupLocked && (<span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                      <Lock className="w-3 h-3"/>
                      Locked
                    </span>)}
                </div>
                <select value={bloodGroup} onChange={(e) => setBloodGroup(e.target.value)} disabled={isBloodGroupLocked} style={{ color: !bloodGroup ? '#94a3b8' : undefined }} className={`w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm focus:outline-hidden focus:border-rose-500 bg-white dark:bg-[#0f172a] transition-colors ${isBloodGroupLocked
            ? 'opacity-85 cursor-not-allowed bg-slate-100 dark:bg-slate-800/80'
            : 'cursor-pointer'} ${bloodGroup
            ? 'font-bold text-slate-900 dark:text-white'
            : '!text-slate-400 dark:!text-slate-500 font-normal'}`}>
                  <option value="" className="text-slate-400 dark:text-slate-500 font-normal">
                    Select Blood Group
                  </option>
                  {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((bg) => (<option key={bg} value={bg} className="text-slate-900 dark:text-white font-bold">
                      {bg}
                    </option>))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                  Harvest Timestamp *
                </label>
                <input type="datetime-local" required value={harvestedAt} onChange={(e) => setHarvestedAt(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white bg-white dark:bg-[#0f172a] placeholder:text-slate-400 dark:placeholder:text-slate-500 font-medium focus:outline-hidden focus:border-rose-500"/>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                Clinical Preservation Notes
              </label>
              <textarea rows={3} value={clinicalNotes} onChange={(e) => setClinicalNotes(e.target.value)} placeholder="Perfusion fluid (Custodiol HTK / Belzer UW), warm ischemia minutes, anatomical integrity, baseline biopsy..." className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white bg-white dark:bg-[#0f172a] placeholder:text-slate-400 dark:placeholder:text-slate-500 font-medium focus:outline-hidden focus:border-rose-500"/>
            </div>

            <div className="pt-2">
              <CitizenAccountLinker label="Donor Citizen Profile (Optional)" sublabel="Associate a registered citizen or create an account for the donor." selectedUser={selectedDonor} onSelectUser={(donor) => {
            setSelectedDonor(donor);
            if (donor?.blood_group) {
                setBloodGroup(donor.blood_group);
            }
        }} onBloodGroupSelected={(bg) => {
            setBloodGroup(bg);
        }}/>
            </div>

            <button type="submit" disabled={submitting} className="w-full py-3 rounded-xl bg-gradient-to-r from-rose-600 to-red-500 hover:from-rose-500 hover:to-red-600 text-white font-bold text-sm shadow-md shadow-rose-500/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer">
              <PlusCircle className="w-4 h-4"/>
              {submitting ? 'Registering Harvest...' : 'Register Harvested Organ'}
            </button>
          </form>
        </div>

        <div className="xl:col-span-7 col-span-12 space-y-6">
          <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs transition-colors">

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800 mb-6">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Active Viable Organs in Network</span>
                  <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-mono font-bold">
                    {filteredOrgans.length} of {activeOrgans.length}
                  </span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Real-time cold ischemia preservation tracking and surgical readiness
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button onClick={loadData} className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer" title="Refresh list">
                  <RefreshCw className="w-4 h-4"/>
                </button>
                <Link href="/hospital/requests" className="px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors">
                  <Clock className="w-3.5 h-3.5 text-emerald-500"/>
                  Waitlist Queue →
                </Link>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 mb-6">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"/>
                <input type="text" placeholder="Filter by organ, blood group, hospital hub, or city..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:border-rose-500 font-medium"/>
              </div>

              <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-semibold overflow-x-auto shrink-0">
                <button type="button" onClick={() => setFilterStatus('ALL')} className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${filterStatus === 'ALL'
            ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
            : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}>
                  All ({activeOrgans.length})
                </button>
                <button type="button" onClick={() => setFilterStatus('AVAILABLE')} className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${filterStatus === 'AVAILABLE'
            ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs'
            : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}>
                  Available ({availableCount})
                </button>
                <button type="button" onClick={() => setFilterStatus('MATCHING')} className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${filterStatus === 'MATCHING'
            ? 'bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-xs'
            : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}>
                  Matching ({matchingCount})
                </button>
              </div>
            </div>

            {filteredOrgans.length === 0 && !loading && (<div className="text-center py-12 text-slate-400 dark:text-slate-500 text-xs bg-slate-50/50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                No active viable organs matching the current criteria.
              </div>)}

            <div className="space-y-4">
              {filteredOrgans.map((organ) => {
            const remMins = organ.remaining_minutes || 0;
            const hours = Math.floor(remMins / 60);
            const mins = remMins % 60;
            const isUrgent = remMins > 0 && remMins < 120;
            const cleanNotes = formatCleanNotes(organ.clinical_notes);
            return (<div key={organ.id} className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all space-y-3">

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-start gap-3.5 flex-1 min-w-0">
                        <OrganImage organ={organ.organ_name || organ.organ_code} size="md" className="shrink-0 mt-0.5"/>
                        <div className="space-y-1.5 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-base font-extrabold text-slate-900 dark:text-white">
                              {organ.organ_name}
                            </span>
                          <span className="px-2.5 py-0.5 rounded-md bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 text-xs font-black">
                            {organ.blood_group}
                          </span>

                          {organ.status === 'AVAILABLE' ? (<span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold border border-emerald-200 dark:border-emerald-800">
                              Ready for Matching
                            </span>) : organ.status === 'MATCHING' ? (<span className="px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-[10px] font-bold border border-amber-200 dark:border-amber-800 flex items-center gap-1">
                              <span className="relative flex h-1.5 w-1.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500"></span>
                              </span>
                              20-Min Offer Window Active
                            </span>) : (<span className="px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-bold">
                              {organ.status}
                            </span>)}
                        </div>

                        <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                          <span className="flex items-center gap-1 text-slate-700 dark:text-slate-300 font-medium">
                            <Building2 className="w-3.5 h-3.5 text-slate-400"/>
                            {organ.current_hub_name} ({organ.current_hub_city})
                          </span>
                          <span className="text-slate-300 dark:text-slate-700">•</span>
                          <span>ID #{organ.id}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">

                        <div className={`px-3.5 py-2.5 rounded-2xl border text-center shrink-0 ${isUrgent
                    ? 'bg-red-50 dark:bg-red-950/60 border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300'
                    : 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-900/60 text-emerald-800 dark:text-emerald-300'}`}>
                          <div className="flex items-center justify-center gap-1 text-xs font-bold">
                            <Clock className={`w-3.5 h-3.5 ${isUrgent
                    ? 'animate-spin text-red-600 dark:text-red-400'
                    : 'text-emerald-600 dark:text-emerald-400'}`}/>
                            <span>
                              {remMins >= 525600
                    ? 'Active (Viable)'
                    : hours > 0
                        ? `${hours}h ${mins}m`
                        : `${mins}m`}
                            </span>
                          </div>
                          <span className="text-[9px] uppercase font-semibold tracking-wider block mt-0.5">
                            Shelf-Life Left
                          </span>
                        </div>

                        {organ.status === 'AVAILABLE' ? (<Link href={`/hospital/matches?organId=${organ.id}`} className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-semibold text-xs transition-colors shrink-0 flex items-center gap-1.5">
                            <span>Match Candidates</span>
                            <ArrowRight className="w-3.5 h-3.5"/>
                          </Link>) : organ.status === 'MATCHING' ? (<Link href={`/hospital/matches`} className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs transition-colors shrink-0 flex items-center gap-1.5 shadow-xs shadow-amber-600/20">
                            <span>Decision Room</span>
                            <ArrowRight className="w-3.5 h-3.5"/>
                          </Link>) : (<span className="px-3 py-2 text-xs text-slate-400 font-medium">
                            Allocated
                          </span>)}
                      </div>
                    </div>

                    {cleanNotes && (<div className="w-full pt-1">
                        <div className="p-3 rounded-xl bg-white/80 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-700/60 text-xs text-slate-700 dark:text-slate-300 leading-relaxed break-words whitespace-pre-wrap flex items-start gap-2.5">
                          <FileText className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0 mt-0.5"/>
                          <div className="min-w-0 flex-1">
                            <span className="font-semibold text-slate-900 dark:text-white mr-1.5 not-italic">
                              Clinical Note:
                            </span>
                            <span className="italic">{cleanNotes}</span>
                          </div>
                        </div>
                      </div>)}
                  </div>);
        })}
            </div>
          </div>
        </div>
      </div>
    </div>);
}
