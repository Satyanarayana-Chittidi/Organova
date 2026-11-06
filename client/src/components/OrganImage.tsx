'use client';

import React from 'react';
import { Heart, Droplet } from 'lucide-react';

/**
 * Returns the public path to the transparent organ illustration, or null if cellular/unknown.
 */
export function getOrganImagePath(organIdentifier?: string | null): string | null {
  if (!organIdentifier) return null;
  const str = String(organIdentifier).toUpperCase();

  if (str.includes('HEART')) return '/images/heart.png';
  if (str.includes('LUNG')) return '/images/lungs.png';
  if (str.includes('LIVER')) return '/images/liver.png';
  if (str.includes('KIDNEY')) return '/images/kidneys.png';
  if (str.includes('PANCREAS')) return '/images/pancreas.png';
  if (str.includes('CORNEA') || str.includes('EYE')) return '/images/cornea_eye.png';
  if (str.includes('BONE_MARROW') || str.includes('MARROW')) return '/images/bone_marrow.png';
  if (str.includes('BLOOD')) return '/images/blood.png';

  return null;
}

/**
 * Formats user-facing display names for organs (e.g. Kidney vs Kidneys in living vs deceased context).
 */
export function getOrganDisplayName(
  nameOrCode?: string | null,
  consentType?: 'LIVING' | 'DECEASED'
): string {
  if (!nameOrCode) return 'Organ';
  const str = String(nameOrCode).toUpperCase();

  if (str.includes('KIDNEY')) {
    return consentType === 'LIVING' ? 'Kidney' : 'Kidneys';
  }
  if (str.includes('LUNG')) {
    return consentType === 'LIVING' ? 'Lung Lobe' : 'Lungs';
  }
  if (str.includes('LIVER')) {
    return consentType === 'LIVING' ? 'Liver (Lobe Segment)' : 'Liver';
  }
  if (str.includes('BLOOD')) return 'Blood';
  if (str.includes('CORNEA') || str.includes('EYE')) return 'Eyes (Cornea)';
  if (str.includes('BONE_MARROW') || str.includes('MARROW')) return 'Bone Marrow';
  if (str.includes('PANCREAS')) return 'Pancreas';
  if (str.includes('HEART')) return 'Heart';

  return String(nameOrCode);
}

/**
 * Clinical subtitles describing physiological category.
 */
export function getOrganSubtitle(
  nameOrCode?: string | null,
  consentType?: 'LIVING' | 'DECEASED'
): string {
  if (!nameOrCode) return 'Transplant Organ';
  const str = String(nameOrCode).toUpperCase();

  if (str.includes('HEART')) return 'Vital Thoracic Organ';
  if (str.includes('LUNG')) return 'Respiratory Paired Organs';
  if (str.includes('LIVER')) {
    return consentType === 'LIVING' ? 'Regenerative Lobe Segment' : 'Complete Hepatic Organ';
  }
  if (str.includes('KIDNEY')) {
    return consentType === 'LIVING' ? 'Single Paired Kidney' : 'Both Renal Organs';
  }
  if (str.includes('PANCREAS')) return 'Endocrine Gland System';
  if (str.includes('CORNEA') || str.includes('EYE')) return 'Ocular Sight-Restoring Tissue';
  if (str.includes('BONE_MARROW') || str.includes('MARROW')) return 'Hematopoietic Stem Cells';
  if (str.includes('BLOOD')) return 'Whole Blood & Cellular Units';

  return 'Medical Transplant Specimen';
}

export type OrganImageSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

const SIZE_CONTAINER_CLASSES: Record<OrganImageSize, string> = {
  xs: 'w-5 h-5 min-w-[1.25rem] min-h-[1.25rem]',
  sm: 'w-8 h-8 min-w-[2rem] min-h-[2rem]',
  md: 'w-12 h-12 min-w-[3rem] min-h-[3rem]',
  lg: 'w-16 h-16 min-w-[4rem] min-h-[4rem]',
  xl: 'w-20 h-20 min-w-[5rem] min-h-[5rem]',
  '2xl': 'w-28 h-28 min-w-[7rem] min-h-[7rem]',
};

interface OrganImageProps {
  organ?: string | null;
  size?: OrganImageSize;
  className?: string;
  imageClassName?: string;
  alt?: string;
  showContainer?: boolean;
}

/**
 * Universal component to display transparent organ PNGs across Citizen, Hub, and Master Control portals.
 */
export default function OrganImage({
  organ,
  size = 'md',
  className = '',
  imageClassName = '',
  alt,
  showContainer = false,
}: OrganImageProps) {
  const imagePath = getOrganImagePath(organ);
  const isBlood = organ ? String(organ).toUpperCase().includes('BLOOD') : false;
  const sizeClass = SIZE_CONTAINER_CLASSES[size] || SIZE_CONTAINER_CLASSES.md;
  const organAlt = alt || (organ ? String(organ) : 'Organ Specimen');

  const content = imagePath ? (
    <img
      src={imagePath}
      alt={organAlt}
      className={`w-full h-full object-contain filter drop-shadow-xs select-none pointer-events-none transition-transform duration-200 ${imageClassName}`}
      loading="lazy"
    />
  ) : isBlood ? (
    <div className="w-full h-full flex items-center justify-center text-rose-500">
      <Droplet className="w-3/4 h-3/4 fill-rose-500/20" />
    </div>
  ) : (
    <div className="w-full h-full flex items-center justify-center text-rose-400">
      <Heart className="w-3/4 h-3/4 fill-rose-400/20" />
    </div>
  );

  if (!showContainer) {
    return <div className={`${sizeClass} inline-flex items-center justify-center shrink-0 ${className}`}>{content}</div>;
  }

  return (
    <div
      className={`${sizeClass} rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100/70 dark:from-slate-800/80 dark:to-slate-900/80 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-center p-1.5 shadow-2xs shrink-0 overflow-hidden ${className}`}
    >
      {content}
    </div>
  );
}
