'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useAdminSession } from '../AdminSessionContext';
import { adminApi } from '@/lib/api';
import { Building2, ArrowLeft, Search, CheckCircle2, AlertTriangle, XCircle, MapPin, Phone, Mail, ShieldCheck, RefreshCw, Droplet, Heart, ExternalLink, } from 'lucide-react';
export default function MasterHubsPage() {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const [hubs, setHubs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
    const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'PENDING_APPROVAL' | 'SUSPENDED'>('ALL');
    const [searchTerm, setSearchTerm] = useState('');
    const [feedback, setFeedback] = useState<{
        type: 'success' | 'error';
        text: string;
    } | null>(null);
    const { isAdminUnlocked } = useAdminSession();
    useEffect(() => {
        if (isAdminUnlocked) {
            fetchHubs();
        }
    }, [isAdminUnlocked, statusFilter]);
    const fetchHubs = async () => {
        setLoading(true);
        setFeedback(null);
        try {
            const res = await adminApi.getAllHubs(statusFilter === 'ALL' ? undefined : statusFilter);
            if (res.success) {
                setHubs(Array.isArray(res.data) ? res.data : []);
            }
        }
        catch (err: any) {
            console.error('Failed to fetch hubs:', err);
        }
        finally {
            setLoading(false);
        }
    };
    const handleStatusChange = async (hubId: number, newStatus: 'ACTIVE' | 'SUSPENDED' | 'REJECTED') => {
        setActionLoadingId(hubId);
        setFeedback(null);
        try {
            const res = await adminApi.verifyHub(hubId, newStatus);
            if (res.success) {
                setFeedback({
                    type: 'success',
                    text: `Facility status updated to ${newStatus}.`,
                });
                await fetchHubs();
            }
            else {
                setFeedback({ type: 'error', text: res.message || 'Action failed.' });
            }
        }
        catch (err: any) {
            setFeedback({ type: 'error', text: err.message || 'Action failed.' });
        }
        finally {
            setActionLoadingId(null);
        }
    };
    const filteredHubs = hubs.filter((h) => {
        if (searchTerm.trim()) {
            const q = searchTerm.toLowerCase();
            const matchName = (h.name || '').toLowerCase().includes(q);
            const matchCity = (h.city || '').toLowerCase().includes(q);
            const matchLic = (h.license_number || '').toLowerCase().includes(q);
            if (!matchName && !matchCity && !matchLic)
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
              <Building2 className="w-6 h-6 text-blue-600"/>
              Medical Facilities Directory
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Administrative inspection and access control for all participating hospitals, organ banks, and blood banks.
            </p>
          </div>

          <button type="button" onClick={fetchHubs} disabled={loading} className="px-4 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold flex items-center gap-1.5 transition-colors self-start sm:self-auto cursor-pointer">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`}/>
            <span>Refresh Facilities</span>
          </button>
        </div>

        {feedback && (<div className={`p-4 rounded-2xl text-xs flex items-center gap-2 ${feedback.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                : 'bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300'}`}>
            {feedback.type === 'success' ? (<CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600"/>) : (<AlertTriangle className="w-4 h-4 shrink-0 text-red-600"/>)}
            <span className="font-medium">{feedback.text}</span>
          </div>)}

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-3">
          <div className="flex flex-col md:flex-row items-center justify-between gap-3">

            <div className="relative w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3"/>
              <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Filter by facility name, city, or license..." className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800/60 placeholder:text-slate-400 font-medium focus:outline-hidden focus:border-blue-500"/>
            </div>
          </div>

          <div className="flex items-center gap-1.5 border-t border-slate-100 dark:border-slate-800 pt-3 flex-wrap">
            <span className="text-[11px] font-bold text-slate-400 mr-1">Status:</span>
            {[
            { id: 'ALL', label: 'All Statuses' },
            { id: 'ACTIVE', label: 'Active & Verified' },
            { id: 'PENDING_APPROVAL', label: 'Pending Review' },
            { id: 'SUSPENDED', label: 'Suspended' },
        ].map((s) => (<button key={s.id} type="button" onClick={() => setStatusFilter(s.id as any)} className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${statusFilter === s.id
                ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-bold'
                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                {s.label}
              </button>))}
          </div>
        </div>

        {loading ? (<div className="py-16 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></span>
            Loading facility records...
          </div>) : filteredHubs.length === 0 ? (<div className="py-16 text-center rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <Building2 className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto mb-2"/>
            <p className="text-sm font-bold text-slate-900 dark:text-white">No facilities match your filter</p>
            <p className="text-xs text-slate-500 mt-1">Try resetting the status or search filter above.</p>
          </div>) : (<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredHubs.map((hub) => (<div key={hub.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xs flex flex-col justify-between space-y-4 hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
                <div className="space-y-3">

                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-900">
                      Hospital
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${hub.verification_status === 'ACTIVE'
                    ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                    : hub.verification_status === 'SUSPENDED'
                        ? 'bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800'
                        : 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800'}`}>
                      {hub.verification_status}
                    </span>
                  </div>

                  <div>
                    <h3 className="font-bold text-base text-slate-900 dark:text-white">
                      {hub.name}
                    </h3>
                    <p className="text-xs font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                      Lic: <strong className="text-slate-800 dark:text-slate-200">{hub.license_number}</strong>
                    </p>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300 pt-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0"/>
                      <span className="break-words">{hub.city}, {hub.state || 'IN'} ({hub.pincode})</span>
                    </div>
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0"/>
                      <span className="break-all">{hub.contact_phone}</span>
                    </div>
                    <div className="flex items-start gap-1.5 min-w-0">
                      <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5"/>
                      <span className="break-all font-medium text-slate-800 dark:text-slate-200">{hub.email}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 text-xs">
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 flex items-center gap-2">
                      <Heart className="w-4 h-4 text-rose-500 shrink-0"/>
                      <div>
                        <span className="text-[10px] text-slate-400 block leading-none">Live Organs</span>
                        <strong className="text-slate-900 dark:text-white text-xs">{hub.active_organs || 0}</strong>
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 flex items-center gap-2">
                      <Droplet className="w-4 h-4 text-red-500 shrink-0"/>
                      <div>
                        <span className="text-[10px] text-slate-400 block leading-none">Blood Stock</span>
                        <strong className="text-slate-900 dark:text-white text-xs">{hub.blood_units || 0} Units</strong>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                  <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${hub.name}, ${hub.city}`)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
                    <span>View Map</span>
                    <ExternalLink className="w-3 h-3 opacity-70"/>
                  </a>

                  <div className="flex items-center gap-2">
                    {hub.verification_status === 'ACTIVE' && (<button type="button" onClick={() => handleStatusChange(hub.id, 'SUSPENDED')} disabled={actionLoadingId === hub.id} className="px-3 py-1 rounded-xl bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 text-xs font-semibold hover:bg-red-100 transition-colors cursor-pointer">
                        {actionLoadingId === hub.id ? 'Updating...' : 'Suspend'}
                      </button>)}

                    {hub.verification_status === 'SUSPENDED' && (<button type="button" onClick={() => handleStatusChange(hub.id, 'ACTIVE')} disabled={actionLoadingId === hub.id} className="px-3 py-1 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-500 transition-colors cursor-pointer">
                        {actionLoadingId === hub.id ? 'Updating...' : 'Reactivate'}
                      </button>)}

                    {hub.verification_status === 'PENDING_APPROVAL' && (<button type="button" onClick={() => handleStatusChange(hub.id, 'ACTIVE')} disabled={actionLoadingId === hub.id} className="px-3 py-1 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-500 transition-colors cursor-pointer">
                        {actionLoadingId === hub.id ? 'Approving...' : 'Approve'}
                      </button>)}
                  </div>
                </div>
              </div>))}
          </div>)}
      </div>
    </div>);
}
