import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface DashboardSortableSectionProps {
  id: string;
  children: ReactNode;
  isDragMode: boolean;
}

export function DashboardSortableSection({ id, children, isDragMode }: DashboardSortableSectionProps) {
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
        <button
          {...attributes}
          {...listeners}
          className="absolute -left-2 top-1/2 -translate-y-1/2 z-10 p-1.5 rounded-md bg-muted border shadow-sm cursor-grab active:cursor-grabbing hover:bg-accent transition-colors"
          aria-label="Glisser pour réorganiser"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </button>
      )}
      {children}
    </div>
  );
}
