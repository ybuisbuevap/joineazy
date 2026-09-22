import React, { useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Button } from '../components/ui/button.jsx';
import { Input } from '../components/ui/input.jsx';
import { Label } from '../components/ui/label.jsx';
import { Spinner } from '../components/ui/spinner.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'student' });
  const [touched, setTouched] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  function update(field) {
    return (e) => setForm({ ...form, [field]: e.target.value });
  }
  function markTouched(field) {
    return () => setTouched((t) => ({ ...t, [field]: true }));
  }

  // Client side validation mirrors the backend rules, so feedback shows before a request is even sent.
  const fieldErrors = useMemo(() => {
    const errs = {};
    if (form.name.trim().length < 2) errs.name = 'Name must be at least 2 characters';
    if (!EMAIL_RE.test(form.email.trim())) errs.email = 'Enter a valid email address';
    if (form.password.length < 6) errs.password = 'Password must be at least 6 characters';
    return errs;
  }, [form]);
  const isValid = Object.keys(fieldErrors).length === 0;

  async function handleSubmit(e) {
    e.preventDefault();
    setTouched({ name: true, email: true, password: true });
    setError('');
    if (!isValid) return;

    setLoading(true);
    try {
      const res = await api.post('/auth/register', form);
      login(res.data.token, res.data.user);
      navigate(res.data.user.role === 'admin' ? '/admin' : '/student');
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed. Check your connection and try again.');
    } finally {
      setLoading(false);
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
            Students enroll in courses, form groups and confirm submissions. Professors post
            assignments and track progress.
          </p>
        </div>
        <p className="relative text-xs text-background/40">Student & Professor Portal</p>
      </div>

      <div className="flex items-center justify-center p-8 relative">
        <div className="absolute top-6 right-6">
          <ThemeToggle />
        </div>
        <form onSubmit={handleSubmit} className="w-full max-w-sm" noValidate>
          <h2 className="font-display text-2xl font-semibold mb-1">Create an account</h2>
          <p className="text-muted-foreground text-sm mb-6">Pick your role to get started.</p>

          {error && (
            <p role="alert" className="text-destructive text-sm mb-4 border border-destructive/30 bg-destructive/10 rounded-md px-3 py-2 animate-in fade-in slide-in-from-top-1 duration-200">
              {error}
            </p>
          )}

          <div className="space-y-1.5 mb-4">
            <Label htmlFor="name">Full name</Label>
            <Input id="name" value={form.name} onChange={update('name')} onBlur={markTouched('name')} disabled={loading} required />
            {touched.name && fieldErrors.name && <p className="text-xs text-destructive">{fieldErrors.name}</p>}
          </div>

          <div className="space-y-1.5 mb-4">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" value={form.email} onChange={update('email')} onBlur={markTouched('email')} disabled={loading} required />
            {touched.email && fieldErrors.email && <p className="text-xs text-destructive">{fieldErrors.email}</p>}
          </div>

          <div className="space-y-1.5 mb-4">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" autoComplete="new-password" value={form.password} onChange={update('password')} onBlur={markTouched('password')} disabled={loading} required />
            {touched.password && fieldErrors.password && <p className="text-xs text-destructive">{fieldErrors.password}</p>}
          </div>

          <div className="space-y-1.5 mb-6">
            <Label htmlFor="role">I am a</Label>
            <select
              id="role"
              value={form.role}
              onChange={update('role')}
              disabled={loading}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="student">Student</option>
              <option value="admin">Professor</option>
            </select>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <>
                <Spinner className="mr-2" /> Creating account...
              </>
            ) : (
              'Register'
            )}
          </Button>

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
