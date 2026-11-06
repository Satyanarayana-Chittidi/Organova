'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { hubApi } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import OrganImage from '@/components/OrganImage';
import {
  Hospital,
  Building2,
  ShieldCheck,
  Heart,
  Droplet,
  Users,
  Activity,
  Calendar,
  Clock,
  Search,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ArrowRight,
  FileText,
  Printer,
  ArrowLeft,
  User,
  Plus,
} from 'lucide-react';

export default function HospitalHistoryPage() {
  return (
    <Suspense
      fallback={
        <div className="py-20 text-center text-xs text-slate-400">
          Loading institutional transaction history...
        </div>
      }
    >
      <HospitalHistoryContent />
    </Suspense>
  );
}

function HospitalHistoryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawType = searchParams.get('type')?.toUpperCase();
  const { user, loading: authLoading } = useAuth();

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dedicated Top-Level Ledger Switcher: Organ Harvest, Transplant, Blood
  const getInitialTab = (type: string | undefined): 'HARVESTS' | 'TRANSPLANTS' | 'BLOOD' => {
    if (!type) return 'HARVESTS';
    if (type === 'BLOOD') return 'BLOOD';
    if (type === 'TRANSPLANTS' || type === 'TRANSPLANT') return 'TRANSPLANTS';
    return 'HARVESTS';
  };

  const [ledgerTab, setLedgerTab] = useState<'HARVESTS' | 'TRANSPLANTS' | 'BLOOD'>(
    getInitialTab(rawType)
  );

  // Sub-filters for each dedicated ledger
  const [harvestFilter, setHarvestFilter] = useState<'ALL' | 'AVAILABLE' | 'MATCHING' | 'ALLOCATED' | 'TRANSPLANTED' | 'EXPIRED'>('ALL');
  const [transplantFilter, setTransplantFilter] = useState<'ALL' | 'CONFIRMED' | 'PENDING' | 'DECLINED'>('ALL');
  const [bloodFilter, setBloodFilter] = useState<'ALL' | 'INWARD' | 'OUTWARD' | 'REQUISITION'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Sync ledgerTab with URL query parameters
  useEffect(() => {
    const current = searchParams.get('type')?.toUpperCase();
    if (current === 'BLOOD') {
      setLedgerTab('BLOOD');
    } else if (current === 'TRANSPLANTS' || current === 'TRANSPLANT') {
      setLedgerTab('TRANSPLANTS');
    } else if (current === 'HARVESTS' || current === 'HARVEST') {
      setLedgerTab('HARVESTS');
    }
  }, [searchParams]);

  const switchTab = (tab: 'HARVESTS' | 'TRANSPLANTS' | 'BLOOD') => {
    setLedgerTab(tab);
    setSearchQuery('');
    setHarvestFilter('ALL');
    setTransplantFilter('ALL');
    setBloodFilter('ALL');
    router.replace(`/hospital/history?type=${tab.toLowerCase()}`, { scroll: false });
  };

  const loadData = async () => {
    try {
      setError(null);
      const res = await hubApi.getMyHubHistory();
      if (res.success && res.data) {
        setData(res.data);
      } else {
        setError(res.message || 'Failed to retrieve transaction records.');
      }
    } catch (err: any) {
      setError(err.message || 'Error connecting to medical registry.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!authLoading && (!user || !['HOSPITAL', 'ADMIN'].includes(user.role))) {
      router.push('/auth/login');
      return;
    }
    if (user) loadData();
  }, [user, authLoading]);

  const handleManualRefresh = () => {
    setRefreshing(true);
    loadData();
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
  const bloodTransactions = data?.bloodTransactions || [];

  // Filtered Harvests
  const filteredHarvests = useMemo(() => {
    let result = harvests;
    if (harvestFilter !== 'ALL') {
      result = result.filter((h: any) => h.status === harvestFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((h: any) =>
        h.organ_name?.toLowerCase().includes(q) ||
        h.blood_group?.toLowerCase().includes(q) ||
        h.donor_name?.toLowerCase().includes(q) ||
        h.clinical_notes?.toLowerCase().includes(q) ||
        String(h.id).includes(q)
      );
    }
    return result;
  }, [harvests, harvestFilter, searchQuery]);

  // Filtered Transplants
  const filteredTransplants = useMemo(() => {
    let result = transplants;
    if (transplantFilter === 'CONFIRMED') {
      result = result.filter((t: any) => t.match_status === 'ACCEPTED' || t.match_status === 'COMPLETED');
    } else if (transplantFilter === 'PENDING') {
      result = result.filter((t: any) => t.match_status === 'PENDING_RESPONSE' || t.match_status === 'OFFERED');
    } else if (transplantFilter === 'DECLINED') {
      result = result.filter((t: any) => t.match_status === 'DECLINED' || t.match_status === 'EXPIRED');
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((t: any) =>
        t.organ_name?.toLowerCase().includes(q) ||
        t.blood_group?.toLowerCase().includes(q) ||
        t.recipient_name?.toLowerCase().includes(q) ||
        t.harvesting_hub_name?.toLowerCase().includes(q) ||
        String(t.match_id).includes(q)
      );
    }
    return result;
  }, [transplants, transplantFilter, searchQuery]);

  // Filtered Blood Transactions
  const filteredBlood = useMemo(() => {
    let result = bloodTransactions;
    if (bloodFilter === 'INWARD') {
      result = result.filter(
        (b: any) => b.patient_relationship === 'VOLUNTARY_DONATION' || (b.donor_user_id && !b.requester_user_id)
      );
    } else if (bloodFilter === 'OUTWARD') {
      result = result.filter(
        (b: any) => b.patient_relationship === 'HOSPITAL_DISPENSE' || b.patient_relationship === 'INVENTORY_DISPENSE'
      );
    } else if (bloodFilter === 'REQUISITION') {
      result = result.filter(
        (b: any) =>
          b.patient_relationship !== 'VOLUNTARY_DONATION' &&
          b.patient_relationship !== 'HOSPITAL_DISPENSE' &&
          b.patient_relationship !== 'INVENTORY_DISPENSE' &&
          !b.donor_user_id
      );
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((b: any) =>
        b.blood_group?.toLowerCase().includes(q) ||
        b.component?.toLowerCase().includes(q) ||
        b.destination_hub_name?.toLowerCase().includes(q) ||
        b.patient_name?.toLowerCase().includes(q) ||
        b.donor_name?.toLowerCase().includes(q) ||
        b.recipient_name?.toLowerCase().includes(q) ||
        b.hospital_bed_no?.toLowerCase().includes(q) ||
        String(b.id).includes(q)
      );
    }
    return result;
  }, [bloodTransactions, bloodFilter, searchQuery]);

  // Status counts for Harvests
  const harvestCounts = useMemo(() => {
    const available = harvests.filter((h: any) => h.status === 'AVAILABLE').length;
    const matching = harvests.filter((h: any) => h.status === 'MATCHING').length;
    const allocated = harvests.filter((h: any) => h.status === 'ALLOCATED').length;
    const transplanted = harvests.filter((h: any) => h.status === 'TRANSPLANTED').length;
    const expired = harvests.filter((h: any) => h.status === 'EXPIRED').length;
    return { available, matching, allocated, transplanted, expired, total: harvests.length };
  }, [harvests]);

  // Status counts for Transplants
  const transplantCounts = useMemo(() => {
    const confirmed = transplants.filter((t: any) => t.match_status === 'ACCEPTED' || t.match_status === 'COMPLETED').length;
    const pending = transplants.filter((t: any) => t.match_status === 'PENDING_RESPONSE' || t.match_status === 'OFFERED').length;
    const declined = transplants.filter((t: any) => t.match_status === 'DECLINED' || t.match_status === 'EXPIRED').length;
    return { confirmed, pending, declined, total: transplants.length };
  }, [transplants]);

  // Status counts for Blood
  const bloodCounts = useMemo(() => {
    const inward = bloodTransactions.filter(
      (b: any) => b.patient_relationship === 'VOLUNTARY_DONATION' || (b.donor_user_id && !b.requester_user_id)
    ).length;
    const outward = bloodTransactions.filter(
      (b: any) => b.patient_relationship === 'HOSPITAL_DISPENSE' || b.patient_relationship === 'INVENTORY_DISPENSE'
    ).length;
    const requisition = bloodTransactions.length - inward - outward;
    return { inward, outward, requisition, total: bloodTransactions.length };
  }, [bloodTransactions]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-16 px-4 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
            Loading facility transactional records...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-8 px-4 sm:px-6 lg:px-8 transition-colors">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Navigation Breadcrumb & Actions */}
        <div className="flex items-center justify-between print:hidden">
          <Link
            href="/hospital/profile"
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Facility Profile
          </Link>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-xs cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-slate-500" />
              Print Official Statement
            </button>
            <button
              type="button"
              onClick={handleManualRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-xs cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Page Hero Header */}
        <div className="pb-2 border-b border-slate-200/80 dark:border-slate-800">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 text-xs font-semibold mb-2">
              <Hospital className="w-3.5 h-3.5 text-blue-500" />
              Institutional Operations
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Facility Transactional History
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
              Complete clinical and supply chain ledger of organ procurements, surgical transplant allocations, and blood inventory operations for {facility?.name || 'this facility'}.
            </p>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Top-Level Ledger Switcher Tabs: Harvests, Transplants, Blood */}
        <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-4 flex-wrap">
          <button
            type="button"
            onClick={() => switchTab('HARVESTS')}
            className={`px-5 py-3 rounded-2xl font-bold text-xs sm:text-sm flex items-center gap-2.5 transition-all cursor-pointer ${
              ledgerTab === 'HARVESTS'
                ? 'bg-rose-600 text-white shadow-sm ring-2 ring-rose-500/20'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/80'
            }`}
          >
            <Heart className="w-4 h-4 fill-current" />
            Organ Harvest Ledger
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-black ${
                ledgerTab === 'HARVESTS'
                  ? 'bg-white/20 text-white'
                  : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400'
              }`}
            >
              {harvests.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => switchTab('TRANSPLANTS')}
            className={`px-5 py-3 rounded-2xl font-bold text-xs sm:text-sm flex items-center gap-2.5 transition-all cursor-pointer ${
              ledgerTab === 'TRANSPLANTS'
                ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-500/20'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/80'
            }`}
          >
            <Activity className="w-4 h-4" />
            Transplants Surgical Ledger
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-black ${
                ledgerTab === 'TRANSPLANTS'
                  ? 'bg-white/20 text-white'
                  : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
              }`}
            >
              {transplants.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => switchTab('BLOOD')}
            className={`px-5 py-3 rounded-2xl font-bold text-xs sm:text-sm flex items-center gap-2.5 transition-all cursor-pointer ${
              ledgerTab === 'BLOOD'
                ? 'bg-red-600 text-white shadow-sm ring-2 ring-red-500/20'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/80'
            }`}
          >
            <Droplet className="w-4 h-4 fill-current" />
            Blood Transactions Ledger
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-black ${
                ledgerTab === 'BLOOD'
                  ? 'bg-white/20 text-white'
                  : 'bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-400'
              }`}
            >
              {bloodTransactions.length}
            </span>
          </button>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* VIEW 1: ORGAN HARVEST PROCUREMENT LEDGER                      */}
        {/* ------------------------------------------------------------- */}
        {ledgerTab === 'HARVESTS' && (
          <div className="space-y-6">
            {/* Metric Chips */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-0.5">
                  Total Harvested
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black text-slate-900 dark:text-white">
                    {harvestCounts.total}
                  </span>
                  <span className="text-xs text-slate-500">Organs</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  {harvestCounts.available + harvestCounts.matching} active grafts
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-0.5">
                  Viable & Available
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black text-rose-600 dark:text-rose-400">
                    {harvestCounts.available}
                  </span>
                  <span className="text-xs text-slate-500">Available</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Awaiting candidate match
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-0.5">
                  Transplanted / Allocated
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                    {harvestCounts.allocated + harvestCounts.transplanted}
                  </span>
                  <span className="text-xs text-slate-500">Grafts</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Surgical completion
                </p>
              </div>
            </div>

            {/* Harvests Filters & Search Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search organ, donor, ABO, ID, notes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-rose-500"
                />
              </div>

              {/* Status Filter Buttons */}
              <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
                <button
                  type="button"
                  onClick={() => setHarvestFilter('ALL')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
                    harvestFilter === 'ALL'
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  All ({harvestCounts.total})
                </button>
                <button
                  type="button"
                  onClick={() => setHarvestFilter('AVAILABLE')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
                    harvestFilter === 'AVAILABLE'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  Available ({harvestCounts.available})
                </button>
                <button
                  type="button"
                  onClick={() => setHarvestFilter('MATCHING')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
                    harvestFilter === 'MATCHING'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  Matching ({harvestCounts.matching})
                </button>
                <button
                  type="button"
                  onClick={() => setHarvestFilter('ALLOCATED')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
                    harvestFilter === 'ALLOCATED'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  Allocated ({harvestCounts.allocated})
                </button>
                <button
                  type="button"
                  onClick={() => setHarvestFilter('TRANSPLANTED')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
                    harvestFilter === 'TRANSPLANTED'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  Transplanted ({harvestCounts.transplanted})
                </button>
              </div>
            </div>

            {/* Harvests List */}
            {filteredHarvests.length === 0 ? (
              <div className="text-center py-12 text-slate-400 dark:text-slate-500 text-xs bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8">
                No organ harvests match the current filters.
              </div>
            ) : (
              <div className="space-y-4">
                {filteredHarvests.map((h: any) => (
                  <div
                    key={`hist-harvest-${h.id}`}
                    className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all space-y-3 text-xs"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-start gap-3.5 flex-1 min-w-0">
                        <OrganImage organ={h.organ_name || h.organ_code} size="md" className="shrink-0 mt-0.5" />
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
                            {h.match_status && (
                              <span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold border border-emerald-200 dark:border-emerald-800">
                                Match: {h.match_status}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400 flex-wrap">
                            <span>Donor: <strong className="text-slate-700 dark:text-slate-300">{h.donor_name}</strong></span>
                            <span className="text-slate-300 dark:text-slate-700">•</span>
                            <span>Procured: {new Date(h.harvested_at).toLocaleString()}</span>
                            <span className="text-slate-300 dark:text-slate-700">•</span>
                            <span>ID #{h.id}</span>
                          </div>

                          {h.recipient_hospital_name && (
                            <p className="text-slate-600 dark:text-slate-300">
                              Matched Recipient Facility: <strong>{h.recipient_hospital_name}</strong>
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-2">
                        <Link
                          href={`/hospital/matches?organId=${h.id}`}
                          className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-semibold text-xs transition-colors flex items-center gap-1.5 shadow-xs"
                        >
                          <span>Match Candidates</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </div>

                    {h.clinical_notes && (
                      <div className="w-full pt-1">
                        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 text-xs text-slate-700 dark:text-slate-300 leading-relaxed break-words whitespace-pre-wrap flex items-start gap-2.5">
                          <FileText className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0 mt-0.5" />
                          <div className="min-w-0 flex-1">
                            <span className="font-semibold text-slate-900 dark:text-white mr-1.5">Clinical Note:</span>
                            <span className="italic">{h.clinical_notes}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* VIEW 2: ORGAN TRANSPLANT SURGICAL LEDGER                      */}
        {/* ------------------------------------------------------------- */}
        {ledgerTab === 'TRANSPLANTS' && (
          <div className="space-y-6">
            {/* Metric Chips */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-0.5">
                  Total Allocations
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black text-slate-900 dark:text-white">
                    {transplantCounts.total}
                  </span>
                  <span className="text-xs text-slate-500">Cases</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Matched candidate evaluations
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-0.5">
                  Transplants Confirmed
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                    {transplantCounts.confirmed}
                  </span>
                  <span className="text-xs text-slate-500">Accepted</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Surgically confirmed procedures
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-0.5">
                  Pending Review
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black text-amber-600 dark:text-amber-400">
                    {transplantCounts.pending}
                  </span>
                  <span className="text-xs text-slate-500">Active</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Awaiting surgical acceptance
                </p>
              </div>
            </div>

            {/* Transplants Filters & Search Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search recipient, organ, ABO, hospital..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Status Filter Buttons */}
              <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
                <button
                  type="button"
                  onClick={() => setTransplantFilter('ALL')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
                    transplantFilter === 'ALL'
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  All ({transplantCounts.total})
                </button>
                <button
                  type="button"
                  onClick={() => setTransplantFilter('CONFIRMED')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
                    transplantFilter === 'CONFIRMED'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  Confirmed ({transplantCounts.confirmed})
                </button>
                <button
                  type="button"
                  onClick={() => setTransplantFilter('PENDING')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
                    transplantFilter === 'PENDING'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  Pending Review ({transplantCounts.pending})
                </button>
                <button
                  type="button"
                  onClick={() => setTransplantFilter('DECLINED')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
                    transplantFilter === 'DECLINED'
                      ? 'bg-slate-900 text-white dark:bg-slate-700 shadow-xs'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  Declined ({transplantCounts.declined})
                </button>
              </div>
            </div>

            {/* Transplants List */}
            {filteredTransplants.length === 0 ? (
              <div className="text-center py-12 text-slate-400 dark:text-slate-500 text-xs bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8">
                No transplant allocations match the current filters.
              </div>
            ) : (
              <div className="space-y-4">
                {filteredTransplants.map((t: any) => (
                  <div
                    key={`hist-transplant-${t.match_id}`}
                    className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col md:flex-row md:items-start justify-between gap-4 text-xs"
                  >
                    <div className="flex items-start gap-3.5 flex-1 min-w-0">
                      <OrganImage organ={t.organ_name || t.organ_code} size="md" className="shrink-0 mt-0.5" />
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-extrabold text-slate-900 dark:text-white text-base">
                            {t.organ_name}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 text-xs font-black">
                            {t.blood_group}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold border border-emerald-200 dark:border-emerald-800">
                            Score: {t.match_score}/100
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              t.match_status === 'ACCEPTED' || t.match_status === 'COMPLETED'
                                ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300'
                                : 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                            }`}
                          >
                            {t.match_status}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400 flex-wrap">
                          <span>Recipient: <strong className="text-slate-700 dark:text-slate-300">{t.recipient_name}</strong></span>
                          <span className="text-slate-300 dark:text-slate-700">•</span>
                          <span>Procuring Facility: <strong>{t.harvesting_hub_name}</strong></span>
                          <span className="text-slate-300 dark:text-slate-700">•</span>
                          <span>Matched: {new Date(t.offered_at).toLocaleString()}</span>
                        </div>

                        {t.responded_at && (
                          <p className="text-slate-500 dark:text-slate-400">
                            Responded on: {new Date(t.responded_at).toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      <Link
                        href="/hospital/matches"
                        className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-semibold text-xs transition-colors flex items-center gap-1.5 shadow-xs"
                      >
                        <span>Match Engine</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* VIEW 3: BLOOD TRANSACTIONS LEDGER                             */}
        {/* ------------------------------------------------------------- */}
        {ledgerTab === 'BLOOD' && (
          <div className="space-y-6">
            {/* Metric Chips */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-0.5">
                  Total Transactions
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black text-slate-900 dark:text-white">
                    {bloodCounts.total}
                  </span>
                  <span className="text-xs text-slate-500">Orders</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  All supply chain events
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-0.5">
                  Inward Donations
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                    {bloodCounts.inward}
                  </span>
                  <span className="text-xs text-slate-500">Donations</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Voluntary donor arrivals
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-0.5">
                  Outward Dispenses
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black text-blue-600 dark:text-blue-400">
                    {bloodCounts.outward}
                  </span>
                  <span className="text-xs text-slate-500">Dispenses</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Verified inpatient transfusions
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-red-50/60 dark:bg-red-950/40 border border-red-200/80 dark:border-red-900/60">
                <span className="text-[11px] font-semibold text-red-800 dark:text-red-300 block mb-0.5">
                  Emergency Requisitions
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black text-red-700 dark:text-red-400">
                    {bloodCounts.requisition}
                  </span>
                  <span className="text-xs text-red-600">Requisitions</span>
                </div>
                <p className="text-[10px] text-red-700/80 mt-1">
                  Inter-facility & emergency orders
                </p>
              </div>
            </div>

            {/* Blood Filters & Search Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search group, donor, recipient, ward, ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-red-500"
                />
              </div>

              {/* Category Filter Buttons */}
              <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
                <button
                  type="button"
                  onClick={() => setBloodFilter('ALL')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
                    bloodFilter === 'ALL'
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  All ({bloodCounts.total})
                </button>
                <button
                  type="button"
                  onClick={() => setBloodFilter('INWARD')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
                    bloodFilter === 'INWARD'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  Inward Donations ({bloodCounts.inward})
                </button>
                <button
                  type="button"
                  onClick={() => setBloodFilter('OUTWARD')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
                    bloodFilter === 'OUTWARD'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  Outward Dispenses ({bloodCounts.outward})
                </button>
                <button
                  type="button"
                  onClick={() => setBloodFilter('REQUISITION')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
                    bloodFilter === 'REQUISITION'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  Requisitions ({bloodCounts.requisition})
                </button>
              </div>
            </div>

            {/* Blood List */}
            {filteredBlood.length === 0 ? (
              <div className="text-center py-12 text-slate-400 dark:text-slate-500 text-xs bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8">
                No blood transactions match the current filters.
              </div>
            ) : (
              <div className="space-y-4">
                {filteredBlood.map((b: any) => {
                  const isInward =
                    b.patient_relationship === 'VOLUNTARY_DONATION' ||
                    (b.donor_user_id && !b.requester_user_id);
                  const isOutward =
                    b.patient_relationship === 'HOSPITAL_DISPENSE' ||
                    b.patient_relationship === 'INVENTORY_DISPENSE';

                  return (
                    <div
                      key={`hist-blood-${b.id}`}
                      className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col md:flex-row md:items-start justify-between gap-4 text-xs"
                    >
                      <div className="flex items-start gap-3.5 flex-1 min-w-0">
                        <OrganImage organ="BLOOD" size="md" className="shrink-0 mt-0.5" />
                        <div className="space-y-2 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {isInward ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                              Inward Donation
                            </span>
                          ) : isOutward ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                              Outward Dispense
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                              Requisition
                            </span>
                          )}

                          <span className="font-extrabold text-slate-900 dark:text-white text-sm">
                            {b.units_requested} Unit{b.units_requested === 1 ? '' : 's'} • {b.blood_group} ({b.component?.replace(/_/g, ' ') || 'Whole Blood'})
                          </span>

                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              b.status === 'COMPLETED'
                                ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                                : b.status === 'DISPATCHED'
                                ? 'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300'
                                : 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300'
                            }`}
                          >
                            {b.status}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400 flex-wrap">
                          {isInward ? (
                            <span>
                              Donor: <strong className="text-slate-700 dark:text-slate-300">{b.donor_name || b.patient_name || 'Voluntary Donor'}</strong>
                              {b.donor_phone ? ` (${b.donor_phone})` : ''}
                            </span>
                          ) : isOutward ? (
                            <span>
                              Recipient: <strong className="text-slate-700 dark:text-slate-300">{b.recipient_name || b.patient_name || 'Inpatient Recipient'}</strong>
                              {b.recipient_phone ? ` (${b.recipient_phone})` : ''}
                            </span>
                          ) : (
                            <>
                              <span>Destination: <strong className="text-slate-700 dark:text-slate-300">{b.destination_hub_name}</strong></span>
                              {b.fulfilling_hub_name && (
                                <>
                                  <span className="text-slate-300 dark:text-slate-700">•</span>
                                  <span>Fulfilling: <strong>{b.fulfilling_hub_name}</strong></span>
                                </>
                              )}
                            </>
                          )}

                          {b.hospital_bed_no && (
                            <>
                              <span className="text-slate-300 dark:text-slate-700">•</span>
                              <span>Ward / Bed: <strong className="text-slate-700 dark:text-slate-300">{b.hospital_bed_no}</strong></span>
                            </>
                          )}

                          <span className="text-slate-300 dark:text-slate-700">•</span>
                          <span>{new Date(b.fulfilled_at || b.created_at).toLocaleString()}</span>
                          <span className="text-slate-300 dark:text-slate-700">•</span>
                          <span>Ref #{b.id}</span>
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                        <Link
                          href="/hospital/inventory"
                          className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-xs transition-colors flex items-center gap-1.5 shadow-xs"
                        >
                          <span>Inventory</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
