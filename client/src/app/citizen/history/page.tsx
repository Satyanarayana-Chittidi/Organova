'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { citizenApi } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import OrganImage from '@/components/OrganImage';
import { FindBloodIcon } from '@/components/BloodIcons';
import {
  Heart,
  Droplet,
  Building2,
  Calendar,
  Clock,
  ShieldCheck,
  Award,
  CheckCircle2,
  ArrowLeft,
  Search,
  Printer,
  MapPin,
  Activity,
  ChevronRight,
  AlertCircle,
  HeartHandshake,
  Truck,
  XCircle,
  User,
} from 'lucide-react';

interface BloodDonationItem {
  id: number;
  blood_group: string;
  component: string;
  units_requested: number;
  urgency: string;
  status: string;
  patient_relationship?: string | null;
  patient_name?: string | null;
  created_at: string;
  fulfilled_at?: string | null;
  receiving_hospital_name: string;
  receiving_hospital_city?: string;
  receiving_hospital_address?: string;
  receiving_hospital_phone?: string;
  fulfilling_hospital_name?: string | null;
  fulfilling_hospital_city?: string | null;
}

interface OrganDonationItem {
  id: number;
  blood_group: string;
  harvested_at: string;
  expires_at: string;
  status: string;
  clinical_notes?: string | null;
  organ_name: string;
  organ_code: string;
  organ_category: string;
  harvesting_hub_name: string;
  harvesting_hub_city?: string;
  harvesting_hub_address?: string;
  harvesting_hub_phone?: string;
  recipient_hospital_name?: string | null;
  match_status?: string | null;
}

interface DonationHistoryData {
  bloodDonations: BloodDonationItem[];
  bloodRequests?: any[];
  organDonations: OrganDonationItem[];
  organRequests?: any[];
  stats: {
    totalBloodDonations: number;
    completedBloodDonations: number;
    totalBloodUnitsDonated: number;
    totalOrgansDonated: number;
    organsTransplanted: number;
    activePledges: number;
    totalBloodRequested?: number;
  };
}

function DonationHistoryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromHome = searchParams?.get('from') === 'home';
  const typeParam = searchParams?.get('type')?.toUpperCase();
  const { user, loading: authLoading } = useAuth();

  const [data, setData] = useState<DonationHistoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dedicated Ledger Switcher: Blood and Organ kept strictly separate
  const [ledgerTab, setLedgerTab] = useState<'BLOOD' | 'ORGAN'>(
    typeParam === 'ORGAN' ? 'ORGAN' : 'BLOOD'
  );

  // Sync ledgerTab whenever URL searchParams change
  useEffect(() => {
    const currentType = searchParams?.get('type')?.toUpperCase();
    if (currentType === 'ORGAN') {
      setLedgerTab('ORGAN');
    } else if (currentType === 'BLOOD') {
      setLedgerTab('BLOOD');
    }
  }, [searchParams]);

  // Sub-filters within each dedicated ledger
  const [bloodFilter, setBloodFilter] = useState<'ALL' | 'DONATED' | 'REQUESTED' | 'RECEIVED' | 'CANCELLED'>('ALL');
  const [organFilter, setOrganFilter] = useState<'ALL' | 'DONATED' | 'RECEIVED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login');
      return;
    }

    const fetchHistory = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await citizenApi.getDonationHistory();
        if (res.success && res.data) {
          setData(res.data);
        } else {
          setError(res.message || 'Failed to load donation transaction records.');
        }
      } catch (err: any) {
        setError(err.message || 'Unable to retrieve donation history. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchHistory();
    }
  }, [user, authLoading, router]);

  // Blood Transactions: Donated, Requested, Received, Cancelled
  const bloodItems = useMemo(() => {
    if (!data) return [];

    const donated = (data.bloodDonations || []).map((b) => ({
      id: `blood-donated-${b.id}`,
      originalId: b.id,
      category: 'DONATED' as const,
      statusCategory: 'DONATED' as const,
      timestamp: b.fulfilled_at || b.created_at,
      units: b.units_requested,
      bloodGroup: b.blood_group,
      component: b.component?.replace(/_/g, ' ') || 'Whole Blood',
      facilityName: b.receiving_hospital_name,
      facilityCity: b.receiving_hospital_city,
      fulfillingFacility: b.fulfilling_hospital_name,
      patientRelationship: b.patient_relationship,
      patientName: b.patient_name,
      status: b.status,
      refId: `#PASS-BR${b.id}`,
      raw: b,
    }));

    const requests = (data.bloodRequests || []).map((b: any) => {
      const statusCategory = b.status === 'COMPLETED'
        ? ('RECEIVED' as const)
        : b.status === 'CANCELLED'
        ? ('CANCELLED' as const)
        : ('REQUESTED' as const);

      return {
        id: `blood-req-${b.id}`,
        originalId: b.id,
        category: 'REQUEST' as const,
        statusCategory,
        timestamp: b.fulfilled_at || b.created_at,
        units: b.units_requested,
        bloodGroup: b.blood_group,
        component: b.component?.replace(/_/g, ' ') || 'Whole Blood',
        facilityName: b.destination_hub_name,
        facilityCity: b.destination_hub_city,
        fulfillingFacility: b.fulfilling_hub_name,
        patientRelationship: b.patient_relationship,
        patientName: b.patient_name,
        status: b.status,
        refId: `#BR-${b.id}`,
        donorName: b.donor_name,
        donorPhone: b.donor_phone,
        raw: b,
      };
    });

    return [...donated, ...requests].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [data]);

  // Organ Transactions: Harvested Organs & Transplant Candidate Waitlist
  const organItems = useMemo(() => {
    if (!data) return [];

    const harvested = (data.organDonations || []).map((o) => ({
      id: `organ-donated-${o.id}`,
      originalId: o.id,
      category: 'DONATED' as const,
      timestamp: o.harvested_at,
      organName: o.organ_name,
      organCode: o.organ_code,
      bloodGroup: o.blood_group,
      facilityName: o.harvesting_hub_name,
      facilityCity: o.harvesting_hub_city,
      recipientHospital: o.recipient_hospital_name,
      status: o.status,
      matchStatus: o.match_status,
      refId: `#ORGAN-TX${o.id}`,
      raw: o,
    }));

    const waitlist = (data.organRequests || []).map((o: any) => ({
      id: `organ-received-${o.id}`,
      originalId: o.id,
      category: 'RECEIVED' as const,
      timestamp: o.created_at,
      organName: o.organ_name,
      organCode: o.organ_code,
      bloodGroup: o.blood_group,
      facilityName: o.attending_hub_name,
      facilityCity: o.attending_hub_city,
      recipientHospital: null,
      status: o.status,
      urgencyTier: o.urgency_tier,
      refId: `#REC-TX${o.id}`,
      raw: o,
    }));

    return [...harvested, ...waitlist].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [data]);

  // Filtered blood items
  const filteredBloodItems = useMemo(() => {
    return bloodItems.filter((item) => {
      if (bloodFilter !== 'ALL' && item.statusCategory !== bloodFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const facilityMatch = (item.facilityName || '').toLowerCase().includes(q);
        const cityMatch = (item.facilityCity || '').toLowerCase().includes(q);
        const groupMatch = (item.bloodGroup || '').toLowerCase().includes(q);
        const compMatch = (item.component || '').toLowerCase().includes(q);
        return facilityMatch || cityMatch || groupMatch || compMatch;
      }
      return true;
    });
  }, [bloodItems, bloodFilter, searchQuery]);

  // Filtered organ items
  const filteredOrganItems = useMemo(() => {
    return organItems.filter((item) => {
      if (organFilter === 'DONATED' && item.category !== 'DONATED') return false;
      if (organFilter === 'RECEIVED' && item.category !== 'RECEIVED') return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const organMatch = (item.organName || '').toLowerCase().includes(q);
        const facilityMatch = (item.facilityName || '').toLowerCase().includes(q);
        const cityMatch = (item.facilityCity || '').toLowerCase().includes(q);
        return organMatch || facilityMatch || cityMatch;
      }
      return true;
    });
  }, [organItems, organFilter, searchQuery]);

  // Status counts for Blood
  const bloodCounts = useMemo(() => {
    const donated = bloodItems.filter((b) => b.statusCategory === 'DONATED').length;
    const requested = bloodItems.filter((b) => b.statusCategory === 'REQUESTED').length;
    const received = bloodItems.filter((b) => b.statusCategory === 'RECEIVED').length;
    const cancelled = bloodItems.filter((b) => b.statusCategory === 'CANCELLED').length;
    return { donated, requested, received, cancelled, total: bloodItems.length };
  }, [bloodItems]);

  // Status counts for Organ
  const organCounts = useMemo(() => {
    const donated = organItems.filter((o) => o.category === 'DONATED').length;
    const received = organItems.filter((o) => o.category === 'RECEIVED').length;
    return { donated, received, total: organItems.length };
  }, [organItems]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-16 px-4 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
            Loading your verified medical ledger...
          </p>
        </div>
      </div>
    );
  }

  const stats = data?.stats || {
    totalBloodDonations: 0,
    completedBloodDonations: 0,
    totalBloodUnitsDonated: 0,
    totalOrgansDonated: 0,
    organsTransplanted: 0,
    activePledges: 0,
    totalBloodRequested: 0,
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-8 px-4 sm:px-6 lg:px-8 transition-colors">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Navigation Breadcrumb & Print Action */}
        <div className="flex items-center justify-between print:hidden">
          <Link
            href={fromHome ? '/' : '/citizen/profile'}
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" /> {fromHome ? 'Back to Home' : 'Back to Citizen Profile'}
          </Link>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-xs cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500" />
            Print Official Statement
          </button>
        </div>

        {/* Page Hero Header */}
        <div className="pb-2 border-b border-slate-200/80 dark:border-slate-800">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Lifetime Medical Ledger
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
              Record of your voluntary blood donations, emergency requests, received transfusions, and organ donations and transplants.
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

        {/* Top-Level Ledger Switcher Tabs: Separating Blood and Organ Completely */}
        <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-4 flex-wrap">
          <button
            type="button"
            onClick={() => {
              setLedgerTab('BLOOD');
              setSearchQuery('');
              const newUrl = fromHome ? '/citizen/history?type=blood&from=home' : '/citizen/history?type=blood';
              router.replace(newUrl, { scroll: false });
            }}
            className={`px-5 py-3 rounded-2xl font-bold text-xs sm:text-sm flex items-center gap-2.5 transition-all cursor-pointer ${
              ledgerTab === 'BLOOD'
                ? 'bg-rose-600 text-white shadow-sm ring-2 ring-rose-500/20'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/80'
            }`}
          >
            <Droplet className="w-4 h-4 fill-current" />
            Blood Transactions Ledger
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-black ${
                ledgerTab === 'BLOOD'
                  ? 'bg-white/20 text-white'
                  : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400'
              }`}
            >
              {bloodItems.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setLedgerTab('ORGAN');
              setSearchQuery('');
              const newUrl = fromHome ? '/citizen/history?type=organ&from=home' : '/citizen/history?type=organ';
              router.replace(newUrl, { scroll: false });
            }}
            className={`px-5 py-3 rounded-2xl font-bold text-xs sm:text-sm flex items-center gap-2.5 transition-all cursor-pointer ${
              ledgerTab === 'ORGAN'
                ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-500/20'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/80'
            }`}
          >
            <Activity className="w-4 h-4" />
            Organ & Transplant Ledger
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-black ${
                ledgerTab === 'ORGAN'
                  ? 'bg-white/20 text-white'
                  : 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400'
              }`}
            >
              {organItems.length}
            </span>
          </button>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* VIEW 1: BLOOD TRANSACTIONS LEDGER                             */}
        {/* ------------------------------------------------------------- */}
        {ledgerTab === 'BLOOD' && (
          <div className="space-y-6">
            {/* Blood Summary Metric Chips */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-0.5">
                  Blood Units Donated
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black text-slate-900 dark:text-white">
                    {stats.totalBloodUnitsDonated}
                  </span>
                  <span className="text-xs text-slate-500">Units</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  {stats.completedBloodDonations} completed donation{stats.completedBloodDonations === 1 ? '' : 's'}
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-0.5">
                  Emergency Requisitions
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black text-slate-900 dark:text-white">
                    {stats.totalBloodRequested || bloodCounts.requested + bloodCounts.received + bloodCounts.cancelled}
                  </span>
                  <span className="text-xs text-slate-500">Orders</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  {bloodCounts.requested} active • {bloodCounts.received} fulfilled
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-0.5">
                  Transfusions Received
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black text-blue-600 dark:text-blue-400">
                    {bloodCounts.received}
                  </span>
                  <span className="text-xs text-slate-500">Received</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Verified clinical dispenses
                </p>
              </div>
            </div>

            {/* Blood Filters & Search Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search hospital, city, blood type..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-rose-500"
                />
              </div>

              {/* Status Filter Buttons: All, Donated, Requested, Received, Cancelled */}
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
                  onClick={() => setBloodFilter('DONATED')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer shrink-0 flex items-center gap-1.5 ${
                    bloodFilter === 'DONATED'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 hover:bg-emerald-100'
                  }`}
                >
                  <HeartHandshake className="w-3 h-3" />
                  Donated ({bloodCounts.donated})
                </button>

                <button
                  type="button"
                  onClick={() => setBloodFilter('REQUESTED')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer shrink-0 flex items-center gap-1.5 ${
                    bloodFilter === 'REQUESTED'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 hover:bg-amber-100'
                  }`}
                >
                  <Clock className="w-3 h-3" />
                  Requested ({bloodCounts.requested})
                </button>

                <button
                  type="button"
                  onClick={() => setBloodFilter('RECEIVED')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer shrink-0 flex items-center gap-1.5 ${
                    bloodFilter === 'RECEIVED'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 hover:bg-blue-100'
                  }`}
                >
                  <CheckCircle2 className="w-3 h-3" />
                  Received ({bloodCounts.received})
                </button>

                {bloodCounts.cancelled > 0 && (
                  <button
                    type="button"
                    onClick={() => setBloodFilter('CANCELLED')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer shrink-0 flex items-center gap-1.5 ${
                      bloodFilter === 'CANCELLED'
                        ? 'bg-slate-700 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200'
                    }`}
                  >
                    <XCircle className="w-3 h-3" />
                    Cancelled ({bloodCounts.cancelled})
                  </button>
                )}
              </div>
            </div>

            {/* Blood Transactions List */}
            {filteredBloodItems.length === 0 ? (
              <div className="py-16 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 shadow-xs space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-rose-50 dark:bg-rose-950/50 flex items-center justify-center text-rose-600 dark:text-rose-400 mx-auto">
                  <Droplet className="w-7 h-7 fill-rose-500/20" />
                </div>
                <div className="max-w-md mx-auto">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    No matching blood transaction records found
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                    {searchQuery
                      ? 'No blood records matched your search filters. Try adjusting your search query.'
                      : 'You do not have any records in this blood status category yet.'}
                  </p>
                </div>
                <div className="pt-2 flex flex-wrap justify-center gap-3 print:hidden">
                  <Link
                    href="/blood-finder"
                    className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition-colors shadow-xs inline-flex items-center gap-2"
                  >
                    <FindBloodIcon className="w-3.5 h-3.5" />
                    Find Blood Emergencies
                  </Link>
                  <Link
                    href="/blood/emergency"
                    className="px-5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-200 text-xs font-semibold transition-colors inline-flex items-center gap-2"
                  >
                    <Droplet className="w-3.5 h-3.5" />
                    Request Blood
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredBloodItems.map((item) => (
                  <div
                    key={item.id}
                    className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col md:flex-row md:items-center justify-between gap-5"
                  >
                    <div className="flex items-start gap-4">
                      {/* Left Specimen Icon */}
                      <OrganImage organ="BLOOD" size="md" className="shrink-0" />

                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          {/* 1. Status Badge: strictly Donated, Requested, Received, Cancelled */}
                          {item.statusCategory === 'DONATED' ? (
                            item.status === 'DONOR_COMMITTED' ? (
                              <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wide bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 flex items-center gap-1.5">
                                <Truck className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                                Donated (En Route)
                              </span>
                            ) : (
                              <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wide bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1.5">
                                <HeartHandshake className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                Donated
                              </span>
                            )
                          ) : item.statusCategory === 'REQUESTED' ? (
                            <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wide bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                              Requested
                            </span>
                          ) : item.statusCategory === 'RECEIVED' ? (
                            <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wide bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-800 flex items-center gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                              Received
                            </span>
                          ) : (
                            <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wide bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 flex items-center gap-1.5">
                              <XCircle className="w-3.5 h-3.5 text-slate-400" />
                              Cancelled
                            </span>
                          )}

                          {/* Reference Number */}
                          <span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-300">
                            {item.refId}
                          </span>

                          {/* Secondary Clinical State Pill */}
                          <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                            {item.status === 'COMPLETED'
                              ? 'Transfusion Completed'
                              : item.status === 'DONOR_COMMITTED'
                              ? 'Donor Committed & En Route'
                              : item.status === 'APPROVED'
                              ? 'Claimed & Reserved in Bank'
                              : item.status === 'REQUESTED'
                              ? 'Awaiting Volunteer Donor'
                              : item.status === 'CANCELLED'
                              ? 'Order Cancelled'
                              : item.status}
                          </span>
                        </div>

                        {/* Title: Specimen & Volume */}
                        <h4 className="text-base font-bold text-slate-900 dark:text-white pt-0.5">
                          {item.units} Unit(s) • {item.bloodGroup} ({item.component})
                        </h4>

                        {/* Hospital & Location */}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-400 pt-0.5">
                          <span className="flex items-center gap-1 font-medium text-slate-900 dark:text-slate-200">
                            <Building2 className="w-3.5 h-3.5 text-slate-400" />
                            {item.statusCategory === 'DONATED' ? 'Receiving Hospital:' : 'Destination Hospital:'}{' '}
                            {item.facilityName}
                          </span>

                          {item.facilityCity && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5 text-slate-400" />
                              {item.facilityCity}
                            </span>
                          )}

                          <span className="flex items-center gap-1 text-slate-400">
                            <Calendar className="w-3.5 h-3.5" />
                            {new Date(item.timestamp).toLocaleDateString([], {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                        </div>

                        {item.fulfillingFacility && (
                          <p className="text-[11px] text-slate-500 pt-0.5">
                            Fulfilling Blood Bank: <strong>{item.fulfillingFacility}</strong>
                          </p>
                        )}

                        {/* Patient & Relationship if available */}
                        {(item.patientRelationship || item.patientName) && (
                          <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-slate-600 dark:text-slate-300">
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 flex items-center gap-1 font-medium">
                              <User className="w-3 h-3 text-rose-500" />
                              Recipient: <strong className="capitalize">{item.patientRelationship?.toLowerCase() === 'self' ? 'Myself' : (item.patientRelationship || 'Patient')}</strong>
                              {item.patientName ? ` (${item.patientName})` : ''}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right Column: Actions */}
                    <div className="flex flex-col sm:flex-row md:flex-col items-start md:items-end justify-between gap-3 shrink-0 pt-3 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-slate-800">
                      <span className="text-[11px] text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(item.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>

                      {item.statusCategory === 'DONATED' ? (
                        <Link
                          href={`/blood/donate/${item.originalId}?from=history`}
                          className="inline-flex items-center gap-1 text-xs font-bold text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300"
                        >
                          View Phlebotomy Requisition
                          <ChevronRight className="w-3.5 h-3.5" />
                        </Link>
                      ) : (
                        <Link
                          href={`/blood/donate/${item.originalId}?from=history`}
                          className="inline-flex items-center gap-1 text-xs font-bold text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300"
                        >
                          View Requisition Details
                          <ChevronRight className="w-3.5 h-3.5" />
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* VIEW 2: ORGAN & TRANSPLANT LEDGER                             */}
        {/* ------------------------------------------------------------- */}
        {ledgerTab === 'ORGAN' && (
          <div className="space-y-6">
            {/* Organ Summary Metric Chips */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-0.5">
                  Organs Donated
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black text-slate-900 dark:text-white">
                    {stats.totalOrgansDonated}
                  </span>
                  <span className="text-xs text-slate-500">Organs</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  {stats.organsTransplanted} successfully transplanted
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-0.5">
                  Pledged Organs
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black text-purple-600 dark:text-purple-400">
                    {stats.activePledges}
                  </span>
                  <span className="text-xs text-slate-500">Registered</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Legally certified donor registry
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-0.5">
                  Transplants Received
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black text-blue-600 dark:text-blue-400">
                    {organCounts.received}
                  </span>
                  <span className="text-xs text-slate-500">Cases</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Recipient registry & match history
                </p>
              </div>
            </div>

            {/* Organ Filters & Search Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search organ, hospital, city..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Sub-Filters: All, Donated Organs, Transplants Received */}
              <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
                <button
                  type="button"
                  onClick={() => setOrganFilter('ALL')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
                    organFilter === 'ALL'
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  All ({organCounts.total})
                </button>

                <button
                  type="button"
                  onClick={() => setOrganFilter('DONATED')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer shrink-0 flex items-center gap-1.5 ${
                    organFilter === 'DONATED'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 hover:bg-emerald-100 border border-emerald-200/80 dark:border-emerald-900/50'
                  }`}
                >
                  <HeartHandshake className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                  Donated Organs ({organCounts.donated})
                </button>

                <button
                  type="button"
                  onClick={() => setOrganFilter('RECEIVED')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer shrink-0 flex items-center gap-1.5 ${
                    organFilter === 'RECEIVED'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 hover:bg-blue-100 border border-blue-200/80 dark:border-blue-900/50'
                  }`}
                >
                  <Activity className="w-3 h-3 text-blue-500 dark:text-blue-400" />
                  Transplants Received ({organCounts.received})
                </button>
              </div>
            </div>

            {/* Organ Transactions List */}
            {filteredOrganItems.length === 0 ? (
              <div className="py-16 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 shadow-xs space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-600 dark:text-blue-400 mx-auto">
                  <Activity className="w-7 h-7" />
                </div>
                <div className="max-w-md mx-auto">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    No matching organ records found
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                    {searchQuery
                      ? 'No organ records matched your search query. Try adjusting your search keywords.'
                      : 'You do not have any records in this organ category yet.'}
                  </p>
                </div>
                <div className="pt-2 flex flex-wrap justify-center gap-3 print:hidden">
                  <Link
                    href="/donor/pledge"
                    className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors shadow-xs"
                  >
                    Pledge Organs & Tissues
                  </Link>
                  <Link
                    href="/transplant/waitlist-status"
                    className="px-5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-200 text-xs font-semibold transition-colors inline-flex items-center gap-1.5"
                  >
                    <Clock className="w-3.5 h-3.5 text-emerald-500" />
                    View Waitlist Status
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredOrganItems.map((item) => (
                  <div
                    key={item.id}
                    className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col md:flex-row md:items-center justify-between gap-5"
                  >
                    <div className="flex items-start gap-4">
                      {/* Left Organ Specimen Icon */}
                      <OrganImage
                        organ={item.organName || item.organCode}
                        size="md"
                        className="shrink-0"
                      />

                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          {/* Direction Indicator Pill (Soft pastel styling matching Blood Ledger) */}
                          {item.category === 'DONATED' ? (
                            <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wide bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1.5">
                              <HeartHandshake className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                              Organ Donated
                            </span>
                          ) : (
                            <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wide bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-800 flex items-center gap-1.5">
                              <Activity className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                              Transplant Received
                            </span>
                          )}

                          {/* Reference Number */}
                          <span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-300">
                            {item.refId}
                          </span>

                          {/* Secondary Clinical State Pill */}
                          <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
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
                              : item.status === 'AVAILABLE'
                              ? 'Donated — In Cold Storage'
                              : item.status === 'ALLOCATED'
                              ? 'Allocated for Recipient'
                              : item.status === 'IN_TRANSIT'
                              ? 'In Transit to Recipient'
                              : item.status === 'DELIVERED'
                              ? 'Delivered to Hospital'
                              : item.status === 'CANCELLED'
                              ? 'Waitlist Cancelled'
                              : item.status}
                          </span>
                        </div>

                        {/* Title */}
                        <h4 className="text-base font-bold text-slate-900 dark:text-white pt-0.5 flex items-center gap-1.5">
                          <span className={item.category === 'DONATED' ? 'text-emerald-600 dark:text-emerald-400' : 'text-blue-600 dark:text-blue-400'}>
                            {item.category === 'DONATED' ? 'Donated:' : 'Received:'}
                          </span>
                          <span>{item.organName} ({item.bloodGroup})</span>
                        </h4>

                        {/* Hospital & Location */}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-400 pt-0.5">
                          <span className="flex items-center gap-1 font-medium text-slate-900 dark:text-slate-200">
                            <Building2 className="w-3.5 h-3.5 text-slate-400" />
                            {item.category === 'DONATED' ? 'Donation Hospital:' : 'Transplant Hospital:'}{' '}
                            {item.facilityName}
                          </span>

                          {item.facilityCity && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5 text-slate-400" />
                              {item.facilityCity}
                            </span>
                          )}

                          <span className="flex items-center gap-1 text-slate-400">
                            <Calendar className="w-3.5 h-3.5" />
                            {new Date(item.timestamp).toLocaleDateString([], {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                        </div>

                        {item.recipientHospital && (
                          <p className="text-[11px] text-emerald-600 dark:text-emerald-400 pt-0.5 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            Transplanted at recipient center: <strong>{item.recipientHospital}</strong>
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Right Column: Actions */}
                    <div className="flex flex-col sm:flex-row md:flex-col items-start md:items-end justify-between gap-3 shrink-0 pt-3 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-slate-800">
                      <span className="text-[11px] text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(item.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>

                      <Link
                        href={`/transplant/record/${item.originalId}?type=${item.category === 'RECEIVED' ? 'request' : 'donation'}&from=history`}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                      >
                        <Clock className="w-3.5 h-3.5" />
                        {item.category === 'DONATED' ? 'View Organ Record' : 'View Transplant Record'}
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function DonationHistoryPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 py-16 px-4 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
              Loading donation history...
            </p>
          </div>
        </div>
      }
    >
      <DonationHistoryContent />
    </Suspense>
  );
}
