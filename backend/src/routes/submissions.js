const express = require('express');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.post('/confirm', async (req, res) => {
  const { assignment_id, group_id, confirm } = req.body;

  if (!assignment_id || !group_id) {
    return res.status(400).json({ error: 'assignment_id and group_id are required' });
  }
  if (confirm !== true) {
    return res.status(400).json({ error: 'confirm must be true to finalize a submission' });
  }

  try {
    const membership = await pool.query(
      'SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2',
      [group_id, req.user.userId]
    );
    if (membership.rows.length === 0) {
      return res.status(403).json({ error: 'You are not a member of this group' });
    }

    const result = await pool.query(
      `INSERT INTO submissions (assignment_id, group_id, confirmed_by)
       VALUES ($1, $2, $3)
       ON CONFLICT (assignment_id, group_id) DO UPDATE SET confirmed_by = $3, confirmed_at = NOW()
       RETURNING *`,
      [assignment_id, group_id, req.user.userId]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to confirm submission' });
  }
});

router.get('/group/:groupId', async (req, res) => {
  const { groupId } = req.params;
  try {
    const totalResult = await pool.query('SELECT COUNT(*) FROM assignments');
    const submittedResult = await pool.query(
      'SELECT assignment_id FROM submissions WHERE group_id = $1',
      [groupId]
    );
    const total = parseInt(totalResult.rows[0].count, 10);
    const done = submittedResult.rows.length;
    const submittedAssignmentIds = submittedResult.rows.map((r) => r.assignment_id);
    res.json({
      total,
      done,
      percent: total === 0 ? 0 : Math.round((done / total) * 100),
      submittedAssignmentIds,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to compute progress' });
  }
});

module.exports = router;