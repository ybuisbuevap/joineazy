import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../api/client.js';
import Navbar from '../../components/Navbar.jsx';
import { Card, CardContent } from '../../components/ui/card.jsx';
import { Button } from '../../components/ui/button.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import { LoadingState, ErrorState, EmptyState } from '../../components/PageState.jsx';
import { Crown, ExternalLink, Users } from 'lucide-react';

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'acknowledged', label: 'Acknowledged' },
  { value: 'pending', label: 'Pending' },
  { value: 'overdue', label: 'Overdue' },
];

export default function AssignmentSubmissions() {
  const { courseId, assignmentId } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');

  async function load(status) {
    setError('');
    try {
      const res = await api.get(`/assignments/${assignmentId}/submissions?status=${status}`);
      setData(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load submissions.');
    }
  }

  useEffect(() => {
    load(filter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignmentId, filter]);

  if (error && !data) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar backTo={`/admin/courses/${courseId}`} backLabel="Course" />
        <div className="max-w-3xl mx-auto px-6 py-10">
          <ErrorState message={error} onRetry={() => load(filter)} />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar backTo={`/admin/courses/${courseId}`} backLabel="Course" />
        <LoadingState label="Loading submissions..." />
      </div>
    );
  }

  const { assignment, summary, submissions } = data;

  return (
    <div className="min-h-screen bg-background">
      <Navbar backTo={`/admin/courses/${courseId}`} backLabel="Course" />
      <div className="max-w-3xl mx-auto px-6 py-10">
        <h1 className="font-display text-2xl font-semibold mb-1">{assignment.title}</h1>
        <p className="text-sm text-muted-foreground mb-1">
          {assignment.submission_type === 'individual' ? 'Individual submission' : 'Group submission'}
          {assignment.due_date && ` · Due ${new Date(assignment.due_date).toLocaleString()}`}
        </p>
        {assignment.onedrive_link && (
          <a href={assignment.onedrive_link} target="_blank" rel="noreferrer" className="text-sm text-primary inline-flex items-center gap-1 mb-6">
            Open resource <ExternalLink size={13} />
          </a>
        )}

        <div className="flex flex-wrap gap-2 mb-6">
          {FILTERS.map((f) => (
            <Button
              key={f.value}
              size="sm"
              variant={filter === f.value ? 'default' : 'outline'}
              onClick={() => setFilter(f.value)}
            >
              {f.label}
              {f.value === 'all'
                ? ` (${summary.total})`
                : ` (${summary[f.value] ?? 0})`}
            </Button>
          ))}
        </div>

        {submissions.length === 0 ? (
          <EmptyState>No {filter === 'all' ? '' : filter} submissions to show.</EmptyState>
        ) : (
          <ul className="space-y-3">
            {submissions.map((s) => (
              <li key={s.id}>
                <Card>
                  <CardContent className="pt-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        {s.type === 'group' ? (
                          <>
                            <p className="font-medium text-sm flex items-center gap-1.5">
                              <Users size={13} /> {s.name}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                              <Crown size={11} /> Leader: {s.leader_name || 'Unassigned'}
                            </p>
                            {s.members?.length > 0 && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {s.members.map((m) => m.name).join(', ')}
                              </p>
                            )}
                          </>
                        ) : (
                          <>
                            <p className="font-medium text-sm">{s.name}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{s.email}</p>
                          </>
                        )}
                        {s.acknowledged_at && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Acknowledged {new Date(s.acknowledged_at).toLocaleString()}
                            {s.acknowledged_by_name && ` by ${s.acknowledged_by_name}`}
                          </p>
                        )}
                      </div>
                      <StatusBadge status={s.status} />
                    </div>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
