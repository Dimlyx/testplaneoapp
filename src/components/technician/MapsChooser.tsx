import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MapPin } from "lucide-react";

interface MapsChooserProps {
  address: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

const appsConfig = [
  {
    name: "Google Maps",
    icon: "🗺️",
    getUrl: (q: string) => isIOS ? `comgooglemaps://?q=${q}` : `google.navigation:q=${q}`,
    fallbackUrl: (q: string) => `https://www.google.com/maps/search/?api=1&query=${q}`,
    available: true,
  },
  {
    name: "Waze",
    icon: "🚗",
    getUrl: (q: string) => `waze://?q=${q}&navigate=yes`,
    fallbackUrl: (q: string) => `https://waze.com/ul?q=${q}&navigate=yes`,
    available: true,
  },
  {
    name: "Apple Plans",
    icon: "🍎",
    getUrl: (q: string) => `maps://?q=${q}`,
    fallbackUrl: (q: string) => `https://maps.apple.com/?q=${q}`,
    available: isIOS,
  },
];

export function MapsChooser({ address, open, onOpenChange }: MapsChooserProps) {
  if (!address) return null;

  const encoded = encodeURIComponent(address);

  const handleOpen = (getUrl: (q: string) => string) => {
    window.open(getUrl(encoded), "_blank", "noopener,noreferrer");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <MapPin className="h-4 w-4" />
            Ouvrir avec…
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-2 pt-2">
          {appsConfig
            .filter((app) => app.available)
            .map((app) => (
              <button
                key={app.name}
                type="button"
                onClick={() => handleOpen(app.getUrl)}
                className="flex items-center gap-3 rounded-lg border border-border p-3 text-left transition-colors hover:bg-accent"
              >
                <span className="text-2xl">{app.icon}</span>
                <span className="text-sm font-medium">{app.name}</span>
              </button>
            ))}
        </div>
        <p className="text-xs text-muted-foreground truncate pt-1">{address}</p>
      </DialogContent>
    </Dialog>
  );
}

export function useMapsChooser() {
  const [state, setState] = useState<{ open: boolean; address: string | null }>({
    open: false,
    address: null,
  });

  const openMaps = (address: string) => setState({ open: true, address });
  const setOpen = (open: boolean) => setState((s) => ({ ...s, open }));

  return { ...state, openMaps, setOpen };
}
