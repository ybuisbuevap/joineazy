const express = require('express');
const pool = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// GET /assignments  -- everyone can view
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM assignments ORDER BY due_date ASC NULLS LAST');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch assignments' });
  }
});

// POST /assignments  (admin only)  { title, description, due_date, onedrive_link, target_group_id }
router.post('/', requireRole('admin'), async (req, res) => {
  const { title, description, due_date, onedrive_link, target_group_id } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required' });

  try {
    const result = await pool.query(
      `INSERT INTO assignments (title, description, due_date, onedrive_link, target_group_id, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [title, description || null, due_date || null, onedrive_link || null, target_group_id || null, req.user.userId]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create assignment' });
  }
});

// PUT /assignments/:id  (admin only)
router.put('/:id', requireRole('admin'), async (req, res) => {
  const { id } = req.params;
  const { title, description, due_date, onedrive_link, target_group_id } = req.body;

  try {
    const result = await pool.query(
      `UPDATE assignments
       SET title = COALESCE($1, title),
           description = COALESCE($2, description),
           due_date = COALESCE($3, due_date),
           onedrive_link = COALESCE($4, onedrive_link),
           target_group_id = COALESCE($5, target_group_id)
       WHERE id = $6 RETURNING *`,
      [title, description, due_date, onedrive_link, target_group_id, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Assignment not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update assignment' });
  }
});

module.exports = router;
