import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { Badge } from './ui/badge.jsx';
import { Button } from './ui/button.jsx';
import ThemeToggle from './ThemeToggle.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function Navbar({ backTo, backLabel }) {
  const { user, logout } = useAuth();
  const homeHref = user?.role === 'admin' ? '/admin' : '/student';

  return (
    <header className="border-b border-border">
      <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          {backTo ? (
            <Link to={backTo} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground shrink-0">
              <ChevronLeft size={16} /> {backLabel || 'Back'}
            </Link>
          ) : (
            <Link to={homeHref} className="font-display font-semibold text-lg shrink-0">
              Joineazy
            </Link>
          )}
          {user && (
            <Badge variant={user.role === 'admin' ? 'default' : 'muted'} className="capitalize shrink-0">
              {user.role === 'admin' ? 'Professor' : user.role}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-sm text-muted-foreground hidden sm:inline">{user?.name}</span>
          <ThemeToggle />
          <Button variant="outline" size="sm" onClick={logout}>
            Log out
          </Button>
        </div>
      </div>
    </header>
  );
}
