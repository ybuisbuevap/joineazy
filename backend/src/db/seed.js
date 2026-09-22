require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../db');
const migrate = require('./migrate');

// Demo data for local development and the demo video.
//   npm run seed           adds the demo data (does nothing if it is already there)
//   npm run seed -- --reset  wipes every table first, then adds the demo data
const PASSWORD = 'Demo@1234';
const PROFESSOR_EMAIL = 'professor@demo.com';

const STUDENTS = [
  ['Aarav Sharma', 'aarav@demo.com'],
  ['Diya Patel', 'diya@demo.com'],
  ['Kabir Singh', 'kabir@demo.com'],
  ['Isha Verma', 'isha@demo.com'],
  ['Rohan Gupta', 'rohan@demo.com'],
  ['Sneha Nair', 'sneha@demo.com'],
];

// SQL expression for "N days from now" (negative = in the past).
const days = (n) => `(NOW() AT TIME ZONE 'UTC') + INTERVAL '${n} days'`;

async function seed() {
  await migrate();

  if (process.argv.includes('--reset')) {
    await pool.query(
      'TRUNCATE submissions, assignments, group_members, groups_table, enrollments, courses, users RESTART IDENTITY CASCADE'
    );
    console.log('All tables cleared');
  }

  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [PROFESSOR_EMAIL]);
  if (existing.rows.length > 0) {
    console.log('Demo data already present. Run "npm run seed -- --reset" to recreate it.');
    return;
  }

  const hash = await bcrypt.hash(PASSWORD, 10);
  const user = async (name, email, role) =>
    (await pool.query('INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id', [name, email, hash, role])).rows[0].id;

  const professor = await user('Dr. Meera Iyer', PROFESSOR_EMAIL, 'admin');
  const s = {};
  for (const [name, email] of STUDENTS) s[name.split(' ')[0].toLowerCase()] = await user(name, email, 'student');

  const course = async (title, code, description) =>
    (await pool.query('INSERT INTO courses (title, code, description, professor_id) VALUES ($1, $2, $3, $4) RETURNING id', [title, code, description, professor])).rows[0].id;

  const dbms = await course('Database Management Systems', 'CS301', 'Relational design, SQL, normalization and query optimization.');
  const web = await course('Full Stack Web Development', 'CS204', 'Build and deploy modern web apps with React, Node and PostgreSQL.');

  const enroll = (courseId, ids) =>
    Promise.all(ids.map((id) => pool.query('INSERT INTO enrollments (course_id, student_id) VALUES ($1, $2)', [courseId, id])));
  await enroll(dbms, Object.values(s));
  await enroll(web, [s.aarav, s.diya, s.kabir, s.isha]);

  const group = async (name, courseId, leader, members) => {
    const id = (await pool.query('INSERT INTO groups_table (name, course_id, created_by, leader_id) VALUES ($1, $2, $3, $3) RETURNING id', [name, courseId, leader])).rows[0].id;
    for (const m of members) await pool.query('INSERT INTO group_members (group_id, user_id) VALUES ($1, $2)', [id, m]);
    return id;
  };
  const alpha = await group('Team Alpha', dbms, s.aarav, [s.aarav, s.diya, s.kabir]);
  await group('Team Beta', dbms, s.isha, [s.isha, s.rohan]);
  await group('Web Squad', web, s.diya, [s.diya, s.isha]);

  const assignment = async (courseId, title, description, dueOffset, type, link) =>
    (await pool.query(
      `INSERT INTO assignments (course_id, title, description, due_date, submission_type, onedrive_link, created_by)
       VALUES ($1, $2, $3, ${days(dueOffset)}, $4, $5, $6) RETURNING id`,
      [courseId, title, description, type, link, professor]
    )).rows[0].id;

  const erDiagram = await assignment(dbms, 'ER Diagram Design', 'Design an ER diagram for a hospital management system and export it as a PDF.', 5, 'individual', 'https://onedrive.live.com/demo/er-diagram');
  const normalization = await assignment(dbms, 'Normalization Report', 'Take the provided unnormalized dataset through 1NF, 2NF and 3NF. One report per group.', 3, 'group', 'https://onedrive.live.com/demo/normalization');
  await assignment(dbms, 'Query Optimization Project', 'Analyze slow queries with EXPLAIN and propose indexes. One submission per group.', 10, 'group', 'https://onedrive.live.com/demo/query-optimization');
  const sqlLab = await assignment(dbms, 'SQL Lab Reflection', 'Write a short reflection on the SQL lab exercises.', -2, 'individual', 'https://onedrive.live.com/demo/sql-reflection');
  const portfolio = await assignment(web, 'Portfolio Website', 'Build a responsive personal portfolio with React and Tailwind.', 7, 'individual', 'https://onedrive.live.com/demo/portfolio');
  await assignment(web, 'REST API Project', 'Design and document a REST API with Express and PostgreSQL. One submission per group.', 12, 'group', 'https://onedrive.live.com/demo/rest-api');

  const acknowledge = (assignmentId, ownerColumn, ownerId, by, offset) =>
    pool.query(
      `INSERT INTO submissions (assignment_id, ${ownerColumn}, confirmed_by, confirmed_at) VALUES ($1, $2, $3, ${days(offset)})`,
      [assignmentId, ownerId, by]
    );
  await acknowledge(erDiagram, 'student_id', s.aarav, s.aarav, -1);
  await acknowledge(erDiagram, 'student_id', s.diya, s.diya, 0);
  await acknowledge(sqlLab, 'student_id', s.aarav, s.aarav, -3);
  await acknowledge(sqlLab, 'student_id', s.isha, s.isha, -1);
  await acknowledge(normalization, 'group_id', alpha, s.aarav, 0);
  await acknowledge(portfolio, 'student_id', s.kabir, s.kabir, 0);

  console.log('Demo data created.');
  console.log(`  Professor: ${PROFESSOR_EMAIL} / ${PASSWORD}`);
  console.log(`  Students:  aarav@demo.com (leader of Team Alpha), diya@demo.com, kabir@demo.com,`);
  console.log(`             isha@demo.com (leader of Team Beta), rohan@demo.com, sneha@demo.com / ${PASSWORD}`);
}

seed()
  .then(() => pool.end())
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
