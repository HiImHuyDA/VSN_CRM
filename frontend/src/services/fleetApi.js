// src/services/fleetApi.js
import api from './api';

// ── Vehicle Types ──
export const getVehicleTypes = () => api.get('/fleet/vehicle-types');
export const saveVehicleType = (data) => api.post('/fleet/vehicle-types', data);

// ── Vehicles ──
export const getVehicles = (params) => api.get('/fleet/vehicles', { params });
export const saveVehicle = (data) => api.post('/fleet/vehicles', data);
export const importVehicles = (rows) => api.post('/fleet/vehicles/batch', { rows });

// ── Drivers ──
export const getDrivers = (params) => api.get('/fleet/drivers', { params });
export const saveDriver = (data) => api.post('/fleet/drivers', data);
export const importDrivers = (rows) => api.post('/fleet/drivers/batch', { rows });

// ── Bookings ──
export const getBookings = (params) => api.get('/fleet/bookings', { params });
export const createBooking = (data) => api.post('/fleet/bookings', data);
export const getBookingDetail = (id) => api.get(`/fleet/bookings/${id}`);
export const getBookingHistory = (id) => api.get(`/fleet/bookings/${id}/history`);
export const updateBooking = (id, data) => api.put(`/fleet/bookings/${id}`, data);
export const updateBookingStatus = (id, data) => api.put(`/fleet/bookings/${id}/status`, data);


// ── Export ──
export const exportBookingsUrl = (params) => {
  const query = new URLSearchParams(params).toString();
  return `${import.meta.env.VITE_API_URL || '/api'}/fleet/export/bookings?${query}`;
};

// ── Geocoding ──
export const suggestLocations = (q) => api.get('/fleet/geocode/suggest', { params: { q } });
export const resolveLocation = (params) => api.get('/fleet/geocode/resolve', { params });

// ── Calendar ──
export const getVehicleCalendar = (params) => api.get('/fleet/bookings/calendar', { params });

