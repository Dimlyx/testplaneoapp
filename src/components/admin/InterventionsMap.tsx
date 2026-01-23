import { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TypeBadge } from '@/components/ui/status-badge';
import { MapPin, AlertTriangle, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Intervention } from '@/hooks/useInterventions';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons in Leaflet with Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Custom marker icon for interventions
const interventionIcon = new L.Icon({
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

interface GeocodedIntervention extends Intervention {
  lat: number;
  lng: number;
}

interface InterventionsMapProps {
  interventions: Intervention[];
}

// Component to fit bounds when markers change
function FitBounds({ markers }: { markers: GeocodedIntervention[] }) {
  const map = useMap();

  useEffect(() => {
    if (markers.length > 0) {
      const bounds = L.latLngBounds(markers.map(m => [m.lat, m.lng]));
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
    }
  }, [markers, map]);

  return null;
}

// Simple geocoding using Nominatim (OpenStreetMap)
async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`,
      {
        headers: {
          'User-Agent': 'MobileInt/1.0',
        },
      }
    );
    const data = await response.json();
    if (data && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
      };
    }
    return null;
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
}

export default function InterventionsMap({ interventions }: InterventionsMapProps) {
  const [geocodedInterventions, setGeocodedInterventions] = useState<GeocodedIntervention[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [failedCount, setFailedCount] = useState(0);

  // Filter only "to_plan" interventions
  const toPlanInterventions = useMemo(
    () => interventions.filter(i => i.status === 'to_plan'),
    [interventions]
  );

  useEffect(() => {
    const geocodeInterventions = async () => {
      setIsLoading(true);
      const geocoded: GeocodedIntervention[] = [];
      let failed = 0;

      for (const intervention of toPlanInterventions) {
        // Build address from intervention or client
        const address = intervention.intervention_address || intervention.clients?.address;
        const city = intervention.intervention_city || intervention.clients?.city;
        const postalCode = intervention.intervention_postal_code || intervention.clients?.postal_code;

        if (address && city) {
          const fullAddress = `${address}, ${postalCode || ''} ${city}, France`;
          const coords = await geocodeAddress(fullAddress);
          
          if (coords) {
            geocoded.push({
              ...intervention,
              lat: coords.lat,
              lng: coords.lng,
            });
          } else {
            failed++;
          }
          
          // Rate limiting for Nominatim API
          await new Promise(resolve => setTimeout(resolve, 300));
        } else {
          failed++;
        }
      }

      setGeocodedInterventions(geocoded);
      setFailedCount(failed);
      setIsLoading(false);
    };

    if (toPlanInterventions.length > 0) {
      geocodeInterventions();
    } else {
      setIsLoading(false);
    }
  }, [toPlanInterventions]);

  // Default center: France
  const defaultCenter: [number, number] = [46.603354, 1.888334];
  const defaultZoom = 6;

  if (toPlanInterventions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Carte des interventions à planifier
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[400px] flex items-center justify-center bg-muted/30 rounded-lg">
            <p className="text-muted-foreground">Aucune intervention à planifier</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Carte des interventions à planifier
          </div>
          <div className="flex items-center gap-2 text-sm font-normal">
            {isLoading ? (
              <span className="flex items-center gap-1 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Géolocalisation...
              </span>
            ) : (
              <>
                <span className="text-primary font-medium">{geocodedInterventions.length}</span>
                <span className="text-muted-foreground">sur {toPlanInterventions.length} localisées</span>
                {failedCount > 0 && (
                  <span className="text-amber-500 flex items-center gap-1">
                    <AlertTriangle className="h-4 w-4" />
                    {failedCount} sans adresse
                  </span>
                )}
              </>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[400px] rounded-lg overflow-hidden border">
          <MapContainer
            center={defaultCenter}
            zoom={defaultZoom}
            className="h-full w-full"
            scrollWheelZoom={true}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {geocodedInterventions.map((intervention) => (
              <Marker
                key={intervention.id}
                position={[intervention.lat, intervention.lng]}
                icon={interventionIcon}
              >
                <Popup>
                  <div className="min-w-[200px]">
                    <h3 className="font-semibold mb-1">{intervention.title}</h3>
                    <div className="mb-2">
                      <TypeBadge type={intervention.intervention_type} />
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      {intervention.clients?.name}
                    </p>
                    <p className="text-xs text-muted-foreground mb-3">
                      {intervention.intervention_address || intervention.clients?.address}
                      <br />
                      {intervention.intervention_postal_code || intervention.clients?.postal_code}{' '}
                      {intervention.intervention_city || intervention.clients?.city}
                    </p>
                    <Link
                      to={`/admin/interventions/${intervention.id}`}
                      className="text-sm text-primary hover:underline font-medium"
                    >
                      Planifier cette intervention →
                    </Link>
                  </div>
                </Popup>
              </Marker>
            ))}
            {geocodedInterventions.length > 0 && <FitBounds markers={geocodedInterventions} />}
          </MapContainer>
        </div>
      </CardContent>
    </Card>
  );
}
