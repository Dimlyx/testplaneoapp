import { cn } from '@/lib/utils';

interface ChartClickEntry {
  name: string;
  value: string | number;
  color?: string;
}

interface ChartClickInfoProps {
  label?: string;
  entries: ChartClickEntry[];
  className?: string;
}

export function ChartClickInfo({ label, entries, className }: ChartClickInfoProps) {
  if (entries.length === 0) return null;

  return (
    <div className={cn("mt-3 p-3 rounded-lg border bg-muted/30 animate-fade-in", className)}>
      {label && <p className="font-semibold text-sm mb-1.5 text-foreground">{label}</p>}
      <div className="flex flex-wrap gap-x-5 gap-y-1">
        {entries.map((entry, i) => (
          <div key={i} className="flex items-center gap-1.5 text-sm">
            {entry.color && (
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
            )}
            <span className="text-muted-foreground">{entry.name}</span>
            <span className="font-semibold">{entry.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
