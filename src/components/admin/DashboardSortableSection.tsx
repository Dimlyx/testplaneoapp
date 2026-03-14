import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, ChevronDown, ChevronRight, Maximize2, Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface DashboardSortableSectionProps {
  id: string;
  children: ReactNode;
  isDragMode: boolean;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  label: string;
  size?: 'half' | 'full';
  onToggleSize?: () => void;
}

export function DashboardSortableSection({ id, children, isDragMode, isCollapsed, onToggleCollapse, label, size = 'full', onToggleSize }: DashboardSortableSectionProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: !isDragMode });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative group/section",
        isDragging && "z-50 opacity-80",
        isDragMode && "rounded-lg ring-1 ring-dashed ring-muted-foreground/20"
      )}
    >
      {isDragMode && (
        <div className="flex items-center gap-1 mb-1">
          <button
            {...attributes}
            {...listeners}
            className="p-1.5 rounded-md bg-muted border shadow-sm cursor-grab active:cursor-grabbing hover:bg-accent transition-colors"
            aria-label="Glisser pour réorganiser"
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </button>
          <button
            onClick={onToggleCollapse}
            className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-muted border shadow-sm hover:bg-accent transition-colors text-xs font-medium text-muted-foreground"
          >
            {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {label}
          </button>
          {onToggleSize && (
            <button
              onClick={onToggleSize}
              className="p-1.5 rounded-md bg-muted border shadow-sm hover:bg-accent transition-colors"
              aria-label={size === 'full' ? 'Réduire en demi-largeur' : 'Agrandir en pleine largeur'}
            >
              {size === 'full' ? <Minimize2 className="h-3.5 w-3.5 text-muted-foreground" /> : <Maximize2 className="h-3.5 w-3.5 text-muted-foreground" />}
            </button>
          )}
        </div>
      )}

      {!isDragMode && (
        <button
          onClick={onToggleCollapse}
          className="absolute -left-6 top-2 opacity-0 group-hover/section:opacity-100 transition-opacity p-0.5 rounded hover:bg-muted"
          aria-label={isCollapsed ? "Déplier" : "Replier"}
        >
          {isCollapsed ? <ChevronRight className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </button>
      )}

      {isCollapsed ? (
        <div 
          className="px-4 py-2 rounded-lg border border-dashed border-muted-foreground/20 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={onToggleCollapse}
        >
          <span className="text-sm text-muted-foreground font-medium flex items-center gap-2">
            <ChevronRight className="h-4 w-4" />
            {label}
          </span>
        </div>
      ) : (
        <div className="relative">
          {children}
          {/* Resize toggle icon — bottom right */}
          {onToggleSize && (
            <button
              onClick={onToggleSize}
              className="absolute bottom-2 right-2 p-1.5 rounded-md bg-background/80 border shadow-sm opacity-0 group-hover/section:opacity-100 hover:bg-accent transition-all backdrop-blur-sm z-10"
              aria-label={size === 'full' ? 'Réduire en demi-largeur' : 'Agrandir en pleine largeur'}
              title={size === 'full' ? 'Demi-largeur' : 'Pleine largeur'}
            >
              {size === 'full' ? <Minimize2 className="h-3.5 w-3.5 text-muted-foreground" /> : <Maximize2 className="h-3.5 w-3.5 text-muted-foreground" />}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
