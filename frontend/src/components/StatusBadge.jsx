import React from 'react';
import { CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import { Badge } from './ui/badge.jsx';

// Renders an assignment or submission status consistently everywhere it appears.
export default function StatusBadge({ status, animate = false }) {
  if (status === 'acknowledged') {
    return (
      <Badge variant="success" className={animate ? 'animate-in zoom-in-75 fade-in duration-300' : ''}>
        <CheckCircle2 size={12} className="mr-1" /> Acknowledged
      </Badge>
    );
  }
  if (status === 'overdue') {
    return (
      <Badge variant="outline" className="border-destructive/40 text-destructive">
        <AlertTriangle size={12} className="mr-1" /> Overdue
      </Badge>
    );
  }
  return (
    <Badge variant="muted">
      <Clock size={12} className="mr-1" /> Pending
    </Badge>
  );
}
