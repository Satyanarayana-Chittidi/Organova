
const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  count?: number;
}

export function getAvatarUrl(url?: string | null): string | null {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url;
  }
  return url.startsWith('/') ? url : `/${url}`;
}

let _adminToken: string | null = null;

export function setAdminToken(token: string | null): void {
  _adminToken = token;
}

export function getAdminToken(): string | null {
  return _adminToken;
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const url = `${API_BASE}${endpoint}`;

  const defaultHeaders: Record<string, string> =
    options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' };

  if (_adminToken && (endpoint.startsWith('/admin') || endpoint.startsWith('/auth/me'))) {
    defaultHeaders['Authorization'] = `Bearer ${_adminToken}`;
  }

  const response = await fetch(url, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...(options.headers as Record<string, string>),
    },
    credentials: 'include',
  });

  const data = await response.json().catch(() => ({
    success: false,
    message: 'Failed to parse server response.',
  }));

  if (!response.ok || !data.success) {
    const error: any = new Error(data.message || `Request failed with status ${response.status}`);
    error.statusCode = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

export const authApi = {
  register: (body: { email: string; password: string; role?: string }) =>
    apiRequest('/auth/register', { method: 'POST', body: JSON.stringify(body) }),

  verifyOtp: (body: { email: string; otp: string }) =>
    apiRequest('/auth/verify-otp', { method: 'POST', body: JSON.stringify(body) }),

  login: (body: { email: string; password: string }) =>
    apiRequest('/auth/login', { method: 'POST', body: JSON.stringify(body) }),

  getMe: () =>
    apiRequest('/auth/me', { method: 'GET' }),

  logout: () =>
    apiRequest('/auth/logout', { method: 'POST' }),
};

export const citizenApi = {
  getProfile: () =>
    apiRequest('/citizen/profile', { method: 'GET' }),

  saveProfile: (body: any) =>
    apiRequest('/citizen/profile', { method: 'POST', body: JSON.stringify(body) }),

  uploadAvatar: (formData: FormData) =>
    apiRequest('/citizen/avatar', { method: 'POST', body: formData }),

  removeAvatar: () =>
    apiRequest('/citizen/avatar', { method: 'DELETE' }),

  getDonationHistory: () =>
    apiRequest('/citizen/history', { method: 'GET' }),
};

export const donorApi = {
  getOrganTypes: () =>
    apiRequest('/donor/organ-types', { method: 'GET' }),

  getMyPledges: () =>
    apiRequest('/donor/pledges', { method: 'GET' }),

  savePledges: (pledges: Array<{ organ_type_id: number; consent_type: 'DECEASED' | 'LIVING' }>) =>
    apiRequest('/donor/pledges', { method: 'POST', body: JSON.stringify({ pledges }) }),

  revokePledge: (pledgeId: number) =>
    apiRequest(`/donor/pledges/${pledgeId}/revoke`, { method: 'PATCH' }),

  revokeAllPledges: () =>
    apiRequest('/donor/pledges/revoke-all', { method: 'PATCH' }),

  getDonorCard: () =>
    apiRequest('/donor/card', { method: 'GET' }),
};

export const hubApi = {
  register: (body: any) =>
    apiRequest('/hubs/register', { method: 'POST', body: JSON.stringify(body) }),

  getMyHub: () =>
    apiRequest('/hubs/me', { method: 'GET' }),

  getMyHubHistory: () =>
    apiRequest('/hubs/me/history', { method: 'GET' }),

  updateMyHub: (body: any) =>
    apiRequest('/hubs/me', { method: 'PUT', body: JSON.stringify(body) }),

  getDirectory: (params: { hub_type?: string; city?: string; search?: string } = {}) => {
    const q = new URLSearchParams();
    if (params.hub_type) q.append('hub_type', params.hub_type);
    if (params.city) q.append('city', params.city);
    if (params.search) q.append('search', params.search);
    return apiRequest(`/hubs/directory?${q.toString()}`, { method: 'GET' });
  },

  getCities: () =>
    apiRequest('/hubs/cities', { method: 'GET' }),

  getHubById: (id: number) =>
    apiRequest(`/hubs/${id}`, { method: 'GET' }),

  searchCitizens: (query: string = '') => {
    const q = new URLSearchParams();
    if (query) q.append('query', query);
    return apiRequest(`/hubs/citizens/search?${q.toString()}`, { method: 'GET' });
  },

  masterRegisterCitizen: (body: {
    full_name: string;
    email: string;
    date_of_birth: string;
    gender: 'MALE' | 'FEMALE' | 'OTHER';
    blood_group: string;
    phone_number?: string;
  }) =>
    apiRequest('/hubs/citizens/master-register', { method: 'POST', body: JSON.stringify(body) }),
};

export const bloodApi = {
  searchStock: (params: { blood_group?: string; component?: string; city?: string } = {}) => {
    const q = new URLSearchParams();
    if (params.blood_group) q.append('blood_group', params.blood_group);
    if (params.component) q.append('component', params.component);
    if (params.city) q.append('city', params.city);
    return apiRequest(`/blood/inventory/search?${q.toString()}`, { method: 'GET' });
  },

  getMyInventory: () =>
    apiRequest('/blood/inventory/me', { method: 'GET' }),

  setInventory: (body: { blood_group: string; component: string; units_available: number }) =>
    apiRequest('/blood/inventory', { method: 'PUT', body: JSON.stringify(body) }),

  adjustInventory: (body: {
    blood_group: string;
    component: string;
    delta_units: number;
    linked_user_id?: string | null;
    linked_user_role?: 'DONOR' | 'RECIPIENT' | null;
    patient_name?: string | null;
    hospital_bed_no?: string | null;
  }) =>
    apiRequest('/blood/inventory/adjust', { method: 'PATCH', body: JSON.stringify(body) }),

  createRequest: (body: {
    destination_hub_id: number;
    target_hub_id?: number | null;
    blood_group: string;
    component: string;
    units_requested: number;
    urgency: string;
    delivery_address?: string;
    patient_relationship?: string;
    patient_name?: string;
    hospital_bed_no?: string;
  }) => apiRequest('/blood/requests', { method: 'POST', body: JSON.stringify(body) }),

  getMyRequests: () =>
    apiRequest('/blood/requests/mine', { method: 'GET' }),

  getActiveAlerts: () =>
    apiRequest('/blood/requests/alerts', { method: 'GET' }),

  listRequests: (params: { status?: string; urgency?: string } = {}) => {
    const q = new URLSearchParams();
    if (params.status) q.append('status', params.status);
    if (params.urgency) q.append('urgency', params.urgency);
    return apiRequest(`/blood/requests?${q.toString()}`, { method: 'GET' });
  },

  getRequestById: (requestId: number) =>
    apiRequest(`/blood/requests/${requestId}`, { method: 'GET' }),

  claimRequest: (requestId: number) =>
    apiRequest(`/blood/requests/${requestId}/claim`, { method: 'POST' }),

  commitDonor: (requestId: number) =>
    apiRequest(`/blood/requests/${requestId}/commit-donor`, { method: 'POST' }),

  releaseDonor: (requestId: number) =>
    apiRequest(`/blood/requests/${requestId}/release-donor`, { method: 'POST' }),

  completeDonor: (requestId: number) =>
    apiRequest(`/blood/requests/${requestId}/complete-donor`, { method: 'POST' }),

  updateStatus: (requestId: number, status: 'DISPATCHED' | 'COMPLETED') =>
    apiRequest(`/blood/requests/${requestId}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),

  cancelRequest: (requestId: number) =>
    apiRequest(`/blood/requests/${requestId}/cancel`, { method: 'POST' }),
};

export const organApi = {
  getTypes: () =>
    apiRequest('/organs/types', { method: 'GET' }),

  harvest: (body: {
    organ_type_id: number;
    donor_user_id?: string;
    blood_group: string;
    harvested_at: string;
    clinical_notes?: string;
    never_expires?: boolean;
  }) => apiRequest('/organs/harvest', { method: 'POST', body: JSON.stringify(body) }),

  listOrgans: (params: { blood_group?: string; only_viable?: boolean; status?: string } = {}) => {
    const q = new URLSearchParams();
    if (params.blood_group) q.append('blood_group', params.blood_group);
    if (params.only_viable) q.append('only_viable', 'true');
    if (params.status) q.append('status', params.status);
    return apiRequest(`/organs?${q.toString()}`, { method: 'GET' });
  },

  getOrganById: (id: number) =>
    apiRequest(`/organs/${id}`, { method: 'GET' }),

  updateStatus: (id: number, body: { status: string; current_hub_id?: number; clinical_notes?: string }) =>
    apiRequest(`/organs/${id}/status`, { method: 'PATCH', body: JSON.stringify(body) }),
};

export const transplantApi = {
  addPatient: (body: {
    recipient_user_id?: string;
    patient_name?: string;
    patient_email?: string;
    patient_phone?: string;
    patient_gender?: string;
    patient_dob?: string;
    organ_type_id: number;
    blood_group: string;
    urgency_tier: string;
    medical_summary: string;
  }) => apiRequest('/transplant/requests', { method: 'POST', body: JSON.stringify(body) }),

  getWaitlist: (params: {
    organ_type_id?: number;
    blood_group?: string;
    urgency_tier?: string;
    status?: string;
    attending_hub_id?: number;
  } = {}) => {
    const q = new URLSearchParams();
    if (params.organ_type_id) q.append('organ_type_id', String(params.organ_type_id));
    if (params.blood_group) q.append('blood_group', params.blood_group);
    if (params.urgency_tier) q.append('urgency_tier', params.urgency_tier);
    if (params.status) q.append('status', params.status);
    if (params.attending_hub_id) q.append('attending_hub_id', String(params.attending_hub_id));
    return apiRequest(`/transplant/requests?${q.toString()}`, { method: 'GET' });
  },

  getMyRequests: () =>
    apiRequest('/transplant/requests/mine', { method: 'GET' }),

  getRequestById: (id: number) =>
    apiRequest(`/transplant/requests/${id}`, { method: 'GET' }),

  runMatching: (organId: number) =>
    apiRequest(`/transplant/matches/organ/${organId}`, { method: 'POST' }),

  allocateOrgan: (organId: number, requestId?: number) =>
    apiRequest(`/transplant/matches/organ/${organId}/allocate`, {
      method: 'POST',
      body: JSON.stringify({ request_id: requestId }),
    }),

  respondToMatch: (matchId: number, decision: 'ACCEPT' | 'DECLINE') =>
    apiRequest(`/transplant/matches/${matchId}/respond`, { method: 'POST', body: JSON.stringify({ decision }) }),

  getMatchDetails: (matchId: number) =>
    apiRequest(`/transplant/matches/${matchId}`, { method: 'GET' }),

  getActiveMatches: () =>
    apiRequest('/transplant/matches/active', { method: 'GET' }),

  sweepTimeouts: () =>
    apiRequest('/transplant/matches/sweep-timeouts', { method: 'POST' }),
};

export const adminApi = {
  getPendingHubs: () =>
    apiRequest('/admin/hubs/pending', { method: 'GET' }),

  verifyHub: (hubId: number, status: 'ACTIVE' | 'REJECTED' | 'SUSPENDED') =>
    apiRequest(`/admin/hubs/${hubId}/verify`, { method: 'PATCH', body: JSON.stringify({ status }) }),

  getMetrics: () =>
    apiRequest('/admin/metrics', { method: 'GET' }),

  getAllHubs: (status?: string) =>
    apiRequest(status ? `/admin/hubs?status=${encodeURIComponent(status)}` : '/admin/hubs', { method: 'GET' }),

  searchEntities: (query: string) =>
    apiRequest(`/admin/entities/search?q=${encodeURIComponent(query)}`, { method: 'GET' }),

  getLogs: (limit: number = 50) =>
    apiRequest(`/admin/logs?limit=${limit}`, { method: 'GET' }),
};

export interface BloodDonationCamp {
  id: number;
  organizer_hub_id: number;
  created_by_user_id: string;
  camp_name: string;
  description: string;
  venue_name: string;
  address_line: string;
  city: string;
  state?: string;
  pincode?: string;
  camp_date: string;
  end_date?: string;
  start_time: string;
  end_time: string;
  contact_phone: string;
  contact_email?: string;
  target_units?: number;
  status: 'DRAFT' | 'UPCOMING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  latitude?: number;
  longitude?: number;
  map_url?: string;
  created_at: string;
  updated_at: string;
  organizer_hub_name?: string;
  organizer_hub_type?: string;
  organizer_hub_city?: string;
  organizer_hub_phone?: string;
}

export interface CreateCampPayload {
  camp_name: string;
  description: string;
  venue_name: string;
  address_line: string;
  city: string;
  state?: string;
  pincode?: string;
  camp_date: string;
  end_date?: string;
  start_time: string;
  end_time: string;
  contact_phone: string;
  contact_email?: string;
  target_units?: number;
  latitude?: number;
  longitude?: number;
  map_url?: string;
  status?: 'DRAFT' | 'UPCOMING';
}

export interface UpdateCampPayload {
  camp_name?: string;
  description?: string;
  venue_name?: string;
  address_line?: string;
  city?: string;
  state?: string;
  pincode?: string;
  camp_date?: string;
  end_date?: string;
  start_time?: string;
  end_time?: string;
  contact_phone?: string;
  contact_email?: string;
  target_units?: number;
  latitude?: number;
  longitude?: number;
  map_url?: string;
  status?: 'DRAFT' | 'UPCOMING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
}

export const campApi = {
  list: (params: { status?: string; city?: string } = {}) => {
    const q = new URLSearchParams();
    if (params.status) q.append('status', params.status);
    if (params.city) q.append('city', params.city);
    const queryString = q.toString();
    return apiRequest<BloodDonationCamp[]>(`/camps${queryString ? `?${queryString}` : ''}`, { method: 'GET' });
  },

  getById: (id: number) =>
    apiRequest<BloodDonationCamp>(`/camps/${id}`, { method: 'GET' }),

  create: (body: CreateCampPayload) =>
    apiRequest<BloodDonationCamp>('/camps', { method: 'POST', body: JSON.stringify(body) }),

  update: (id: number, body: UpdateCampPayload) =>
    apiRequest<BloodDonationCamp>(`/camps/${id}`, { method: 'PUT', body: JSON.stringify(body) }),

  getMyHubCamps: () =>
    apiRequest<BloodDonationCamp[]>('/camps/hub/mine', { method: 'GET' }),

  updateStatus: (id: number, status: 'DRAFT' | 'UPCOMING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED') =>
    apiRequest(`/camps/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
};
