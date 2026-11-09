# Product Management System (PMS) with Expiry-Date Monitoring

A professional, full-stack inventory management system focused on product expiry tracking. Built as a final-year university project.

## Features

- **Role-based access**: Administrator & Staff
- **Product Management**: CRUD, search, filter, sort, pagination
- **Expiry Monitoring**: Automatic status calculation (Safe / 30 / 14 / 7 / 3 days / Expired)
- **Alerts & Notifications**: In-app alerts with unread badge
- **Dashboard**: Stats cards + Chart.js visualizations
- **Reports**: Printable inventory summary
- **Staff Management**: Admin can create/edit/deactivate staff accounts
- **Activity Logs**: Full audit trail (Admin only)
- **Dark Mode**, responsive design, modern UI

## Tech Stack

- Frontend: HTML5, CSS3, Bootstrap 5, Chart.js, Vanilla JS
- Backend: Node.js, Express.js
- Database: MongoDB (Mongoose)
- Auth: JWT + bcrypt

## Quick Start

### Prerequisites
- Node.js 18+
- MongoDB running locally (or update `.env` with your connection string)



This creates:
- Admin: `admin@company.com` / `admin123`
- 5 Staff accounts (password: `staff123`)
- 40+ sample products with mixed expiry statuses
- Alerts and activity logs

### Run
```bash
npm start
# or for development
npm run dev
```

Open http://localhost:3000

## Login Credentials

| Role  | Email               | Password  |
|-------|---------------------|-----------|
| Admin | admin@company.com   | admin123  |
| Staff | john@company.com    | staff123  |
| Staff | mary@company.com    | staff123  |
| Staff | david@company.com   | staff123  |
| Staff | sarah@company.com   | staff123  |
| Staff | michael@company.com | staff123  |

## Project Structure

```
pms/
├── models/          # Mongoose schemas
├── routes/          # Express API routes
├── middleware/      # Auth middleware
├── utils/           # Logger & expiry checker
├── public/          # Frontend (HTML/CSS/JS)
├── server.js        # Entry point
├── seed.js          # Demo data seeder
└── .env
```

## API Overview

- `POST /api/auth/login`
- `GET  /api/products` (with query filters)
- `POST /api/products`
- `PUT  /api/products/:id`
- `DELETE /api/products/:id`
- `GET  /api/products/stats/dashboard`
- `GET  /api/alerts`
- `GET  /api/users` (admin)
- `GET  /api/logs` (admin)
- `GET  /api/reports`

