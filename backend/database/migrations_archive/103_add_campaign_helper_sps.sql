-- 103_add_campaign_helper_sps.sql

-- 1. usp_EmailCampaign_GetBrandProjects
CREATE OR ALTER PROCEDURE usp_EmailCampaign_GetBrandProjects
AS
BEGIN
    SET NOCOUNT ON;
    WITH LatestVersions AS (
        SELECT 
            Project_id,
            ROW_NUMBER() OVER (PARTITION BY ParentId ORDER BY Version DESC) as rn
        FROM CSR_Projects
    )
    SELECT 
      p.Project_id,
      p.CustomerName,
      p.MeetingTopic,
      p.SubmitterName,
      t.FirstOnboardDate
    FROM CSR_Projects p
    INNER JOIN LatestVersions lv ON p.Project_id = lv.Project_id AND lv.rn = 1
    INNER JOIN CSR_Statuses s ON p.StatusId = s.Id
    LEFT JOIN (
        SELECT Project_id, MIN(OnboardDate) AS FirstOnboardDate
        FROM CSR_Tasks
        GROUP BY Project_id
    ) t ON p.Project_id = t.Project_id
    WHERE p.CustomerType = 'Brand'
      AND s.TenTrangThai IN (N'BOD đã duyệt', N'Hoàn thành')
    ORDER BY COALESCE(t.FirstOnboardDate, '2099-12-31') ASC, p.Project_id DESC;
END
GO

-- 2. usp_EmailCampaign_GetLogs
CREATE OR ALTER PROCEDURE usp_EmailCampaign_GetLogs
AS
BEGIN
    SET NOCOUNT ON;
    SELECT l.Id, l.TemplateId, l.ProjectId, l.SentAt, l.Status, l.ErrorMessage,
           t.TemplateName, p.CustomerName, p.MeetingTopic
    FROM CSR_EmailCampaignLogs l
    LEFT JOIN CSR_EmailCampaignTemplates t ON l.TemplateId = t.Id
    LEFT JOIN CSR_Projects p ON l.ProjectId = p.Project_id
    ORDER BY l.SentAt DESC;
END
GO
