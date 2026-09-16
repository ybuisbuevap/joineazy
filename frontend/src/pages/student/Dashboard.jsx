import React, { useEffect, useState } from 'react';
import api from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';
import Navbar from '../../components/Navbar.jsx';
import { Button } from '../../components/ui/button.jsx';
import { Input } from '../../components/ui/input.jsx';
import { Badge } from '../../components/ui/badge.jsx';
import { Progress } from '../../components/ui/progress.jsx';
import { Separator } from '../../components/ui/separator.jsx';

export default function StudentDashboard() {
  const { user } = useAuth();
  const [groups, setGroups] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [newGroupName, setNewGroupName] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [activeGroupId, setActiveGroupId] = useState(null);
  const [progress, setProgress] = useState(null);
  const [pendingConfirm, setPendingConfirm] = useState(null);

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

  const activeGroup = groups.find((g) => g.id === activeGroupId);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-5xl mx-auto px-6 py-10">
        <h1 className="font-display text-2xl font-semibold mb-1">Welcome, {user?.name}</h1>
        <p className="text-muted-foreground text-sm mb-8">
          {activeGroup ? `Viewing progress for ${activeGroup.name}` : 'Create a group to get started.'}
        </p>

        {progress && (
          <div className="mb-10">
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-sm font-medium">Group progress</span>
              <span className="text-sm text-muted-foreground">{progress.done} / {progress.total} submitted</span>
            </div>
            <Progress value={progress.percent} />
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-10">
          <section>
            <h2 className="font-display font-semibold mb-4">Your groups</h2>
            <ul className="space-y-1 mb-5">
              {groups.map((g) => (
                <li key={g.id}>
                  <button
                    onClick={() => setActiveGroupId(g.id)}
                    className={`text-sm py-1 ${activeGroupId === g.id ? 'font-semibold text-primary' : 'text-foreground/80 hover:text-foreground'}`}
                  >
                    {g.name}
                  </button>
                </li>
              ))}
              {groups.length === 0 && <p className="text-sm text-muted-foreground">No groups yet.</p>}
            </ul>

            <form onSubmit={createGroup} className="flex gap-2 mb-4">
              <Input
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="New group name"
              />
              <Button type="submit" variant="outline">Create</Button>
            </form>

            {activeGroupId && (
              <>
                <Separator className="mb-4" />
                <form onSubmit={addMember} className="flex gap-2">
                  <Input
                    value={memberEmail}
                    onChange={(e) => setMemberEmail(e.target.value)}
                    placeholder="Add member by email"
                  />
                  <Button type="submit" variant="outline">Add</Button>
                </form>
              </>
            )}
          </section>

          <section>
            <h2 className="font-display font-semibold mb-4">Assignments</h2>
            <ul className="space-y-4">
              {assignments.map((a) => (
                <li key={a.id} className="pb-4 border-b border-border last:border-0">
                  <p className="font-medium text-sm">{a.title}</p>
                  {a.due_date && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Due {new Date(a.due_date).toLocaleString()}
                    </p>
                  )}
                  {a.onedrive_link && (
                    <a href={a.onedrive_link} target="_blank" rel="noreferrer" className="text-xs text-primary block mt-1">
                      Open OneDrive link
                    </a>
                  )}

                  {pendingConfirm === a.id ? (
                    <div className="mt-3 flex gap-2">
                      <Button size="sm" variant="success" onClick={() => finalizeSubmission(a.id)}>
                        Confirm submission
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setPendingConfirm(null)}>
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-3"
                      disabled={!activeGroupId}
                      onClick={() => setPendingConfirm(a.id)}
                    >
                      Yes, I have submitted
                    </Button>
                  )}
                </li>
              ))}
              {assignments.length === 0 && <p className="text-sm text-muted-foreground">No assignments posted yet.</p>}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
