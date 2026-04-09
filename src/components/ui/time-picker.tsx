import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

interface TimePickerProps {
  value?: string;
  onChange?: (value: string) => void;
  step?: number;
  className?: string;
  placeholder?: string;
}

export function TimePicker({ value, onChange, step = 15, className, placeholder = "HH:MM" }: TimePickerProps) {
  const [open, setOpen] = useState(false);
  const [manualValue, setManualValue] = useState(value || "");
  const selectedRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setManualValue(value || "");
  }, [value]);

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

  const handleManualBlur = () => {
    const match = manualValue.match(/^(\d{1,2}):(\d{2})$/);
    if (match) {
      const h = Math.min(23, parseInt(match[1]));
      const m = Math.min(59, parseInt(match[2]));
      const formatted = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      setManualValue(formatted);
      onChange?.(formatted);
    }
  };

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
      <PopoverContent className="w-[180px] p-0" align="start">
        <div className="p-2 border-b">
          <Input
            type="time"
            value={manualValue}
            onChange={(e) => {
              setManualValue(e.target.value);
              if (e.target.value) {
                onChange?.(e.target.value);
              }
            }}
            onBlur={handleManualBlur}
            className="h-8 text-sm"
            placeholder="HH:MM"
          />
        </div>
        <ScrollArea className="h-[200px]">
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
