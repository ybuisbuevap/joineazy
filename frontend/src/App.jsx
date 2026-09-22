import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import StudentDashboard from './pages/student/Dashboard.jsx';
import StudentCoursePage from './pages/student/CoursePage.jsx';
import StudentAssignmentPage from './pages/student/AssignmentPage.jsx';
import AdminDashboard from './pages/admin/Dashboard.jsx';
import AdminCoursePage from './pages/admin/CoursePage.jsx';
import AssignmentSubmissions from './pages/admin/AssignmentSubmissions.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route
        path="/student"
        element={
          <ProtectedRoute role="student">
            <StudentDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/courses/:courseId"
        element={
          <ProtectedRoute role="student">
            <StudentCoursePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/courses/:courseId/assignments/:assignmentId"
        element={
          <ProtectedRoute role="student">
            <StudentAssignmentPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin"
        element={
          <ProtectedRoute role="admin">
            <AdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/courses/:courseId"
        element={
          <ProtectedRoute role="admin">
            <AdminCoursePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/courses/:courseId/assignments/:assignmentId"
        element={
          <ProtectedRoute role="admin">
            <AssignmentSubmissions />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
