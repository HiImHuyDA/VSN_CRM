# Cloud Deployment Guide - CSR Public Evaluation Form & Sync API

This guide details the deployment of the public-facing CSR Evaluation Form (built in React) and its accompanying Cloud database API. This architecture enables clients to submit feedback securely, which is then pulled into the local CRM system (`CSR_DB`) via the automatic Cloud Sync Scheduler.

In addition, configuring evaluation forms and criteria on the local CRM will automatically push the active criteria structure to the cloud database, enabling the public React form to load items dynamically.

---

## 1. Cloud Database Schema (MongoDB Atlas / Supabase)

### Choice A: MongoDB Atlas (NoSQL) - Recommended

1. Create a collection named `feedbacks` for customer submissions:
```json
{
  "_id": "ObjectId",
  "projectId": "CSR-2026-0001",
  "reviewerName": "Nguyễn Văn A",
  "reviews": [
    {
      "criteriaName": "Thái độ tiếp đón",
      "rating": 5,
      "comment": "Rất chu đáo và lịch sự"
    },
    {
      "criteriaName": "Phương tiện di chuyển",
      "rating": 4,
      "comment": "Xe sạch sẽ nhưng hơi chật"
    }
  ],
  "isSynced": false,
  "createdAt": "2026-06-26T12:00:00.000Z"
}
```

2. Create a collection named `criteria_configs` to store the dynamically pushed form configurations:
```json
{
  "_id": "ObjectId",
  "formId": 1,
  "formName": "Khảo sát Đón tiếp Khách hàng (Mặc định)",
  "sendToCustomer": true,
  "sendToPrd": false,
  "sendToSubmitter": false,
  "sendToBod": false,
  "isActive": true,
  "criteria": [
    {
      "name": "Thái độ tiếp đón",
      "group": "Tiếp đón",
      "description": "Thái độ đón tiếp của lễ tân, bảo vệ",
      "sortOrder": 1,
      "isRequired": true
    }
  ],
  "updatedAt": "2026-06-27T04:30:00.000Z"
}
```

---

### Choice B: Supabase (PostgreSQL)

Create the following tables:
```sql
CREATE TABLE feedbacks (
    id SERIAL PRIMARY KEY,
    project_id VARCHAR(100) NOT NULL,
    reviewer_name VARCHAR(200),
    is_synced BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE feedback_details (
    id SERIAL PRIMARY KEY,
    feedback_id INT REFERENCES feedbacks(id) ON DELETE CASCADE,
    criteria_name VARCHAR(200) NOT NULL,
    rating INT DEFAULT 5,
    comment TEXT
);

CREATE TABLE criteria_configs (
    form_id INT PRIMARY KEY,
    form_name VARCHAR(200) NOT NULL,
    send_to_customer BOOLEAN DEFAULT FALSE,
    send_to_prd BOOLEAN DEFAULT FALSE,
    send_to_submitter BOOLEAN DEFAULT FALSE,
    send_to_bod BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    criteria_json TEXT, -- JSON Array of criteria items
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 2. Serverless Backend Sync API (Node.js/Vercel)

Deploy these serverless functions under `/api/feedbacks` to handle submissions, synchronize criteria configurations, and communicate back with the CRM worker. Secure internal endpoints using the `x-api-key` header.

### `POST /api/feedbacks` (Public Endpoint - Submits Feedback)
```javascript
// api/feedbacks/submit.js
import { connectToDatabase } from '../../utils/db'; // Custom DB connection helper

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { projectId, reviewerName, reviews } = req.body;

  if (!projectId || !Array.isArray(reviews) || reviews.length === 0) {
    return res.status(400).json({ error: 'Invalid data schema. Project ID and reviews are required.' });
  }

  try {
    const db = await connectToDatabase();
    const result = await db.collection('feedbacks').insertOne({
      projectId,
      reviewerName: reviewerName || 'Khách hàng',
      reviews: reviews.map(r => ({
        criteriaName: r.criteriaName,
        rating: parseInt(r.rating) || 5,
        comment: r.comment || ''
      })),
      isSynced: false,
      createdAt: new Date()
    });

    return res.status(201).json({ success: true, id: result.insertedId });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
```

### `GET /api/feedbacks/pending` (Internal Sync Endpoint - Retrieve pending reviews)
```javascript
// api/feedbacks/pending.js
import { connectToDatabase } from '../../utils/db';

export default async function handler(req, res) {
  const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
  if (apiKey !== process.env.CLOUD_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized API Access' });
  }

  try {
    const db = await connectToDatabase();
    const pending = await db.collection('feedbacks')
      .find({ isSynced: false })
      .toArray();

    const mapped = pending.map(item => ({
      id: item._id.toString(),
      projectId: item.projectId,
      reviewerName: item.reviewerName,
      reviews: item.reviews
    }));

    return res.status(200).json(mapped);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
```

### `POST /api/feedbacks/mark-synced` (Internal Sync Endpoint - Acknowledge sync)
```javascript
// api/feedbacks/mark-synced.js
import { connectToDatabase } from '../../utils/db';
import { ObjectId } from 'mongodb';

export default async function handler(req, res) {
  const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
  if (apiKey !== process.env.CLOUD_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized API Access' });
  }

  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'Missing or invalid ids array' });
  }

  try {
    const db = await connectToDatabase();
    const objectIds = ids.map(id => new ObjectId(id));
    
    await db.collection('feedbacks').updateMany(
      { _id: { $in: objectIds } },
      { $set: { isSynced: true, syncedAt: new Date() } }
    );

    return res.status(200).json({ success: true, message: `Successfully marked ${ids.length} records as synced.` });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
```

### `POST` & `GET` `/api/feedbacks/criteria` (Dual-Purpose Configuration Endpoint)
- `POST` is called by the CRM Local backend to sync criteria configuration schema.
- `GET` is called by the Public React web form to fetch active customer criteria dynamically.

```javascript
// api/feedbacks/criteria.js
import { connectToDatabase } from '../../utils/db';

export default async function handler(req, res) {
  const db = await connectToDatabase();

  if (req.method === 'POST') {
    // Authenticate pushing from CRM local
    const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
    if (apiKey !== process.env.CLOUD_API_KEY) {
      return res.status(401).json({ error: 'Unauthorized API Access' });
    }

    const { formId, formName, sendToCustomer, sendToPrd, sendToSubmitter, sendToBod, isActive, criteria } = req.body;
    if (!formId || !formName) {
      return res.status(400).json({ error: 'Missing formId or formName parameters.' });
    }

    try {
      await db.collection('criteria_configs').updateOne(
        { formId: parseInt(formId) },
        { 
          $set: {
            formName,
            sendToCustomer: !!sendToCustomer,
            sendToPrd: !!sendToPrd,
            sendToSubmitter: !!sendToSubmitter,
            sendToBod: !!sendToBod,
            isActive: !!isActive,
            criteria: criteria || [],
            updatedAt: new Date()
          }
        },
        { upsert: true }
      );
      return res.status(200).json({ success: true, message: 'Criteria schema synced to Cloud.' });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  } else if (req.method === 'GET') {
    // Fetch the active form criteria targeted for customers
    try {
      const activeForm = await db.collection('criteria_configs').findOne({
        isActive: true,
        sendToCustomer: true
      });

      if (!activeForm) {
        return res.status(404).json({ error: 'No active customer criteria form found on cloud database.' });
      }

      return res.status(200).json(activeForm.criteria || []);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}
```

---

## 3. React Public Evaluation Form Component (Dynamic Loading)

Deploy this React component to Vercel/Netlify. It fetches survey criteria dynamically from the Cloud Database via the `/api/feedbacks/criteria` endpoint.

```jsx
import React, { useState, useEffect } from 'react';

export default function PublicEvaluationForm() {
  const [projectId, setProjectId] = useState('');
  const [reviewerName, setReviewerName] = useState('');
  const [criteria, setCriteria] = useState([]);
  const [ratings, setRatings] = useState({});
  const [comments, setComments] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [loadingCriteria, setLoadingCriteria] = useState(true);
  const [error, setError] = useState('');

  // Extract projectId from URL query parameter (e.g. ?p=CSR-2026-0001)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const p = params.get('p');
    if (p) setProjectId(p);

    // Fetch survey criteria dynamically from cloud DB
    setLoadingCriteria(true);
    fetch('YOUR_CLOUD_API_URL/feedbacks/criteria')
      .then(res => {
        if (!res.ok) throw new Error('Không thể tải cấu hình tiêu chí đánh giá.');
        return res.json();
      })
      .then(data => {
        if (Array.isArray(data)) {
          setCriteria(data);
        }
      })
      .catch(err => {
        console.error('Error fetching dynamic criteria:', err);
        setError('Không thể tải các tiêu chí đánh giá từ hệ thống. Vui lòng liên hệ hỗ trợ.');
      })
      .finally(() => {
        setLoadingCriteria(false);
      });
  }, []);

  const handleRate = (critName, val) => {
    setRatings(prev => ({ ...prev, [critName]: val }));
  };

  const handleCommentChange = (critName, val) => {
    setComments(prev => ({ ...prev, [critName]: val }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!projectId.trim()) {
      setError('Vui lòng cung cấp Mã đơn tiếp đón.');
      return;
    }

    // Verify required criteria ratings
    for (const c of criteria) {
      if (c.isRequired && !ratings[c.name]) {
        setError(`Vui lòng đánh giá số sao cho tiêu chí: ${c.name}`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        projectId: projectId.trim(),
        reviewerName: reviewerName.trim() || 'Ẩn danh',
        reviews: criteria.map(c => ({
          criteriaName: c.name,
          rating: ratings[c.name] || 5,
          comment: comments[c.name] || ''
        }))
      };

      const res = await fetch('YOUR_CLOUD_API_URL/feedbacks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).then(r => r.json());

      if (res.success) {
        setSuccess(true);
      } else {
        setError(res.error || 'Có lỗi xảy ra khi gửi đánh giá.');
      }
    } catch (err) {
      setError('Lỗi kết nối mạng, vui lòng thử lại sau.');
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="success-screen">
        <h2>🎉 Cảm ơn quý khách!</h2>
        <p>Ý kiến phản hồi đóng góp của quý khách đã được ghi nhận và gửi thành công về hệ thống.</p>
      </div>
    );
  }

  if (loadingCriteria) {
    return (
      <div className="loading-screen">
        <p>Đang tải cấu hình biểu mẫu đánh giá...</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="form-container">
      <h2>Khảo sát Ý kiến Đón tiếp Khách hàng</h2>
      {error && <div className="error-alert">{error}</div>}

      <div className="form-group">
        <label>Mã Đơn Tiếp Đón *</label>
        <input 
          type="text" 
          value={projectId} 
          onChange={e => setProjectId(e.target.value)} 
          placeholder="Ví dụ: CSR-2026-0001" 
          required 
        />
      </div>

      <div className="form-group">
        <label>Họ và tên Quý khách (Tùy chọn)</label>
        <input 
          type="text" 
          value={reviewerName} 
          onChange={e => setReviewerName(e.target.value)} 
          placeholder="Nhập tên của quý khách" 
        />
      </div>

      <div className="criteria-list">
        {criteria.map(c => (
          <div key={c.name} className="criteria-item">
            <h4>{c.name} {c.isRequired && <span className="req">*</span>}</h4>
            {c.description && <p className="criteria-desc">{c.description}</p>}
            <div className="star-rating">
              {[1, 2, 3, 4, 5].map(val => (
                <span 
                  key={val} 
                  className={ratings[c.name] >= val ? 'star active' : 'star'}
                  onClick={() => handleRate(c.name, val)}
                >
                  ★
                </span>
              ))}
            </div>
            <textarea 
              value={comments[c.name] || ''} 
              onChange={e => handleCommentChange(c.name, e.target.value)}
              placeholder="Nhập phản hồi chi tiết (nếu có)..."
            />
          </div>
        ))}
      </div>

      <button type="submit" disabled={submitting}>
        {submitting ? 'Đang gửi...' : 'Gửi đánh giá'}
      </button>
    </form>
  );
}
```
