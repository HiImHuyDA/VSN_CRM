const axios = require('axios');

async function getAccessToken() {
    const tenantId = process.env.TENANT_ID;
    const clientId = process.env.CLIENT_ID;
    const clientSecret = process.env.CLIENT_SECRET;

    if (!tenantId || !clientId || !clientSecret) {
        throw new Error('Thiếu cấu hình Azure AD (TENANT_ID, CLIENT_ID, CLIENT_SECRET)');
    }

    const url = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
    const params = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        scope: 'https://graph.microsoft.com/.default',
        grant_type: 'client_credentials'
    });

    const response = await axios.post(url, params.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 8000
    });

    return response.data.access_token;
}

async function getCalendarEvents(roomEmail, date, accessToken) {
    // startOfDay and endOfDay in ISO format
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);

    const url = `https://graph.microsoft.com/v1.0/users/${roomEmail}/calendar/calendarView?startDateTime=${start.toISOString()}&endDateTime=${end.toISOString()}`;
    
    const response = await axios.get(url, {
        headers: {
            Authorization: `Bearer ${accessToken}`,
            Prefer: 'outlook.timezone="SE Asia Standard Time"' // or UTC
        },
        timeout: 8000
    });

    return response.data.value.map(event => {
        // Parse start/end to HH:mm local time for frontend CalendarChecker
        const startDt = new Date(event.start.dateTime);
        const endDt   = new Date(event.end.dateTime);
        const pad = (n) => String(n).padStart(2, '0');
        const startLocal = `${pad(startDt.getHours())}:${pad(startDt.getMinutes())}`;
        const endLocal   = `${pad(endDt.getHours())}:${pad(endDt.getMinutes())}`;

        return {
            subject: event.subject,
            start: event.start.dateTime,
            end: event.end.dateTime,
            startLocal,
            endLocal,
            organizer: event.organizer?.emailAddress?.name || ''
        };
    });
}

module.exports = { getAccessToken, getCalendarEvents };
