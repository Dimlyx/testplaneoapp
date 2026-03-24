import * as React from 'react';
import { cn } from '@/lib/utils';
import { useInterventionTypes } from '@/hooks/useInterventionTypes';
import { useCustomStatuses } from '@/hooks/useCustomStatuses';

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
  customStatusId?: string | null;
}

export const StatusBadge = React.forwardRef<HTMLSpanElement, StatusBadgeProps>(
  ({ status, customStatusId, className, ...props }, ref) => {
    const { data: customStatuses = [] } = useCustomStatuses();
    
    // If there's a custom status, show it instead
    if (customStatusId) {
      const custom = customStatuses.find(s => s.id === customStatusId);
      if (custom) {
        return (
          <span
            ref={ref}
            className={cn('status-badge', className)}
            style={{
              backgroundColor: custom.color + '20',
              color: custom.color,
              borderColor: custom.color + '40',
            }}
            {...props}
          >
            {custom.label}
          </span>
        );
      }
    }

    const config = statusConfig[status];
    
    return (
      <span 
        ref={ref}
        className={cn('status-badge', config?.className, className)}
        {...props}
      >
        {config?.label || status}
      </span>
    );
  }
);
StatusBadge.displayName = 'StatusBadge';

const colorClassMap: Record<string, string> = {
  red: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
  blue: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
  green: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
  yellow: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300',
  purple: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300',
  orange: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300',
  pink: 'bg-pink-100 text-pink-800 dark:bg-pink-950 dark:text-pink-300',
  gray: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
};

interface TypeBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  type: string;
}

export const TypeBadge = React.forwardRef<HTMLSpanElement, TypeBadgeProps>(
  ({ type, className, ...props }, ref) => {
    const { data: interventionTypes = [] } = useInterventionTypes();
    const found = interventionTypes.find(t => t.name === type);
    const colorClass = found?.color ? (colorClassMap[found.color] || 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300') : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
    const label = found?.label || type;
    
    return (
      <span 
        ref={ref}
        className={cn('status-badge', colorClass, className)}
        {...props}
      >
        {label}
      </span>
    );
  }
);
TypeBadge.displayName = 'TypeBadge';
