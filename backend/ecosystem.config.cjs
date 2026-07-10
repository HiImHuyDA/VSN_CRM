// ecosystem.config.cjs - PM2 Process Manager Configuration
// File này chỉ dùng để PM2 load đúng biến môi trường từ .env khi start/restart
// Không liên quan đến Vite hay build system
require('dotenv').config({ path: __dirname + '/.env' });

module.exports = {
  apps: [
    {
      name: 'csr-backend',
      script: './server.js',
      instances: 1,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: process.env.NODE_ENV || 'development',
        PORT: process.env.PORT || 3002,
        // SQL Server chính
        DB_SERVER: process.env.DB_SERVER,
        DB_PORT: process.env.DB_PORT,
        DB_DATABASE: process.env.DB_DATABASE,
        DB_USER: process.env.DB_USER,
        DB_PASSWORD: process.env.DB_PASSWORD,
        DB_ENCRYPT: process.env.DB_ENCRYPT,
        DB_TRUST_CERT: process.env.DB_TRUST_CERT,
        // SQL Server BRAVO
        BRAVO_DB_SERVER: process.env.BRAVO_DB_SERVER,
        BRAVO_DB_DATABASE: process.env.BRAVO_DB_DATABASE,
        BRAVO_DB_USER: process.env.BRAVO_DB_USER,
        BRAVO_DB_PASSWORD: process.env.BRAVO_DB_PASSWORD,
        // Azure AD / SharePoint
        TENANT_ID: process.env.TENANT_ID,
        CLIENT_ID: process.env.CLIENT_ID,
        CLIENT_SECRET: process.env.CLIENT_SECRET,
        SHARE_URL: process.env.SHARE_URL,
        SHAREPOINT_EXCEL_TABLE: process.env.SHAREPOINT_EXCEL_TABLE,
        SHAREPOINT_EXCEL_SHEET: process.env.SHAREPOINT_EXCEL_SHEET,
        SHAREPOINT_FEEDBACK_QUEUE_LIST: process.env.SHAREPOINT_FEEDBACK_QUEUE_LIST,
        SHAREPOINT_FEEDBACK_RESULTS_LIST: process.env.SHAREPOINT_FEEDBACK_RESULTS_LIST,
        SHAREPOINT_GATE_EXCEL_URL: process.env.SHAREPOINT_GATE_EXCEL_URL,
        SHAREPOINT_GATE_EXCEL_TABLE: process.env.SHAREPOINT_GATE_EXCEL_TABLE,
        // Email & JWT
        SENDER_EMAIL: process.env.SENDER_EMAIL,
        JWT_SECRET: process.env.JWT_SECRET,
        // CORS / URLs
        FRONTEND_URL: process.env.FRONTEND_URL,
        BACKEND_URL: process.env.BACKEND_URL,
        UPLOAD_DIR: process.env.UPLOAD_DIR,
        // Python
        PYTHON_PATH: process.env.PYTHON_PATH,
      }
    }
  ]
};
