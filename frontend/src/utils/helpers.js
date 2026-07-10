import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

/**
 * Format a date object or string into a standard format.
 * @param {Date|string|number} date 
 * @param {string} formatStr Default 'dd/MM/yyyy'
 * @returns {string}
 */
export const formatDate = (date, formatStr = 'dd/MM/yyyy') => {
    if (!date) return '';
    try {
        const d = new Date(date);
        if (isNaN(d.getTime())) return '';
        return format(d, formatStr);
    } catch (e) {
        return '';
    }
};

/**
 * Format date for Vietnamese locale specifically (used in TopBar notifications)
 */
export const formatTimeVi = (date, formatStr = 'HH:mm dd/MM') => {
    if (!date) return '';
    try {
        const d = new Date(date);
        if (isNaN(d.getTime())) return '';
        return format(d, formatStr, { locale: vi });
    } catch (e) {
        return '';
    }
};

/**
 * Compare two dates by converting them to 'yyyy-MM-dd' strings
 */
export const isSameDay = (date1, date2) => {
    if (!date1 || !date2) return false;
    try {
        const formatD = (d) => format(new Date(d), 'yyyy-MM-dd');
        return formatD(date1) === formatD(date2);
    } catch (e) {
        return false;
    }
};

/**
 * Format currency to VND
 * @param {number|string} amount 
 * @returns {string}
 */
export const formatCurrency = (amount) => {
    if (amount === null || amount === undefined || isNaN(Number(amount))) return '';
    return new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND'
    }).format(Number(amount));
};

/**
 * Generates a unique ID using crypto.randomUUID if available,
 * otherwise falls back to a math-random based generator (for non-secure/non-HTTPS origins).
 * @returns {string}
 */
export const generateUUID = () => {
    if (typeof window !== 'undefined' && window.crypto && typeof window.crypto.randomUUID === 'function') {
        return window.crypto.randomUUID();
    }
    // Fallback implementation
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};
