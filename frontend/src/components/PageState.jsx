import React from 'react';
import { Spinner } from './ui/spinner.jsx';
import { Button } from './ui/button.jsx';

export function LoadingState({ label = 'Loading...' }) {
  return (
    <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm py-16">
      <Spinner /> {label}
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="text-center py-16">
      <p className="text-sm text-destructive mb-3">{message || 'Something went wrong.'}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function EmptyState({ children }) {
  return <p className="text-sm text-muted-foreground py-8 text-center">{children}</p>;
}
