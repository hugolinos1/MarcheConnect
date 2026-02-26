
'use client';

import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Exhibitor } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Eye, MapPin, Loader2 } from 'lucide-react';
import { getStatusLabel, getStatusVariant } from '@/app/admin/page';

// Fix for default marker icons in React Leaflet
const DefaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

interface AdminMapProps {
  exhibitors: Exhibitor[];
  onViewExhibitor: (exhibitor: Exhibitor) => void;
}

interface GeocodedExhibitor {
  exhibitor: Exhibitor;
  lat: number;
  lon: number;
}

// Center the map around Chazay d'Azergues by default
const DEFAULT_CENTER: [number, number] = [45.875, 4.708];

export function AdminMap({ exhibitors, onViewExhibitor }: AdminMapProps) {
  const [geocodedData, setGeocodedData] = useState<GeocodedExhibitor[]>([]);
  const [isGeocoding, setIsGeocoding] = useState(false);

  useEffect(() => {
    const geocodeExhibitors = async () => {
      setIsGeocoding(true);
      const results: GeocodedExhibitor[] = [];

      // Limit to avoid hitting Nominatim rate limits too hard
      // In a real app, you might want to cache these in Firestore
      for (const ex of exhibitors) {
        if (!ex.city) continue;

        try {
          const query = `${ex.address ? ex.address + ', ' : ''}${ex.city}, ${ex.postalCode || ''}, France`;
          const response = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`,
            {
              headers: {
                'User-Agent': 'MarcheConnect-Admin-Tool'
              }
            }
          );
          const data = await response.json();

          if (data && data.length > 0) {
            results.push({
              exhibitor: ex,
              lat: parseFloat(data[0].lat),
              lon: parseFloat(data[0].lon)
            });
          }
          
          // Small delay to respect Nominatim's policy (1 request/sec)
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          console.error(`Error geocoding ${ex.companyName}:`, error);
        }
      }

      setGeocodedData(results);
      setIsGeocoding(false);
    };

    if (exhibitors.length > 0) {
      geocodeExhibitors();
    }
  }, [exhibitors]);

  return (
    <div className="relative w-full h-[600px] border rounded-2xl overflow-hidden bg-muted/20">
      {isGeocoding && (
        <div className="absolute inset-0 z-[1000] bg-white/60 backdrop-blur-sm flex items-center justify-center flex-col gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm font-bold text-primary">Géolocalisation des artisans en cours...</p>
          <p className="text-[10px] text-muted-foreground">Cela peut prendre quelques secondes (limite de 1/sec)</p>
        </div>
      )}

      <MapContainer center={DEFAULT_CENTER} zoom={8} scrollWheelZoom={true}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {geocodedData.map((item) => (
          <Marker key={item.exhibitor.id} position={[item.lat, item.lon]}>
            <Popup>
              <div className="p-1 space-y-2 min-w-[200px]">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary" />
                  <span className="font-bold text-primary">{item.exhibitor.companyName}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {item.exhibitor.firstName} {item.exhibitor.lastName}
                </div>
                <div className="text-xs font-semibold">
                  {item.exhibitor.city} ({item.exhibitor.postalCode})
                </div>
                <div className="flex justify-between items-center pt-2">
                  <Badge variant={getStatusVariant(item.exhibitor.status)} className="text-[10px]">
                    {getStatusLabel(item.exhibitor.status)}
                  </Badge>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-7 text-[10px] gap-1 px-2"
                    onClick={() => onViewExhibitor(item.exhibitor)}
                  >
                    <Eye className="w-3 h-3" /> Fiche
                  </Button>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
