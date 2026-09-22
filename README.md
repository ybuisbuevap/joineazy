# Student, Group & Assignment Management System

A role-based full-stack app for the Joineazy Full Stack Internship technical task. Round 1 covered
groups, assignments and confirmations. Round 2 adds a courses and enrollment layer on top, splits
assignments into individual and group submission types, restricts group acknowledgment to the
group leader, and gives professors per-course analytics.

## Overview

Two roles share one app, separated by JWT-encoded role checks. The database still stores the role
as `admin`, but the UI and this document call that role Professor throughout.

**Student**: register or log in, browse and enroll in courses, create or join one group per
course, add members by email, view assignments for an enrolled course (individual work, or group
work either open to all groups or targeted at one), open the assignment's resource link, confirm
submission with a two step "mark as submitted then confirm" flow, and see a live progress bar per
course.

For an individual assignment, each student confirms their own submission. For a group assignment,
only the group's leader (the student who created it) can confirm, and that confirmation applies to
every member immediately. Anyone else who tries is blocked with a message naming the leader.

**Professor**: register or log in, create courses, create assignments within a course (title,
description, due date, resource link, individual or group, and optionally a specific target
group), view per course analytics (student count, group count, students not yet in a group,
acknowledged/pending/overdue totals), open one assignment to see submission status filtered by
all, acknowledged, pending or overdue, and see group rosters and leaders where relevant.

## Architecture

```
Browser --HTTPS--> React + Tailwind frontend --REST + JWT--> Express API --SQL--> PostgreSQL
```

- **Frontend**: React (Vite) + Tailwind CSS. `AuthContext` holds the JWT and user in
  `localStorage`; `ProtectedRoute` gates `/student` and `/admin` by role. The API client logs the
  user out automatically on a 401, so an expired token never leaves the app stuck on failed
  requests.
- **Backend**: Node.js + Express. Routes are grouped by resource (`auth`, `courses`, `groups`,
  `assignments`, `submissions`). A single `requireAuth` middleware verifies the JWT on every
  protected route, and `requireRole('admin')` gates professor only routes. Shared status and
  progress calculations live in `src/lib/assignments.js` so the course, assignment and analytics
  routes agree on one definition of pending, acknowledged and overdue.
- **Database**: PostgreSQL, 7 tables (see schema below).
- **Deployment**: Docker Compose runs three services (`frontend`, `backend`, `postgres`) with a
  named volume for Postgres data persistence and a healthcheck so the backend waits for Postgres
  to be ready before starting. The backend also applies `schema.sql` itself on every boot (it is
  idempotent), so it works the same way against a local Docker database or a hosted one where
  nothing has pre-loaded the schema.

## Database schema

```
users (id, name, email, password_hash, role)
  |
  |--< enrollments >--| courses (id, title, code, description, professor_id)
  |                          |
  |--< group_members >--| groups_table (id, name, course_id, created_by, leader_id)
  |                          |
  |                     assignments (course_id, submission_type, target_group_id)
  |                          |
  |--------------------< submissions (assignment_id, group_id OR student_id, confirmed_by)
```

- `users`: `role` is either `student` or `admin` (shown as Professor in the UI).
- `courses`: owned by one professor (`professor_id`).
- `enrollments`: many to many join between `users` (students) and `courses`.
- `groups_table`: named `groups_table`, not `groups`, because `group` is a reserved word in SQL.
  Scoped to one `course_id`. `leader_id` is the student who created the group.
- `group_members`: many to many join between `users` and `groups_table`. A student can belong to
  at most one group per course, enforced in the application layer.
- `assignments`: `submission_type` is `individual` or `group`. `target_group_id` is nullable and
  only meaningful for group assignments; null means the assignment applies to every group in the
  course, a set value scopes visibility and tracking to that one group.
- `submissions`: one row per acknowledgment. Exactly one of `group_id` or `student_id` is set,
  enforced by a check constraint, and a partial unique index on each keeps one acknowledgment per
  group or per student per assignment. Confirming again is a harmless no-op rather than an error
  or a duplicate row.

Full DDL is in `backend/src/db/schema.sql`. It is idempotent (`CREATE TABLE IF NOT EXISTS`,
guarded `ALTER TABLE` statements), so it is safe to run against a brand new database or an
existing Round 1 database, and it is applied automatically every time the backend starts
(`backend/src/db/migrate.js`), not just once via Docker's init hook.

## API endpoints

| Method | Endpoint                              | Auth          | Description                                        |
|--------|----------------------------------------|---------------|-----------------------------------------------------|
| POST   | `/auth/register`                      | none          | Create an account (student or professor)             |
| POST   | `/auth/login`                         | none          | Log in, returns a JWT and the user's role            |
| GET    | `/auth/me`                            | any           | Current user, used to restore a session               |
| POST   | `/courses`                            | professor     | Create a course                                        |
| GET    | `/courses/mine`                       | any           | Professor: courses taught, with analytics. Student: enrolled courses, with progress |
| GET    | `/courses/available`                  | student       | Every course, flagged with whether the student is enrolled |
| POST   | `/courses/:id/enroll`                 | student       | Enroll in a course                                      |
| GET    | `/courses/:id`                        | any           | One course, if the caller teaches or is enrolled in it  |
| GET    | `/courses/:id/analytics`              | professor     | Student/group counts and per assignment acknowledgment totals |
| POST   | `/groups`                             | student       | Create a group in a course (creator becomes leader and auto joins) |
| GET    | `/groups/mine`                        | any           | Groups the logged in user belongs to, optionally filtered by course |
| POST   | `/groups/:id/members`                 | leader only   | Add an enrolled student to the group by email            |
| GET    | `/groups/:id/members`                 | member/prof   | List a group's members                                   |
| GET    | `/assignments`                        | any           | List assignments for a course; students see their status and blocked reasons |
| GET    | `/assignments/:id`                    | any           | One assignment, with group info for students or counts for professors |
| GET    | `/assignments/:id/submissions`        | professor     | Submissions for one assignment, filterable by status      |
| POST   | `/assignments`                        | professor     | Create an assignment (individual or group, optional target group) |
| PUT    | `/assignments/:id`                    | professor     | Edit an assignment                                        |
| POST   | `/submissions/confirm`                | student       | Acknowledge one assignment (leader only if it is a group assignment) |
| GET    | `/submissions/course/:courseId/progress` | student    | The caller's progress totals for one course               |

All protected routes expect `Authorization: Bearer <token>`.

## Setup & run instructions

### Option A: Docker (recommended)

```bash
docker compose up --build
```

- Frontend: http://localhost:5173
- Backend: http://localhost:4000
- Postgres: localhost:5432 (schema applies automatically on backend startup)

To reset all data and start completely fresh:

```bash
docker compose down -v
docker compose up --build
```

The `-v` flag removes the named Postgres volume, so the database reinitializes on the next start.

### Option B: Run locally without Docker

Requires Node.js 20+ and a running PostgreSQL instance.

```bash
# 1. Backend
cd backend
cp .env.example .env   # adjust DB credentials, or set DATABASE_URL for a hosted database
npm install
npm run dev             # applies the schema automatically, then listens on :4000

# 2. Frontend (in a second terminal)
cd frontend
cp .env.example .env    # points at http://localhost:4000 by default
npm install
npm run dev              # listens on :5173
```

### Optional: demo data

```bash
cd backend
npm run seed             # adds a demo professor, six students, two courses, groups and assignments
```

It does nothing if that demo professor already exists, so it is safe to run more than once. Pass
`--reset` to wipe every table first (`npm run seed -- --reset`); do not run that against data you
want to keep.

## Design system

The frontend uses shadcn style components (Radix primitives plus Tailwind, copied into
`frontend/src/components/ui/` rather than installed as an opaque package) with a custom token set
instead of the library's default theme.

- **Color**: near black and near white form the structural base, violet (`hsl(263 82% 57%)`) is
  the one primary action color (buttons, links, active states), and lime (`hsl(77 90% 45%)`) is
  reserved specifically for acknowledged and success states.
- **Type**: Space Grotesk for headings and display text, IBM Plex Sans for body and UI text.
- **Dark mode**: a `ThemeProvider` toggles a `.dark` class on `<html>` and persists the choice to
  `localStorage`; all colors are defined as CSS variables so both themes share one component tree.
- Login and Register use a split hero layout instead of a centered generic card, and both
  dashboards avoid wrapping every block in an identical rounded shadow card. Borders and dividers
  carry structure instead.
- Status is always shown through one shared `StatusBadge` component (pending, acknowledged,
  overdue) so the color and icon for a given state never drift between pages.

## Key design decisions

- **Courses as the organizing layer**: Round 1 had one flat pool of groups and assignments.
  Everything in Round 2 (enrollment, groups, assignments, analytics) is now scoped to a course, so
  a professor teaching two courses does not see one course's assignments bleeding into the other.
- **Leader only acknowledgment, reflected to every member**: the server determines the caller's
  group from their session, not from a value the client sends, and checks `leader_id` before
  accepting a group confirmation. Once confirmed, every member sees the same acknowledgment
  immediately, since it is stored once against the group, not per student.
- **Individual and group assignments share one status model**: `submission_type` on the assignment
  decides whether a submission is keyed by `student_id` or `group_id`, but both use the same
  pending/acknowledged/overdue logic and the same confirm endpoint, so the frontend does not need
  two separate code paths.
- **Two step submission confirmation is enforced server side**, not just in the UI. The
  `/submissions/confirm` endpoint requires `confirm: true` explicitly, so a stray or automated
  request cannot silently mark a submission as done.
- **Assignment visibility respects group targeting**: a group assignment with a `target_group_id`
  is only visible to that group; an untargeted group assignment is visible to every group in the
  course. This is enforced in the `/assignments` query itself, not just in the UI.
- **Membership checks on every group route**: Round 1 allowed any logged in user to read or modify
  any group. Round 2 checks that the caller is a member (or the course's professor) before
  returning group data, and that the caller is the leader before accepting a new member.
- **`DATABASE_URL` support with SSL**: `backend/src/db.js` accepts either the separate `DB_*`
  variables (local development, Docker Compose) or a single `DATABASE_URL` with SSL enabled
  (hosted Postgres such as Neon, Render or Railway), so the same code runs in both environments
  without a branch in application logic.
- **Schema migrations run on boot**: `backend/src/db/migrate.js` applies the idempotent
  `schema.sql` every time the backend starts, rather than relying solely on Docker's one time init
  hook, so a freshly provisioned hosted database needs no manual migration step.