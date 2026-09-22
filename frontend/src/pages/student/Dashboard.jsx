import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';
import Navbar from '../../components/Navbar.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card.jsx';
import { Progress } from '../../components/ui/progress.jsx';
import { Badge } from '../../components/ui/badge.jsx';
import { Button } from '../../components/ui/button.jsx';
import { LoadingState, ErrorState, EmptyState } from '../../components/PageState.jsx';
import { Users, BookOpen, Plus } from 'lucide-react';

export default function StudentDashboard() {
  const { user } = useAuth();
  const [courses, setCourses] = useState(null);
  const [available, setAvailable] = useState([]);
  const [showBrowse, setShowBrowse] = useState(false);
  const [error, setError] = useState('');
  const [enrollingId, setEnrollingId] = useState(null);

  async function load() {
    setError('');
    try {
      const res = await api.get('/courses/mine');
      setCourses(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load your courses.');
    }
  }

  async function loadAvailable() {
    try {
      const res = await api.get('/courses/available');
      setAvailable(res.data.filter((c) => !c.enrolled));
    } catch {
      // Browsing is a secondary action; a silent failure here still leaves "My courses" usable.
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function toggleBrowse() {
    const next = !showBrowse;
    setShowBrowse(next);
    if (next) loadAvailable();
  }

  async function enroll(courseId) {
    setEnrollingId(courseId);
    try {
      await api.post(`/courses/${courseId}/enroll`);
      setAvailable((a) => a.filter((c) => c.id !== courseId));
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to enroll.');
    } finally {
      setEnrollingId(null);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-1">
          <h1 className="font-display text-2xl font-semibold">Welcome, {user?.name}</h1>
          <Button variant="outline" size="sm" onClick={toggleBrowse}>
            <Plus size={14} className="mr-1" /> {showBrowse ? 'Hide' : 'Browse courses'}
          </Button>
        </div>
        <p className="text-muted-foreground text-sm mb-8">Pick a course to see its assignments.</p>

        {showBrowse && (
          <div className="mb-10 border border-dashed border-border rounded-lg p-5 animate-in fade-in slide-in-from-top-1 duration-200">
            <h2 className="font-display font-semibold text-sm mb-3">Available courses</h2>
            {available.length === 0 ? (
              <EmptyState>You're enrolled in every available course.</EmptyState>
            ) : (
              <ul className="space-y-2">
                {available.map((c) => (
                  <li key={c.id} className="flex items-center justify-between text-sm py-1">
                    <span>
                      {c.title} {c.code && <span className="text-muted-foreground">({c.code})</span>}
                      <span className="text-muted-foreground"> · {c.professor_name}</span>
                    </span>
                    <Button size="sm" variant="success" disabled={enrollingId === c.id} onClick={() => enroll(c.id)}>
                      {enrollingId === c.id ? 'Enrolling...' : 'Enroll'}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {error && !courses && <ErrorState message={error} onRetry={load} />}
        {courses === null && !error && <LoadingState label="Loading your courses..." />}

        {courses && courses.length === 0 && (
          <EmptyState>You're not enrolled in any courses yet. Browse courses above to get started.</EmptyState>
        )}

        {courses && courses.length > 0 && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {courses.map((c) => (
              <Link key={c.id} to={`/student/courses/${c.id}`}>
                <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base">{c.title}</CardTitle>
                      {c.code && <Badge variant="outline">{c.code}</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{c.professor_name}</p>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                      <span className="flex items-center gap-1">
                        <BookOpen size={12} /> {c.progress.total} assignment{c.progress.total === 1 ? '' : 's'}
                      </span>
                      {c.group && (
                        <span className="flex items-center gap-1">
                          <Users size={12} /> {c.group.name}
                        </span>
                      )}
                    </div>
                    <div className="flex items-baseline justify-between mb-1.5">
                      <span className="text-xs font-medium">Progress</span>
                      <span className="text-xs text-muted-foreground">
                        {c.progress.done}/{c.progress.total}
                      </span>
                    </div>
                    <Progress value={c.progress.percent} />
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
