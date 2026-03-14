import { useState, useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TypeBadge, StatusBadge } from "@/components/ui/status-badge";
import { Badge } from "@/components/ui/badge";
import { MapPin, Filter, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import "leaflet/dist/leaflet.css";

// Fix Leaflet default icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const statusColors: Record<string, string> = {
  to_plan: "#f59e0b",
  planned: "#3b82f6",
  in_progress: "#8b5cf6",
  completed: "#22c55e",
  to_invoice: "#f97316",
  archived: "#6b7280",
};

function createColoredIcon(color: string) {
  return L.divIcon({
    className: "custom-marker",
    html: `<div style="
      background-color: ${color};
      width: 24px;
      height: 24px;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      border: 2px solid white;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    "></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 24],
    popupAnchor: [0, -24],
  });
}

interface GeocodedIntervention {
  id: string;
  title: string;
  status: string;
  intervention_type: string;
  technician_id: string | null;
  client_name: string;
  scheduled_date: string | null;
  lat: number;
  lng: number;
  address: string;
}

interface InterventionsMapProps {
  interventions: any[];
  clients: { id: string; name: string }[];
  technicians: { id: string; full_name: string | null; email: string }[];
}

const GEOCODE_CACHE_KEY = "planeo-geocode-cache";

function getGeocodeCache(): Record<string, { lat: number; lng: number }> {
  try {
    const raw = localStorage.getItem(GEOCODE_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function setGeocodeCache(cache: Record<string, { lat: number; lng: number }>) {
  try {
    localStorage.setItem(GEOCODE_CACHE_KEY, JSON.stringify(cache));
  } catch {}
}

async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  const cache = getGeocodeCache();
  if (cache[address]) return cache[address];

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`,
      { headers: { "User-Agent": "Planeo-App" } }
    );
    const data = await res.json();
    if (data && data.length > 0) {
      const result = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
      cache[address] = result;
      setGeocodeCache(cache);
      return result;
    }
  } catch {}
  return null;
}

export default function InterventionsMap({ interventions, clients, technicians }: InterventionsMapProps) {
  const [geocoded, setGeocoded] = useState<GeocodedIntervention[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterTechnician, setFilterTechnician] = useState<string>("all");

  const getClientName = (clientId: string) => {
    return clients.find(c => c.id === clientId)?.name || "Client inconnu";
  };

  const getTechnicianName = (techId: string | null) => {
    if (!techId) return "Non assigné";
    const tech = technicians.find(t => t.id === techId);
    return tech?.full_name || tech?.email || "Inconnu";
  };

  // Geocode all interventions with addresses
  useEffect(() => {
    let cancelled = false;

    async function geocodeAll() {
      setLoading(true);
      const addressable = interventions.filter(
        i => i.intervention_address || i.intervention_city
      );

      const results: GeocodedIntervention[] = [];

      for (const intervention of addressable) {
        if (cancelled) break;
        const fullAddress = [
          intervention.intervention_address,
          intervention.intervention_postal_code,
          intervention.intervention_city,
          "France",
        ].filter(Boolean).join(", ");

        const coords = await geocodeAddress(fullAddress);
        if (coords) {
          results.push({
            id: intervention.id,
            title: intervention.title,
            status: intervention.status,
            intervention_type: intervention.intervention_type,
            technician_id: intervention.technician_id,
            client_name: getClientName(intervention.client_id),
            scheduled_date: intervention.scheduled_date,
            lat: coords.lat,
            lng: coords.lng,
            address: fullAddress.replace(", France", ""),
          });
        }

        // Small delay to respect Nominatim rate limits
        await new Promise(r => setTimeout(r, 200));
      }

      if (!cancelled) {
        setGeocoded(results);
        setLoading(false);
      }
    }

    geocodeAll();
    return () => { cancelled = true; };
  }, [interventions, clients]);

  const interventionTypes = useMemo(() => {
    const types = new Set(interventions.map(i => i.intervention_type));
    return Array.from(types);
  }, [interventions]);

  const filtered = useMemo(() => {
    return geocoded.filter(g => {
      if (filterStatus !== "all" && g.status !== filterStatus) return false;
      if (filterType !== "all" && g.intervention_type !== filterType) return false;
      if (filterTechnician !== "all" && g.technician_id !== filterTechnician) return false;
      return true;
    });
  }, [geocoded, filterStatus, filterType, filterTechnician]);

  // Default center: France
  const center = useMemo<[number, number]>(() => {
    if (filtered.length > 0) {
      const avgLat = filtered.reduce((s, g) => s + g.lat, 0) / filtered.length;
      const avgLng = filtered.reduce((s, g) => s + g.lng, 0) / filtered.length;
      return [avgLat, avgLng];
    }
    return [46.603354, 1.888334]; // Center of France
  }, [filtered]);

  const statusOptions = [
    { value: "to_plan", label: "À planifier" },
    { value: "planned", label: "Planifiées" },
    { value: "in_progress", label: "En cours" },
    { value: "completed", label: "Terminées" },
    { value: "to_invoice", label: "À facturer" },
    { value: "archived", label: "Archivées" },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Carte des interventions
            <Badge variant="secondary" className="ml-1">{filtered.length}</Badge>
          </span>
          {loading && (
            <span className="flex items-center gap-1 text-sm font-normal text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Chargement...
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Filters */}
        <div className="flex flex-wrap gap-2 relative z-[1000]">
          <div className="flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[140px] h-8 text-xs">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous statuts</SelectItem>
              {statusOptions.map(s => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[140px] h-8 text-xs">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous types</SelectItem>
              {interventionTypes.map(t => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterTechnician} onValueChange={setFilterTechnician}>
            <SelectTrigger className="w-[160px] h-8 text-xs">
              <SelectValue placeholder="Technicien" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous techniciens</SelectItem>
              {technicians.map(t => (
                <SelectItem key={t.id} value={t.id}>{t.full_name || t.email}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Map */}
        <div className="rounded-lg overflow-hidden border" style={{ height: 400 }}>
          <MapContainer
            center={center}
            zoom={filtered.length > 0 ? 7 : 6}
            style={{ height: "100%", width: "100%" }}
            key={`${center[0]}-${center[1]}`}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {filtered.map(g => (
              <Marker
                key={g.id}
                position={[g.lat, g.lng]}
                icon={createColoredIcon(statusColors[g.status] || "#6b7280")}
              >
                <Popup>
                  <div className="space-y-1.5 min-w-[180px]">
                    <p className="font-semibold text-sm">{g.title}</p>
                    <p className="text-xs text-muted-foreground">{g.client_name}</p>
                    <p className="text-xs text-muted-foreground">{g.address}</p>
                    {g.scheduled_date && (
                      <p className="text-xs">
                        📅 {format(new Date(g.scheduled_date), 'dd MMM yyyy', { locale: fr })}
                      </p>
                    )}
                    <p className="text-xs">👷 {getTechnicianName(g.technician_id)}</p>
                    <div className="pt-1">
                      <Link
                        to={`/admin/interventions/${g.id}`}
                        className="text-xs text-primary hover:underline font-medium"
                      >
                        Voir le détail →
                      </Link>
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 text-xs">
          {statusOptions.map(s => (
            <div key={s.value} className="flex items-center gap-1.5">
              <div
                className="w-3 h-3 rounded-full border border-white shadow-sm"
                style={{ backgroundColor: statusColors[s.value] }}
              />
              <span className="text-muted-foreground">{s.label}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
