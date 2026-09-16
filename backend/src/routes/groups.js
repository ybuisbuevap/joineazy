const express = require('express');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// POST /groups  { name }
router.post('/', async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  try {
    const result = await pool.query(
      'INSERT INTO groups_table (name, created_by) VALUES ($1, $2) RETURNING *',
      [name, req.user.userId]
    );
    const group = result.rows[0];

    // creator is automatically a member
    await pool.query(
      'INSERT INTO group_members (group_id, user_id) VALUES ($1, $2)',
      [group.id, req.user.userId]
    );

    res.status(201).json(group);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create group' });
  }
});

// POST /groups/:id/members  { email }  -- add a student by email
router.post('/:id/members', async (req, res) => {
  const { id } = req.params;
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'email is required' });

  try {
    const userResult = await pool.query('SELECT id, role FROM users WHERE email = $1', [email]);
    const member = userResult.rows[0];
    if (!member) return res.status(404).json({ error: 'No student found with that email' });
    if (member.role !== 'student') return res.status(400).json({ error: 'Only students can be added to groups' });

    await pool.query(
      'INSERT INTO group_members (group_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [id, member.id]
    );

    res.status(201).json({ added: email });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add member' });
  }
});

// GET /groups/mine  -- groups the logged-in student belongs to
router.get('/mine', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT g.* FROM groups_table g
       JOIN group_members gm ON gm.group_id = g.id
       WHERE gm.user_id = $1`,
      [req.user.userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch groups' });
  }
});

// GET /groups/:id/members
router.get('/:id/members', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `SELECT u.id, u.name, u.email FROM users u
       JOIN group_members gm ON gm.user_id = u.id
       WHERE gm.group_id = $1`,
      [id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch members' });
  }
});

module.exports = router;
