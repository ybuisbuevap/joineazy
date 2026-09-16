import React, { useEffect, useState } from 'react';
import api from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';

export default function StudentDashboard() {
  const { user, logout } = useAuth();
  const [groups, setGroups] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [newGroupName, setNewGroupName] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [activeGroupId, setActiveGroupId] = useState(null);
  const [progress, setProgress] = useState(null);
  const [pendingConfirm, setPendingConfirm] = useState(null); // assignment id awaiting "yes"

  async function loadGroups() {
    const res = await api.get('/groups/mine');
    setGroups(res.data);
    if (res.data.length > 0 && !activeGroupId) setActiveGroupId(res.data[0].id);
  }

  async function loadAssignments() {
    const res = await api.get('/assignments');
    setAssignments(res.data);
  }

  async function loadProgress(groupId) {
    if (!groupId) return;
    const res = await api.get(`/submissions/group/${groupId}`);
    setProgress(res.data);
  }

  useEffect(() => {
    loadGroups();
    loadAssignments();
  }, []);

  useEffect(() => {
    loadProgress(activeGroupId);
  }, [activeGroupId]);

  async function createGroup(e) {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    await api.post('/groups', { name: newGroupName });
    setNewGroupName('');
    loadGroups();
  }

  async function addMember(e) {
    e.preventDefault();
    if (!activeGroupId || !memberEmail.trim()) return;
    await api.post(`/groups/${activeGroupId}/members`, { email: memberEmail });
    setMemberEmail('');
  }

  async function finalizeSubmission(assignmentId) {
    await api.post('/submissions/confirm', {
      assignment_id: assignmentId,
      group_id: activeGroupId,
      confirm: true,
    });
    setPendingConfirm(null);
    loadProgress(activeGroupId);
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-semibold">Welcome, {user?.name}</h1>
          <button onClick={logout} className="text-sm text-red-600">Log out</button>
        </div>

        {progress && (
          <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
            <p className="text-sm text-gray-600 mb-2">
              Group progress: {progress.done} / {progress.total} assignments submitted
            </p>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-green-500 h-3 rounded-full transition-all"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          <section className="bg-white rounded-lg shadow-sm p-4">
            <h2 className="font-medium mb-3">Your groups</h2>
            <ul className="mb-4 space-y-1">
              {groups.map((g) => (
                <li key={g.id}>
                  <button
                    onClick={() => setActiveGroupId(g.id)}
                    className={`text-sm ${activeGroupId === g.id ? 'font-semibold text-blue-600' : 'text-gray-700'}`}
                  >
                    {g.name}
                  </button>
                </li>
              ))}
              {groups.length === 0 && <p className="text-sm text-gray-500">No groups yet.</p>}
            </ul>

            <form onSubmit={createGroup} className="flex gap-2 mb-3">
              <input
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="New group name"
                className="flex-1 border rounded px-2 py-1 text-sm"
              />
              <button className="bg-blue-600 text-white text-sm px-3 rounded">Create</button>
            </form>

            {activeGroupId && (
              <form onSubmit={addMember} className="flex gap-2">
                <input
                  value={memberEmail}
                  onChange={(e) => setMemberEmail(e.target.value)}
                  placeholder="Add member by email"
                  className="flex-1 border rounded px-2 py-1 text-sm"
                />
                <button className="bg-gray-700 text-white text-sm px-3 rounded">Add</button>
              </form>
            )}
          </section>

          <section className="bg-white rounded-lg shadow-sm p-4">
            <h2 className="font-medium mb-3">Assignments</h2>
            <ul className="space-y-3">
              {assignments.map((a) => (
                <li key={a.id} className="border rounded p-3">
                  <p className="font-medium text-sm">{a.title}</p>
                  {a.due_date && <p className="text-xs text-gray-500">Due: {new Date(a.due_date).toLocaleString()}</p>}
                  {a.onedrive_link && (
                    <a href={a.onedrive_link} target="_blank" rel="noreferrer" className="text-xs text-blue-600 block mt-1">
                      Open OneDrive link
                    </a>
                  )}

                  {pendingConfirm === a.id ? (
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={() => finalizeSubmission(a.id)}
                        className="bg-green-600 text-white text-xs px-3 py-1 rounded"
                      >
                        Confirm submission
                      </button>
                      <button
                        onClick={() => setPendingConfirm(null)}
                        className="text-xs px-3 py-1 rounded border"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setPendingConfirm(a.id)}
                      disabled={!activeGroupId}
                      className="mt-2 text-xs px-3 py-1 rounded border border-green-600 text-green-700 disabled:opacity-40"
                    >
                      Yes, I have submitted
                    </button>
                  )}
                </li>
              ))}
              {assignments.length === 0 && <p className="text-sm text-gray-500">No assignments posted yet.</p>}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
