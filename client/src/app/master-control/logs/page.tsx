'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useAdminSession } from '../AdminSessionContext';
import { adminApi } from '@/lib/api';
import OrganImage from '@/components/OrganImage';
import { FileText, ArrowLeft, Search, Clock, RefreshCw, Filter, CheckCircle2, AlertTriangle, ChevronDown, ChevronUp, } from 'lucide-react';
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
    return (<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
      {entries.map(([key, val]) => (<div key={key} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/70 dark:border-slate-800 shadow-2xs">
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
export default function MasterLogsPage() {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterType, setFilterType] = useState<string>('ALL');
    const [searchTerm, setSearchTerm] = useState('');
    const [limit, setLimit] = useState<number>(100);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const { isAdminUnlocked } = useAdminSession();
    useEffect(() => {
        if (isAdminUnlocked) {
            fetchLogs();
        }
    }, [isAdminUnlocked, limit]);
    const fetchLogs = async () => {
        setLoading(true);
        try {
            const res = await adminApi.getLogs(limit);
            if (res.success) {
                setLogs(Array.isArray(res.data) ? res.data : []);
            }
        }
        catch (err: any) {
            console.error('Failed to load logs:', err);
        }
        finally {
            setLoading(false);
        }
    };
    const filteredLogs = logs.filter((log) => {
        if (filterType !== 'ALL' && log.type !== filterType)
            return false;
        if (searchTerm.trim()) {
            const q = searchTerm.toLowerCase();
            const matchTitle = (log.title || '').toLowerCase().includes(q);
            const matchDesc = (log.description || '').toLowerCase().includes(q);
            const matchStatus = (log.status || '').toLowerCase().includes(q);
            if (!matchTitle && !matchDesc && !matchStatus)
                return false;
        }
        return true;
    });
    return (<div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors py-8 px-4 sm:px-6 lg:px-8 space-y-6">
      <div className="max-w-7xl mx-auto space-y-6">

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <Link href="/master-control" className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors mb-2">
              <ArrowLeft className="w-3.5 h-3.5"/>
              Back to Master Control
            </Link>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <FileText className="w-6 h-6 text-indigo-600"/>
              System Audit & Transaction Ledger
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Comprehensive chronological platform audit trail of organ harvests, matches, facility verifications, and blood orders.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <select value={limit} onChange={(e) => setLimit(Number(e.target.value))} className="px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 font-semibold cursor-pointer">
              <option value={50}>Last 50 Events</option>
              <option value={100}>Last 100 Events</option>
              <option value={200}>Last 200 Events</option>
            </select>

            <button type="button" onClick={fetchLogs} disabled={loading} className="px-4 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`}/>
              <span>Refresh</span>
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-3">
          <div className="flex flex-col md:flex-row items-center justify-between gap-3">

            <div className="relative w-full md:w-96">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3"/>
              <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search logs by keyword, ID, organ, or status..." className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800/60 placeholder:text-slate-400 font-medium focus:outline-hidden focus:border-indigo-500"/>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap w-full md:w-auto">
              {[
            { id: 'ALL', label: 'All Operations' },
            { id: 'ORGAN_HARVEST', label: 'Harvests' },
            { id: 'ORGAN_MATCH', label: 'Matches' },
            { id: 'FACILITY_VERIFICATION', label: 'Audits' },
            { id: 'BLOOD_REQUEST', label: 'Blood Orders' },
        ].map((c) => (<button key={c.id} type="button" onClick={() => setFilterType(c.id)} className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${filterType === c.id
                ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-bold shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}>
                  {c.label}
                </button>))}
            </div>
          </div>
        </div>

        {loading ? (<div className="py-16 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></span>
            Streaming operational ledger...
          </div>) : filteredLogs.length === 0 ? (<div className="py-16 text-center rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <FileText className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto mb-2"/>
            <p className="text-sm font-bold text-slate-900 dark:text-white">No logs match your filter</p>
            <p className="text-xs text-slate-500 mt-1">Try broadening your search term or selecting All Operations.</p>
          </div>) : (<div className="space-y-3">
            {filteredLogs.map((log, idx) => {
                const rowKey = `${log.type}-${log.id || idx}`;
                const isExpanded = expandedId === rowKey;
                return (<div key={rowKey} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs transition-colors hover:border-slate-300 dark:hover:border-slate-700">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="flex items-start sm:items-center gap-3">
                      {(log.type === 'ORGAN_HARVEST' || log.type === 'ORGAN_MATCH' || log.meta?.organName) ? (<OrganImage organ={log.meta?.organName || log.title} size="sm" className="shrink-0 mt-0.5"/>) : (<span className={`w-2.5 h-2.5 rounded-full shrink-0 mt-1 sm:mt-0 ${log.type === 'FACILITY_VERIFICATION'
                            ? 'bg-blue-500'
                            : 'bg-emerald-500'}`}></span>)}

                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                            {log.title}
                          </h4>
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                            {log.type.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <p className="text-slate-600 dark:text-slate-300 text-xs mt-1">
                          {log.description}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-start sm:self-auto shrink-0">
                      <div className="text-right">
                        <span className="text-[11px] text-slate-400 flex items-center gap-1 justify-end">
                          <Clock className="w-3 h-3"/>
                          {new Date(log.timestamp).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                    })}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400 mt-0.5 block">
                          Status: <strong className="text-slate-700 dark:text-slate-300">{log.status}</strong>
                        </span>
                      </div>

                      {log.meta && (<button type="button" onClick={() => setExpandedId(isExpanded ? null : rowKey)} className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition-colors cursor-pointer" title="Toggle Metadata">
                          {isExpanded ? <ChevronUp className="w-4 h-4"/> : <ChevronDown className="w-4 h-4"/>}
                        </button>)}
                    </div>
                  </div>

                  {isExpanded && log.meta && (<div className="mt-2">
                      <LogDetailsGrid meta={log.meta}/>
                    </div>)}
                </div>);
            })}
          </div>)}
      </div>
    </div>);
}
