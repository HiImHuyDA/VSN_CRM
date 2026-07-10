// src/services/api.js
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {

  const token = localStorage.getItem('csr_token');

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (res) => res.data,
  (err) => {
    const msg = err.response?.data?.error || err.message || 'Lỗi kết nối máy chủ';
    return Promise.reject(new Error(msg));
  }
);

// ── Employees ──────────────────────────────────────────────────
export const searchEmployees = (q = '') =>
  api.get('/employees', { params: { q } });

// ── Suppliers ──────────────────────────────────────────────────
export const getSuppliers = () => api.get('/suppliers');

// ── Task Config ────────────────────────────────────────────────
export const getTaskConfig = (destinations) =>
  api.get('/task-config', { params: { destinations } });

export const getConfigLists = async () => {
  const [rooms, lunches, dinners, emps] = await Promise.all([
    api.get('/system-config/lists', { params: { category: 'MeetingRoom' } }),
    api.get('/system-config/lists', { params: { category: 'LunchMenu' } }),
    api.get('/system-config/lists', { params: { category: 'DinnerRestaurant' } }),
    api.get('/employees')
  ]);

  const meetingRoomsData = rooms.data?.filter(x => x.IsActive) || [];
  const meetingRooms = meetingRoomsData.map(r => r.Name);
  const meetingRoomEmails = {};
  meetingRoomsData.forEach(r => { meetingRoomEmails[r.Name] = r.Email || ''; });

  const lunchList = (lunches.data?.filter(x => x.IsActive) || []).map(r => r.Name);
  const dinnerRaw = dinners.data?.filter(x => x.IsActive) || [];
  const dinnerList = dinnerRaw.map(r => r.Name);

  const employees = (emps.data || []).map(e => ({ label: e.FullName, email: e.Email, value: e.MNV }));

  return {
    data: {
      meetingRooms,
      meetingRoomEmails,
      lunchList,
      dinnerList,
      dinnerRaw,
      employees
    }
  };
};

// ── System Config (dynamic from DB) ───────────────────────────
export const getCustomers = (type) => api.get('/system-config/lists', { params: { category: type } });
export const getLocations = () => api.get('/system-config/locations');
export const getMeetingRooms = () => api.get('/system-config/lists', { params: { category: 'MeetingRoom' } });
export const getLunchMenus = () => api.get('/system-config/lists', { params: { category: 'LunchMenu' } });
export const getDinnerList = () => api.get('/system-config/lists', { params: { category: 'DinnerRestaurant' } });
export const getTaskConfigs = (dest) => api.get('/system-config/task-configs', { params: { destination: dest } });

// ── Submissions ────────────────────────────────────────────────
export const getSubmissions = (params) =>
  api.get('/submissions', { params });

export const getSubmission = (projectId) =>
  api.get(`/submissions/${projectId}`);

export const createSubmission = (data) =>
  api.post('/submissions', data);

export const updateSubmission = (projectId, data) =>
  api.put(`/submissions/${projectId}`, data);

export const approveSubmission = (projectId, data) =>
  api.post(`/submissions/${projectId}/approve`, data);

export const rejectSubmission = (projectId, data) =>
  api.post(`/submissions/${projectId}/reject`, data);

export const getApprovalLogs = (projectId) =>
  api.get(`/submissions/${projectId}/logs`);

export const getSubmissionHistory = (projectId) =>
  api.get(`/submissions/${projectId}/history`);

export const cancelSubmission = (projectId, data) =>
  api.post(`/submissions/${projectId}/cancel`, data);

// ── Calendar ───────────────────────────────────────────────────
export const checkCalendar = (roomEmail, date) =>
  api.post('/calendar/check', { roomEmail, date });

// ── Guest Calendar ────────────────────────────────────────────
export const getGuestCalendar = (month) =>
  api.get('/guest-calendar', { params: { month } });

// ── Upload ─────────────────────────────────────────────────────
export const uploadAttachment = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  const res = await api.post('/files/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  // New API returns { success: true, data: { id, original_name, file_url } }
  return { url: res.data.file_url, fileName: res.data.original_name };
};

// ── Feedback Management ─────────────────────────────────────────
export const getFeedbackInvitations = (params) =>
  api.get('/feedback/invitations', { params });

export const resendFeedbackInvitation = (invitationId) =>
  api.post('/feedback/invitations/resend', { invitationId });

export const cancelFeedbackInvitation = (invitationId) =>
  api.post('/feedback/invitations/cancel', { invitationId });

export const getFeedbackResponses = (params) =>
  api.get('/feedback/responses', { params });

export const triggerFeedbackCronManually = () =>
  api.post('/feedback/trigger-cron-manually');

export const triggerFeedbackSyncManually = () =>
  api.post('/feedback/trigger-sync-manually');

export default api;
