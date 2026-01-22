import { motion, AnimatePresence } from 'framer-motion';
import { Cloud, CloudOff, Check, Loader2, AlertCircle } from 'lucide-react';
import { AutosaveStatus } from '@/hooks/useAutosave';
import { cn } from '@/lib/utils';

interface AutosaveIndicatorProps {
  status: AutosaveStatus;
  className?: string;
}

const statusConfig: Record<AutosaveStatus, { 
  icon: typeof Cloud; 
  text: string; 
  color: string; 
  animate?: boolean 
}> = {
  idle: {
    icon: Cloud,
    text: '',
    color: 'text-muted-foreground',
  },
  saving: {
    icon: Loader2,
    text: 'Saving...',
    color: 'text-accent',
    animate: true,
  },
  saved: {
    icon: Check,
    text: 'Saved',
    color: 'text-success',
  },
  offline: {
    icon: CloudOff,
    text: 'Offline — changes will sync',
    color: 'text-warning',
  },
  error: {
    icon: AlertCircle,
    text: 'Save failed',
    color: 'text-destructive',
  },
};

export function AutosaveIndicator({ status, className }: AutosaveIndicatorProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  if (status === 'idle') return null;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={status}
        initial={{ opacity: 0, x: 10 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -10 }}
        className={cn(
          'flex items-center gap-1.5 text-xs',
          config.color,
          className
        )}
        role="status"
        aria-live="polite"
      >
        <Icon 
          className={cn(
            'w-3.5 h-3.5',
            config.animate && 'animate-spin'
          )} 
        />
        <span>{config.text}</span>
      </motion.div>
    </AnimatePresence>
  );
}
