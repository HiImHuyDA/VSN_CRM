-- Migration 83: Drop UNIQUE KEY constraint on CSR_Employees.Email to allow multiple employees to share the same department or warehouse email
USE CSR_DB;
GO

IF EXISTS (
    SELECT 1 
    FROM sys.objects 
    WHERE name = 'UQ_CSR_Employees_Email' 
      AND parent_object_id = OBJECT_ID('dbo.CSR_Employees')
)
BEGIN
    ALTER TABLE [dbo].[CSR_Employees] DROP CONSTRAINT [UQ_CSR_Employees_Email];
    PRINT 'Dropped UQ_CSR_Employees_Email successfully.';
END
ELSE
BEGIN
    PRINT 'Constraint UQ_CSR_Employees_Email does not exist.';
END
GO

PRINT 'Migration 83: Hoan thanh.';
GO
