'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { bloodApi, hubApi } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import HospitalSearchDropdown from '@/components/HospitalSearchDropdown';
import { FindBloodIcon } from '@/components/BloodIcons';
import {
  Droplet,
  MapPin,
  Phone,
  Hospital,
  AlertCircle,
  Building2,
  Navigation,
  ArrowRight,
  RotateCcw,
  X,
  Send,
  CheckCircle2,
  Clock,
  ShieldCheck,
} from 'lucide-react';

export default function BloodFinderPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [bloodGroup, setBloodGroup] = useState('');
  const [component, setComponent] = useState('');
  const [city, setCity] = useState('');
  const [availableCities, setAvailableCities] = useState<string[]>([]);
  const [isCityDropdownOpen, setIsCityDropdownOpen] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Direct Blood Request Modal State
  const [requestTarget, setRequestTarget] = useState<any | null>(null);
  const [unitsRequested, setUnitsRequested] = useState<number>(1);
  const [urgency, setUrgency] = useState<'CRITICAL' | 'URGENT' | 'ROUTINE'>('CRITICAL');
  const [availableHospitals, setAvailableHospitals] = useState<any[]>([]);
  const [selectedHospitalId, setSelectedHospitalId] = useState<string>('');
  const [submittingRequest, setSubmittingRequest] = useState<boolean>(false);
  const [requestSuccess, setRequestSuccess] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);

  const cityWrapperRef = useRef<HTMLDivElement>(null);

  const formatComponentName = (comp: string) => {
    const map: Record<string, string> = {
      PACKED_RBC: 'Packed Red Blood Cells (RBC)',
      WHOLE_BLOOD: 'Whole Blood',
      PLATELETS: 'Platelets',
      PLASMA: 'Fresh Frozen Plasma (FFP)',
      CRYOPRECIPITATE: 'Cryoprecipitate',
    };
    return map[comp] || comp.replace(/_/g, ' ');
  };

  // Load distinct cities and facilities from registered network hubs on mount
  useEffect(() => {
    const fetchFacilities = async () => {
      try {
        const dirRes = await hubApi.getDirectory();
        if (dirRes.success && Array.isArray(dirRes.data)) {
          setAvailableHospitals(dirRes.data);
          const list = Array.from(
            new Set(dirRes.data.map((h: any) => h.city).filter(Boolean))
          ) as string[];
          if (list.length > 0) setAvailableCities(list);
        } else {
          const res = await hubApi.getCities();
          if (res.success && Array.isArray(res.data) && res.data.length > 0) {
            setAvailableCities(res.data);
          }
        }
      } catch (err) {
        setAvailableCities(['Hyderabad', 'Mumbai', 'New Delhi', 'Pune']);
      }
    };

    fetchFacilities();
  }, []);

  // Automatically search inventory whenever bloodGroup, component, city, or refreshTrigger changes
  useEffect(() => {
    let isCancelled = false;

    const timer = setTimeout(async () => {
      setLoading(true);
      setSearched(true);

      try {
        const res = await bloodApi.searchStock({
          blood_group: bloodGroup || undefined,
          component: component || undefined,
          city: city.trim() || undefined,
        });
        if (!isCancelled && res.success) {
          setResults(Array.isArray(res.data) ? res.data : []);
        }
      } catch (err) {
        if (!isCancelled) setResults([]);
      } finally {
        if (!isCancelled) setLoading(false);
      }
    }, 150);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [bloodGroup, component, city, refreshTrigger]);

  // Close city suggestions dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (cityWrapperRef.current && !cityWrapperRef.current.contains(e.target as Node)) {
        setIsCityDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectCity = (selectedCity: string) => {
    setCity(selectedCity);
    setIsCityDropdownOpen(false);
  };

  const handleCityInputChange = (value: string) => {
    setCity(value);
    setIsCityDropdownOpen(true);
  };

  const handleClear = () => {
    setBloodGroup('');
    setComponent('');
    setCity('');
    setIsCityDropdownOpen(false);
  };

  const filteredCities = useMemo(() => {
    const query = city.trim().toLowerCase();
    if (!query) return availableCities;
    return availableCities.filter((c) => c.toLowerCase().includes(query));
  }, [availableCities, city]);

  const hasActiveFilters = Boolean(bloodGroup || component || city.trim());

  // Direct Request Modal Handlers
  const handleOpenRequestModal = (item: any) => {
    if (!user) {
      router.push('/auth/login?redirect=/blood-finder');
      return;
    }
    setRequestTarget(item);
    setUnitsRequested(1);
    setUrgency('CRITICAL');
    setSelectedHospitalId('');
    setRequestSuccess(null);
    setRequestError(null);
  };

  const handleCloseRequestModal = () => {
    setRequestTarget(null);
    setRequestSuccess(null);
    setRequestError(null);
  };

  const handleSubmitDirectRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestTarget) return;

    if (!selectedHospitalId) {
      setRequestError('Please select a receiving hospital.');
      return;
    }

    const destHospital = availableHospitals.find((h) => String(h.id) === String(selectedHospitalId));
    if (!destHospital) {
      setRequestError('Selected hospital was not recognized.');
      return;
    }

    setSubmittingRequest(true);
    setRequestError(null);
    setRequestSuccess(null);

    try {
      const res = await bloodApi.createRequest({
        destination_hub_id: Number(selectedHospitalId),
        target_hub_id: requestTarget.hub_id,
        blood_group: requestTarget.blood_group,
        component: requestTarget.component,
        units_requested: Number(unitsRequested),
        urgency,
        delivery_address: destHospital.name,
      });

      if (res.success) {
        setRequestSuccess(
          `Requisition dispatched to ${requestTarget.hub_name}! Units reserved for ${destHospital.name}.`
        );
        setRefreshTrigger((prev) => prev + 1);
      }
    } catch (err: any) {
      setRequestError(err.message || 'Failed to submit direct blood request.');
    } finally {
      setSubmittingRequest(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full transition-colors duration-200">
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto mb-10">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-400 border border-transparent dark:border-red-900/50 text-xs font-semibold mb-3">
          <FindBloodIcon className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
          Real-Time Blood Inventory
        </div>
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight transition-colors">
          Find Available Blood Units Near You
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 transition-colors">
          Discover verified blood banks and hospitals with real-time stock availability. Free for all citizens.
        </p>
      </div>

      {/* Filter Bar with Automatic Updates (No Search Button Needed) */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm mb-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4 items-end transition-colors">
        <div className="lg:col-span-3">
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Blood Group
          </label>
          <select
            value={bloodGroup}
            onChange={(e) => setBloodGroup(e.target.value)}
            className={`w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm focus:outline-hidden focus:border-rose-500 bg-white dark:bg-slate-800 transition-colors ${
              bloodGroup ? 'font-bold text-rose-600 dark:text-rose-400' : 'text-slate-500 dark:text-slate-400 font-normal'
            }`}
          >
            <option value="">Select Blood Group</option>
            {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((bg) => (
              <option key={bg} value={bg}>
                {bg}
              </option>
            ))}
          </select>
        </div>

        <div className="lg:col-span-4">
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Blood Component
          </label>
          <select
            value={component}
            onChange={(e) => setComponent(e.target.value)}
            className={`w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm focus:outline-hidden focus:border-rose-500 bg-white dark:bg-slate-800 transition-colors ${
              component ? 'text-slate-900 dark:text-white font-medium' : 'text-slate-500 dark:text-slate-400 font-normal'
            }`}
          >
            <option value="">Select Blood Component</option>
            <option value="PACKED_RBC">Packed Red Blood Cells (RBC)</option>
            <option value="WHOLE_BLOOD">Whole Blood</option>
            <option value="PLATELETS">Platelets</option>
            <option value="PLASMA">Fresh Frozen Plasma (FFP)</option>
            <option value="CRYOPRECIPITATE">Cryoprecipitate</option>
          </select>
        </div>

        {/* City Autocomplete Input with Registered Hospitals Dropdown */}
        <div className="lg:col-span-3 relative" ref={cityWrapperRef}>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            City / Region
          </label>
          <div className="relative">
            <MapPin className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-3 pointer-events-none" />
            <input
              type="text"
              value={city}
              onFocus={() => setIsCityDropdownOpen(true)}
              onChange={(e) => handleCityInputChange(e.target.value)}
              placeholder="e.g. Madduru"
              className="w-full pl-9 pr-8 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white bg-white dark:bg-slate-800 placeholder:text-slate-400 dark:placeholder:text-slate-500 font-medium focus:outline-hidden focus:border-rose-500 transition-colors"
            />
            {city && (
              <button
                type="button"
                onClick={() => setCity('')}
                className="absolute right-2.5 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* City Suggestions Dropdown */}
          {isCityDropdownOpen && (
            <div className="absolute left-0 right-0 top-full mt-1.5 z-40 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl overflow-hidden max-h-56 overflow-y-auto animate-in fade-in duration-150">
              <div className="p-2 border-b border-slate-100 dark:border-slate-700/60 text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500 flex items-center justify-between">
                <span>Available Hospital Cities</span>
                <span>{availableCities.length} registered</span>
              </div>

              {filteredCities.length > 0 ? (
                <div className="p-1 space-y-0.5">
                  {filteredCities.map((cityName) => (
                    <button
                      key={cityName}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleSelectCity(cityName)}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer ${
                        city.toLowerCase().trim() === cityName.toLowerCase()
                          ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 font-bold'
                          : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/70'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                        <span>{cityName}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider font-normal">
                        Registered
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-3.5 text-xs text-amber-700 dark:text-amber-300 bg-amber-50/80 dark:bg-amber-950/40 m-2 rounded-xl border border-amber-200/80 dark:border-amber-900/50 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-amber-500 mt-0.5" />
                  <div>
                    <strong className="block font-bold">No Hospital Registered in &quot;{city}&quot;</strong>
                    <span className="text-[11px] text-amber-600 dark:text-amber-400 block mt-0.5">
                      Blood banks are currently only available in registered cities. Select an available city from the list or post an emergency request.
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Clear Button that stays on the right */}
        <div className="lg:col-span-2 flex items-center justify-end">
          <button
            type="button"
            onClick={handleClear}
            disabled={!hasActiveFilters && !loading}
            title="Reset all filters to show all blood banks"
            className={`w-full py-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              hasActiveFilters
                ? 'border-slate-300 dark:border-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 shadow-xs'
                : 'border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-850 text-slate-400 dark:text-slate-500 cursor-not-allowed opacity-60'
            }`}
          >
            <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Updating...' : 'Clear Filters'}
          </button>
        </div>
      </div>

      {/* Results Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400 pb-2 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span>
              Found <strong className="text-slate-900 dark:text-white font-bold">{results.length}</strong> available blood bank stock item(s)
            </span>
            {hasActiveFilters ? (
              <span className="inline-flex items-center gap-1 text-[11px] text-rose-600 dark:text-rose-400 font-medium bg-rose-50 dark:bg-rose-950/50 px-2 py-0.5 rounded-md border border-rose-200 dark:border-rose-900/50">
                Filtered
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-900/50">
                Showing All Blood Banks
              </span>
            )}
          </div>
          <Link href="/blood/emergency" className="text-rose-600 dark:text-rose-400 hover:underline font-semibold flex items-center gap-1">
            Need general broadcast? Create Emergency Requisition →
          </Link>
        </div>

        {results.length === 0 && searched && !loading && (
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 text-center border border-slate-200 dark:border-slate-800">
            <AlertCircle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">No stock found matching your criteria</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
              No facilities currently possess available units matching your filters. Try clearing your filters to view all blood banks, or submit an emergency requisition.
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs shadow-xs transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Clear Filters & Show All
                </button>
              )}
              <Link
                href="/blood/emergency"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 text-white font-semibold text-xs shadow-sm hover:bg-rose-500 transition-colors"
              >
                Post Emergency Blood Requisition
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {results.map((item) => (
            <div
              key={item.id}
              className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-md border border-blue-100 dark:border-blue-900/50">
                      {item.hub_type || 'Facility'}
                    </span>
                    <h3 className="font-bold text-slate-900 dark:text-white text-base mt-1 leading-snug">
                      {item.hub_name}
                    </h3>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-2xl font-black text-rose-600 dark:text-rose-400">{item.units_available}</span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 block font-medium">units ready</span>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700/80 mb-4 flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700 dark:text-slate-200">{formatComponentName(item.component)}</span>
                  <span className="font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 px-2 py-0.5 rounded-md border border-rose-200/50 dark:border-rose-900/50">
                    {item.blood_group}
                  </span>
                </div>

                <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300 mb-4">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
                    <span>{item.city}</span>
                  </div>
                  {item.contact_phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-emerald-500 shrink-0" />
                      <a href={`tel:${item.contact_phone}`} className="font-semibold text-emerald-700 dark:text-emerald-400 hover:underline">
                        {item.contact_phone}
                      </a>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 text-xs">
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${item.latitude},${item.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold text-xs flex items-center gap-1.5 transition-colors"
                >
                  <Navigation className="w-3.5 h-3.5 text-blue-500" />
                  Directions
                </a>

                <button
                  type="button"
                  onClick={() => handleOpenRequestModal(item)}
                  className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-500 hover:from-rose-500 hover:to-red-600 text-white font-semibold text-xs shadow-xs shadow-rose-500/20 flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                >
                  <Send className="w-3.5 h-3.5" />
                  Request Blood
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ==================================================================== */}
      {/* DIRECT BLOOD REQUISITION MODAL */}
      {/* ==================================================================== */}
      {requestTarget && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200"
        >
          <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto transition-colors">
            <button
              onClick={handleCloseRequestModal}
              className="absolute top-5 right-5 p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50 mb-2">
                <Droplet className="w-3 h-3 fill-current" />
                Direct Facility Requisition
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                Request Units from {requestTarget.hub_name}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {requestTarget.city} • {requestTarget.hub_type}
              </p>
            </div>

            {/* Target Stock Preview Card */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block">Requested Stock Item</span>
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  {requestTarget.blood_group} • {formatComponentName(requestTarget.component)}
                </span>
              </div>
              <div className="text-right">
                <span className="text-xs font-black text-rose-600 dark:text-rose-400 block">{requestTarget.units_available} units</span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> Ready in Bank
                </span>
              </div>
            </div>

            {requestSuccess && (
              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-300 text-xs space-y-2">
                <div className="flex items-center gap-2 font-bold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>{requestSuccess}</span>
                </div>
                <div className="pt-2 flex items-center justify-between">
                  <Link
                    href="/blood/emergency"
                    className="font-bold underline text-emerald-700 dark:text-emerald-400 hover:text-emerald-800"
                  >
                    View in Emergency Orders Tracker →
                  </Link>
                  <button
                    onClick={handleCloseRequestModal}
                    className="px-3 py-1 rounded-lg bg-emerald-600 text-white font-semibold text-xs hover:bg-emerald-500"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}

            {requestError && (
              <div className="p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{requestError}</span>
              </div>
            )}

            {!requestSuccess && (
              <form onSubmit={handleSubmitDirectRequest} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Units Needed (Max {requestTarget.units_available})
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={requestTarget.units_available}
                      value={unitsRequested}
                      onChange={(e) => setUnitsRequested(Math.max(1, parseInt(e.target.value) || 1))}
                      required
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-white bg-white dark:bg-slate-800 focus:outline-hidden focus:border-rose-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Urgency Level
                    </label>
                    <select
                      value={urgency}
                      onChange={(e: any) => setUrgency(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-900 dark:text-white bg-white dark:bg-slate-800 focus:outline-hidden focus:border-rose-500"
                    >
                      <option value="CRITICAL">Critical (Immediate Emergency)</option>
                      <option value="URGENT">Urgent (Within 6 Hours)</option>
                      <option value="ROUTINE">Routine (Scheduled Procedure)</option>
                    </select>
                  </div>
                </div>

                {/* Searchable Receiving Hospital Combobox */}
                <HospitalSearchDropdown
                  hospitals={availableHospitals}
                  selectedHospitalId={selectedHospitalId}
                  onSelect={(h) => setSelectedHospitalId(h ? h.id : '')}
                  placeholder="Select Receiving Hospital"
                  label="Receiving Hospital"
                  required
                />

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={handleCloseRequestModal}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingRequest}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-500 hover:from-rose-500 hover:to-red-600 text-white font-semibold text-xs shadow-md shadow-rose-500/20 flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    {submittingRequest ? 'Transmitting Requisition...' : 'Submit Requisition to Bank'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
