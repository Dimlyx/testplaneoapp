import { cn } from '@/lib/utils';

type InterventionStatus = 'to_plan' | 'planned' | 'in_progress' | 'completed';

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
};

interface StatusBadgeProps {
  status: InterventionStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status];
  
  return (
    <span className={cn('status-badge', config.className, className)}>
      {config.label}
    </span>
  );
}

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

interface TypeBadgeProps {
  type: InterventionType;
  className?: string;
}

export function TypeBadge({ type, className }: TypeBadgeProps) {
  const config = typeConfig[type];
  
  return (
    <span className={cn('status-badge', config.className, className)}>
      {config.label}
    </span>
  );
}