'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { bloodApi } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import CitizenAccountLinker, { LinkedCitizen } from '@/components/CitizenAccountLinker';
import { BloodStockInventoryIcon } from '@/components/HospitalPortalIcons';
import {
  Droplet,
  Plus,
  Minus,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Building2,
  ShieldCheck,
  PlusCircle,
  MinusCircle,
  X,
  Layers,
  AlertTriangle,
  Boxes,
  Activity,
  Lock,
} from 'lucide-react';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const COMPONENTS = ['PACKED_RBC', 'WHOLE_BLOOD', 'PLATELETS', 'PLASMA'];

export default function HospitalInventoryPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [inventory, setInventory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedGroup, setSelectedGroup] = useState<string>('Select Blood Group');
  const [selectedComponent, setSelectedComponent] = useState<string>('Select Blood Component');
  const [unitCount, setUnitCount] = useState<string>('');
  const [formMode, setFormMode] = useState<'ADD' | 'DEDUCT'>('ADD');
  const [selectedDonor, setSelectedDonor] = useState<LinkedCitizen | null>(null);
  const [selectedRecipient, setSelectedRecipient] = useState<LinkedCitizen | null>(null);
  const [patientName, setPatientName] = useState<string>('');
  const [hospitalBedNo, setHospitalBedNo] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [invalidFields, setInvalidFields] = useState<string[]>([]);

  const fetchInventory = async () => {
    try {
      const res = await bloodApi.getMyInventory();
      if (res.success) {
        setInventory(Array.isArray(res.data) ? res.data : []);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load facility inventory.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleManualRefresh = () => {
    setRefreshing(true);
    setError(null);
    fetchInventory();
  };

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'HOSPITAL')) {
      router.push('/auth/login');
      return;
    }
    if (user) fetchInventory();
  }, [user, authLoading]);

  const getUnits = (bg: string, comp: string): number => {
    const item = inventory.find((i) => i.blood_group === bg && i.component === comp);
    return item ? item.units_available : 0;
  };

  const totalFacilityUnits = useMemo(() => {
    return inventory.reduce((acc, curr) => acc + (curr.units_available || 0), 0);
  }, [inventory]);

  const depletedCount = useMemo(() => {
    let count = 0;
    BLOOD_GROUPS.forEach((bg) => {
      COMPONENTS.forEach((comp) => {
        if (getUnits(bg, comp) === 0) count++;
      });
    });
    return count;
  }, [inventory]);

  const lowStockCount = useMemo(() => {
    let count = 0;
    BLOOD_GROUPS.forEach((bg) => {
      COMPONENTS.forEach((comp) => {
        const u = getUnits(bg, comp);
        if (u > 0 && u <= 5) count++;
      });
    });
    return count;
  }, [inventory]);

  const optimalCount = useMemo(() => {
    let count = 0;
    BLOOD_GROUPS.forEach((bg) => {
      COMPONENTS.forEach((comp) => {
        const u = getUnits(bg, comp);
        if (u > 5) count++;
      });
    });
    return count;
  }, [inventory]);

  const handleFieldChange = (field: 'blood_group' | 'component' | 'units', value: string) => {
    if (field === 'blood_group') setSelectedGroup(value);
    if (field === 'component') setSelectedComponent(value);
    if (field === 'units') setUnitCount(value);

    if (invalidFields.includes(field)) {
      setInvalidFields((prev) => prev.filter((f) => f !== field));
      setFormError(null);
    }
  };

  const handlePresetClick = (amount: number) => {
    setUnitCount(String(amount));
    if (invalidFields.includes('units')) {
      setInvalidFields((prev) => prev.filter((f) => f !== 'units'));
      setFormError(null);
    }
  };

  const handleCellSelect = (bg: string, comp: string) => {
    setSelectedGroup(bg);
    setSelectedComponent(comp);
    setInvalidFields((prev) => prev.filter((f) => f !== 'blood_group' && f !== 'component'));
    setFormError(null);
  };

  const handleAddStockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    const empty: string[] = [];
    if (!selectedGroup || selectedGroup === 'Select Blood Group') empty.push('blood_group');
    if (!selectedComponent || selectedComponent === 'Select Blood Component') empty.push('component');
    const parsedUnits = parseInt(unitCount, 10);
    if (!unitCount || isNaN(parsedUnits) || parsedUnits <= 0) empty.push('units');

    if (empty.length > 0) {
      setInvalidFields(empty);
      setFormError('Please select a blood group, blood component, and enter a valid unit quantity.');
      return;
    }

    const currentStock = getUnits(selectedGroup, selectedComponent);
    if (formMode === 'DEDUCT' && parsedUnits > currentStock) {
      setFormError(`Cannot deduct ${parsedUnits} unit(s). Current stock for ${selectedGroup} (${selectedComponent.replace(/_/g, ' ')}) is only ${currentStock} unit(s).`);
      return;
    }

    setSubmitting(true);

    try {
      const delta = formMode === 'ADD' ? parsedUnits : -parsedUnits;
      const linkedUserId = formMode === 'ADD' ? selectedDonor?.id : selectedRecipient?.id;
      const linkedUserRole = formMode === 'ADD' ? 'DONOR' : 'RECIPIENT';

      await bloodApi.adjustInventory({
        blood_group: selectedGroup,
        component: selectedComponent,
        delta_units: delta,
        linked_user_id: linkedUserId || null,
        linked_user_role: linkedUserId ? linkedUserRole : null,
        patient_name:
          formMode === 'DEDUCT'
            ? patientName.trim() || selectedRecipient?.full_name || null
            : selectedDonor?.full_name || null,
        hospital_bed_no: formMode === 'DEDUCT' ? hospitalBedNo.trim() || null : null,
      });

      const readableComp = selectedComponent.replace(/_/g, ' ');
      if (formMode === 'ADD') {
        const donorNotice = selectedDonor
          ? ` Transaction linked to donor ${selectedDonor.full_name}.`
          : '';
        setFormSuccess(`Successfully added ${parsedUnits} unit(s) of ${selectedGroup} (${readableComp}) to inventory.${donorNotice}`);
      } else {
        const recipientNotice = selectedRecipient
          ? ` Transaction linked to recipient ${selectedRecipient.full_name}.`
          : '';
        setFormSuccess(`Successfully dispensed ${parsedUnits} unit(s) of ${selectedGroup} (${readableComp}) from inventory.${recipientNotice}`);
      }

      setUnitCount('');
      setSelectedDonor(null);
      setSelectedRecipient(null);
      setPatientName('');
      setHospitalBedNo('');
      await fetchInventory();
    } catch (err: any) {
      setFormError(err.message || 'Failed to update blood stock.');
    } finally {
      setSubmitting(false);
    }
  };

  const isBloodGroupLocked = formMode === 'ADD' ? !!selectedDonor?.blood_group : !!selectedRecipient?.blood_group;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-200 dark:border-slate-800 gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 text-xs font-semibold mb-2">
            <BloodStockInventoryIcon className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
            Institutional Supply Chain
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
            Blood Stock Inventory
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
            Real-time supply quantities across all 8 blood groups and components. Changes sync live with citizen discovery and automated emergency matching.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={refreshing}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center gap-2 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh Inventory
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-600 dark:text-red-400" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-1">
            <CheckCircle2 className="w-4 h-4" />
            Optimal Stock (&gt; 5 Units)
          </div>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
            {optimalCount} <span className="text-xs font-bold text-slate-400">/ 32 Types</span>
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-600 dark:text-amber-400 mb-1">
            <AlertTriangle className="w-4 h-4" />
            Low Stock (&le; 5 Units)
          </div>
          <p className="text-2xl font-black text-amber-600 dark:text-amber-400">
            {lowStockCount} <span className="text-xs font-bold text-slate-400">/ 32 Types</span>
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center gap-2 text-xs font-semibold text-rose-600 dark:text-rose-400 mb-1">
            <Droplet className="w-4 h-4" />
            Depleted (0 Units)
          </div>
          <p className="text-2xl font-black text-rose-600 dark:text-rose-400">
            {depletedCount} <span className="text-xs font-bold text-slate-400">/ 32 Types</span>
          </p>
        </div>
      </div>

      <section className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-xs transition-colors ${
              formMode === 'ADD'
                ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
            }`}>
              {formMode === 'ADD' ? (
                <PlusCircle className="w-5 h-5" />
              ) : (
                <MinusCircle className="w-5 h-5" />
              )}
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white transition-colors">
                {formMode === 'ADD'
                  ? 'Add Blood Stock to Facility Inventory (Inward)'
                  : 'Dispense Blood Stock from Facility Inventory (Outward)'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 transition-colors">
                {formMode === 'ADD'
                  ? 'Log incoming blood units from voluntary camps, donor arrivals, or tested laboratory batches.'
                  : 'Log outgoing blood units for clinical transfusions, emergency patient dispatch, or cross-matching.'}
              </p>
            </div>
          </div>

          <div className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-slate-800 self-start sm:self-auto text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setFormMode('ADD');
                setFormError(null);
                setFormSuccess(null);
              }}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                formMode === 'ADD'
                  ? 'bg-rose-600 text-white shadow-2xs font-bold'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              + Inward / Add Stock
            </button>
            <button
              type="button"
              onClick={() => {
                setFormMode('DEDUCT');
                setFormError(null);
                setFormSuccess(null);
              }}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                formMode === 'DEDUCT'
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-2xs font-bold'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              - Outward / Dispense
            </button>
          </div>
        </div>

        <form onSubmit={handleAddStockSubmit} className="space-y-6">
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-4">
            {formMode === 'ADD' ? (
              <CitizenAccountLinker
                label="Link Voluntary Donor Account (Optional)"
                sublabel="Search an existing citizen or register a new donor so this donation appears immediately on their personal ledger."
                selectedUser={selectedDonor}
                onSelectUser={(donor) => {
                  setSelectedDonor(donor);
                  if (donor?.blood_group && BLOOD_GROUPS.includes(donor.blood_group)) {
                    setSelectedGroup(donor.blood_group);
                  }
                }}
                onBloodGroupSelected={(bg) => {
                  if (BLOOD_GROUPS.includes(bg)) setSelectedGroup(bg);
                }}
              />
            ) : (
              <div className="space-y-4">
                <CitizenAccountLinker
                  label="Link Inpatient Recipient Account (Optional)"
                  sublabel="Search an existing citizen or register a patient so this blood transfusion is permanently recorded in their health ledger."
                  selectedUser={selectedRecipient}
                  onSelectUser={(rec) => {
                    setSelectedRecipient(rec);
                    if (rec?.blood_group && BLOOD_GROUPS.includes(rec.blood_group)) {
                      setSelectedGroup(rec.blood_group);
                    }
                    if (rec?.full_name && !patientName) {
                      setPatientName(rec.full_name);
                    }
                  }}
                  onBloodGroupSelected={(bg) => {
                    if (BLOOD_GROUPS.includes(bg)) setSelectedGroup(bg);
                  }}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Patient / Recipient Name (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder={selectedRecipient ? selectedRecipient.full_name : 'e.g. Rahul Sharma'}
                      value={patientName}
                      onChange={(e) => setPatientName(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-hidden focus:ring-2 focus:ring-rose-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Hospital Ward / Bed No (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. ICU-04, General Ward 2B"
                      value={hospitalBedNo}
                      onChange={(e) => setHospitalBedNo(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-hidden focus:ring-2 focus:ring-rose-500"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Blood Group <span className="text-rose-500">*</span>
                </label>
                {isBloodGroupLocked && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                    <Lock className="w-3 h-3" />
                    Locked
                  </span>
                )}
              </div>
              <select
                name="blood_group"
                value={selectedGroup}
                onChange={(e) => handleFieldChange('blood_group', e.target.value)}
                disabled={isBloodGroupLocked}
                style={{ color: (!selectedGroup || selectedGroup === 'Select Blood Group') ? '#94a3b8' : undefined }}
                className={`w-full px-3.5 py-2.5 text-xs rounded-xl border bg-white dark:bg-slate-800 focus:outline-hidden transition-all ${
                  isBloodGroupLocked
                    ? 'opacity-85 cursor-not-allowed bg-slate-100 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700'
                    : 'cursor-pointer'
                } ${
                  invalidFields.includes('blood_group')
                    ? 'border-rose-500 ring-2 ring-rose-500/20 dark:border-rose-500 dark:ring-rose-500/20'
                    : 'border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-rose-500'
                } ${
                  !selectedGroup || selectedGroup === 'Select Blood Group'
                    ? '!text-slate-400 dark:!text-slate-500 font-normal'
                    : 'text-slate-900 dark:text-white font-bold'
                }`}
              >
                <option value="Select Blood Group" className="text-slate-400 dark:text-slate-500 font-normal">
                  Select Blood Group
                </option>
                {BLOOD_GROUPS.map((bg) => (
                  <option key={bg} value={bg} className="text-slate-900 dark:text-white font-bold">
                    {bg}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Blood Component <span className="text-rose-500">*</span>
              </label>
              <select
                name="component"
                value={selectedComponent}
                onChange={(e) => handleFieldChange('component', e.target.value)}
                style={{ color: (!selectedComponent || selectedComponent === 'Select Blood Component') ? '#94a3b8' : undefined }}
                className={`w-full px-3.5 py-2.5 text-xs rounded-xl border bg-white dark:bg-slate-800 focus:outline-hidden transition-all cursor-pointer ${
                  invalidFields.includes('component')
                    ? 'border-rose-500 ring-2 ring-rose-500/20 dark:border-rose-500 dark:ring-rose-500/20'
                    : 'border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-rose-500'
                } ${
                  !selectedComponent || selectedComponent === 'Select Blood Component'
                    ? '!text-slate-400 dark:!text-slate-500 font-normal'
                    : 'text-slate-900 dark:text-white font-bold'
                }`}
              >
                <option value="Select Blood Component" className="text-slate-400 dark:text-slate-500 font-normal">
                  Select Blood Component
                </option>
                {COMPONENTS.map((comp) => (
                  <option key={comp} value={comp} className="text-slate-900 dark:text-white font-bold">
                    {comp.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                {formMode === 'ADD' ? 'Number of Units' : 'Units to Deduct'} <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                name="units"
                min="1"
                max="500"
                placeholder="e.g. 5"
                value={unitCount}
                onChange={(e) => handleFieldChange('units', e.target.value)}
                className={`w-full px-3.5 py-2.5 text-xs rounded-xl border bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-hidden transition-all ${
                  invalidFields.includes('units')
                    ? 'border-rose-500 ring-2 ring-rose-500/20 dark:border-rose-500 dark:ring-rose-500/20'
                    : 'border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-rose-500'
                }`}
              />
            </div>

            <div>
              <button
                type="submit"
                disabled={submitting}
                className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 ${
                  formMode === 'ADD'
                    ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/20'
                    : 'bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 shadow-slate-900/20'
                }`}
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Updating Stock...
                  </>
                ) : formMode === 'ADD' ? (
                  <>
                    <Plus className="w-4 h-4" />
                    Add Stock to Inventory
                  </>
                ) : (
                  <>
                    <Minus className="w-4 h-4" />
                    Deduct from Stock
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-semibold text-slate-400">Quick Presets:</span>
              {[1, 2, 5, 10, 20].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handlePresetClick(preset)}
                  className="px-2.5 py-0.5 rounded-lg text-[11px] font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                >
                  +{preset}
                </button>
              ))}
            </div>

            <p className="text-[11px] text-slate-400 italic">
              Tip: Click any cell in the inventory below to automatically select that blood group & component.
            </p>
          </div>

          {formError && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
              <span>{formError}</span>
            </div>
          )}

          {formSuccess && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-300 text-xs flex items-center justify-between gap-2 animate-in fade-in">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span>{formSuccess}</span>
              </div>
              <button
                type="button"
                onClick={() => setFormSuccess(null)}
                className="text-emerald-700 dark:text-emerald-300 hover:opacity-75 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </form>
      </section>

      <section className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
              Current Blood Stock Inventory
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Quantities currently stored across all clinical component groups.
            </p>
          </div>

          <div className="flex items-center gap-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
              Optimal (&gt; 5)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span>
              Low (&le; 5)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-slate-700 inline-block"></span>
              Depleted (0)
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 uppercase tracking-wider text-[10px]">
                <th className="pb-3.5 font-bold">Blood Group</th>
                {COMPONENTS.map((comp) => (
                  <th key={comp} className="pb-3.5 font-bold text-center">
                    {comp.replace(/_/g, ' ')}
                  </th>
                ))}
                <th className="pb-3.5 font-bold text-center text-slate-700 dark:text-slate-300">
                  Group Total
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {BLOOD_GROUPS.map((bg) => {
                const groupTotal = COMPONENTS.reduce((sum, comp) => sum + getUnits(bg, comp), 0);

                return (
                  <tr key={bg} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="py-3.5">
                      <div className="inline-flex items-center gap-1.5 font-black text-rose-600 dark:text-rose-400 text-base">
                        <Droplet className="w-3.5 h-3.5 fill-current opacity-80" />
                        <span>{bg}</span>
                      </div>
                    </td>

                    {COMPONENTS.map((comp) => {
                      const units = getUnits(bg, comp);
                      const isSelected = selectedGroup === bg && selectedComponent === comp;

                      return (
                        <td key={comp} className="py-2.5 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleCellSelect(bg, comp)}
                            title={`Click to select ${bg} (${comp.replace(/_/g, ' ')}) in the Add Stock form`}
                            className={`w-full py-2.5 px-3 rounded-2xl border transition-all cursor-pointer text-center group ${
                              isSelected
                                ? 'ring-2 ring-rose-500 border-rose-500 dark:border-rose-500'
                                : ''
                            } ${
                              units > 5
                                ? 'bg-emerald-50/70 hover:bg-emerald-100/70 dark:bg-emerald-950/30 dark:hover:bg-emerald-950/50 border-emerald-200/80 dark:border-emerald-900/40 text-emerald-900 dark:text-emerald-200'
                                : units > 0
                                ? 'bg-amber-50/70 hover:bg-amber-100/70 dark:bg-amber-950/30 dark:hover:bg-amber-950/50 border-amber-200/80 dark:border-amber-900/40 text-amber-900 dark:text-amber-200'
                                : 'bg-slate-50/70 hover:bg-slate-100/70 dark:bg-slate-800/40 dark:hover:bg-slate-800/70 border-slate-200/60 dark:border-slate-800 text-slate-400 dark:text-slate-500'
                            }`}
                          >
                            <span className="block text-base font-extrabold tracking-tight">
                              {units}
                            </span>
                            <span className={`block text-[10px] font-semibold mt-0.5 ${
                              units > 5
                                ? 'text-emerald-700 dark:text-emerald-400'
                                : units > 0
                                ? 'text-amber-700 dark:text-amber-400'
                                : 'text-slate-400 dark:text-slate-600'
                            }`}>
                              {units > 5 ? 'Optimal' : units > 0 ? 'Low Stock' : 'Depleted'}
                            </span>
                          </button>
                        </td>
                      );
                    })}

                    <td className="py-2.5 px-2 text-center">
                      <div className="py-2.5 px-3 rounded-2xl bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 font-extrabold text-sm text-slate-800 dark:text-slate-200">
                        {groupTotal}
                        <span className="block text-[10px] font-medium text-slate-500 dark:text-slate-400">
                          Units
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>

            <tfoot>
              <tr className="border-t-2 border-slate-200 dark:border-slate-800 font-bold text-slate-900 dark:text-white">
                <td className="pt-4 pb-2 text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  Total Units
                </td>
                {COMPONENTS.map((comp) => {
                  const compTotal = BLOOD_GROUPS.reduce((sum, bg) => sum + getUnits(bg, comp), 0);

                  return (
                    <td key={comp} className="pt-4 pb-2 text-center">
                      <span className="text-sm font-black text-rose-600 dark:text-rose-400">
                        {compTotal}
                      </span>
                    </td>
                  );
                })}
                <td className="pt-4 pb-2 text-center">
                  <span className="text-base font-black text-slate-900 dark:text-white">
                    {totalFacilityUnits}
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </div>
  );
}
