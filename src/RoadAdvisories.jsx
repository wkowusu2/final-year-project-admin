import { useEffect, useState } from 'react';

import AdvisoryRoadPicker from './AdvisoryRoadPicker';

const types = ['maintenance', 'road_closure', 'diversion', 'signal_work', 'event_restriction'];
const blank = () => ({ title: '', description: '', type: 'maintenance', status: 'planned', impact: 'moderate', affectedRoadOsmId: '', roadName: '', city: 'Kumasi', startsAt: '', endsAt: '' });
const display = (value) => value.replaceAll('_', ' ');
const localDate = (date = new Date()) => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

function AdvisoryConfirmModal({ advisory, editing, saving, onCancel, onConfirm }) {
  if (!advisory) return null;
  return <div className="modal-backdrop" role="presentation">
    <section className="status-modal" role="dialog" aria-modal="true" aria-labelledby="advisory-confirm-title">
      <button className="modal-close" type="button" onClick={onCancel} disabled={saving} aria-label="Close confirmation">×</button>
      <p className="eyebrow">CONFIRM ROAD ADVISORY</p>
      <h2 id="advisory-confirm-title">{editing ? 'Save these changes?' : 'Publish this road advisory?'}</h2>
      <div className="modal-incident">
        <strong>{advisory.title}</strong>
        <span>{advisory.roadName}, {advisory.city}</span>
        <small>OSM {advisory.affectedRoadOsmId} · {display(advisory.type)} · {advisory.impact} impact</small>
      </div>
      <p className="confirm-copy">{editing ? 'This updates the notice shown to drivers and used by route intelligence.' : 'This publishes the notice for drivers and route intelligence on the selected road.'}</p>
      <div className="modal-actions">
        <button className="secondary-action" type="button" onClick={onCancel} disabled={saving}>Cancel</button>
        <button className="primary-action" type="button" onClick={onConfirm} disabled={saving}>{saving ? 'Saving…' : editing ? 'Yes, save changes' : 'Yes, publish advisory'}</button>
      </div>
    </section>
  </div>;
}

export default function RoadAdvisories({ request, onMessage }) {
  const [advisories, setAdvisories] = useState([]);
  const [form, setForm] = useState(() => ({ ...blank(), startsAt: localDate() }));
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const response = await request('/admin/road-advisories');
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.error || 'Unable to load road advisories');
      setAdvisories(body.data.advisories);
    } catch (error) {
      onMessage(`Could not load road advisories: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const change = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  const startNew = () => { setEditing(null); setConfirming(false); setForm({ ...blank(), startsAt: localDate() }); };
  const edit = (advisory) => {
    setEditing(advisory);
    setConfirming(false);
    setForm({ ...advisory, affectedRoadOsmId: advisory.affectedRoadOsmId || '', startsAt: localDate(new Date(advisory.startsAt)), endsAt: advisory.endsAt ? localDate(new Date(advisory.endsAt)) : '' });
  };
  const selectRoad = (road) => setForm((current) => road ? { ...current, affectedRoadOsmId: road.id, roadName: road.name } : { ...current, affectedRoadOsmId: '', roadName: '' });

  const requestConfirmation = (event) => {
    event.preventDefault();
    if (!form.affectedRoadOsmId) {
      onMessage('Select the affected road on the map before publishing this advisory.');
      return;
    }
    setConfirming(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = { ...form, startsAt: new Date(form.startsAt).toISOString(), endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null };
      const response = await request(editing ? `/admin/road-advisories/${editing.id}` : '/admin/road-advisories', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.error || 'Unable to save advisory');
      const saved = body.data.advisory;
      setAdvisories((current) => editing ? current.map((item) => item.id === saved.id ? saved : item) : [saved, ...current]);
      onMessage(editing ? 'Road advisory updated.' : 'Road advisory published.');
      startNew();
    } catch (error) {
      onMessage(`Could not save advisory: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  return <section className="advisory-layout">
    <article className="panel advisory-form-panel">
      <div className="panel-heading"><div><p className="eyebrow">GOVERNMENT OPERATIONS</p><h2>{editing ? 'Edit road advisory' : 'Publish a road advisory'}</h2><p className="page-copy">Select the exact mapped road. Its OSM ID is stored automatically and drives route warnings.</p></div>{editing && <button className="text-action" type="button" onClick={startNew}>Create new →</button>}</div>
      <form className="advisory-form" onSubmit={requestConfirmation}>
        <label>Title<input required name="title" value={form.title} onChange={change} placeholder="e.g. Asafo Road resurfacing" /></label>
        <label>Advisory type<select name="type" value={form.type} onChange={change}>{types.map((type) => <option key={type} value={type}>{display(type)}</option>)}</select></label>
        <label className="form-wide">What should drivers know?<textarea required name="description" value={form.description} onChange={change} rows="3" placeholder="Describe the works, closure or diversion." /></label>
        <AdvisoryRoadPicker selectedRoadId={form.affectedRoadOsmId} onSelect={selectRoad}/>
        <label>Road name<input required readOnly name="roadName" value={form.roadName} placeholder="Select a road on the map" /></label>
        <label>City<input required name="city" value={form.city} onChange={change} /></label>
        <label>Status<select name="status" value={form.status} onChange={change}><option value="planned">Planned</option><option value="active">Active</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></label>
        <label>Impact<select name="impact" value={form.impact} onChange={change}><option value="low">Low</option><option value="moderate">Moderate</option><option value="high">High</option></select></label>
        <label>Starts at<input required type="datetime-local" name="startsAt" value={form.startsAt} onChange={change} /></label>
        <label>Ends at <small>(optional)</small><input type="datetime-local" name="endsAt" value={form.endsAt} onChange={change} /></label>
        <button className="advisory-submit" disabled={saving}>{editing ? 'Save changes' : 'Publish advisory'}</button>
      </form>
    </article>
    <article className="panel advisory-list-panel"><div className="panel-heading"><div><p className="eyebrow">PUBLISHED NOTICES</p><h2>Road works & advisories</h2><p className="page-copy">Active notices are shown to drivers; selected OSM roads influence route ETAs.</p></div><button className="text-action" type="button" onClick={() => void load()}>Refresh →</button></div>{loading ? <p className="page-copy">Loading notices…</p> : <div className="advisory-list">{advisories.length ? advisories.map((advisory) => <button className="advisory-row" type="button" key={advisory.id} onClick={() => edit(advisory)}><div><strong>{advisory.title}</strong><span>{advisory.roadName}, {advisory.city}</span><small>{new Date(advisory.startsAt).toLocaleString()} · OSM {advisory.affectedRoadOsmId}</small></div><div><span className={`badge status-${advisory.status}`}>{advisory.status}</span><span className={`badge impact-${advisory.impact}`}>{advisory.impact}</span></div></button>) : <p className="page-copy">No road advisories have been published yet.</p>}</div>}</article>
    <AdvisoryConfirmModal advisory={confirming ? form : null} editing={Boolean(editing)} saving={saving} onCancel={() => setConfirming(false)} onConfirm={() => void save()} />
  </section>;
}
