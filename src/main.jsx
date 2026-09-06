import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import './login.css';
import './pages.css';
import './modal.css';
import TrafficMap from './TrafficMap';
import RoadAdvisories from './RoadAdvisories';
import TrafficSimulation from './TrafficSimulation';

const ROOT = 'http://localhost:3000/api/v1';
const STORAGE_KEY = 'roadpulse.admin.session';
let refreshPromise = null;
const format = new Intl.NumberFormat('en-GH');
const saveSession = (session) => localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
const loadSession = () => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch { return null; } };
const level = (speed) => speed == null ? ['No speed', 'moderate'] : speed < 12 ? ['Severe', 'severe'] : speed < 25 ? ['Heavy', 'heavy'] : speed < 40 ? ['Moderate', 'moderate'] : ['Free', 'free'];
const relativeTime = (iso) => { const minutes = Math.max(0, Math.round((Date.now() - new Date(iso)) / 60000)); return minutes < 1 ? 'Just now' : minutes < 60 ? `${minutes} min ago` : `${Math.round(minutes / 60)} hr ago`; };

async function refreshSession(session) {
  if (!refreshPromise) refreshPromise = fetch(`${ROOT}/auth/admin/refresh`, { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken: session.refreshToken, adminId: session.admin.id }) }).then(async (response) => {
    const body = await response.json();
    if (!response.ok || !body.success) throw new Error(body.error || 'Session expired');
    if (typeof body.data?.access_token !== 'string' || typeof body.data?.refresh_token !== 'string' || body.data.access_token === session.accessToken) {
      throw new Error('Session refresh did not issue a new access token. Please sign in again.');
    }
    const next = { ...session, accessToken: body.data.access_token, refreshToken: body.data.refresh_token };
    saveSession(next); return next;
  }).finally(() => { refreshPromise = null; });
  return refreshPromise;
}

async function adminRequest(url, session, updateSession, options = {}) {
  const request = (token) => fetch(url, { ...options, headers: { ...(options.headers || {}), Authorization: `Bearer ${token}` } });
  // A dashboard request may still hold an old React prop while another request
  // has already refreshed the session. Always start with localStorage's newest
  // token, then retry exactly once with the newly issued token.
  const stored = loadSession();
  const current = stored?.admin?.id === session.admin.id ? stored : session;
  let response = await request(current.accessToken);
  if (response.status !== 401) return response;

  const latest = loadSession();
  if (latest?.admin?.id === current.admin.id && latest.accessToken !== current.accessToken) {
    return request(latest.accessToken);
  }

  const next = await refreshSession(current);
  updateSession(next);
  return request(next.accessToken);
}

function Login({ onLogin }) {
  const [email, setEmail] = useState('admin@roadplus.com');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  async function submit(event) {
    event.preventDefault(); setLoading(true); setError('');
    try {
      const response = await fetch(`${ROOT}/auth/admin/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.error || 'Unable to sign in');
      const session = { accessToken: body.data.access_token, refreshToken: body.data.refresh_token, admin: body.data.admin };
      saveSession(session); onLogin(session);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to sign in'); } finally { setLoading(false); }
  }
  return <main className="login-page"><section className="login-hero"><a className="brand" href="#top"><span className="brand-mark">RP</span><span><strong>RoadPulse</strong><small>COMMAND</small></span></a><div><p className="eyebrow">GHANA MOBILITY OPERATIONS</p><h1>Turn movement data into better roads.</h1><p>Review live road conditions, driver coverage, and community incident signals in one secure workspace.</p></div><div className="login-signal"><span className="pulse"/>Secure administrator access</div></section><section className="login-card-wrap"><form className="login-card" onSubmit={submit}><p className="eyebrow">ADMINISTRATOR SIGN IN</p><h2>Welcome back</h2><p className="login-subtitle">Sign in to RoadPulse Command.</p><label>Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label><label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>{error && <p className="login-error">{error}</p>}<button type="submit" disabled={loading}>{loading ? 'Signing in…' : 'Sign in to command'}</button><p className="login-footnote">Protected operations workspace · Session refresh is handled automatically.</p></form></section></main>;
}

function SidebarIcon({ name }) {
  if (name === 'incident') return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 2.9 19a2 2 0 0 0 1.74 3h14.72A2 2 0 0 0 21.1 19L12 3Z"/><path d="M12 9v5"/><path d="M12 17.5h.01"/></svg>;
  if (name === 'roadworks') return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h16"/><path d="m7 20 2-8h6l2 8"/><path d="M8 8h8"/><path d="M10 8V5h4v3"/><path d="M11 15h2"/></svg>;
  return <span aria-hidden="true">{name === 'overview' ? '◉' : '⌁'}</span>;
}

function Sidebar({ active, setActive }) { const items = [['overview', 'overview', 'Network overview'], ['traffic', 'traffic', 'Traffic intelligence'], ['reports', 'incident', 'Incident reports'], ['advisories', 'roadworks', 'Road works']]; return <aside className="sidebar"><a className="brand" href="#top"><span className="brand-mark">RP</span><span><strong>RoadPulse</strong><small>COMMAND</small></span></a><nav className="nav-links">{items.map(([id, icon, label]) => <button key={id} className={active === id ? 'active' : ''} onClick={() => setActive(id)}><span className="nav-icon"><SidebarIcon name={icon}/></span>{label}</button>)}</nav><div className="sidebar-note"><span className="pulse"/><div><strong>Live operations</strong><small>Updates from matched driver GPS points</small></div></div></aside>; }
function Metric({ icon, tone, label, value, detail }) { return <article><span className={`metric-icon ${tone}`}>{icon}</span><div><p>{label}</p><strong>{format.format(value)}</strong><small>{detail}</small></div></article>; }
function RoadRow({ road }) { const [label, tone] = level(road.medianSpeedKph); return <div className="road-row"><div><div className="road-name">{road.roadName}</div><div className="road-meta">{road.driverCount} drivers · {road.sampleCount} matched points · OSM {road.osmId}</div></div><div className="road-speed">{road.medianSpeedKph == null ? '—' : `${Math.round(road.medianSpeedKph)} km/h`}<small>median</small></div><span className={`traffic-tag traffic-${tone}`}>{label}</span></div>; }
function RoadMap() { return <div className="road-map"><div className="map-grid"/><span className="map-label label-a">Kumasi</span><span className="map-label label-b">Accra</span><span className="road-line line-a"/><span className="road-line line-b"/><span className="road-line line-c"/><span className="road-line line-d"/><span className="map-dot dot-a"/><span className="map-dot dot-b"/></div>; }
function ReportsTable({ incidents, onSelect }) { return <div className="table-wrap"><table><thead><tr><th>Incident</th><th>Location</th><th>Severity</th><th>Community confirmation</th><th>Reported</th><th>Status</th></tr></thead><tbody>{incidents.length ? incidents.map((incident) => <tr key={incident.id} className="report-row" tabIndex="0" onClick={() => onSelect(incident)} onKeyDown={(event) => { if (event.key === 'Enter') onSelect(incident); }}><td><div className="incident-main">{incident.type}</div><div className="incident-sub">Reported by {incident.reporterName}</div></td><td>{incident.roadName}<div className="incident-sub">{incident.city}</div></td><td><span className={`badge severity-${incident.severity}`}>{incident.severity}</span></td><td>{incident.confirmationCount} confirmations</td><td>{relativeTime(incident.createdAt)}</td><td><span className={`badge status-${incident.status}`}>{incident.status}</span></td></tr>) : <tr><td colSpan="6">No incident reports found.</td></tr>}</tbody></table></div>; }
function Overview({ data, goTo }) { return <><section className="metrics"><Metric icon="⌁" tone="blue" label="Active drivers" value={data.metrics.activeDrivers} detail="currently sending trips"/><Metric icon="◌" tone="teal" label="Matched points" value={data.metrics.matchedPointCount} detail={`in the last ${data.trafficWindowMinutes} min`}/><Metric icon="▤" tone="violet" label="Roads observed" value={data.metrics.monitoredRoadCount} detail="with traffic samples"/><Metric icon="△" tone="amber" label="Pending reports" value={data.metrics.pendingIncidentCount} detail="require attention"/></section><section className="grid"><article className="panel"><div className="panel-heading"><div><p className="eyebrow">SNAPSHOT</p><h2>Road conditions requiring attention</h2></div><button className="text-action" onClick={() => goTo('traffic')}>Open traffic →</button></div><div className="road-list">{data.trafficRoads.slice(0, 3).map((road) => <RoadRow key={road.osmId} road={road}/>)}</div></article><article className="panel"><div className="panel-heading"><div><p className="eyebrow">SNAPSHOT</p><h2>Newest community signals</h2></div><button className="text-action" onClick={() => goTo('reports')}>Open reports →</button></div><div className="snapshot-incidents">{data.incidents.slice(0, 3).map((incident) => <div key={incident.id}><strong>{incident.type}</strong><span>{incident.roadName}, {incident.city}</span><small>{relativeTime(incident.createdAt)} · {incident.confirmationCount} confirmations</small></div>)}</div></article></section></>; }
function Traffic({ data }) { return <section className="panel page-panel"><div className="panel-heading"><div><p className="eyebrow">LIVE ROAD CONDITIONS</p><h2>Traffic intelligence</h2><p className="page-copy">Drag the map to inspect live map-matched road conditions. The ranking below uses the selected dashboard time window.</p></div><span className="legend"><i className="green"/> Free <i className="orange"/> Heavy <i className="red"/> Severe</span></div><TrafficMap/><div className="road-list">{data.trafficRoads.map((road) => <RoadRow key={road.osmId} road={road}/>)}</div></section>; }
function Reports({ data, onSelect }) { return <section className="panel page-panel"><div className="panel-heading"><div><p className="eyebrow">COMMUNITY SIGNALS</p><h2>Incident reports</h2><p className="page-copy">Select a report to verify it or mark it resolved.</p></div><span className="table-caption">Newest reports first</span></div><ReportsTable incidents={data.incidents} onSelect={onSelect}/></section>; }
function StatusModal({ incident, status, setStatus, onClose, onConfirm, saving }) { if (!incident) return null; const title = status ? `Mark this report as ${status}?` : 'Update incident status'; return <div className="modal-backdrop" role="presentation"><section className="status-modal" role="dialog" aria-modal="true" aria-labelledby="status-title"><button className="modal-close" onClick={onClose} aria-label="Close">×</button><p className="eyebrow">INCIDENT REVIEW</p><h2 id="status-title">{title}</h2><div className="modal-incident"><strong>{incident.type}</strong><span>{incident.roadName}, {incident.city}</span><small>Current status: {incident.status}</small></div>{!status ? <div className="status-choices"><button className="verify-choice" onClick={() => setStatus('verified')}>Mark verified</button><button className="resolve-choice" onClick={() => setStatus('resolved')}>Mark resolved</button></div> : <><p className="confirm-copy">This will update the report for all administrators and drivers. Do you want to continue?</p><div className="modal-actions"><button className="secondary-action" onClick={() => setStatus(null)} disabled={saving}>Back</button><button className="primary-action" onClick={onConfirm} disabled={saving}>{saving ? 'Updating…' : 'Yes, update report'}</button></div></>}</section></div>; }

function Dashboard({ session, onSession, onLogout }) {
  const [data, setData] = useState(null); const [active, setActive] = useState('overview'); const [windowMinutes, setWindowMinutes] = useState('30'); const [message, setMessage] = useState('Loading live operations data…'); const [loading, setLoading] = useState(true); const [selectedIncident, setSelectedIncident] = useState(null); const [proposedStatus, setProposedStatus] = useState(null); const [updatingStatus, setUpdatingStatus] = useState(false);
  async function loadLiveData() {
    setLoading(true);
    try { const url = new URL(`${ROOT}/admin/dashboard`); url.searchParams.set('windowMinutes', windowMinutes); const response = await adminRequest(url.toString(), session, onSession); const body = await response.json(); if (!response.ok || !body.success) throw new Error(body.error || 'The dashboard request failed'); setData(body.data); setMessage(`Live data updated at ${new Date(body.data.generatedAt).toLocaleTimeString()}.`); } catch (caught) { const error = caught instanceof Error ? caught.message : 'Unknown error'; setMessage(`Could not load live data: ${error}`); if (error === 'Session expired') onLogout(); } finally { setLoading(false); }
  }
  useEffect(() => { void loadLiveData(); }, []);
  async function updateIncidentStatus() {
    if (!selectedIncident || !proposedStatus) return;
    setUpdatingStatus(true);
    try { const response = await adminRequest(`${ROOT}/admin/incidents/${selectedIncident.id}/status`, session, onSession, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: proposedStatus }) }); const body = await response.json(); if (!response.ok || !body.success) throw new Error(body.error || 'Unable to update incident'); setData((current) => ({ ...current, incidents: current.incidents.map((incident) => incident.id === selectedIncident.id ? { ...incident, status: body.data.incident.status } : incident) })); setMessage(`Report marked ${proposedStatus}.`); setSelectedIncident(null); setProposedStatus(null); } catch (caught) { setMessage(`Could not update report: ${caught instanceof Error ? caught.message : 'Unknown error'}`); } finally { setUpdatingStatus(false); }
  }
  const titles = { overview: ['Network overview', 'A concise snapshot of current network activity.'], traffic: ['Traffic intelligence', 'Road-by-road conditions derived from matched driver movement.'], reports: ['Incident reports', 'Community reports requiring operational review.'], advisories: ['Road works & advisories', 'Publish government notices for drivers and route intelligence.'] };
  const advisoryRequest = (path, options) => adminRequest(`${ROOT}${path}`, session, onSession, options);
  return <div className="app-shell"><Sidebar active={active} setActive={setActive}/><main id="top"><header className="topbar"><div><p className="eyebrow">GHANA MOBILITY OPERATIONS</p><h1>{titles[active][0]}</h1><p className="page-subtitle">{titles[active][1]}</p></div><div className="header-actions"><span className="live-status"><span className="pulse"/>{data ? 'Live data connected' : 'Connecting…'}</span><button className="signout" onClick={onLogout}>Sign out</button></div></header>{active === 'traffic' && <TrafficSimulation request={advisoryRequest} onMessage={setMessage}/>}{active !== 'advisories' && <><section className="connection-panel"><div className="connection-copy"><strong>{session.admin.email}</strong><span>Administrator session</span></div><label>Traffic window<select value={windowMinutes} onChange={(event) => setWindowMinutes(event.target.value)}><option value="15">Last 15 minutes</option><option value="30">Last 30 minutes</option><option value="60">Last hour</option><option value="1440">Last 24 hours</option></select></label><button type="button" onClick={loadLiveData} disabled={loading}>{loading ? 'Loading…' : 'Refresh live data'}</button></section><p className="connection-message">{message}</p></>}{active === 'advisories' ? <RoadAdvisories request={advisoryRequest} onMessage={setMessage}/> : data ? <>{active === 'overview' && <Overview data={data} goTo={setActive}/>} {active === 'traffic' && <Traffic data={data}/>} {active === 'reports' && <Reports data={data} onSelect={(incident) => { setSelectedIncident(incident); setProposedStatus(null); }}/>}</> : <section className="loading-panel"><span className="spinner"/><h2>Connecting to RoadPulse operations</h2><p>Fetching the latest traffic and incident data for this administrator session.</p></section>}<StatusModal incident={selectedIncident} status={proposedStatus} setStatus={setProposedStatus} onClose={() => { setSelectedIncident(null); setProposedStatus(null); }} onConfirm={updateIncidentStatus} saving={updatingStatus}/></main></div>;
}
function Root() { const [session, setSession] = useState(loadSession); const logout = () => { localStorage.removeItem(STORAGE_KEY); setSession(null); }; return session ? <Dashboard session={session} onSession={setSession} onLogout={logout}/> : <Login onLogin={setSession}/>; }
createRoot(document.getElementById('root')).render(<Root/>);
