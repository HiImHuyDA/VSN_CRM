// src/routes/suppliers.js — Thin proxy: gọi usp_GetSuppliers
const express = require('express');
const router = express.Router();
const { getBravoPool, sql } = require('../config/database');

let suppliersCache = null;
let cacheTime = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 phút

router.get('/', async (req, res, next) => {
  try {
    if (suppliersCache && cacheTime && Date.now() - cacheTime < CACHE_TTL) {
      return res.json({ success: true, data: suppliersCache });
    }
    const pool = await getBravoPool();
    const result = await pool.request().execute('usp_GetSuppliers');
    const suppliers = result.recordset.map(r => r.SupplierName).filter(Boolean);
    suppliersCache = suppliers;
    cacheTime = Date.now();
    res.json({ success: true, data: suppliers });
  } catch (err) {
    console.warn('⚠️  BRAVO DB error:', err.message);
    res.json({ success: true, data: suppliersCache || [] });
  }
});

module.exports = router;
