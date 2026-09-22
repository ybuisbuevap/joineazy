import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../../api/client.js';
import Navbar from '../../components/Navbar.jsx';
import { Card, CardContent } from '../../components/ui/card.jsx';
import { Button } from '../../components/ui/button.jsx';
import { Input } from '../../components/ui/input.jsx';
import { Label } from '../../components/ui/label.jsx';
import { Progress } from '../../components/ui/progress.jsx';
import { Badge } from '../../components/ui/badge.jsx';
import { Separator } from '../../components/ui/separator.jsx';
import { Spinner } from '../../components/ui/spinner.jsx';
import { LoadingState, ErrorState, EmptyState } from '../../components/PageState.jsx';
import { Users, ClipboardList, AlertTriangle, Plus } from 'lucide-react';

const EMPTY_FORM = { title: '', description: '', due_date: '', onedrive_link: '', submission_type: 'group', target_group_id: '' };

export default function AdminCoursePage() {
  const { courseId } = useParams();
  const [analytics, setAnalytics] = useState(null);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState('');

  async function load() {
    setError('');
    try {
      const res = await api.get(`/courses/${courseId}/analytics`);
      setAnalytics(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load this course.');
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  async function createAssignment(e) {
    e.preventDefault();
    if (!form.title.trim()) {
      setFormError('Title is required.');
      return;
    }
    setCreating(true);
    setFormError('');
    try {
      await api.post('/assignments', {
        ...form,
        course_id: Number(courseId),
        due_date: form.due_date ? new Date(form.due_date).toISOString() : null,
        target_group_id: form.target_group_id ? Number(form.target_group_id) : null,
      });
      setForm(EMPTY_FORM);
      setShowForm(false);
      load();
    } catch (err) {
      setFormError(err.response?.data?.error || 'Failed to create assignment.');
    } finally {
      setCreating(false);
    }
  }

  if (error && !analytics) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar backTo="/admin" backLabel="My courses" />
        <div className="max-w-5xl mx-auto px-6 py-10">
          <ErrorState message={error} onRetry={load} />
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar backTo="/admin" backLabel="My courses" />
        <LoadingState label="Loading course..." />
      </div>
    );
  }

  const { course, student_count, group_count, ungrouped_students, totals, assignments } = analytics;

  return (
    <div className="min-h-screen bg-background">
      <Navbar backTo="/admin" backLabel="My courses" />
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-start justify-between gap-3 mb-1">
          <h1 className="font-display text-2xl font-semibold">{course.title}</h1>
          <Button size="sm" onClick={() => setShowForm((s) => !s)}>
            <Plus size={14} className="mr-1" /> New assignment
          </Button>
        </div>
        <p className="text-sm text-muted-foreground mb-8">{course.code}</p>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-8">
          <MetricCard icon={<Users size={14} />} label="Students" value={student_count} />
          <MetricCard icon={<Users size={14} />} label="Groups" value={group_count} sub={ungrouped_students > 0 ? `${ungrouped_students} not grouped` : null} />
          <MetricCard icon={<ClipboardList size={14} />} label="Acknowledged" value={totals.acknowledged} accent />
          <MetricCard icon={<ClipboardList size={14} />} label="Pending" value={totals.pending} />
          <MetricCard icon={<AlertTriangle size={14} />} label="Overdue" value={totals.overdue} warn={totals.overdue > 0} />
        </div>

        <div className="max-w-sm mb-10">
          <div className="flex items-baseline justify-between mb-1.5">
            <span className="text-sm font-medium">Overall completion</span>
            <span className="text-sm text-muted-foreground">{totals.percent}%</span>
          </div>
          <Progress value={totals.percent} />
        </div>

        {showForm && (
          <Card className="mb-10 animate-in fade-in slide-in-from-top-1 duration-200">
            <CardContent className="pt-5">
              <form onSubmit={createAssignment} className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="title">Title</Label>
                  <Input id="title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} disabled={creating} required />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="description">Description</Label>
                  <textarea
                    id="description"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    disabled={creating}
                    rows={3}
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="due">Due date</Label>
                  <Input id="due" type="datetime-local" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} disabled={creating} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="link">Resource link</Label>
                  <Input id="link" value={form.onedrive_link} onChange={(e) => setForm({ ...form, onedrive_link: e.target.value })} disabled={creating} placeholder="https://..." />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="type">Submission type</Label>
                  <select
                    id="type"
                    value={form.submission_type}
                    onChange={(e) => setForm({ ...form, submission_type: e.target.value, target_group_id: '' })}
                    disabled={creating}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="group">Group</option>
                    <option value="individual">Individual</option>
                  </select>
                </div>
                {formError && <p className="text-sm text-destructive sm:col-span-2">{formError}</p>}
                <div className="sm:col-span-2 flex gap-2">
                  <Button type="submit" disabled={creating}>
                    {creating ? <Spinner className="mr-2" /> : null} Post assignment
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setShowForm(false)} disabled={creating}>
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <h2 className="font-display font-semibold mb-4">Assignments</h2>
        {assignments.length === 0 ? (
          <EmptyState>No assignments posted yet.</EmptyState>
        ) : (
          <ul className="space-y-3">
            {assignments.map((a) => (
              <li key={a.id}>
                <Link to={`/admin/courses/${courseId}/assignments/${a.id}`}>
                  <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                    <CardContent className="pt-5">
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{a.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {a.submission_type === 'individual' ? 'Individual' : 'Group'}
                            {a.due_date && ` · Due ${new Date(a.due_date).toLocaleString()}`}
                          </p>
                        </div>
                        <Badge variant={a.overdue > 0 ? 'outline' : 'muted'} className={a.overdue > 0 ? 'border-destructive/40 text-destructive shrink-0' : 'shrink-0'}>
                          {a.acknowledged}/{a.expected} acknowledged
                        </Badge>
                      </div>
                      <Progress value={a.percent} />
                    </CardContent>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function MetricCard({ icon, label, value, sub, accent, warn }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
          {icon} {label}
        </div>
        <p className={`font-display text-2xl font-semibold ${accent ? 'text-success' : warn ? 'text-destructive' : ''}`}>{value}</p>
        {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}
