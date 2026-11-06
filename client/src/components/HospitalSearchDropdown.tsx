'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, X, Check, Building2, MapPin, Phone } from 'lucide-react';

interface HospitalSearchDropdownProps {
  hospitals: any[];
  selectedHospitalId: string | number;
  onSelect: (hospital: any | null) => void;
  placeholder?: string;
  label?: string;
  required?: boolean;
}

export default function HospitalSearchDropdown({
  hospitals,
  selectedHospitalId,
  onSelect,
  placeholder = 'Select Receiving Hospital',
  label = 'Receiving Hospital',
  required = false,
}: HospitalSearchDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Identify currently selected hospital
  const selectedHospital = useMemo(() => {
    if (!selectedHospitalId) return null;
    return hospitals.find((h) => String(h.id) === String(selectedHospitalId)) || null;
  }, [hospitals, selectedHospitalId]);

  // Filter hospitals by name or city
  const filteredHospitals = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return hospitals;
    return hospitals.filter(
      (h) =>
        h.name.toLowerCase().includes(q) ||
        (h.city && h.city.toLowerCase().includes(q)) ||
        (h.address_line && h.address_line.toLowerCase().includes(q))
    );
  }, [hospitals, searchQuery]);

  // Click outside listener to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (hospital: any) => {
    onSelect(hospital);
    setSearchQuery('');
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(null);
    setSearchQuery('');
    if (inputRef.current) inputRef.current.focus();
  };

  return (
    <div className="space-y-1" ref={containerRef}>
      {label && (
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}

      {/* Combobox Trigger & Input Container */}
      <div className="relative">
        <div
          onClick={() => {
            setIsOpen(true);
            if (inputRef.current) inputRef.current.focus();
          }}
          className={`w-full min-h-[42px] px-3 py-2 rounded-xl border transition-all flex items-center gap-2 cursor-pointer bg-white dark:bg-[#0f172a] ${
            isOpen
              ? 'border-rose-500 ring-2 ring-rose-500/20'
              : 'border-slate-200 dark:border-slate-700'
          }`}
        >
          <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />

          <input
            ref={inputRef}
            type="text"
            value={isOpen ? searchQuery : selectedHospital ? `${selectedHospital.name} (${selectedHospital.city})` : ''}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (!isOpen) setIsOpen(true);
            }}
            onFocus={() => {
              setIsOpen(true);
              setSearchQuery('');
            }}
            placeholder={placeholder}
            className="w-full !bg-transparent dark:!bg-transparent text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-hidden"
          />

          <div className="flex items-center gap-1 shrink-0">
            {selectedHospital && !isOpen && (
              <button
                type="button"
                onClick={handleClear}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Clear selection"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            <ChevronDown
              className={`w-4 h-4 text-slate-400 dark:text-slate-500 transition-transform duration-200 ${
                isOpen ? 'rotate-180' : ''
              }`}
            />
          </div>
        </div>

        {/* Dropdown Options List */}
        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-1.5 max-h-60 overflow-y-auto bg-white dark:bg-[#0f172a] rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl z-50 p-1.5 animate-in fade-in zoom-in-95 duration-100">
            {filteredHospitals.length === 0 ? (
              <div className="py-4 px-3 text-center text-xs text-slate-400 dark:text-slate-500">
                No hospital found matching &quot;{searchQuery}&quot;
              </div>
            ) : (
              <div className="space-y-1">
                {filteredHospitals.map((hospital) => {
                  const isSelected = selectedHospital && selectedHospital.id === hospital.id;
                  return (
                    <div
                      key={hospital.id}
                      onClick={() => handleSelect(hospital)}
                      className={`p-2.5 rounded-xl cursor-pointer transition-colors flex items-center justify-between text-xs ${
                        isSelected
                          ? 'bg-rose-50/80 dark:bg-rose-950/40 text-slate-900 dark:text-white font-semibold'
                          : 'hover:bg-slate-100 dark:hover:bg-slate-800/60 text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      <div className="space-y-0.5 pr-2">
                        <div className="flex items-center gap-1.5">
                          <Building2 className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400 dark:text-slate-500'}`} />
                          <span className="font-semibold">{hospital.name}</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium">
                            {hospital.city}
                          </span>
                        </div>
                        {hospital.address_line && (
                          <p className="text-[11px] text-slate-400 dark:text-slate-500 pl-5 truncate">
                            {hospital.address_line}
                          </p>
                        )}
                      </div>

                      {isSelected && <Check className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Selected Hospital Address Card */}
      {selectedHospital && (
        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#0f172a] border border-slate-200/80 dark:border-slate-800 text-xs space-y-1 animate-in fade-in duration-150">
          <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white">
            <Building2 className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 shrink-0" />
            <span>{selectedHospital.name}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-200/70 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold ml-auto">
              Hospital
            </span>
          </div>
          {selectedHospital.address_line && (
            <p className="text-slate-600 dark:text-slate-400 flex items-center gap-1 pl-5">
              <MapPin className="w-3 h-3 shrink-0 text-slate-400" />
              <span>
                {selectedHospital.address_line}, {selectedHospital.city} - {selectedHospital.pincode}
              </span>
            </p>
          )}
          {selectedHospital.contact_phone && (
            <p className="text-slate-500 dark:text-slate-400 pl-5 flex items-center gap-1">
              <Phone className="w-3 h-3 text-emerald-500 shrink-0" />
              <span>
                Emergency Desk:{' '}
                <a
                  href={`tel:${selectedHospital.contact_phone}`}
                  className="font-semibold text-slate-800 dark:text-slate-200 hover:underline"
                >
                  {selectedHospital.contact_phone}
                </a>
              </span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
