import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

interface TimePickerProps {
  value?: string;
  onChange?: (value: string) => void;
  step?: number; // minutes between each option, default 15
  className?: string;
  placeholder?: string;
}

export function TimePicker({ value, onChange, step = 15, className, placeholder = "HH:MM" }: TimePickerProps) {
  const [open, setOpen] = useState(false);
  const selectedRef = useRef<HTMLButtonElement>(null);

  const times: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += step) {
      times.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }

  useEffect(() => {
    if (open && selectedRef.current) {
      setTimeout(() => selectedRef.current?.scrollIntoView({ block: "center" }), 50);
    }
  }, [open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal h-10",
            !value && "text-muted-foreground",
            className
          )}
          type="button"
        >
          <Clock className="mr-2 h-4 w-4 shrink-0" />
          {value || placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[160px] p-0" align="start">
        <ScrollArea className="h-[240px]">
          <div className="p-1 space-y-0.5">
            {times.map((t) => (
              <button
                key={t}
                ref={t === value ? selectedRef : undefined}
                type="button"
                className={cn(
                  "w-full text-left px-3 py-1.5 text-sm rounded-md transition-colors",
                  t === value
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-accent hover:text-accent-foreground"
                )}
                onClick={() => {
                  onChange?.(t);
                  setOpen(false);
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
