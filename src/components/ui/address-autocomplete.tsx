/**
 * Address autocomplete input powered by the French government BAN API
 * (api-adresse.data.gouv.fr). No API key required, free, accurate for France.
 *
 * Suggestions appear as the user types (debounced). Selecting one fills the
 * street field and notifies the parent of the matching postal code + city
 * via `onAddressSelect` so the surrounding form can update those fields too.
 *
 * Designed as a drop-in replacement for <Input /> bound to the street value.
 */
import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Loader2, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AddressSuggestion {
  label: string;        // full formatted address
  street: string;       // street part only (e.g. "12 rue de Rivoli")
  postcode: string;
  city: string;
  context?: string;     // e.g. "75, Paris, Île-de-France"
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onAddressSelect?: (suggestion: AddressSuggestion) => void;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
  /** Limit results around a given postcode to bias suggestions (optional) */
  postcodeHint?: string;
}

interface BanFeature {
  properties: {
    label: string;
    name: string;
    postcode: string;
    city: string;
    context: string;
    type: string;
  };
}

export function AddressAutocomplete({
  value,
  onChange,
  onAddressSelect,
  placeholder = "Commencez à saisir une adresse…",
  disabled,
  id,
  className,
  postcodeHint,
}: AddressAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Used to skip the next fetch right after a user picks a suggestion
  // (otherwise the controlled value change would reopen the dropdown).
  const skipNextFetchRef = useRef(false);

  // Debounced fetch
  useEffect(() => {
    if (skipNextFetchRef.current) {
      skipNextFetchRef.current = false;
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (abortRef.current) abortRef.current.abort();

    const trimmed = value.trim();
    if (trimmed.length < 3) {
      setSuggestions([]);
      setOpen(false);
      setLoading(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      try {
        const params = new URLSearchParams({
          q: trimmed,
          limit: "6",
          autocomplete: "1",
        });
        if (postcodeHint && /^\d{5}$/.test(postcodeHint)) {
          params.set("postcode", postcodeHint);
        }
        const res = await fetch(
          `https://api-adresse.data.gouv.fr/search/?${params.toString()}`,
          { signal: controller.signal }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const features: BanFeature[] = data.features ?? [];
        const mapped: AddressSuggestion[] = features.map((f) => ({
          label: f.properties.label,
          street: f.properties.name,
          postcode: f.properties.postcode,
          city: f.properties.city,
          context: f.properties.context,
        }));
        setSuggestions(mapped);
        setOpen(mapped.length > 0);
        setHighlight(-1);
      } catch (err: any) {
        if (err?.name !== "AbortError") {
          // Network errors are silent — autocomplete is non-blocking.
          setSuggestions([]);
          setOpen(false);
        }
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value, postcodeHint]);

  // Close on outside click
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const pick = (s: AddressSuggestion) => {
    skipNextFetchRef.current = true;
    onChange(s.street || s.label);
    onAddressSelect?.(s);
    setOpen(false);
    setSuggestions([]);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter" && highlight >= 0) {
      e.preventDefault();
      pick(suggestions[highlight]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className="relative">
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
        />
        {loading && (
          <Loader2 className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>
      {open && suggestions.length > 0 && (
        <ul
          role="listbox"
          className="absolute z-50 mt-1 max-h-72 w-full overflow-auto rounded-md border bg-popover p-1 shadow-md"
        >
          {suggestions.map((s, i) => (
            <li
              key={`${s.label}-${i}`}
              role="option"
              aria-selected={i === highlight}
              onMouseDown={(e) => {
                // mousedown so the click fires before the input's blur
                e.preventDefault();
                pick(s);
              }}
              onMouseEnter={() => setHighlight(i)}
              className={cn(
                "flex cursor-pointer items-start gap-2 rounded-sm px-2 py-2 text-sm",
                i === highlight ? "bg-accent text-accent-foreground" : "text-popover-foreground"
              )}
            >
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <div className="truncate font-medium">{s.label}</div>
                {s.context && (
                  <div className="truncate text-xs text-muted-foreground">{s.context}</div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
