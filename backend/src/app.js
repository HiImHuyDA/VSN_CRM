// src/app.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

const axios = require('axios');
axios.defaults.timeout = 8000;


const submissionsRouter = require('./routes/submissions');
const employeesRouter = require('./routes/employees');
const suppliersRouter = require('./routes/suppliers');
const taskConfigRouter = require('./routes/taskConfig');
const calendarRouter = require('./routes/calendar');
const guestCalendarRouter = require('./routes/guest-calendar');
const authRouter = require('./routes/auth');
const systemConfigRouter = require('./routes/systemConfig');
const emailCampaignsRouter = require('./routes/emailCampaigns');
const dashboardRouter = require('./routes/dashboard');
const reportsRouter = require('./routes/reports');
const exportRouter = require('./routes/export');
const reviewCriteriaRouter = require('./routes/reviewCriteria');
const taskManagementRouter = require('./routes/taskManagement');
const feedbackRouter = require('./routes/feedback');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const { startCampaignScheduler } = require('./utils/campaignScheduler');
const { startFeedbackScheduler } = require('./utils/feedbackScheduler');
const fleetRouter = require('./routes/fleet');

const app = express();

const filesRouter = require('./routes/files');

// ── Security & Logging ────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ── CORS ──────────────────────────────────────────────────────
const allowedOrigins = [
  'http://crm.vietsuncorp.com.vn',
];

if (process.env.FRONTEND_URL) {
  const urls = process.env.FRONTEND_URL.split(',').map(u => u.trim());
  allowedOrigins.push(...urls);
}

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. mobile/curl) or matching origins
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

// ── Body Parser ───────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Health Check ──────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// ── Routes (Thin Proxies → SQL Stored Procedures) ─────────────
app.use('/api/submissions', submissionsRouter);
app.use('/api/employees', employeesRouter);
app.use('/api/suppliers', suppliersRouter);
app.use('/api/task-config', taskConfigRouter);
app.use('/api/calendar', calendarRouter);
app.use('/api/guest-calendar', guestCalendarRouter);
app.use('/api/files', filesRouter);
app.use('/api/auth', authRouter);
app.use('/api/system-config', systemConfigRouter);
app.use('/api/email-campaigns', emailCampaignsRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/export', exportRouter);
app.use('/api/review-criteria', reviewCriteriaRouter);
app.use('/api/task-management', taskManagementRouter);
app.use('/api/feedback', feedbackRouter);
app.use('/api/users', require('./routes/users'));
app.use('/api/audit-logs', require('./routes/auditLogs'));
app.use('/api/menus', require('./routes/menus'));
app.use('/api/fleet', fleetRouter);
const notificationsModule = require('./routes/notifications');
const { setSseEmitter } = require('./utils/notification');
setSseEmitter(notificationsModule.sendSseEvent);
app.use('/api/notifications', notificationsModule.router);

// ── Error Handling ────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// Khởi động bộ lập lịch gửi email campaign
startCampaignScheduler();

// Khởi động bộ lập lịch đồng bộ Cloud
const { startCloudSyncScheduler } = require('./utils/cloudSyncScheduler');
startCloudSyncScheduler();

// Khởi động bộ lập lịch gửi email chậm (Scheduled Emails)
const { startScheduledEmailScheduler } = require('./utils/scheduledEmailScheduler');
startScheduledEmailScheduler();
startFeedbackScheduler();

// Khởi động bộ lập lịch đồng bộ phê duyệt của BOD (Teams Approvals thông qua SharePoint List)
const { startBODApprovalSyncScheduler } = require('./utils/bodApprovalSync');
startBODApprovalSyncScheduler();

module.exports = app;