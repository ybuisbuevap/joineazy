import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';
import Navbar from '../../components/Navbar.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card.jsx';
import { Button } from '../../components/ui/button.jsx';
import { Input } from '../../components/ui/input.jsx';
import { Label } from '../../components/ui/label.jsx';
import { Spinner } from '../../components/ui/spinner.jsx';
import { LoadingState, ErrorState, EmptyState } from '../../components/PageState.jsx';
import { Users, ClipboardList, Plus } from 'lucide-react';

export default function AdminDashboard() {
  const { user } = useAuth();
  const [courses, setCourses] = useState(null);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', code: '', description: '' });
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState('');

  async function load() {
    setError('');
    try {
      const res = await api.get('/courses/mine');
      setCourses(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load your courses.');
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function createCourse(e) {
    e.preventDefault();
    if (!form.title.trim()) {
      setFormError('Title is required.');
      return;
    }
    setCreating(true);
    setFormError('');
    try {
      await api.post('/courses', form);
      setForm({ title: '', code: '', description: '' });
      setShowForm(false);
      load();
    } catch (err) {
      setFormError(err.response?.data?.error || 'Failed to create course.');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-1">
          <h1 className="font-display text-2xl font-semibold">Welcome, {user?.name}</h1>
          <Button size="sm" onClick={() => setShowForm((s) => !s)}>
            <Plus size={14} className="mr-1" /> New course
          </Button>
        </div>
        <p className="text-muted-foreground text-sm mb-8">Your courses and their submission progress.</p>

        {showForm && (
          <Card className="mb-8 animate-in fade-in slide-in-from-top-1 duration-200">
            <CardContent className="pt-5">
              <form onSubmit={createCourse} className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="title">Title</Label>
                  <Input id="title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} disabled={creating} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="code">Course code</Label>
                  <Input id="code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} disabled={creating} placeholder="Optional" />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="description">Description</Label>
                  <textarea
                    id="description"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    disabled={creating}
                    rows={2}
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>
                {formError && <p className="text-sm text-destructive sm:col-span-2">{formError}</p>}
                <div className="sm:col-span-2 flex gap-2">
                  <Button type="submit" disabled={creating}>
                    {creating ? <Spinner className="mr-2" /> : null} Create course
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setShowForm(false)} disabled={creating}>
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {error && !courses && <ErrorState message={error} onRetry={load} />}
        {courses === null && !error && <LoadingState label="Loading your courses..." />}
        {courses && courses.length === 0 && (
          <EmptyState>You haven't created any courses yet. Click "New course" to get started.</EmptyState>
        )}

        {courses && courses.length > 0 && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {courses.map((c) => (
              <Link key={c.id} to={`/admin/courses/${c.id}`}>
                <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer">
                  <CardHeader>
                    <CardTitle className="text-base">{c.title}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">{c.code}</p>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
                      <span className="flex items-center gap-1">
                        <Users size={12} /> {c.student_count} student{c.student_count === 1 ? '' : 's'}
                      </span>
                      <span className="flex items-center gap-1">
                        <ClipboardList size={12} /> {c.assignment_count} assignment{c.assignment_count === 1 ? '' : 's'}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <Stat label="Ack" value={c.acknowledged} accent />
                      <Stat label="Pending" value={c.pending} />
                      <Stat label="Overdue" value={c.overdue} warn={c.overdue > 0} />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, accent, warn }) {
  return (
    <div>
      <p className={`font-display text-lg font-semibold ${accent ? 'text-success' : warn ? 'text-destructive' : ''}`}>{value}</p>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
    </div>
  );
}
