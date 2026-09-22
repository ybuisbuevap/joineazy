const express = require('express');
const pool = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const {
  toId,
  computeStatus,
  isLate,
  getOwnedCourse,
  isEnrolled,
  getStudentAssignments,
  summarizeProgress,
  getAssignmentStats,
} = require('../lib/assignments');

const router = express.Router();
router.use(requireAuth);

const TYPES = ['individual', 'group'];
const STATUSES = ['all', 'pending', 'acknowledged', 'overdue'];

// undefined = invalid, null = cleared, string = normalized UTC ISO timestamp
function normalizeDueDate(value) {
  if (value === undefined || value === null || value === '') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function normalizeLink(value) {
  const link = (value || '').trim();
  if (!link) return null;
  return /^https?:\/\//i.test(link) ? link : undefined;
}

async function groupBelongsToCourse(groupId, courseId) {
  const result = await pool.query('SELECT 1 FROM groups_table WHERE id = $1 AND course_id = $2', [groupId, courseId]);
  return result.rows.length > 0;
}

// Loads an assignment and checks the professor teaches its course.
async function getOwnedAssignment(assignmentId, professorId) {
  const result = await pool.query(
    `SELECT a.* FROM assignments a
     JOIN courses c ON c.id = a.course_id
     WHERE a.id = $1 AND c.professor_id = $2`,
    [assignmentId, professorId]
  );
  return result.rows[0] || null;
}

// GET /assignments?course_id=
//   student: assignments they can see in the course, with their status, plus group and progress
//   professor: assignments in a course they teach, with submission counts
router.get('/', async (req, res) => {
  const courseId = toId(req.query.course_id);
  if (!courseId) return res.status(400).json({ error: 'course_id is required' });

  try {
    if (req.user.role === 'admin') {
      const course = await getOwnedCourse(courseId, req.user.userId);
      if (!course) return res.status(404).json({ error: 'Course not found' });

      const rows = await pool.query(
        'SELECT * FROM assignments WHERE course_id = $1 ORDER BY due_date ASC NULLS LAST, id',
        [courseId]
      );
      const stats = new Map((await getAssignmentStats(courseId)).map((s) => [s.id, s]));
      const assignments = rows.rows.map((a) => {
        const s = stats.get(a.id) || {};
        return {
          ...a,
          expected: s.expected || 0,
          acknowledged: s.acknowledged || 0,
          pending: s.pending || 0,
          overdue: s.overdue || 0,
          percent: s.percent || 0,
        };
      });
      return res.json({ course, assignments, group: null, progress: null });
    }

    if (!(await isEnrolled(req.user.userId, courseId))) {
      return res.status(403).json({ error: 'You are not enrolled in this course' });
    }
    const { group, assignments } = await getStudentAssignments(req.user.userId, courseId);
    res.json({ assignments, group, progress: summarizeProgress(assignments) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch assignments' });
  }
});

// GET /assignments/:id/submissions?status=all|pending|acknowledged|overdue  (professor)
// One row per student (individual) or per group (group assignment).
router.get('/:id/submissions', requireRole('admin'), async (req, res) => {
  const assignmentId = toId(req.params.id);
  const statusFilter = req.query.status || 'all';
  if (!assignmentId) return res.status(400).json({ error: 'Invalid assignment id' });
  if (!STATUSES.includes(statusFilter)) {
    return res.status(400).json({ error: `status must be one of: ${STATUSES.join(', ')}` });
  }

  try {
    const assignment = await getOwnedAssignment(assignmentId, req.user.userId);
    if (!assignment) return res.status(404).json({ error: 'Assignment not found' });

    let rows;
    if (assignment.submission_type === 'individual') {
      const result = await pool.query(
        `SELECT u.id, u.name, u.email, s.confirmed_at, cu.name AS acknowledged_by_name
         FROM enrollments e
         JOIN users u ON u.id = e.student_id
         LEFT JOIN submissions s ON s.assignment_id = $1 AND s.student_id = u.id
         LEFT JOIN users cu ON cu.id = s.confirmed_by
         WHERE e.course_id = $2
         ORDER BY u.name`,
        [assignmentId, assignment.course_id]
      );
      rows = result.rows.map((r) => ({ type: 'student', ...r }));
    } else {
      const result = await pool.query(
        `SELECT g.id, g.name, lu.name AS leader_name, s.confirmed_at, cu.name AS acknowledged_by_name,
                COALESCE((SELECT json_agg(json_build_object('id', u.id, 'name', u.name, 'email', u.email) ORDER BY u.name)
                          FROM group_members gm JOIN users u ON u.id = gm.user_id
                          WHERE gm.group_id = g.id), '[]'::json) AS members
         FROM groups_table g
         LEFT JOIN users lu ON lu.id = g.leader_id
         LEFT JOIN submissions s ON s.assignment_id = $1 AND s.group_id = g.id
         LEFT JOIN users cu ON cu.id = s.confirmed_by
         WHERE g.course_id = $2 AND ($3::int IS NULL OR g.id = $3::int)
         ORDER BY g.name`,
        [assignmentId, assignment.course_id, assignment.target_group_id]
      );
      rows = result.rows.map((r) => ({ type: 'group', ...r }));
    }

    const all = rows.map(({ confirmed_at, ...rest }) => ({
      ...rest,
      acknowledged_at: confirmed_at,
      status: computeStatus(assignment.due_date, confirmed_at),
      is_late: isLate(assignment.due_date, confirmed_at),
    }));

    const summary = {
      total: all.length,
      acknowledged: all.filter((r) => r.status === 'acknowledged').length,
      pending: all.filter((r) => r.status === 'pending').length,
      overdue: all.filter((r) => r.status === 'overdue').length,
    };
    const submissions = statusFilter === 'all' ? all : all.filter((r) => r.status === statusFilter);

    res.json({ assignment, summary, filter: statusFilter, submissions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch submissions' });
  }
});

// GET /assignments/:id
//   student: the assignment with their status, their group, and every group member
//   professor: the assignment with submission counts
router.get('/:id', async (req, res) => {
  const assignmentId = toId(req.params.id);
  if (!assignmentId) return res.status(400).json({ error: 'Invalid assignment id' });

  try {
    const found = await pool.query(
      `SELECT a.*, c.title AS course_title, c.professor_id
       FROM assignments a JOIN courses c ON c.id = a.course_id
       WHERE a.id = $1`,
      [assignmentId]
    );
    const base = found.rows[0];
    if (!base) return res.status(404).json({ error: 'Assignment not found' });

    const { professor_id: professorId, ...assignmentRow } = base;

    if (req.user.role === 'admin') {
      if (professorId !== req.user.userId) return res.status(404).json({ error: 'Assignment not found' });
      const stats = (await getAssignmentStats(base.course_id)).find((s) => s.id === assignmentId) || {};
      return res.json({
        ...assignmentRow,
        expected: stats.expected || 0,
        acknowledged: stats.acknowledged || 0,
        pending: stats.pending || 0,
        overdue: stats.overdue || 0,
        percent: stats.percent || 0,
      });
    }

    if (!(await isEnrolled(req.user.userId, base.course_id))) {
      return res.status(403).json({ error: 'You are not enrolled in this course' });
    }
    const { group, assignments } = await getStudentAssignments(req.user.userId, base.course_id);
    const assignment = assignments.find((a) => a.id === assignmentId);
    if (!assignment) return res.status(404).json({ error: 'Assignment not found' });

    let groupInfo = null;
    if (group && assignment.submission_type === 'group') {
      const members = await pool.query(
        `SELECT u.id, u.name, u.email, (u.id = $2) AS is_leader
         FROM group_members gm JOIN users u ON u.id = gm.user_id
         WHERE gm.group_id = $1
         ORDER BY is_leader DESC, u.name`,
        [group.id, group.leader_id]
      );
      groupInfo = { ...group, members: members.rows, is_leader: group.leader_id === req.user.userId };
    }

    res.json({ ...assignment, course_title: base.course_title, group: groupInfo });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch assignment' });
  }
});

// POST /assignments  (professor)
// { course_id, title, description?, due_date?, onedrive_link?, submission_type?, target_group_id? }
router.post('/', requireRole('admin'), async (req, res) => {
  const courseId = toId(req.body.course_id);
  const title = (req.body.title || '').trim();
  const type = req.body.submission_type || 'group';
  const description = (req.body.description || '').trim() || null;

  if (!courseId) return res.status(400).json({ error: 'course_id is required' });
  if (!title) return res.status(400).json({ error: 'title is required' });
  if (!TYPES.includes(type)) return res.status(400).json({ error: "submission_type must be 'individual' or 'group'" });

  const dueDate = normalizeDueDate(req.body.due_date);
  if (dueDate === undefined) return res.status(400).json({ error: 'due_date is not a valid date' });
  const link = normalizeLink(req.body.onedrive_link);
  if (link === undefined) return res.status(400).json({ error: 'onedrive_link must start with http:// or https://' });

  try {
    const course = await getOwnedCourse(courseId, req.user.userId);
    if (!course) return res.status(404).json({ error: 'Course not found' });

    let targetGroupId = null;
    if (req.body.target_group_id) {
      if (type === 'individual') {
        return res.status(400).json({ error: 'Individual assignments cannot target a group' });
      }
      targetGroupId = toId(req.body.target_group_id);
      if (!targetGroupId || !(await groupBelongsToCourse(targetGroupId, courseId))) {
        return res.status(400).json({ error: 'target_group_id must be a group in this course' });
      }
    }

    const result = await pool.query(
      `INSERT INTO assignments (course_id, title, description, due_date, onedrive_link, submission_type, target_group_id, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [courseId, title, description, dueDate, link, type, targetGroupId, req.user.userId]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create assignment' });
  }
});

// PUT /assignments/:id  (professor)  only the fields you send are changed; send null to clear one
router.put('/:id', requireRole('admin'), async (req, res) => {
  const assignmentId = toId(req.params.id);
  if (!assignmentId) return res.status(400).json({ error: 'Invalid assignment id' });

  const body = req.body || {};
  const has = (key) => Object.prototype.hasOwnProperty.call(body, key);

  try {
    const existing = await getOwnedAssignment(assignmentId, req.user.userId);
    if (!existing) return res.status(404).json({ error: 'Assignment not found' });

    const updates = {};

    if (has('title')) {
      const title = (body.title || '').trim();
      if (!title) return res.status(400).json({ error: 'title cannot be empty' });
      updates.title = title;
    }
    if (has('description')) updates.description = (body.description || '').trim() || null;
    if (has('due_date')) {
      const dueDate = normalizeDueDate(body.due_date);
      if (dueDate === undefined) return res.status(400).json({ error: 'due_date is not a valid date' });
      updates.due_date = dueDate;
    }
    if (has('onedrive_link')) {
      const link = normalizeLink(body.onedrive_link);
      if (link === undefined) return res.status(400).json({ error: 'onedrive_link must start with http:// or https://' });
      updates.onedrive_link = link;
    }

    const newType = has('submission_type') ? body.submission_type : existing.submission_type;
    if (!TYPES.includes(newType)) return res.status(400).json({ error: "submission_type must be 'individual' or 'group'" });
    if (newType !== existing.submission_type) {
      const used = await pool.query('SELECT 1 FROM submissions WHERE assignment_id = $1 LIMIT 1', [assignmentId]);
      if (used.rows.length > 0) {
        return res.status(409).json({ error: 'Cannot change the submission type once submissions exist' });
      }
      updates.submission_type = newType;
    }

    if (newType === 'individual') {
      if (has('target_group_id') && body.target_group_id) {
        return res.status(400).json({ error: 'Individual assignments cannot target a group' });
      }
      if (existing.target_group_id !== null) updates.target_group_id = null;
    } else if (has('target_group_id')) {
      if (body.target_group_id) {
        const groupId = toId(body.target_group_id);
        if (!groupId || !(await groupBelongsToCourse(groupId, existing.course_id))) {
          return res.status(400).json({ error: 'target_group_id must be a group in this course' });
        }
        updates.target_group_id = groupId;
      } else {
        updates.target_group_id = null;
      }
    }

    const keys = Object.keys(updates);
    if (keys.length === 0) return res.status(400).json({ error: 'No fields to update' });

    const setClause = keys.map((key, i) => `${key} = $${i + 1}`).join(', ');
    const result = await pool.query(
      `UPDATE assignments SET ${setClause} WHERE id = $${keys.length + 1} RETURNING *`,
      [...keys.map((key) => updates[key]), assignmentId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update assignment' });
  }
});

module.exports = router;
