import React, { useEffect, useState } from 'react';
import api from '../../api/client.js';
import Navbar from '../../components/Navbar.jsx';
import { Button } from '../../components/ui/button.jsx';
import { Input } from '../../components/ui/input.jsx';
import { Label } from '../../components/ui/label.jsx';
import { Badge } from '../../components/ui/badge.jsx';
import { Separator } from '../../components/ui/separator.jsx';

export default function AdminDashboard() {
  const [form, setForm] = useState({ title: '', description: '', due_date: '', onedrive_link: '', target_group_id: '' });
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
      await api.post('/assignments', {
        ...form,
        target_group_id: form.target_group_id ? Number(form.target_group_id) : null,
      });
      setForm({ title: '', description: '', due_date: '', onedrive_link: '', target_group_id: '' });
      setMessage('Assignment posted.');
      loadProgress();
    } catch (err) {
      setMessage(err.response?.data?.error || 'Failed to post assignment');
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-5xl mx-auto px-6 py-10">
        <h1 className="font-display text-2xl font-semibold mb-8">Admin dashboard</h1>

        {progress && (
          <div className="grid grid-cols-3 gap-6 mb-10">
            <Stat label="Groups" value={progress.summary.totalGroups} />
            <Stat label="Assignments" value={progress.summary.totalAssignments} />
            <Stat label="Completion" value={`${progress.summary.completionPercent}%`} accent />
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-10">
          <section>
            <h2 className="font-display font-semibold mb-4">Post a new assignment</h2>
            {message && <p className="text-sm text-primary mb-3">{message}</p>}
            <form onSubmit={createAssignment} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="title">Title</Label>
                <Input id="title" value={form.title} onChange={update('title')} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="description">Description</Label>
                <textarea
                  id="description"
                  value={form.description}
                  onChange={update('description')}
                  rows={3}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="due">Due date</Label>
                <Input id="due" type="datetime-local" value={form.due_date} onChange={update('due_date')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="link">OneDrive link</Label>
                <Input id="link" value={form.onedrive_link} onChange={update('onedrive_link')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="target">Assign to</Label>
                <select
                  id="target"
                  value={form.target_group_id}
                  onChange={update('target_group_id')}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">All groups</option>
                  {progress?.groups?.map((g) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>
              <Button type="submit" className="w-full">Post assignment</Button>
            </form>
          </section>

          <section>
            <h2 className="font-display font-semibold mb-4">Group-wise submission tracking</h2>
            {progress && progress.matrix.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="text-sm w-full">
                  <thead>
                    <tr className="text-left text-muted-foreground border-b border-border">
                      <th className="py-2 pr-4 font-medium">Assignment</th>
                      {progress.matrix[0].groups.map((g) => (
                        <th key={g.group_id} className="py-2 pr-4 font-medium">{g.name}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {progress.matrix.map((row) => (
                      <tr key={row.assignment_id} className="border-b border-border last:border-0">
                        <td className="py-2.5 pr-4">{row.title}</td>
                        {row.groups.map((g) => (
                          <td key={g.group_id} className="py-2.5 pr-4">
                            {g.submitted ? (
                              <Badge variant="success">Submitted</Badge>
                            ) : (
                              <Badge variant="muted">Pending</Badge>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No data yet. Create assignments and groups first.</p>
            )}
          </section>
        </div>

        <Separator className="my-10" />

        <section>
          <h2 className="font-display font-semibold mb-4">Student-wise tracking</h2>
          {progress && progress.studentMatrix?.length > 0 && progress.studentMatrix[0].students.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="text-sm w-full">
                <thead>
                  <tr className="text-left text-muted-foreground border-b border-border">
                    <th className="py-2 pr-4 font-medium">Student</th>
                    <th className="py-2 pr-4 font-medium">Group</th>
                    {progress.studentMatrix.map((a) => (
                      <th key={a.assignment_id} className="py-2 pr-4 font-medium">{a.title}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {progress.studentMatrix[0].students.map((s, idx) => (
                    <tr key={s.student_id + s.group_name} className="border-b border-border last:border-0">
                      <td className="py-2.5 pr-4">{s.student_name}</td>
                      <td className="py-2.5 pr-4 text-muted-foreground">{s.group_name}</td>
                      {progress.studentMatrix.map((a) => {
                        const cell = a.students[idx];
                        return (
                          <td key={a.assignment_id} className="py-2.5 pr-4">
                            {cell.submitted ? (
                              <Badge variant="success">
                                {cell.isConfirmer ? 'Submitted' : 'Submitted (group)'}
                              </Badge>
                            ) : (
                              <Badge variant="muted">Pending</Badge>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No students in groups yet.</p>
          )}
        </section>

        <Separator className="my-10" />

        <section>
          <h2 className="font-display font-semibold mb-4">Groups & members</h2>
          {progress && progress.groups?.length > 0 ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {progress.groups.map((g) => (
                <div key={g.id} className="border border-border rounded-md p-3">
                  <p className="text-sm font-medium mb-1.5">{g.name}</p>
                  {g.members.length > 0 ? (
                    <ul className="space-y-0.5">
                      {g.members.map((m) => (
                        <li key={m.id} className="text-xs text-muted-foreground">
                          {m.name} <span className="opacity-60">({m.email})</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-muted-foreground">No members yet.</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No groups created yet.</p>
          )}
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }) {
  return (
    <div>
      <p className={`font-display text-3xl font-semibold ${accent ? 'text-success' : ''}`}>{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
      <Separator className="mt-3" />
    </div>
  );
}