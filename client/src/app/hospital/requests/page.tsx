'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { transplantApi, organApi } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import CitizenAccountLinker, { LinkedCitizen } from '@/components/CitizenAccountLinker';
import OrganImage from '@/components/OrganImage';
import { MatchEngineIcon } from '@/components/HospitalPortalIcons';
import {
  Activity,
  Heart,
  Clock,
  PlusCircle,
  Search,
  Filter,
  RefreshCw,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Building2,
  Calendar,
  X,
  Droplet,
  Users,
  ChevronRight,
  Flame,
  FileText,
} from 'lucide-react';

interface WaitlistCandidate {
  id: number;
  recipient_user_id: string;
  attending_hub_id: number;
  organ_type_id: number;
  blood_group: string;
  urgency_tier: 'TIER_1_EMERGENCY' | 'TIER_2_URGENT' | 'TIER_3_ROUTINE';
  medical_summary: string;
  status: string;
  verified_at: string | null;
  created_at: string;
  recipient_email?: string;
  recipient_name?: string;
  attending_hub_name?: string;
  attending_hub_city?: string;
  organ_name?: string;
  organ_code?: string;
  days_waiting?: number;
  active_organ_id?: number;
  active_match_id?: number;
}

export default function HospitalRequestsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [waitlist, setWaitlist] = useState<WaitlistCandidate[]>([]);
  const [organTypes, setOrganTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrganType, setSelectedOrganType] = useState<string>('ALL');
  const [selectedUrgency, setSelectedUrgency] = useState<string>('ALL');
  const [selectedBloodGroup, setSelectedBloodGroup] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [linkedCitizen, setLinkedCitizen] = useState<LinkedCitizen | null>(null);

  // New Patient Form State
  const [formData, setFormData] = useState({
    organ_type_id: 4, // default Kidney
    blood_group: 'O+',
    urgency_tier: 'TIER_2_URGENT',
    medical_summary: '',
  });

  const loadData = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);

    try {
      const [queueRes, typesRes] = await Promise.all([
        transplantApi.getWaitlist(),
        organApi.getTypes(),
      ]);

      if (queueRes.success) {
        setWaitlist(Array.isArray(queueRes.data) ? queueRes.data : []);
      }
      if (typesRes.success) {
        const types = Array.isArray(typesRes.data) ? typesRes.data : [];
        setOrganTypes(types);
        if (types.length > 0 && !formData.organ_type_id) {
          setFormData((prev) => ({ ...prev, organ_type_id: types[0].id }));
        }
      }
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: err.message || 'Failed to load transplant waitlist queue.',
      });
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

  // Handle Register Candidate
  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!linkedCitizen) {
      setFormError('Please link an existing citizen account or create a new account.');
      return;
    }

    if (!formData.medical_summary.trim()) {
      setFormError('Please provide the clinical summary and crossmatch workup.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await transplantApi.addPatient({
        recipient_user_id: linkedCitizen.id,
        patient_name: linkedCitizen.full_name,
        patient_email: linkedCitizen.email,
        patient_phone: linkedCitizen.phone_number,
        patient_dob: linkedCitizen.date_of_birth,
        organ_type_id: Number(formData.organ_type_id),
        blood_group: linkedCitizen.blood_group || formData.blood_group,
        urgency_tier: formData.urgency_tier,
        medical_summary: formData.medical_summary.trim(),
      });

      if (res.success) {
        setNotification({
          type: 'success',
          message: `Candidate ${linkedCitizen.full_name} (${linkedCitizen.email}) enrolled successfully on waitlist! Linked directly to their Waitlist Status & record.`,
        });
        setIsModalOpen(false);
        setLinkedCitizen(null);
        setFormData({
          organ_type_id: organTypes.length > 0 ? organTypes[0].id : 4,
          blood_group: 'O+',
          urgency_tier: 'TIER_2_URGENT',
          medical_summary: '',
        });
        await loadData(true);
      } else {
        setFormError(res.message || 'Failed to register candidate.');
      }
    } catch (err: any) {
      setFormError(err.message || 'Failed to register candidate.');
    } finally {
      setSubmitting(false);
    }
  };

  // Filtered Queue
  const filteredWaitlist = waitlist.filter((c) => {
    if (selectedOrganType !== 'ALL' && String(c.organ_type_id) !== selectedOrganType) return false;
    if (selectedUrgency !== 'ALL' && c.urgency_tier !== selectedUrgency) return false;
    if (selectedBloodGroup !== 'ALL' && c.blood_group !== selectedBloodGroup) return false;
    if (selectedStatus !== 'ALL' && c.status !== selectedStatus) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const name = (c.recipient_name || '').toLowerCase();
      const email = (c.recipient_email || '').toLowerCase();
      const summary = (c.medical_summary || '').toLowerCase();
      const hub = (c.attending_hub_name || '').toLowerCase();
      const id = String(c.id);
      return name.includes(q) || email.includes(q) || summary.includes(q) || hub.includes(q) || id.includes(q);
    }
    return true;
  });

  // KPI Calculations
  const totalCount = waitlist.length;
  const emergencyCount = waitlist.filter((c) => c.urgency_tier === 'TIER_1_EMERGENCY').length;
  const urgentCount = waitlist.filter((c) => c.urgency_tier === 'TIER_2_URGENT').length;
  const matchOfferedCount = waitlist.filter((c) => c.status === 'MATCH_OFFERED').length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full transition-colors duration-200">
      {/* Top Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-slate-200 dark:border-slate-800 gap-4 mb-8">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50 text-xs font-semibold mb-2">
            <Clock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            Clinical Waitlist & Allocation Queue
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Transplant Waitlist Requisitions
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Real-time prioritized recipient queue across network medical facilities with multi-factor crossmatching.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Refresh Button */}
          <button
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 transition-colors cursor-pointer"
            title="Refresh Queue"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>

          {/* Decision Room Link */}
          <Link
            href="/hospital/matches"
            className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800 text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <MatchEngineIcon className="w-3.5 h-3.5 text-indigo-500" />
            Decision Room →
          </Link>

          {/* Register Patient Button */}
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-red-500 hover:from-rose-500 hover:to-red-600 text-white font-bold text-xs shadow-md shadow-rose-500/20 flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            Register Candidate
          </button>
        </div>
      </div>

      {/* Notification Banner */}
      {notification && (
        <div
          className={`mb-6 p-4 rounded-2xl border text-xs sm:text-sm font-medium flex items-center justify-between gap-3 ${
            notification.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
              : 'bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="p-1 hover:opacity-70 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* KPI Cards Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* KPI 1: Total */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <span className="text-2xl font-black text-slate-900 dark:text-white leading-tight block">
              {totalCount}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Total Candidates
            </span>
          </div>
        </div>

        {/* KPI 2: Tier 1 Emergency */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
            <Flame className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-2xl font-black text-red-600 dark:text-red-400 leading-tight">
                {emergencyCount}
              </span>
              {emergencyCount > 0 && (
                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
              )}
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Tier 1 Emergency
            </span>
          </div>
        </div>

        {/* KPI 3: Tier 2 Urgent */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-2xl font-black text-amber-600 dark:text-amber-400 leading-tight block">
              {urgentCount}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Tier 2 Urgent
            </span>
          </div>
        </div>

        {/* KPI 4: Pending Match Offers */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400 leading-tight block">
              {matchOfferedCount}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Active Match Offers
            </span>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs mb-8 space-y-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by patient name, ID, diagnosis..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:border-rose-500"
            />
          </div>

          {/* Quick Filters */}
          <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
            {/* Organ Filter */}
            <select
              value={selectedOrganType}
              onChange={(e) => setSelectedOrganType(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 focus:outline-hidden focus:border-rose-500"
            >
              <option value="ALL">All Organs</option>
              {organTypes.map((t) => (
                <option key={t.id} value={String(t.id)}>
                  {t.name}
                </option>
              ))}
            </select>

            {/* Urgency Filter */}
            <select
              value={selectedUrgency}
              onChange={(e) => setSelectedUrgency(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 focus:outline-hidden focus:border-rose-500"
            >
              <option value="ALL">All Urgencies</option>
              <option value="TIER_1_EMERGENCY">Tier 1 - Emergency</option>
              <option value="TIER_2_URGENT">Tier 2 - Urgent</option>
              <option value="TIER_3_ROUTINE">Tier 3 - Routine</option>
            </select>

            {/* Blood Group Filter */}
            <select
              value={selectedBloodGroup}
              onChange={(e) => setSelectedBloodGroup(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 focus:outline-hidden focus:border-rose-500"
            >
              <option value="ALL">All Blood Types</option>
              {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((bg) => (
                <option key={bg} value={bg}>
                  {bg}
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 focus:outline-hidden focus:border-rose-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="WAITING_LIST">Waiting List</option>
              <option value="MATCH_OFFERED">Match Offered</option>
              <option value="ACCEPTED">Accepted / Allocated</option>
              <option value="SURGERY_SCHEDULED">Surgery Scheduled</option>
              <option value="FULFILLED">Fulfilled</option>
            </select>

            {(selectedOrganType !== 'ALL' ||
              selectedUrgency !== 'ALL' ||
              selectedBloodGroup !== 'ALL' ||
              selectedStatus !== 'ALL' ||
              searchQuery) && (
              <button
                onClick={() => {
                  setSelectedOrganType('ALL');
                  setSelectedUrgency('ALL');
                  setSelectedBloodGroup('ALL');
                  setSelectedStatus('ALL');
                  setSearchQuery('');
                }}
                className="px-3 py-2 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors cursor-pointer"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Waitlist Queue List */}
      {loading ? (
        <div className="py-20 flex flex-col justify-center items-center text-slate-400 text-xs gap-3">
          <span className="w-6 h-6 border-3 border-rose-500 border-t-transparent rounded-full animate-spin"></span>
          <span>Loading clinical waitlist records...</span>
        </div>
      ) : filteredWaitlist.length === 0 ? (
        <div className="p-12 text-center rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <Users className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-900 dark:text-white">No transplant candidates found</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
            {searchQuery || selectedOrganType !== 'ALL' || selectedUrgency !== 'ALL'
              ? 'No candidates match the selected filters. Try clearing your search parameters.'
              : 'No pending transplant candidates found in the registry. Click "Register Patient" below to add a candidate to the waitlist.'}
          </p>
          <div className="mt-5 flex justify-center gap-3">
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              Register Patient
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredWaitlist.map((candidate) => {
            const isEmergency = candidate.urgency_tier === 'TIER_1_EMERGENCY';
            const isUrgent = candidate.urgency_tier === 'TIER_2_URGENT';

            return (
              <div
                key={candidate.id}
                className={`p-5 rounded-2xl border transition-all duration-200 bg-white dark:bg-slate-900 ${
                  isEmergency
                    ? 'border-red-200 dark:border-red-900/60 shadow-xs hover:border-red-300 dark:hover:border-red-800'
                    : isUrgent
                    ? 'border-amber-200 dark:border-amber-900/50 shadow-xs hover:border-amber-300 dark:hover:border-amber-800'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left: Patient Details & Badges */}
                  <div className="flex items-start gap-3.5 flex-1 min-w-0">
                    <OrganImage
                      organ={candidate.organ_name || candidate.organ_code}
                      size="md"
                      className="shrink-0 mt-0.5"
                    />
                    <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Urgency Badge */}
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                          isEmergency
                            ? 'bg-red-50 dark:bg-red-950/70 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800'
                            : isUrgent
                            ? 'bg-amber-50 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                            : 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                        }`}
                      >
                        {isEmergency && <Flame className="w-3 h-3 text-red-600 animate-pulse" />}
                        {isEmergency
                          ? 'Tier 1 Emergency (Status 1A)'
                          : isUrgent
                          ? 'Tier 2 Urgent'
                          : 'Tier 3 Routine'}
                      </span>

                      {/* Organ Badge */}
                      <span className="px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-black">
                        {candidate.organ_name || candidate.organ_code || 'Organ'}
                      </span>

                      {/* Blood Group */}
                      <span className="px-2.5 py-0.5 rounded-md bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 text-xs font-black">
                        {candidate.blood_group}
                      </span>

                      {/* Status Badge */}
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                          candidate.status === 'WAITING_LIST'
                            ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                            : candidate.status === 'MATCH_OFFERED'
                            ? 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 animate-pulse'
                            : candidate.status === 'ACCEPTED'
                            ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {candidate.status.replace(/_/g, ' ')}
                      </span>
                    </div>

                    {/* Patient Name and Hub Details */}
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-slate-900 dark:text-white">
                          {candidate.recipient_name || 'Anonymous Recipient'}
                        </h3>
                        <span className="text-xs text-slate-400 font-mono">
                          #REQ-{candidate.id}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
                        <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>Attending Hospital: <strong className="text-slate-700 dark:text-slate-300">{candidate.attending_hub_name || 'Hospital'}</strong> ({candidate.attending_hub_city || 'City'})</span>
                        {candidate.recipient_email && (
                          <span className="text-slate-400">• {candidate.recipient_email}</span>
                        )}
                      </p>
                    </div>

                    {/* Medical Summary */}
                    {candidate.medical_summary && (
                      <p className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-100 dark:border-slate-800 leading-relaxed">
                        {candidate.medical_summary.replace(/\[MOCK TEST\]\s*/gi, '').replace(/\[TEST\]\s*/gi, '').trim()}
                      </p>
                    )}
                  </div>
                </div>

                {/* Right: Days Waiting */}
                  <div className="flex lg:flex-col items-center lg:items-end justify-between lg:justify-center gap-1 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100 dark:border-slate-800 text-left lg:text-right">
                    <div className="flex items-center lg:justify-end gap-1 text-slate-700 dark:text-slate-300 font-bold text-xs">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>{candidate.days_waiting || 0} Days Waiting</span>
                    </div>
                    <span className="text-[10px] text-slate-400 block">
                      Registered: {new Date(candidate.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* REGISTER CANDIDATE MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 backdrop-blur-xs p-4 sm:p-6 flex justify-center items-start sm:items-center">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-auto max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-4rem)] flex flex-col animate-in fade-in zoom-in-95">
            {/* Pinned Modal Header (Never Clipped) */}
            <div className="p-5 sm:p-6 pb-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-white dark:bg-slate-900">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                  <Heart className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Register Transplant Candidate
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Enrolls patient onto the organ allocation registry
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={handleCreateRequest} className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1">
              {formError && (
                <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Citizen Account Linker & Create New Account */}
              <CitizenAccountLinker
                label="Candidate Citizen Account *"
                sublabel="Links this transplant candidate directly to their citizen account so it appears in their Waitlist Record & history."
                selectedUser={linkedCitizen}
                onSelectUser={(user) => {
                  setLinkedCitizen(user);
                  if (user?.blood_group) {
                    setFormData((prev) => ({ ...prev, blood_group: user.blood_group }));
                  }
                }}
                onBloodGroupSelected={(bg) => {
                  setFormData((prev) => ({ ...prev, blood_group: bg }));
                }}
              />

              {/* Organ Needed & Blood Group */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Organ Needed *
                  </label>
                  <select
                    value={formData.organ_type_id}
                    onChange={(e) => setFormData({ ...formData, organ_type_id: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white focus:outline-hidden focus:border-rose-500"
                  >
                    {organTypes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Blood Group *
                  </label>
                  <select
                    value={formData.blood_group}
                    onChange={(e) => setFormData({ ...formData, blood_group: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-rose-600 dark:text-rose-400 focus:outline-hidden focus:border-rose-500"
                  >
                    {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((bg) => (
                      <option key={bg} value={bg}>
                        {bg}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Urgency Tier */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Clinical Urgency Status *
                </label>
                <select
                  value={formData.urgency_tier}
                  onChange={(e) => setFormData({ ...formData, urgency_tier: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-hidden focus:border-rose-500"
                >
                  <option value="TIER_1_EMERGENCY">Tier 1 - Emergency (Status 1A / Acute Failure)</option>
                  <option value="TIER_2_URGENT">Tier 2 - Urgent (Decompensated / High MELD)</option>
                  <option value="TIER_3_ROUTINE">Tier 3 - Routine (Stable Maintenance)</option>
                </select>
              </div>

              {/* Clinical Summary & Diagnosis */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Clinical Summary & Crossmatch Workup *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Primary diagnosis, MELD score, dialysis frequency, HLA typing or antibody titers..."
                  value={formData.medical_summary}
                  onChange={(e) => setFormData({ ...formData, medical_summary: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:border-rose-500"
                />
              </div>

              {/* Pinned Modal Footer */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 shrink-0 sticky bottom-0 bg-white dark:bg-slate-900">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-red-500 hover:from-rose-500 hover:to-red-600 text-white font-bold text-xs shadow-md shadow-rose-500/20 flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {submitting ? 'Registering...' : 'Confirm Registration'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
