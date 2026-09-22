const express = require('express');
const pool = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { toId, isEnrolled, getUserGroupInCourse } = require('../lib/assignments');

const router = express.Router();
router.use(requireAuth);

// Members of one group, oldest first (the leader is always the first row created).
const MEMBERS_SQL = `
  SELECT u.id, u.name, u.email
  FROM group_members gm
  JOIN users u ON u.id = gm.user_id
  WHERE gm.group_id = $1
  ORDER BY gm.joined_at, u.name`;

// POST /groups  (student)  { name, course_id }
// The creator becomes the group leader. A student can be in one group per course.
router.post('/', requireRole('student'), async (req, res) => {
  const name = (req.body.name || '').trim();
  const courseId = toId(req.body.course_id);

  if (!name) return res.status(400).json({ error: 'name is required' });
  if (!courseId) return res.status(400).json({ error: 'course_id is required' });

  const client = await pool.connect();
  try {
    if (!(await isEnrolled(req.user.userId, courseId))) {
      return res.status(403).json({ error: 'Enroll in this course before creating a group' });
    }
    if (await getUserGroupInCourse(req.user.userId, courseId)) {
      return res.status(409).json({ error: 'You are already in a group for this course' });
    }

    await client.query('BEGIN');
    const created = await client.query(
      `INSERT INTO groups_table (name, created_by, leader_id, course_id)
       VALUES ($1, $2, $2, $3) RETURNING *`,
      [name, req.user.userId, courseId]
    );
    const group = created.rows[0];
    await client.query('INSERT INTO group_members (group_id, user_id) VALUES ($1, $2)', [group.id, req.user.userId]);
    await client.query('COMMIT');

    res.status(201).json(group);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(err);
    res.status(500).json({ error: 'Failed to create group' });
  } finally {
    client.release();
  }
});

// GET /groups/mine?course_id=  groups the logged in user belongs to, with members and leader
router.get('/mine', async (req, res) => {
  const courseId = req.query.course_id ? toId(req.query.course_id) : null;
  if (req.query.course_id && !courseId) return res.status(400).json({ error: 'Invalid course_id' });

  try {
    const result = await pool.query(
      `SELECT g.id, g.name, g.course_id, g.leader_id, lu.name AS leader_name,
              (g.leader_id = $1) AS is_leader
       FROM groups_table g
       JOIN group_members gm ON gm.group_id = g.id
       LEFT JOIN users lu ON lu.id = g.leader_id
       WHERE gm.user_id = $1 AND ($2::int IS NULL OR g.course_id = $2::int)
       ORDER BY g.created_at`,
      [req.user.userId, courseId]
    );

    const groups = await Promise.all(
      result.rows.map(async (g) => {
        const members = await pool.query(MEMBERS_SQL, [g.id]);
        return { ...g, members: members.rows };
      })
    );
    res.json(groups);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch groups' });
  }
});

// GET /groups/:id/members  members of the group, or the professor who teaches its course
router.get('/:id/members', async (req, res) => {
  const groupId = toId(req.params.id);
  if (!groupId) return res.status(400).json({ error: 'Invalid group id' });

  try {
    const group = await pool.query(
      `SELECT g.id, c.professor_id
       FROM groups_table g LEFT JOIN courses c ON c.id = g.course_id
       WHERE g.id = $1`,
      [groupId]
    );
    if (group.rows.length === 0) return res.status(404).json({ error: 'Group not found' });

    const isMember = await pool.query('SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2', [
      groupId,
      req.user.userId,
    ]);
    const isProfessor = req.user.role === 'admin' && group.rows[0].professor_id === req.user.userId;
    if (isMember.rows.length === 0 && !isProfessor) {
      return res.status(403).json({ error: 'You do not have access to this group' });
    }

    const members = await pool.query(MEMBERS_SQL, [groupId]);
    res.json(members.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch members' });
  }
});

// POST /groups/:id/members  { email }  leader only. The student must be enrolled in the
// group's course and not already be in another group for that course.
router.post('/:id/members', requireRole('student'), async (req, res) => {
  const groupId = toId(req.params.id);
  const email = (req.body.email || '').trim().toLowerCase();
  if (!groupId) return res.status(400).json({ error: 'Invalid group id' });
  if (!email) return res.status(400).json({ error: 'email is required' });

  try {
    const groupResult = await pool.query('SELECT * FROM groups_table WHERE id = $1', [groupId]);
    const group = groupResult.rows[0];
    if (!group) return res.status(404).json({ error: 'Group not found' });
    if (group.leader_id !== req.user.userId) {
      return res.status(403).json({ error: 'Only the group leader can add members' });
    }

    const userResult = await pool.query('SELECT id, name, role FROM users WHERE email = $1', [email]);
    const member = userResult.rows[0];
    if (!member) return res.status(404).json({ error: 'No student found with that email' });
    if (member.role !== 'student') return res.status(400).json({ error: 'Only students can be added to groups' });

    if (group.course_id) {
      if (!(await isEnrolled(member.id, group.course_id))) {
        return res.status(400).json({ error: `${member.name} is not enrolled in this course yet` });
      }
      const existing = await getUserGroupInCourse(member.id, group.course_id);
      if (existing && existing.id !== group.id) {
        return res.status(409).json({ error: `${member.name} is already in another group for this course` });
      }
    }

    await pool.query('INSERT INTO group_members (group_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [
      groupId,
      member.id,
    ]);
    res.status(201).json({ added: email, name: member.name });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add member' });
  }
});

module.exports = router;
