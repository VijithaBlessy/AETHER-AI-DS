const EVENT_KEY = 'jacsi-events';

export function cleanEvents(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  return value.map((event) => ({ ...event, date: event.date || event.start_date || '', type: event.type || event.event_type || '', place: event.place || event.venue || '', cell: event.cell || event.organizing_cell || '', detail: event.detail || event.description || '' })).filter((event) => {
    // Remove the three hard-coded sample records from earlier versions of the site.
    if (['e1', 'e2', 'e3'].includes(String(event.id))) return false;
    const identity = `${String(event.title || '').trim().toLowerCase()}|${event.date || ''}`;
    if (!event.id || !event.title || !event.date || seen.has(identity)) return false;
    seen.add(identity); return true;
  }).sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

export function readLocalEvents() {
  try { return cleanEvents(JSON.parse(localStorage.getItem(EVENT_KEY) || '[]')); }
  catch { return []; }
}

export function publishLocalContent(key, value) {
  const map = { events: EVENT_KEY, projects: 'jacsi-projects', announcement: 'jacsi-notice' };
  const storageKey = map[key]; if (!storageKey) return;
  if (key === 'events') value = cleanEvents(value);
  localStorage.setItem(storageKey, key === 'announcement' ? String(value || '') : JSON.stringify(value || []));
  window.dispatchEvent(new CustomEvent('aether-content-change', { detail: { key, value } }));
}
