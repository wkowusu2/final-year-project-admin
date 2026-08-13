import { useCallback, useEffect, useMemo, useState } from 'react';
import { MapContainer, Polyline, TileLayer, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import './traffic-map.css';

const initialCenter = [6.6885, -1.6244];
const colorForLevel = { free: '#22a06b', moderate: '#e99a20', heavy: '#ea7f2f', severe: '#e5484d', unknown: '#98a6b5' };

function boundsForLeaflet(bounds) {
  return { west: bounds.getWest(), south: bounds.getSouth(), east: bounds.getEast(), north: bounds.getNorth() };
}

function ViewportListener({ onBoundsChange }) {
  const map = useMapEvents({ moveend: () => onBoundsChange(boundsForLeaflet(map.getBounds())) });
  useEffect(() => { onBoundsChange(boundsForLeaflet(map.getBounds())); }, [map, onBoundsChange]);
  return null;
}

const API_ROOT = 'http://localhost:3000/api/v1';
const SESSION_KEY = 'roadpulse.admin.session';

async function trafficRequest(url) {
  const saved = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
  if (!saved?.accessToken) throw new Error('Administrator session expired. Please sign in again.');
  const request = (token) => fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  let response = await request(saved.accessToken);
  if (response.status !== 401) return response;
  const refreshResponse = await fetch(`${API_ROOT}/auth/admin/refresh`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken: saved.refreshToken, adminId: saved.admin.id }) });
  const refreshBody = await refreshResponse.json();
  if (!refreshResponse.ok || !refreshBody.success) throw new Error('Administrator session expired. Please sign in again.');
  const refreshed = { ...saved, accessToken: refreshBody.data.access_token, refreshToken: refreshBody.data.refresh_token };
  localStorage.setItem(SESSION_KEY, JSON.stringify(refreshed));
  response = await request(refreshed.accessToken);
  return response;
}

export default function TrafficMap() {
  const [roads, setRoads] = useState([]);
  const [traffic, setTraffic] = useState([]);
  const [message, setMessage] = useState('Loading live road conditions…');
  const [loading, setLoading] = useState(false);

  const trafficByRoad = useMemo(() => new Map(traffic.map((road) => [road.osmId, road])), [traffic]);
  const update = useCallback(async (bounds) => {
    setLoading(true);
    try {
      const query = new URLSearchParams(Object.entries(bounds).map(([key, value]) => [key, String(value)]));
      const [roadsResponse, trafficResponse] = await Promise.all([
        fetch(`${API_ROOT}/map/roads?${query}`),
        trafficRequest(`${API_ROOT}/map/traffic?${query}`),
      ]);
      const roadsBody = await roadsResponse.json();
      const trafficBody = await trafficResponse.json();
      if (!roadsResponse.ok || !roadsBody.success || !roadsBody.data) throw new Error(roadsBody.error || 'Unable to load nearby roads.');
      if (!trafficResponse.ok || !trafficBody.success || !trafficBody.data) throw new Error(trafficBody.error || 'Unable to load live traffic.');
      setRoads(roadsBody.data.features);
      setTraffic(trafficBody.data.roads);
      setMessage(trafficBody.data.roads.length ? `${trafficBody.data.roads.length} roads have recent traffic evidence.` : 'No nearby roads have enough recent speed samples yet.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to load live road conditions.');
    } finally { setLoading(false); }
  }, []);

  return <div className="live-map-wrap">
    <MapContainer center={initialCenter} zoom={13} className="live-map" scrollWheelZoom>
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>' url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
      <ViewportListener onBoundsChange={update} />
      {roads.map((road) => {
        const coordinates = road.geometry?.coordinates?.map(([longitude, latitude]) => [latitude, longitude]) ?? [];
        if (coordinates.length < 2) return null;
        const condition = trafficByRoad.get(road.id);
        const level = condition?.trafficLevel ?? 'unknown';
        const title = `${road.properties.name ?? road.properties.ref ?? `OSM road ${road.id}`} · ${condition?.medianSpeedKph == null ? 'No live sample' : `${Math.round(condition.medianSpeedKph)} km/h`}`;
        return <Polyline key={road.id} positions={coordinates} pathOptions={{ color: colorForLevel[level], weight: level === 'unknown' ? 3 : 5, opacity: level === 'unknown' ? 0.55 : 0.9 }} />;
      })}
    </MapContainer>
    <div className="live-map-footer"><span className={loading ? 'map-spinner' : 'map-dot'} />{message}</div>
    <div className="live-map-legend"><span><i className="free" />Free</span><span><i className="moderate" />Moderate</span><span><i className="heavy" />Heavy</span><span><i className="severe" />Severe</span><span><i className="unknown" />No data</span></div>
  </div>;
}
