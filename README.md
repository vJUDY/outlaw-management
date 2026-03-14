# Outlaw RP — Secure Backend

## Project Structure
```
outlaw-server/
├── server.js              # Express entry point
├── package.json
├── .env.example           # Copy to .env and fill in
├── lib/
│   ├── db.js              # User store (bcrypt hashed passwords)
│   └── sheets.js          # Google Sheets fetcher (server-side only)
├── middleware/
│   └── auth.js            # requireAuth / requireAdmin guards
├── routes/
│   ├── auth.js            # POST /login, POST /logout, GET /api/me
│   ├── staff.js           # GET /api/me/data, GET /api/ranking
│   └── admin.js           # All /api/admin/* routes
└── public/
    └── index.html         # Frontend (UI only — no secrets)
```

## Security Architecture
```
Browser (UI only)
      │  fetch + HttpOnly cookie
      ▼
Express Server   ← All logic, passwords, API keys live here
      │
      ├─ bcrypt  (password hashing, 12 rounds)
      ├─ express-session (HttpOnly secure cookies)
      ├─ express-rate-limit (10 login attempts / 15 min)
      ├─ helmet (security headers + CSP)
      └─ Google Apps Script (never exposed to browser)
```

## API Routes
| Method | Route                        | Auth     | Description                  |
|--------|------------------------------|----------|------------------------------|
| POST   | /login                       | —        | Login (rate limited)         |
| POST   | /logout                      | Any      | Destroy session              |
| GET    | /api/me                      | Any      | Current session info         |
| GET    | /api/me/data                 | Staff    | My weekly stats              |
| GET    | /api/ranking                 | Staff    | Full monthly ranking         |
| GET    | /api/admin/users             | Admin    | All users list               |
| POST   | /api/admin/password          | Admin    | Update one user password     |
| POST   | /api/admin/password/bulk     | Admin    | Bulk update passwords        |
| POST   | /api/admin/password/admin    | Admin    | Change admin password        |
| GET    | /api/admin/gid               | Admin    | Get current sheet GID        |
| POST   | /api/admin/gid               | Admin    | Update sheet GID             |
| POST   | /api/admin/sync              | Admin    | Force sheet re-sync          |

## Setup & Run

### 1. Install dependencies
```bash
cd outlaw-server
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
# Edit .env with your values
```

Fill in `.env`:
```
SESSION_SECRET=<run: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))">
GSCRIPT_URL=https://script.google.com/macros/s/YOUR_ID/exec
ADMIN_PASSWORD=YourSecureAdminPassword
SHEET_GID=43036446
ALLOWED_ORIGIN=https://yourdomain.com
NODE_ENV=production
```

### 3. Run
```bash
# Development (auto-restart)
npm run dev

# Production
npm start
```

### 4. Deploy to a server (e.g. Railway / Render / VPS)
- Set all `.env` values as environment variables in your host
- Make sure `NODE_ENV=production` so cookies are Secure + HTTPS-only
- Serve on HTTPS — the session cookie requires it in production

## First Login
- **Admin:** username `ADMIN`, password = whatever you set in `ADMIN_PASSWORD`
- **Staff:** username = their OL name (e.g. `OL | sultan`), default password = `1234`
  - Go to Admin panel → set their passwords → save

## Google Apps Script
The Apps Script URL stays in `.env` and is **never sent to the browser**.
Make sure the script is deployed as "Anyone" (not "Anyone with a Google account")
so the server can fetch it without OAuth.
