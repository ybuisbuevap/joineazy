import React, { useEffect, useState } from 'react';
import api from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const [form, setForm] = useState({ title: '', description: '', due_date: '', onedrive_link: '' });
  const [progress, setProgress] = useState(null);
  const [message, setMessage] = useState('');

  function update(field) {
    return (e) => setForm({ ...form, [field]: e.target.value });
  }

  async function loadProgress() {
    const res = await api.get('/admin/progress');
    setProgress(res.data);
  }

  useEffect(() => {
    loadProgress();
  }, []);

  async function createAssignment(e) {
    e.preventDefault();
    setMessage('');
    try {
      await api.post('/assignments', form);
      setForm({ title: '', description: '', due_date: '', onedrive_link: '' });
      setMessage('Assignment posted.');
      loadProgress();
    } catch (err) {
      setMessage(err.response?.data?.error || 'Failed to post assignment');
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-semibold">Admin dashboard - {user?.name}</h1>
          <button onClick={logout} className="text-sm text-red-600">Log out</button>
        </div>

        {progress && (
          <div className="grid grid-cols-3 gap-4 mb-6">
            <StatCard label="Groups" value={progress.summary.totalGroups} />
            <StatCard label="Assignments" value={progress.summary.totalAssignments} />
            <StatCard label="Completion" value={`${progress.summary.completionPercent}%`} />
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          <section className="bg-white rounded-lg shadow-sm p-4">
            <h2 className="font-medium mb-3">Post a new assignment</h2>
            {message && <p className="text-sm text-blue-700 mb-2">{message}</p>}
            <form onSubmit={createAssignment} className="space-y-2">
              <input placeholder="Title" value={form.title} onChange={update('title')} className="w-full border rounded px-2 py-1 text-sm" required />
              <textarea placeholder="Description" value={form.description} onChange={update('description')} className="w-full border rounded px-2 py-1 text-sm" rows={3} />
              <input type="datetime-local" value={form.due_date} onChange={update('due_date')} className="w-full border rounded px-2 py-1 text-sm" />
              <input placeholder="OneDrive link" value={form.onedrive_link} onChange={update('onedrive_link')} className="w-full border rounded px-2 py-1 text-sm" />
              <button className="bg-blue-600 text-white text-sm px-3 py-2 rounded w-full">Post assignment</button>
            </form>
          </section>

          <section className="bg-white rounded-lg shadow-sm p-4 overflow-x-auto">
            <h2 className="font-medium mb-3">Group-wise submission tracking</h2>
            {progress && progress.matrix.length > 0 ? (
              <table className="text-sm w-full">
                <thead>
                  <tr>
                    <th className="text-left py-1 pr-2">Assignment</th>
                    {progress.matrix[0].groups.map((g) => (
                      <th key={g.group_id} className="text-left py-1 pr-2">{g.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {progress.matrix.map((row) => (
                    <tr key={row.assignment_id} className="border-t">
                      <td className="py-1 pr-2">{row.title}</td>
                      {row.groups.map((g) => (
                        <td key={g.group_id} className="py-1 pr-2">
                          {g.submitted ? (
                            <span className="text-green-600">Submitted</span>
                          ) : (
                            <span className="text-gray-400">Pending</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-gray-500">No data yet - create assignments and groups first.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-4 text-center">
      <p className="text-2xl font-semibold">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}
