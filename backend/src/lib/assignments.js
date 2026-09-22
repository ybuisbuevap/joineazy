const pool = require('../db');

// Parse a route/body value into a positive integer id, or null.
function toId(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// Status of one assignment for one student or group.
//   acknowledged: the work has been acknowledged
//   overdue: not acknowledged and the deadline has passed
//   pending: not acknowledged yet
function computeStatus(dueDate, acknowledgedAt) {
  if (acknowledgedAt) return 'acknowledged';
  if (dueDate && new Date(dueDate) < new Date()) return 'overdue';
  return 'pending';
}

function isLate(dueDate, acknowledgedAt) {
  return Boolean(acknowledgedAt && dueDate && new Date(acknowledgedAt) > new Date(dueDate));
}

async function getOwnedCourse(courseId, professorId) {
  const result = await pool.query('SELECT * FROM courses WHERE id = $1 AND professor_id = $2', [courseId, professorId]);
  return result.rows[0] || null;
}

async function isEnrolled(userId, courseId) {
  const result = await pool.query('SELECT 1 FROM enrollments WHERE course_id = $1 AND student_id = $2', [courseId, userId]);
  return result.rows.length > 0;
}

// The group a student belongs to inside one course (a student has at most one per course).
async function getUserGroupInCourse(userId, courseId) {
  const result = await pool.query(
    `SELECT g.id, g.name, g.leader_id, lu.name AS leader_name
     FROM groups_table g
     JOIN group_members gm ON gm.group_id = g.id
     LEFT JOIN users lu ON lu.id = g.leader_id
     WHERE g.course_id = $1 AND gm.user_id = $2
     LIMIT 1`,
    [courseId, userId]
  );
  return result.rows[0] || null;
}

// Every assignment a student can see in a course, with the status that applies to them.
// Individual assignments are tracked per student, group assignments per group.
async function getStudentAssignments(userId, courseId) {
  const group = await getUserGroupInCourse(userId, courseId);
  const groupId = group ? group.id : null;

  const result = await pool.query(
    `SELECT a.*,
            s.id AS submission_id,
            s.confirmed_at AS acknowledged_at,
            s.confirmed_by AS acknowledged_by,
            cu.name AS acknowledged_by_name
     FROM assignments a
     LEFT JOIN submissions s ON s.assignment_id = a.id AND (
            (a.submission_type = 'individual' AND s.student_id = $2)
         OR (a.submission_type = 'group' AND s.group_id = $3::int))
     LEFT JOIN users cu ON cu.id = s.confirmed_by
     WHERE a.course_id = $1
       AND (a.submission_type = 'individual'
            OR a.target_group_id IS NULL
            OR a.target_group_id = $3::int)
     ORDER BY a.due_date ASC NULLS LAST, a.id`,
    [courseId, userId, groupId]
  );

  const assignments = result.rows.map((row) => {
    const status = computeStatus(row.due_date, row.acknowledged_at);
    let canAcknowledge = false;
    let blockedReason = null;

    if (status !== 'acknowledged') {
      if (row.submission_type === 'individual') {
        canAcknowledge = true;
      } else if (!group) {
        blockedReason = 'Create or join a group in this course to submit this assignment.';
      } else if (group.leader_id !== userId) {
        blockedReason = `Only the group leader (${group.leader_name}) can acknowledge this submission.`;
      } else {
        canAcknowledge = true;
      }
    }

    return {
      ...row,
      status,
      is_late: isLate(row.due_date, row.acknowledged_at),
      can_acknowledge: canAcknowledge,
      blocked_reason: blockedReason,
    };
  });

  return { group, assignments };
}

function summarizeProgress(assignments) {
  const total = assignments.length;
  const done = assignments.filter((a) => a.status === 'acknowledged').length;
  const overdue = assignments.filter((a) => a.status === 'overdue').length;
  return {
    total,
    done,
    pending: total - done,
    overdue,
    percent: total === 0 ? 0 : Math.round((done / total) * 100),
  };
}

// Per assignment counts for a course, from the professor's point of view.
//   expected: students (individual), groups (group), or 1 when targeted at a single group
async function getAssignmentStats(courseId) {
  const result = await pool.query(
    `SELECT a.id, a.title, a.submission_type, a.due_date, a.target_group_id,
            (CASE WHEN a.submission_type = 'individual'
                  THEN (SELECT COUNT(*) FROM enrollments e WHERE e.course_id = a.course_id)
                  WHEN a.target_group_id IS NOT NULL THEN 1
                  ELSE (SELECT COUNT(*) FROM groups_table g WHERE g.course_id = a.course_id)
             END)::int AS expected,
            (SELECT COUNT(*) FROM submissions s WHERE s.assignment_id = a.id)::int AS acknowledged
     FROM assignments a
     WHERE a.course_id = $1
     ORDER BY a.due_date ASC NULLS LAST, a.id`,
    [courseId]
  );

  return result.rows.map((row) => {
    const pending = Math.max(row.expected - row.acknowledged, 0);
    const pastDue = row.due_date && new Date(row.due_date) < new Date();
    return {
      ...row,
      pending,
      overdue: pastDue ? pending : 0,
      percent: row.expected === 0 ? 0 : Math.min(100, Math.round((row.acknowledged / row.expected) * 100)),
    };
  });
}

module.exports = {
  toId,
  computeStatus,
  isLate,
  getOwnedCourse,
  isEnrolled,
  getUserGroupInCourse,
  getStudentAssignments,
  summarizeProgress,
  getAssignmentStats,
};
