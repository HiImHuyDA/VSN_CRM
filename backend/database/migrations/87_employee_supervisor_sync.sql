-- ============================================================
-- Migration 87: Employee Supervisor Sync
-- Tao stored procedure dong bo bulk manager email tu SharePoint list
-- ============================================================
USE CSR_DB;
GO

CREATE OR ALTER PROCEDURE [dbo].[usp_Employee_UpdateSupervisorEmails]
    @SupervisorEmailsJson NVARCHAR(MAX)
AS
BEGIN
    SET NOCOUNT ON;
    
    UPDATE e
    SET e.ManagerEmail = j.ManagerEmail
    FROM [dbo].[CSR_Employees] e
    INNER JOIN OPENJSON(@SupervisorEmailsJson)
    WITH (
        MNV NVARCHAR(50) '$.mnv',
        ManagerEmail NVARCHAR(200) '$.managerEmail'
    ) j ON e.MNV = j.MNV
    WHERE j.ManagerEmail IS NOT NULL AND j.ManagerEmail != '';

    PRINT 'Updated direct supervisor emails in CSR_Employees';
END;
GO
