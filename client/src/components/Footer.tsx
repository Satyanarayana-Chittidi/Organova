import React from 'react';
import Link from 'next/link';
import { Heart, Phone, ShieldCheck, ExternalLink } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-gray-950 text-gray-400 border-t border-gray-800 text-xs mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand & Mission */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-white border border-slate-700 p-0 overflow-hidden flex items-center justify-center shrink-0">
                <img src="/images/logo.png" alt="Organova Logo" className="w-full h-full object-contain" />
              </div>
              <span className="text-white font-bold text-base tracking-tight">Organova</span>
            </div>
            <p className="text-gray-400 leading-relaxed">
              Organova is a connected digital platform designed for transparent organ donation awareness, cold ischemia viability tracking, and emergency blood matching.
            </p>
            <div className="flex items-center gap-1.5 text-emerald-400 font-medium text-[11px]">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Designed for voluntary pledges & emergency coordination</span>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-white font-semibold text-sm mb-3">Quick Navigation</h4>
            <ul className="space-y-2">
              <li>
                <Link href="/blood-finder" className="hover:text-white transition-colors">
                  Find Emergency Blood Stock
                </Link>
              </li>
              <li>
                <Link href="/directory" className="hover:text-white transition-colors">
                  Participating Hospitals
                </Link>
              </li>
              <li>
                <Link href="/donor/pledge" className="hover:text-white transition-colors">
                  Pledge Your Organs
                </Link>
              </li>
              <li>
                <Link href="/hubs/register" className="hover:text-white transition-colors">
                  Hospital Registration
                </Link>
              </li>
            </ul>
          </div>

          {/* Clinical Facts */}
          <div>
            <h4 className="text-white font-semibold text-sm mb-3">Cold Ischemia Rules</h4>
            <ul className="space-y-1.5 text-gray-400">
              <li><strong className="text-gray-200">Heart & Lungs:</strong> 4 – 6 Hours</li>
              <li><strong className="text-gray-200">Liver:</strong> 12 Hours</li>
              <li><strong className="text-gray-200">Kidneys:</strong> 24 – 36 Hours</li>
              <li><strong className="text-gray-200">Cornea (Eyes):</strong> Up to 14 Days</li>
              <li><strong className="text-gray-200">Blood Units:</strong> 42 Days</li>
            </ul>
          </div>

          {/* 24x7 Emergency Contact */}
          <div>
            <h4 className="text-white font-semibold text-sm mb-3">24x7 Emergency Helplines</h4>
            <div className="p-3.5 rounded-xl bg-gray-900 border border-gray-800 space-y-2">
              <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
                <Phone className="w-4 h-4" />
                <span>1800-11-4770</span>
              </div>
              <p className="text-[11px] text-gray-400">
                General Organ & Tissue Donation Public Awareness Helpline
              </p>
              <div className="text-[11px] text-gray-400 border-t border-gray-800 pt-2">
                Emergency Blood Helpline: <strong className="text-white">104 / 108</strong>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-gray-800 flex flex-col sm:flex-row justify-between items-center gap-4 text-[11px] text-gray-400">
          <p className="text-center sm:text-left">© 2026 Organova. Independent healthcare platform project.</p>
          <div className="flex flex-wrap justify-center sm:justify-end gap-x-4 gap-y-2">
            <Link href="/" className="hover:text-white transition-colors">Privacy Policy</Link>
            <Link href="/" className="hover:text-white transition-colors">Medical Protocols</Link>
            <Link href="/" className="hover:text-white transition-colors">Platform Guidelines</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
