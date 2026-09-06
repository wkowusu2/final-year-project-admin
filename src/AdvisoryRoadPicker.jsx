import { useCallback, useEffect, useRef, useState } from 'react';
import { MapContainer, Polyline, TileLayer, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import './advisory-road-picker.css';

const API_ROOT = 'http://localhost:3000/api/v1';
const initialCenter = [6.6885, -1.6244];
const CARTO_BASEMAP_KEY = import.meta.env.VITE_CARTO_BASEMAP_KEY;
const CARTO_LIGHT_TILES = `https://{s}.basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}{r}.png?key=${CARTO_BASEMAP_KEY}`;

function boundsForLeaflet(bounds) {
  return { west: bounds.getWest(), south: bounds.getSouth(), east: bounds.getEast(), north: bounds.getNorth() };
}

function ViewportListener({ onBoundsChange }) {
  const map = useMapEvents({ moveend: () => onBoundsChange(boundsForLeaflet(map.getBounds())) });
  useEffect(() => { onBoundsChange(boundsForLeaflet(map.getBounds())); }, [map, onBoundsChange]);
  return null;
}

function roadLabel(road) {
  return road.properties.name || road.properties.ref || `OSM road ${road.id}`;
}

export default function AdvisoryRoadPicker({ selectedRoadId, onSelect }) {
  const [roads, setRoads] = useState([]);
  const [message, setMessage] = useState('Move the map, then select the affected road.');
  const controller = useRef(null);

  const loadRoads = useCallback(async (bounds) => {
    controller.current?.abort();
    const nextController = new AbortController();
    controller.current = nextController;
    try {
      const query = new URLSearchParams(Object.entries(bounds).map(([key, value]) => [key, String(value)]));
      const response = await fetch(`${API_ROOT}/map/roads?${query}`, { signal: nextController.signal });
      const body = await response.json();
      if (!response.ok || !body.success || !body.data) throw new Error(body.error || 'Unable to load roads in this area.');
      setRoads(body.data.features);
      setMessage(body.data.features.length ? 'Click a road line to select it for this advisory.' : 'No mapped drivable roads were found in this area.');
    } catch (error) {
      if (nextController.signal.aborted) return;
      setMessage(error instanceof Error ? error.message : 'Unable to load roads in this area.');
    }
  }, []);

  useEffect(() => () => controller.current?.abort(), []);

  return <div className="advisory-road-picker">
    <div className="advisory-road-picker-heading"><strong>Select the affected road</strong><span>{message}</span></div>
    <MapContainer center={initialCenter} zoom={13} minZoom={12} className="advisory-road-map" scrollWheelZoom>
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>' url={CARTO_LIGHT_TILES} />
      <ViewportListener onBoundsChange={loadRoads} />
      {roads.map((road) => {
        const positions = road.geometry?.coordinates?.map(([longitude, latitude]) => [latitude, longitude]) ?? [];
        if (positions.length < 2) return null;
        const selected = road.id === selectedRoadId;
        return <Polyline key={road.id} positions={positions} pathOptions={{ color: selected ? '#1768ee' : '#6f8298', weight: selected ? 7 : 4, opacity: selected ? 1 : 0.72 }} eventHandlers={{ click: () => onSelect({ id: road.id, name: roadLabel(road) }) }} />;
      })}
    </MapContainer>
    {selectedRoadId ? <div className="selected-road"><span>Selected road</span><strong>OSM {selectedRoadId}</strong><button type="button" onClick={() => onSelect(null)}>Clear</button></div> : null}
  </div>;
}
