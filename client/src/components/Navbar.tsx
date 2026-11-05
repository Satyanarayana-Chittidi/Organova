'use client';
import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useSocket } from '@/context/SocketContext';
import { useTheme } from '@/context/ThemeContext';
import { getAvatarUrl } from '@/lib/api';
import { Heart, Droplet, Hospital, ShieldCheck, User, LogOut, Bell, Menu, X, Activity, Award, Moon, Sun, Calendar, Users, FileText, Search, Lock, Home, Clock, BookOpen, } from 'lucide-react';
import { FindBloodIcon } from '@/components/BloodIcons';
import { BloodStockInventoryIcon, OrganHarvestRegistryIcon, MatchEngineIcon, } from '@/components/HospitalPortalIcons';
export default function Navbar() {
    const pathname = usePathname();
    const router = useRouter();
    const { user, logout } = useAuth();
    const { alerts, dismissAlert, connected } = useSocket();
    const { theme, toggleTheme } = useTheme();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [alertsOpen, setAlertsOpen] = useState(false);
    const [profileMenuOpen, setProfileMenuOpen] = useState(false);
    const handleAdminSearchClick = (e: React.MouseEvent) => {
        if (pathname === '/master-control') {
            e.preventDefault();
            const section = document.getElementById('registry-explorer');
            if (section) {
                section.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            const searchInput = document.getElementById('master-control-search-input') as HTMLInputElement | null;
            if (searchInput) {
                searchInput.focus();
            }
        }
        else {
            router.push('/master-control?focus=search#registry-explorer');
        }
    };
    const visibleAlerts = alerts.filter((a) => !a.meta?.requesterUserId || a.meta?.requesterUserId !== user?.id);
    const profileMenuRef = useRef<HTMLDivElement>(null);
    const alertsMenuRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            if (profileMenuRef.current && !profileMenuRef.current.contains(target)) {
                setProfileMenuOpen(false);
            }
            if (alertsMenuRef.current && !alertsMenuRef.current.contains(target)) {
                setAlertsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);
    const isActive = (path: string) => pathname === path;
    return (<nav className="sticky top-0 z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 shadow-xs transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 xl:px-8">
        <div className="flex justify-between h-16 items-center gap-2 sm:gap-4">

          <Link href={pathname.startsWith('/master-control') ? '/master-control' : '/'} className="flex items-center gap-2 sm:gap-2.5 shrink min-w-0 group">
            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-white border border-slate-200/90 dark:border-slate-700 p-0 overflow-hidden shadow-xs group-hover:scale-105 transition-transform shrink-0 flex items-center justify-center">
              <img src="/images/logo.png" alt="Organova Logo" className="w-full h-full object-contain"/>
            </div>
            <div className="flex flex-col whitespace-nowrap min-w-0">
              <span className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight leading-none transition-colors">
                Organova
              </span>
              <span className="hidden sm:block text-[10px] uppercase font-bold text-rose-600 dark:text-rose-400 tracking-wider mt-0.5">
                {pathname.startsWith('/master-control') ? 'Master Control Gateway' : 'Organ & Blood Network'}
              </span>
            </div>
          </Link>

          <div className="hidden xl:flex items-center gap-1 shrink-0">
            {pathname.startsWith('/master-control') ? (<>
                <Link href="/master-control" className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${isActive('/master-control')
                ? 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 font-bold'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                  <ShieldCheck className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400"/>
                  Admin Console
                </Link>

                <Link href="/master-control/hubs" className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${isActive('/master-control/hubs')
                ? 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                  <Hospital className="w-3.5 h-3.5 text-blue-500"/>
                  Hospitals
                </Link>

                <Link href="/camps" className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${isActive('/camps')
                ? 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                  <Calendar className="w-3.5 h-3.5 text-purple-500"/>
                  Camps
                </Link>

                <Link href="/master-control/logs" className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${isActive('/master-control/logs')
                ? 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                  <FileText className="w-3.5 h-3.5 text-indigo-500"/>
                  Logs
                </Link>

                <button type="button" onClick={handleAdminSearchClick} className="px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer" title="Search Registry & Entity Explorer">
                  <Search className="w-3.5 h-3.5 text-indigo-500"/>
                  <span>Search</span>
                </button>
              </>) : (<>
                <Link href="/" className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${isActive('/')
                ? 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                  <Home className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400"/>
                  Home
                </Link>

                <Link href="/blood-finder" className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${isActive('/blood-finder')
                ? 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                  <FindBloodIcon className="w-3.5 h-3.5 text-red-500"/>
                  Find Blood
                </Link>

                <Link href="/directory" className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${isActive('/directory')
                ? 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                  <Hospital className="w-3.5 h-3.5 text-blue-500"/>
                  Hospitals
                </Link>

                <Link href="/camps" className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${isActive('/camps')
                ? 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                  <Calendar className="w-3.5 h-3.5 text-purple-500"/>
                  Camps
                </Link>

                {user?.role === 'USER' && (<>
                    <span className="w-px h-4 bg-slate-200 dark:bg-slate-800 mx-1 shrink-0"></span>

                    <Link href="/donor/pledge" className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${isActive('/donor/pledge')
                    ? 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                      <Award className="w-3.5 h-3.5 text-amber-500"/>
                      Pledges
                    </Link>

                    <Link href="/blood/emergency" className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${isActive('/blood/emergency')
                    ? 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                      <Droplet className="w-3.5 h-3.5 text-red-500"/>
                      Request Blood
                    </Link>

                    <Link href="/transplant/passport" className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${isActive('/transplant/passport')
                    ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                      <Clock className="w-3.5 h-3.5 text-emerald-500"/>
                      Waitlist
                    </Link>
                  </>)}

                {user?.role === 'HOSPITAL' && (<>
                    <span className="w-px h-4 bg-slate-200 dark:bg-slate-800 mx-1 shrink-0"></span>

                    <Link href="/hospital/inventory" className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${isActive('/hospital/inventory')
                    ? 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                      <BloodStockInventoryIcon className="w-3.5 h-3.5 text-red-500"/>
                      Stock
                    </Link>

                    <Link href="/hospital/requests" className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${isActive('/hospital/requests')
                    ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                      <Clock className="w-3.5 h-3.5 text-emerald-500"/>
                      Waitlist
                    </Link>

                    <Link href="/hospital/harvest" className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${isActive('/hospital/harvest')
                    ? 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                      <OrganHarvestRegistryIcon className="w-3.5 h-3.5"/>
                      Harvest
                    </Link>

                    <Link href="/hospital/matches" className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${isActive('/hospital/matches')
                    ? 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                      <MatchEngineIcon className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400"/>
                      Matches
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    </Link>
                  </>)}
              </>)}
          </div>

          <div className="flex items-center gap-1 sm:gap-2 shrink-0">

            <button type="button" onClick={toggleTheme} className="p-1.5 sm:p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer" title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}>
              {theme === 'dark' ? (<Moon className="w-4 h-4 text-indigo-400"/>) : (<Sun className="w-4 h-4 text-amber-500"/>)}
            </button>

            {!pathname.startsWith('/master-control') && user && (<div className="relative" ref={alertsMenuRef}>
                <button type="button" onClick={() => setAlertsOpen(!alertsOpen)} className="p-1.5 sm:p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 relative transition-colors cursor-pointer" title="Real-Time Alerts">
                  <Bell className="w-4 h-4"/>
                  {visibleAlerts.length > 0 && (<span className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-rose-600 text-[9px] font-bold text-white flex items-center justify-center animate-pulse">
                      {visibleAlerts.length}
                    </span>)}
                </button>

                {alertsOpen && (<div className="absolute right-0 mt-2 w-80 sm:w-96 max-w-[calc(100vw-24px)] bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-4 z-50 animate-in fade-in zoom-in-95 duration-150">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900 dark:text-white text-sm">Real-Time Alerts</span>
                        <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-500' : 'bg-amber-400'}`}></span>
                      </div>
                      <span className="text-xs text-slate-400 dark:text-slate-500">{visibleAlerts.length} active</span>
                    </div>

                    {visibleAlerts.length === 0 ? (<div className="py-6 text-center text-xs text-slate-400 dark:text-slate-500">
                        No active clinical alerts at this moment.
                      </div>) : (<div className="max-h-72 overflow-y-auto space-y-2">
                        {visibleAlerts.map((alert) => (<div key={alert.id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border border-slate-100 dark:border-slate-700/60 text-xs flex justify-between items-start gap-2">
                            <div>
                              <span className="font-semibold text-rose-600 dark:text-rose-400 block mb-0.5">
                                {alert.type.replace(/_/g, ' ')}
                              </span>
                              <p className="text-slate-700 dark:text-slate-300 leading-snug">{alert.message}</p>

                              {(alert.type === 'ACTIVE_DONOR_PASS' || alert.type === 'BLOOD_DONOR_SOS') && alert.meta?.requestId && (<Link href={`/blood/donate/${alert.meta.requestId}`} onClick={() => setAlertsOpen(false)} className="inline-flex items-center gap-1 mt-1 text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:underline">
                                  {alert.type === 'ACTIVE_DONOR_PASS' ? 'View Walk-In Donor Pass →' : 'Review & Walk-In to Donate →'}
                                </Link>)}

                              {alert.type === 'EMERGENCY_BLOOD_ALERT' && (<Link href="/blood/emergency" onClick={() => setAlertsOpen(false)} className="inline-flex items-center gap-1 mt-1 text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:underline">
                                  View Requisition Queue →
                                </Link>)}

                              {alert.type.includes('MATCH') && (<Link href="/transplant/passport" onClick={() => setAlertsOpen(false)} className="inline-flex items-center gap-1 mt-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline">
                                  <Clock className="w-3 h-3 text-emerald-500"/>
                                  Review Match Proposal →
                                </Link>)}

                              <span className="text-[10px] text-slate-400 dark:text-slate-500 block mt-1">
                                {new Date(alert.timestamp).toLocaleTimeString()}
                              </span>
                            </div>
                            <button type="button" onClick={() => dismissAlert(alert.id)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer">
                              <X className="w-3.5 h-3.5"/>
                            </button>
                          </div>))}
                      </div>)}
                  </div>)}
              </div>)}

            {pathname.startsWith('/master-control') && (<button type="button" onClick={() => {
                window.location.reload();
            }} className="px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer" title="Lock Master Control Console">
                <Lock className="w-3.5 h-3.5 text-rose-500"/>
                <span className="hidden sm:inline">Lock Console</span>
              </button>)}

            {!pathname.startsWith('/master-control') && user && (<div className="relative" ref={profileMenuRef}>
                <button type="button" onClick={() => setProfileMenuOpen((prev) => !prev)} className="w-8 h-8 sm:w-9 sm:h-9 rounded-full overflow-hidden border-2 border-slate-200 dark:border-slate-700 hover:border-rose-500 dark:hover:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-500/40 transition-all cursor-pointer shadow-xs flex items-center justify-center shrink-0 group" title={`Signed in as ${user.email}`}>
                  {user.avatar_url ? (<img src={getAvatarUrl(user.avatar_url)!} alt={user.email} className="w-full h-full object-cover group-hover:scale-105 transition-transform"/>) : (<div className="w-full h-full bg-gradient-to-tr from-rose-600 to-red-500 text-white flex items-center justify-center font-bold text-xs group-hover:scale-105 transition-transform">
                      {user.email.charAt(0).toUpperCase()}
                    </div>)}
                </button>

                {profileMenuOpen && (<div className="absolute right-0 mt-2.5 w-64 max-w-[calc(100vw-24px)] bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-2 z-50 animate-in fade-in zoom-in-95 duration-150">

                    <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 mb-1">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 border border-slate-200 dark:border-slate-700">
                          {user.avatar_url ? (<img src={getAvatarUrl(user.avatar_url)!} alt={user.email} className="w-full h-full object-cover"/>) : (<div className="w-full h-full bg-rose-600 text-white flex items-center justify-center font-bold text-xs">
                              {user.email.charAt(0).toUpperCase()}
                            </div>)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                            {user.email}
                          </p>
                          <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50">
                            {user.role}
                          </span>
                        </div>
                      </div>
                    </div>

                    {user.role === 'USER' && (<>
                        <Link href="/citizen/profile" onClick={() => setProfileMenuOpen(false)} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                          <User className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0"/>
                          <div>
                            <span>Profile</span>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">
                              View details, pledges & photo
                            </p>
                          </div>
                        </Link>

                        <Link href="/citizen/history" onClick={() => setProfileMenuOpen(false)} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                          <BookOpen className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0"/>
                          <div>
                            <span>Donation History</span>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">
                              Blood & organ transactions ledger
                            </p>
                          </div>
                        </Link>
                      </>)}

                    {user.role === 'HOSPITAL' && (<>
                        <Link href="/hospital/profile" onClick={() => setProfileMenuOpen(false)} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                          <Hospital className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0"/>
                          <div>
                            <span>Facility Profile</span>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">
                              Accreditation details, address & contacts
                            </p>
                          </div>
                        </Link>

                        <Link href="/hospital/history" onClick={() => setProfileMenuOpen(false)} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                          <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0"/>
                          <div>
                            <span>Transaction Ledger</span>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">
                              Harvests & transplants activity log
                            </p>
                          </div>
                        </Link>
                      </>)}

                    <div className="h-px bg-slate-100 dark:bg-slate-800 my-1"/>
                    <button type="button" onClick={() => {
                    setProfileMenuOpen(false);
                    logout();
                }} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer text-left">
                      <LogOut className="w-4 h-4 shrink-0 text-red-600 dark:text-red-400"/>
                      <div>
                        <span>Log Out</span>
                        <p className="text-[10px] text-red-400/80 dark:text-red-400/60 font-normal">
                          Sign out of your account
                        </p>
                      </div>
                    </button>
                  </div>)}
              </div>)}

            <button type="button" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="xl:hidden p-1.5 sm:p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
              {mobileMenuOpen ? <X className="w-5 h-5"/> : <Menu className="w-5 h-5"/>}
            </button>
          </div>
        </div>
      </div>

      {mobileMenuOpen && (<div className="xl:hidden border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 pt-3 pb-6 space-y-1 text-sm font-medium">
          {pathname.startsWith('/master-control') ? (<>
              <Link href="/master-control" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 font-bold flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-rose-600 dark:text-rose-400"/>
                <span>Admin Console</span>
              </Link>
              <Link href="/master-control/hubs" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800">
                Hospitals & Facilities
              </Link>
              <Link href="/camps" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800">
                Donation Camps
              </Link>
              <Link href="/master-control/logs" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800">
                System Audit Logs
              </Link>
              <button type="button" onClick={(e) => {
                    setMobileMenuOpen(false);
                    handleAdminSearchClick(e);
                }} className="w-full text-left px-3 py-2 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 cursor-pointer">
                <Search className="w-4 h-4 text-indigo-500"/>
                <span>Search Registry</span>
              </button>
            </>) : (<>
              <Link href="/" onClick={() => setMobileMenuOpen(false)} className="px-3 py-2 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2.5">
                <Home className="w-4 h-4 text-slate-500"/>
                <span>Home</span>
              </Link>
              <Link href="/blood-finder" onClick={() => setMobileMenuOpen(false)} className="px-3 py-2 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2.5">
                <FindBloodIcon className="w-4 h-4 text-red-500"/>
                <span>Find Blood Stock</span>
              </Link>
              <Link href="/directory" onClick={() => setMobileMenuOpen(false)} className="px-3 py-2 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2.5">
                <Hospital className="w-4 h-4 text-blue-500"/>
                <span>Hospitals</span>
              </Link>
              <Link href="/camps" onClick={() => setMobileMenuOpen(false)} className="px-3 py-2 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2.5">
                <Calendar className="w-4 h-4 text-purple-500"/>
                <span>Donation Camps</span>
              </Link>
            </>)}

          <button type="button" onClick={toggleTheme} className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
            <span className="flex items-center gap-2">
              {theme === 'dark' ? (<Moon className="w-4 h-4 text-indigo-400"/>) : (<Sun className="w-4 h-4 text-amber-500"/>)}
              {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
            </span>
            <div className={`w-8 h-4.5 rounded-full p-0.5 flex items-center ${theme === 'dark' ? 'bg-rose-600 justify-end' : 'bg-slate-300 dark:bg-slate-700 justify-start'}`}>
              <div className="w-3.5 h-3.5 rounded-full bg-white shadow-xs"/>
            </div>
          </button>

          {user?.role === 'USER' && (<>
              <Link href="/donor/pledge" onClick={() => setMobileMenuOpen(false)} className="px-3 py-2 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2.5">
                <Award className="w-4 h-4 text-amber-500"/>
                <span>My Pledges & Donor Card</span>
              </Link>
              <Link href="/blood/emergency" onClick={() => setMobileMenuOpen(false)} className="px-3 py-2 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2.5">
                <Droplet className="w-4 h-4 text-red-500"/>
                <span>Request Blood</span>
              </Link>
              <Link href="/transplant/passport" onClick={() => setMobileMenuOpen(false)} className="px-3 py-2 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2.5">
                <Clock className="w-4 h-4 text-emerald-500"/>
                <span>Waitlist Status</span>
              </Link>
              <Link href="/citizen/profile" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800">
                Citizen Profile
              </Link>
              <Link href="/citizen/history" onClick={() => setMobileMenuOpen(false)} className="px-3 py-2 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2.5">
                <BookOpen className="w-4 h-4 text-teal-600 dark:text-teal-400"/>
                <span>Donation History</span>
              </Link>
            </>)}

          {user?.role === 'HOSPITAL' && (<>
              <Link href="/hospital/profile" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800">
                Facility Profile
              </Link>
              <Link href="/hospital/history" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800">
                Transaction Ledger
              </Link>
              <Link href="/hospital/inventory" onClick={() => setMobileMenuOpen(false)} className="px-3 py-2 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2.5">
                <BloodStockInventoryIcon className="w-4 h-4 text-red-500"/>
                <span>Stock Inventory</span>
              </Link>
              <Link href="/hospital/requests" onClick={() => setMobileMenuOpen(false)} className="px-3 py-2 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2.5">
                <Clock className="w-4 h-4 text-emerald-500"/>
                <span>Transplant Waitlist</span>
              </Link>
              <Link href="/hospital/harvest" onClick={() => setMobileMenuOpen(false)} className="px-3 py-2 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2.5">
                <OrganHarvestRegistryIcon className="w-4 h-4"/>
                <span>Log Harvest Organ</span>
              </Link>
              <Link href="/hospital/matches" onClick={() => setMobileMenuOpen(false)} className="px-3 py-2 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2.5">
                <MatchEngineIcon className="w-4 h-4 text-indigo-500"/>
                <span>Match Engine</span>
              </Link>
            </>)}

          {user && (<button type="button" onClick={() => {
                    setMobileMenuOpen(false);
                    logout();
                }} className="w-full text-left px-3 py-2 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 font-semibold cursor-pointer flex items-center gap-2">
              <LogOut className="w-4 h-4 shrink-0"/>
              <span>Log Out</span>
            </button>)}
        </div>)}
    </nav>);
}
