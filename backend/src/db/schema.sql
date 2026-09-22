-- Schema for Student, Group & Assignment Management System (Round 2)
-- Idempotent: safe to run on a fresh database and on a Round 1 database.

-- Users. The role value 'admin' is shown as "Professor" in the UI.
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(160) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(10) NOT NULL CHECK (role IN ('student', 'admin')),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Courses are taught by one professor.
CREATE TABLE IF NOT EXISTS courses (
  id SERIAL PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  code VARCHAR(20),
  description TEXT,
  professor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Which students are enrolled in which course.
CREATE TABLE IF NOT EXISTS enrollments (
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (course_id, student_id)
);

-- Groups belong to a course and have one leader.
-- Named groups_table because "group" is a reserved word in SQL.
CREATE TABLE IF NOT EXISTS groups_table (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
ALTER TABLE groups_table ADD COLUMN IF NOT EXISTS course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE;
ALTER TABLE groups_table ADD COLUMN IF NOT EXISTS leader_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
UPDATE groups_table SET leader_id = created_by WHERE leader_id IS NULL;

CREATE TABLE IF NOT EXISTS group_members (
  group_id INTEGER NOT NULL REFERENCES groups_table(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (group_id, user_id)
);

-- Assignments belong to a course and are either individual or group work.
-- target_group_id (optional, group assignments only) limits it to one group.
CREATE TABLE IF NOT EXISTS assignments (
  id SERIAL PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  due_date TIMESTAMP,
  onedrive_link TEXT,
  target_group_id INTEGER REFERENCES groups_table(id) ON DELETE SET NULL,
  created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE;
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS submission_type VARCHAR(10) NOT NULL DEFAULT 'group';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'assignments_submission_type_check') THEN
    ALTER TABLE assignments
      ADD CONSTRAINT assignments_submission_type_check CHECK (submission_type IN ('individual', 'group'));
  END IF;
END $$;

-- A submission row means the work has been acknowledged.
-- Group assignments: group_id is set, and only the group leader can create it.
-- Individual assignments: student_id is set.
CREATE TABLE IF NOT EXISTS submissions (
  id SERIAL PRIMARY KEY,
  assignment_id INTEGER NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  group_id INTEGER REFERENCES groups_table(id) ON DELETE CASCADE,
  student_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  confirmed_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  confirmed_at TIMESTAMP NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
);
-- Acknowledgment times are stored as UTC clock values, matching due_date, on any server time zone.
ALTER TABLE submissions ALTER COLUMN confirmed_at SET DEFAULT (NOW() AT TIME ZONE 'UTC');
ALTER TABLE submissions ALTER COLUMN group_id DROP NOT NULL;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS student_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE submissions DROP CONSTRAINT IF EXISTS submissions_assignment_id_group_id_key;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'submissions_one_owner_check') THEN
    ALTER TABLE submissions
      ADD CONSTRAINT submissions_one_owner_check CHECK ((group_id IS NULL) <> (student_id IS NULL));
  END IF;
END $$;

-- One acknowledgment per group per assignment, and one per student per individual assignment.
CREATE UNIQUE INDEX IF NOT EXISTS submissions_group_unique
  ON submissions (assignment_id, group_id) WHERE group_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS submissions_student_unique
  ON submissions (assignment_id, student_id) WHERE student_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_enrollments_student ON enrollments (student_id);
CREATE INDEX IF NOT EXISTS idx_groups_course ON groups_table (course_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members (user_id);
CREATE INDEX IF NOT EXISTS idx_assignments_course ON assignments (course_id);
