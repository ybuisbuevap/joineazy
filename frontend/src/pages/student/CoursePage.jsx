import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../../api/client.js';
import Navbar from '../../components/Navbar.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card.jsx';
import { Button } from '../../components/ui/button.jsx';
import { Input } from '../../components/ui/input.jsx';
import { Progress } from '../../components/ui/progress.jsx';
import { Badge } from '../../components/ui/badge.jsx';
import { Separator } from '../../components/ui/separator.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import { LoadingState, ErrorState, EmptyState } from '../../components/PageState.jsx';
import { Spinner } from '../../components/ui/spinner.jsx';
import { Crown, Users } from 'lucide-react';

export default function StudentCoursePage() {
  const { courseId } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [group, setGroup] = useState(null);
  const [groupName, setGroupName] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [groupError, setGroupError] = useState('');
  const [groupMessage, setGroupMessage] = useState('');
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [addingMember, setAddingMember] = useState(false);

  async function load() {
    setError('');
    try {
      const [assignmentsRes, groupsRes] = await Promise.all([
        api.get(`/assignments?course_id=${courseId}`),
        api.get(`/groups/mine?course_id=${courseId}`),
      ]);
      setData(assignmentsRes.data);
      setGroup(groupsRes.data[0] || null);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load this course.');
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  async function createGroup(e) {
    e.preventDefault();
    if (!groupName.trim()) return;
    setCreatingGroup(true);
    setGroupError('');
    try {
      await api.post('/groups', { name: groupName, course_id: Number(courseId) });
      setGroupName('');
      load();
    } catch (err) {
      setGroupError(err.response?.data?.error || 'Failed to create group.');
    } finally {
      setCreatingGroup(false);
    }
  }

  async function addMember(e) {
    e.preventDefault();
    if (!memberEmail.trim()) return;
    setAddingMember(true);
    setGroupError('');
    setGroupMessage('');
    try {
      const res = await api.post(`/groups/${group.id}/members`, { email: memberEmail });
      setGroupMessage(`Added ${res.data.name} to the group.`);
      setMemberEmail('');
      load();
    } catch (err) {
      setGroupError(err.response?.data?.error || 'Failed to add member.');
    } finally {
      setAddingMember(false);
    }
  }

  if (error && !data) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar backTo="/student" backLabel="My courses" />
        <div className="max-w-5xl mx-auto px-6 py-10">
          <ErrorState message={error} onRetry={load} />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar backTo="/student" backLabel="My courses" />
        <LoadingState label="Loading course..." />
      </div>
    );
  }

  const { assignments, progress } = data;

  return (
    <div className="min-h-screen bg-background">
      <Navbar backTo="/student" backLabel="My courses" />
      <div className="max-w-5xl mx-auto px-6 py-10">
        <h1 className="font-display text-2xl font-semibold mb-1">Course assignments</h1>
        {progress && (
          <div className="mb-8 max-w-sm">
            <div className="flex items-baseline justify-between mb-1.5">
              <span className="text-sm font-medium">Your progress</span>
              <span className="text-sm text-muted-foreground">
                {progress.done}/{progress.total} acknowledged
              </span>
            </div>
            <Progress value={progress.percent} />
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-8">
          <section className="md:col-span-2 order-2 md:order-1">
            <h2 className="font-display font-semibold mb-4">Assignments</h2>
            {assignments.length === 0 ? (
              <EmptyState>No assignments posted yet.</EmptyState>
            ) : (
              <ul className="space-y-3">
                {assignments.map((a) => (
                  <li key={a.id}>
                    <Link to={`/student/courses/${courseId}/assignments/${a.id}`}>
                      <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                        <CardContent className="pt-5 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{a.title}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {a.submission_type === 'individual' ? 'Individual' : 'Group'}
                              {a.due_date && ` · Due ${new Date(a.due_date).toLocaleString()}`}
                            </p>
                          </div>
                          <StatusBadge status={a.status} />
                        </CardContent>
                      </Card>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="order-1 md:order-2">
            <h2 className="font-display font-semibold mb-4 flex items-center gap-2">
              <Users size={16} /> Your group
            </h2>
            {group ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    {group.name}
                    {group.is_leader && (
                      <Badge variant="outline" className="gap-1">
                        <Crown size={11} /> Leader
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1 mb-4">
                    {group.members.map((m) => (
                      <li key={m.id} className="text-sm">
                        {m.name} <span className="text-muted-foreground text-xs">({m.email})</span>
                      </li>
                    ))}
                  </ul>

                  {group.is_leader ? (
                    <>
                      <Separator className="mb-4" />
                      <form onSubmit={addMember} className="flex gap-2">
                        <Input
                          value={memberEmail}
                          onChange={(e) => setMemberEmail(e.target.value)}
                          placeholder="Add member by email"
                          disabled={addingMember}
                        />
                        <Button type="submit" variant="outline" disabled={addingMember}>
                          {addingMember ? <Spinner /> : 'Add'}
                        </Button>
                      </form>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Only the group leader can add members and acknowledge group submissions.
                    </p>
                  )}
                  {groupMessage && <p className="text-xs text-success mt-2">{groupMessage}</p>}
                  {groupError && <p className="text-xs text-destructive mt-2">{groupError}</p>}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="pt-5">
                  <p className="text-sm text-muted-foreground mb-4">
                    You're not in a group for this course yet. Create one to work on group assignments.
                  </p>
                  <form onSubmit={createGroup} className="flex gap-2">
                    <Input
                      value={groupName}
                      onChange={(e) => setGroupName(e.target.value)}
                      placeholder="Group name"
                      disabled={creatingGroup}
                    />
                    <Button type="submit" disabled={creatingGroup}>
                      {creatingGroup ? <Spinner /> : 'Create'}
                    </Button>
                  </form>
                  {groupError && <p className="text-xs text-destructive mt-2">{groupError}</p>}
                </CardContent>
              </Card>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
