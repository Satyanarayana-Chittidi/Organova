'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useAdminSession } from './AdminSessionContext';
import { adminApi } from '@/lib/api';
import OrganImage from '@/components/OrganImage';
import { ShieldCheck, ShieldAlert, Building2, Heart, Droplet, Users, CheckCircle2, XCircle, AlertTriangle, RefreshCw, Search, ArrowRight, MapPin, Phone, Mail, Lock, Zap, Activity, Award, Clock, ExternalLink, ChevronRight, ChevronDown, ChevronUp, FileText, X, Navigation, } from 'lucide-react';
function LogDetailsGrid({ meta }: {
    meta: any;
}) {
    const parsedMeta = typeof meta === 'string' ? (() => { try {
        return JSON.parse(meta);
    }
    catch {
        return {};
    } })() : (meta || {});
    const fieldLabels: Record<string, string> = {
        organName: 'Organ Specimen',
        bloodGroup: 'Blood Group',
        harvestingHospital: 'Harvesting Facility',
        hospitalCity: 'Harvest Location',
        candidateName: 'Recipient Candidate',
        candidatePhone: 'Candidate Contact',
        compatibilityScore: 'Compatibility Score',
        attendingHospital: 'Attending Facility',
        attendingCity: 'Attending Location',
        facilityName: 'Medical Facility',
        facilityType: 'Facility Classification',
        licenseNumber: 'Accreditation License',
        contactPhone: 'Facility Phone',
        city: 'City',
        state: 'State',
        orderId: 'Order Number',
        component: 'Blood Component',
        unitsRequested: 'Requested Quantity',
        urgencyTier: 'Urgency Tier',
        receivingHospital: 'Receiving Facility',
        receivingCity: 'Receiving City',
        fulfillingHospital: 'Fulfilling Facility',
        patientName: 'Patient Name',
        requesterContact: 'Requester Phone',
        status: 'Operational Status',
        expiresAt: 'Viability Expiration',
        offeredAt: 'Offer Dispatched',
        auditDate: 'Audit Timestamp',
        orderDate: 'Order Placed',
    };
    const entries = Object.entries(parsedMeta).filter(([k, v]) => v !== null && v !== undefined && v !== '');
    if (entries.length === 0) {
        return <p className="text-xs text-slate-400 py-1">No additional parameters logged.</p>;
    }
    return (<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 pt-3 border-t border-slate-200/60 dark:border-slate-800 text-xs">
      {entries.map(([key, val]) => (<div key={key} className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
            {fieldLabels[key] || key.replace(/([A-Z])/g, ' $1').trim()}
          </span>
          <span className="font-semibold text-slate-800 dark:text-slate-200 text-xs mt-0.5 flex items-center gap-1.5 truncate" title={String(val)}>
            {(key === 'organName' || key === 'organCode') && (<OrganImage organ={String(val)} size="xs" showContainer={false}/>)}
            <span className="truncate">{String(val)}</span>
          </span>
        </div>))}
    </div>);
}
export default function MasterControlPage() {
    const router = useRouter();
    const { user } = useAuth();
    const { isAdminUnlocked, adminUser, lockTerminal } = useAdminSession();
    const [metrics, setMetrics] = useState<any>(null);
    const [pendingHubs, setPendingHubs] = useState<any[]>([]);
    const [recentLogs, setRecentLogs] = useState<any[]>([]);
    const [dataLoading, setDataLoading] = useState(true);
    const [auditLoadingId, setAuditLoadingId] = useState<number | null>(null);
    const [actionMsg, setActionMsg] = useState<{
        type: 'success' | 'error';
        text: string;
    } | null>(null);
    const [selectedPendingHub, setSelectedPendingHub] = useState<any | null>(null);
    const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<{
        citizens: any[];
        hubs: any[];
    } | null>(null);
    const [searching, setSearching] = useState(false);
    useEffect(() => {
        if (isAdminUnlocked) {
            const handleFocusCheck = () => {
                const params = new URLSearchParams(window.location.search);
                if (params.get('focus') === 'search' || window.location.hash === '#registry-explorer') {
                    setTimeout(() => {
                        const el = document.getElementById('registry-explorer');
                        if (el)
                            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        const input = document.getElementById('master-control-search-input') as HTMLInputElement | null;
                        if (input)
                            input.focus();
                    }, 150);
                }
            };
            handleFocusCheck();
            window.addEventListener('hashchange', handleFocusCheck);
            return () => window.removeEventListener('hashchange', handleFocusCheck);
        }
    }, [isAdminUnlocked]);
    useEffect(() => {
        if (isAdminUnlocked) {
            loadDashboardData();
        }
    }, [isAdminUnlocked]);
    const loadDashboardData = async () => {
        setDataLoading(true);
        setActionMsg(null);
        try {
            const [metricsRes, pendingRes, logsRes] = await Promise.all([
                adminApi.getMetrics(),
                adminApi.getPendingHubs(),
                adminApi.getLogs(6),
            ]);
            if (metricsRes.success)
                setMetrics(metricsRes.data);
            if (pendingRes.success)
                setPendingHubs(Array.isArray(pendingRes.data) ? pendingRes.data : []);
            if (logsRes.success)
                setRecentLogs(Array.isArray(logsRes.data) ? logsRes.data : []);
        }
        catch (err: any) {
            console.error('Failed to load admin dashboard data', err);
        }
        finally {
            setDataLoading(false);
        }
    };
    const handleLockTerminal = () => {
        lockTerminal();
    };
    const handleAuditDecision = async (hubId: number, status: 'ACTIVE' | 'REJECTED' | 'SUSPENDED') => {
        setAuditLoadingId(hubId);
        setActionMsg(null);
        try {
            const res = await adminApi.verifyHub(hubId, status);
            if (res.success) {
                setActionMsg({
                    type: 'success',
                    text: `Facility #${hubId} successfully marked as ${status}.`,
                });
                await loadDashboardData();
            }
            else {
                setActionMsg({ type: 'error', text: res.message || 'Audit action failed.' });
            }
        }
        catch (err: any) {
            setActionMsg({ type: 'error', text: err.message || 'Audit action failed.' });
        }
        finally {
            setAuditLoadingId(null);
        }
    };
    const handleSearchEntities = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchQuery.trim()) {
            setSearchResults(null);
            return;
        }
        setSearching(true);
        try {
            const res = await adminApi.searchEntities(searchQuery.trim());
            if (res.success) {
                setSearchResults(res.data);
            }
        }
        catch (err: any) {
            console.error('Search error:', err);
        }
        finally {
            setSearching(false);
        }
    };
    if (!isAdminUnlocked) {
        return null;
    }
    return (<div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors py-8 px-4 sm:px-6 lg:px-8 space-y-8">

      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-rose-600 to-red-600 text-white flex items-center justify-center shadow-md shadow-rose-600/20 shrink-0">
            <ShieldCheck className="w-6 h-6"/>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Organova Master Control
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                Live Console
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Logged in as <strong className="text-slate-700 dark:text-slate-300">{user?.email}</strong> • Administrative clearance active
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button type="button" onClick={loadDashboardData} disabled={dataLoading} className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer">
            <RefreshCw className={`w-3.5 h-3.5 ${dataLoading ? 'animate-spin' : ''}`}/>
            <span>Refresh Metrics</span>
          </button>

          <Link href="/master-control/hubs" className="px-3.5 py-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-900/60 text-blue-700 dark:text-blue-300 text-xs font-semibold flex items-center gap-1.5 hover:bg-blue-100 transition-colors">
            <Building2 className="w-3.5 h-3.5"/>
            <span>Medical Hubs</span>
          </Link>

          <Link href="/master-control/logs" className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center gap-1.5 hover:bg-slate-200 transition-colors">
            <FileText className="w-3.5 h-3.5"/>
            <span>System Logs</span>
          </Link>

          <button type="button" onClick={handleLockTerminal} className="px-3.5 py-2 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 hover:bg-red-100 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer">
            <Lock className="w-3.5 h-3.5"/>
            <span>Lock Terminal</span>
          </button>
        </div>
      </div>

      {actionMsg && (<div className="max-w-7xl mx-auto">
          <div className={`p-4 rounded-2xl text-xs flex items-center gap-2 ${actionMsg.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                : 'bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300'}`}>
            {actionMsg.type === 'success' ? (<CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600"/>) : (<AlertTriangle className="w-4 h-4 shrink-0 text-red-600"/>)}
            <span className="font-medium">{actionMsg.text}</span>
          </div>
        </div>)}

      <div className="max-w-7xl mx-auto space-y-10">

        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-7 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900/60 mb-1">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600"/>
                Priority Audit Desk
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Facility Verification & Onboarding
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Review and approve newly submitted hospital and blood bank registration dossiers.
              </p>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 self-start sm:self-auto">
              {pendingHubs.length} Pending Review
            </span>
          </div>

          {pendingHubs.length === 0 ? (<div className="py-10 text-center rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-800">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2"/>
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                All facilities verified
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                There are no pending institutional onboarding applications at this moment.
              </p>
            </div>) : (<div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {pendingHubs.map((hub) => (<div key={hub.id} onClick={() => setSelectedPendingHub(hub)} className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/60 hover:border-indigo-400 dark:hover:border-indigo-600 hover:shadow-md space-y-4 flex flex-col justify-between transition-all cursor-pointer group">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                          {hub.hub_type.replace(/_/g, ' ')}
                        </span>
                        <h3 className="font-bold text-base text-slate-900 dark:text-white mt-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                          {hub.name}
                        </h3>
                        <p className="text-xs font-mono text-slate-500 dark:text-slate-400">
                          License: <strong className="text-slate-800 dark:text-slate-200">{hub.license_number}</strong>
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900/50 shrink-0">
                          Pending Review
                        </span>
                        <span className="p-1 rounded-lg text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                          <ExternalLink className="w-3.5 h-3.5"/>
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300 pt-1">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0"/>
                          <span className="break-words">{hub.city}, {hub.state || 'IN'}</span>
                        </div>
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0"/>
                          <span className="break-all">{hub.contact_phone}</span>
                        </div>
                      </div>
                      <div className="flex items-start gap-1.5 min-w-0">
                        <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5"/>
                        <span className="break-all font-medium text-slate-800 dark:text-slate-200">{hub.email}</span>
                      </div>
                    </div>

                    <div className="text-[11px] text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80 space-y-1">
                      <div><strong>Address:</strong> <span className="break-words">{hub.address_line}, {hub.city}, {hub.state} - {hub.pincode}</span></div>
                      <div className="text-[10px] font-mono text-slate-400">GPS: ({Number(hub.latitude).toFixed(4)}, {Number(hub.longitude).toFixed(4)})</div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 group-hover:underline">
                      <span>Click to view full dossier</span>
                      <ArrowRight className="w-3 h-3"/>
                    </span>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={(e) => {
                    e.stopPropagation();
                    handleAuditDecision(hub.id, 'REJECTED');
                }} disabled={auditLoadingId === hub.id} className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 text-red-600 hover:bg-red-50 text-xs font-semibold border border-red-200 dark:border-red-900/60 transition-colors cursor-pointer">
                        Reject
                      </button>
                      <button type="button" onClick={(e) => {
                    e.stopPropagation();
                    handleAuditDecision(hub.id, 'ACTIVE');
                }} disabled={auditLoadingId === hub.id} className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer">
                        <CheckCircle2 className="w-3.5 h-3.5"/>
                        <span>{auditLoadingId === hub.id ? 'Processing...' : 'Approve & Activate'}</span>
                      </button>
                    </div>
                  </div>
                </div>))}
            </div>)}

          {selectedPendingHub && (<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150" onClick={() => setSelectedPendingHub(null)}>
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl space-y-6 relative max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>

                <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                        {selectedPendingHub.hub_type?.replace(/_/g, ' ')}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900/50">
                        Pending Admin Review
                      </span>
                    </div>
                    <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                      {selectedPendingHub.name}
                    </h3>
                    <p className="text-xs font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                      Institutional License: <strong className="text-slate-800 dark:text-slate-200">{selectedPendingHub.license_number}</strong>
                    </p>
                  </div>

                  <button type="button" onClick={() => setSelectedPendingHub(null)} className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer">
                    <X className="w-5 h-5"/>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/70 space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                      Contact Phone
                    </span>
                    <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-slate-400"/>
                      <span>{selectedPendingHub.contact_phone || 'N/A'}</span>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/70 space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                      Official Facility Email
                    </span>
                    <div className="font-semibold text-slate-900 dark:text-white flex items-start gap-2 min-w-0">
                      <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5"/>
                      <span className="break-all">{selectedPendingHub.email || 'N/A'}</span>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/70 space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                      City & State
                    </span>
                    <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-slate-400"/>
                      <span>{selectedPendingHub.city}, {selectedPendingHub.state || 'IN'}</span>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/70 space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                      Postal Pincode
                    </span>
                    <div className="font-semibold text-slate-900 dark:text-white">
                      {selectedPendingHub.pincode || 'N/A'}
                    </div>
                  </div>

                  <div className="sm:col-span-2 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/70 space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                      Complete Physical Address
                    </span>
                    <p className="font-medium text-slate-800 dark:text-slate-200 leading-relaxed">
                      {selectedPendingHub.address_line}, {selectedPendingHub.city}, {selectedPendingHub.state} - {selectedPendingHub.pincode}
                    </p>
                  </div>

                  <div className="sm:col-span-2 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                        GPS Coordinates
                      </span>
                      <p className="font-mono text-slate-800 dark:text-slate-200 text-xs mt-0.5">
                        Latitude: {selectedPendingHub.latitude} • Longitude: {selectedPendingHub.longitude}
                      </p>
                    </div>
                    {selectedPendingHub.latitude && selectedPendingHub.longitude && (<a href={`https://www.google.com/maps?q=${selectedPendingHub.latitude},${selectedPendingHub.longitude}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-blue-600 dark:text-blue-400 hover:text-blue-700 text-xs font-semibold shrink-0">
                        <Navigation className="w-3.5 h-3.5"/>
                        <span>Open in Google Maps</span>
                        <ExternalLink className="w-3 h-3 ml-0.5"/>
                      </a>)}
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3 flex-wrap">
                  <button type="button" onClick={() => setSelectedPendingHub(null)} className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 text-xs font-semibold transition-colors cursor-pointer">
                    Cancel
                  </button>

                  <button type="button" onClick={async () => {
                const hid = selectedPendingHub.id;
                setSelectedPendingHub(null);
                await handleAuditDecision(hid, 'REJECTED');
            }} disabled={auditLoadingId === selectedPendingHub.id} className="px-4 py-2.5 rounded-xl bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/60 border border-red-200 dark:border-red-800 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5">
                    <XCircle className="w-4 h-4"/>
                    <span>Reject Facility</span>
                  </button>

                  <button type="button" onClick={async () => {
                const hid = selectedPendingHub.id;
                setSelectedPendingHub(null);
                await handleAuditDecision(hid, 'ACTIVE');
            }} disabled={auditLoadingId === selectedPendingHub.id} className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all cursor-pointer flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4"/>
                    <span>Approve & Activate Facility</span>
                  </button>
                </div>
              </div>
            </div>)}
        </section>

        <section id="registry-explorer" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-7 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900/60 mb-1">
                <Users className="w-3.5 h-3.5 text-indigo-600"/>
                Unified Platform Directory
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Registry & Entity Explorer
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Instant unified search across all registered citizens, active donor pledges, and medical facilities.
              </p>
            </div>
          </div>

          <form onSubmit={handleSearchEntities} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5"/>
              <input id="master-control-search-input" type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search by citizen name, email, phone, facility name, or license number..." className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800/60 placeholder:text-slate-400 dark:placeholder:text-slate-500 font-medium focus:outline-hidden focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"/>
            </div>
            <button type="submit" disabled={searching} className="px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer shrink-0">
              {searching ? (<>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  <span>Searching...</span>
                </>) : (<>
                  <Search className="w-3.5 h-3.5"/>
                  <span>Search Registry</span>
                </>)}
            </button>
          </form>

          {searchResults && (<div className="space-y-4 pt-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-900 dark:text-white">
                    <span className="flex items-center gap-1.5">
                      <Heart className="w-3.5 h-3.5 text-rose-500"/>
                      Matching Citizens ({searchResults.citizens.length})
                    </span>
                  </div>

                  {searchResults.citizens.length === 0 ? (<p className="text-xs text-slate-400 py-3 text-center">No matching citizen profiles found.</p>) : (<div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                      {searchResults.citizens.map((c) => (<div key={c.id} className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs flex items-center justify-between gap-2">
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                              <span>{c.full_name}</span>
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                                {c.blood_group}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              {c.email} • {c.phone_number} • {c.city}
                            </p>
                          </div>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shrink-0">
                            {c.active_pledges} Pledges
                          </span>
                        </div>))}
                    </div>)}
                </div>

                <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-900 dark:text-white">
                    <span className="flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-blue-500"/>
                      Matching Facilities ({searchResults.hubs.length})
                    </span>
                  </div>

                  {searchResults.hubs.length === 0 ? (<p className="text-xs text-slate-400 py-3 text-center">No matching facilities found.</p>) : (<div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                      {searchResults.hubs.map((h) => (<div key={h.id} className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs flex items-center justify-between gap-2">
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                              <span>{h.name}</span>
                              <span className="text-[10px] font-bold uppercase text-slate-400">
                                ({h.hub_type.replace(/_/g, ' ')})
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              Lic: {h.license_number} • {h.city} • {h.contact_phone}
                            </p>
                          </div>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${h.verification_status === 'ACTIVE'
                        ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                        : 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300'}`}>
                            {h.verification_status}
                          </span>
                        </div>))}
                    </div>)}
                </div>
              </div>
            </div>)}
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-rose-600"/>
              Platform Pulse & Macro Matrix
            </h2>
            <span className="text-xs text-slate-400">Platform-wide real-time metrics</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-5">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-2xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                    <Building2 className="w-5 h-5"/>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-md border border-blue-200 dark:border-blue-900">
                    Network Capacity
                  </span>
                </div>

                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Active Medical Hubs
                </p>
                <div className="text-3xl font-black text-slate-900 dark:text-white mt-1">
                  {dataLoading ? '...' : metrics?.activeHubsCount || 0}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                  Verified operational transplant hospitals, recovery units, and regional blood banks connected to the grid.
                </p>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                <Link href="/master-control/hubs" className="inline-flex items-center justify-between w-full text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 group">
                  <span>Explore Medical Hubs</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform"/>
                </Link>
              </div>
            </div>

            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-5">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-2xl bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400 flex items-center justify-center">
                    <Droplet className="w-5 h-5"/>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-red-50 dark:bg-red-950/80 text-red-700 dark:text-red-300 px-2 py-0.5 rounded-md border border-red-200 dark:border-red-900">
                    Blood Inventory
                  </span>
                </div>

                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Current Units Available
                </p>
                <div className="text-3xl font-black text-slate-900 dark:text-white mt-1">
                  {dataLoading ? '...' : (metrics?.blood?.availableUnits || 0).toLocaleString()} <span className="text-xs font-medium text-slate-400">Units</span>
                </div>

                <div className="mt-4 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800/80 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Transfused to Patients:</span>
                    <strong className="text-slate-900 dark:text-white">
                      {(metrics?.blood?.transfusedUnits || 0).toLocaleString()} Units
                    </strong>
                  </div>
                  <div className="flex items-center justify-between border-t border-slate-200/60 dark:border-slate-700/60 pt-1.5 text-[11px]">
                    <span className="text-slate-500 dark:text-slate-400">Community Donor Impact:</span>
                    <strong className="text-emerald-600 dark:text-emerald-400">
                      {metrics?.blood?.donatedUnits || 0} Units by {metrics?.blood?.donorCount || 0} Donors
                    </strong>
                  </div>
                </div>
              </div>

              <div className="pt-2 text-[11px] text-slate-400">
                Aggregated inventory across all partner blood storage hubs.
              </div>
            </div>

            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-5">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-2xl bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                    <Heart className="w-5 h-5"/>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-rose-50 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 px-2 py-0.5 rounded-md border border-rose-200 dark:border-rose-900">
                    Organ Registry
                  </span>
                </div>

                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Active Organs Ready for Transplant
                </p>
                <div className="text-3xl font-black text-rose-600 dark:text-rose-400 mt-1 flex items-baseline gap-2">
                  <span>{dataLoading ? '...' : metrics?.organs?.activeOrgansCount || 0}</span>
                  <span className="text-xs font-bold text-slate-500">Live Ready</span>
                </div>

                <div className="mt-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800/80 space-y-1.5">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1">
                    Live Active Breakdown:
                  </span>
                  <div className="flex flex-wrap gap-1.5 text-xs">
                    {(metrics?.organs?.activeBreakdown || []).filter((item: any) => item.code !== 'BLOOD').length === 0 ? (<span className="text-slate-400 text-xs">No active organs harvested right now.</span>) : (metrics.organs.activeBreakdown
            .filter((item: any) => item.code !== 'BLOOD')
            .map((item: any) => (<span key={item.code} className={`px-2 py-0.5 rounded-lg font-bold text-[11px] border inline-flex items-center gap-1.5 ${item.count > 0
                ? 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-900/60'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'}`}>
                            <OrganImage organ={item.code || item.name} size="xs" showContainer={false}/>
                            <span>{item.name}: {item.count}</span>
                          </span>)))}
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Total Harvested:</span>
                    <strong className="text-slate-900 dark:text-white text-sm">
                      {metrics?.organs?.totalHarvested || 0}
                    </strong>
                  </div>
                  <div className="p-2.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/50">
                    <span className="text-[10px] text-emerald-700 dark:text-emerald-400 block font-medium">Total Transplanted:</span>
                    <strong className="text-emerald-800 dark:text-emerald-300 text-sm">
                      {metrics?.organs?.totalTransplanted || 0}
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-7 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 mb-1">
                <FileText className="w-3.5 h-3.5 text-slate-600"/>
                Audit Trail
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Recent Platform Operational Logs
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Real-time chronological events across organ harvests, matching runs, facility verifications, and blood orders.
              </p>
            </div>

            <Link href="/master-control/logs" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs transition-colors self-start sm:self-auto cursor-pointer">
              <span>View Full Audit Ledger</span>
              <ArrowRight className="w-3.5 h-3.5"/>
            </Link>
          </div>

          {recentLogs.length === 0 ? (<p className="text-xs text-slate-400 py-6 text-center">No recent audit logs available.</p>) : (<div className="space-y-2.5">
              {recentLogs.map((log, idx) => {
                const rowKey = `dashboard-log-${log.type}-${log.id || idx}`;
                const isExpanded = expandedLogId === rowKey;
                return (<div key={rowKey} className="p-3.5 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-2 text-xs transition-colors hover:border-slate-300 dark:hover:border-slate-700">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-start sm:items-center gap-3">
                        {(log.type === 'ORGAN_HARVEST' || log.type === 'ORGAN_MATCH' || log.meta?.organName) ? (<OrganImage organ={log.meta?.organName || log.title} size="sm" className="shrink-0 mt-0.5"/>) : (<span className={`w-2 h-2 rounded-full shrink-0 mt-1.5 sm:mt-0 ${log.type === 'FACILITY_VERIFICATION'
                            ? 'bg-blue-500'
                            : 'bg-emerald-500'}`}></span>)}
                        <div>
                          <h4 className="font-bold text-slate-900 dark:text-white text-xs">
                            {log.title}
                          </h4>
                          <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">
                            {log.description}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 self-start sm:self-auto shrink-0">
                        <span className="text-[11px] text-slate-400 flex items-center gap-1">
                          <Clock className="w-3 h-3"/>
                          {new Date(log.timestamp).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                    })}
                        </span>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                          {log.status || log.type}
                        </span>
                        {log.meta && (<button type="button" onClick={() => setExpandedLogId(isExpanded ? null : rowKey)} className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer" title="Toggle details">
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5"/> : <ChevronDown className="w-3.5 h-3.5"/>}
                          </button>)}
                      </div>
                    </div>

                    {isExpanded && log.meta && (<LogDetailsGrid meta={log.meta}/>)}
                  </div>);
            })}
            </div>)}
        </section>
      </div>
    </div>);
}
