---
trigger: always_on
---

Giữ cấu trúc thư mục này và các form về sau cứ đi theo cấu trúc này, hoặc tạo folder mới để vô từng folder con của backend hoặc frontend

backend/
├── src/
│   ├── config/       (DB, environment)
│   ├── routes/       (Các API endpoints)
│   ├── middleware/   (Auth, Error handler)
│   ├── data/         (Các data JSON config)
│   └── app.js        (Express app)
├── scripts/          (TẤT CẢ các file utils/test chuyển vào đây)
│   ├── tests/
│   ├── migrations/
│   └── maintenance/
├── sql_scripts/      (Chứa các file .sql)
├── uploads/          (Hoặc di chuyển sang storage ngoài như đã làm)
├── server.js         (Entry point duy nhất)
├── package.json
└── .env

frontend/
├── src/
│   ├── assets/       (Hình ảnh, css)
│   ├── components/   (Phân vùng theo chức năng: ui, form, agenda, layout, ...)
│   ├── pages/        (Routing screens)
│   ├── services/     (Axios, API calls)
│   ├── utils/        (Hàm tiện ích)
│   ├── App.jsx
│   └── main.jsx
├── package.json
└── vite.config.js
