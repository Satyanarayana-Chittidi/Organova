'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { transplantApi } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useSocket } from '@/context/SocketContext';
import OrganImage from '@/components/OrganImage';
import {
  Activity,
  Heart,
  Clock,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ArrowRight,
  XCircle,
  FileText,
} from 'lucide-react';

export default function RecipientWaitlistStatusPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { alerts } = useSocket();

  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [actionMsg, setActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchPassport = async () => {
    try {
      const res = await transplantApi.getMyRequests();
      if (res.success) {
        setRequests(Array.isArray(res.data) ? res.data : []);
      }
    } catch (err) {} finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login');
      return;
    }
    if (user) fetchPassport();
  }, [user, authLoading, alerts]);

  const handleRespond = async (matchId: number, decision: 'ACCEPT' | 'DECLINE') => {
    setActionLoadingId(matchId);
    setActionMsg(null);
    try {
      const res = await transplantApi.respondToMatch(matchId, decision);
      if (res.success) {
        setActionMsg({
          type: 'success',
          text:
            decision === 'ACCEPT'
              ? 'MATCH ACCEPTED! Your organ transplant is confirmed. Your attending hospital surgical team has been notified.'
              : 'Offer declined. You remain active on the waitlist with your priority intact.',
        });
        await fetchPassport();
      } else {
        setActionMsg({ type: 'error', text: res.message || 'Failed to submit response.' });
      }
    } catch (err: any) {
      setActionMsg({ type: 'error', text: err.message || 'Failed to submit response.' });
    } finally {
      setActionLoadingId(null);
    }
  };

  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'WAITING_LIST':
        return {
          label: 'Active On Transplant Waitlist',
          color: 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60',
          desc: 'Your clinical profile is actively cross-matched whenever a donor organ is harvested.',
        };
      case 'MATCH_OFFERED':
        return {
          label: 'MATCH OFFERED — 20-MIN WINDOW ACTIVE',
          color: 'bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 border-amber-300 dark:border-amber-700 animate-pulse',
          desc: 'A compatible donor organ has been allocated to you! Review and accept the offer below, or your hospital can accept on your behalf.',
        };
      case 'ACCEPTED':
        return {
          label: 'MATCH ACCEPTED — TRANSPLANT CONFIRMED',
          color: 'bg-blue-100 dark:bg-blue-950/60 text-blue-900 dark:text-blue-300 border-blue-300 dark:border-blue-700 font-bold',
          desc: 'Transplant confirmed! Pre-op admission and surgical logistics are active in the real world.',
        };
      default:
        return {
          label: status,
          color: 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700',
          desc: 'Registration in progress.',
        };
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full transition-colors duration-200">
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-200 dark:border-slate-800 gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-transparent dark:border-emerald-900/50 text-xs font-semibold mb-2">
              <Clock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              Waitlist Status Tracker
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight transition-colors">
              Transplant Waitlist Status
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 transition-colors">
              Live tracking of your organ requisition, 20-minute match offers, and clinical ledger.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/citizen/history"
              className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-xs transition-colors flex items-center gap-1.5"
            >
              <FileText className="w-3.5 h-3.5" />
              Organ Ledger →
            </Link>
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

        <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-900/50 text-xs text-blue-900 dark:text-blue-200 leading-relaxed flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block mb-0.5">Clinical Enrollment & Dual Acceptance Notice:</span>
            Your requisition is tracked across 3 transparent stages: <strong>WAITING_LIST</strong> (waiting for donor), <strong>MATCH_OFFERED</strong> (20-minute offer window), and <strong>ACCEPTED</strong> (transplant confirmed). When an offer is proposed, you can accept directly from this dashboard, or your attending hospital can accept on your behalf.
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center text-xs text-slate-400 dark:text-slate-500">
            Loading your waitlist status...
          </div>
        ) : requests.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 text-center border border-slate-200 dark:border-slate-800 shadow-xs">
            <Clock className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              No Active Waitlist Registration Found
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
              You are currently not enrolled on the organ waitlist. If you require a transplant, please contact your attending hospital to complete clinical evaluation and registry enrollment.
            </p>
            <Link
              href="/directory"
              className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-800 text-white font-semibold text-xs hover:bg-slate-800 dark:hover:bg-slate-700 transition-colors"
            >
              Browse Partner Hospitals
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {requests.map((req) => {
              const statusInfo = getStatusDisplay(req.status);
              const isMatchOffered = req.status === 'MATCH_OFFERED';
              const isAccepted = req.status === 'ACCEPTED';

              return (
                <div
                  key={req.id}
                  className={`bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border shadow-xs transition-all ${
                    isMatchOffered
                      ? 'border-amber-400 dark:border-amber-500 ring-2 ring-amber-400/20 shadow-lg'
                      : isAccepted
                      ? 'border-blue-400 dark:border-blue-500/60 ring-2 ring-blue-400/10'
                      : 'border-slate-200 dark:border-slate-800'
                  }`}
                >
                  {isMatchOffered && (
                    <div className="p-5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 mb-6 shadow-lg shadow-amber-500/20">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 font-black uppercase text-[11px] tracking-wider text-slate-900">
                            <Sparkles className="w-4 h-4 animate-spin text-slate-950" />
                            <span>Active Organ Match Allocation • 20-Min Window</span>
                          </div>
                          <p className="text-xs text-slate-950 font-bold">
                            A compatible donor {req.organ_name} has been matched to your requisition!
                            {req.active_match_score && (
                              <span> (Compatibility Score: {req.active_match_score}/100)</span>
                            )}
                          </p>
                          <p className="text-[11px] text-slate-900/80">
                            You can accept below, or your attending hospital can accept on your behalf if you are admitted or at reception.
                          </p>
                        </div>

                        {req.active_match_id && (
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() => handleRespond(req.active_match_id!, 'DECLINE')}
                              disabled={actionLoadingId === req.active_match_id}
                              className="px-3.5 py-2 rounded-xl bg-slate-950/15 hover:bg-slate-950/25 text-slate-950 font-bold text-xs border border-slate-950/20 transition-all cursor-pointer disabled:opacity-50"
                            >
                              Decline
                            </button>
                            <button
                              onClick={() => handleRespond(req.active_match_id!, 'ACCEPT')}
                              disabled={actionLoadingId === req.active_match_id}
                              className="px-4 py-2 rounded-xl bg-slate-950 hover:bg-slate-900 text-white font-black text-xs shadow-md transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                            >
                              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                              {actionLoadingId === req.active_match_id ? 'Confirming...' : 'Accept Organ Offer'}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {isAccepted && (
                    <div className="p-4 rounded-2xl bg-emerald-500 text-white font-semibold text-xs mb-6 shadow-md shadow-emerald-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-5 h-5 text-white shrink-0" />
                        <div>
                          <span className="font-black uppercase tracking-wider block text-[11px]">
                            MATCH ACCEPTED • TRANSPLANT CONFIRMED
                          </span>
                          <span className="text-[11px] text-white/90">
                            Transplant confirmed! Attending hospital ({req.attending_hub_name}) is proceeding with surgical crossmatch and pre-op logistics in the real world.
                          </span>
                        </div>
                      </div>
                      <Link
                        href="/citizen/history"
                        className="px-3 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white font-bold text-xs shrink-0 transition-colors"
                      >
                        View in History Ledger →
                      </Link>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-4">
                      <OrganImage
                        organ={req.organ_name || req.organ_code}
                        size="lg"
                        className="shrink-0"
                      />
                      <div>
                        <span className="text-[10px] uppercase font-bold tracking-wider text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 px-2.5 py-1 rounded-md">
                          Organ Required
                        </span>
                        <h2 className="text-2xl font-black text-slate-900 dark:text-white mt-1.5 flex items-center gap-2">
                          {req.organ_name}
                          <span className="text-base font-bold text-rose-600 dark:text-rose-400">
                            ({req.blood_group})
                          </span>
                        </h2>
                      </div>
                    </div>

                    <div className="text-right">
                      <span
                        className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${statusInfo.color}`}
                      >
                        {statusInfo.label}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-6 border-b border-slate-100 dark:border-slate-800 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                        Clinical Urgency
                      </span>
                      <span className="font-bold text-slate-900 dark:text-white block mt-0.5">
                        {req.urgency_tier.replace(/_/g, ' ')}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                        Time on Waitlist
                      </span>
                      <span className="font-bold text-slate-900 dark:text-white block mt-0.5 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                        {req.days_waiting || 0} Day(s)
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                        Attending Hospital
                      </span>
                      <span className="font-bold text-blue-600 dark:text-blue-400 block mt-0.5">
                        {req.attending_hub_name}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                        City
                      </span>
                      <span className="font-bold text-slate-900 dark:text-white block mt-0.5">
                        {req.attending_hub_city}
                      </span>
                    </div>
                  </div>

                  <div className="pt-4 text-xs">
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">
                      Clinical Summary from Hospital:
                    </span>
                    <p className="text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-100 dark:border-slate-700/60 italic">
                      &quot;{req.medical_summary.replace(/\[MOCK TEST\]\s*/gi, '').replace(/\[TEST\]\s*/gi, '').trim()}&quot;
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
