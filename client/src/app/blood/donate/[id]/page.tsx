'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { bloodApi } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useSocket } from '@/context/SocketContext';
import {
  Heart,
  Droplet,
  MapPin,
  Phone,
  Navigation,
  AlertTriangle,
  Clock,
  ShieldCheck,
  CheckCircle2,
  ArrowLeft,
  XCircle,
  X,
  Building2,
  ExternalLink,
  Info,
  User,
  AlertCircle,
} from 'lucide-react';

interface BloodRequestDetails {
  id: number;
  requester_user_id: string;
  destination_hub_id: number;
  destination_hub_name: string;
  destination_hub_address?: string;
  destination_hub_city?: string;
  destination_hub_phone?: string;
  target_hub_id?: number | null;
  target_hub_name?: string;
  target_hub_phone?: string;
  blood_group: string;
  component: string;
  units_requested: number;
  urgency: 'CRITICAL' | 'URGENT' | 'ROUTINE';
  status: 'REQUESTED' | 'APPROVED' | 'DISPATCHED' | 'DONOR_COMMITTED' | 'COMPLETED' | 'CANCELLED';
  patient_relationship?: string | null;
  patient_name?: string | null;
  hospital_bed_no?: string | null;
  donor_user_id?: string | null;
  donor_name?: string | null;
  donor_phone?: string | null;
  donor_commitment_time?: string | null;
  created_at: string;
}

function DonateBloodContent() {
  const params = useParams();
  const rawId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const requestId = parseInt(rawId || '', 10);
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromHistory = searchParams?.get('from') === 'history';
  const fromEmergency = searchParams?.get('from') === 'emergency';
  const { user, loading: authLoading } = useAuth();
  const { refreshAlerts, socket, alerts } = useSocket();

  // Check if donor has an active commitment for a different requisition (1-to-1 guard)
  const otherActivePass = alerts?.find(
    (a) => a.type === 'ACTIVE_DONOR_PASS' && a.meta?.requestId && Number(a.meta.requestId) !== requestId
  );
  const hasOtherActiveCommitment = !!otherActivePass;

  const [request, setRequest] = useState<BloodRequestDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [isCommitting, setIsCommitting] = useState(false);
  const [isReleasing, setIsReleasing] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  // Self-declaration checklist before enabling the commitment button
  const [criteriaChecked, setCriteriaChecked] = useState({
    healthy: false,
    interval: false,
    travelReady: false,
  });

  const allCriteriaMet =
    criteriaChecked.healthy && criteriaChecked.interval && criteriaChecked.travelReady;

  const fetchRequestDetails = async () => {
    if (isNaN(requestId)) {
      setError('Invalid request ID');
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const res = await bloodApi.getRequestById(requestId);
      if (res.success && res.data) {
        setRequest(res.data);
      } else {
        setError(res.message || 'Failed to retrieve requisition details');
      }
    } catch (err: any) {
      setError(err.message || 'Unable to connect to service. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Reset interactive states whenever visiting/revisiting this requisition
  useEffect(() => {
    setActionError(null);
    setActionSuccess(null);
    setCriteriaChecked({
      healthy: false,
      interval: false,
      travelReady: false,
    });

    if (!authLoading) {
      fetchRequestDetails();
      refreshAlerts();
    }
  }, [requestId, authLoading]);

  // Listen for real-time status updates for this requisition
  useEffect(() => {
    if (!socket || isNaN(requestId)) return;
    const handleStatusChanged = (data: any) => {
      if (data?.requestId && String(data.requestId) === String(requestId)) {
        setRequest((prev) => (prev ? { ...prev, status: data.status } : prev));
        if (data.status === 'CANCELLED') {
          setActionError('This emergency requisition has just been cancelled.');
        } else if (data.status === 'COMPLETED') {
          setActionSuccess('This requisition has been completed.');
        }
      }
    };
    socket.on('BLOOD_ORDER_STATUS_CHANGED', handleStatusChanged);
    return () => {
      socket.off('BLOOD_ORDER_STATUS_CHANGED', handleStatusChanged);
    };
  }, [socket, requestId]);

  // Auto-dismiss transient success alerts
  useEffect(() => {
    if (actionSuccess) {
      const timer = setTimeout(() => {
        setActionSuccess(null);
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [actionSuccess]);

  // Handle donor commitment
  const handleCommitToDonate = async () => {
    if (user && request && request.requester_user_id === user.id) {
      setActionError('You cannot commit as a donor for your own blood requisition.');
      return;
    }

    if (request && (request.status === 'CANCELLED' || request.status === 'COMPLETED')) {
      setActionError('This blood requisition is no longer active and cannot be fulfilled.');
      return;
    }

    if (hasOtherActiveCommitment) {
      setActionError(
        `You already have an active walk-in commitment in progress (#PASS-BR${otherActivePass?.meta?.requestId}). Only one active commitment is permitted at a time.`
      );
      return;
    }

    if (!allCriteriaMet) {
      setActionError('Please confirm all safety & readiness declarations before committing.');
      return;
    }

    try {
      setIsCommitting(true);
      setActionError(null);
      setActionSuccess(null);

      const res = await bloodApi.commitDonor(requestId);
      if (res.success) {
        setCriteriaChecked({
          healthy: false,
          interval: false,
          travelReady: false,
        });
        setActionSuccess('Thank you! You have confirmed your commitment. Your walk-in pass is active below.');
        await refreshAlerts();
        await fetchRequestDetails();
      } else {
        setActionError(res.message || 'Unable to commit to this request.');
      }
    } catch (err: any) {
      if (err.statusCode === 409 || err.message?.includes('already committed')) {
        setActionError('Another donor has just committed to this requisition. Thank you for your willingness to help!');
      } else {
        setActionError(err.message || 'An error occurred while confirming your donation.');
      }
      fetchRequestDetails();
    } finally {
      setIsCommitting(false);
    }
  };

  // Handle emergency release
  const handleReleaseCommitment = async () => {
    const confirmRelease = window.confirm(
      'Are you sure you need to release this commitment? The emergency request will immediately be returned to the open network for another donor.'
    );
    if (!confirmRelease) return;

    try {
      setIsReleasing(true);
      setActionError(null);
      setActionSuccess(null);

      const res = await bloodApi.releaseDonor(requestId);
      if (res.success) {
        setCriteriaChecked({
          healthy: false,
          interval: false,
          travelReady: false,
        });
        setActionSuccess('Your commitment has been safely released. The request is now open for other donors.');
        await refreshAlerts();
        await fetchRequestDetails();
      } else {
        setActionError(res.message || 'Failed to release commitment.');
      }
    } catch (err: any) {
      setActionError(err.message || 'Error releasing commitment.');
    } finally {
      setIsReleasing(false);
    }
  };

  // Handle requisition cancellation by requester
  const handleCancelRequest = async () => {
    const confirmCancel = window.confirm(
      'Are you sure you want to cancel this emergency blood requisition? Active broadcasts and donor alerts will be cancelled immediately.'
    );
    if (!confirmCancel) return;

    try {
      setIsCancelling(true);
      setActionError(null);
      setActionSuccess(null);

      const res = await bloodApi.cancelRequest(requestId);
      if (res.success) {
        setActionSuccess('Emergency blood requisition was successfully cancelled.');
        await refreshAlerts();
        await fetchRequestDetails();
      } else {
        setActionError(res.message || 'Failed to cancel requisition.');
      }
    } catch (err: any) {
      setActionError(err.message || 'An error occurred while cancelling the requisition.');
    } finally {
      setIsCancelling(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 py-12 px-4 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
            Loading emergency requisition details...
          </p>
        </div>
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 py-12 px-4">
        <div className="max-w-2xl mx-auto bg-white dark:bg-slate-800 rounded-2xl p-8 border border-slate-200 dark:border-slate-700 text-center shadow-sm">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Requisition Not Found</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
            {error || 'This blood request could not be found or may have expired.'}
          </p>
          <button
            type="button"
            onClick={() => {
              if (typeof window !== 'undefined' && window.history.length > 1) {
                router.back();
              } else if (fromEmergency) {
                router.push('/blood/emergency');
              } else {
                router.push('/citizen/history');
              }
            }}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-semibold hover:opacity-90 transition-opacity cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" /> Previous Page
          </button>
        </div>
      </div>
    );
  }

  const isMyOwnRequest = !!(user && request.requester_user_id === user.id);
  const isCommittedByMe =
    request.status === 'DONOR_COMMITTED' && user && request.donor_user_id === user.id;
  const isCommittedByOther =
    request.status === 'DONOR_COMMITTED' && (!user || request.donor_user_id !== user.id);
  const isOpen = request.status === 'REQUESTED' && !isMyOwnRequest;
  const isCompleted = request.status === 'COMPLETED';
  const isCancelled = request.status === 'CANCELLED';

  const isRequisitionView = fromHistory || fromEmergency || isMyOwnRequest || isCancelled || isCompleted;
  const canCancel = (isMyOwnRequest || user?.role === 'ADMIN') && !isCancelled && !isCompleted;

  // Google Maps navigation query
  const mapsSearchQuery = encodeURIComponent(
    `${request.destination_hub_name}, ${request.destination_hub_address || ''}, ${
      request.destination_hub_city || ''
    }`.trim()
  );
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${mapsSearchQuery}`;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-8 px-4 sm:px-6 lg:px-8 transition-colors">
      <div className="max-w-4xl mx-auto">
        {/* Navigation Breadcrumb */}
        <div className="mb-6 flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              setActionError(null);
              setActionSuccess(null);
              if (typeof window !== 'undefined' && window.history.length > 1) {
                router.back();
              } else if (fromEmergency) {
                router.push('/blood/emergency');
              } else {
                router.push('/citizen/history');
              }
            }}
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" /> Previous Page
          </button>
          <span className="text-xs font-mono text-slate-400">Requisition #BR-{request.id}</span>
        </div>

        {/* Action Alerts */}
        {actionError && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <XCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Notice</p>
                <p>{actionError}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActionError(null)}
              className="text-red-500 hover:text-red-700 dark:text-red-400 p-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {actionSuccess && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-sm flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Success</p>
                <p>{actionSuccess}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActionSuccess(null)}
              className="text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 p-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Active Walk-In Phlebotomy Pass (Shown on top when committed by current user) */}
        {isCommittedByMe && !isCancelled && (
          <div className="mb-8 rounded-2xl bg-gradient-to-br from-emerald-600 via-teal-700 to-emerald-800 text-white p-6 sm:p-8 shadow-xl relative overflow-hidden">
            <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/20">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-7 h-7 text-white" />
                </div>
                <div>
                  <span className="text-xs uppercase tracking-wider font-bold text-emerald-200">
                    Active Walk-In Phlebotomy Pass
                  </span>
                  <h2 className="text-xl sm:text-2xl font-extrabold text-white">
                    Emergency Donor Requisition Pass
                  </h2>
                </div>
              </div>
              <div className="px-3.5 py-1.5 rounded-full bg-white/25 backdrop-blur-xs text-xs font-bold tracking-wide flex items-center gap-2 self-start sm:self-auto">
                <span className="w-2 h-2 rounded-full bg-emerald-300 animate-ping"></span>
                COMMITTED — EN ROUTE
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 py-6 text-sm">
              <div>
                <span className="text-xs text-emerald-100 font-medium block mb-1">Target Hospital</span>
                <p className="font-bold text-white text-base leading-tight">{request.destination_hub_name}</p>
                <p className="text-xs text-emerald-100 mt-0.5">
                  {request.destination_hub_address || request.destination_hub_city}
                </p>
              </div>
              <div>
                <span className="text-xs text-emerald-100 font-medium block mb-1">Blood Specimen</span>
                <p className="font-bold text-white text-base leading-tight">
                  {request.blood_group} ({request.component.replace(/_/g, ' ')})
                </p>
                <p className="text-xs text-emerald-100 mt-0.5">{request.units_requested} Unit(s) Required</p>
              </div>
              <div>
                <span className="text-xs text-emerald-100 font-medium block mb-1">Token ID</span>
                <p className="font-mono font-bold text-white text-lg">#PASS-BR{request.id}</p>
                <p className="text-xs text-emerald-100 mt-0.5">Present at Reception</p>
              </div>
            </div>

            {/* Arrival Instruction Note */}
            <div className="bg-white/10 rounded-xl p-4 text-xs text-emerald-50 leading-relaxed mb-6">
              <strong>Instructions upon arrival:</strong> Head directly to the Emergency Blood Bank or Phlebotomy
              Counter at {request.destination_hub_name}. State that you are the walk-in donor for Requisition #BR-
              {request.id}. The attending clinical team will perform rapid cross-matching and collection.
            </div>

            {/* Interactive Actions & Release Commitment in Bottom Right Corner */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="flex flex-wrap items-center gap-3">
                <a
                  href={googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white text-emerald-800 font-bold text-sm shadow-md hover:bg-emerald-50 transition-colors"
                >
                  <Navigation className="w-4 h-4 fill-emerald-800" />
                  Navigate in Google Maps
                  <ExternalLink className="w-3.5 h-3.5 ml-1 opacity-70" />
                </a>

                {request.destination_hub_phone && (
                  <a
                    href={`tel:${request.destination_hub_phone}`}
                    className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-800/80 hover:bg-emerald-800 text-white font-semibold text-sm transition-colors border border-white/20"
                  >
                    <Phone className="w-4 h-4" />
                    Call Hospital ({request.destination_hub_phone})
                  </a>
                )}
              </div>

              {/* Release Commitment Button in bottom right corner of the card */}
              <button
                type="button"
                onClick={handleReleaseCommitment}
                disabled={isReleasing}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/15 hover:bg-red-500/30 text-white border border-white/20 hover:border-red-300 text-xs font-semibold ml-auto transition-colors cursor-pointer"
              >
                {isReleasing ? 'Releasing...' : 'Release Commitment'}
              </button>
            </div>
          </div>
        )}

        {/* Main Requisition Details Card (Parent / Ultimate Div) */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden mb-8">
          {/* Card Header */}
          <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-rose-50 dark:bg-rose-950/50 flex items-center justify-center text-rose-600 dark:text-rose-400">
                <Droplet className="w-6 h-6 fill-rose-600 dark:fill-rose-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                    Emergency Blood Need: {request.blood_group}
                  </h1>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      request.urgency === 'CRITICAL'
                        ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                        : request.urgency === 'URGENT'
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                        : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    {request.urgency}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Requested on {new Date(request.created_at).toLocaleString()}
                </p>
              </div>
            </div>

            {/* Current Status Pill */}
            <div>
              {isCancelled && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-semibold">
                  <XCircle className="w-3.5 h-3.5 text-slate-500" />
                  Requisition Cancelled
                </span>
              )}
              {isCompleted && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200 text-xs font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Completed / Transfused
                </span>
              )}
              {isCommittedByMe && !isCancelled && !isCompleted && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  Locked by You (En Route)
                </span>
              )}
              {isCommittedByOther && !isCancelled && !isCompleted && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-semibold">
                  <Clock className="w-3.5 h-3.5" />
                  Donor Committed
                </span>
              )}
              {!isCancelled && !isCompleted && !isCommittedByMe && !isCommittedByOther && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-xs font-semibold">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                  Awaiting Willing Donor
                </span>
              )}
            </div>
          </div>

          {/* Requisition View Layout (Same style as cancelled request: 2 cards side-by-side on top, wide status card underneath) */}
          {isRequisitionView ? (
            <div className="p-6 space-y-6">
              {/* Top Row: Requested Specimen & Receiving Hospital Side-by-Side */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
                {/* CARD 1: Requested Specimen */}
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Requested Specimen
                      </span>
                      {isCancelled ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                          Requisition Cancelled
                        </span>
                      ) : isCompleted ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                          Fulfilled & Transfused
                        </span>
                      ) : request.status === 'DONOR_COMMITTED' ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                          Donor Committed
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300">
                          Active Broadcast
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <span className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                          {request.blood_group}
                        </span>
                        <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mt-1">
                          Component: {request.component.replace(/_/g, ' ')}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-2xl font-bold text-slate-700 dark:text-slate-300">
                          {request.units_requested} {request.units_requested === 1 ? 'Unit' : 'Units'}
                        </span>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">Target Draw</p>
                      </div>
                    </div>

                    {(request.patient_relationship || request.patient_name) && (
                      <div className="mt-3 p-2.5 rounded-xl bg-slate-100 dark:bg-slate-700/50 border border-slate-200/60 dark:border-slate-700 text-xs">
                        <div className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-200">
                          <User className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                          <span>Recipient: <span className="capitalize">{request.patient_relationship?.toLowerCase() === 'self' ? 'Myself' : (request.patient_relationship || 'Patient')}</span></span>
                          {request.patient_name && <span>({request.patient_name})</span>}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-700/60 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
                    <span>
                      Phlebotomy Unit:{' '}
                      {isCancelled
                        ? 'Inactive'
                        : isCompleted
                        ? 'Completed'
                        : request.status === 'DONOR_COMMITTED'
                        ? 'En Route / Intake'
                        : 'Standby / Open'}
                    </span>
                    <span className="font-mono font-medium">Requisition #BR-{request.id}</span>
                  </div>
                </div>

                {/* CARD 2: Receiving Hospital */}
                <div className="border border-slate-200 dark:border-slate-700/80 rounded-2xl p-5 bg-white dark:bg-slate-800/70 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                      <Building2 className="w-4 h-4 text-rose-600" />
                      Receiving Hospital
                    </div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      {request.destination_hub_name}
                    </h3>

                    {request.destination_hub_address && (
                      <div className="flex items-start gap-2 mt-2 text-xs text-slate-600 dark:text-slate-300">
                        <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                        <span>
                          {request.destination_hub_address}
                          {request.destination_hub_city ? `, ${request.destination_hub_city}` : ''}
                        </span>
                      </div>
                    )}

                    {request.destination_hub_phone && (
                      <div className="flex items-center gap-2 mt-2 text-xs text-slate-600 dark:text-slate-300">
                        <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                        <a
                          href={`tel:${request.destination_hub_phone}`}
                          className="font-medium text-rose-600 dark:text-rose-400 hover:underline"
                        >
                          {request.destination_hub_phone}
                        </a>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700 flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                    <Info className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                    <span>
                      {isCancelled
                        ? 'Hospital administration notified of cancelled order.'
                        : isCompleted
                        ? 'Hospital phlebotomy team logged unit transfusion.'
                        : request.status === 'DONOR_COMMITTED'
                        ? 'Attending clinical team notified of incoming committed donor.'
                        : 'Emergency intake phlebotomy suite standing by.'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Wide Status Card Under Both of Them */}
              <div className="w-full rounded-2xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-center space-y-4 shadow-2xs">
                {isCancelled && (
                  <>
                    <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 flex items-center justify-center mx-auto shadow-2xs">
                      <XCircle className="w-7 h-7 text-slate-500" />
                    </div>
                    <div className="max-w-md mx-auto space-y-1">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                        Status: Cancelled
                      </span>
                      <h4 className="text-lg font-bold text-slate-900 dark:text-white pt-1">
                        Emergency Blood Requisition Cancelled
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        This emergency blood requisition was cancelled by the requester or hospital administration and is no longer accepting walk-in commitments or blood bank reservations.
                      </p>
                    </div>
                  </>
                )}

                {isCompleted && (
                  <>
                    <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-600 flex items-center justify-center mx-auto shadow-2xs">
                      <CheckCircle2 className="w-7 h-7 text-emerald-600" />
                    </div>
                    <div className="max-w-md mx-auto space-y-1">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200">
                        Status: Fulfilled & Transfused
                      </span>
                      <h4 className="text-lg font-bold text-slate-900 dark:text-white pt-1">
                        Donation Fulfilled & Transfused
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        This emergency requisition has been successfully completed. The patient has received the lifesaving blood unit from the attending clinical team.
                      </p>
                    </div>
                  </>
                )}

                {isCommittedByMe && !isCancelled && !isCompleted && (
                  <>
                    <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-600 flex items-center justify-center mx-auto shadow-2xs">
                      <ShieldCheck className="w-7 h-7 text-emerald-600" />
                    </div>
                    <div className="max-w-md mx-auto space-y-1">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200">
                        Status: Active Commitment
                      </span>
                      <h4 className="text-lg font-bold text-slate-900 dark:text-white pt-1">
                        You are the Committed Donor (En Route)
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        This emergency requisition is locked exclusively to you. The attending clinical phlebotomy unit at {request.destination_hub_name} has been notified of your incoming arrival.
                      </p>
                    </div>
                  </>
                )}

                {isCommittedByOther && !isCancelled && !isCompleted && (
                  <>
                    <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-600 flex items-center justify-center mx-auto shadow-2xs">
                      <Clock className="w-7 h-7 text-amber-500" />
                    </div>
                    <div className="max-w-md mx-auto space-y-1">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200">
                        Status: Donor Committed
                      </span>
                      <h4 className="text-lg font-bold text-slate-900 dark:text-white pt-1">
                        Matching Volunteer Donor En Route
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        Another matching volunteer donor has committed to this emergency requisition and is traveling to {request.destination_hub_name}. Phlebotomy cross-matching is underway.
                      </p>
                    </div>
                  </>
                )}

                {!isCancelled && !isCompleted && !isCommittedByMe && !isCommittedByOther && (
                  <>
                    <div className="w-14 h-14 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-600 flex items-center justify-center mx-auto shadow-2xs">
                      <Droplet className="w-7 h-7 fill-rose-600/20" />
                    </div>
                    <div className="max-w-md mx-auto space-y-1">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300">
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse inline-block mr-1"></span>
                        Status: Awaiting Volunteer Donor
                      </span>
                      <h4 className="text-lg font-bold text-slate-900 dark:text-white pt-1">
                        Broadcast Active Across Network
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        This emergency blood requisition is currently active and broadcast to all compatible volunteer donors and regional blood hubs. Phlebotomy suites are standing by for donor intake.
                      </p>
                    </div>
                  </>
                )}

                <div className="max-w-md mx-auto p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-slate-400" />
                    <span>Requested: {new Date(request.created_at).toLocaleString()}</span>
                  </div>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">#BR-{request.id}</span>
                </div>

                <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                  {canCancel && (
                    <button
                      type="button"
                      onClick={handleCancelRequest}
                      disabled={isCancelling}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-50 dark:bg-red-950/50 hover:bg-red-100 dark:hover:bg-red-900/60 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 text-xs font-bold transition-all shadow-xs cursor-pointer"
                    >
                      <XCircle className="w-4 h-4" />
                      {isCancelling ? 'Cancelling Requisition...' : 'Cancel Request'}
                    </button>
                  )}

                  {isCommittedByMe && !isCancelled && !isCompleted && (
                    <>
                      <a
                        href={googleMapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold hover:opacity-90 transition-opacity shadow-xs"
                      >
                        <Navigation className="w-4 h-4 fill-current" />
                        Navigate via Google Maps
                        <ExternalLink className="w-3.5 h-3.5 opacity-70" />
                      </a>
                      <button
                        type="button"
                        onClick={handleReleaseCommitment}
                        disabled={isReleasing}
                        className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-red-500/20 text-slate-700 dark:text-slate-300 hover:text-red-600 text-xs font-semibold transition-colors cursor-pointer"
                      >
                        {isReleasing ? 'Releasing...' : 'Release Commitment'}
                      </button>
                    </>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      if (typeof window !== 'undefined' && window.history.length > 1) {
                        router.back();
                      } else if (fromEmergency) {
                        router.push('/blood/emergency');
                      } else {
                        router.push('/citizen/history');
                      }
                    }}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors shadow-xs cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" /> Previous Page
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Four Cards on Top (2x2 Balanced Equal-Height Grid) for active orders */
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
            {/* CARD 1 (Top-Left): Requested Specimen */}
            <div className="order-1 md:order-1 bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Requested Specimen
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300">
                    Immediate Transfusion
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <span className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                      {request.blood_group}
                    </span>
                    <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mt-1">
                      Component: {request.component.replace(/_/g, ' ')}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-bold text-rose-600 dark:text-rose-400">
                      {request.units_requested} {request.units_requested === 1 ? 'Unit' : 'Units'}
                    </span>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">Required Draw</p>
                  </div>
                </div>

                {(request.patient_relationship || request.patient_name) && (
                  <div className="mt-3 p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 text-xs">
                    <div className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-200">
                      <User className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                      <span>Recipient: <span className="capitalize">{request.patient_relationship?.toLowerCase() === 'self' ? 'Myself' : (request.patient_relationship || 'Patient')}</span></span>
                      {request.patient_name && <span>({request.patient_name})</span>}
                    </div>
                  </div>
                )}
              </div>
              <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-700/60 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
                <span>Phlebotomy Unit: Priority Queue</span>
                <span className="font-mono font-medium">Requisition #BR-{request.id}</span>
              </div>
            </div>

            {/* CARD 3 (Top-Right): Solemn Life-Safety Advisory */}
            <div className="order-3 md:order-2 rounded-2xl p-5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-950 dark:text-amber-200 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-300 text-sm mb-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  Solemn Life-Safety Advisory
                </div>
                <p className="text-xs leading-relaxed text-amber-900/90 dark:text-amber-200/90">
                  Clicking <strong>&quot;I Can Donate&quot;</strong> locks this requisition exclusively to you.
                  The receiving clinical team pauses broader SOS dispatches and prepares the phlebotomy suite for your
                  arrival.
                </p>
              </div>
              <p className="text-xs leading-relaxed font-semibold text-amber-950 dark:text-amber-200 mt-3 pt-3 border-t border-amber-200 dark:border-amber-800/60">
                Only commit if you can depart immediately and are in good physical health. If you commit and fail to
                arrive, you put a recipient patient&apos;s life at severe risk.
              </p>
            </div>

            {/* CARD 2 (Bottom-Left): Receiving Hospital */}
            <div className="order-2 md:order-3 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-5 bg-white dark:bg-slate-800/70 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                  <Building2 className="w-4 h-4 text-rose-600" />
                  Receiving Hospital
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {request.destination_hub_name}
                </h3>

                {request.destination_hub_address && (
                  <div className="flex items-start gap-2 mt-2 text-xs text-slate-600 dark:text-slate-300">
                    <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                    <span>
                      {request.destination_hub_address}
                      {request.destination_hub_city ? `, ${request.destination_hub_city}` : ''}
                    </span>
                  </div>
                )}

                {request.destination_hub_phone && (
                  <div className="flex items-center gap-2 mt-2 text-xs text-slate-600 dark:text-slate-300">
                    <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                    <a
                      href={`tel:${request.destination_hub_phone}`}
                      className="font-medium text-rose-600 dark:text-rose-400 hover:underline"
                    >
                      {request.destination_hub_phone}
                    </a>
                  </div>
                )}
              </div>

              {!isCommittedByMe ? (
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700 flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                  <Info className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                  <span>Turn-by-turn navigation via Google Maps unlocks once you confirm your donation.</span>
                </div>
              ) : (
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700 flex items-center gap-2 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Phlebotomy ward notified of incoming donor arrival.</span>
                </div>
              )}
            </div>

              {/* CARD 4 (Bottom-Right): Donor Readiness Checklist */}
              <div className="order-4 md:order-4 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-5 bg-white dark:bg-slate-800/70 flex flex-col justify-between">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-3">
                    Confirm Donor Readiness:
                  </h4>

                  <div className="space-y-2.5">
                    <label className="flex items-start gap-2.5 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={criteriaChecked.healthy}
                        onChange={(e) =>
                          setCriteriaChecked({ ...criteriaChecked, healthy: e.target.checked })
                        }
                        className="mt-0.5 rounded text-rose-600 focus:ring-rose-500"
                      />
                      <span className="text-xs text-slate-700 dark:text-slate-300">
                        I am feeling well, rested, and have had no fever, illness, or alcohol in past 24h.
                      </span>
                    </label>

                    <label className="flex items-start gap-2.5 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={criteriaChecked.interval}
                        onChange={(e) =>
                          setCriteriaChecked({ ...criteriaChecked, interval: e.target.checked })
                        }
                        className="mt-0.5 rounded text-rose-600 focus:ring-rose-500"
                      />
                      <span className="text-xs text-slate-700 dark:text-slate-300">
                        I have not donated blood in the last 90 days and meet donor criteria.
                      </span>
                    </label>

                    <label className="flex items-start gap-2.5 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={criteriaChecked.travelReady}
                        onChange={(e) =>
                          setCriteriaChecked({ ...criteriaChecked, travelReady: e.target.checked })
                        }
                        className="mt-0.5 rounded text-rose-600 focus:ring-rose-500"
                      />
                      <span className="text-xs text-slate-700 dark:text-slate-300 font-semibold">
                        I can depart immediately and reach the hospital within 45–60 minutes.
                      </span>
                    </label>
                  </div>

                  <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-700 text-[11px] text-slate-500">
                    All 3 declarations required before commitment unlock.
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                  <span className="flex items-center gap-1 text-slate-400">
                    <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                    Self-attestation verification
                  </span>
                  <span className="font-mono font-medium">Requisition #BR-{request.id}</span>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons Section Underneath the Four Cards — For Donor Commitment Flow */}
          {!isRequisitionView && (
            <div className="px-6 pb-6 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex flex-col items-center justify-center">
              {isOpen && hasOtherActiveCommitment && (
                <div className="w-full max-w-md flex flex-col items-center pt-2">
                  <div className="w-full py-3 px-6 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 font-semibold text-xs text-center border border-amber-200 dark:border-amber-800/80">
                    Active Commitment Already in Progress (#PASS-BR{otherActivePass?.meta?.requestId})
                  </div>
                  <p className="text-[11px] text-center text-slate-500 dark:text-slate-400 mt-2">
                    Please fulfill or release your current commitment before accepting another.
                  </p>
                </div>
              )}

              {isOpen && !hasOtherActiveCommitment && (
                <div className="w-full max-w-md flex flex-col items-center pt-2">
                  <button
                    type="button"
                    onClick={handleCommitToDonate}
                    disabled={!allCriteriaMet || isCommitting}
                    className={`w-full py-3.5 px-8 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer ${
                      allCriteriaMet && !isCommitting
                        ? 'bg-rose-600 hover:bg-rose-700 text-white hover:shadow-rose-600/30 active:scale-[0.99]'
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed shadow-none'
                    }`}
                  >
                    <Heart className="w-5 h-5 fill-current" />
                    {isCommitting ? 'Locking Requisition...' : 'I Can Donate & Walk In Now'}
                  </button>
                  <p className="text-[11px] text-center text-slate-500 dark:text-slate-400 mt-2">
                    Confirming will lock this requisition and unlock Google Maps navigation.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DonateBloodPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 py-12 px-4 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
              Loading emergency requisition details...
            </p>
          </div>
        </div>
      }
    >
      <DonateBloodContent />
    </Suspense>
  );
}
