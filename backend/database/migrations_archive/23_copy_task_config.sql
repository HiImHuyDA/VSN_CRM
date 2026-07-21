USE CSR_DB;
GO

CREATE OR ALTER PROCEDURE [dbo].[usp_CopyTaskConfig]
    @FromDestination NVARCHAR(100),
    @ToDestination NVARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON;
    
    INSERT INTO [dbo].[CSR_TaskConfig] (
        [Destination], [TaskName], [Description],
        [AssigneeId], [AssigneeName], [AssigneeEmail],
        [SupervisorId], [SupervisorName], [SupervisorEmail],
        [IsCompulsory], [LeadtimeDays], [IsActive]
    )
    SELECT 
        @ToDestination, t.[TaskName], t.[Description],
        t.[AssigneeId], t.[AssigneeName], t.[AssigneeEmail],
        t.[SupervisorId], t.[SupervisorName], t.[SupervisorEmail],
        t.[IsCompulsory], t.[LeadtimeDays], t.[IsActive]
    FROM [dbo].[CSR_TaskConfig] t
    WHERE t.[Destination] = @FromDestination
      AND NOT EXISTS (
          SELECT 1 FROM [dbo].[CSR_TaskConfig] t2 
          WHERE t2.[Destination] = @ToDestination AND t2.[TaskName] = t.[TaskName]
      );
END
GO
