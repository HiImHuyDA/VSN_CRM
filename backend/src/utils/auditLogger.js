// src/utils/auditLogger.js
const { getCsrPool, sql } = require('../config/database');

async function logAuditAction(actionName, mnv, detail, projectId) {
  try {
    const pool = await getCsrPool();
    
    // Query Role and Department of the actor by MNV
    let role = null;
    let dept = null;
    if (mnv && mnv !== 'TEAMS_BOD') {
      const userRes = await pool.request()
        .input('MNV', sql.NVarChar(50), mnv)
        .execute('usp_User_GetRoleAndDept');
      if (userRes.recordset.length > 0) {
        role = userRes.recordset[0].Role;
        dept = userRes.recordset[0].Department;
      }
    } else if (mnv === 'TEAMS_BOD') {
      role = 'BOD';
    }

    // Call the correct stored procedure
    await pool.request()
      .input('Action', sql.NVarChar(100), actionName)
      .input('MNV', sql.NVarChar(50), mnv || '')
      .input('Role', sql.NVarChar(50), role)
      .input('Department', sql.NVarChar(100), dept)
      .input('Details', sql.NVarChar(sql.MAX), detail || '')
      .input('SubmissionId', sql.NVarChar(50), projectId ? String(projectId) : null)
      .execute('usp_AddAuditLog');
      
  } catch (error) {
    console.error('Failed to log audit action:', error);
  }
}

module.exports = {
  logAuditAction
};
