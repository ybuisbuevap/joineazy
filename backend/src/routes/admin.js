const express = require('express');
const pool = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth, requireRole('admin'));

router.get('/progress', async (req, res) => {
  try {
    const groups = await pool.query('SELECT id, name FROM groups_table ORDER BY name');
    const assignments = await pool.query('SELECT id, title FROM assignments ORDER BY due_date ASC NULLS LAST');
    const submissions = await pool.query(
      `SELECT s.assignment_id, s.group_id, s.confirmed_at, s.confirmed_by, u.name AS confirmed_by_name
       FROM submissions s JOIN users u ON u.id = s.confirmed_by`
    );
    const memberRows = await pool.query(
      `SELECT gm.group_id, g.name AS group_name, u.id, u.name, u.email
       FROM group_members gm
       JOIN groups_table g ON g.id = gm.group_id
       JOIN users u ON u.id = gm.user_id
       ORDER BY g.name, u.name`
    );

    const submittedMap = new Map(
      submissions.rows.map((s) => [`${s.assignment_id}:${s.group_id}`, s])
    );

    const membersByGroup = {};
    memberRows.rows.forEach((m) => {
      if (!membersByGroup[m.group_id]) membersByGroup[m.group_id] = [];
      membersByGroup[m.group_id].push({ id: m.id, name: m.name, email: m.email });
    });

    const groupsWithMembers = groups.rows.map((g) => ({
      id: g.id,
      name: g.name,
      members: membersByGroup[g.id] || [],
    }));

    const matrix = assignments.rows.map((a) => ({
      assignment_id: a.id,
      title: a.title,
      groups: groups.rows.map((g) => {
        const submission = submittedMap.get(`${a.id}:${g.id}`);
        return {
          group_id: g.id,
          name: g.name,
          submitted: Boolean(submission),
          confirmedBy: submission ? submission.confirmed_by_name : null,
        };
      }),
    }));

    const studentMatrix = assignments.rows.map((a) => ({
      assignment_id: a.id,
      title: a.title,
      students: memberRows.rows.map((m) => {
        const submission = submittedMap.get(`${a.id}:${m.group_id}`);
        return {
          student_id: m.id,
          student_name: m.name,
          group_name: m.group_name,
          submitted: Boolean(submission),
          isConfirmer: Boolean(submission && submission.confirmed_by === m.id),
        };
      }),
    }));

    const totalCells = assignments.rows.length * groups.rows.length;
    const submittedCells = submissions.rows.length;

    res.json({
      matrix,
      studentMatrix,
      groups: groupsWithMembers,
      summary: {
        totalGroups: groups.rows.length,
        totalAssignments: assignments.rows.length,
        submittedCount: submittedCells,
        expectedCount: totalCells,
        completionPercent: totalCells === 0 ? 0 : Math.round((submittedCells / totalCells) * 100),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to compute progress' });
  }
});

module.exports = router;