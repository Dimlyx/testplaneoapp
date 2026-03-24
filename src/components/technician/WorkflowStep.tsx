import { Check, ChevronRight, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface WorkflowStepProps {
  icon: LucideIcon;
  label: string;
  isActive?: boolean;
  isCompleted?: boolean;
  isLast?: boolean;
  isDisabled?: boolean;
  onClick?: () => void;
  children?: React.ReactNode;
}

const WorkflowStep = ({
  icon: Icon,
  label,
  isActive = false,
  isCompleted = false,
  isLast = false,
  isDisabled = false,
  onClick,
  children,
}: WorkflowStepProps) => {
  return (
    <div className="relative">
      {/* Connector line */}
      {!isLast && (
        <div 
          className={cn(
            "absolute left-6 top-12 w-0.5 h-full -translate-x-1/2",
            isCompleted ? "bg-primary dark:bg-primary" : "bg-border"
          )}
        />
      )}
      
      {/* Step content */}
      <div 
        className={cn(
          "flex items-start gap-3 p-3 rounded-lg transition-colors",
          isDisabled && "opacity-50 cursor-not-allowed",
          !isDisabled && "cursor-pointer",
          isActive && !isDisabled && "bg-primary/10",
          !isActive && !isCompleted && !isDisabled && "hover:bg-muted/50"
        )}
        onClick={isDisabled ? undefined : onClick}
      >
        {/* Icon circle */}
        <div 
          className={cn(
            "relative z-10 flex items-center justify-center w-12 h-12 rounded-lg shrink-0 transition-colors",
            isDisabled && "bg-muted text-muted-foreground",
            !isDisabled && isCompleted && "bg-primary text-primary-foreground",
            !isDisabled && isActive && !isCompleted && "bg-primary text-primary-foreground ring-4 ring-primary/30",
            !isDisabled && !isActive && !isCompleted && "bg-muted text-muted-foreground"
          )}
        >
          {isDisabled ? (
            <Lock className="h-4 w-4" />
          ) : isCompleted ? (
            <Check className="h-5 w-5" />
          ) : (
            <Icon className="h-5 w-5" />
          )}
        </div>
        
        {/* Label and chevron */}
        <div className="flex-1 flex items-center justify-between min-h-[48px]">
          <span className={cn(
            "font-medium",
            isDisabled && "text-muted-foreground",
            !isDisabled && isCompleted && "text-primary",
            !isDisabled && isActive && "text-foreground",
            !isDisabled && !isActive && !isCompleted && "text-muted-foreground"
          )}>
            {label}
          </span>
          <ChevronRight className={cn(
            "h-5 w-5",
            isActive && !isDisabled ? "text-primary" : "text-muted-foreground"
          )} />
        </div>
      </div>
      
      {/* Expanded content */}
      {isActive && !isDisabled && children && (
        <div className="ml-[60px] mt-2 mb-4 space-y-4">
          {children}
        </div>
      )}
    </div>
  );
};

export default WorkflowStep;
