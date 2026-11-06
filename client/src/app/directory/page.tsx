'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { hubApi } from '@/lib/api';
import {
  Hospital,
  Building2,
  Droplet,
  Search,
  MapPin,
  Phone,
  Navigation,
  CheckCircle2,
} from 'lucide-react';

export default function DirectoryPage() {
  const [city, setCity] = useState('');
  const [search, setSearch] = useState('');
  const [hubs, setHubs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDirectory = async () => {
    setLoading(true);
    try {
      const res = await hubApi.getDirectory({
        city: city.trim() || undefined,
        search: search.trim() || undefined,
      });
      if (res.success) {
        setHubs(Array.isArray(res.data) ? res.data : []);
      }
    } catch (err) {
      setHubs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDirectory();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchDirectory();
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full transition-colors duration-200">
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto mb-10">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border border-transparent dark:border-blue-900/50 text-xs font-semibold mb-3">
          <Hospital className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          Medical Facility Directory
        </div>
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight transition-colors">
          Participating Hospitals
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 transition-colors">
          Verified transplant centers, surgical procurement suites, and accredited hospital facilities connected to the platform.
        </p>
      </div>

      {/* Filter Toolbar */}
      <form
        onSubmit={handleSearch}
        className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm mb-10 grid grid-cols-1 sm:grid-cols-4 gap-4 items-end transition-colors"
      >
        <div className="sm:col-span-2">
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Name / Keyword Search</label>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="e.g. Apollo, AIIMS, Trauma Center"
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white bg-white dark:bg-slate-800 placeholder:text-slate-400 dark:placeholder:text-slate-500 font-medium focus:outline-hidden focus:border-blue-500 transition-colors"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">City</label>
          <div className="relative">
            <MapPin className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-3" />
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="e.g. Hyderabad, Mumbai"
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white bg-white dark:bg-slate-800 placeholder:text-slate-400 dark:placeholder:text-slate-500 font-medium focus:outline-hidden focus:border-blue-500 transition-colors"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 rounded-xl bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-500 text-white font-semibold text-sm shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
        >
          <Search className="w-4 h-4" />
          Filter Directory
        </button>
      </form>

      {/* Directory Cards */}
      <div className="space-y-4">
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pb-2 border-b border-slate-200 dark:border-slate-800">
          <span>{hubs.length} verified center(s) registered</span>
          <Link href="/hospital/register" className="text-blue-600 dark:text-blue-400 hover:underline font-semibold">
            Onboard new facility →
          </Link>
        </div>

        {hubs.length === 0 && !loading && (
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 text-center border border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 text-xs">
            No facilities found matching your filters.
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {hubs.map((hub) => (
            <div
              key={hub.id}
              className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2.5 py-0.5 rounded-md border border-blue-100 dark:border-blue-900/50">
                    Accredited Hospital
                  </span>
                  <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-100 dark:border-emerald-900/50">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    ACTIVE
                  </div>
                </div>

                <h3 className="font-bold text-slate-900 dark:text-white text-base mb-1">{hub.name}</h3>
                <p className="text-[11px] font-mono text-slate-400 dark:text-slate-500 mb-4">
                  Lic: {hub.license_number}
                </p>

                <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300 mb-4">
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0 mt-0.5" />
                    <span>{hub.address_line}, {hub.city}, {hub.state} - {hub.pincode}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
                    <a href={`tel:${hub.contact_phone}`} className="font-semibold text-slate-800 dark:text-slate-200 hover:underline">
                      {hub.contact_phone}
                    </a>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                <span className="text-[10px] text-slate-400 dark:text-slate-500">ID #{hub.id}</span>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${hub.latitude},${hub.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-medium"
                >
                  <Navigation className="w-3.5 h-3.5" />
                  View on Map
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
