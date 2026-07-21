-- 104_add_feedback_eligible_sp.sql

CREATE OR ALTER PROCEDURE usp_Feedback_GetEligibleProjects
AS
BEGIN
    SET NOCOUNT ON;
    SELECT p.Project_id, p.CustomerName, p.GuestReps, p.SubmitterName, p.SubmitterEmail, p.MeetingTopic, p.SubmitDate
    FROM CSR_Projects p
    INNER JOIN CSR_Statuses s ON p.StatusId = s.Id
    INNER JOIN (
        SELECT Project_id, MAX(OnboardDate) as LastOnboardDate
        FROM CSR_Tasks
        GROUP BY Project_id
    ) t ON p.Project_id = t.Project_id
    WHERE p.CustomerType = 'Brand'
      AND s.TenTrangThai = N'Hoàn thành'
      AND CAST(t.LastOnboardDate AS DATE) <= CAST(DATEADD(day, -1, GETDATE()) AS DATE)
      AND NOT EXISTS (
          SELECT 1 FROM CSR_FeedbackInvitations i WHERE i.ProjectId = p.Project_id
      );
END
GO
