import * as React from 'react';
import { cn } from '@/lib/utils';

// Status and Type badges with forwardRef support

type InterventionStatus = 'to_plan' | 'planned' | 'in_progress' | 'completed' | 'to_invoice' | 'archived';

const statusConfig: Record<InterventionStatus, { label: string; className: string }> = {
  to_plan: {
    label: 'À planifier',
    className: 'status-to-plan',
  },
  planned: {
    label: 'Planifiée',
    className: 'status-planned',
  },
  in_progress: {
    label: 'En cours',
    className: 'status-in-progress',
  },
  completed: {
    label: 'Terminée',
    className: 'status-completed',
  },
  to_invoice: {
    label: 'À facturer',
    className: 'status-to-invoice',
  },
  archived: {
    label: 'Archivée',
    className: 'status-archived',
  },
};

interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: InterventionStatus;
}

export const StatusBadge = React.forwardRef<HTMLSpanElement, StatusBadgeProps>(
  ({ status, className, ...props }, ref) => {
    const config = statusConfig[status];
    
    return (
      <span 
        ref={ref}
        className={cn('status-badge', config.className, className)}
        {...props}
      >
        {config.label}
      </span>
    );
  }
);
StatusBadge.displayName = 'StatusBadge';

type InterventionType = 'sav' | 'maintenance' | 'installation';

const typeConfig: Record<InterventionType, { label: string; className: string }> = {
  sav: {
    label: 'SAV',
    className: 'bg-red-100 text-red-800',
  },
  maintenance: {
    label: 'Maintenance',
    className: 'bg-blue-100 text-blue-800',
  },
  installation: {
    label: 'Installation',
    className: 'bg-green-100 text-green-800',
  },
};

interface TypeBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  type: InterventionType;
}

export const TypeBadge = React.forwardRef<HTMLSpanElement, TypeBadgeProps>(
  ({ type, className, ...props }, ref) => {
    const config = typeConfig[type];
    
    return (
      <span 
        ref={ref}
        className={cn('status-badge', config.className, className)}
        {...props}
      >
        {config.label}
      </span>
    );
  }
);
TypeBadge.displayName = 'TypeBadge';
