'use client';
import React from 'react';
export interface BloodIconProps extends React.SVGProps<SVGSVGElement> {
    className?: string;
}
export function FindBloodIcon({ className = 'w-4 h-4', ...props }: BloodIconProps) {
    return (<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>

      <path d="M10 2C10 2 4 8.5 4 14a6.5 6.5 0 0 0 11.2 4.4" fill="currentColor" fillOpacity="0.18"/>
      <path d="M10 2c1.8 2.2 3.5 4.6 4.4 7.2"/>

      <circle cx="14" cy="11" r="4.5"/>
      <path d="m17.5 14.5 4 4"/>
    </svg>);
}
export function RequestBloodIcon({ className = 'w-4 h-4', ...props }: BloodIconProps) {
    return (<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>

      <path d="M12 2C12 2 8 6 8 9.5a4 4 0 0 0 8 0C16 6 12 2 12 2z" fill="currentColor" fillOpacity="0.2"/>

      <path d="M2 13.5h3.5a2 2 0 0 1 1.7 1l1.5 2.5c.5.8 1.4 1.3 2.3 1.3H12"/>

      <path d="M22 13.5h-3.5a2 2 0 0 0-1.7 1l-1.5 2.5c-.5.8-1.4 1.3-2.3 1.3H12"/>

      <path d="M4 17.5c2 2.5 4.8 3.8 8 3.8s6-1.3 8-3.8"/>
    </svg>);
}
export default FindBloodIcon;
