import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Button } from '../components/ui/button.jsx';
import { Input } from '../components/ui/input.jsx';
import { Label } from '../components/ui/label.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      const res = await api.post('/auth/login', { email, password });
      login(res.data.token, res.data.user);
      navigate(res.data.user.role === 'admin' ? '/admin' : '/student');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    }
  }

  return (
    <div className="min-h-screen grid md:grid-cols-2">
      <div className="hidden md:flex flex-col justify-between bg-ink text-background p-10 relative overflow-hidden">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary/30 blur-3xl" />
        <div className="absolute -left-16 bottom-0 h-56 w-56 rounded-full bg-success/20 blur-3xl" />
        <span className="relative font-display text-sm tracking-tight opacity-70">Joineazy</span>
        <div className="relative">
          <h1 className="font-display text-5xl font-semibold leading-[1.05] mb-4">
            Groups.<br />Assignments.<br /><span className="text-success">Done.</span>
          </h1>
          <p className="text-background/70 max-w-xs text-sm">
            Form your group, track what's due, confirm your submission. One place for the whole class.
          </p>
        </div>
        <p className="relative text-xs text-background/40">Student & Professor Portal</p>
      </div>

      <div className="flex items-center justify-center p-8 relative">
        <div className="absolute top-6 right-6">
          <ThemeToggle />
        </div>
        <form onSubmit={handleSubmit} className="w-full max-w-sm">
          <h2 className="font-display text-2xl font-semibold mb-1">Log in</h2>
          <p className="text-muted-foreground text-sm mb-6">Welcome back. Enter your details.</p>

          {error && (
            <p className="text-destructive text-sm mb-4 border border-destructive/30 bg-destructive/10 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          <div className="space-y-1.5 mb-4">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>

          <div className="space-y-1.5 mb-6">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>

          <Button type="submit" className="w-full">Log in</Button>

          <p className="text-sm text-muted-foreground mt-5">
            No account?{' '}
            <Link to="/register" className="text-primary font-medium">
              Register
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
