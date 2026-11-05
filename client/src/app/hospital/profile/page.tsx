'use client';
import React, { useState, useEffect, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { hubApi } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { BloodStockInventoryIcon, OrganHarvestRegistryIcon, MatchEngineIcon, } from '@/components/HospitalPortalIcons';
import { Hospital, Building2, ShieldCheck, MapPin, Phone, Mail, Heart, Droplet, Users, Activity, Calendar, Clock, Search, CheckCircle2, AlertCircle, ExternalLink, Edit3, RefreshCw, ArrowRight, FileText, X, Plus, Award, Layers, Sparkles, } from 'lucide-react';
export default function HospitalProfilePage() {
    return (<Suspense fallback={<div className="py-20 text-center text-xs text-slate-400">
          Loading facility profile...
        </div>}>
      <HospitalProfileContent />
    </Suspense>);
}
function HospitalProfileContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const initialTab = searchParams.get('tab')?.toUpperCase() || 'ALL';
    const { user, loading: authLoading } = useAuth();
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [submittingEdit, setSubmittingEdit] = useState(false);
    const [editFormData, setEditFormData] = useState({
        name: '',
        contact_phone: '',
        address_line: '',
        city: '',
        state: '',
        pincode: '',
        latitude: '',
        longitude: '',
    });
    const [ledgerTab, setLedgerTab] = useState<'ALL' | 'HARVESTS' | 'TRANSPLANTS' | 'WAITLIST' | 'BLOOD'>(['ALL', 'HARVESTS', 'TRANSPLANTS', 'WAITLIST', 'BLOOD'].includes(initialTab)
        ? (initialTab as any)
        : 'ALL');
    const [searchQuery, setSearchQuery] = useState('');
    const loadProfileAndHistory = async () => {
        try {
            setError(null);
            const res = await hubApi.getMyHubHistory();
            if (res.success && res.data) {
                setData(res.data);
                const fac = res.data.facility;
                if (fac) {
                    setEditFormData({
                        name: fac.name || '',
                        contact_phone: fac.contact_phone || '',
                        address_line: fac.address_line || '',
                        city: fac.city || '',
                        state: fac.state || '',
                        pincode: fac.pincode || '',
                        latitude: fac.latitude !== undefined ? String(fac.latitude) : '',
                        longitude: fac.longitude !== undefined ? String(fac.longitude) : '',
                    });
                }
            }
            else {
                setError(res.message || 'Failed to load facility profile.');
            }
        }
        catch (err: any) {
            setError(err.message || 'Error connecting to medical registry.');
        }
        finally {
            setLoading(false);
            setRefreshing(false);
        }
    };
    useEffect(() => {
        if (!authLoading && (!user || !['HOSPITAL', 'ADMIN'].includes(user.role))) {
            router.push('/auth/login');
            return;
        }
        if (user)
            loadProfileAndHistory();
    }, [user, authLoading]);
    const handleRefresh = async () => {
        setRefreshing(true);
        await loadProfileAndHistory();
    };
    const handleSaveProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmittingEdit(true);
        setError(null);
        setSuccessMsg(null);
        try {
            const payload: any = {
                name: editFormData.name.trim(),
                contact_phone: editFormData.contact_phone.trim(),
                address_line: editFormData.address_line.trim(),
                city: editFormData.city.trim(),
                state: editFormData.state.trim(),
                pincode: editFormData.pincode.trim(),
            };
            if (editFormData.latitude)
                payload.latitude = parseFloat(editFormData.latitude);
            if (editFormData.longitude)
                payload.longitude = parseFloat(editFormData.longitude);
            const res = await hubApi.updateMyHub(payload);
            if (res.success) {
                setSuccessMsg('Facility profile updated successfully.');
                setIsEditModalOpen(false);
                await loadProfileAndHistory();
            }
            else {
                setError(res.message || 'Failed to update profile.');
            }
        }
        catch (err: any) {
            setError(err.message || 'Failed to update facility profile.');
        }
        finally {
            setSubmittingEdit(false);
        }
    };
    const facility = data?.facility;
    const stats = data?.stats || {
        totalHarvests: 0,
        activeHarvests: 0,
        totalTransplants: 0,
        waitlistPatients: 0,
        bloodTransactions: 0,
    };
    const harvests = data?.harvests || [];
    const transplants = data?.transplants || [];
    const waitlist = data?.waitlist || [];
    const bloodTransactions = data?.bloodTransactions || [];
    const filteredHarvests = useMemo(() => {
        if (!searchQuery.trim())
            return harvests;
        const q = searchQuery.toLowerCase();
        return harvests.filter((h: any) => h.organ_name?.toLowerCase().includes(q) ||
            h.blood_group?.toLowerCase().includes(q) ||
            h.donor_name?.toLowerCase().includes(q) ||
            h.clinical_notes?.toLowerCase().includes(q) ||
            String(h.id).includes(q));
    }, [harvests, searchQuery]);
    const filteredTransplants = useMemo(() => {
        if (!searchQuery.trim())
            return transplants;
        const q = searchQuery.toLowerCase();
        return transplants.filter((t: any) => t.organ_name?.toLowerCase().includes(q) ||
            t.blood_group?.toLowerCase().includes(q) ||
            t.recipient_name?.toLowerCase().includes(q) ||
            t.harvesting_hub_name?.toLowerCase().includes(q) ||
            String(t.match_id).includes(q));
    }, [transplants, searchQuery]);
    const filteredWaitlist = useMemo(() => {
        if (!searchQuery.trim())
            return waitlist;
        const q = searchQuery.toLowerCase();
        return waitlist.filter((w: any) => w.recipient_name?.toLowerCase().includes(q) ||
            w.organ_name?.toLowerCase().includes(q) ||
            w.blood_group?.toLowerCase().includes(q) ||
            w.medical_summary?.toLowerCase().includes(q) ||
            String(w.id).includes(q));
    }, [waitlist, searchQuery]);
    const filteredBlood = useMemo(() => {
        if (!searchQuery.trim())
            return bloodTransactions;
        const q = searchQuery.toLowerCase();
        return bloodTransactions.filter((b: any) => b.blood_group?.toLowerCase().includes(q) ||
            b.component?.toLowerCase().includes(q) ||
            b.destination_hub_name?.toLowerCase().includes(q) ||
            b.patient_name?.toLowerCase().includes(q) ||
            b.donor_name?.toLowerCase().includes(q) ||
            b.recipient_name?.toLowerCase().includes(q) ||
            b.hospital_bed_no?.toLowerCase().includes(q) ||
            String(b.id).includes(q));
    }, [bloodTransactions, searchQuery]);
    const totalFilteredCount = (ledgerTab === 'ALL' || ledgerTab === 'HARVESTS' ? filteredHarvests.length : 0) +
        (ledgerTab === 'ALL' || ledgerTab === 'TRANSPLANTS' ? filteredTransplants.length : 0) +
        (ledgerTab === 'ALL' || ledgerTab === 'WAITLIST' ? filteredWaitlist.length : 0) +
        (ledgerTab === 'ALL' || ledgerTab === 'BLOOD' ? filteredBlood.length : 0);
    if (loading) {
        return (<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <div className="w-10 h-10 rounded-full border-2 border-rose-600 border-t-transparent animate-spin mx-auto mb-4"/>
        <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">
          Loading institutional dossier and clinical ledger...
        </p>
      </div>);
    }
    return (<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full transition-colors duration-200">
      <div className="space-y-8">

        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-200 dark:border-slate-800 gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 text-xs font-semibold mb-2 border border-transparent dark:border-rose-900/50">
              <Hospital className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400"/>
              Institutional Facility Dossier
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
              {facility?.name || 'Medical Facility Profile'}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Official institutional registration, accreditation credentials, and lifetime operational transaction ledger.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            <button onClick={() => setIsEditModalOpen(true)} className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-semibold text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs">
              <Edit3 className="w-3.5 h-3.5"/>
              <span>Edit Facility Details</span>
            </button>
            <button onClick={handleRefresh} disabled={refreshing} className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer disabled:opacity-50" title="Refresh profile and ledger">
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`}/>
            </button>
          </div>
        </div>

        {error && (<div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/50 text-rose-800 dark:text-rose-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0"/>
            <span>{error}</span>
          </div>)}
        {successMsg && (<div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-200 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0"/>
            <span>{successMsg}</span>
          </div>)}

        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-xs transition-colors">
          <div className="flex flex-col lg:flex-row items-start justify-between gap-6 pb-6 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-rose-600 to-red-500 text-white flex items-center justify-center font-black text-2xl shadow-lg shadow-rose-600/20 shrink-0">
                <Hospital className="w-8 h-8"/>
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap mb-1">
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                    {facility?.name}
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 font-bold text-xs uppercase tracking-wider border border-rose-200 dark:border-rose-900/60">
                    {facility?.hub_type?.replace(/_/g, ' ')}
                  </span>
                  {facility?.verification_status === 'ACTIVE' ? (<span className="px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-bold text-xs flex items-center gap-1 border border-emerald-200 dark:border-emerald-800">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600"/>
                      Accredited & Active
                    </span>) : (<span className="px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 font-bold text-xs border border-amber-200 dark:border-amber-800">
                      {facility?.verification_status}
                    </span>)}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  Facility License: <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{facility?.license_number}</span>
                  <span className="mx-2">•</span>
                  Facility ID: <span className="font-mono text-slate-700 dark:text-slate-300">#{facility?.id}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Link href="/hospital/harvest" className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold transition-colors flex items-center gap-1.5">
                <OrganHarvestRegistryIcon className="w-4 h-4"/>
                <span>Log Harvest Organ</span>
              </Link>
              <Link href="/hospital/requests" className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold transition-colors flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-emerald-500"/>
                <span>Waitlist Queue</span>
              </Link>
              <Link href="/hospital/matches" className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold transition-colors flex items-center gap-1.5">
                <MatchEngineIcon className="w-3.5 h-3.5 text-indigo-500"/>
                <span>Decision Room</span>
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 text-xs">

            <div className="space-y-3">
              <span className="text-[11px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500 block">
                Official Contacts
              </span>
              <div className="flex items-center gap-2.5 text-slate-700 dark:text-slate-200">
                <Phone className="w-4 h-4 text-rose-500 shrink-0"/>
                <span className="font-semibold">{facility?.contact_phone || 'Not provided'}</span>
              </div>
              <div className="flex items-center gap-2.5 text-slate-700 dark:text-slate-200">
                <Mail className="w-4 h-4 text-rose-500 shrink-0"/>
                <span className="font-medium truncate">{user?.email || 'Not provided'}</span>
              </div>
            </div>

            <div className="space-y-3">
              <span className="text-[11px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500 block">
                Physical Address
              </span>
              <div className="flex items-start gap-2.5 text-slate-700 dark:text-slate-200">
                <MapPin className="w-4 h-4 text-rose-500 shrink-0 mt-0.5"/>
                <div className="leading-relaxed">
                  <p className="font-semibold">{facility?.address_line}</p>
                  <p className="text-slate-500 dark:text-slate-400">
                    {facility?.city}, {facility?.state} - {facility?.pincode}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <span className="text-[11px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500 block">
                GPS Coordinates
              </span>
              <div className="space-y-1 text-slate-700 dark:text-slate-200">
                <p className="font-mono text-xs">
                  Lat: <span className="font-semibold">{facility?.latitude || '17.4325'}</span> • Lon:{' '}
                  <span className="font-semibold">{facility?.longitude || '78.4071'}</span>
                </p>
                {facility?.latitude && facility?.longitude && (<a href={`https://www.google.com/maps/search/?api=1&query=${facility.latitude},${facility.longitude}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:underline mt-1">
                    <span>Open in Google Maps</span>
                    <ExternalLink className="w-3 h-3"/>
                  </a>)}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
              <span className="text-xs font-semibold">Total Harvests</span>
              <Heart className="w-4 h-4 text-rose-500"/>
            </div>
            <p className="text-2xl font-black text-slate-900 dark:text-white">{stats.totalHarvests}</p>
            <span className="text-[10px] text-slate-400 block mt-1">
              {stats.activeHarvests} currently viable & matching
            </span>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
              <span className="text-xs font-semibold">Transplants Confirmed</span>
              <Activity className="w-4 h-4 text-emerald-500"/>
            </div>
            <p className="text-2xl font-black text-slate-900 dark:text-white">{stats.totalTransplants}</p>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block mt-1 font-medium">
              Successful matches accepted
            </span>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
              <span className="text-xs font-semibold">Waitlist Patients</span>
              <Users className="w-4 h-4 text-amber-500"/>
            </div>
            <p className="text-2xl font-black text-slate-900 dark:text-white">{stats.waitlistPatients}</p>
            <span className="text-[10px] text-slate-400 block mt-1">
              Enrolled under this facility
            </span>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
              <span className="text-xs font-semibold">Blood Transactions</span>
              <Droplet className="w-4 h-4 text-red-500"/>
            </div>
            <p className="text-2xl font-black text-slate-900 dark:text-white">{stats.bloodTransactions}</p>
            <span className="text-[10px] text-slate-400 block mt-1">
              Requisitions & fulfillments
            </span>
          </div>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"/>
          <input type="text" placeholder="Search across harvests, transplants, and blood transactions by name, organ, group, bed no, or clinical notes..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-11 pr-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-rose-500 font-medium shadow-xs"/>
        </div>

        <div id="ledger-harvests" className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200/80 dark:border-rose-900/60 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
                <Heart className="w-5 h-5 fill-rose-500/20"/>
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  Organ Harvest Procurement Ledger
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Verified record of deceased donor organ procurements and shelf-life viability tracking.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200/80 dark:border-rose-900/60">
                {filteredHarvests.length} Harvest{filteredHarvests.length === 1 ? '' : 's'}
              </span>
              <Link href="/hospital/history?type=harvests" className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold transition-colors flex items-center gap-1.5">
                <span>Full Ledger</span>
                <ArrowRight className="w-3.5 h-3.5"/>
              </Link>
              <Link href="/hospital/harvest" className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white text-xs font-semibold transition-colors flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5"/>
                <span>Log Harvest</span>
              </Link>
            </div>
          </div>

          {filteredHarvests.length === 0 ? (<div className="text-center py-10 text-slate-400 dark:text-slate-500 text-xs bg-slate-50/50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
              {searchQuery.trim()
                ? `No organ harvests match "${searchQuery}".`
                : 'No organ harvest records logged by this facility yet.'}
            </div>) : (<div className="space-y-3">
              {filteredHarvests.slice(0, 3).map((h: any) => (<div key={`harvest-${h.id}`} className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-extrabold text-slate-900 dark:text-white text-base">
                          {h.organ_name}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 text-xs font-black">
                          {h.blood_group}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-bold">
                          Status: {h.status}
                        </span>
                        {h.match_status && (<span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold border border-emerald-200 dark:border-emerald-800">
                            Match: {h.match_status}
                          </span>)}
                      </div>

                      <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                        <span>Donor: <strong className="text-slate-700 dark:text-slate-300">{h.donor_name}</strong></span>
                        <span className="text-slate-300 dark:text-slate-700">•</span>
                        <span>Procured: {new Date(h.harvested_at).toLocaleString()}</span>
                        <span className="text-slate-300 dark:text-slate-700">•</span>
                        <span>ID #{h.id}</span>
                      </div>

                      {h.recipient_hospital_name && (<p className="text-xs text-slate-600 dark:text-slate-300">
                          Matched Recipient Facility: <strong>{h.recipient_hospital_name}</strong>
                        </p>)}
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      <Link href={`/hospital/matches?organId=${h.id}`} className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-semibold text-xs transition-colors flex items-center gap-1.5">
                        <span>Match Candidates</span>
                        <ArrowRight className="w-3.5 h-3.5"/>
                      </Link>
                    </div>
                  </div>

                  {h.clinical_notes && (<div className="w-full pt-1">
                      <div className="p-3 rounded-xl bg-white/80 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-700/60 text-xs text-slate-700 dark:text-slate-300 leading-relaxed break-words whitespace-pre-wrap flex items-start gap-2.5">
                        <FileText className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0 mt-0.5"/>
                        <div className="min-w-0 flex-1">
                          <span className="font-semibold text-slate-900 dark:text-white mr-1.5 not-italic">Clinical Note:</span>
                          <span className="italic">{h.clinical_notes}</span>
                        </div>
                      </div>
                    </div>)}
                </div>))}

              {filteredHarvests.length > 3 && (<div className="pt-2 text-center">
                  <Link href="/hospital/history?type=harvests" className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-600 dark:text-rose-400 hover:underline">
                    View All {filteredHarvests.length} Harvest Records
                    <ArrowRight className="w-3.5 h-3.5"/>
                  </Link>
                </div>)}
            </div>)}
        </div>

        <div id="ledger-transplants" className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-900/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                <Activity className="w-5 h-5"/>
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  Organ Transplant Surgical Ledger
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Matched candidate allocations, surgical compatibility evaluations, and clinical procedures.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-900/60">
                {filteredTransplants.length} Allocation{filteredTransplants.length === 1 ? '' : 's'}
              </span>
              <Link href="/hospital/history?type=transplants" className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold transition-colors flex items-center gap-1.5">
                <span>Full Ledger</span>
                <ArrowRight className="w-3.5 h-3.5"/>
              </Link>
              <Link href="/hospital/matches" className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white text-xs font-semibold transition-colors flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5"/>
                <span>Decision Room</span>
              </Link>
            </div>
          </div>

          {filteredTransplants.length === 0 ? (<div className="text-center py-10 text-slate-400 dark:text-slate-500 text-xs bg-slate-50/50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
              {searchQuery.trim()
                ? `No transplant allocations match "${searchQuery}".`
                : 'No transplant surgical allocations recorded yet.'}
            </div>) : (<div className="space-y-3">
              {filteredTransplants.slice(0, 3).map((t: any) => (<div key={`transplant-${t.match_id}`} className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-extrabold text-slate-900 dark:text-white text-base">
                        {t.organ_name}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 text-xs font-black">
                        {t.blood_group}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold border border-emerald-200 dark:border-emerald-800">
                        Match Score: {t.match_score}/100
                      </span>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${t.match_status === 'ACCEPTED' || t.match_status === 'COMPLETED'
                    ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300'
                    : 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'}`}>
                        Status: {t.match_status}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                      <span>Recipient: <strong className="text-slate-700 dark:text-slate-300">{t.recipient_name}</strong></span>
                      <span className="text-slate-300 dark:text-slate-700">•</span>
                      <span>Procuring Hub: <strong>{t.harvesting_hub_name}</strong></span>
                      <span className="text-slate-300 dark:text-slate-700">•</span>
                      <span>Offered: {new Date(t.offered_at).toLocaleString()}</span>
                    </div>

                    {t.responded_at && (<p className="text-xs text-slate-500 dark:text-slate-400">
                        Responded on: {new Date(t.responded_at).toLocaleString()}
                      </p>)}
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    <Link href="/hospital/matches" className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-semibold text-xs transition-colors flex items-center gap-1.5">
                      <span>Decision Room</span>
                      <ArrowRight className="w-3.5 h-3.5"/>
                    </Link>
                  </div>
                </div>))}

              {filteredTransplants.length > 3 && (<div className="pt-2 text-center">
                  <Link href="/hospital/history?type=transplants" className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline">
                    View All {filteredTransplants.length} Transplant Allocations
                    <ArrowRight className="w-3.5 h-3.5"/>
                  </Link>
                </div>)}
            </div>)}
        </div>

        <div id="ledger-blood" className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-red-50 dark:bg-red-950/60 border border-red-200/80 dark:border-red-900/60 flex items-center justify-center text-red-600 dark:text-red-400 shrink-0">
                <Droplet className="w-5 h-5 fill-red-500/20"/>
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  Blood Supply & Dispense Transactions
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Complete audit of voluntary inward donations, outward clinical dispenses, and requisitions.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-200/80 dark:border-red-900/60">
                {filteredBlood.length} Transaction{filteredBlood.length === 1 ? '' : 's'}
              </span>
              <Link href="/hospital/history?type=blood" className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold transition-colors flex items-center gap-1.5">
                <span>Full Ledger</span>
                <ArrowRight className="w-3.5 h-3.5"/>
              </Link>
              <Link href="/hospital/inventory" className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white text-xs font-semibold transition-colors flex items-center gap-1.5">
                <BloodStockInventoryIcon className="w-3.5 h-3.5 text-red-400"/>
                <span>Blood Stock Inventory</span>
              </Link>
            </div>
          </div>

          {filteredBlood.length === 0 ? (<div className="text-center py-10 text-slate-400 dark:text-slate-500 text-xs bg-slate-50/50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
              {searchQuery.trim()
                ? `No blood transactions match "${searchQuery}".`
                : 'No blood transactions logged by this facility yet.'}
            </div>) : (<div className="space-y-3">
              {filteredBlood.slice(0, 3).map((b: any) => {
                const isInward = b.patient_relationship === 'VOLUNTARY_DONATION' ||
                    (b.donor_user_id && !b.requester_user_id);
                const isOutward = b.patient_relationship === 'HOSPITAL_DISPENSE' ||
                    b.patient_relationship === 'INVENTORY_DISPENSE';
                return (<div key={`blood-${b.id}`} className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all flex flex-col md:flex-row md:items-start justify-between gap-4 text-xs">
                    <div className="space-y-2 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {isInward ? (<span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            Inward Donation
                          </span>) : isOutward ? (<span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                            Outward Dispense
                          </span>) : (<span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                            Requisition
                          </span>)}

                        <span className="font-extrabold text-slate-900 dark:text-white text-sm">
                          {b.units_requested} Unit{b.units_requested === 1 ? '' : 's'} • {b.blood_group} ({b.component?.replace(/_/g, ' ') || 'Whole Blood'})
                        </span>

                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${b.status === 'COMPLETED'
                        ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                        : b.status === 'DISPATCHED'
                            ? 'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300'
                            : 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300'}`}>
                          {b.status}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400 flex-wrap">
                        {isInward ? (<span>
                            Donor: <strong className="text-slate-700 dark:text-slate-300">{b.donor_name || b.patient_name || 'Voluntary Donor'}</strong>
                            {b.donor_phone ? ` (${b.donor_phone})` : ''}
                          </span>) : isOutward ? (<span>
                            Recipient: <strong className="text-slate-700 dark:text-slate-300">{b.recipient_name || b.patient_name || 'Inpatient Recipient'}</strong>
                            {b.recipient_phone ? ` (${b.recipient_phone})` : ''}
                          </span>) : (<>
                            <span>Destination: <strong className="text-slate-700 dark:text-slate-300">{b.destination_hub_name}</strong></span>
                            {b.fulfilling_hub_name && (<>
                                <span className="text-slate-300 dark:text-slate-700">•</span>
                                <span>Fulfilling: <strong>{b.fulfilling_hub_name}</strong></span>
                              </>)}
                          </>)}

                        {b.hospital_bed_no && (<>
                            <span className="text-slate-300 dark:text-slate-700">•</span>
                            <span>Ward / Bed: <strong className="text-slate-700 dark:text-slate-300">{b.hospital_bed_no}</strong></span>
                          </>)}

                        <span className="text-slate-300 dark:text-slate-700">•</span>
                        <span>{new Date(b.fulfilled_at || b.created_at).toLocaleString()}</span>
                        <span className="text-slate-300 dark:text-slate-700">•</span>
                        <span>Ref #{b.id}</span>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      <Link href="/hospital/inventory" className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-xs transition-colors flex items-center gap-1.5">
                        <span>Blood Stock Inventory</span>
                        <ArrowRight className="w-3.5 h-3.5"/>
                      </Link>
                    </div>
                  </div>);
            })}

              {filteredBlood.length > 3 && (<div className="pt-2 text-center">
                  <Link href="/hospital/history?type=blood" className="inline-flex items-center gap-1.5 text-xs font-bold text-red-600 dark:text-red-400 hover:underline">
                    View All {filteredBlood.length} Blood Transactions
                    <ArrowRight className="w-3.5 h-3.5"/>
                  </Link>
                </div>)}
            </div>)}
        </div>
      </div>

      {isEditModalOpen && (<div className="fixed inset-0 z-50 overflow-y-auto p-4 sm:p-6 bg-slate-950/60 backdrop-blur-sm flex justify-center items-start sm:items-center animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 sm:p-8 max-w-lg w-full my-auto max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-4rem)] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-6">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-rose-600 dark:text-rose-400"/>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Update Facility Profile
                </h3>
              </div>
              <button type="button" onClick={() => setIsEditModalOpen(false)} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X className="w-5 h-5"/>
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Facility Name
                </label>
                <input type="text" required value={editFormData.name} onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"/>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Official Contact Phone
                </label>
                <input type="text" required value={editFormData.contact_phone} onChange={(e) => setEditFormData({ ...editFormData, contact_phone: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"/>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Address Line
                </label>
                <input type="text" required value={editFormData.address_line} onChange={(e) => setEditFormData({ ...editFormData, address_line: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"/>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    City
                  </label>
                  <input type="text" required value={editFormData.city} onChange={(e) => setEditFormData({ ...editFormData, city: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"/>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    State
                  </label>
                  <input type="text" required value={editFormData.state} onChange={(e) => setEditFormData({ ...editFormData, state: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"/>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Pincode
                  </label>
                  <input type="text" required value={editFormData.pincode} onChange={(e) => setEditFormData({ ...editFormData, pincode: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"/>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Latitude
                  </label>
                  <input type="number" step="any" value={editFormData.latitude} onChange={(e) => setEditFormData({ ...editFormData, latitude: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"/>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Longitude
                  </label>
                  <input type="number" step="any" value={editFormData.longitude} onChange={(e) => setEditFormData({ ...editFormData, longitude: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"/>
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                <button type="button" onClick={() => setIsEditModalOpen(false)} className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">
                  Cancel
                </button>
                <button type="submit" disabled={submittingEdit} className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs shadow-xs disabled:opacity-50">
                  {submittingEdit ? 'Saving...' : 'Save Profile Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>)}
    </div>);
}
