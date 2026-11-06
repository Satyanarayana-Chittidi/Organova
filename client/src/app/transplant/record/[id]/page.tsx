'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { transplantApi, organApi } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useSocket } from '@/context/SocketContext';
import OrganImage from '@/components/OrganImage';
import {
  Clock,
  Heart,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Building2,
  MapPin,
  User,
  ArrowLeft,
  Printer,
  Activity,
  Award,
  Sparkles,
  XCircle,
  X,
  FileText,
  AlertTriangle,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';

interface TransplantRecordData {
  id: number;
  recipient_user_id?: string;
  donor_user_id?: string;
  attending_hub_id?: number;
  harvesting_hub_id?: number;
  organ_type_id: number;
  blood_group: string;
  urgency_tier?: string;
  medical_summary?: string;
  status: string;
  created_at: string;
  verified_at?: string | null;
  harvested_at?: string;
  expires_at?: string;
  recipient_name?: string;
  recipient_email?: string;
  attending_hub_name?: string;
  attending_hub_city?: string;
  attending_hub_address?: string;
  harvesting_hub_name?: string;
  harvesting_hub_city?: string;
  recipient_hospital_name?: string;
  organ_name?: string;
  organ_code?: string;
  days_waiting?: number;
  active_organ_id?: number;
  active_match_id?: number;
  active_response_deadline?: string;
  active_match_score?: string | number;
}

function TransplantRecordContent() {
  const params = useParams();
  const rawId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const recordId = parseInt(rawId || '', 10);
  const router = useRouter();
  const searchParams = useSearchParams();
  const recordType = searchParams?.get('type') || 'request';
  const fromHistory = searchParams?.get('from') === 'history';
  const fromProfile = searchParams?.get('from') === 'profile';

  const { user, loading: authLoading } = useAuth();
  const { alerts } = useSocket();

  const [record, setRecord] = useState<TransplantRecordData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [timeLeft, setTimeLeft] = useState<{ minutes: number; seconds: number } | null>(null);

  const fetchRecordDetails = async () => {
    if (isNaN(recordId)) {
      setError('Invalid record ID.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      if (recordType === 'donation') {
        const res = await organApi.getOrganById(recordId);
        if (res.success && res.data) {
          const d = res.data;
          setRecord({
            id: d.id,
            organ_type_id: d.organ_type_id,
            organ_name: d.organ_name || d.name,
            organ_code: d.organ_code || d.code,
            blood_group: d.blood_group,
            status: d.status,
            harvested_at: d.harvested_at,
            expires_at: d.expires_at,
            created_at: d.harvested_at,
            harvesting_hub_name: d.harvesting_hub_name || d.hub_name,
            harvesting_hub_city: d.harvesting_hub_city || d.hub_city,
            recipient_hospital_name: d.recipient_hospital_name,
            medical_summary: d.clinical_notes || 'Organ harvested and preserved under certified cold-ischemia protocol.',
          });
        } else {
          setError(res.message || 'Donated organ record not found.');
        }
      } else {
        const res = await transplantApi.getRequestById(recordId);
        if (res.success && res.data) {
          setRecord(res.data);
        } else {
          setError(res.message || 'Transplant waitlist record not found.');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load organ transplant record.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login');
      return;
    }
    if (user && !isNaN(recordId)) {
      fetchRecordDetails();
    }
  }, [user, authLoading, recordId, recordType]);

  useEffect(() => {
    if (!record?.active_response_deadline) {
      setTimeLeft(null);
      return;
    }

    const target = new Date(record.active_response_deadline).getTime();

    const updateTimer = () => {
      const now = Date.now();
      const diff = target - now;

      if (diff <= 0) {
        setTimeLeft({ minutes: 0, seconds: 0 });
        return;
      }

      const totalSec = Math.floor(diff / 1000);
      const minutes = Math.floor(totalSec / 60);
      const seconds = totalSec % 60;
      setTimeLeft({ minutes, seconds });
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [record?.active_response_deadline]);

  const handleOfferResponse = async (decision: 'ACCEPT' | 'DECLINE') => {
    if (!record?.active_match_id) return;
    const confirmText =
      decision === 'ACCEPT'
        ? 'Confirm acceptance of this organ match? Attending clinical teams will immediately be notified for surgical scheduling.'
        : 'Decline this match offer? The donor organ will be offered to the next candidate on the waitlist.';

    if (!window.confirm(confirmText)) return;

    try {
      setActionLoading(true);
      setActionMsg(null);
      const res = await transplantApi.respondToMatch(record.active_match_id, decision);
      if (res.success) {
        setActionMsg({
          type: 'success',
          text: decision === 'ACCEPT' ? 'Organ offer accepted! Surgical scheduling initiated.' : 'Offer declined. Returned to active waitlist.',
        });
        await fetchRecordDetails();
      } else {
        setActionMsg({ type: 'error', text: res.message || 'Failed to update offer.' });
      }
    } catch (err: any) {
      setActionMsg({ type: 'error', text: err.message || 'Failed to submit response.' });
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'TRANSPLANTED':
      case 'FULFILLED':
        return {
          label: 'Transplanted / Fulfilled',
          color: 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
          desc: 'Clinical transplantation procedure completed and recorded in network ledger.',
          icon: <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />,
        };
      case 'ACCEPTED':
        return {
          label: 'Transplant Scheduled',
          color: 'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-800',
          desc: 'Organ offer accepted by clinical teams. Patient pre-operative preparation underway.',
          icon: <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />,
        };
      case 'SURGERY_SCHEDULED':
        return {
          label: 'Surgery Scheduled',
          color: 'bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800',
          desc: 'Operating theater and transplant surgical team booked.',
          icon: <Calendar className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />,
        };
      case 'MATCH_OFFERED':
        return {
          label: 'Match Offer Under Review',
          color: 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800 animate-pulse',
          desc: 'A compatible organ has been matched! Active 20-minute clinical decision window.',
          icon: <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />,
        };
      case 'WAITING_LIST':
        return {
          label: 'On Active Waitlist',
          color: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/50',
          desc: 'Active on national transplant registry. System continuously crossmatches incoming donors.',
          icon: <Clock className="w-4 h-4 text-emerald-500" />,
        };
      case 'AVAILABLE':
        return {
          label: 'In Cold Preservation',
          color: 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200',
          desc: 'Harvested organ stored under hypothermic preservation while crossmatching is evaluated.',
          icon: <CheckCircle2 className="w-4 h-4 text-emerald-600" />,
        };
      case 'ALLOCATED':
        return {
          label: 'Allocated for Transplant',
          color: 'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 border-blue-300',
          desc: 'Organ allocated to prioritized recipient.',
          icon: <CheckCircle2 className="w-4 h-4 text-blue-600" />,
        };
      case 'IN_TRANSIT':
        return {
          label: 'In Transit',
          color: 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border-amber-300',
          desc: 'Organ en route in medical preservation container.',
          icon: <Activity className="w-4 h-4 text-amber-600" />,
        };
      case 'DELIVERED':
        return {
          label: 'Delivered to Center',
          color: 'bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 border-indigo-300',
          desc: 'Preservation unit safely received by transplant surgical team.',
          icon: <Building2 className="w-4 h-4 text-indigo-600" />,
        };
      case 'CANCELLED':
        return {
          label: 'Requisition Cancelled',
          color: 'bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border-rose-200',
          desc: 'Waitlist requisition closed or patient removed by attending medical team.',
          icon: <XCircle className="w-4 h-4 text-rose-500" />,
        };
      default:
        return {
          label: status || 'Active',
          color: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200',
          desc: 'Clinical record registered in organ network ledger.',
          icon: <Clock className="w-4 h-4 text-slate-500" />,
        };
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-16 px-4 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
            Loading verified organ transplant record...
          </p>
        </div>
      </div>
    );
  }

  if (error || !record) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-16 px-4 flex items-center justify-center">
        <div className="max-w-md w-full p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center shadow-xs space-y-4">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Record Not Found</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {error || 'Unable to locate this organ transplant record on the network registry.'}
          </p>
          <div className="pt-2 flex justify-center gap-2">
            <Link
              href={fromHistory ? '/citizen/history?type=organ' : fromProfile ? '/citizen/profile' : '/transplant/waitlist-status'}
              className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-slate-800 text-white text-xs font-semibold hover:bg-slate-800 transition-colors"
            >
              Return to Previous Page
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const statusInfo = getStatusBadge(record.status);
  const isMatchOffered = record.status === 'MATCH_OFFERED' && !!record.active_match_id;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-8 px-4 sm:px-6 lg:px-8 transition-colors">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center justify-between print:hidden">
          <Link
            href={fromHistory ? '/citizen/history?type=organ' : fromProfile ? '/citizen/profile' : '/transplant/waitlist-status'}
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            {fromHistory ? 'Back to Medical Ledger' : fromProfile ? 'Back to Citizen Profile' : 'Back to Waitlist Status'}
          </Link>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchRecordDetails}
              className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-white dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-800 transition-colors cursor-pointer shadow-xs"
              title="Refresh Record"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-xs cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-slate-500" />
              Print Clinical Record
            </button>
          </div>
        </div>

        {actionMsg && (
          <div
            className={`p-4 rounded-2xl border text-xs font-semibold flex items-center gap-2 ${
              actionMsg.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                : 'bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
            }`}
          >
            {actionMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{actionMsg.text}</span>
          </div>
        )}

        <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-start sm:items-center gap-4">
              <OrganImage
                organ={record.organ_code || record.organ_name}
                size="lg"
                className="shrink-0"
              />
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                    {recordType === 'donation' ? `#ORGAN-TX${record.id}` : `#REC-TX${record.id}`}
                  </span>
                  <span className="text-xs text-slate-400">•</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    Registered {new Date(record.created_at).toLocaleDateString()}
                  </span>
                </div>
                <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                  {record.organ_name || record.organ_code} ({record.blood_group})
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {recordType === 'donation'
                    ? 'Verified voluntary organ donation and cold-preservation dispatch log.'
                    : 'Transplant recipient waitlist requisition with multi-factor crossmatching.'}
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:items-end gap-1.5 shrink-0">
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wider border ${statusInfo.color}`}
              >
                {statusInfo.icon}
                {statusInfo.label}
              </span>
              <span className="text-[11px] text-slate-400 dark:text-slate-500 max-w-xs text-left sm:text-right">
                {statusInfo.desc}
              </span>
            </div>
          </div>

          {isMatchOffered && (
            <div className="mt-6 p-5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-300 dark:border-amber-700/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold text-sm">
                  <Sparkles className="w-4 h-4 animate-spin" />
                  Compatible Donor Organ Offer Active!
                </div>
                <p className="text-xs text-amber-700/90 dark:text-amber-400 leading-relaxed max-w-xl">
                  A high-priority donor organ has matched your clinical criteria with a score of{' '}
                  <strong>{Number(record.active_match_score || 0).toFixed(1)}%</strong>. Please accept or decline before the 20-minute allocation window expires.
                </p>
                {timeLeft && (
                  <div className="inline-flex items-center gap-2 mt-2 px-3 py-1 bg-amber-100 dark:bg-amber-900/60 rounded-lg text-amber-900 dark:text-amber-200 font-mono text-xs font-bold">
                    <Clock className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
                    Response Window Remaining:{' '}
                    <span>
                      {String(timeLeft.minutes).padStart(2, '0')}:{String(timeLeft.seconds).padStart(2, '0')}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleOfferResponse('ACCEPT')}
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {actionLoading ? 'Processing...' : 'Accept Organ Offer'}
                </button>
                <button
                  type="button"
                  onClick={() => handleOfferResponse('DECLINE')}
                  disabled={actionLoading}
                  className="px-3.5 py-2 rounded-xl border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs hover:bg-amber-50 dark:hover:bg-slate-700 transition-colors cursor-pointer disabled:opacity-50"
                >
                  Decline
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-100 dark:border-slate-800 text-xs">
            <div>
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold block mb-1">
                Organ Specimen
              </span>
              <span className="font-extrabold text-slate-900 dark:text-white text-sm">
                {record.organ_name || record.organ_code}
              </span>
            </div>

            <div>
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold block mb-1">
                ABO Blood Type
              </span>
              <span className="font-extrabold text-rose-600 dark:text-rose-400 text-sm">
                {record.blood_group}
              </span>
            </div>

            <div>
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold block mb-1">
                {recordType === 'donation' ? 'Preservation Time' : 'Time on Waitlist'}
              </span>
              <span className="font-extrabold text-emerald-600 dark:text-emerald-400 text-sm flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {record.days_waiting !== undefined ? `${record.days_waiting} Day(s)` : 'Clinical Storage'}
              </span>
            </div>

            <div>
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold block mb-1">
                {recordType === 'donation' ? 'Harvesting Facility' : 'Attending Center'}
              </span>
              <span className="font-extrabold text-blue-600 dark:text-blue-400 text-sm truncate block">
                {record.attending_hub_name || record.harvesting_hub_name || 'Medical Facility'}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-500" />
              {recordType === 'donation' ? 'Donor & Harvest Directives' : 'Candidate Clinical Profile'}
            </h3>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Name</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {record.recipient_name || user?.email || 'Certified Registered Patient'}
                </span>
              </div>

              {record.recipient_email && (
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500">Registered Email</span>
                  <span className="font-bold text-slate-700 dark:text-slate-300 font-mono">
                    {record.recipient_email}
                  </span>
                </div>
              )}

              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Blood Group</span>
                <span className="font-bold text-rose-600 dark:text-rose-400">{record.blood_group}</span>
              </div>

              {record.urgency_tier && (
                <div className="flex justify-between py-1.5 items-center">
                  <span className="text-slate-500">Clinical Urgency Tier</span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      record.urgency_tier === 'TIER_1_EMERGENCY'
                        ? 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300'
                        : record.urgency_tier === 'TIER_2_URGENT'
                        ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                        : 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                    }`}
                  >
                    {record.urgency_tier.replace(/_/g, ' ')}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-blue-500" />
              Medical Hub & Attending Facility
            </h3>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Facility Name</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {record.attending_hub_name || record.harvesting_hub_name || 'Medical Hub'}
                </span>
              </div>

              {(record.attending_hub_city || record.harvesting_hub_city) && (
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500">City / Region</span>
                  <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    {record.attending_hub_city || record.harvesting_hub_city}
                  </span>
                </div>
              )}

              {record.attending_hub_address && (
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500">Address</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300 text-right max-w-xs">
                    {record.attending_hub_address}
                  </span>
                </div>
              )}

              {record.recipient_hospital_name && (
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-500">Transplant Center</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {record.recipient_hospital_name}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {record.medical_summary && (
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-500" />
              Clinical Summary & Diagnostic Log
            </h3>
            <p className="text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-100 dark:border-slate-700/60 leading-relaxed italic">
              &quot;{record.medical_summary.replace(/\[MOCK TEST\]\s*/gi, '').replace(/\[TEST\]\s*/gi, '').trim()}&quot;
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function TransplantRecordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-16 px-4 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
              Loading organ record...
            </p>
          </div>
        </div>
      }
    >
      <TransplantRecordContent />
    </Suspense>
  );
}
