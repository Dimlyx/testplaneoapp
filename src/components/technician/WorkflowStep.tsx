import { Check, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface WorkflowStepProps {
  icon: LucideIcon;
  label: string;
  isActive?: boolean;
  isCompleted?: boolean;
  isLast?: boolean;
  onClick?: () => void;
  children?: React.ReactNode;
}

const WorkflowStep = ({
  icon: Icon,
  label,
  isActive = false,
  isCompleted = false,
  isLast = false,
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
            isCompleted ? "bg-primary" : "bg-border"
          )}
        />
      )}
      
      {/* Step content */}
      <div 
        className={cn(
          "flex items-start gap-3 p-3 rounded-lg transition-colors cursor-pointer",
          isActive && "bg-primary/10",
          !isActive && !isCompleted && "hover:bg-muted/50"
        )}
        onClick={onClick}
      >
        {/* Icon circle */}
        <div 
          className={cn(
            "relative z-10 flex items-center justify-center w-12 h-12 rounded-lg shrink-0 transition-colors",
            isCompleted && "bg-primary text-primary-foreground",
            isActive && !isCompleted && "bg-primary text-primary-foreground ring-4 ring-primary/30",
            !isActive && !isCompleted && "bg-muted text-muted-foreground"
          )}
        >
          {isCompleted ? (
            <Check className="h-5 w-5" />
          ) : (
            <Icon className="h-5 w-5" />
          )}
        </div>
        
        {/* Label and chevron */}
        <div className="flex-1 flex items-center justify-between min-h-[48px]">
          <span className={cn(
            "font-medium",
            isCompleted && "text-primary",
            isActive && "text-foreground",
            !isActive && !isCompleted && "text-muted-foreground"
          )}>
            {label}
          </span>
          <ChevronRight className={cn(
            "h-5 w-5",
            isActive ? "text-primary" : "text-muted-foreground"
          )} />
        </div>
      </div>
      
      {/* Expanded content */}
      {isActive && children && (
        <div className="ml-[60px] mt-2 mb-4 space-y-4">
          {children}
        </div>
      )}
    </div>
  );
};

export default WorkflowStep;
