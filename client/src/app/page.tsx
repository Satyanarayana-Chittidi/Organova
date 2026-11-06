'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Heart,
  Droplet,
  Hospital,
  Activity,
  Award,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Navigation,
  ExternalLink,
  MapPin,
  Clock,
  HeartHandshake,
  Building2,
  Truck,
  XCircle,
  Plus,
  CreditCard,
  User,
  Calendar,
  Phone,
  Users,
  X,
  BookOpen,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useSocket } from '@/context/SocketContext';
import { bloodApi, citizenApi, campApi, BloodDonationCamp } from '@/lib/api';
import { FindBloodIcon } from '@/components/BloodIcons';
import {
  BloodStockInventoryIcon,
  OrganHarvestRegistryIcon,
  MatchEngineIcon,
} from '@/components/HospitalPortalIcons';

export default function HomePage() {
  const { user } = useAuth();
  const isHospitalStaff = Boolean(
    user && user.role === 'HOSPITAL'
  );
  const { alerts, refreshAlerts, socket } = useSocket();

  const [myRequests, setMyRequests] = useState<any[]>([]);
  const [myRequestsLoading, setMyRequestsLoading] = useState(false);
  const [cancellingId, setCancellingId] = useState<number | null>(null);

  const [donationHistory, setDonationHistory] = useState<any>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Blood Donation Camps state
  const [camps, setCamps] = useState<BloodDonationCamp[]>([]);
  const [campsLoading, setCampsLoading] = useState(false);
  const [selectedCamp, setSelectedCamp] = useState<BloodDonationCamp | null>(null);

  const fetchMyRequests = useCallback(async () => {
    if (!user || user.role !== 'USER') {
      setMyRequests([]);
      return;
    }
    try {
      setMyRequestsLoading(true);
      const res = await bloodApi.getMyRequests();
      if (res.success && Array.isArray(res.data)) {
        setMyRequests(res.data);
      }
    } catch (err) {
      console.warn('[HOME] Failed to fetch my blood requests:', err);
    } finally {
      setMyRequestsLoading(false);
    }
  }, [user]);

  const fetchHistory = useCallback(async () => {
    if (!user || user.role !== 'USER') {
      setDonationHistory(null);
      return;
    }
    try {
      setHistoryLoading(true);
      const res = await citizenApi.getDonationHistory();
      if (res.success && res.data) {
        setDonationHistory(res.data);
      }
    } catch (err) {
      console.warn('[HOME] Failed to fetch donation history:', err);
    } finally {
      setHistoryLoading(false);
    }
  }, [user]);

  const fetchCamps = useCallback(async () => {
    try {
      setCampsLoading(true);
      const res = await campApi.list();
      if (res.success && Array.isArray(res.data)) {
        setCamps(res.data);
      }
    } catch (err) {
      console.warn('[HOME] Failed to fetch camps:', err);
    } finally {
      setCampsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCamps();
  }, [fetchCamps]);

  useEffect(() => {
    if (user) {
      refreshAlerts();
      fetchMyRequests();
      if (user.role === 'USER') {
        fetchHistory();
      }
    }
  }, [user, refreshAlerts, fetchMyRequests, fetchHistory]);

  // Real-time socket updates for requests and donation history
  useEffect(() => {
    if (!socket) return;
    const handleUpdate = () => {
      fetchMyRequests();
      refreshAlerts();
      fetchCamps();
      if (user?.role === 'USER') {
        fetchHistory();
      }
    };
    socket.on('BLOOD_ORDER_STATUS_CHANGED', handleUpdate);
    socket.on('BLOOD_REQUEST_ALERT', handleUpdate);
    return () => {
      socket.off('BLOOD_ORDER_STATUS_CHANGED', handleUpdate);
      socket.off('BLOOD_REQUEST_ALERT', handleUpdate);
    };
  }, [socket, fetchMyRequests, refreshAlerts, fetchHistory, fetchCamps, user]);

  const formatCampDateRange = (startDateStr: string, endDateStr?: string | null) => {
    try {
      const formatDate = (dateStr: string) => {
        const parts = dateStr.split('T')[0].split('-');
        if (parts.length === 3) {
          const year = parts[0];
          const monthIndex = parseInt(parts[1], 10) - 1;
          const day = parseInt(parts[2], 10);
          const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          return `${months[monthIndex] || parts[1]} ${day}, ${year}`;
        }
        return dateStr;
      };

      const start = formatDate(startDateStr);
      if (!endDateStr || endDateStr.split('T')[0] === startDateStr.split('T')[0]) {
        return start;
      }
      const end = formatDate(endDateStr);
      return `${start} – ${end}`;
    } catch {
      return startDateStr;
    }
  };

  const getCampNavigateUrl = (camp: BloodDonationCamp) => {
    if (camp.map_url && camp.map_url.trim()) {
      return camp.map_url.trim();
    }
    if (camp.latitude && camp.longitude) {
      return `https://www.google.com/maps/dir/?api=1&destination=${camp.latitude},${camp.longitude}`;
    }
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
      `${camp.venue_name}, ${camp.address_line}, ${camp.city}`
    )}`;
  };

  // Handle cancelling a blood requisition directly from the homepage
  const handleCancelRequest = async (id: number) => {
    if (!confirm('Are you sure you want to cancel this emergency requisition?')) return;
    try {
      setCancellingId(id);
      await bloodApi.cancelRequest(id);
      await fetchMyRequests();
      await refreshAlerts();
    } catch (err: any) {
      alert(err.message || 'Failed to cancel requisition.');
    } finally {
      setCancellingId(null);
    }
  };

  // Active and committed my requests only (cancelled and completed are excluded)
  const activeAndCommittedRequests = myRequests.filter(
    (r) => !['CANCELLED', 'COMPLETED'].includes(r.status)
  );

  // Extract 2 most recent donations
  const recentDonations = React.useMemo(() => {
    if (!donationHistory) return [];
    const blood = (donationHistory.bloodDonations || []).map((b: any) => ({
      id: `blood-${b.id}`,
      type: 'BLOOD',
      bloodGroup: b.blood_group,
      component: b.component,
      units: b.units_requested,
      hospitalName: b.fulfilling_hospital_name || b.receiving_hospital_name,
      hospitalCity: b.fulfilling_hospital_city || b.receiving_hospital_city,
      status: b.status,
      timestamp: b.fulfilled_at || b.created_at,
    }));
    const organ = (donationHistory.organDonations || []).map((o: any) => ({
      id: `organ-${o.id}`,
      type: 'ORGAN',
      bloodGroup: o.blood_group,
      organName: o.organ_name,
      hospitalName: o.harvesting_hub_name,
      hospitalCity: o.harvesting_hub_city,
      status: o.status,
      timestamp: o.harvested_at,
    }));
    return [...blood, ...organ]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 2);
  }, [donationHistory]);

  // Extract active committed pass and matching emergencies for registered citizens (exclude own requisitions)
  const activePass = alerts.find((a) => a.type === 'ACTIVE_DONOR_PASS');
  const matchingEmergencies = alerts.filter(
    (a) => a.type === 'BLOOD_DONOR_SOS' && (!a.meta?.requesterUserId || a.meta?.requesterUserId !== user?.id)
  );

  // Sort matching emergencies by urgency priority (CRITICAL > URGENT > ROUTINE), then newest first
  const sortedEmergencies = [...matchingEmergencies].sort((a, b) => {
    const priorityWeight: Record<string, number> = { CRITICAL: 1, URGENT: 2, ROUTINE: 3 };
    const weightA = priorityWeight[a.priority || 'ROUTINE'] || 99;
    const weightB = priorityWeight[b.priority || 'ROUTINE'] || 99;
    if (weightA !== weightB) return weightA - weightB;
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });

  // Display top four highest emergencies on the homepage
  const topFourEmergencies = sortedEmergencies.slice(0, 4);

  return (
    <div className="flex flex-col flex-1 transition-colors duration-200">
      {/* Friendly Hero Banner */}
      <section className="bg-gradient-to-b from-rose-50/70 via-white to-slate-50 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900 py-12 sm:py-20 px-4 sm:px-6 lg:px-8 transition-colors duration-200">
        <div className="max-w-7xl mx-auto">
          {!user ? (
            /* Unauthenticated / Guest View: Slogan on Left, 4 Portal Buttons on Right */
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
              {/* Left Column: Slogan, Mission & Emergency Blood Action */}
              <div className="lg:col-span-7 space-y-6 text-left">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-transparent dark:border-rose-900/50 text-xs font-semibold">
                  <Heart className="w-3.5 h-3.5 fill-rose-600 dark:fill-rose-400 text-rose-600 dark:text-rose-400" />
                  Organova Donation Network
                </div>

                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-900 dark:text-white tracking-tight leading-[1.15] transition-colors">
                  One Pledge Today.{' '}
                  <span className="text-rose-600 dark:text-rose-400 block sm:inline">
                    A Lifetime of Hope Tomorrow.
                  </span>
                </h1>

                <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 max-w-xl leading-relaxed transition-colors">
                  A single organ donor can save up to 8 lives and heal many more. Join verified donors, find urgent blood units in real time, or manage transplant allocations across hospitals.
                </p>

                {/* Bottom of Left Column: Find Blood in Emergency */}
                <div className="pt-2 flex flex-wrap items-center gap-3">
                  <Link
                    href="/blood-finder"
                    className="px-5 py-2.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-bold text-xs border border-slate-200 dark:border-slate-700 shadow-xs flex items-center gap-2 transition-all cursor-pointer"
                  >
                    <FindBloodIcon className="w-4 h-4 text-red-500" />
                    <span>Find Blood in Emergency →</span>
                  </Link>
                </div>
              </div>

              {/* Right Column: 4 Portal Action Buttons */}
              <div className="lg:col-span-5 w-full">
                <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 border border-slate-200/90 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none space-y-4">
                  <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 block mb-0.5">
                      Portal Gateway
                    </span>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                      Access the Platform
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Select your account type to sign in or get started
                    </p>
                  </div>

                  {/* 4 Gateway Cards / Buttons */}
                  <div className="space-y-2.5">
                    {/* 1. User Login */}
                    <Link
                      href="/auth/login?portal=user"
                      className="group p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 hover:bg-rose-50/70 dark:hover:bg-rose-950/40 border border-slate-200/80 dark:border-slate-700/60 hover:border-rose-300 dark:hover:border-rose-800 transition-all flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 group-hover:text-rose-600 group-hover:border-rose-300 dark:group-hover:text-rose-400 shrink-0 transition-colors shadow-xs">
                          <User className="w-5 h-5" />
                        </div>
                        <div>
                          <span className="text-sm font-bold text-slate-900 dark:text-white block group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors">
                            User Login
                          </span>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                            Citizen donors, recipients & patients
                          </span>
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-rose-600 dark:group-hover:text-rose-400 group-hover:translate-x-0.5 transition-all shrink-0" />
                    </Link>

                    {/* 2. User Sign Up */}
                    <Link
                      href="/auth/register"
                      className="group p-3.5 rounded-2xl bg-gradient-to-r from-rose-600 to-red-500 hover:from-rose-500 hover:to-red-600 text-white shadow-md shadow-rose-600/20 border border-transparent transition-all flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white shrink-0">
                          <Heart className="w-5 h-5 fill-white" />
                        </div>
                        <div>
                          <span className="text-sm font-bold text-white block">
                            User Sign Up
                          </span>
                          <span className="text-[11px] text-rose-100 block">
                            Register as a new donor or patient
                          </span>
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-white group-hover:translate-x-0.5 transition-transform shrink-0" />
                    </Link>

                    {/* 3. Hospital Login */}
                    <Link
                      href="/auth/login?portal=hospital"
                      className="group p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 hover:bg-blue-50/70 dark:hover:bg-blue-950/40 border border-slate-200/80 dark:border-slate-700/60 hover:border-blue-300 dark:hover:border-blue-800 transition-all flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 group-hover:text-blue-600 group-hover:border-blue-300 dark:group-hover:text-blue-400 shrink-0 transition-colors shadow-xs">
                          <Hospital className="w-5 h-5" />
                        </div>
                        <div>
                          <span className="text-sm font-bold text-slate-900 dark:text-white block group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                            Hospital Portal Login
                          </span>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                            Clinical coordinators & medical staff
                          </span>
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all shrink-0" />
                    </Link>

                    {/* 4. Hospital Registration */}
                    <Link
                      href="/hospital/register"
                      className="group p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 hover:bg-emerald-50/70 dark:hover:bg-emerald-950/40 border border-slate-200/80 dark:border-slate-700/60 hover:border-emerald-300 dark:hover:border-emerald-800 transition-all flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 group-hover:text-emerald-600 group-hover:border-emerald-300 dark:group-hover:text-emerald-400 shrink-0 transition-colors shadow-xs">
                          <Building2 className="w-5 h-5" />
                        </div>
                        <div>
                          <span className="text-sm font-bold text-slate-900 dark:text-white block group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                            Hospital Registration
                          </span>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                            Register a verified medical facility
                          </span>
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all shrink-0" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Authenticated Hero Banner for Logged-In User */
            <div className="max-w-4xl mx-auto space-y-6 text-center">
              <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-tight transition-colors">
                One Pledge Today.{' '}
                <span className="text-rose-600 dark:text-rose-400">A Lifetime of Hope Tomorrow.</span>
              </h1>

              <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto leading-relaxed transition-colors">
                A single organ donor can save up to 8 lives and heal many more. Join thousands of verified donors, find urgent blood units, or track your transplant journey.
              </p>

              {/* Core Action Buttons for Authenticated User */}
              <div className="flex flex-wrap justify-center gap-3 pt-2">
                {isHospitalStaff ? (
                  <>
                    <Link
                      href="/hospital/inventory"
                      className="px-6 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-sm shadow-md shadow-rose-600/20 flex items-center gap-2 transition-all cursor-pointer"
                    >
                      <BloodStockInventoryIcon className="w-4 h-4 text-white" />
                      Manage Blood Stock
                      <ArrowRight className="w-4 h-4" />
                    </Link>

                    <Link
                      href="/hospital/harvest"
                      className="px-6 py-3 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-semibold text-sm border border-slate-200 dark:border-slate-700 shadow-xs flex items-center gap-2 transition-all cursor-pointer"
                    >
                      <OrganHarvestRegistryIcon className="w-4 h-4" />
                      Organ Harvest Registry
                    </Link>

                    <Link
                      href="/camps"
                      className="px-6 py-3 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-semibold text-sm border border-slate-200 dark:border-slate-700 shadow-xs flex items-center gap-2 transition-all cursor-pointer"
                    >
                      <Calendar className="w-4 h-4 text-purple-500" />
                      Donation Camps
                    </Link>
                  </>
                ) : (
                  <>
                    <Link
                      href="/donor/pledge"
                      className="px-6 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-sm shadow-md shadow-rose-600/20 flex items-center gap-2 transition-all cursor-pointer"
                    >
                      <Heart className="w-4 h-4 fill-white" />
                      Pledge to Donate Organs
                      <ArrowRight className="w-4 h-4" />
                    </Link>

                    <Link
                      href="/blood-finder"
                      className="px-6 py-3 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-semibold text-sm border border-slate-200 dark:border-slate-700 shadow-xs flex items-center gap-2 transition-all cursor-pointer"
                    >
                      <FindBloodIcon className="w-4 h-4 text-red-500" />
                      Find Blood in Emergency
                    </Link>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Citizens Live Engagement Section between Header & How Can We Help */}
      {user && user.role === 'USER' && (activeAndCommittedRequests.length > 0 || activePass || matchingEmergencies.length > 0 || recentDonations.length > 0) && (
        <section className="py-8 bg-rose-50/50 dark:bg-slate-900/40 border-y border-rose-100 dark:border-slate-800/80 transition-colors">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">

            {/* 1. Status of My Requests (Active & Committed Only, Cancelled Disappears) */}
            {activeAndCommittedRequests.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-pulse"></span>
                    <h3 className="font-bold text-slate-900 dark:text-white text-base">
                      My Requests
                    </h3>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 px-2.5 py-1 rounded-full border border-amber-200 dark:border-amber-900/40 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping"></span>
                      {activeAndCommittedRequests.length} Active Requisition{activeAndCommittedRequests.length > 1 ? 's' : ''}
                    </span>
                    <Link
                      href="/blood/emergency"
                      className="text-xs font-bold text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 inline-flex items-center gap-1.5 bg-white dark:bg-slate-900 px-3 py-1 rounded-full border border-rose-200 dark:border-rose-900/60 shadow-xs transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      New Request
                    </Link>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {activeAndCommittedRequests.map((req) => (
                    <div
                      key={req.id}
                      className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between"
                    >
                      <div>
                        {/* Header: Specimen & Urgency */}
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <span className="px-2.5 py-1 rounded-full bg-rose-50 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 font-bold text-xs border border-rose-100 dark:border-rose-900/50">
                            {req.blood_group} • {req.component?.replace(/_/g, ' ') || 'Whole Blood'}
                          </span>
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                req.urgency === 'CRITICAL'
                                  ? 'bg-red-100 text-red-700 dark:bg-red-950/80 dark:text-red-300'
                                  : req.urgency === 'URGENT'
                                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/80 dark:text-amber-300'
                                  : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                              }`}
                            >
                              {req.urgency}
                            </span>
                            <span className="font-mono text-xs text-slate-400">#BR-{req.id}</span>
                          </div>
                        </div>

                        {/* Destination Hospital */}
                        <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                          {req.destination_hub_name}
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          {req.destination_hub_address || req.destination_hub_city || 'Destination Facility'}
                        </p>
                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 font-medium">
                          Quantity Requested: <strong>{req.units_requested} Unit(s)</strong>
                        </p>

                        {(req.patient_relationship || req.patient_name) && (
                          <div className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 flex-wrap">
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3 text-rose-500" />
                              For: <strong className="text-slate-700 dark:text-slate-300 capitalize">{req.patient_relationship?.toLowerCase() === 'self' ? 'Myself' : (req.patient_relationship || 'Patient')}</strong>
                              {req.patient_name ? ` (${req.patient_name})` : ''}
                            </span>
                          </div>
                        )}

                        {/* Live Status Box */}
                        <div className="mt-3.5">
                          {req.status === 'REQUESTED' && (
                            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 text-xs">
                              <div className="flex items-center gap-1.5 font-bold text-amber-800 dark:text-amber-300 mb-0.5">
                                <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
                                Awaiting Volunteer Donor / Hospital Claim
                              </div>
                              <p className="text-amber-900/90 dark:text-amber-200/90 leading-snug">
                                Active broadcast in progress to all matching {req.blood_group} donors across the network.
                              </p>
                            </div>
                          )}

                          {req.status === 'DONOR_COMMITTED' && (
                            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 text-xs">
                              <div className="flex items-center gap-1.5 font-bold text-emerald-800 dark:text-emerald-300 mb-0.5">
                                <HeartHandshake className="w-4 h-4 text-emerald-600" />
                                Volunteer Donor Committed & En Route!
                              </div>
                              <p className="text-emerald-900/90 dark:text-emerald-200/90 leading-snug">
                                A volunteer donor has locked in and is heading to {req.destination_hub_name}.
                              </p>
                              {req.donor_name && (
                                <p className="mt-1 text-emerald-950 dark:text-emerald-100 font-semibold">
                                  Donor: {req.donor_name} {req.donor_phone ? `(${req.donor_phone})` : ''}
                                </p>
                              )}
                            </div>
                          )}

                          {req.status === 'APPROVED' && (
                            <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50 text-xs">
                              <div className="flex items-center gap-1.5 font-bold text-blue-800 dark:text-blue-300 mb-0.5">
                                <Building2 className="w-4 h-4 text-blue-600" />
                                Claimed & Reserved in Hospital Stock
                              </div>
                              <p className="text-blue-900/90 dark:text-blue-200/90 leading-snug">
                                Reserved by {req.fulfilling_hub_name || 'Medical Hub'}. Stock allocated for dispatch.
                              </p>
                            </div>
                          )}

                          {req.status === 'DISPATCHED' && (
                            <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900/50 text-xs">
                              <div className="flex items-center gap-1.5 font-bold text-purple-800 dark:text-purple-300 mb-0.5">
                                <Truck className="w-4 h-4 text-purple-600" />
                                Units Dispatched — In Transit
                              </div>
                              <p className="text-purple-900/90 dark:text-purple-200/90 leading-snug">
                                Blood units are in temperature-controlled transit to {req.destination_hub_name}.
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Card Footer: Timestamp & Cancel / Manage Action */}
                      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                        <span className="text-[11px] text-slate-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(req.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <div className="flex items-center gap-3">
                          {req.status === 'REQUESTED' && (
                            <button
                              type="button"
                              onClick={() => handleCancelRequest(req.id)}
                              disabled={cancellingId === req.id}
                              className="text-xs font-semibold text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors cursor-pointer"
                            >
                              {cancellingId === req.id ? 'Cancelling...' : 'Cancel Request'}
                            </button>
                          )}
                          <Link
                            href="/blood/emergency"
                            className="inline-flex items-center gap-1 text-xs font-bold text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300"
                          >
                            Manage →
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Divider between My Requests and Emergencies / Pass */}
            {activeAndCommittedRequests.length > 0 && (matchingEmergencies.length > 0 || activePass) && (
              <hr className="border-rose-200/70 dark:border-slate-800" />
            )}

            {/* 2. Matching Urgent Blood Requests & Committed Pass */}
            {(matchingEmergencies.length > 0 || activePass) && (
              <div className="space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-pulse"></span>
                    <h3 className="font-bold text-slate-900 dark:text-white text-base">
                      Active Emergencies Matching Your Blood Type
                    </h3>
                  </div>
                  {matchingEmergencies.length > 0 && (
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 px-2.5 py-1 rounded-full border border-rose-200 dark:border-rose-900/40">
                        {matchingEmergencies.length} Urgent Requisition{matchingEmergencies.length > 1 ? 's' : ''}
                      </span>
                      {matchingEmergencies.length > (activePass ? 3 : 4) && (
                        <Link
                          href="/blood/emergencies"
                          className="text-xs font-bold text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 inline-flex items-center gap-1"
                        >
                          View All ({matchingEmergencies.length}) →
                        </Link>
                      )}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Committed Pass Card rendered directly in the grid */}
                  {activePass && (
                    <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-50 via-white to-teal-50/50 dark:from-emerald-950/40 dark:via-slate-900 dark:to-teal-950/30 border-2 border-emerald-500/80 dark:border-emerald-500/70 shadow-sm flex flex-col justify-between relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-28 h-28 bg-emerald-500/10 rounded-full blur-xl pointer-events-none"></div>
                      <div>
                        {/* Top Header Badge */}
                        <div className="flex items-center justify-between mb-3">
                          <span className="px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 font-bold text-xs border border-emerald-200 dark:border-emerald-800">
                            {activePass.meta?.bloodGroup} • {activePass.meta?.component?.replace(/_/g, ' ') || 'Whole Blood'}
                          </span>
                          <span className="text-[10px] font-extrabold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/90 px-2 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-800 uppercase tracking-wide flex items-center gap-1.5 shadow-2xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                            Committed Pass
                          </span>
                        </div>

                        <div className="flex items-start gap-2">
                          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                          <div>
                            <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                              {activePass.meta?.destinationHospital}
                            </h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              {activePass.meta?.destinationAddress || activePass.meta?.destinationCity || 'Phlebotomy Department'}
                            </p>
                          </div>
                        </div>

                        <div className="mt-3 p-2.5 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-900/60 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-emerald-800 dark:text-emerald-300 font-medium">Digital Token:</span>
                            <span className="font-mono font-bold text-emerald-900 dark:text-emerald-200">
                              #PASS-BR{activePass.meta?.requestId}
                            </span>
                          </div>
                          <div className="flex items-center justify-between mt-1 text-[11px] text-emerald-700/90 dark:text-emerald-300/90">
                            <span>Requested:</span>
                            <span>{activePass.meta?.unitsRequested || 1} Unit(s) • En Route</span>
                          </div>
                        </div>
                      </div>

                      {/* Footer Actions */}
                      <div className="mt-4 pt-3 border-t border-emerald-200/60 dark:border-emerald-900/60 flex items-center justify-between gap-2 flex-wrap">
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                            `${activePass.meta?.destinationHospital || ''}, ${activePass.meta?.destinationAddress || ''}, ${
                              activePass.meta?.destinationCity || ''
                            }`.trim()
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 hover:text-emerald-900 dark:hover:text-emerald-100 transition-colors"
                        >
                          <Navigation className="w-3.5 h-3.5 fill-current" />
                          Navigate
                          <ExternalLink className="w-3 h-3 opacity-70" />
                        </a>
                        <Link
                          href={`/blood/donate/${activePass.meta?.requestId}`}
                          className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800 dark:text-emerald-300 hover:text-emerald-950 dark:hover:text-white"
                        >
                          View Pass Details →
                        </Link>
                      </div>
                    </div>
                  )}

                  {/* Open Matching Emergencies */}
                  {(activePass ? sortedEmergencies.slice(0, 3) : topFourEmergencies).map((alert: any) => (
                    <div
                      key={alert.id}
                      className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/60 shadow-xs hover:border-rose-300 dark:hover:border-rose-700 transition-all flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <span className="px-2.5 py-1 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 font-bold text-xs">
                            {alert.meta?.bloodGroup} • {alert.meta?.component?.replace(/_/g, ' ') || 'Whole Blood'}
                          </span>
                          <span className="text-[11px] font-bold text-red-600 uppercase tracking-wide flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-ping"></span>
                            {alert.priority}
                          </span>
                        </div>

                        <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                          {alert.meta?.destinationHospital}
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          {alert.meta?.destinationAddress || alert.meta?.destinationCity || 'Emergency Phlebotomy Ward'}
                        </p>
                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 font-medium">
                          Need: {alert.meta?.unitsRequested || 1} Unit(s) • Can you walk in?
                        </p>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                        <span className="text-[11px] text-slate-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <Link
                          href={`/blood/donate/${alert.meta?.requestId}`}
                          className="inline-flex items-center gap-1 text-xs font-bold text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300"
                        >
                          Review & Walk-In to Donate →
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Show All Emergencies button only if there are matching emergencies */}
                {matchingEmergencies.length > 0 && (
                  <div className="pt-2 flex justify-center">
                    <Link
                      href="/blood/emergencies"
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white dark:bg-slate-900 hover:bg-rose-50 dark:hover:bg-slate-800 text-rose-600 dark:text-rose-400 font-bold text-xs border border-rose-200 dark:border-rose-900/60 shadow-xs hover:shadow-sm transition-all"
                    >
                      Show All Emergencies ({matchingEmergencies.length})
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                )}
              </div>
            )}

            {/* Divider between Emergencies and Recent Donations */}
            {(activeAndCommittedRequests.length > 0 || activePass || matchingEmergencies.length > 0) && recentDonations.length > 0 && (
              <hr className="border-rose-200/70 dark:border-slate-800" />
            )}

            {/* 3. 2 Most Recent Donations with "Show Full History" Button (Only shown if at least 1 entry exists) */}
            {recentDonations.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">
                    My Recent Donations
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {recentDonations.map((item: any) => (
                    <div
                      key={item.id}
                      className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <span
                            className={`px-2.5 py-1 rounded-full font-bold text-xs border ${
                              item.status === 'DONOR_COMMITTED'
                                ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900/50'
                                : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-100 dark:border-emerald-900/50'
                            }`}
                          >
                            {item.type === 'BLOOD' ? (
                              `${item.bloodGroup} • ${item.component?.replace(/_/g, ' ') || 'Whole Blood'}`
                            ) : (
                              `Donated Organ: ${item.organName || 'Organ'}`
                            )}
                          </span>

                          {item.type === 'BLOOD' ? (
                            item.status === 'DONOR_COMMITTED' ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/80 px-2.5 py-0.5 rounded-full border border-amber-300 dark:border-amber-800 shadow-2xs">
                                <Truck className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                                En Route
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                                <CheckCircle2 className="w-3 h-3" />
                                Transfused
                              </span>
                            )
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                              <CheckCircle2 className="w-3 h-3" />
                              Allocated
                            </span>
                          )}
                        </div>

                        <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                          {item.hospitalName || 'Verified Medical Hub'}
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          {item.hospitalCity || 'Regional Center'}
                        </p>
                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 font-medium">
                          {item.type === 'BLOOD' ? (
                            `Donation Volume: ${item.units || 1} Unit(s)`
                          ) : (
                            `Donated Organ: ${item.organName || 'Organ'}`
                          )}
                        </p>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(item.timestamp).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                        </span>
                        <span
                          className={`font-semibold ${
                            item.status === 'DONOR_COMMITTED'
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          {item.status === 'DONOR_COMMITTED' ? 'Committed — En Route' : 'Verified Phlebotomy'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-2 flex justify-center">
                  <Link
                    href="/citizen/history?from=home&type=blood"
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold text-xs border border-slate-200 dark:border-slate-800 shadow-xs hover:shadow-sm transition-all"
                  >
                    <BookOpen className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    Show Full History
                    <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
                  </Link>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Blood Donation Camps & Community Drives Section */}
      <section className="py-12 bg-slate-50/70 dark:bg-slate-900/40 border-b border-slate-200/80 dark:border-slate-800/80 transition-colors">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60 mb-2">
                <Calendar className="w-3.5 h-3.5 text-rose-600" />
                Community Outreach
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Upcoming Blood Donation Camps
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                Participate in voluntary blood donation drives organized by verified hospitals and medical centers near you.
              </p>
            </div>

            {/* Action buttons: Explore All Camps & hub management */}
            <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
              <Link
                href="/camps"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 text-xs font-bold border border-rose-200 dark:border-rose-900/60 shadow-xs hover:bg-rose-50 dark:hover:bg-slate-800 transition-all"
              >
                Explore All Camps
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>

              {['HOSPITAL', 'ADMIN'].includes(user?.role || '') && (
                <Link
                  href="/hospital/camps"
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-xs transition-all shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Schedule Camp
                </Link>
              )}
            </div>
          </div>

          {campsLoading ? (
            <div className="py-12 flex justify-center items-center text-slate-400 text-xs gap-2">
              <span className="w-4 h-4 border-2 border-rose-500 border-t-transparent rounded-full animate-spin"></span>
              Loading scheduled camps...
            </div>
          ) : camps.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                No active blood donation camps scheduled at this moment. Check back soon or visit a registered medical hub!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {camps.slice(0, 3).map((camp) => (
                <div
                  key={camp.id}
                  onClick={() => setSelectedCamp(camp)}
                  className="group bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-rose-300 dark:hover:border-rose-800/80 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between overflow-hidden cursor-pointer"
                >
                  <div className="p-5">
                    {/* Header tags: Status & Target */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                          camp.status === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                            : 'bg-rose-50 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300 border-rose-200 dark:border-rose-900/60'
                        }`}
                      >
                        {camp.status === 'ACTIVE' ? (
                          <>
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            Active Now
                          </>
                        ) : (
                          <>
                            <Calendar className="w-3 h-3" />
                            Upcoming Drive
                          </>
                        )}
                      </span>

                      {camp.target_units && (
                        <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                          <Users className="w-3 h-3 text-rose-500" />
                          Target: {camp.target_units}
                        </span>
                      )}
                    </div>

                    {/* Camp Title */}
                    <h3 className="font-bold text-slate-900 dark:text-white text-base group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors line-clamp-1">
                      {camp.camp_name}
                    </h3>

                    {/* Associated Hub */}
                    <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 mt-1 flex items-center gap-1 line-clamp-1">
                      <Building2 className="w-3.5 h-3.5 shrink-0" />
                      {camp.organizer_hub_name || 'Associated Medical Hub'}
                    </p>

                    {/* Description snippet */}
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 line-clamp-2 leading-relaxed">
                      {camp.description || 'Voluntary blood donation camp organized for community life-support and emergency stock replenishment.'}
                    </p>

                    {/* Venue & Time metadata */}
                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {formatCampDateRange(camp.camp_date, camp.end_date)}
                        </span>
                        <span className="text-slate-400">•</span>
                        <span className="text-slate-500 dark:text-slate-400">{camp.start_time} - {camp.end_time}</span>
                      </div>

                      <div className="flex items-start gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                        <span className="line-clamp-1 text-slate-700 dark:text-slate-300 font-medium">
                          {camp.venue_name}, {camp.city}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card Action footer */}
                  <div className="px-5 py-3 bg-slate-50 dark:bg-slate-950/40 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                    <span className="font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                      View Details & Timings <ArrowRight className="w-3 h-3" />
                    </span>

                    <a
                      href={getCampNavigateUrl(camp)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                      title="Navigate via Google Maps"
                    >
                      <Navigation className="w-3.5 h-3.5 fill-current" />
                      Navigate
                      <ExternalLink className="w-3 h-3 opacity-70" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* CAMP DETAILS MODAL */}
      {selectedCamp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-8 animate-in fade-in zoom-in-95">
            {/* Header */}
            <div className="p-6 pb-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white line-clamp-1">
                    {selectedCamp.camp_name}
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        selectedCamp.status === 'ACTIVE'
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                          : 'bg-rose-50 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300 border-rose-200 dark:border-rose-900/60'
                      }`}
                    >
                      {selectedCamp.status === 'ACTIVE' ? 'Active Now' : 'Upcoming Camp'}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Camp #{selectedCamp.id}
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCamp(null)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 text-sm">
              {/* Description */}
              <div>
                <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">
                  About This Blood Donation Drive
                </h4>
                <p className="text-slate-700 dark:text-slate-200 text-xs sm:text-sm leading-relaxed bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800">
                  {selectedCamp.description || 'Community voluntary blood donation camp to support patients in critical emergency need.'}
                </p>
              </div>

              {/* Associated Hub */}
              <div className="p-3.5 rounded-xl bg-rose-50/50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/40">
                <div className="flex items-center gap-1.5 text-xs text-rose-700 dark:text-rose-400 font-bold mb-1">
                  <Building2 className="w-3.5 h-3.5" />
                  <span>Associated Organizer Medical Hub</span>
                </div>
                <p className="font-bold text-slate-900 dark:text-white text-sm">
                  {selectedCamp.organizer_hub_name || 'Verified Medical Hub'}
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  Type: <span className="font-semibold text-slate-800 dark:text-slate-200 capitalize">{selectedCamp.organizer_hub_type?.toLowerCase() || 'Hospital'}</span>
                  {selectedCamp.organizer_hub_city ? ` • ${selectedCamp.organizer_hub_city}` : ''}
                </p>
              </div>

              {/* Timings & Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mb-1">
                    <Calendar className="w-3.5 h-3.5 text-rose-500" />
                    <span>Camp Date / Schedule</span>
                  </div>
                  <p className="font-bold text-slate-900 dark:text-white text-xs">
                    {formatCampDateRange(selectedCamp.camp_date, selectedCamp.end_date)}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mb-1">
                    <Clock className="w-3.5 h-3.5 text-blue-500" />
                    <span>Camp Timings</span>
                  </div>
                  <p className="font-bold text-slate-900 dark:text-white text-xs">
                    {selectedCamp.start_time} - {selectedCamp.end_time}
                  </p>
                </div>
              </div>

              {/* Venue & Location Address */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <MapPin className="w-3.5 h-3.5 text-amber-500" />
                  <span>Venue & Location</span>
                </div>
                <p className="font-bold text-slate-900 dark:text-white text-xs">
                  {selectedCamp.venue_name}
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  {selectedCamp.address_line}, {selectedCamp.city}{selectedCamp.state ? `, ${selectedCamp.state}` : ''}{selectedCamp.pincode ? ` - ${selectedCamp.pincode}` : ''}
                </p>
              </div>

              {/* Contact phone & Target units */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mb-1">
                    <Phone className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Contact / Helpline</span>
                  </div>
                  <a
                    href={`tel:${selectedCamp.contact_phone}`}
                    className="font-bold text-rose-600 dark:text-rose-400 hover:underline text-xs flex items-center gap-1"
                  >
                    {selectedCamp.contact_phone}
                  </a>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mb-1">
                    <Users className="w-3.5 h-3.5 text-purple-500" />
                    <span>Target Volume</span>
                  </div>
                  <p className="font-bold text-slate-900 dark:text-white text-xs">
                    {selectedCamp.target_units || 'N/A'} Units
                  </p>
                </div>
              </div>

              {/* Action Buttons: Navigate Button */}
              <div className="pt-2 flex items-center justify-between gap-3">
                <a
                  href={getCampNavigateUrl(selectedCamp)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                >
                  <Navigation className="w-3.5 h-3.5 fill-current" />
                  Navigate via Google Maps
                  <ExternalLink className="w-3 h-3 opacity-70" />
                </a>

                <button
                  type="button"
                  onClick={() => setSelectedCamp(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Direct Pathways (Where do you want to go?) - Authenticated Users Only */}
      {user && (
        <section className="py-12 bg-white dark:bg-slate-950 transition-colors duration-200">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-xl mx-auto mb-10">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight transition-colors">
                {isHospitalStaff ? 'Hospital & Clinical Operations' : 'How Can We Help You Today?'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 transition-colors">
                {isHospitalStaff
                  ? 'Direct access to your clinical workflows, stock management, and organ matching systems.'
                  : 'Select an option below to go directly to what you need.'}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {isHospitalStaff ? (
                <>
                  {/* Hospital Card 1: Blood Stock Inventory */}
                  <Link
                    href="/hospital/inventory"
                    className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-red-300 dark:hover:border-red-500/60 hover:shadow-md transition-all flex flex-col justify-between group"
                  >
                    <div>
                      <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <BloodStockInventoryIcon className="w-5 h-5 text-red-600 dark:text-red-400" />
                      </div>
                      <h3 className="font-bold text-slate-900 dark:text-white text-base mb-1 transition-colors">Blood Stock Inventory</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed transition-colors">
                        Real-time inventory counts across all 8 blood groups and components with quick inward/outward supply logging.
                      </p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs font-semibold text-red-600 dark:text-red-400 flex items-center gap-1">
                      Manage Stock <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </Link>

                  {/* Hospital Card 2: Organ Requests & Waitlist */}
                  <Link
                    href="/hospital/requests"
                    className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-emerald-300 dark:hover:border-emerald-500/60 hover:shadow-md transition-all flex flex-col justify-between group"
                  >
                    <div>
                      <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <Clock className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <h3 className="font-bold text-slate-900 dark:text-white text-base mb-1 transition-colors">Organ Requests & Waitlist</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed transition-colors">
                        View prioritized recipient queues, enroll patient requisitions, and track multi-scenario match compatibility.
                      </p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      View Waitlist Queue <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </Link>

                  {/* Hospital Card 3: Organ Harvest Registry */}
                  <Link
                    href="/hospital/harvest"
                    className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-rose-300 dark:hover:border-rose-500/60 hover:shadow-md transition-all flex flex-col justify-between group"
                  >
                    <div>
                      <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <OrganHarvestRegistryIcon className="w-6 h-6" />
                      </div>
                      <h3 className="font-bold text-slate-900 dark:text-white text-base mb-1 transition-colors">Organ Harvest Registry</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed transition-colors">
                        Register retrieved donor organs (Kidneys, Liver, Heart, Corneas, Lungs) with cold ischemia time monitoring.
                      </p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1">
                      Open Harvest Registry <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </Link>

                  {/* Hospital Card 3: Clinical Match Engine */}
                  <Link
                    href="/hospital/matches"
                    className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-indigo-300 dark:hover:border-indigo-500/60 hover:shadow-md transition-all flex flex-col justify-between group"
                  >
                    <div>
                      <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <MatchEngineIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                      </div>
                      <h3 className="font-bold text-slate-900 dark:text-white text-base mb-1 transition-colors">Transplant Match Engine</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed transition-colors">
                        Execute automated clinical algorithms to score and match harvested organs with eligible waitlist candidates.
                      </p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                      View Matches <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </Link>

                  {/* Hospital Card 4: Blood Donation Camps */}
                  <Link
                    href="/camps"
                    className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-purple-300 dark:hover:border-purple-500/60 hover:shadow-md transition-all flex flex-col justify-between group"
                  >
                    <div>
                      <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <Calendar className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                      </div>
                      <h3 className="font-bold text-slate-900 dark:text-white text-base mb-1 transition-colors">Blood Donation Camps</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed transition-colors">
                        Schedule and broadcast community donation drives, manage venue GPS navigation, and track donation volumes.
                      </p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs font-semibold text-purple-600 dark:text-purple-400 flex items-center gap-1">
                      Manage Camps <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </Link>

                  {/* Hospital Card 5: Regional Blood Search */}
                  <Link
                    href="/blood-finder"
                    className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-red-300 dark:hover:border-red-500/60 hover:shadow-md transition-all flex flex-col justify-between group"
                  >
                    <div>
                      <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <FindBloodIcon className="w-5 h-5 text-red-600 dark:text-red-400" />
                      </div>
                      <h3 className="font-bold text-slate-900 dark:text-white text-base mb-1 transition-colors">Find Blood Stock</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed transition-colors">
                        Search blood and component availability across all partner hospital blood storage units in your city.
                      </p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs font-semibold text-red-600 dark:text-red-400 flex items-center gap-1">
                      Search Units <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </Link>

                  {/* Hospital Card 6: Partner Centers Directory */}
                  <Link
                    href="/directory"
                    className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-300 dark:hover:border-blue-500/60 hover:shadow-md transition-all flex flex-col justify-between group"
                  >
                    <div>
                      <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <Hospital className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <h3 className="font-bold text-slate-900 dark:text-white text-base mb-1 transition-colors">Partner Centers</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed transition-colors">
                        Browse participating accredited hospitals and transplant medical centers across the platform.
                      </p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                      Explore Centers <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </Link>
                </>
              ) : (
                <>
                  {/* Card 1: Pledge Organs */}
                  <Link
                    href="/donor/pledge"
                    className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-amber-300 dark:hover:border-amber-500/60 hover:shadow-md transition-all flex flex-col justify-between group"
                  >
                    <div>
                      <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <Award className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                      </div>
                      <h3 className="font-bold text-slate-900 dark:text-white text-base mb-1 transition-colors">Pledge Organs</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed transition-colors">
                        Choose which organs and tissues you wish to pledge and join the voluntary organ donor registry.
                      </p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      Pledge Now <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </Link>

                  {/* Card 2: Digital Donor Card */}
                  <Link
                    href="/donor/card"
                    className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-amber-300 dark:hover:border-amber-500/60 hover:shadow-md transition-all flex flex-col justify-between group"
                  >
                    <div>
                      <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <CreditCard className="w-5 h-5" />
                      </div>
                      <h3 className="font-bold text-slate-900 dark:text-white text-base mb-1 transition-colors">Digital Donor Card</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed transition-colors">
                        Access your official Digital Organ Donor Card with personal verification QR code. Print or save to share with family.
                      </p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      View My Card <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </Link>

                  {/* Card 3: Find Blood */}
                  <Link
                    href="/blood-finder"
                    className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-red-300 dark:hover:border-red-500/60 hover:shadow-md transition-all flex flex-col justify-between group"
                  >
                    <div>
                      <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <FindBloodIcon className="w-5 h-5 text-red-600 dark:text-red-400" />
                      </div>
                      <h3 className="font-bold text-slate-900 dark:text-white text-base mb-1 transition-colors">Find Blood Stock</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed transition-colors">
                        Look up available blood and platelet units at authorized hospital blood storage units in your city.
                      </p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs font-semibold text-red-600 dark:text-red-400 flex items-center gap-1">
                      Search Units <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </Link>

                  {/* Card 4: Donation History Ledger */}
                  <Link
                    href="/citizen/history"
                    className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-teal-300 dark:hover:border-teal-500/60 hover:shadow-md transition-all flex flex-col justify-between group"
                  >
                    <div>
                      <div className="w-10 h-10 rounded-xl bg-teal-100 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <BookOpen className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                      </div>
                      <h3 className="font-bold text-slate-900 dark:text-white text-base mb-1 transition-colors">Donation Ledger</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed transition-colors">
                        Review complete verified records of your blood donations, emergency orders, and organ transactions with clinical audit logs.
                      </p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs font-semibold text-teal-600 dark:text-teal-400 flex items-center gap-1">
                      Open Ledger <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </Link>

                  {/* Card 5: Patient Waitlist */}
                  <Link
                    href="/transplant/waitlist-status"
                    className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-emerald-300 dark:hover:border-emerald-500/60 hover:shadow-md transition-all flex flex-col justify-between group"
                  >
                    <div>
                      <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <Clock className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <h3 className="font-bold text-slate-900 dark:text-white text-base mb-1 transition-colors">Waitlist Status</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed transition-colors">
                        Are you a transplant candidate? Check your registration status and see when hospital match reviews begin.
                      </p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      View Waitlist Status <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </Link>

                  {/* Card 6: Hospitals */}
                  <Link
                    href="/directory"
                    className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-300 dark:hover:border-blue-500/60 hover:shadow-md transition-all flex flex-col justify-between group"
                  >
                    <div>
                      <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <Hospital className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <h3 className="font-bold text-slate-900 dark:text-white text-base mb-1 transition-colors">Partner Centers</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed transition-colors">
                        Browse participating accredited hospitals and transplant medical centers across the platform.
                      </p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                      Explore Centers <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </Link>
                </>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Simple Information / FAQ - Authenticated Users Only */}
      {user && (
        <section className="py-16 bg-slate-50/80 dark:bg-slate-900/60 border-t border-slate-100 dark:border-slate-800/80 transition-colors duration-200">
          <div className="max-w-4xl mx-auto px-4 sm:px-6">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white text-center mb-8 transition-colors">
              What You Need to Know
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs transition-colors">
                <h4 className="font-bold text-slate-900 dark:text-white text-sm mb-1.5 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  Who Can Pledge as a Donor?
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Any citizen aged 18 or above can register their pledge. Medical suitability is evaluated by physicians at the time of donation.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs transition-colors">
                <h4 className="font-bold text-slate-900 dark:text-white text-sm mb-1.5 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  Is Organ Donation Voluntary?
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Yes. Organ donation is purely voluntary and non-commercial. Buying, selling, or trafficking organs is strictly prohibited.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs transition-colors">
                <h4 className="font-bold text-slate-900 dark:text-white text-sm mb-1.5 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  Why Inform Your Family?
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Family awareness and consent is essential at the time of donation. Sharing your Digital Donor Card ensures your loved ones understand and honor your decision.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs transition-colors">
                <h4 className="font-bold text-slate-900 dark:text-white text-sm mb-1.5 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  Hospital & Clinical Access
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Participating hospitals and medical centers can register their facility to coordinate available units and emergency requests.
                </p>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
