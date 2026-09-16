import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

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
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-lg shadow-md w-full max-w-sm">
        <h1 className="text-xl font-semibold mb-6">Create an account</h1>
        {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
        <input placeholder="Full name" value={form.name} onChange={update('name')} className="w-full border rounded px-3 py-2 mb-3" required />
        <input type="email" placeholder="Email" value={form.email} onChange={update('email')} className="w-full border rounded px-3 py-2 mb-3" required />
        <input type="password" placeholder="Password" value={form.password} onChange={update('password')} className="w-full border rounded px-3 py-2 mb-3" required />
        <select value={form.role} onChange={update('role')} className="w-full border rounded px-3 py-2 mb-4">
          <option value="student">Student</option>
          <option value="admin">Professor / Admin</option>
        </select>
        <button type="submit" className="w-full bg-blue-600 text-white rounded py-2 font-medium">
          Register
        </button>
        <p className="text-sm text-gray-600 mt-4">
          Already have an account? <Link to="/login" className="text-blue-600">Log in</Link>
        </p>
      </form>
    </div>
  );
}
