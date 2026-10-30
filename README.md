# Doctor Tracker — API

A secure REST API for managing doctors and their patients, with server-side search, filtering, pagination and a single-request analytics endpoint for the admin dashboard. Built with **Node.js, Express and MongoDB (Mongoose)**, it runs as a standalone service that the Next.js client talks to over REST.

---

## Setup

**Requirements:** Node.js 18.18+ and a MongoDB 6+ database (local install or a free MongoDB Atlas cluster).

```bash
cd backend
npm install
cp .env.example .env          # then edit MONGODB_URI and JWT_SECRET
npm run seed:fresh            # admin user + 30 doctors + 800 patients
npm run dev                   # http://localhost:5000
```

Log in with the seeded admin: `admin@doctortracker.com` / `Admin@12345` (change via `ADMIN_*` in `.env`).

| Script | What it does |
| --- | --- |
| `npm run dev` | Start with auto-reload (nodemon) |
| `npm start` | Start for production |
| `npm run seed` | Add demo data (keeps existing) — flags: `--doctors=50 --patients=5000 --fresh` |
| `npm run seed:fresh` | Wipe doctors & patients, then seed |
| `npm run sync-indexes` | Create/drop indexes to match the schemas (run on deploy) |

### Environment variables

| Variable | Default | Notes |
| --- | --- | --- |
| `MONGODB_URI` | — | **Required** |
| `JWT_SECRET` | — | **Required**, ≥ 32 chars |
| `PORT` | `5000` | |
| `ACCESS_TOKEN_TTL` | `15m` | Access JWT lifetime — `900`, `15m`, `1h` |
| `REFRESH_TOKEN_TTL` | `7d` | Refresh token lifetime (sliding — renewed on every refresh) |
| `CLIENT_URL` | `http://localhost:3000` | Allowed CORS origin(s), comma separated |
| `ACCESS_COOKIE_NAME` / `REFRESH_COOKIE_NAME` | `dt_access` / `dt_refresh` | httpOnly cookie names |
| `ADMIN_NAME` / `ADMIN_EMAIL` / `ADMIN_PASSWORD` | see `.env.example` | Used by the seed script |

The server validates all variables at boot and exits with a clear message if any are wrong.

### Postman

Import both files from `postman/` into Postman (**Import → Files**):

- `Doctor-Tracker.postman_collection.json` — all 22 requests with example bodies, documented query params and tests
- `Doctor-Tracker.local.postman_environment.json` — `baseUrl` and admin credentials

Run **Auth → Login** first: the access and refresh tokens are saved automatically and the access token is used by every request. When it expires (15 min), run **Auth → Refresh token**. Creating a doctor or patient saves its id, so the other requests work without copy-pasting. You can also click **Run collection** to execute everything in order (Cleanup deletes the test data it created, Session end logs out).

---

## Architecture

```
Next.js client ──HTTP/JSON──▶ Express API ──Mongoose──▶ MongoDB
   (cookie or Bearer token)        │
                                   ├─ helmet · cors · compression · rate limit
                                   ├─ routes      → URL + middleware wiring
                                   ├─ validate()  → zod parses params/query/body into req.valid
                                   ├─ protect()   → JWT check, loads user; authorize(role)
                                   ├─ controllers → thin HTTP layer (status codes, envelopes)
                                   ├─ services    → business logic & all database queries
                                   └─ errorHandler→ one JSON error shape for every failure
```

```
src/
├── app.js / server.js      Express app factory · boot + graceful shutdown
├── config/                 env validation (zod) · MongoDB connection
├── constants.js            roles, genders, conditions, blood groups
├── models/                 User · Doctor · Patient (schemas + indexes)
├── validators/             zod schemas per resource
├── middleware/             auth · validate · errorHandler
├── services/               auth · doctor · patient · dashboard
├── controllers/            request → service → response
├── routes/                 /auth /doctors /patients /dashboard /health
├── utils/                  search tokens, pagination, ApiError, asyncHandler
└── scripts/                seed · syncIndexes
```

**Request flow:** a request passes security middleware → route → `validate` (rejects bad input with 422 before touching the DB) → `protect` → controller → service (query) → `sendSuccess`. Any thrown error ends in `errorHandler`.

### Response format

```jsonc
// success
{ "success": true, "data": [...], "meta": { "page": 1, "limit": 10, "total": 812, "totalPages": 82, "hasNextPage": true, "hasPrevPage": false } }
// error — `code` is stable and safe to branch on in the client
{ "success": false, "code": "VALIDATION_ERROR", "message": "Validation failed", "errors": [{ "field": "email", "message": "Invalid email" }] }
```

Status codes: `400` bad id/JSON · `401` not logged in / expired · `403` role or CORS · `404` · `409` duplicate email or refresh race · `422` validation · `429` rate limit.

---

## API reference

All routes are under `/api`. Everything except `/health` and `/auth/login|refresh|logout` requires an access token — either the httpOnly cookie set on login (browser: send requests with `credentials: 'include'`) or `Authorization: Bearer <accessToken>`.

### Auth
| Method | Path | Body / notes |
| --- | --- | --- |
| POST | `/auth/login` | `{ email, password }` → sets both cookies, returns `{ user, accessToken, accessTokenExpiresAt, refreshToken, refreshTokenExpiresAt }`. 10 failed attempts / 15 min |
| POST | `/auth/refresh` | Refresh token from the cookie, or `{ refreshToken }` in the body → a **new** access + refresh pair (the old refresh token stops working) |
| POST | `/auth/logout` | Revokes the current refresh token and clears both cookies |
| POST | `/auth/logout-all` | Revokes every session of the current user (all devices) |
| GET | `/auth/me` | Current user |
| POST | `/auth/register` | **Admin.** `{ name, email, password, role? }` creates a staff/admin user |

### Doctors
| Method | Path | Notes |
| --- | --- | --- |
| GET | `/doctors` | List with `patientCount`. Query: `page, limit, search, specialization, hospital, from, to, sortBy (createdAt\|name\|specialization\|hospital), order` |
| GET | `/doctors/filters` | Distinct specializations & hospitals for dropdowns |
| POST | `/doctors` | `{ name, specialization, hospital, phone, email }` |
| GET | `/doctors/:id` | Doctor + `patientCount` + `conditionBreakdown` |
| PATCH | `/doctors/:id` | Any subset of the fields above |
| DELETE | `/doctors/:id` | **Admin.** Also deletes that doctor's patients |
| GET | `/doctors/:id/patients` | That doctor's patients — same query params as `/patients` |
| POST | `/doctors/:id/patients` | Add a patient under this doctor (patient body, no `doctor` field) |
| DELETE | `/doctors/:id/patients/:patientId` | **Admin.** Remove a patient from this doctor's list |

### Patients
| Method | Path | Notes |
| --- | --- | --- |
| GET | `/patients` | Query: `page, limit, search, doctor, condition (comma list), gender, minAge, maxAge, from, to, dateField (admissionDate\|createdAt), sortBy (createdAt\|admissionDate\|name\|age), order`. Each patient includes `doctor { name, specialization, hospital }` |
| POST | `/patients` | `{ name, age, gender, phone, doctor, email?, condition?, diagnosis?, bloodGroup?, address?, admissionDate?, notes? }` |
| GET | `/patients/:id` | |
| PATCH | `/patients/:id` | Any subset; `""` clears an optional field; changing `doctor` reassigns |
| DELETE | `/patients/:id` | **Admin** |

`condition`: `stable · recovering · under_observation · critical · discharged` — `gender`: `male · female · other` — dates accept `YYYY-MM-DD` (a bare `to` date covers the whole day) or full ISO strings.

### Dashboard
`GET /dashboard/summary?from=&to=&granularity=auto|day|month&tz=Asia/Dhaka&topDoctors=10`

Returns, in one request: `totals` (doctors, patients, critical, avg per doctor, admissions in range vs previous period with % change, new doctors), `patientsByCondition`, `patientsByGender`, `patientsByAgeGroup`, `patientsPerDoctor` (top N), `doctorsBySpecialization`, `admissionsTimeline` (gap-filled with zeros, bucketed in the viewer's timezone), and `recentPatients`. Defaults to the last 30 days.

### Health
`GET /health` → `200` with DB status, or `503` when the database is down.

---

## Technical decisions

### 1. Indexed token search instead of regex or `$text`

Searching with `{ name: /term/i }` is the usual approach, but a case-insensitive, unanchored regex can't use an index, so every search scans the whole collection. MongoDB's `$text` index is fast but only matches whole words — typing "Ay" wouldn't find "Ayesha", which breaks search-as-you-type.

Instead, each document stores a `searchTokens` array: the lower-cased words of its searchable fields plus the phone number as digits (`"Dr. Ayesha Rahman"` → `["dr", "ayesha", "rahman", …]`), rebuilt automatically in a `pre('validate')` hook. A multikey index covers it, and the query is split the same way into anchored prefix regexes (`/^ay/`), which MongoDB answers from the index. Result: prefix matching on any word of name, email, phone, specialization, hospital or diagnosis, at index speed, and multi-word queries narrow the result ("ayesha card"). The trade-off is a little extra storage and no mid-word matching — the right call for a name-lookup UI.

### 2. Compound indexes shaped by the actual queries, and a single-request dashboard

Indexes follow the *equality → sort → range* rule for the queries the UI really sends — e.g. `{ doctor: 1, createdAt: -1 }` serves "this doctor's patients, newest first" without an in-memory sort, and `{ condition: 1, admissionDate: -1 }` serves the condition filter combined with a date range. Every list sorts with `_id` as a tie-breaker so pages never overlap or skip records. Totals use `estimatedDocumentCount()` (O(1) metadata) when no filter applies; filtered totals and the page itself run in parallel. Doctor lists get their patient counts from one grouped `$in` aggregation for the whole page instead of N separate counts.

The dashboard returns every metric from one endpoint so the client renders all charts after a single round trip. Each metric runs as its own small aggregation in parallel rather than inside one `$facet` — `$facet` sub-pipelines can't use indexes, while separate pipelines let the date-bounded ones (timeline, admissions in range, previous-period comparison) use the `admissionDate` index. The timeline is grouped in the viewer's timezone and gap-filled with zeros so charts don't draw misleading lines across missing days. At much larger scale the next step would be pre-aggregating into a summary collection with `$merge` on a schedule.

### Also worth noting

- **Validation at the edge with zod**: params, query and body are parsed (coerced, defaulted, unknown keys stripped) into `req.valid`; services never see raw input, so fields like `searchTokens` or `_id` can't be injected.
- **Auth**: see the next section. Each request re-loads the user, so deleted accounts lose access immediately. Login is rate-limited, and unknown emails still run a bcrypt comparison so timing doesn't reveal which emails exist.
- **Roles**: `admin` can do everything; `staff` can view, create and edit but not delete.

---

## Authentication: access + refresh tokens

| | Access token | Refresh token |
| --- | --- | --- |
| Format | JWT (HS256), `type: "access"` | 64 random bytes, opaque |
| Lifetime | 15 min | 7 days, renewed on each refresh |
| Stored on server | No (stateless) | SHA-256 hash in `refreshtokens`, auto-deleted by a TTL index |
| Browser storage | httpOnly cookie, `path=/` | httpOnly cookie, `path=/api/auth` — never sent with normal API calls |
| Sent by API clients as | `Authorization: Bearer …` | `{ "refreshToken": "…" }` body |

**Why two tokens:** a stolen access token is only useful for 15 minutes, and checking it needs no database read for the token itself. The long-lived credential is the refresh token, which the server can revoke at any time (logout, logout-all, or suspected theft).

**Rotation and reuse detection:** every refresh token works exactly once — `/auth/refresh` atomically marks it used (`findOneAndUpdate` on `revokedAt: null`, so two parallel calls can't both succeed) and returns a new pair in the same *family*. If a token that was already rotated is presented again, someone has a copy of it, so the whole family is revoked and both the attacker and the user must log in again (`REFRESH_TOKEN_REUSED`). A 10-second grace window answers `409 REFRESH_IN_PROGRESS` instead, so two browser tabs refreshing at the same moment aren't mistaken for theft.

**Client flow:**

```
request ──▶ 401 { code: "TOKEN_EXPIRED" }
              └─▶ POST /auth/refresh (one shared in-flight call)
                    ├─ 200 → retry the original request
                    ├─ 409 REFRESH_IN_PROGRESS → wait briefly, retry the original request
                    └─ 401 → session over → redirect to /login
```

| Code | Meaning |
| --- | --- |
| `AUTH_REQUIRED` | No access token sent |
| `TOKEN_EXPIRED` | Access token expired → refresh |
| `TOKEN_INVALID` | Malformed/forged token, or user deleted |
| `INVALID_CREDENTIALS` | Wrong email or password |
| `REFRESH_TOKEN_MISSING` / `REFRESH_TOKEN_INVALID` | No, unknown, expired or logged-out refresh token → log in |
| `REFRESH_TOKEN_REUSED` | Replay of a rotated token — session revoked → log in |
| `REFRESH_IN_PROGRESS` | Parallel refresh just happened → retry |

