'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { transplantApi, organApi, hubApi } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useSocket } from '@/context/SocketContext';
import OrganImage from '@/components/OrganImage';
import { MatchEngineIcon } from '@/components/HospitalPortalIcons';
import {
  Activity,
  Heart,
  Clock,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Sparkles,
  Zap,
  ArrowRight,
  RefreshCw,
  Award,
  Send,
  Users,
  Building2,
  Lock,
  ChevronDown,
  Check,
} from 'lucide-react';

function DecisionRoomContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialOrganId = searchParams.get('organId');

  const { user, loading: authLoading } = useAuth();
  const { alerts } = useSocket();

  const [myHub, setMyHub] = useState<any>(null);
  const [organs, setOrgans] = useState<any[]>([]);
  const [activeOffers, setActiveOffers] = useState<any[]>([]);
  const [selectedOrganId, setSelectedOrganId] = useState<string>(initialOrganId || '');
  const [isOrganDropdownOpen, setIsOrganDropdownOpen] = useState(false);
  const organDropdownRef = useRef<HTMLDivElement>(null);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [declinedCandidates, setDeclinedCandidates] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(Date.now());

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (organDropdownRef.current && !organDropdownRef.current.contains(e.target as Node)) {
        setIsOrganDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (activeOffers.length === 0) return;
    const hasExpired = activeOffers.some(
      (o) => new Date(o.response_deadline).getTime() <= currentTime
    );
    if (hasExpired) {
      transplantApi.sweepTimeouts().finally(() => {
        loadAll();
      });
    }
  }, [currentTime, activeOffers]);

  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      loadActiveOffers();
    }, 10000);
    return () => clearInterval(interval);
  }, [user]);

  const loadOrgans = async () => {
    try {
      const res = await organApi.listOrgans({ only_viable: true });
      if (res.success) {
        const organList = Array.isArray(res.data) ? res.data : [];
        const availableOnly = organList.filter((o) => o.status === 'AVAILABLE');
        setOrgans(availableOnly);
        if (initialOrganId && availableOnly.some((o) => String(o.id) === String(initialOrganId))) {
          setSelectedOrganId(initialOrganId);
        }
      }
    } catch (err) {}
  };

  const loadActiveOffers = async () => {
    try {
      const res = await transplantApi.getActiveMatches();
      if (res.success) {
        setActiveOffers(Array.isArray(res.data) ? res.data : []);
      }
    } catch (err) {}
  };

  const loadMyHub = async () => {
    try {
      const res = await hubApi.getMyHub();
      if (res.success && res.data) {
        setMyHub(res.data);
      }
    } catch (err) {}
  };

  const loadAll = async () => {
    await Promise.all([loadOrgans(), loadActiveOffers(), loadMyHub()]);
  };

  useEffect(() => {
    if (!authLoading && (!user || !['HOSPITAL', 'ADMIN'].includes(user.role))) {
      router.push('/auth/login');
      return;
    }
    if (user) loadAll();
  }, [user, authLoading, alerts]);

  useEffect(() => {
    if (initialOrganId && user) {
      setSelectedOrganId(initialOrganId);
      handleRunMatching(initialOrganId);
    }
  }, [initialOrganId, user]);

  const handleSelectOrgan = (organId: string) => {
    setSelectedOrganId(organId);
    setLeaderboard([]);
    setDeclinedCandidates([]);
    setError(null);
    setSuccessMsg(null);
  };

  const handleRunMatching = async (organIdOverride?: string) => {
    const organToEvaluate = organIdOverride || selectedOrganId;
    if (!organToEvaluate) return;
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      const res = await transplantApi.runMatching(Number(organToEvaluate));
      if (res.success) {
        const candidates = res.data.leaderboard || [];
        const declined = res.data.declinedCandidates || [];
        setLeaderboard(candidates);
        setDeclinedCandidates(declined);

        if (candidates.length > 0) {
          setSuccessMsg(
            `Found ${candidates.length} compatible candidate(s). Review scores below and click "Allocate Organ" to dispatch the official 20-minute offer.`
          );
        } else if (declined.length > 0) {
          setError(
            `All ${declined.length} compatible candidate(s) previously declined this organ. They remain active on the waitlist (WAITING_LIST) for subsequent donors.`
          );
        } else {
          setError('No compatible candidates found on waitlist for this organ.');
        }
      } else {
        setError(res.message || 'Matching failed.');
      }
    } catch (err: any) {
      setError(err.message || 'Matching engine run failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleAllocateOrgan = async (candidateRequestId?: number) => {
    if (!selectedOrganId) return;
    setActionLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await transplantApi.allocateOrgan(Number(selectedOrganId), candidateRequestId);
      if (res.success) {
        setSuccessMsg(
          'ORGAN ALLOCATED! 20-minute official response window started. Active offer card added below.'
        );
        setLeaderboard([]);
        setSelectedOrganId('');
        await loadAll();
      } else {
        setError(res.message || 'Failed to allocate organ.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to allocate organ.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDecision = async (matchId: number, decision: 'ACCEPT' | 'DECLINE') => {
    setActionLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await transplantApi.respondToMatch(matchId, decision);
      if (decision === 'ACCEPT') {
        setSuccessMsg('MATCH ACCEPTED! Organ successfully allocated for transplant surgery.');
      } else {
        setSuccessMsg('Offer declined. Candidate safely returned to active waitlist (WAITING_LIST).');
      }
      await loadAll();
      if (selectedOrganId) {
        handleRunMatching(selectedOrganId);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to submit match decision.');
    } finally {
      setActionLoading(false);
    }
  };

  const formatTimer = (totalSeconds: number) => {
    if (totalSeconds <= 0) return '00:00';
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-200 dark:border-slate-800 gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-xs font-semibold mb-2 border border-amber-200 dark:border-amber-800/60">
              <MatchEngineIcon className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              Two-Stage Allocation Protocol
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
              Algorithmic Matching & 20-Minute Offer Console
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              <strong>Stage 1:</strong> Select an available organ to evaluate and rank eligible waitlist candidates (timer is off). <br />
              <strong>Stage 2:</strong> Allocate the organ to create the 20-minute active response card below.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => loadAll()}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Refresh console and active offers"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <Link
              href="/hospital/requests"
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-xs transition-colors flex items-center gap-1.5"
            >
              <Clock className="w-3.5 h-3.5 text-emerald-500" />
              Waitlist Queue →
            </Link>
            <Link
              href="/hospital/harvest"
              className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs shadow-xs transition-colors"
            >
              + Log New Harvest
            </Link>
          </div>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/50 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500 dark:text-emerald-400" />
            <span className="font-semibold">{successMsg}</span>
          </div>
        )}

        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row items-end gap-4 transition-colors">
          <div className="flex-1 w-full">
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Select Available Harvested Organ for Matching
              </label>
              <span className="text-[11px] text-slate-400">
                {organs.length} Available Organ{organs.length === 1 ? '' : 's'}
              </span>
            </div>
            <div className="relative" ref={organDropdownRef}>
              <button
                type="button"
                onClick={() => setIsOrganDropdownOpen((prev) => !prev)}
                className={`w-full min-h-[58px] px-3.5 py-2.5 rounded-xl border bg-white dark:bg-[#0f172a] text-left flex items-center justify-between transition-all cursor-pointer focus:outline-hidden focus:border-rose-500 ${
                  isOrganDropdownOpen
                    ? 'border-rose-500 ring-2 ring-rose-500/20'
                    : 'border-slate-200 dark:border-slate-700'
                }`}
              >
                {(() => {
                  const currentOrgan = organs.find((o) => String(o.id) === String(selectedOrganId));
                  if (!currentOrgan) {
                    return (
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0 text-slate-400 dark:text-slate-500">
                          <Heart className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs font-medium text-slate-400 dark:text-slate-500 block truncate leading-tight">
                            Choose an Available Organ for Matching
                          </span>
                          <span className="text-[11px] text-slate-400 dark:text-slate-500 block truncate leading-tight mt-0.5">
                            Select viable harvested organ to run algorithmic matching
                          </span>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div className="flex items-center gap-2.5 min-w-0">
                      <OrganImage organ={currentOrgan.organ_name || currentOrgan.organ_code} size="sm" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                            {currentOrgan.organ_name}
                          </span>
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-black bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300">
                            {currentOrgan.blood_group}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">#{currentOrgan.id}</span>
                        </div>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 block truncate mt-0.5">
                          Facility: <strong className="text-slate-700 dark:text-slate-300">{currentOrgan.current_hub_name}</strong> ({currentOrgan.current_hub_city || 'Network'})
                        </span>
                      </div>
                    </div>
                  );
                })()}
                <ChevronDown
                  className={`w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0 ml-2 transition-transform duration-200 ${
                    isOrganDropdownOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {isOrganDropdownOpen && (
                <div className="absolute left-0 right-0 top-full mt-1.5 z-40 bg-white dark:bg-[#0f172a] rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl overflow-hidden max-h-72 overflow-y-auto animate-in fade-in duration-150 p-1.5 space-y-1">
                  {organs.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400">
                      No viable organs currently available for matching.
                    </div>
                  ) : (
                    organs.map((o) => {
                      const isSelected = String(o.id) === String(selectedOrganId);
                      const isLocalHarvest = myHub?.id && o.harvesting_hub_id === myHub.id;
                      return (
                        <button
                          key={o.id}
                          type="button"
                          onClick={() => {
                            handleSelectOrgan(String(o.id));
                            setIsOrganDropdownOpen(false);
                          }}
                          className={`w-full min-h-[52px] text-left p-2.5 rounded-xl flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-rose-50/80 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 shadow-2xs'
                              : 'hover:bg-slate-100 dark:hover:bg-slate-800/60 border border-transparent'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <OrganImage organ={o.organ_name || o.organ_code} size="sm" />
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span
                                  className={`font-bold text-xs truncate ${
                                    isSelected ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'
                                  }`}
                                >
                                  {o.organ_name}
                                </span>
                                <span className="px-1.5 py-0.2 rounded text-[10px] font-black bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300">
                                  {o.blood_group}
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono">#{o.id}</span>
                                {isLocalHarvest && (
                                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                                    Your Hub
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] text-slate-500 dark:text-slate-400 block truncate mt-0.5">
                                Facility: <strong className="text-slate-700 dark:text-slate-300">{o.current_hub_name}</strong> ({o.current_hub_city || 'Network'})
                              </span>
                            </div>
                          </div>
                          {isSelected && <Check className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />}
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </div>

          <button
            onClick={() => handleRunMatching()}
            disabled={!selectedOrganId || loading}
            className="w-full sm:w-auto min-h-[58px] px-6 rounded-xl bg-gradient-to-r from-rose-600 to-red-500 hover:from-rose-500 hover:to-red-600 text-white font-semibold text-xs shadow-md shadow-rose-500/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer shrink-0"
          >
            <Zap className="w-4 h-4 fill-white" />
            {loading ? 'Evaluating Candidates...' : 'Run Matching Engine'}
          </button>
        </div>

        {leaderboard.length > 0 && (
          <div className="space-y-6">
            {(() => {
              const topCandidate = leaderboard[0];
              const isTopInpatient = myHub?.id && topCandidate.attendingHubId === myHub.id;
              const myInpatients = leaderboard.filter((c) => myHub?.id && c.attendingHubId === myHub.id);
              const myTopCandidate = myInpatients.length > 0 ? myInpatients[0] : null;

              if (isTopInpatient || user?.role === 'ADMIN') {
                return (
                  <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-3xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <span>Top Candidate is Your Inpatient • 20-Min Response Window NOT Started</span>
                      </div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">
                        Top Matched Candidate: {topCandidate.recipientName} ({topCandidate.totalScore}/100 pts)
                      </h3>
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        The 20-minute countdown response timer begins strictly when you click <strong>Allocate Organ</strong>.
                      </p>
                    </div>
                    <button
                      onClick={() => handleAllocateOrgan(topCandidate.requestId)}
                      disabled={actionLoading}
                      className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 cursor-pointer transition-all shrink-0"
                    >
                      <Send className="w-4 h-4" />
                      <span>Allocate to Candidate #1 & Dispatch 20-Min Offer</span>
                    </button>
                  </div>
                );
              }

              if (myTopCandidate) {
                return (
                  <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/40 border border-amber-200 dark:border-amber-800/60 rounded-3xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-800 dark:text-amber-300">
                        <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                        <span>Rank #1 is at {topCandidate.attendingHubName || 'External Facility'} • Your Candidate is Eligible</span>
                      </div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">
                        Your Facility Candidate: {myTopCandidate.recipientName} ({myTopCandidate.totalScore}/100 pts)
                      </h3>
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        Candidate #{topCandidate.requestId} is registered under {topCandidate.attendingHubName}. As an attending facility, you can allocate this organ directly to your own patient.
                      </p>
                    </div>
                    <button
                      onClick={() => handleAllocateOrgan(myTopCandidate.requestId)}
                      disabled={actionLoading}
                      className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg shadow-rose-600/30 flex items-center justify-center gap-2 cursor-pointer transition-all shrink-0"
                    >
                      <Send className="w-4 h-4" />
                      <span>Allocate to {myTopCandidate.recipientName} & Dispatch Offer</span>
                    </button>
                  </div>
                );
              }

              return (
                <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300">
                      <AlertCircle className="w-4 h-4 text-slate-400" />
                      <span>Candidates Evaluated • No Inpatient Candidates from Your Facility</span>
                    </div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      Top Candidate: {topCandidate.recipientName} ({topCandidate.attendingHubName || 'External Hospital'})
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      You are viewing platform transparency rankings. Allocations can only be dispatched for candidates registered under your hospital ({myHub?.name || 'Your Facility'}).
                    </p>
                  </div>
                  <div className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold text-xs border border-slate-300 dark:border-slate-700 shrink-0">
                    Read-Only Overview
                  </div>
                </div>
              );
            })()}

            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Candidate Leaderboard & Scoring Breakdown
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Clinical multi-factor algorithm: Urgency (35%), Wait Time (25%), Distance (20%), HLA/ABO (20%).
                  </p>
                </div>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {leaderboard.length} Compatible Candidate{leaderboard.length > 1 ? 's' : ''} Evaluated Across Network
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 uppercase tracking-wider text-[10px]">
                      <th className="pb-3 font-bold">Rank</th>
                      <th className="pb-3 font-bold">Candidate</th>
                      <th className="pb-3 font-bold">Attending Facility</th>
                      <th className="pb-3 font-bold">Blood Group</th>
                      <th className="pb-3 font-bold">Urgency (35%)</th>
                      <th className="pb-3 font-bold">Wait Time (25%)</th>
                      <th className="pb-3 font-bold">Distance (20%)</th>
                      <th className="pb-3 font-bold">HLA/ABO (20%)</th>
                      <th className="pb-3 font-bold">Total Score</th>
                      <th className="pb-3 font-bold text-right">Allocation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {leaderboard.map((c, idx) => {
                      const isMyCandidate = myHub?.id && c.attendingHubId === myHub.id;
                      const canAllocate = isMyCandidate || user?.role === 'ADMIN';

                      return (
                        <tr
                          key={c.requestId}
                          className={`hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors ${
                            isMyCandidate ? 'bg-emerald-50/30 dark:bg-emerald-950/20' : ''
                          }`}
                        >
                          <td className="py-3 font-bold text-slate-400 dark:text-slate-500">#{idx + 1}</td>
                          <td className="py-3">
                            <span className="font-bold text-slate-900 dark:text-white block">
                              {c.recipientName}
                            </span>
                            {isMyCandidate && (
                              <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300">
                                Your Inpatient
                              </span>
                            )}
                          </td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">
                            <div className="flex items-center gap-1.5">
                              <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className={isMyCandidate ? 'font-bold text-slate-900 dark:text-white' : ''}>
                                {c.attendingHubName || 'Medical Facility'}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 font-semibold text-rose-600 dark:text-rose-400">{c.bloodGroup}</td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">{c.urgencyScore} pts</td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">
                            {c.waitTimeScore} pts ({c.daysWaiting}d)
                          </td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">
                            {c.proximityScore} pts ({c.distanceKm}km)
                          </td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">{c.hlaAboScore} pts</td>
                          <td className="py-3 font-black text-rose-600 dark:text-rose-400 text-sm">
                            {c.totalScore}
                          </td>
                          <td className="py-3 text-right">
                            {canAllocate ? (
                              <button
                                onClick={() => handleAllocateOrgan(c.requestId)}
                                disabled={actionLoading}
                                className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold text-[11px] disabled:opacity-40 transition-colors cursor-pointer shadow-xs"
                              >
                                Allocate Organ →
                              </button>
                            ) : (
                              <span
                                className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 font-semibold text-[10px] inline-flex items-center gap-1 border border-slate-200 dark:border-slate-700/60"
                                title={`Registered under ${c.attendingHubName || 'another facility'}. Allocations are restricted to your facility's registered patients.`}
                              >
                                <Lock className="w-3 h-3 text-slate-400" />
                                External
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {declinedCandidates.length > 0 && (
          <div className="bg-slate-50 dark:bg-slate-900/60 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 transition-colors">
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle className="w-4 h-4 text-slate-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Previously Declined for this Organ ({declinedCandidates.length})
              </h3>
            </div>
            <div className="space-y-2">
              {declinedCandidates.map((d: any) => (
                <div
                  key={d.match_id || d.request_id}
                  className="p-3.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                >
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white mr-2">{d.recipient_name}</span>
                    <span className="text-rose-600 dark:text-rose-400 font-bold mr-2">({d.blood_group})</span>
                    <span className="text-slate-400">• {d.attending_hub_name}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold text-[11px] border border-emerald-200 dark:border-emerald-800">
                      Waitlist Status: WAITING_LIST
                    </span>
                    <span className="px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-semibold text-[11px]">
                      Declined for Organ #{selectedOrganId}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-3">
              Declining an offer only excludes the candidate from this specific harvested organ. The candidate remains in <strong>WAITING_LIST</strong> status on the registry with their original priority intact for subsequent donor organs.
            </p>
          </div>
        )}

        {activeOffers.length > 0 && (
          <div className="space-y-6 pt-4 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between pb-1 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
                </span>
                <h2 className="text-sm font-black uppercase tracking-wider text-amber-900 dark:text-amber-300 flex items-center gap-2">
                  <span>Organs in Active 20-Minute Response Window</span>
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-800 dark:text-amber-200 text-xs font-mono">
                    {activeOffers.length} Active
                  </span>
                </h2>
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                Decision required within 20-minute protocol
              </span>
            </div>

            {activeOffers.map((offer) => {
              const remainingSecs = Math.max(
                0,
                Math.floor((new Date(offer.response_deadline).getTime() - currentTime) / 1000)
              );
              const isTimedOut = remainingSecs === 0;

              return (
                <div
                  key={offer.id}
                  className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 text-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-700/60 relative overflow-hidden"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4 pb-6 border-b border-slate-700/80 mb-6">
                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-widest text-amber-400 block mb-1">
                        OFFICIAL ALLOCATION PROPOSAL • 20-MIN PROTOCOL
                      </span>
                      <h3 className="text-2xl font-black text-white flex items-center gap-3">
                        Match Offer #{offer.id}
                        <span className="text-base font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 rounded-lg">
                          Score: {offer.match_score} / 100
                        </span>
                      </h3>
                    </div>

                    <div
                      className={`p-3.5 rounded-2xl border text-center shrink-0 ${
                        isTimedOut
                          ? 'bg-rose-500/20 border-rose-500/50 text-rose-300'
                          : remainingSecs < 300
                          ? 'bg-red-500/20 border-red-500/50 text-red-300 animate-pulse'
                          : 'bg-amber-500/10 border-amber-500/40 text-amber-300'
                      }`}
                    >
                      <div className="flex items-center justify-center gap-1.5 text-2xl font-black font-mono">
                        <Clock className="w-5 h-5 text-amber-400" />
                        <span>{isTimedOut ? '00:00' : formatTimer(remainingSecs)}</span>
                      </div>
                      <span className="text-[9px] uppercase font-bold tracking-widest text-slate-400 block mt-0.5">
                        {isTimedOut ? 'Window Completed (Auto-Declining...)' : 'Response Window Remaining'}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pb-6 border-b border-slate-700/80 text-xs">
                    <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700">
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1">
                        Matched Recipient Patient
                      </span>
                      <span className="text-base font-bold text-white block">
                        {offer.recipient_name || 'Anonymous Patient'}
                      </span>
                      <span className="text-rose-400 font-bold block mt-1">
                        Blood Group: {offer.recipient_blood_group}
                      </span>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700">
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1">
                        Attending Hospital
                      </span>
                      <span className="text-base font-bold text-white block">
                        {offer.attending_hub_name || 'Attending Center'}
                      </span>
                      <span className="text-slate-400 block mt-1">Surgical Unit Evaluating</span>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700 flex items-center justify-between gap-3">
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1">
                          Donor Organ Details
                        </span>
                        <span className="text-base font-bold text-white block">
                          {offer.organ_name} ({offer.organ_blood_group})
                        </span>
                        <span className="text-slate-400 block mt-1">
                          Harvest Facility: {offer.harvesting_hub_name}
                        </span>
                      </div>
                      <OrganImage organ={offer.organ_name || offer.organ_code} size="md" />
                    </div>
                  </div>

                  <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="text-xs text-slate-400 flex items-center gap-2 flex-wrap">
                      <span>Current Status: <strong className="text-white uppercase">{offer.status}</strong></span>
                      {myHub?.id && offer.attending_hub_id === myHub.id && (
                        <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-bold text-[10px] border border-emerald-500/40">
                          Your Facility Patient
                        </span>
                      )}
                    </div>

                    {offer.status === 'PROPOSED' ? (
                      (() => {
                        const isMyAttendingPatient = myHub?.id && offer.attending_hub_id === myHub.id;
                        const canRespond = isMyAttendingPatient || user?.role === 'ADMIN';

                        if (canRespond) {
                          return (
                            <div className="flex items-center gap-3 w-full sm:w-auto">
                              <button
                                onClick={() => handleDecision(offer.id, 'DECLINE')}
                                disabled={actionLoading || isTimedOut}
                                className="flex-1 sm:flex-none px-5 py-3 rounded-xl bg-slate-800 hover:bg-red-950/60 border border-slate-700 hover:border-red-500/50 text-red-300 font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                              >
                                <XCircle className="w-4 h-4 text-red-400" />
                                Decline Offer (Return to Waitlist)
                              </button>

                              <button
                                onClick={() => handleDecision(offer.id, 'ACCEPT')}
                                disabled={actionLoading || isTimedOut}
                                className="flex-1 sm:flex-none px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-600 text-white font-bold text-xs shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                              >
                                <CheckCircle2 className="w-4 h-4" />
                                ACCEPT OFFER & ALLOCATE
                              </button>
                            </div>
                          );
                        }

                        return (
                          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800/90 border border-slate-700 text-slate-300 text-xs">
                            <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
                            <span>
                              Awaiting surgical acceptance from <strong>{offer.attending_hub_name || 'Attending Facility'}</strong>. Response is restricted to the attending hospital or recipient patient.
                            </span>
                          </div>
                        );
                      })()
                    ) : (
                      <div className="px-4 py-2 rounded-xl bg-slate-800 text-emerald-400 font-bold text-xs flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" />
                        Decision Recorded: {offer.status}
                      </div>
                    )}
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

export default function TransplantDecisionRoomPage() {
  return (
    <Suspense
      fallback={
        <div className="p-16 text-center text-xs text-slate-400 dark:text-slate-500">
          Loading Match Engine...
        </div>
      }
    >
      <DecisionRoomContent />
    </Suspense>
  );
}
