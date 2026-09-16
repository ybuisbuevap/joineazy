const express = require('express');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// POST /submissions/confirm  { assignment_id, group_id, confirm: true }
// The frontend implements the two-step "Yes, I have submitted" -> confirm UI;
// this endpoint only records the final confirmation, and requires confirm === true
// so an accidental call can't silently mark a submission as done.
router.post('/confirm', async (req, res) => {
  const { assignment_id, group_id, confirm } = req.body;

  if (!assignment_id || !group_id) {
    return res.status(400).json({ error: 'assignment_id and group_id are required' });
  }
  if (confirm !== true) {
    return res.status(400).json({ error: 'confirm must be true to finalize a submission' });
  }

  try {
    // verify the requesting user actually belongs to this group
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

// GET /submissions/group/:groupId  -- progress for one group
router.get('/group/:groupId', async (req, res) => {
  const { groupId } = req.params;
  try {
    const totalResult = await pool.query('SELECT COUNT(*) FROM assignments');
    const doneResult = await pool.query(
      'SELECT COUNT(*) FROM submissions WHERE group_id = $1',
      [groupId]
    );
    const total = parseInt(totalResult.rows[0].count, 10);
    const done = parseInt(doneResult.rows[0].count, 10);
    res.json({ total, done, percent: total === 0 ? 0 : Math.round((done / total) * 100) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to compute progress' });
  }
});

module.exports = router;
