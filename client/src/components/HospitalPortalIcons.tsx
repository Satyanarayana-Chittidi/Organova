'use client';

import React from 'react';

export interface HospitalIconProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
}

/**
 * BloodStockInventoryIcon: A medical clipboard with a blood drop inside the box instead of lines.
 * Matches standard Lucide 24x24 stroke style.
 */
export function BloodStockInventoryIcon({
  className = 'w-4 h-4',
  ...props
}: HospitalIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
      {...props}
    >
      {/* Top Clip / Clamp */}
      <rect x="8.5" y="2" width="7" height="3.5" rx="1" strokeWidth="2" />

      {/* Clipboard Body Outline */}
      <path
        d="M8 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-3"
        strokeWidth="2"
      />

      {/* Blood drop placed inside the box instead of checklist lines */}
      <path
        d="M12 8.5C12 8.5 8 12.5 8 15a4 4 0 0 0 8 0c0-2.5-4-6.5-4-6.5z"
        fill="currentColor"
        fillOpacity="0.22"
        strokeWidth="2"
      />

      {/* Specular highlight on droplet */}
      <path
        d="M10.5 14.5a1.8 1.8 0 0 0 1.8 1.8"
        strokeWidth="1.5"
        strokeLinecap="round"
        className="opacity-70"
      />
    </svg>
  );
}

// Backward-compatible alias
export const BloodStockMatrixIcon = BloodStockInventoryIcon;

/**
 * OrganHarvestRegistryIcon: Uses the realistic anatomical heart image from the public/images folder.
 */
export function OrganHarvestRegistryIcon({
  className = 'w-4 h-4',
  alt = 'Organ Harvest Registry',
  ...props
}: React.ImgHTMLAttributes<HTMLImageElement>) {
  return (
    <img
      src="/images/heart.png"
      alt={alt}
      className={`object-contain inline-block shrink-0 select-none ${className}`}
      {...props}
    />
  );
}

/**
 * MatchEngineIcon: A clinical recipient / candidate person icon with a magnifying glass scanning,
 * mathematically aligned to the Lucide 24x24 coordinate grid for optical scaling parity with
 * standard navigation icons.
 */
export function MatchEngineIcon({
  className = 'w-4 h-4',
  ...props
}: HospitalIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
      {...props}
    >
      {/* Candidate Recipient Head */}
      <circle
        cx="10"
        cy="7.5"
        r="4"
        fill="currentColor"
        fillOpacity="0.12"
      />

      {/* Candidate Torso / Shoulder arc */}
      <path d="M2 21a8 8 0 0 1 10.5-7.6" />

      {/* Magnifying Glass Lens */}
      <circle
        cx="17"
        cy="17"
        r="3.5"
        fill="currentColor"
        fillOpacity="0.18"
      />

      {/* Magnifying Glass Handle */}
      <path d="m19.5 19.5 2.5 2.5" />
    </svg>
  );
}
