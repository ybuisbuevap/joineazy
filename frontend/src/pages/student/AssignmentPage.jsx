import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../api/client.js';
import Navbar from '../../components/Navbar.jsx';
import { Card, CardContent } from '../../components/ui/card.jsx';
import { Button } from '../../components/ui/button.jsx';
import { Badge } from '../../components/ui/badge.jsx';
import { Separator } from '../../components/ui/separator.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import { LoadingState, ErrorState } from '../../components/PageState.jsx';
import { Spinner } from '../../components/ui/spinner.jsx';
import { CheckCircle2, Crown, ExternalLink, Users } from 'lucide-react';

export default function StudentAssignmentPage() {
  const { courseId, assignmentId } = useParams();
  const [assignment, setAssignment] = useState(null);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [confirmStep, setConfirmStep] = useState(false);
  const [actionError, setActionError] = useState('');
  const [justAcknowledged, setJustAcknowledged] = useState(false);

  async function load() {
    setError('');
    try {
      const res = await api.get(`/assignments/${assignmentId}`);
      setAssignment(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load this assignment.');
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignmentId]);

  async function acknowledge() {
    setConfirming(true);
    setActionError('');
    try {
      await api.post('/submissions/confirm', { assignment_id: Number(assignmentId), confirm: true });
      setConfirmStep(false);
      setJustAcknowledged(true);
      await load();
    } catch (err) {
      setActionError(err.response?.data?.error || 'Failed to confirm submission.');
    } finally {
      setConfirming(false);
    }
  }

  if (error && !assignment) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar backTo={`/student/courses/${courseId}`} backLabel="Course" />
        <div className="max-w-2xl mx-auto px-6 py-10">
          <ErrorState message={error} onRetry={load} />
        </div>
      </div>
    );
  }

  if (!assignment) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar backTo={`/student/courses/${courseId}`} backLabel="Course" />
        <LoadingState label="Loading assignment..." />
      </div>
    );
  }

  const isAcknowledged = assignment.status === 'acknowledged';

  return (
    <div className="min-h-screen bg-background">
      <Navbar backTo={`/student/courses/${courseId}`} backLabel="Course" />
      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="flex items-start justify-between gap-3 mb-1">
          <h1 className="font-display text-2xl font-semibold">{assignment.title}</h1>
          <StatusBadge status={assignment.status} animate={justAcknowledged} />
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          {assignment.course_title} · {assignment.submission_type === 'individual' ? 'Individual submission' : 'Group submission'}
          {assignment.due_date && ` · Due ${new Date(assignment.due_date).toLocaleString()}`}
        </p>

        <Card className="mb-6">
          <CardContent className="pt-5 space-y-4">
            {assignment.description && <p className="text-sm leading-relaxed">{assignment.description}</p>}
            {assignment.onedrive_link && (
              <a
                href={assignment.onedrive_link}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-primary inline-flex items-center gap-1"
              >
                Open assignment resource <ExternalLink size={13} />
              </a>
            )}
          </CardContent>
        </Card>

        {assignment.group && (
          <Card className="mb-6">
            <CardContent className="pt-5">
              <p className="text-sm font-medium mb-3 flex items-center gap-2">
                <Users size={14} /> {assignment.group.name}
              </p>
              <ul className="space-y-1">
                {assignment.group.members.map((m) => (
                  <li key={m.id} className="text-sm flex items-center gap-1.5">
                    {m.name} <span className="text-muted-foreground text-xs">({m.email})</span>
                    {m.is_leader && (
                      <Badge variant="outline" className="gap-1 ml-1">
                        <Crown size={10} /> Leader
                      </Badge>
                    )}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        <Separator className="mb-6" />

        {isAcknowledged ? (
          <div className="flex items-center gap-2 text-success animate-in zoom-in-75 fade-in duration-300">
            <CheckCircle2 size={20} />
            <div>
              <p className="text-sm font-medium">Acknowledged</p>
              <p className="text-xs text-muted-foreground">
                {assignment.acknowledged_by_name && `Confirmed by ${assignment.acknowledged_by_name} · `}
                {new Date(assignment.acknowledged_at).toLocaleString()}
              </p>
            </div>
          </div>
        ) : assignment.can_acknowledge ? (
          <div>
            {actionError && <p className="text-sm text-destructive mb-3">{actionError}</p>}
            {confirmStep ? (
              <div className="flex gap-2">
                <Button variant="success" onClick={acknowledge} disabled={confirming}>
                  {confirming ? (
                    <>
                      <Spinner className="mr-2" /> Confirming...
                    </>
                  ) : (
                    'Yes, confirm submission'
                  )}
                </Button>
                <Button variant="ghost" onClick={() => setConfirmStep(false)} disabled={confirming}>
                  Cancel
                </Button>
              </div>
            ) : (
              <Button onClick={() => setConfirmStep(true)}>Mark as submitted</Button>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{assignment.blocked_reason}</p>
        )}
      </div>
    </div>
  );
}
