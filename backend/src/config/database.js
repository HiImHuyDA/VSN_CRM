// src/config/database.js
const sql = require('mssql');
require('dotenv').config();

// Pool connection cho CSR database chính
const csrConfig = {
  server: process.env.DB_SERVER,
  port: parseInt(process.env.DB_PORT || '1433'),
  database: process.env.DB_DATABASE,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_CERT === 'true',
    connectTimeout: 30000,
    requestTimeout: 30000,
    useUTC: false,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

// Pool connection cho BRAVO database (NCC)
const bravoConfig = {
  server: process.env.BRAVO_DB_SERVER,
  port: parseInt(process.env.BRAVO_DB_PORT || '1433'),
  database: process.env.BRAVO_DB_DATABASE,
  user: process.env.BRAVO_DB_USER,
  password: process.env.BRAVO_DB_PASSWORD,
  options: {
    encrypt: false,
    trustServerCertificate: true,
    connectTimeout: 30000,
    requestTimeout: 30000,
    useUTC: false,
  },
  pool: {
    max: 5,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

let csrPool = null;
let bravoPool = null;

async function getCsrPool() {
  if (!csrPool || !csrPool.connected) {
    try {
      csrPool = await new sql.ConnectionPool(csrConfig).connect();
      console.log('✅ Connected to CSR SQL Server database');
    } catch (err) {
      console.error('❌ Failed to connect to CSR SQL Server:', err.message);
      csrPool = null;
      throw err;
    }
  }
  return csrPool;
}

async function getBravoPool() {
  if (!bravoPool || !bravoPool.connected) {
    try {
      bravoPool = await new sql.ConnectionPool(bravoConfig).connect();
      console.log('✅ Connected to BRAVO SQL Server database');
    } catch (err) {
      console.error('❌ Failed to connect to BRAVO SQL Server:', err.message);
      bravoPool = null;
      throw err;
    }
  }
  return bravoPool;
}

async function closePools() {
  if (csrPool) { await csrPool.close(); csrPool = null; }
  if (bravoPool) { await bravoPool.close(); bravoPool = null; }
}

module.exports = { getCsrPool, getBravoPool, closePools, sql };
