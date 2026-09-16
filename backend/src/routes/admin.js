const express = require('express');
const pool = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth, requireRole('admin'));

// GET /admin/progress  -- per-assignment, per-group submission matrix + summary counts
router.get('/progress', async (req, res) => {
  try {
    const groups = await pool.query('SELECT id, name FROM groups_table ORDER BY name');
    const assignments = await pool.query('SELECT id, title FROM assignments ORDER BY due_date ASC NULLS LAST');
    const submissions = await pool.query('SELECT assignment_id, group_id, confirmed_at FROM submissions');

    const submittedSet = new Set(
      submissions.rows.map((s) => `${s.assignment_id}:${s.group_id}`)
    );

    const matrix = assignments.rows.map((a) => ({
      assignment_id: a.id,
      title: a.title,
      groups: groups.rows.map((g) => ({
        group_id: g.id,
        name: g.name,
        submitted: submittedSet.has(`${a.id}:${g.id}`),
      })),
    }));

    const totalCells = assignments.rows.length * groups.rows.length;
    const submittedCells = submissions.rows.length;

    res.json({
      matrix,
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
