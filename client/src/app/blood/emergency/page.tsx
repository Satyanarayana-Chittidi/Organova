'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { bloodApi, hubApi, citizenApi } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useSocket } from '@/context/SocketContext';
import HospitalSearchDropdown from '@/components/HospitalSearchDropdown';
import {
  Droplet,
  Send,
  Clock,
  CheckCircle2,
  AlertCircle,
  Truck,
  Building2,
  XCircle,
  RefreshCw,
  HeartHandshake,
  MapPin,
  Phone,
  ShieldCheck,
  Layers,
  Radio,
  ArrowRight,
  Sparkles,
  X,
  User,
} from 'lucide-react';

export default function EmergencyBloodRequestPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { alerts } = useSocket();

  const [bloodGroup, setBloodGroup] = useState<string>('');
  const [component, setComponent] = useState<string>('');
  const [unitsRequested, setUnitsRequested] = useState<number | ''>('');
  const [urgency, setUrgency] = useState<string>('');
  const [availableHospitals, setAvailableHospitals] = useState<any[]>([]);
  const [selectedHospitalId, setSelectedHospitalId] = useState<string>('');
  const [patientRelationship, setPatientRelationship] = useState<string>('');
  const [patientName, setPatientName] = useState<string>('');
  const [profileName, setProfileName] = useState<string>('');

  const [myRequests, setMyRequests] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [fulfillmentModal, setFulfillmentModal] = useState<{
    fulfillmentCase: 'FULL_IN_HOUSE' | 'PARTIAL_IN_HOUSE' | 'OPEN_SOS' | 'DIRECT_TARGETED';
    inHouseUnits?: number;
    sosUnits?: number;
    matchedBloodGroup?: string;
    hospitalName?: string;
    inHouseRequestId?: number;
    sosRequestId?: number;
    requestId?: number;
  } | null>(null);

  const fetchMyOrders = async () => {
    try {
      const res = await bloodApi.getMyRequests();
      if (res.success) {
        setMyRequests(Array.isArray(res.data) ? res.data : []);
      }
    } catch (err) {}
    finally {
      setLoadingRequests(false);
    }
  };

  useEffect(() => {
    const fetchFacilities = async () => {
      try {
        const res = await hubApi.getDirectory();
        if (res.success && Array.isArray(res.data)) {
          setAvailableHospitals(res.data);
        }
      } catch (err) {
        console.error('Failed to load facilities:', err);
      }
    };
    fetchFacilities();
  }, []);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login');
      return;
    }
    if (user) {
      fetchMyOrders();
      if (user.role === 'USER') {
        citizenApi
          .getProfile()
          .then((res) => {
            if (res.success && res.data?.full_name) {
              setProfileName(res.data.full_name);
            }
          })
          .catch(() => {});
      }
    }
  }, [user, authLoading, alerts]);

  const currentUserName = profileName || user?.email?.split('@')[0] || 'Myself';
  const isSelf = patientRelationship === 'SELF';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!bloodGroup) {
      setError('Please select a blood group.');
      return;
    }

    if (!component) {
      setError('Please select a blood component.');
      return;
    }

    if (!unitsRequested || Number(unitsRequested) < 1) {
      setError('Please specify a valid number of units.');
      return;
    }

    if (!urgency) {
      setError('Please select an urgency priority.');
      return;
    }

    if (!selectedHospitalId) {
      setError('Please select a receiving hospital.');
      return;
    }

    if (!patientRelationship) {
      setError('Please select the recipient relationship.');
      return;
    }

    const dest = availableHospitals.find((h) => String(h.id) === String(selectedHospitalId));
    if (!dest) {
      setError('Selected hospital was not recognized.');
      return;
    }

    setSubmitting(true);

    try {
      const finalPatientName = isSelf ? currentUserName : (patientName.trim() || undefined);
      const res = await bloodApi.createRequest({
        destination_hub_id: Number(selectedHospitalId),
        blood_group: bloodGroup,
        component,
        units_requested: Number(unitsRequested),
        urgency,
        delivery_address: dest.name,
        patient_relationship: patientRelationship,
        patient_name: finalPatientName,
      });

      if (res.data?.fulfillmentCase === 'FULL_IN_HOUSE') {
        setSuccessMsg(`In-house inventory match at ${dest.name}! All ${res.data.inHouseUnits} unit(s) sent directly to hospital portal for approval.`);
        setFulfillmentModal(res.data);
      } else if (res.data?.fulfillmentCase === 'PARTIAL_IN_HOUSE') {
        setSuccessMsg(`Dual fulfillment plan active: ${res.data.inHouseUnits} unit(s) reserved at ${dest.name}, SOS broadcast for remaining ${res.data.sosUnits} unit(s).`);
        setFulfillmentModal(res.data);
      } else {
        setSuccessMsg(`Emergency requisition broadcasted for ${dest.name}! Active blood banks & matching donors alerted.`);
      }

      setBloodGroup('');
      setComponent('');
      setUnitsRequested('');
      setUrgency('');
      setSelectedHospitalId('');
      setPatientRelationship('');
      setPatientName('');
      await fetchMyOrders();
    } catch (err: any) {
      setError(err.message || 'Failed to submit requisition.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (id: number) => {
    if (!confirm('Are you sure you want to cancel this requisition?')) return;
    try {
      await bloodApi.cancelRequest(id);
      await fetchMyOrders();
    } catch (err: any) {
      alert(err.message || 'Failed to cancel requisition.');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'REQUESTED':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-400 border border-transparent dark:border-amber-800/40 animate-pulse">Awaiting Blood Bank / Donor Claim</span>;
      case 'APPROVED':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-400 border border-transparent dark:border-blue-800/40">Claimed & Reserved in Bank</span>;
      case 'DONOR_COMMITTED':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-400 border border-amber-200 dark:border-amber-800/40 flex items-center gap-1 animate-pulse"><HeartHandshake className="w-3 h-3 text-amber-600 dark:text-amber-400" /> Walk-In Donor Committed</span>;
      case 'DISPATCHED':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-400 border border-transparent dark:border-purple-800/40 flex items-center gap-1"><Truck className="w-3 h-3" /> En Route</span>;
      case 'COMPLETED':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-400 border border-transparent dark:border-emerald-800/40 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Fulfilled</span>;
      case 'EXPIRED':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-400 border border-transparent dark:border-rose-800/40">Expired / Escalated</span>;
      case 'CANCELLED':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">Cancelled</span>;
      default:
        return <span>{status}</span>;
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full transition-colors duration-200">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        <div className="lg:col-span-1 bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
          <div className="mb-6">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-400 border border-transparent dark:border-red-900/50 text-xs font-semibold mb-2">
              <Droplet className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
              Emergency Blood Request
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight transition-colors">Post Requisition</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 transition-colors">
              Broadcasts instantly to all verified blood banks across the city.
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-300 text-xs flex items-center gap-2 mb-4">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2 mb-4">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Blood Group <span className="text-rose-500">*</span>
              </label>
              <select
                value={bloodGroup}
                onChange={(e) => setBloodGroup(e.target.value)}
                className={`w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm focus:outline-hidden focus:border-rose-500 bg-white dark:bg-[#0f172a] transition-colors ${
                  !bloodGroup
                    ? 'text-slate-400 dark:text-slate-500 font-normal'
                    : 'font-bold text-slate-900 dark:text-white'
                }`}
              >
                <option value="" disabled>Select Blood Group</option>
                {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((bg) => (
                  <option key={bg} value={bg}>
                    {bg}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Blood Component <span className="text-rose-500">*</span>
              </label>
              <select
                value={component}
                onChange={(e) => setComponent(e.target.value)}
                className={`w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm focus:outline-hidden focus:border-rose-500 bg-white dark:bg-[#0f172a] transition-colors ${
                  !component
                    ? 'text-slate-400 dark:text-slate-500 font-normal'
                    : 'text-slate-900 dark:text-white'
                }`}
              >
                <option value="" disabled>Select Blood Component</option>
                <option value="PACKED_RBC">Packed Red Blood Cells (RBC)</option>
                <option value="WHOLE_BLOOD">Whole Blood</option>
                <option value="PLATELETS">Platelets</option>
                <option value="PLASMA">Fresh Frozen Plasma</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Number of Units <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min={1}
                max={20}
                required
                value={unitsRequested}
                onChange={(e) => setUnitsRequested(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="e.g. 2"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white bg-white dark:bg-[#0f172a] placeholder:text-slate-400 dark:placeholder:text-slate-500 font-medium focus:outline-hidden focus:border-rose-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Urgency Priority <span className="text-rose-500">*</span>
              </label>
              <select
                value={urgency}
                onChange={(e: any) => setUrgency(e.target.value)}
                className={`w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm focus:outline-hidden focus:border-rose-500 bg-white dark:bg-[#0f172a] transition-colors ${
                  !urgency
                    ? 'text-slate-400 dark:text-slate-500 font-normal'
                    : 'font-semibold text-red-600 dark:text-red-400'
                }`}
              >
                <option value="" disabled>Select Urgency</option>
                <option value="CRITICAL">CRITICAL (Emergency / Immediate Surgery)</option>
                <option value="URGENT">URGENT (Within 6 Hours)</option>
                <option value="ROUTINE">ROUTINE (Scheduled Procedure)</option>
              </select>
            </div>

            <HospitalSearchDropdown
              hospitals={availableHospitals}
              selectedHospitalId={selectedHospitalId}
              onSelect={(h) => setSelectedHospitalId(h ? h.id : '')}
              placeholder="Select Receiving Hospital"
              label="Receiving Hospital"
              required
            />

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Recipient / Patient Relationship <span className="text-rose-500">*</span>
                </label>
                <select
                  value={patientRelationship}
                  onChange={(e) => setPatientRelationship(e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm focus:outline-hidden focus:border-rose-500 bg-white dark:bg-[#0f172a] transition-colors ${
                    !patientRelationship
                      ? 'text-slate-400 dark:text-slate-500 font-normal'
                      : 'text-slate-900 dark:text-white'
                  }`}
                >
                  <option value="" disabled>Select Recipient</option>
                  <option value="SELF">Myself (Personal Need)</option>
                  <option value="CHILD">Child / Dependent</option>
                  <option value="PARENT">Parent / Senior</option>
                  <option value="SPOUSE">Spouse / Partner</option>
                  <option value="FRIEND">Friend / Relative</option>
                  <option value="OTHER">Patient Under Care / Other</option>
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Patient Name
                  </label>
                  {isSelf ? (
                    <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                      Autofilled (Your Name)
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400 font-normal">(Optional)</span>
                  )}
                </div>
                <input
                  type="text"
                  disabled={isSelf}
                  readOnly={isSelf}
                  value={isSelf ? currentUserName : patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  placeholder={isSelf ? currentUserName : "Patient Name"}
                  className={`w-full px-3 py-2 rounded-xl border text-xs font-medium transition-colors ${
                    isSelf
                      ? 'border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 cursor-not-allowed select-none'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0f172a] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-hidden focus:border-rose-500'
                  }`}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-rose-600 to-red-500 hover:from-rose-500 hover:to-red-600 text-white font-semibold text-sm shadow-md shadow-rose-500/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
            >
              <Send className="w-4 h-4" />
              {submitting ? 'Dispatching Alert...' : 'Broadcast Emergency Order'}
            </button>
          </form>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-6">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white transition-colors">My Requisitions Tracker</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 transition-colors">Live fulfillment status of your submitted blood orders</p>
              </div>

              <button
                onClick={fetchMyOrders}
                className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title="Refresh Status"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {myRequests.length === 0 && !loadingRequests && (
              <div className="text-center py-12 text-slate-400 dark:text-slate-500 text-xs">
                No blood requisitions posted yet. Use the form on the left to submit an emergency order.
              </div>
            )}

            <div className="space-y-4">
              {myRequests.map((req) => (
                <div
                  key={req.id}
                  onClick={() => router.push(`/blood/donate/${req.id}?from=emergency`)}
                  className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/80 hover:border-rose-400 dark:hover:border-rose-600/70 hover:shadow-md transition-all cursor-pointer space-y-3 group"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-black text-rose-600 dark:text-rose-400">{req.blood_group}</span>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{req.component}</span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">({req.units_requested} units)</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {getStatusBadge(req.status)}
                    </div>
                  </div>

                  {(req.patient_relationship || req.patient_name) && (
                    <div className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-[11px] text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                      <span>
                        Recipient: <strong className="text-slate-900 dark:text-white capitalize">{req.patient_relationship?.toLowerCase() === 'self' ? 'Myself' : (req.patient_relationship || 'Patient')}</strong>
                        {req.patient_name ? ` • Patient: ${req.patient_name}` : ''}
                      </span>
                    </div>
                  )}

                  <div className="p-3 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700/70 text-xs space-y-1">
                    <div className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-white">
                      <Building2 className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                      <span>Receiving Destination: <strong>{req.destination_hub_name || req.delivery_address}</strong></span>
                    </div>
                    {req.destination_hub_address && (
                      <p className="text-slate-500 dark:text-slate-400 pl-5 flex items-center gap-1">
                        <MapPin className="w-3 h-3 shrink-0" />
                        <span>{req.destination_hub_address}, {req.destination_hub_city}</span>
                      </p>
                    )}
                    {req.destination_hub_phone && (
                      <p className="text-slate-500 dark:text-slate-400 pl-5 flex items-center gap-1">
                        <Phone className="w-3 h-3 text-emerald-500 shrink-0" />
                        <a
                          href={`tel:${req.destination_hub_phone}`}
                          onClick={(e) => e.stopPropagation()}
                          className="hover:underline font-medium text-slate-700 dark:text-slate-300"
                        >
                          {req.destination_hub_phone}
                        </a>
                      </p>
                    )}
                  </div>

                  {req.target_hub_name && (
                    <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs flex items-center justify-between">
                      <span className="text-slate-600 dark:text-slate-300 font-medium">Dispensing Blood Bank: <strong>{req.target_hub_name}</strong></span>
                      {req.target_hub_phone && (
                        <a
                          href={`tel:${req.target_hub_phone}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-rose-600 dark:text-rose-400 font-semibold underline text-[11px]"
                        >
                          {req.target_hub_phone}
                        </a>
                      )}
                    </div>
                  )}

                  {req.fulfilling_hub_name && (
                    <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900/50 text-xs text-blue-900 dark:text-blue-200 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                        <span>Dispensing Facility: <strong className="text-slate-900 dark:text-white">{req.fulfilling_hub_name}</strong></span>
                      </div>
                      {req.fulfilling_hub_phone && (
                        <a
                          href={`tel:${req.fulfilling_hub_phone}`}
                          onClick={(e) => e.stopPropagation()}
                          className="font-bold underline text-blue-700 dark:text-blue-300"
                        >
                          {req.fulfilling_hub_phone}
                        </a>
                      )}
                    </div>
                  )}

                  {req.status === 'DONOR_COMMITTED' && (
                    <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/50 text-xs text-amber-900 dark:text-amber-200 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <HeartHandshake className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                        <span>Walk-In Donor Committed: <strong>{req.donor_name || 'Hero Donor'}</strong></span>
                      </div>
                      <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wide">
                        En Route to Hospital
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 dark:border-slate-700/60 text-[11px] text-slate-400 dark:text-slate-500">
                    <span>Submitted: {new Date(req.created_at).toLocaleString()}</span>

                    <div className="flex items-center gap-3">
                      {req.status === 'REQUESTED' && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCancel(req.id);
                          }}
                          className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 font-medium flex items-center gap-1 cursor-pointer"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          Cancel Order
                        </button>
                      )}
                      <span className="text-xs font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                        View Details <ArrowRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {fulfillmentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 sm:p-7 space-y-5 animate-in zoom-in-95 duration-200">
            <button
              onClick={() => setFulfillmentModal(null)}
              className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {fulfillmentModal.fulfillmentCase === 'FULL_IN_HOUSE' && (
              <>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-7 h-7" />
                  </div>
                  <div>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 uppercase tracking-wide">
                      In-House Stock Available • Case A
                    </span>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                      Direct Hospital Requisition
                    </h3>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-900/60 text-xs text-slate-700 dark:text-slate-300 space-y-2">
                  <p className="font-semibold text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    All {fulfillmentModal.inHouseUnits} unit(s) are in stock at {fulfillmentModal.hospitalName}!
                  </p>
                  <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-400">
                    The platform clinical optimizer confirmed that the receiving hospital already possesses compatible blood (<strong>{fulfillmentModal.matchedBloodGroup}</strong>) in their facility bank repository.
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-2.5 text-xs">
                  <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800/80">
                    <span className="text-slate-500 dark:text-slate-400">Receiving Hospital:</span>
                    <span className="font-bold text-slate-900 dark:text-white">{fulfillmentModal.hospitalName}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800/80">
                    <span className="text-slate-500 dark:text-slate-400">Fulfillment Source:</span>
                    <span className="font-semibold text-emerald-700 dark:text-emerald-400">Internal Hospital Blood Bank</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800/80">
                    <span className="text-slate-500 dark:text-slate-400">Stock Sourced:</span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {fulfillmentModal.inHouseUnits} Unit(s) • Compatible ({fulfillmentModal.matchedBloodGroup})
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-slate-500 dark:text-slate-400">Order Reference:</span>
                    <span className="font-mono font-bold text-rose-600 dark:text-rose-400">#BR-{fulfillmentModal.requestId}</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-[11px] text-slate-500 dark:text-slate-400 flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>
                    <strong>ACID Optimization:</strong> No external SOS alert was broadcasted to public donors or outside hubs, preventing unnecessary logistics and protecting community donor bandwidth.
                  </span>
                </div>

                <div className="pt-2 flex items-center justify-end gap-3">
                  <button
                    onClick={() => setFulfillmentModal(null)}
                    className="w-full py-2.5 px-4 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-xs hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors shadow-xs"
                  >
                    View Requisition in Orders
                  </button>
                </div>
              </>
            )}

            {fulfillmentModal.fulfillmentCase === 'PARTIAL_IN_HOUSE' && (
              <>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-950/70 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                    <Layers className="w-7 h-7" />
                  </div>
                  <div>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 uppercase tracking-wide">
                      Dual Fulfillment Activated • Case B
                    </span>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                      Partial In-House Stock + SOS Alert
                    </h3>
                  </div>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-400">
                  <strong>{fulfillmentModal.hospitalName}</strong> has partial stock for this emergency. To minimize delay, the system has split this requisition into two parallel fulfillment streams:
                </p>

                <div className="space-y-3">
                  <div className="p-3.5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 uppercase tracking-wide">
                        1. In-House Hospital Order (#BR-{fulfillmentModal.inHouseRequestId})
                      </span>
                      <span className="font-bold text-emerald-700 dark:text-emerald-300 text-xs">
                        {fulfillmentModal.inHouseUnits} Unit(s)
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300">
                      Dispatched directly to {fulfillmentModal.hospitalName}&apos;s facility queue for instant internal verification and crossmatching.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-rose-50/70 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-100 dark:bg-rose-900 text-rose-800 dark:text-rose-200 uppercase tracking-wide flex items-center gap-1">
                        <Radio className="w-3 h-3 animate-pulse text-rose-600 dark:text-rose-400" />
                        2. Regional SOS Broadcast (#BR-{fulfillmentModal.sosRequestId})
                      </span>
                      <span className="font-bold text-rose-700 dark:text-rose-300 text-xs">
                        {fulfillmentModal.sosUnits} Unit(s)
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300">
                      Broadcasted to all verified blood banks holding stock and notified active compatible living donors in the city for walk-in commitment.
                    </p>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-[11px] text-slate-500 dark:text-slate-400 flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <span>
                    Both orders can be tracked independently below. Once donors or blood banks dispatch the remaining units, they will arrive directly at {fulfillmentModal.hospitalName}.
                  </span>
                </div>

                <div className="pt-2 flex items-center justify-end gap-3">
                  <button
                    onClick={() => setFulfillmentModal(null)}
                    className="w-full py-2.5 px-4 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-xs hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors shadow-xs"
                  >
                    Track Both Orders
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
