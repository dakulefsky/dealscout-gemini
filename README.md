# DealScout — Local Development Setup

A hand-reviewed Amazon affiliate deals site, migrated from Base44 to a fully open-source stack.

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, Vite, Tailwind CSS, shadcn/ui, React Router |
| **Backend** | Express.js (Node.js) |
| **Database** | SQLite via `better-sqlite3` (file-based, zero setup) |
| **Auth** | JWT (`jsonwebtoken`) + bcrypt — no external service needed |

---

## Prerequisites

- **Node.js** 18 or later — [nodejs.org](https://nodejs.org)
- **npm** (comes with Node)
- Visual Studio Code — [code.visualstudio.com](https://code.visualstudio.com)

---

## Getting Started

### 1. Open the project in VS Code

```bash
code /path/to/dealscout
```

### 2. Install dependencies

```bash
# Install frontend deps
npm install

# Install backend deps
cd server && npm install && cd ..
```

### 3. Configure the backend

```bash
cp server/.env.example server/.env
```

Edit `server/.env` and set a strong `JWT_SECRET`.

### 4. Start the backend (Terminal 1)

```bash
cd server
node --watch index.js
```

You should see:
```
[db] Seeded admin user: admin@dealscout.local / admin123
[server] DealScout API running on http://localhost:3001
```

### 5. Start the frontend (Terminal 2)

```bash
npm run dev:frontend
```

Open **http://localhost:5173** in your browser.

---

## Default Admin Account

| Field | Value |
|---|---|
| Email | `admin@dealscout.local` |
| Password | `admin123` |

Change the password immediately after your first login in production.

---

## What Was Removed (Base44-Specific)

| Removed | Replaced With |
|---|---|
| `globalThis.__B44_DB__` preamble | — (fully eliminated) |
| `db.entities.Deal.*` / `db.entities.Category.*` | `fetch` calls to `/api/deals`, `/api/categories` |
| `db.auth.me()`, `db.auth.login()`, etc. | JWT auth via `/api/auth/*` |
| `db.functions.invoke("amazonRedirect")` | `POST /api/functions/amazon-redirect` |
| `db.functions.invoke("fetchRainforestDeals")` | `POST /api/functions/fetch-deals` (stub — see below) |
| `@base44/sdk`, `@base44/vite-plugin` | `@vitejs/plugin-react` |
| `AuthContext.jsx` (Base44 auth) | Standard JWT/localStorage context |
| `app-params.js` (Base44 bootstrap) | — (removed) |
| Base44 `Image` component | Standard `<img>` with fallback (`src/components/ui/image.jsx`) |

---

## Rainforest API Integration (optional)

The "Fetch New Deals" button in the Admin panel calls `POST /api/functions/fetch-deals`.
To wire it up:

1. Get an API key from [rainforestapi.com](https://www.rainforestapi.com/)
2. Add `RAINFOREST_API_KEY=your_key` to `server/.env`
3. Implement the fetch logic in `server/routes/functions.js`

Without it, the button returns a helpful `501 Not Implemented` message.

---

## OTP Codes & Password Resets (Local Dev)

No email service is configured. All OTP codes and password reset links are **printed to the backend console** instead. In production, wire up [nodemailer](https://nodemailer.com/) or [Resend](https://resend.com/) in `server/routes/auth.js`.

---

## Seeding Sample Deals

To add a deal via the API (with the admin token):

```bash
# 1. Log in to get a token
curl -X POST http://localhost:3001/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@dealscout.local","password":"admin123"}'

# 2. Create a deal (replace TOKEN)
curl -X POST http://localhost:3001/api/deals \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer TOKEN' \
  -d '{
    "title": "Sony WH-1000XM5 Headphones",
    "asin": "B09XS7JWHH",
    "category": "Electronics",
    "originalPrice": 399.99,
    "salePrice": 249.99,
    "discountPercent": 37,
    "productUrl": "https://www.amazon.com/dp/B09XS7JWHH",
    "imageUrl": "https://m.media-amazon.com/images/I/61eaRIOHH1L._AC_SL1500_.jpg",
    "rating": 4.4,
    "ratingsTotal": 18291,
    "shortBio": "Industry-leading noise cancellation with 30-hour battery.",
    "status": "APPROVED"
  }'
```

---

## Upgrading to PostgreSQL (optional)

Swap `better-sqlite3` for `pg` (node-postgres) in `server/db.js`. The SQL schema in `db.js` is standard and compatible with PostgreSQL with minor type adjustments (`INTEGER` → `BIGINT`, `TEXT` → `TEXT`, etc.).

For a hosted option, [Supabase](https://supabase.com) provides a free PostgreSQL instance.
