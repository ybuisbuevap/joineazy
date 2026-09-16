# Student, Group & Assignment Management System

A role-based full-stack app for the Joineazy Full Stack Internship technical task. Students form
groups, add members, and confirm assignment submissions. Professors (admins) post assignments and
track group-wise progress.

## Overview

Two roles share one app, separated by JWT-encoded role checks:

- **Student**: register/login, create or join a group, add members by email, view assignments,
  open the OneDrive submission link, confirm submission with a two-step "Yes, I have submitted" ->
  confirm flow, and see a live progress bar for their group.
- **Admin**: register/login, create assignments (title, description, due date, OneDrive link),
  and view group-wise submission tracking with summary completion counts.

## Architecture

```
Browser --HTTPS--> React + Tailwind frontend --REST + JWT--> Express API --SQL--> PostgreSQL
```

- **Frontend**: React (Vite) + Tailwind CSS. `AuthContext` holds the JWT and user in
  `localStorage`; `ProtectedRoute` gates `/student` and `/admin` by role.
- **Backend**: Node.js + Express. Routes are grouped by resource (`auth`, `groups`,
  `assignments`, `submissions`, `admin`). A single `requireAuth` middleware verifies the JWT on
  every protected route, and `requireRole('admin')` gates admin-only routes.
- **Database**: PostgreSQL, 5 tables (see schema below).
- **Deployment**: Docker Compose runs three services (`frontend`, `backend`, `postgres`) with a
  named volume for Postgres data persistence and a healthcheck so the backend waits for Postgres
  to be ready before starting.

## Database schema

```
users (id, name, email, password_hash, role)
  |
  |--< group_members >--| groups_table (id, name, created_by)
  |
groups_table --< assignments (target_group_id, nullable = assigned to all groups)
  |
assignments --< submissions (assignment_id, group_id, confirmed_by, confirmed_at)
```

- `users`: `role` is either `student` or `admin`.
- `groups_table`: named `groups_table` (not `groups`) because `group` is a reserved word in SQL.
- `group_members`: many-to-many join between `users` and `groups_table`.
- `assignments`: `target_group_id` is nullable — null means the assignment applies to all groups.
- `submissions`: unique on `(assignment_id, group_id)` so a group can only have one submission
  record per assignment; confirming again updates it rather than duplicating it.

Full DDL is in `backend/src/db/schema.sql` and is auto-loaded into Postgres on first container
start via Docker's `docker-entrypoint-initdb.d` mechanism.

## API endpoints

| Method | Endpoint                        | Auth          | Description                              |
|--------|----------------------------------|---------------|-------------------------------------------|
| POST   | `/auth/register`                | none          | Create an account (student or admin)      |
| POST   | `/auth/login`                   | none          | Log in, returns a JWT                     |
| POST   | `/groups`                       | student/admin | Create a group (creator auto-joins)       |
| GET    | `/groups/mine`                  | any           | Groups the logged-in user belongs to      |
| POST   | `/groups/:id/members`           | any           | Add a student to a group by email         |
| GET    | `/groups/:id/members`           | any           | List a group's members                    |
| GET    | `/assignments`                  | any           | List all assignments                      |
| POST   | `/assignments`                  | admin         | Create an assignment                      |
| PUT    | `/assignments/:id`              | admin         | Edit an assignment                        |
| POST   | `/submissions/confirm`          | any           | Finalize a group's submission             |
| GET    | `/submissions/group/:groupId`   | any           | Progress (done/total) for one group       |
| GET    | `/admin/progress`               | admin         | Group x assignment submission matrix      |

All protected routes expect `Authorization: Bearer <token>`.

## Setup & run instructions

### Option A: Docker (recommended)

```bash
docker compose up --build
```

- Frontend: http://localhost:5173
- Backend: http://localhost:4000
- Postgres: localhost:5432 (schema loads automatically on first run)

### Option B: Run locally without Docker

Requires Node.js 20+ and a running PostgreSQL instance.

```bash
# 1. Create the database and load the schema
createdb joineazy
psql joineazy < backend/src/db/schema.sql

# 2. Backend
cd backend
cp .env.example .env   # adjust DB credentials if needed
npm install
npm run dev             # listens on :4000

# 3. Frontend (in a second terminal)
cd frontend
npm install
npm run dev              # listens on :5173
```

## Design system

The frontend uses shadcn-style components (Radix primitives + Tailwind, copied into
`frontend/src/components/ui/`, not installed as an opaque package) with a custom token set instead
of the library's default theme:

- **Color**: near-black/near-white as the structural base, violet (`hsl(263 82% 57%)`) as the one
  primary action color (buttons, links, active states), and lime (`hsl(77 90% 45%)`) reserved
  specifically for "submitted" / success states — the progress bar fill and submitted badges use
  it and nothing else does, so it carries meaning instead of being decoration.
- **Type**: Space Grotesk for headings/display text, IBM Plex Sans for body and UI text — a
  deliberate pairing rather than Inter everywhere.
- **Dark mode**: a `ThemeProvider` toggles a `.dark` class on `<html>` and persists the choice to
  `localStorage`; all colors are defined as CSS variables so both themes share one component tree.
- Login/Register use a split hero layout instead of a centered generic card, and the two
  dashboards avoid wrapping every block in an identical rounded shadow-card — borders and
  dividers carry structure instead.

## Key design decisions

- **JWT over sessions**: stateless auth keeps the backend simple to containerize and scale; the
  role is embedded in the token payload so every route only needs one `jwt.verify` call.
- **Two-step submission confirmation is enforced server-side**, not just in the UI: the
  `/submissions/confirm` endpoint requires `confirm: true` explicitly, so a stray or automated
  request can't silently mark a submission as done.
- **`ON CONFLICT` upserts** on the `submissions` table mean re-confirming updates the timestamp
  instead of erroring or duplicating rows.
- **Docker Compose healthcheck** on Postgres ensures the backend container doesn't start (and
  fail to connect) before the database is actually accepting connections.
- **Build-time vs runtime env vars**: `VITE_API_URL` is passed as a Docker build ARG rather than
  a runtime environment variable, since Vite inlines env vars into the static bundle at build
  time — setting it at container runtime would have no effect.

## What's scoped out (given the timeline)

- Charting library for admin analytics — replaced with a simple summary-count and status-table
  view, which satisfies the "basic charts or summary counts" requirement without the added
  build time.
- Password reset / email verification — out of scope for a technical task with no email service.
