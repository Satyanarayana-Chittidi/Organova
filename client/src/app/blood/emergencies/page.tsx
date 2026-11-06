'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useSocket, LiveAlert } from '@/context/SocketContext';
import {
  Droplet,
  MapPin,
  Clock,
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  Building2,
  AlertTriangle,
  Search,
  Filter,
  CheckCircle2,
  Phone,
} from 'lucide-react';

function EmergenciesContent() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { alerts, refreshAlerts } = useSocket();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUrgency, setSelectedUrgency] = useState<string>('ALL');

  useEffect(() => {
    if (user?.role === 'USER') {
      refreshAlerts();
    }
  }, [user, refreshAlerts]);

  // Extract active pass if user is currently committed
  const activePass = alerts.find((a) => a.type === 'ACTIVE_DONOR_PASS');

  // Extract all matching SOS alerts for this citizen (excluding own requisitions)
  const matchingEmergencies = useMemo(() => {
    return alerts.filter(
      (a) => a.type === 'BLOOD_DONOR_SOS' && (!a.meta?.requesterUserId || a.meta?.requesterUserId !== user?.id)
    );
  }, [alerts, user]);

  // Filter and sort emergencies
  const filteredEmergencies = useMemo(() => {
    let result = [...matchingEmergencies];

    // Filter by urgency
    if (selectedUrgency !== 'ALL') {
      result = result.filter(
        (a) => (a.priority || '').toUpperCase() === selectedUrgency.toUpperCase()
      );
    }

    // Filter by search query (hospital name or city)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((a) => {
        const hospital = (a.meta?.destinationHospital || '').toLowerCase();
        const city = (a.meta?.destinationCity || '').toLowerCase();
        const addr = (a.meta?.destinationAddress || '').toLowerCase();
        const blood = (a.meta?.bloodGroup || '').toLowerCase();
        return (
          hospital.includes(q) || city.includes(q) || addr.includes(q) || blood.includes(q)
        );
      });
    }

    // Sort by priority (CRITICAL > URGENT > ROUTINE), then newest first
    return result.sort((a, b) => {
      const weight: Record<string, number> = { CRITICAL: 1, URGENT: 2, ROUTINE: 3 };
      const weightA = weight[a.priority || 'ROUTINE'] || 99;
      const weightB = weight[b.priority || 'ROUTINE'] || 99;
      if (weightA !== weightB) return weightA - weightB;
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });
  }, [matchingEmergencies, selectedUrgency, searchQuery]);

  // Count by urgency for badges
  const criticalCount = matchingEmergencies.filter(
    (a) => a.priority === 'CRITICAL'
  ).length;
  const urgentCount = matchingEmergencies.filter(
    (a) => a.priority === 'URGENT'
  ).length;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-8 px-4 sm:px-6 lg:px-8 transition-colors">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </Link>
          <span className="text-xs text-slate-400">
            {matchingEmergencies.length} active matching requisition
            {matchingEmergencies.length === 1 ? '' : 's'}
          </span>
        </div>

        {/* Page Title & Context Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 text-xs font-semibold mb-2">
              <Droplet className="w-3.5 h-3.5 fill-current" />
              Live Blood Requisitions
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Emergencies Matching Your Blood Type
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
              Urgent hospital orders currently open for immediate walk-in donor collection matching your registered blood profile.
            </p>
          </div>
        </div>

        {/* Active Walk-In Pass Notice if already committed */}
        {activePass && (
          <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-6 h-6 text-emerald-600 shrink-0" />
              <div>
                <p className="font-bold text-xs uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                  Active Commitment In Progress
                </p>
                <p className="text-xs text-slate-700 dark:text-slate-300">
                  You are committed to donate {activePass.meta?.bloodGroup} at {activePass.meta?.destinationHospital}.
                </p>
              </div>
            </div>
            <Link
              href={`/blood/donate/${activePass.meta?.requestId}`}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 transition-colors self-start sm:self-auto shrink-0"
            >
              Open Your Walk-In Pass →
            </Link>
          </div>
        )}

        {/* Search & Urgency Filter Toolbar */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row gap-4 items-center justify-between">
          {/* Search Input */}
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by hospital name or city..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-rose-500"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
            <button
              type="button"
              onClick={() => setSelectedUrgency('ALL')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
                selectedUrgency === 'ALL'
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              All ({matchingEmergencies.length})
            </button>

            <button
              type="button"
              onClick={() => setSelectedUrgency('CRITICAL')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer shrink-0 flex items-center gap-1.5 ${
                selectedUrgency === 'CRITICAL'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 hover:bg-rose-100'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
              Critical ({criticalCount})
            </button>

            <button
              type="button"
              onClick={() => setSelectedUrgency('URGENT')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
                selectedUrgency === 'URGENT'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 hover:bg-amber-100'
              }`}
            >
              Urgent ({urgentCount})
            </button>

            <button
              type="button"
              onClick={() => setSelectedUrgency('ROUTINE')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
                selectedUrgency === 'ROUTINE'
                  ? 'bg-slate-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              Routine
            </button>
          </div>
        </div>

        {/* Emergencies Grid List */}
        {filteredEmergencies.length === 0 ? (
          <div className="py-16 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 shadow-xs">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              No matching emergencies found
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto leading-relaxed">
              {searchQuery || selectedUrgency !== 'ALL'
                ? 'Try adjusting your search query or urgency filter.'
                : 'There are currently no open emergency requisitions matching your blood group. You will receive an immediate real-time alert when a hospital needs urgent units.'}
            </p>
            <div className="mt-6 flex justify-center gap-3">
              {(searchQuery || selectedUrgency !== 'ALL') && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedUrgency('ALL');
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold hover:bg-slate-200 transition-colors"
                >
                  Clear Filters
                </button>
              )}
              <Link
                href="/"
                className="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 transition-colors"
              >
                Return to Dashboard
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {filteredEmergencies.map((alert: LiveAlert) => (
              <div
                key={alert.id}
                className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-rose-300 dark:hover:border-rose-800 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Card Header: Specimen & Urgency */}
                  <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-black text-slate-900 dark:text-white">
                        {alert.meta?.bloodGroup}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                        • {alert.meta?.component?.replace(/_/g, ' ') || 'Whole Blood'}
                      </span>
                    </div>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${
                        alert.priority === 'CRITICAL'
                          ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                          : alert.priority === 'URGENT'
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                          : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      {alert.priority === 'CRITICAL' && (
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-ping"></span>
                      )}
                      {alert.priority}
                    </span>
                  </div>

                  {/* Hospital Details */}
                  <div className="space-y-1.5">
                    <h4 className="font-bold text-slate-900 dark:text-white text-base">
                      {alert.meta?.destinationHospital}
                    </h4>

                    {(alert.meta?.destinationAddress || alert.meta?.destinationCity) && (
                      <p className="text-xs text-slate-600 dark:text-slate-300 flex items-start gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                        <span>
                          {alert.meta?.destinationAddress}
                          {alert.meta?.destinationCity ? `, ${alert.meta?.destinationCity}` : ''}
                        </span>
                      </p>
                    )}

                    {alert.meta?.destinationPhone && (
                      <p className="text-xs text-slate-500 flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>Contact: {alert.meta?.destinationPhone}</span>
                      </p>
                    )}

                    <div className="pt-2 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                      <span className="font-semibold text-rose-600 dark:text-rose-400">
                        {alert.meta?.unitsRequested || 1} Unit(s) Needed
                      </span>
                      <span className="text-[11px] text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(alert.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Action Link */}
                <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-[11px] font-mono text-slate-400">
                    #BR-{alert.meta?.requestId}
                  </span>
                  <Link
                    href={`/blood/donate/${alert.meta?.requestId}`}
                    className="inline-flex items-center gap-1 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-colors shadow-xs"
                  >
                    Review & Walk-In to Donate
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AllEmergenciesPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 py-12 px-4 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
              Loading matching blood emergencies...
            </p>
          </div>
        </div>
      }
    >
      <EmergenciesContent />
    </Suspense>
  );
}
