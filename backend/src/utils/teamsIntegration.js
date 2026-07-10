const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config();

const TEAMS_WEBHOOK_URL = process.env.TEAMS_WEBHOOK_BOD_URL;
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3002';

/**
 * Gửi thông báo phê duyệt tới MS Teams (BOD Channel)
 * @param {Object} submission - Đối tượng chứa thông tin đơn
 */
async function sendBODApprovalCard(submission) {
  if (!TEAMS_WEBHOOK_URL) {
    console.warn('⚠️ No TEAMS_WEBHOOK_BOD_URL configured. Skipping Teams notification.');
    return;
  }

  const projectId = submission.Project_id || submission.projectId || 'Unknown';
  const submitter = submission.SubmitterName || submission.submitterName || 'Unknown';
  const customer = submission.CustomerName || submission.customerName || 'Unknown';
  const topic = submission.MeetingTopic || submission.meetingTopic || 'Không có chủ đề';

  // URL để mở thẳng tab gọi API duyệt/từ chối
  // Trỏ về Frontend URL thay vì gọi trực tiếp API Backend giúp vượt qua bộ lọc sandbox bảo mật của Teams client
  const frontendBaseUrl = (process.env.FRONTEND_URL || 'http://10.0.0.36:4173').split(',')[0].trim();
  const approveUrl = `${frontendBaseUrl}/submissions?projectId=${projectId}&action=approve`;
  const rejectUrl = `${frontendBaseUrl}/submissions?projectId=${projectId}&action=reject`;

  const cardPayload = {
    "type": "message",
    "attachments": [
      {
        "contentType": "application/vnd.microsoft.card.adaptive",
        "contentUrl": null,
        "content": {
          "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
          "type": "AdaptiveCard",
          "version": "1.4",
          "body": [
            {
              "type": "TextBlock",
              "size": "Medium",
              "weight": "Bolder",
              "text": "📌 Yêu cầu phê duyệt đơn tiếp đón",
              "color": "Accent"
            },
            {
              "type": "FactSet",
              "facts": [
                {
                  "title": "Mã đơn:",
                  "value": projectId
                },
                {
                  "title": "Người yêu cầu:",
                  "value": submitter
                },
                {
                  "title": "Khách hàng:",
                  "value": customer
                },
                {
                  "title": "Chủ đề:",
                  "value": topic
                }
              ]
            },
            {
              "type": "TextBlock",
              "text": "Đơn đã được **PRD duyệt**. Vui lòng kiểm tra và xác nhận duyệt cấp BOD.",
              "wrap": true
            }
          ],
          "actions": [
            {
              "type": "Action.OpenUrl",
              "title": "✅ Phê duyệt",
              "url": approveUrl,
              "style": "positive"
            },
            {
              "type": "Action.OpenUrl",
              "title": "❌ Từ chối",
              "url": rejectUrl,
              "style": "destructive"
            },
            {
              "type": "Action.OpenUrl",
              "title": "🌐 Xem chi tiết đơn",
              "url": `${(process.env.FRONTEND_URL || 'http://10.0.0.36:4173').split(',')[0].trim()}/submissions?projectId=${projectId}`,
              "style": "default"
            }

          ]
        }
      }
    ]
  };

  try {
    await axios.post(TEAMS_WEBHOOK_URL, cardPayload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 8000
    });
    console.log(`✅ Sent Teams notification for ${projectId}`);
  } catch (error) {
    console.error(`❌ Failed to send Teams notification for ${projectId}:`, error.message);
  }
}

module.exports = {
  sendBODApprovalCard
};
