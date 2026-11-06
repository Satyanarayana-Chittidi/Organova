'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  campApi,
  BloodDonationCamp,
  CreateCampPayload,
  UpdateCampPayload,
} from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import {
  Calendar,
  Clock,
  MapPin,
  Building2,
  Users,
  Navigation,
  ExternalLink,
  Search,
  X,
  Phone,
  ArrowRight,
  Filter,
  Sparkles,
  ChevronDown,
  RefreshCw,
  Plus,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Activity,
  Layers,
  Radio,
  Edit3,
  LocateFixed,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';

export default function DonationCampsPage() {
  const { user } = useAuth();
  const isHospitalStaff = Boolean(user && ['HOSPITAL', 'ORGAN_BANK', 'BLOOD_BANK', 'ADMIN'].includes(user.role));

  const [camps, setCamps] = useState<BloodDonationCamp[]>([]);
  const [myHubCamps, setMyHubCamps] = useState<BloodDonationCamp[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCamp, setSelectedCamp] = useState<BloodDonationCamp | null>(null);
  const [currentDate, setCurrentDate] = useState<Date | null>(null);

  // Global Camps Page notifications (Success & Server Errors only; NEVER form validation errors)
  const [globalSuccess, setGlobalSuccess] = useState<string | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);

  // Schedule New Camp modal state
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [submittingSchedule, setSubmittingSchedule] = useState(false);
  const [scheduleModalError, setScheduleModalError] = useState<string | null>(null);
  const [scheduleInvalidFields, setScheduleInvalidFields] = useState<string[]>([]);
  const [isGeolocating, setIsGeolocating] = useState(false);

  // Edit Camp modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingCamp, setEditingCamp] = useState<BloodDonationCamp | null>(null);
  const [submittingEdit, setSubmittingEdit] = useState(false);
  const [editModalError, setEditModalError] = useState<string | null>(null);
  const [editInvalidFields, setEditInvalidFields] = useState<string[]>([]);
  const [isEditGeolocating, setIsEditGeolocating] = useState(false);

  const [formData, setFormData] = useState<CreateCampPayload>({
    camp_name: '',
    description: '',
    venue_name: '',
    address_line: '',
    city: '',
    state: '',
    pincode: '',
    camp_date: '',
    end_date: '',
    start_time: '09:00 AM',
    end_time: '05:00 PM',
    contact_phone: '',
    contact_email: '',
    target_units: 100,
    map_url: '',
    latitude: undefined,
    longitude: undefined,
    status: 'DRAFT',
  });

  const [editFormData, setEditFormData] = useState<UpdateCampPayload>({
    camp_name: '',
    description: '',
    venue_name: '',
    address_line: '',
    city: '',
    state: '',
    pincode: '',
    camp_date: '',
    end_date: '',
    start_time: '09:00 AM',
    end_time: '05:00 PM',
    contact_phone: '',
    contact_email: '',
    target_units: 100,
    map_url: '',
    latitude: undefined,
    longitude: undefined,
  });

  // Public Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCity, setSelectedCity] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'UPCOMING'>('ALL');
  const [timeFilter, setTimeFilter] = useState<'ALL' | 'TODAY' | 'THIS_WEEK' | 'THIS_MONTH'>('ALL');
  const [todayStr, setTodayStr] = useState<string>('');

  const fetchAllCampsData = async () => {
    try {
      const publicRes = await campApi.list();
      if (publicRes.success && Array.isArray(publicRes.data)) {
        setCamps(publicRes.data);
      }

      if (isHospitalStaff) {
        const hubRes = await campApi.getMyHubCamps();
        if (hubRes.success && Array.isArray(hubRes.data)) {
          setMyHubCamps(hubRes.data);
        }
      }
    } catch (err) {
      console.warn('[CAMPS] Failed to load camps:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const d = new Date();
    setCurrentDate(d);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    setTodayStr(`${year}-${month}-${day}`);
    fetchAllCampsData();
  }, [isHospitalStaff]);

  // Lock background body scroll when any modal is open
  useEffect(() => {
    const isAnyModalOpen = isScheduleModalOpen || isEditModalOpen || Boolean(selectedCamp);
    if (isAnyModalOpen) {
      const originalOverflow = document.body.style.overflow;
      const originalPaddingRight = document.body.style.paddingRight;
      const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;
      document.body.style.overflow = 'hidden';
      if (scrollBarWidth > 0) {
        document.body.style.paddingRight = `${scrollBarWidth}px`;
      }
      return () => {
        document.body.style.overflow = originalOverflow;
        document.body.style.paddingRight = originalPaddingRight;
      };
    }
  }, [isScheduleModalOpen, isEditModalOpen, selectedCamp]);

  const handleRefresh = () => {
    setRefreshing(true);
    setGlobalError(null);
    setGlobalSuccess(null);
    fetchAllCampsData();
  };

  // Helper to parse time strings like "09:00 AM" into minutes from midnight
  const parseTimeToMinutes = (timeStr?: string | null): number | null => {
    if (!timeStr) return null;
    const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
    if (!match) return null;
    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const meridiem = match[3]?.toUpperCase();
    if (meridiem === 'PM' && hours < 12) hours += 12;
    if (meridiem === 'AM' && hours === 12) hours = 0;
    return hours * 60 + minutes;
  };

  // Helper to convert 12-hour format "09:00 AM" to 24-hour "09:00" for standard HTML5 time inputs
  const to24Hour = (time12?: string | null): string => {
    if (!time12) return '09:00';
    const match = time12.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
    if (!match) return time12;
    let hours = parseInt(match[1], 10);
    const minutes = match[2];
    const meridiem = match[3]?.toUpperCase();
    if (meridiem === 'PM' && hours < 12) hours += 12;
    if (meridiem === 'AM' && hours === 12) hours = 0;
    return `${String(hours).padStart(2, '0')}:${minutes}`;
  };

  // Helper to convert 24-hour "HH:mm" from HTML5 time input to 12-hour "hh:mm AM/PM"
  const to12Hour = (time24?: string | null): string => {
    if (!time24) return '09:00 AM';
    const match = time24.trim().match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return time24;
    let hours = parseInt(match[1], 10);
    const minutes = match[2];
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
  };

  // Check if a date string is fully entered (YYYY-MM-DD) and not a partial keystroke
  const isCompleteDate = (d?: string | null): boolean => {
    if (!d) return false;
    const clean = d.split('T')[0].trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(clean)) return false;
    const year = parseInt(clean.substring(0, 4), 10);
    return year >= 2000 && year <= 2100;
  };

  // Date and Time validation function
  const validateDates = (
    startDate: string,
    endDate?: string | null,
    startTime?: string | null,
    endTime?: string | null
  ): string | null => {
    if (!startDate) return 'Start date is required.';

    const cleanStart = startDate.split('T')[0];

    // Only validate past date once start date is fully typed (YYYY-MM-DD)
    if (isCompleteDate(startDate)) {
      const now = new Date();
      const curYear = now.getFullYear();
      const curMonth = String(now.getMonth() + 1).padStart(2, '0');
      const curDay = String(now.getDate()).padStart(2, '0');
      const currentDayStr = `${curYear}-${curMonth}-${curDay}`;

      if (cleanStart < currentDayStr) {
        return `Camp date cannot be in the past (${cleanStart}). Please select today or a future date.`;
      }

      if (cleanStart === currentDayStr && startTime) {
        const startMins = parseTimeToMinutes(startTime);
        const currentMins = now.getHours() * 60 + now.getMinutes();
        if (startMins !== null && startMins < currentMins) {
          return `Start time (${startTime}) is already in the past for today. Please pick an upcoming time.`;
        }
      }

      // Check end date only after the user has completely entered the date field (not while partially typing)
      if (endDate && isCompleteDate(endDate)) {
        const cleanEnd = endDate.split('T')[0];
        if (cleanEnd < cleanStart) {
          return `End date (${cleanEnd}) cannot be earlier than start date (${cleanStart}).`;
        }

        if (cleanEnd === cleanStart && startTime && endTime) {
          const startMins = parseTimeToMinutes(startTime);
          const endMins = parseTimeToMinutes(endTime);
          if (startMins !== null && endMins !== null && endMins <= startMins) {
            return `End time (${endTime}) must be after start time (${startTime}).`;
          }
        }
      }
    }

    return null;
  };

  // Geolocation: Fetch organizer's current GPS location
  const handleGetDeviceLocation = (target: 'create' | 'edit') => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }

    if (target === 'create') setIsGeolocating(true);
    else setIsEditGeolocating(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = parseFloat(position.coords.latitude.toFixed(6));
        const lng = parseFloat(position.coords.longitude.toFixed(6));
        const mapsLink = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

        if (target === 'create') {
          setFormData((prev) => ({
            ...prev,
            latitude: lat,
            longitude: lng,
            map_url: prev.map_url || mapsLink,
          }));
          setIsGeolocating(false);
        } else {
          setEditFormData((prev) => ({
            ...prev,
            latitude: lat,
            longitude: lng,
            map_url: prev.map_url || mapsLink,
          }));
          setIsEditGeolocating(false);
        }
      },
      (error) => {
        console.warn('Geolocation error:', error);
        alert('Could not retrieve your location. Please ensure location permissions are granted.');
        if (target === 'create') setIsGeolocating(false);
        else setIsEditGeolocating(false);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  const handleCreateInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;

    // After a warning, if the field has been filled/typed by the user, clear the red border and warning immediately
    if (scheduleInvalidFields.includes(name)) {
      setScheduleInvalidFields((prev) => prev.filter((f) => f !== name));
      setScheduleModalError(null);
    }

    setFormData((prev) => {
      const updated = {
        ...prev,
        [name]: name === 'target_units' ? (value ? parseInt(value, 10) : undefined) : value,
      };

      // As soon as the start date is entered, it should be copied to end date (single day camp default)
      if (name === 'camp_date') {
        updated.end_date = value;
      }

      if (name === 'camp_date' || name === 'end_date' || name === 'start_time' || name === 'end_time') {
        const dateErr = validateDates(
          name === 'camp_date' ? value : updated.camp_date,
          name === 'end_date' ? value : updated.end_date,
          name === 'start_time' ? value : updated.start_time,
          name === 'end_time' ? value : updated.end_time
        );
        if (dateErr) {
          setScheduleModalError(dateErr);
          setScheduleInvalidFields((prev) => (prev.includes(name) ? prev : [...prev, name]));
        } else {
          // As soon as the condition is satisfied, the warning disappears immediately
          setScheduleModalError(null);
          setScheduleInvalidFields((prev) => prev.filter((f) => f !== 'camp_date' && f !== 'end_date' && f !== 'start_time' && f !== 'end_time'));
        }
      }

      return updated;
    });
  };

  const handleEditInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;

    // After a warning, if the field has been filled/typed by the user, clear the red border and warning immediately
    if (editInvalidFields.includes(name)) {
      setEditInvalidFields((prev) => prev.filter((f) => f !== name));
      setEditModalError(null);
    }

    setEditFormData((prev) => {
      const updated = {
        ...prev,
        [name]: name === 'target_units' ? (value ? parseInt(value, 10) : undefined) : value,
      };

      // As soon as the start date is entered, it should be copied to end date (single day camp default)
      if (name === 'camp_date') {
        updated.end_date = value;
      }

      if (name === 'camp_date' || name === 'end_date' || name === 'start_time' || name === 'end_time') {
        const dateErr = validateDates(
          name === 'camp_date' ? value : (updated.camp_date || ''),
          name === 'end_date' ? value : updated.end_date,
          name === 'start_time' ? value : updated.start_time,
          name === 'end_time' ? value : updated.end_time
        );
        if (dateErr) {
          setEditModalError(dateErr);
          setEditInvalidFields((prev) => (prev.includes(name) ? prev : [...prev, name]));
        } else {
          // As soon as the condition is satisfied, the warning disappears immediately
          setEditModalError(null);
          setEditInvalidFields((prev) => prev.filter((f) => f !== 'camp_date' && f !== 'end_date' && f !== 'start_time' && f !== 'end_time'));
        }
      }

      return updated;
    });
  };

  const handleDateBlur = (target: 'create' | 'edit', field: 'camp_date' | 'end_date') => {
    const curStart = target === 'create' ? formData.camp_date : (editFormData.camp_date || '');
    const curEnd = target === 'create' ? formData.end_date : editFormData.end_date;
    const curStartTime = target === 'create' ? formData.start_time : editFormData.start_time;
    const curEndTime = target === 'create' ? formData.end_time : editFormData.end_time;

    const dateErr = validateDates(curStart, curEnd, curStartTime, curEndTime);
    if (dateErr) {
      if (target === 'create') {
        setScheduleModalError(dateErr);
        setScheduleInvalidFields((prev) => (prev.includes(field) ? prev : [...prev, field]));
      } else {
        setEditModalError(dateErr);
        setEditInvalidFields((prev) => (prev.includes(field) ? prev : [...prev, field]));
      }
    }
  };

  const handleCreateCamp = async (status: 'DRAFT' | 'UPCOMING') => {
    setScheduleModalError(null);

    // Identify unfilled mandatory fields and highlight in red
    const emptyFields: string[] = [];
    if (!formData.camp_name?.trim()) emptyFields.push('camp_name');
    if (!formData.venue_name?.trim()) emptyFields.push('venue_name');
    if (!formData.address_line?.trim()) emptyFields.push('address_line');
    if (!formData.city?.trim()) emptyFields.push('city');
    if (!formData.camp_date?.trim()) emptyFields.push('camp_date');
    if (!formData.contact_phone?.trim()) emptyFields.push('contact_phone');

    if (emptyFields.length > 0) {
      setScheduleInvalidFields(emptyFields);
      setScheduleModalError('Please fill in all mandatory fields highlighted in red.');
      return;
    }

    // Validate future dates & timestamps
    const dateErr = validateDates(formData.camp_date, formData.end_date, formData.start_time, formData.end_time);
    if (dateErr) {
      setScheduleInvalidFields((prev) => (prev.includes('camp_date') ? prev : [...prev, 'camp_date']));
      setScheduleModalError(dateErr);
      return;
    }

    setSubmittingSchedule(true);

    try {
      await campApi.create({
        ...formData,
        end_date: formData.end_date || formData.camp_date,
        status,
      });

      if (status === 'UPCOMING') {
        setGlobalSuccess('Blood donation camp scheduled and broadcasted live across the platform!');
      } else {
        setGlobalSuccess('Blood donation camp saved as draft. You can edit details anytime and broadcast when ready.');
      }

      setIsScheduleModalOpen(false);
      setFormData({
        camp_name: '',
        description: '',
        venue_name: '',
        address_line: '',
        city: '',
        state: '',
        pincode: '',
        camp_date: '',
        end_date: '',
        start_time: '09:00 AM',
        end_time: '05:00 PM',
        contact_phone: '',
        contact_email: '',
        target_units: 100,
        map_url: '',
        latitude: undefined,
        longitude: undefined,
        status: 'DRAFT',
      });
      setScheduleModalError(null);
      setScheduleInvalidFields([]);
      await fetchAllCampsData();
    } catch (err: any) {
      setScheduleModalError(err.message || 'Failed to schedule camp.');
    } finally {
      setSubmittingSchedule(false);
    }
  };

  const handleOpenEditModal = (camp: BloodDonationCamp) => {
    setEditingCamp(camp);
    setEditFormData({
      camp_name: camp.camp_name,
      description: camp.description || '',
      venue_name: camp.venue_name,
      address_line: camp.address_line,
      city: camp.city,
      state: camp.state || '',
      pincode: camp.pincode || '',
      camp_date: camp.camp_date ? camp.camp_date.split('T')[0] : '',
      end_date: camp.end_date ? camp.end_date.split('T')[0] : '',
      start_time: camp.start_time,
      end_time: camp.end_time,
      contact_phone: camp.contact_phone || '',
      contact_email: camp.contact_email || '',
      target_units: camp.target_units || 100,
      map_url: camp.map_url || '',
      latitude: camp.latitude || undefined,
      longitude: camp.longitude || undefined,
      status: camp.status,
    });
    setEditModalError(null);
    setEditInvalidFields([]);
    setIsEditModalOpen(true);
  };

  const handleUpdateCamp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCamp) return;

    setEditModalError(null);

    // Identify unfilled mandatory fields and highlight in red
    const emptyFields: string[] = [];
    if (!editFormData.camp_name?.trim()) emptyFields.push('camp_name');
    if (!editFormData.venue_name?.trim()) emptyFields.push('venue_name');
    if (!editFormData.address_line?.trim()) emptyFields.push('address_line');
    if (!editFormData.city?.trim()) emptyFields.push('city');
    if (!editFormData.camp_date?.trim()) emptyFields.push('camp_date');
    if (!editFormData.contact_phone?.trim()) emptyFields.push('contact_phone');

    if (emptyFields.length > 0) {
      setEditInvalidFields(emptyFields);
      setEditModalError('Please fill in all mandatory fields highlighted in red.');
      return;
    }

    // Validate future dates & timestamps
    const dateErr = validateDates(
      editFormData.camp_date || '',
      editFormData.end_date,
      editFormData.start_time,
      editFormData.end_time
    );
    if (dateErr) {
      setEditInvalidFields((prev) => (prev.includes('camp_date') ? prev : [...prev, 'camp_date']));
      setEditModalError(dateErr);
      return;
    }

    setSubmittingEdit(true);

    try {
      await campApi.update(editingCamp.id, {
        ...editFormData,
        end_date: editFormData.end_date || editFormData.camp_date,
      });

      setGlobalSuccess(`Camp "${editFormData.camp_name}" updated successfully.`);
      setIsEditModalOpen(false);
      setEditingCamp(null);
      setEditModalError(null);
      setEditInvalidFields([]);
      await fetchAllCampsData();
    } catch (err: any) {
      setEditModalError(err.message || 'Failed to update camp details.');
    } finally {
      setSubmittingEdit(false);
    }
  };

  const handleStatusChange = async (
    campId: number,
    newStatus: 'DRAFT' | 'UPCOMING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED'
  ) => {
    try {
      await campApi.updateStatus(campId, newStatus);
      if (newStatus === 'UPCOMING') {
        setGlobalSuccess('Camp broadcasted! It is now live and visible to all citizens and donors.');
      } else if (newStatus === 'CANCELLED') {
        setGlobalSuccess('Camp cancelled.');
      } else if (newStatus === 'DRAFT') {
        setGlobalSuccess('Camp reverted back to Draft. It is now private and can be edited.');
      } else {
        setGlobalSuccess(`Camp status updated to ${newStatus}.`);
      }

      if (selectedCamp && selectedCamp.id === campId) {
        setSelectedCamp((prev) => (prev ? { ...prev, status: newStatus } : null));
      }
      await fetchAllCampsData();
    } catch (err: any) {
      setGlobalError(err.message || 'Failed to update camp status.');
    }
  };

  // Revert to Draft action: unpublishes camp from public platform back to draft for editing
  const handleRevokeToDraft = async (camp: BloodDonationCamp) => {
    const confirmed = confirm(
      `Revert "${camp.camp_name}" to Draft?\n\nThis will unpublish the camp from public citizen view so you can edit details before broadcasting again.`
    );
    if (!confirmed) return;
    await handleStatusChange(camp.id, 'DRAFT');
  };

  // Helper to determine the precise turn-by-turn navigation URL for a camp
  const getCampNavigateUrl = (camp: BloodDonationCamp) => {
    if (camp.map_url && camp.map_url.trim()) {
      return camp.map_url.trim();
    }
    if (camp.latitude && camp.longitude) {
      return `https://www.google.com/maps/dir/?api=1&destination=${camp.latitude},${camp.longitude}`;
    }
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
      `${camp.venue_name}, ${camp.address_line}, ${camp.city}`
    )}`;
  };

  // Extract unique cities for the city filter dropdown and pills
  const availableCities = useMemo(() => {
    const set = new Set<string>();
    camps.forEach((c) => {
      if (c.city) set.add(c.city.trim());
    });
    return Array.from(set).sort();
  }, [camps]);

  // Filtered public community camps
  const filteredCamps = useMemo(() => {
    let todayCompare = '';
    let startOfWeek: Date | null = null;
    let endOfWeek: Date | null = null;
    let startOfMonth: Date | null = null;
    let endOfMonth: Date | null = null;

    if (currentDate) {
      todayCompare = currentDate.toISOString().split('T')[0];
      startOfWeek = new Date(currentDate);
      startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
      endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 7);

      startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    }

    return camps.filter((camp) => {
      // 1. City Filter
      if (selectedCity !== 'ALL' && camp.city?.toLowerCase() !== selectedCity.toLowerCase()) {
        return false;
      }

      // 2. Status Filter
      if (statusFilter !== 'ALL' && camp.status !== statusFilter) {
        return false;
      }

      // 3. Time Filter
      if (timeFilter !== 'ALL' && currentDate) {
        const campDateStr = camp.camp_date.split('T')[0];
        const campDate = new Date(camp.camp_date);

        if (timeFilter === 'TODAY' && campDateStr !== todayCompare) {
          return false;
        }
        if (timeFilter === 'THIS_WEEK' && startOfWeek && endOfWeek && (campDate < startOfWeek || campDate > endOfWeek)) {
          return false;
        }
        if (timeFilter === 'THIS_MONTH' && startOfMonth && endOfMonth && (campDate < startOfMonth || campDate > endOfMonth)) {
          return false;
        }
      }

      // 4. Text Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = camp.camp_name?.toLowerCase().includes(q);
        const matchesVenue = camp.venue_name?.toLowerCase().includes(q);
        const matchesCity = camp.city?.toLowerCase().includes(q);
        const matchesState = camp.state?.toLowerCase().includes(q);
        const matchesAddress = camp.address_line?.toLowerCase().includes(q);
        const matchesHub = camp.organizer_hub_name?.toLowerCase().includes(q);

        if (!matchesName && !matchesVenue && !matchesCity && !matchesState && !matchesAddress && !matchesHub) {
          return false;
        }
      }

      return true;
    });
  }, [camps, selectedCity, statusFilter, timeFilter, searchQuery, currentDate]);

  const hasActiveFilters = selectedCity !== 'ALL' || statusFilter !== 'ALL' || timeFilter !== 'ALL' || searchQuery.trim() !== '';

  const handleResetFilters = () => {
    setSelectedCity('ALL');
    setStatusFilter('ALL');
    setTimeFilter('ALL');
    setSearchQuery('');
  };

  const formatDate = (dateStr: string) => {
    try {
      const parts = dateStr.split('T')[0].split('-');
      if (parts.length === 3) {
        const year = parts[0];
        const monthIndex = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${months[monthIndex] || parts[1]} ${day}, ${year}`;
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  const formatDateRange = (startDateStr: string, endDateStr?: string | null) => {
    const start = formatDate(startDateStr);
    if (!endDateStr || endDateStr.split('T')[0] === startDateStr.split('T')[0]) {
      return start;
    }
    const end = formatDate(endDateStr);
    return `${start} – ${end}`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            <Edit3 className="w-3 h-3" /> Draft (Unpublished)
          </span>
        );
      case 'UPCOMING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
            <Calendar className="w-3 h-3" /> Upcoming
          </span>
        );
      case 'ACTIVE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Active Now
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            <CheckCircle2 className="w-3 h-3 text-slate-500" /> Completed
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
            <AlertCircle className="w-3 h-3 text-rose-500" /> Cancelled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-in fade-in duration-300">
      {/* 1. PAGE HEADER & INTRO */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 text-xs font-bold uppercase tracking-wider mb-2">
            <Calendar className="w-3.5 h-3.5 text-purple-500" />
            <span>Community Outreach</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Voluntary Blood Donation Camps
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-2xl mt-1">
            {isHospitalStaff
              ? 'Schedule, broadcast, and manage your facility blood drives while monitoring all community camps.'
              : 'Locate voluntary blood donation drives in your city. View operating timings, associated hospital hubs, and get direct turn-by-turn navigation.'}
          </p>
        </div>

        {/* Top Action Bar */}
        <div className="flex items-center gap-3 shrink-0 flex-wrap">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 text-xs font-bold shadow-2xs hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          {isHospitalStaff && (
            <button
              type="button"
              onClick={() => {
                setScheduleModalError(null);
                setScheduleInvalidFields([]);
                setIsScheduleModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white text-xs font-bold shadow-md shadow-rose-600/20 transition-all cursor-pointer hover:scale-[1.02] active:scale-95"
            >
              <Plus className="w-4 h-4" />
              Schedule New Camp
            </button>
          )}
        </div>
      </div>

      {/* Global Alerts on Camps Page (Success & Server Errors Only; never form validation) */}
      {globalSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between gap-3 text-emerald-800 dark:text-emerald-300 text-xs font-semibold animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>{globalSuccess}</span>
          </div>
          <button type="button" onClick={() => setGlobalSuccess(null)} className="p-1 hover:opacity-75 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {globalError && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex items-center justify-between gap-3 text-rose-800 dark:text-rose-300 text-xs font-semibold animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
            <span>{globalError}</span>
          </div>
          <button type="button" onClick={() => setGlobalError(null)} className="p-1 hover:opacity-75 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 2. TOP SECTION FOR HOSPITALS: Camps organized by current hospital (ONLY shown if at least 1 exists) */}
      {isHospitalStaff && myHubCamps.length > 0 && (
        <section className="p-6 sm:p-7 rounded-3xl bg-rose-50/60 dark:bg-slate-900/70 border border-rose-200/80 dark:border-rose-950/80 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-rose-200/60 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-rose-600 text-white flex items-center justify-center shadow-xs">
                <Building2 className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                  Camps Organized by Your Medical Hub
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {myHubCamps[0]?.organizer_hub_name || 'Your Facility'} • {myHubCamps.length} registered drive{myHubCamps.length > 1 ? 's' : ''}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {myHubCamps.map((camp) => (
              <div
                key={camp.id}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 hover:border-rose-300 dark:hover:border-rose-900/60 shadow-xs flex flex-col justify-between overflow-hidden"
              >
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3 mb-2.5">
                    {getStatusBadge(camp.status)}
                    {camp.target_units && (
                      <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                        <Users className="w-3 h-3 text-rose-500" />
                        Target: {camp.target_units}
                      </span>
                    )}
                  </div>

                  <h3 className="text-base font-bold text-slate-900 dark:text-white line-clamp-1">
                    {camp.camp_name}
                  </h3>

                  <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-1">
                    {camp.description || 'Voluntary blood donation drive organized by our clinical team.'}
                  </p>

                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {formatDateRange(camp.camp_date, camp.end_date)}
                      </span>
                      <span className="text-slate-400">•</span>
                      <span className="text-slate-500 dark:text-slate-400">{camp.start_time} - {camp.end_time}</span>
                    </div>

                    <div className="flex items-start gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                      <span className="line-clamp-1 font-medium text-slate-700 dark:text-slate-300">
                        {camp.venue_name}, {camp.city}
                      </span>
                    </div>
                  </div>

                  {camp.status === 'DRAFT' && (
                    <div className="mt-3 p-2.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/40 text-[11px] text-amber-800 dark:text-amber-300 flex items-start gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                      <span>Drive is in Draft mode (private). Edit details below or click Broadcast to make it visible to public.</span>
                    </div>
                  )}
                </div>

                <div className="px-3.5 sm:px-4 py-2.5 bg-slate-50 dark:bg-slate-950/40 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-1.5">
                  {/* Left: View Details */}
                  <div className="shrink-0">
                    <button
                      type="button"
                      onClick={() => setSelectedCamp(camp)}
                      className="text-[11px] sm:text-xs font-bold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer whitespace-nowrap"
                    >
                      View Details
                    </button>
                  </div>

                  {/* Center: Broadcast / Revert to Draft & Edit buttons (Always side by side) */}
                  <div className="flex items-center justify-center gap-1.5 shrink-0 flex-nowrap">
                    {/* Broadcast button for Draft drives */}
                    {camp.status === 'DRAFT' && (
                      <button
                        type="button"
                        onClick={() => handleStatusChange(camp.id, 'UPCOMING')}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors cursor-pointer shadow-2xs whitespace-nowrap shrink-0"
                        title="Broadcast drive to make it visible to all users"
                      >
                        <Radio className="w-3 h-3 shrink-0" />
                        <span>Broadcast</span>
                      </button>
                    )}

                    {/* Revert to Draft button for live Upcoming or Active drives */}
                    {['UPCOMING', 'ACTIVE'].includes(camp.status) && (
                      <button
                        type="button"
                        onClick={() => handleRevokeToDraft(camp)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold bg-amber-50 hover:bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-900/60 transition-colors cursor-pointer border border-amber-200 dark:border-amber-800 whitespace-nowrap shrink-0"
                        title="Revert drive back to Draft mode to unpublish and edit"
                      >
                        <RotateCcw className="w-3 h-3 shrink-0" />
                        <span>Revert to Draft</span>
                      </button>
                    )}

                    {/* Edit button for Draft and Upcoming drives */}
                    {['DRAFT', 'UPCOMING'].includes(camp.status) && (
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(camp)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                        title="Edit camp information"
                      >
                        <Edit3 className="w-3 h-3 shrink-0" />
                        <span>Edit</span>
                      </button>
                    )}
                  </div>

                  {/* Right: Cancel button */}
                  <div className="shrink-0 flex items-center justify-end">
                    {['DRAFT', 'UPCOMING', 'ACTIVE'].includes(camp.status) && (
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Are you sure you want to cancel the camp "${camp.camp_name}"?`)) {
                            handleStatusChange(camp.id, 'CANCELLED');
                          }
                        }}
                        className="px-2 py-1 rounded-lg text-[11px] font-bold text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40 transition-colors cursor-pointer whitespace-nowrap"
                        title="Cancel camp"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 3. UNDER THAT: ALL EXISTING CAMPS (Available to both users and hospitals with location filter) */}
      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
              {isHospitalStaff && myHubCamps.length > 0 ? 'All Regional Community Camps' : 'Upcoming & Active Blood Drives'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Browse all voluntary blood donation camps across cities with direct venue navigation.
            </p>
          </div>

          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Showing <span className="font-bold text-slate-900 dark:text-white">{filteredCamps.length}</span> camps
            {selectedCity !== 'ALL' && (
              <span> in <strong className="text-rose-600 dark:text-rose-400">{selectedCity}</strong></span>
            )}
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-3">
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by camp name, venue, city, or organizing hospital..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-9 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/60 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-rose-500 transition-all placeholder:text-slate-400"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* City Dropdown & Reset */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="relative">
                <select
                  value={selectedCity}
                  onChange={(e) => setSelectedCity(e.target.value)}
                  className="appearance-none pl-8 pr-8 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/60 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-rose-500 cursor-pointer"
                >
                  <option value="ALL">All Cities ({availableCities.length})</option>
                  {availableCities.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <MapPin className="w-3.5 h-3.5 text-rose-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="px-3 py-2 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors cursor-pointer"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Quick Filter Tabs: Status & Timeframe */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1 flex items-center gap-1">
              <Filter className="w-3 h-3" /> Status:
            </span>

            {(['ALL', 'ACTIVE', 'UPCOMING'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  statusFilter === st
                    ? 'bg-rose-600 text-white shadow-2xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {st === 'ALL' ? 'All Status' : st === 'ACTIVE' ? 'Active Now' : 'Upcoming'}
              </button>
            ))}

            <span className="w-px h-3.5 bg-slate-200 dark:bg-slate-800 mx-1 hidden sm:inline-block"></span>

            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1 flex items-center gap-1">
              <Clock className="w-3 h-3" /> Timeframe:
            </span>

            {(['ALL', 'TODAY', 'THIS_WEEK', 'THIS_MONTH'] as const).map((tf) => (
              <button
                key={tf}
                type="button"
                onClick={() => setTimeFilter(tf)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  timeFilter === tf
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-2xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {tf === 'ALL' ? 'Anytime' : tf === 'TODAY' ? 'Today' : tf === 'THIS_WEEK' ? 'This Week' : 'This Month'}
              </button>
            ))}
          </div>

          {/* City Quick Pills */}
          {availableCities.length > 0 && (
            <div className="flex items-center gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800 overflow-x-auto scrollbar-none pb-1">
              <span className="text-[11px] font-semibold text-slate-400 shrink-0">Popular Cities:</span>
              <button
                type="button"
                onClick={() => setSelectedCity('ALL')}
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold shrink-0 transition-colors cursor-pointer ${
                  selectedCity === 'ALL'
                    ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                All
              </button>
              {availableCities.slice(0, 8).map((city) => (
                <button
                  key={city}
                  type="button"
                  onClick={() => setSelectedCity(city)}
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold shrink-0 transition-colors cursor-pointer ${
                    selectedCity === city
                      ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {city}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Camp Cards Grid */}
        {loading ? (
          <div className="py-16 text-center text-slate-400 space-y-3">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-rose-500 opacity-60" />
            <p className="text-xs font-semibold">Loading blood donation camps...</p>
          </div>
        ) : filteredCamps.length === 0 ? (
          <div className="p-12 text-center rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-500 mx-auto flex items-center justify-center">
              <Calendar className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                No Camps Found
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                {hasActiveFilters
                  ? 'No donation camps match your filter criteria. Try resetting city or timeframe filters.'
                  : 'There are currently no active or upcoming blood donation drives scheduled. Please check back soon.'}
              </p>
            </div>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCamps.map((camp) => (
              <div
                key={camp.id}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-xs hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group"
              >
                <div className="p-5 sm:p-6 space-y-4">
                  {/* Top Header: Badge & Target Volume */}
                  <div className="flex items-center justify-between gap-2">
                    {getStatusBadge(camp.status)}
                    {camp.target_units && (
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-rose-500" />
                        Target: {camp.target_units}
                      </span>
                    )}
                  </div>

                  {/* Camp Name & Description */}
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors line-clamp-1">
                      {camp.camp_name}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-1">
                      {camp.description || 'Voluntary community blood donation drive organized with certified phlebotomists and medical personnel.'}
                    </p>
                  </div>

                  {/* Associated Hub */}
                  <div className="p-3 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/80 flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                      <Building2 className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                        {camp.organizer_hub_name || 'Verified Medical Facility'}
                      </p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 capitalize">
                        {camp.organizer_hub_type?.toLowerCase() || 'Hospital'} • {camp.organizer_hub_city || camp.city}
                      </p>
                    </div>
                  </div>

                  {/* Date, Timings & Venue Details */}
                  <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-rose-500 shrink-0" />
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {formatDateRange(camp.camp_date, camp.end_date)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-blue-500 shrink-0" />
                      <span>{camp.start_time} - {camp.end_time}</span>
                    </div>

                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                      <span className="line-clamp-1 font-medium text-slate-700 dark:text-slate-300">
                        {camp.venue_name}, {camp.address_line}, {camp.city}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Footer: View Details & Turn-by-Turn Navigation */}
                <div className="px-5 sm:px-6 py-3.5 bg-slate-50/70 dark:bg-slate-950/40 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedCamp(camp)}
                    className="inline-flex items-center gap-1 text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer"
                  >
                    View Details
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>

                  <a
                    href={getCampNavigateUrl(camp)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                    title="Navigate via Google Maps"
                  >
                    <Navigation className="w-3.5 h-3.5 fill-current" />
                    Navigate
                    <ExternalLink className="w-3 h-3 opacity-70" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 4. SCHEDULE NEW CAMP MODAL (For Hospitals) */}
      {isScheduleModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-slate-950/70 backdrop-blur-xs flex justify-center items-start p-3 sm:p-6 py-6 sm:py-10 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh] my-auto sm:my-0 animate-in zoom-in-95">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 pb-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center shadow-xs">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Schedule Blood Donation Camp
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Host a voluntary blood drive. Save as Draft or Broadcast live.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsScheduleModalOpen(false);
                  setScheduleModalError(null);
                  setScheduleInvalidFields([]);
                }}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form
              id="schedule-camp-form"
              onSubmit={(e) => {
                e.preventDefault();
                handleCreateCamp('UPCOMING');
              }}
              className="p-5 sm:p-6 overflow-y-auto overscroll-contain flex-1 space-y-4 text-xs"
            >
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Camp Name / Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  name="camp_name"
                  placeholder="e.g. City Central Voluntary Blood Donation Drive"
                  value={formData.camp_name}
                  onChange={handleCreateInputChange}
                  className={`w-full px-3.5 py-2.5 text-sm rounded-xl border bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden transition-all ${
                    scheduleInvalidFields.includes('camp_name')
                      ? 'border-rose-500 ring-2 ring-rose-500/20 dark:border-rose-500 dark:ring-rose-500/20'
                      : 'border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-rose-500'
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Description & Donor Guidelines
                </label>
                <textarea
                  name="description"
                  rows={2}
                  placeholder="Eligibility details, hydration facilities, attending physicians, target beneficiaries..."
                  value={formData.description}
                  onChange={handleCreateInputChange}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Venue Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="venue_name"
                    placeholder="e.g. Town Hall Auditorium / College Foyer"
                    value={formData.venue_name}
                    onChange={handleCreateInputChange}
                    className={`w-full px-3.5 py-2.5 text-sm rounded-xl border bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden transition-all ${
                      scheduleInvalidFields.includes('venue_name')
                        ? 'border-rose-500 ring-2 ring-rose-500/20 dark:border-rose-500 dark:ring-rose-500/20'
                        : 'border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-rose-500'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Address Line <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="address_line"
                    placeholder="e.g. Near Metro Pillar 104, MG Road"
                    value={formData.address_line}
                    onChange={handleCreateInputChange}
                    className={`w-full px-3.5 py-2.5 text-sm rounded-xl border bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden transition-all ${
                      scheduleInvalidFields.includes('address_line')
                        ? 'border-rose-500 ring-2 ring-rose-500/20 dark:border-rose-500 dark:ring-rose-500/20'
                        : 'border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-rose-500'
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    City <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="city"
                    placeholder="e.g. Hyderabad"
                    value={formData.city}
                    onChange={handleCreateInputChange}
                    className={`w-full px-3.5 py-2.5 text-sm rounded-xl border bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden transition-all ${
                      scheduleInvalidFields.includes('city')
                        ? 'border-rose-500 ring-2 ring-rose-500/20 dark:border-rose-500 dark:ring-rose-500/20'
                        : 'border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-rose-500'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    State
                  </label>
                  <input
                    type="text"
                    name="state"
                    placeholder="e.g. Telangana"
                    value={formData.state}
                    onChange={handleCreateInputChange}
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-rose-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Target Units
                  </label>
                  <input
                    type="number"
                    name="target_units"
                    min="10"
                    max="5000"
                    placeholder="e.g. 150"
                    value={formData.target_units || ''}
                    onChange={handleCreateInputChange}
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              </div>

              {/* Camp Date Range Section with strict Future Date Validation */}
              <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                    <Calendar className="w-3.5 h-3.5 text-rose-500" />
                    Camp Date & Schedule
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Past dates prohibited • Today onwards
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Start Date <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      name="camp_date"
                      min={todayStr}
                      value={formData.camp_date}
                      onChange={handleCreateInputChange}
                      onBlur={() => handleDateBlur('create', 'camp_date')}
                      className={`w-full px-3 py-2 text-sm rounded-xl border bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden transition-all ${
                        scheduleInvalidFields.includes('camp_date')
                          ? 'border-rose-500 ring-2 ring-rose-500/20 dark:border-rose-500 dark:ring-rose-500/20'
                          : 'border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-rose-500'
                      }`}
                    />
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                      Sets single-day camp by default
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      End Date <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      name="end_date"
                      min={formData.camp_date || todayStr}
                      value={formData.end_date || formData.camp_date}
                      onChange={handleCreateInputChange}
                      onBlur={() => handleDateBlur('create', 'end_date')}
                      className={`w-full px-3 py-2 text-sm rounded-xl border bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden transition-all ${
                        scheduleInvalidFields.includes('end_date')
                          ? 'border-rose-500 ring-2 ring-rose-500/20 dark:border-rose-500 dark:ring-rose-500/20'
                          : 'border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-rose-500'
                      }`}
                    />
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                      {formData.camp_date && formData.end_date && formData.camp_date !== formData.end_date
                        ? 'Date-ranged drive (multi-day)'
                        : 'Single-day drive (edit to extend)'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Start Time
                    </label>
                    <input
                      type="time"
                      name="start_time"
                      value={to24Hour(formData.start_time)}
                      onChange={(e) => {
                        const formatted = to12Hour(e.target.value);
                        handleCreateInputChange({
                          target: { name: 'start_time', value: formatted },
                        } as any);
                      }}
                      className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-rose-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      End Time
                    </label>
                    <input
                      type="time"
                      name="end_time"
                      value={to24Hour(formData.end_time)}
                      onChange={(e) => {
                        const formatted = to12Hour(e.target.value);
                        handleCreateInputChange({
                          target: { name: 'end_time', value: formatted },
                        } as any);
                      }}
                      className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-rose-500"
                    />
                  </div>
                </div>
              </div>

              {/* Map Navigation & Location Link Section */}
              <div className="p-4 rounded-xl bg-blue-50/50 dark:bg-slate-800/60 border border-blue-100 dark:border-slate-700 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                    <Navigation className="w-3.5 h-3.5 text-blue-600 fill-current" />
                    Venue Map & Turn-by-Turn Navigation Link
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Controls where the &quot;Navigate&quot; button points
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Google Maps / Navigation URL
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="url"
                      name="map_url"
                      placeholder="e.g. https://maps.app.goo.gl/... or https://goo.gl/maps/..."
                      value={formData.map_url || ''}
                      onChange={handleCreateInputChange}
                      className="flex-1 px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    />
                    {formData.map_url && (
                      <a
                        href={formData.map_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-2 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-xs font-bold flex items-center gap-1 shrink-0 hover:bg-blue-200"
                        title="Open URL in new tab"
                      >
                        Open <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    Paste a direct Google Maps link, or click below to pin your device&apos;s current GPS coordinates.
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap pt-1">
                  <button
                    type="button"
                    onClick={() => handleGetDeviceLocation('create')}
                    disabled={isGeolocating}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                  >
                    <LocateFixed className={`w-3.5 h-3.5 text-blue-500 ${isGeolocating ? 'animate-spin' : ''}`} />
                    {isGeolocating ? 'Detecting GPS...' : 'Use My Current GPS Location'}
                  </button>

                  {formData.latitude && formData.longitude && (
                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1 ml-auto">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Pinned: {formData.latitude}, {formData.longitude}
                    </span>
                  )}
                </div>

                {formData.latitude && formData.longitude && (
                  <div className="mt-2 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 h-36 relative">
                    <iframe
                      title="Camp Location Preview"
                      width="100%"
                      height="100%"
                      frameBorder="0"
                      scrolling="no"
                      src={`https://www.openstreetmap.org/export/embed.html?bbox=${formData.longitude - 0.008}%2C${formData.latitude - 0.008}%2C${formData.longitude + 0.008}%2C${formData.latitude + 0.008}&layer=mapnik&marker=${formData.latitude}%2C${formData.longitude}`}
                      className="w-full h-full"
                    />
                  </div>
                )}
              </div>

              {/* Contact Information */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Contact Phone <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="tel"
                    name="contact_phone"
                    placeholder="e.g. +91 9876543210"
                    value={formData.contact_phone}
                    onChange={handleCreateInputChange}
                    className={`w-full px-3.5 py-2.5 text-sm rounded-xl border bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden transition-all ${
                      scheduleInvalidFields.includes('contact_phone')
                        ? 'border-rose-500 ring-2 ring-rose-500/20 dark:border-rose-500 dark:ring-rose-500/20'
                        : 'border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-rose-500'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Contact Email (Optional)
                  </label>
                  <input
                    type="email"
                    name="contact_email"
                    placeholder="e.g. bloodbank@hospital.org"
                    value={formData.contact_email || ''}
                    onChange={handleCreateInputChange}
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              </div>
            </form>

            {/* Pinned Modal Footer (Always Visible at bottom with Bottom Error Notice) */}
            <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 flex flex-col gap-3 shrink-0">
              {/* Validation & Mandatory Fields Error Notice - Exactly ONE Alert */}
              {scheduleModalError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 font-semibold text-xs flex items-center gap-2 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                  <span>{scheduleModalError}</span>
                </div>
              )}

              <div className="flex items-center justify-between gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    setIsScheduleModalOpen(false);
                    setScheduleModalError(null);
                    setScheduleInvalidFields([]);
                  }}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    disabled={submittingSchedule}
                    onClick={() => handleCreateCamp('DRAFT')}
                    className="px-4 py-2.5 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 text-xs font-bold hover:bg-amber-100 dark:hover:bg-amber-900/60 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    Save as Draft (Private)
                  </button>

                  <button
                    type="button"
                    disabled={submittingSchedule}
                    onClick={() => handleCreateCamp('UPCOMING')}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md shadow-rose-600/20 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {submittingSchedule ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Publishing...
                      </>
                    ) : (
                      <>
                        <Radio className="w-4 h-4" />
                        Broadcast Drive Live
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. EDIT CAMP MODAL (For Hospitals) */}
      {isEditModalOpen && editingCamp && (
        <div className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-slate-950/70 backdrop-blur-xs flex justify-center items-start p-3 sm:p-6 py-6 sm:py-10 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh] my-auto sm:my-0 animate-in zoom-in-95">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 pb-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Edit Blood Donation Camp Details
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Editing #{editingCamp.id}: {editingCamp.camp_name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsEditModalOpen(false);
                  setEditingCamp(null);
                  setEditModalError(null);
                  setEditInvalidFields([]);
                }}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form id="edit-camp-form" onSubmit={handleUpdateCamp} className="p-5 sm:p-6 overflow-y-auto overscroll-contain flex-1 space-y-4 text-xs">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Camp Name / Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  name="camp_name"
                  value={editFormData.camp_name || ''}
                  onChange={handleEditInputChange}
                  className={`w-full px-3.5 py-2.5 text-sm rounded-xl border bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden transition-all ${
                    editInvalidFields.includes('camp_name')
                      ? 'border-rose-500 ring-2 ring-rose-500/20 dark:border-rose-500 dark:ring-rose-500/20'
                      : 'border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-blue-500'
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Description & Donor Guidelines
                </label>
                <textarea
                  name="description"
                  rows={2}
                  value={editFormData.description || ''}
                  onChange={handleEditInputChange}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Venue Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="venue_name"
                    value={editFormData.venue_name || ''}
                    onChange={handleEditInputChange}
                    className={`w-full px-3.5 py-2.5 text-sm rounded-xl border bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden transition-all ${
                      editInvalidFields.includes('venue_name')
                        ? 'border-rose-500 ring-2 ring-rose-500/20 dark:border-rose-500 dark:ring-rose-500/20'
                        : 'border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-blue-500'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Address Line <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="address_line"
                    value={editFormData.address_line || ''}
                    onChange={handleEditInputChange}
                    className={`w-full px-3.5 py-2.5 text-sm rounded-xl border bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden transition-all ${
                      editInvalidFields.includes('address_line')
                        ? 'border-rose-500 ring-2 ring-rose-500/20 dark:border-rose-500 dark:ring-rose-500/20'
                        : 'border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-blue-500'
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    City <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="city"
                    value={editFormData.city || ''}
                    onChange={handleEditInputChange}
                    className={`w-full px-3.5 py-2.5 text-sm rounded-xl border bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden transition-all ${
                      editInvalidFields.includes('city')
                        ? 'border-rose-500 ring-2 ring-rose-500/20 dark:border-rose-500 dark:ring-rose-500/20'
                        : 'border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-blue-500'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    State
                  </label>
                  <input
                    type="text"
                    name="state"
                    value={editFormData.state || ''}
                    onChange={handleEditInputChange}
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Target Units
                  </label>
                  <input
                    type="number"
                    name="target_units"
                    min="10"
                    max="5000"
                    value={editFormData.target_units || ''}
                    onChange={handleEditInputChange}
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Date & Timings */}
              <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                    <Calendar className="w-3.5 h-3.5 text-rose-500" />
                    Camp Date & Schedule
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Cannot be set to a past date
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Start Date <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      name="camp_date"
                      min={todayStr}
                      value={editFormData.camp_date || ''}
                      onChange={handleEditInputChange}
                      onBlur={() => handleDateBlur('edit', 'camp_date')}
                      className={`w-full px-3 py-2 text-sm rounded-xl border bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden transition-all ${
                        editInvalidFields.includes('camp_date')
                          ? 'border-rose-500 ring-2 ring-rose-500/20 dark:border-rose-500 dark:ring-rose-500/20'
                          : 'border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500'
                      }`}
                    />
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                      Sets single-day camp by default
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      End Date <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      name="end_date"
                      min={editFormData.camp_date || todayStr}
                      value={editFormData.end_date || editFormData.camp_date || ''}
                      onChange={handleEditInputChange}
                      onBlur={() => handleDateBlur('edit', 'end_date')}
                      className={`w-full px-3 py-2 text-sm rounded-xl border bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden transition-all ${
                        editInvalidFields.includes('end_date')
                          ? 'border-rose-500 ring-2 ring-rose-500/20 dark:border-rose-500 dark:ring-rose-500/20'
                          : 'border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500'
                      }`}
                    />
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                      {editFormData.camp_date && editFormData.end_date && editFormData.camp_date !== editFormData.end_date
                        ? 'Date-ranged drive (multi-day)'
                        : 'Single-day drive (edit to extend)'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Start Time
                    </label>
                    <input
                      type="time"
                      name="start_time"
                      value={to24Hour(editFormData.start_time)}
                      onChange={(e) => {
                        const formatted = to12Hour(e.target.value);
                        handleEditInputChange({
                          target: { name: 'start_time', value: formatted },
                        } as any);
                      }}
                      className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      End Time
                    </label>
                    <input
                      type="time"
                      name="end_time"
                      value={to24Hour(editFormData.end_time)}
                      onChange={(e) => {
                        const formatted = to12Hour(e.target.value);
                        handleEditInputChange({
                          target: { name: 'end_time', value: formatted },
                        } as any);
                      }}
                      className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Map Navigation Link & Coordinates */}
              <div className="p-4 rounded-xl bg-blue-50/50 dark:bg-slate-800/60 border border-blue-100 dark:border-slate-700 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                    <Navigation className="w-3.5 h-3.5 text-blue-600 fill-current" />
                    Venue Map & Turn-by-Turn Navigation Link
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Google Maps / Navigation URL
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="url"
                      name="map_url"
                      placeholder="e.g. https://maps.app.goo.gl/... or https://goo.gl/maps/..."
                      value={editFormData.map_url || ''}
                      onChange={handleEditInputChange}
                      className="flex-1 px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    />
                    {editFormData.map_url && (
                      <a
                        href={editFormData.map_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-2 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-xs font-bold flex items-center gap-1 shrink-0 hover:bg-blue-200"
                        title="Open URL in new tab"
                      >
                        Open <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap pt-1">
                  <button
                    type="button"
                    onClick={() => handleGetDeviceLocation('edit')}
                    disabled={isEditGeolocating}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                  >
                    <LocateFixed className={`w-3.5 h-3.5 text-blue-500 ${isEditGeolocating ? 'animate-spin' : ''}`} />
                    {isEditGeolocating ? 'Detecting GPS...' : 'Use My Current GPS Location'}
                  </button>

                  {editFormData.latitude && editFormData.longitude && (
                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1 ml-auto">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Pinned: {editFormData.latitude}, {editFormData.longitude}
                    </span>
                  )}
                </div>

                {editFormData.latitude && editFormData.longitude && (
                  <div className="mt-2 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 h-36 relative">
                    <iframe
                      title="Camp Location Preview"
                      width="100%"
                      height="100%"
                      frameBorder="0"
                      scrolling="no"
                      src={`https://www.openstreetmap.org/export/embed.html?bbox=${editFormData.longitude - 0.008}%2C${editFormData.latitude - 0.008}%2C${editFormData.longitude + 0.008}%2C${editFormData.latitude + 0.008}&layer=mapnik&marker=${editFormData.latitude}%2C${editFormData.longitude}`}
                      className="w-full h-full"
                    />
                  </div>
                )}
              </div>

              {/* Contact Information */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Contact Phone <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="tel"
                    name="contact_phone"
                    value={editFormData.contact_phone || ''}
                    onChange={handleEditInputChange}
                    className={`w-full px-3.5 py-2.5 text-sm rounded-xl border bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden transition-all ${
                      editInvalidFields.includes('contact_phone')
                        ? 'border-rose-500 ring-2 ring-rose-500/20 dark:border-rose-500 dark:ring-rose-500/20'
                        : 'border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-blue-500'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Contact Email (Optional)
                  </label>
                  <input
                    type="email"
                    name="contact_email"
                    value={editFormData.contact_email || ''}
                    onChange={handleEditInputChange}
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </form>

            {/* Pinned Edit Modal Footer (Always Visible at bottom with Bottom Error Notice) */}
            <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 flex flex-col gap-3 shrink-0">
              {/* Form Local Error Notification - Exactly ONE Alert */}
              {editModalError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 font-semibold text-xs flex items-center gap-2 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                  <span>{editModalError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 w-full">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setEditingCamp(null);
                    setEditModalError(null);
                    setEditInvalidFields([]);
                  }}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="edit-camp-form"
                  disabled={submittingEdit}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-600/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  {submittingEdit ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Saving Updates...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. CAMP DETAILS PREVIEW MODAL */}
      {selectedCamp && (
        <div className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-slate-950/70 backdrop-blur-xs flex justify-center items-start p-3 sm:p-6 py-6 sm:py-10 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh] my-auto sm:my-0 animate-in zoom-in-95">
            <div className="p-6 pb-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white line-clamp-1">
                    {selectedCamp.camp_name}
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    {getStatusBadge(selectedCamp.status)}
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Camp #{selectedCamp.id}
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCamp(null)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto overscroll-contain flex-1 space-y-4 text-sm">
              <div>
                <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">
                  About This Blood Donation Drive
                </h4>
                <p className="text-slate-700 dark:text-slate-200 text-xs sm:text-sm leading-relaxed bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800">
                  {selectedCamp.description || 'Community voluntary blood donation camp to support patients in critical emergency need.'}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-rose-50/50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/40">
                <div className="flex items-center gap-1.5 text-xs text-rose-700 dark:text-rose-400 font-bold mb-1">
                  <Building2 className="w-3.5 h-3.5" />
                  <span>Associated Organizer Medical Hub</span>
                </div>
                <p className="font-bold text-slate-900 dark:text-white text-sm">
                  {selectedCamp.organizer_hub_name || 'Verified Medical Hub'}
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  Type: <span className="font-semibold text-slate-800 dark:text-slate-200 capitalize">{selectedCamp.organizer_hub_type?.toLowerCase() || 'Hospital'}</span>
                  {selectedCamp.organizer_hub_city ? ` • ${selectedCamp.organizer_hub_city}` : ''}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mb-1">
                    <Calendar className="w-3.5 h-3.5 text-rose-500" />
                    <span>Date / Schedule</span>
                  </div>
                  <p className="font-bold text-slate-900 dark:text-white text-xs">
                    {formatDateRange(selectedCamp.camp_date, selectedCamp.end_date)}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mb-1">
                    <Clock className="w-3.5 h-3.5 text-blue-500" />
                    <span>Camp Timings</span>
                  </div>
                  <p className="font-bold text-slate-900 dark:text-white text-xs">
                    {selectedCamp.start_time} - {selectedCamp.end_time}
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <MapPin className="w-3.5 h-3.5 text-amber-500" />
                  <span>Venue & Location</span>
                </div>
                <p className="font-bold text-slate-900 dark:text-white text-xs">
                  {selectedCamp.venue_name}
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  {selectedCamp.address_line}, {selectedCamp.city}{selectedCamp.state ? `, ${selectedCamp.state}` : ''}{selectedCamp.pincode ? ` - ${selectedCamp.pincode}` : ''}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mb-1">
                    <Phone className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Contact / Helpline</span>
                  </div>
                  <a
                    href={`tel:${selectedCamp.contact_phone}`}
                    className="font-bold text-rose-600 dark:text-rose-400 hover:underline text-xs flex items-center gap-1"
                  >
                    {selectedCamp.contact_phone}
                  </a>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mb-1">
                    <Users className="w-3.5 h-3.5 text-purple-500" />
                    <span>Target Volume</span>
                  </div>
                  <p className="font-bold text-slate-900 dark:text-white text-xs">
                    {selectedCamp.target_units || 'N/A'} Units
                  </p>
                </div>
              </div>
            </div>

            {/* Pinned Details Modal Footer */}
            <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 flex items-center justify-between gap-3 shrink-0">
              <a
                href={getCampNavigateUrl(selectedCamp)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
              >
                <Navigation className="w-3.5 h-3.5 fill-current" />
                Navigate via Google Maps
                <ExternalLink className="w-3 h-3 opacity-70" />
              </a>

              <button
                type="button"
                onClick={() => setSelectedCamp(null)}
                className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
