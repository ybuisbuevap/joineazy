import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils.js';

export function Spinner({ className, size = 16 }) {
  return <Loader2 size={size} className={cn('animate-spin', className)} />;
}
