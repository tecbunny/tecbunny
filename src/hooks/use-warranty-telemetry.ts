import { useState, useEffect } from "react";

export interface TelemetryEvent {
  id: string;
  region: string;
  timestamp: number;
}

const REGIONS = ["North Goa Sector", "Panjim District", "Mapusa Hub", "South Goa Network"];

export function useWarrantyTelemetry() {
  const [activeEvent, setActiveEvent] = useState<TelemetryEvent | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveEvent({
        id: Math.random().toString(36).substring(7),
        region: REGIONS[Math.floor(Math.random() * REGIONS.length)],
        timestamp: Date.now()
      });
    }, 12000);

    return () => clearInterval(interval);
  }, []);

  return { activeEvent };
}