const express = require('express');
const pool = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { toId, isEnrolled, getUserGroupInCourse, getStudentAssignments, summarizeProgress } = require('../lib/assignments');

const router = express.Router();
router.use(requireAuth);

// POST /submissions/confirm  (student)  { assignment_id, confirm: true }
//
// The client never says which group or student is acting. The server works it out from the token:
//   individual assignment: the student acknowledges their own work
//   group assignment: only the group leader can acknowledge, and the acknowledgment belongs to
//   the whole group, so every member sees it immediately
router.post('/confirm', requireRole('student'), async (req, res) => {
  const assignmentId = toId(req.body.assignment_id);
  if (!assignmentId) return res.status(400).json({ error: 'assignment_id is required' });
  if (req.body.confirm !== true) {
    return res.status(400).json({ error: 'confirm must be true to finalize a submission' });
  }

  try {
    const found = await pool.query('SELECT * FROM assignments WHERE id = $1', [assignmentId]);
    const assignment = found.rows[0];
    if (!assignment || !assignment.course_id) return res.status(404).json({ error: 'Assignment not found' });

    if (!(await isEnrolled(req.user.userId, assignment.course_id))) {
      return res.status(403).json({ error: 'You are not enrolled in this course' });
    }

    let result;
    if (assignment.submission_type === 'individual') {
      result = await pool.query(
        `INSERT INTO submissions (assignment_id, student_id, confirmed_by)
         VALUES ($1, $2, $2)
         ON CONFLICT (assignment_id, student_id) WHERE student_id IS NOT NULL DO NOTHING
         RETURNING *`,
        [assignmentId, req.user.userId]
      );
    } else {
      const group = await getUserGroupInCourse(req.user.userId, assignment.course_id);
      if (!group) {
        return res.status(400).json({ error: 'Create or join a group in this course before submitting' });
      }
      if (assignment.target_group_id && assignment.target_group_id !== group.id) {
        return res.status(403).json({ error: 'This assignment is not assigned to your group' });
      }
      if (group.leader_id !== req.user.userId) {
        return res.status(403).json({
          error: `Only the group leader (${group.leader_name}) can acknowledge a group submission`,
        });
      }
      result = await pool.query(
        `INSERT INTO submissions (assignment_id, group_id, confirmed_by)
         VALUES ($1, $2, $3)
         ON CONFLICT (assignment_id, group_id) WHERE group_id IS NOT NULL DO NOTHING
         RETURNING *`,
        [assignmentId, group.id, req.user.userId]
      );
    }

    // Acknowledging twice is harmless: the first acknowledgment stands.
    if (result.rows.length === 0) {
      return res.json({ acknowledged: true, already_acknowledged: true });
    }
    res.status(201).json({ acknowledged: true, already_acknowledged: false, submission: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to confirm submission' });
  }
});

// GET /submissions/course/:courseId/progress  (student)  their progress bar numbers for one course
router.get('/course/:courseId/progress', requireRole('student'), async (req, res) => {
  const courseId = toId(req.params.courseId);
  if (!courseId) return res.status(400).json({ error: 'Invalid course id' });

  try {
    if (!(await isEnrolled(req.user.userId, courseId))) {
      return res.status(403).json({ error: 'You are not enrolled in this course' });
    }
    const { assignments } = await getStudentAssignments(req.user.userId, courseId);
    res.json(summarizeProgress(assignments));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to compute progress' });
  }
});

module.exports = router;
