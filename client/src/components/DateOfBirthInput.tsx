'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Calendar } from 'lucide-react';

interface DateOfBirthInputProps {
  value: string; // ISO format: 'YYYY-MM-DD' or ''
  onChange: (isoValue: string) => void;
  required?: boolean;
}

export default function DateOfBirthInput({
  value,
  onChange,
  required = false,
}: DateOfBirthInputProps) {
  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');

  const dayRef = useRef<HTMLInputElement>(null);
  const monthRef = useRef<HTMLInputElement>(null);
  const yearRef = useRef<HTMLInputElement>(null);
  const nativePickerRef = useRef<HTMLInputElement>(null);

  // Sync internal state when external value changes (e.g. loaded from API)
  useEffect(() => {
    if (value && value.includes('-')) {
      const parts = value.split('-');
      if (parts.length === 3) {
        setYear(parts[0] || '');
        setMonth(parts[1] || '');
        setDay(parts[2] || '');
        return;
      }
    }
    if (!value) {
      setDay('');
      setMonth('');
      setYear('');
    }
  }, [value]);

  // Notify parent of valid ISO date or empty string
  const notifyChange = (d: string, m: string, y: string) => {
    if (d && m && y.length === 4) {
      const padD = d.padStart(2, '0');
      const padM = m.padStart(2, '0');
      const iso = `${y}-${padM}-${padD}`;
      const parsedDate = new Date(iso);
      if (!isNaN(parsedDate.getTime())) {
        onChange(iso);
        return;
      }
    }
    onChange('');
  };

  const handleDayChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 2);
    if (raw && Number(raw) > 31) return;
    setDay(raw);
    notifyChange(raw, month, year);

    // Auto-advance to month if 2 digits or user typed a digit that can't have a 2nd digit (> 3)
    if (raw.length === 2 || (raw.length === 1 && Number(raw) > 3)) {
      monthRef.current?.focus();
      monthRef.current?.select();
    }
  };

  const handleMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 2);
    if (raw && Number(raw) > 12) return;
    setMonth(raw);
    notifyChange(day, raw, year);

    // Auto-advance to year if 2 digits or user typed a digit that can't have a 2nd digit (> 1)
    if (raw.length === 2 || (raw.length === 1 && Number(raw) > 1)) {
      yearRef.current?.focus();
      yearRef.current?.select();
    }
  };

  const handleYearChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 4);
    setYear(raw);
    notifyChange(day, month, raw);
  };

  const handleKeyDown = (
    field: 'day' | 'month' | 'year',
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === 'Backspace') {
      if (field === 'month' && !month) {
        dayRef.current?.focus();
      } else if (field === 'year' && !year) {
        monthRef.current?.focus();
      }
    } else if (e.key === 'ArrowRight') {
      if (field === 'day' && dayRef.current?.selectionStart === day.length) {
        monthRef.current?.focus();
      } else if (field === 'month' && monthRef.current?.selectionStart === month.length) {
        yearRef.current?.focus();
      }
    } else if (e.key === 'ArrowLeft') {
      if (field === 'year' && yearRef.current?.selectionStart === 0) {
        monthRef.current?.focus();
      } else if (field === 'month' && monthRef.current?.selectionStart === 0) {
        dayRef.current?.focus();
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').trim();
    // Support formats: YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY
    let d = '', m = '', y = '';

    if (pasted.includes('-')) {
      const parts = pasted.split('-');
      if (parts[0].length === 4) {
        [y, m, d] = parts;
      } else {
        [d, m, y] = parts;
      }
    } else if (pasted.includes('/')) {
      const parts = pasted.split('/');
      if (parts[0].length === 4) {
        [y, m, d] = parts;
      } else {
        [d, m, y] = parts;
      }
    } else if (pasted.includes('.')) {
      const parts = pasted.split('.');
      [d, m, y] = parts;
    } else if (/^\d{8}$/.test(pasted)) {
      // 8 consecutive digits DDMMYYYY
      d = pasted.slice(0, 2);
      m = pasted.slice(2, 4);
      y = pasted.slice(4, 8);
    }

    if (d && m && y) {
      const cleanD = d.replace(/\D/g, '').slice(0, 2);
      const cleanM = m.replace(/\D/g, '').slice(0, 2);
      const cleanY = y.replace(/\D/g, '').slice(0, 4);
      setDay(cleanD);
      setMonth(cleanM);
      setYear(cleanY);
      notifyChange(cleanD, cleanM, cleanY);
      yearRef.current?.focus();
    }
  };

  const openCalendarPicker = () => {
    if (nativePickerRef.current) {
      if (typeof (nativePickerRef.current as any).showPicker === 'function') {
        (nativePickerRef.current as any).showPicker();
      } else {
        nativePickerRef.current.focus();
        nativePickerRef.current.click();
      }
    }
  };

  const handleNativePickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.value;
    if (picked && picked.includes('-')) {
      const [y, m, d] = picked.split('-');
      setYear(y);
      setMonth(m);
      setDay(d);
      onChange(picked);
    }
  };

  return (
    <div
      onClick={(e) => {
        // If clicking on background of container, focus the appropriate field
        if (e.target === e.currentTarget) {
          if (!day) dayRef.current?.focus();
          else if (!month) monthRef.current?.focus();
          else if (!year) yearRef.current?.focus();
          else dayRef.current?.focus();
        }
      }}
      className="relative flex items-center w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-medium focus-within:border-rose-500 focus-within:ring-1 focus-within:ring-rose-500/20 transition-all cursor-text"
    >
      {/* Hidden native input for calendar popover and form validation */}
      <input
        ref={nativePickerRef}
        type="date"
        tabIndex={-1}
        value={value}
        onChange={handleNativePickerChange}
        className="absolute bottom-0 left-0 w-0 h-0 opacity-0 pointer-events-none"
        aria-hidden="true"
      />

      {/* Hidden input for HTML form validation */}
      <input
        type="text"
        tabIndex={-1}
        required={required}
        value={value}
        onChange={() => {}}
        className="absolute bottom-0 left-0 w-0 h-0 opacity-0 pointer-events-none"
        aria-hidden="true"
      />

      {/* Segment: Day */}
      <input
        ref={dayRef}
        type="text"
        inputMode="numeric"
        maxLength={2}
        placeholder="dd"
        value={day}
        onChange={handleDayChange}
        onKeyDown={(e) => handleKeyDown('day', e)}
        onPaste={handlePaste}
        className={`w-7 text-center bg-transparent focus:outline-hidden font-medium placeholder:font-normal transition-colors placeholder:text-slate-400 dark:placeholder:text-slate-500 ${
          day ? 'text-slate-900 dark:text-white font-semibold' : 'text-slate-400 dark:text-slate-500'
        }`}
        aria-label="Day"
      />

      <span className="text-slate-300 dark:text-slate-600 select-none px-1 font-normal">/</span>

      {/* Segment: Month */}
      <input
        ref={monthRef}
        type="text"
        inputMode="numeric"
        maxLength={2}
        placeholder="mm"
        value={month}
        onChange={handleMonthChange}
        onKeyDown={(e) => handleKeyDown('month', e)}
        onPaste={handlePaste}
        className={`w-7 text-center bg-transparent focus:outline-hidden font-medium placeholder:font-normal transition-colors placeholder:text-slate-400 dark:placeholder:text-slate-500 ${
          month ? 'text-slate-900 dark:text-white font-semibold' : 'text-slate-400 dark:text-slate-500'
        }`}
        aria-label="Month"
      />

      <span className="text-slate-300 dark:text-slate-600 select-none px-1 font-normal">/</span>

      {/* Segment: Year */}
      <input
        ref={yearRef}
        type="text"
        inputMode="numeric"
        maxLength={4}
        placeholder="yyyy"
        value={year}
        onChange={handleYearChange}
        onKeyDown={(e) => handleKeyDown('year', e)}
        onPaste={handlePaste}
        className={`w-12 text-center bg-transparent focus:outline-hidden font-medium placeholder:font-normal transition-colors placeholder:text-slate-400 dark:placeholder:text-slate-500 ${
          year ? 'text-slate-900 dark:text-white font-semibold' : 'text-slate-400 dark:text-slate-500'
        }`}
        aria-label="Year"
      />

      {/* Calendar icon trigger */}
      <button
        type="button"
        tabIndex={-1}
        onClick={openCalendarPicker}
        className="ml-auto p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors cursor-pointer"
        title="Open calendar picker"
        aria-label="Open calendar picker"
      >
        <Calendar className="w-4 h-4" />
      </button>
    </div>
  );
}
