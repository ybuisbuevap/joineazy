import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Button } from '../components/ui/button.jsx';
import { Input } from '../components/ui/input.jsx';
import { Label } from '../components/ui/label.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'student' });
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  function update(field) {
    return (e) => setForm({ ...form, [field]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      const res = await api.post('/auth/register', form);
      login(res.data.token, res.data.user);
      navigate(res.data.user.role === 'admin' ? '/admin' : '/student');
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    }
  }

  return (
    <div className="min-h-screen grid md:grid-cols-2">
      <div className="hidden md:flex flex-col justify-between bg-ink text-background p-10 relative overflow-hidden">
        <div className="absolute -right-20 top-1/3 h-64 w-64 rounded-full bg-success/20 blur-3xl" />
        <div className="absolute -left-24 -bottom-24 h-72 w-72 rounded-full bg-primary/30 blur-3xl" />
        <span className="relative font-display text-sm tracking-tight opacity-70">Joineazy</span>
        <div className="relative">
          <h1 className="font-display text-5xl font-semibold leading-[1.05] mb-4">
            Join the<br /><span className="text-primary">class</span> in<br />two minutes.
          </h1>
          <p className="text-background/70 max-w-xs text-sm">
            Students form groups and confirm submissions. Professors post assignments and track progress.
          </p>
        </div>
        <p className="relative text-xs text-background/40">Student & Professor Portal</p>
      </div>

      <div className="flex items-center justify-center p-8 relative">
        <div className="absolute top-6 right-6">
          <ThemeToggle />
        </div>
        <form onSubmit={handleSubmit} className="w-full max-w-sm">
          <h2 className="font-display text-2xl font-semibold mb-1">Create an account</h2>
          <p className="text-muted-foreground text-sm mb-6">Pick your role to get started.</p>

          {error && (
            <p className="text-destructive text-sm mb-4 border border-destructive/30 bg-destructive/10 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          <div className="space-y-1.5 mb-4">
            <Label htmlFor="name">Full name</Label>
            <Input id="name" value={form.name} onChange={update('name')} required />
          </div>

          <div className="space-y-1.5 mb-4">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={form.email} onChange={update('email')} required />
          </div>

          <div className="space-y-1.5 mb-4">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" value={form.password} onChange={update('password')} required />
          </div>

          <div className="space-y-1.5 mb-6">
            <Label htmlFor="role">I am a</Label>
            <select
              id="role"
              value={form.role}
              onChange={update('role')}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="student">Student</option>
              <option value="admin">Professor / Admin</option>
            </select>
          </div>

          <Button type="submit" className="w-full">Register</Button>

          <p className="text-sm text-muted-foreground mt-5">
            Already have an account?{' '}
            <Link to="/login" className="text-primary font-medium">
              Log in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
