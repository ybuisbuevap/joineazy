const express = require('express');
const pool = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const {
  toId,
  getOwnedCourse,
  isEnrolled,
  getStudentAssignments,
  summarizeProgress,
  getAssignmentStats,
} = require('../lib/assignments');

const router = express.Router();
router.use(requireAuth);

// POST /courses  (professor)  { title, code?, description? }
router.post('/', requireRole('admin'), async (req, res) => {
  const title = (req.body.title || '').trim();
  const code = (req.body.code || '').trim() || null;
  const description = (req.body.description || '').trim() || null;

  if (!title) return res.status(400).json({ error: 'title is required' });

  try {
    const result = await pool.query(
      'INSERT INTO courses (title, code, description, professor_id) VALUES ($1, $2, $3, $4) RETURNING *',
      [title, code, description, req.user.userId]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create course' });
  }
});

// GET /courses/mine
//   professor: courses they teach, with student count and submission analytics
//   student: courses they are enrolled in, with their own progress
router.get('/mine', async (req, res) => {
  try {
    if (req.user.role === 'admin') {
      const courses = await pool.query(
        `SELECT c.*,
                (SELECT COUNT(*) FROM enrollments e WHERE e.course_id = c.id)::int AS student_count,
                (SELECT COUNT(*) FROM groups_table g WHERE g.course_id = c.id)::int AS group_count
         FROM courses c
         WHERE c.professor_id = $1
         ORDER BY c.created_at DESC`,
        [req.user.userId]
      );

      const withStats = await Promise.all(
        courses.rows.map(async (course) => {
          const stats = await getAssignmentStats(course.id);
          const expected = stats.reduce((sum, a) => sum + a.expected, 0);
          const acknowledged = stats.reduce((sum, a) => sum + a.acknowledged, 0);
          return {
            ...course,
            assignment_count: stats.length,
            expected,
            acknowledged,
            pending: Math.max(expected - acknowledged, 0),
            overdue: stats.reduce((sum, a) => sum + a.overdue, 0),
            percent: expected === 0 ? 0 : Math.min(100, Math.round((acknowledged / expected) * 100)),
          };
        })
      );
      return res.json(withStats);
    }

    const courses = await pool.query(
      `SELECT c.*, p.name AS professor_name
       FROM courses c
       JOIN enrollments e ON e.course_id = c.id
       JOIN users p ON p.id = c.professor_id
       WHERE e.student_id = $1
       ORDER BY c.title`,
      [req.user.userId]
    );

    const withProgress = await Promise.all(
      courses.rows.map(async (course) => {
        const { group, assignments } = await getStudentAssignments(req.user.userId, course.id);
        return {
          ...course,
          group: group ? { id: group.id, name: group.name } : null,
          progress: summarizeProgress(assignments),
        };
      })
    );
    res.json(withProgress);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch courses' });
  }
});

// GET /courses/available  (student)  every course, flagged with whether the student is enrolled
router.get('/available', requireRole('student'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.*, p.name AS professor_name,
              EXISTS (SELECT 1 FROM enrollments e WHERE e.course_id = c.id AND e.student_id = $1) AS enrolled
       FROM courses c
       JOIN users p ON p.id = c.professor_id
       ORDER BY c.title`,
      [req.user.userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch courses' });
  }
});

// POST /courses/:id/enroll  (student)
router.post('/:id/enroll', requireRole('student'), async (req, res) => {
  const courseId = toId(req.params.id);
  if (!courseId) return res.status(400).json({ error: 'Invalid course id' });

  try {
    const course = await pool.query('SELECT id FROM courses WHERE id = $1', [courseId]);
    if (course.rows.length === 0) return res.status(404).json({ error: 'Course not found' });

    await pool.query(
      'INSERT INTO enrollments (course_id, student_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [courseId, req.user.userId]
    );
    res.status(201).json({ enrolled: true, course_id: courseId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to enroll' });
  }
});

// GET /courses/:id  a course the caller teaches or is enrolled in
router.get('/:id', async (req, res) => {
  const courseId = toId(req.params.id);
  if (!courseId) return res.status(400).json({ error: 'Invalid course id' });

  try {
    const result = await pool.query(
      `SELECT c.*, p.name AS professor_name,
              (SELECT COUNT(*) FROM enrollments e WHERE e.course_id = c.id)::int AS student_count
       FROM courses c JOIN users p ON p.id = c.professor_id
       WHERE c.id = $1`,
      [courseId]
    );
    const course = result.rows[0];
    if (!course) return res.status(404).json({ error: 'Course not found' });

    const allowed =
      req.user.role === 'admin'
        ? course.professor_id === req.user.userId
        : await isEnrolled(req.user.userId, courseId);
    if (!allowed) return res.status(403).json({ error: 'You do not have access to this course' });

    res.json(course);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch course' });
  }
});

// GET /courses/:id/analytics  (professor who teaches the course)
router.get('/:id/analytics', requireRole('admin'), async (req, res) => {
  const courseId = toId(req.params.id);
  if (!courseId) return res.status(400).json({ error: 'Invalid course id' });

  try {
    const course = await getOwnedCourse(courseId, req.user.userId);
    if (!course) return res.status(404).json({ error: 'Course not found' });

    const counts = await pool.query(
      `SELECT
         (SELECT COUNT(*) FROM enrollments WHERE course_id = $1)::int AS student_count,
         (SELECT COUNT(*) FROM groups_table WHERE course_id = $1)::int AS group_count,
         (SELECT COUNT(*) FROM enrollments e
           WHERE e.course_id = $1
             AND NOT EXISTS (
               SELECT 1 FROM group_members gm
               JOIN groups_table g ON g.id = gm.group_id
               WHERE g.course_id = $1 AND gm.user_id = e.student_id
             ))::int AS ungrouped_students`,
      [courseId]
    );

    const assignments = await getAssignmentStats(courseId);
    const expected = assignments.reduce((sum, a) => sum + a.expected, 0);
    const acknowledged = assignments.reduce((sum, a) => sum + a.acknowledged, 0);

    res.json({
      course,
      ...counts.rows[0],
      assignment_count: assignments.length,
      totals: {
        expected,
        acknowledged,
        pending: Math.max(expected - acknowledged, 0),
        overdue: assignments.reduce((sum, a) => sum + a.overdue, 0),
        percent: expected === 0 ? 0 : Math.min(100, Math.round((acknowledged / expected) * 100)),
      },
      assignments,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to compute analytics' });
  }
});

module.exports = router;
