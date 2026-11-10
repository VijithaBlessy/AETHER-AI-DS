import { hasSupabaseConfig, supabase } from './supabase.js';
import { cleanEvents, readLocalEvents, publishLocalContent } from './localContent.js';

// Browser-local CRUD adapter. Passwords and authentication sessions are never stored here.
const KEY = 'aether-management-data-v2';
const LEGACY_KEY = 'aether-admin-content-v1';
export const TABLES = {
  events: 'events', projects: 'projects', announcements: 'announcements', achievements: 'achievements',
  gallery: 'gallery', activities: 'cell_activities', students: 'students', faculty: 'faculty', subjects: 'subjects',
  internal_marks: 'internal_marks', semester_results: 'semester_results', attendance: 'attendance', timetable: 'timetable', cells: 'department_cells', final_year_projects: 'final_year_projects',
};
const fresh = () => Object.fromEntries(Object.keys(TABLES).map((key) => [key, []]));
function read() {
  try {
    const current = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (current) {
      const normalized = { ...fresh(), ...current, events: cleanEvents(current.events) };
      if (normalized.events.length !== (current.events || []).length) localStorage.setItem(KEY, JSON.stringify(normalized));
      return normalized;
    }
    const old = JSON.parse(localStorage.getItem(LEGACY_KEY) || '{}');
    const migrated = { ...fresh(), ...old, events: cleanEvents(old.events ?? readLocalEvents()) };
    // Bring old site records into the canonical store once.
    for (const key of ['projects']) if (!migrated[key]?.length) migrated[key] = JSON.parse(localStorage.getItem(`jacsi-${key}`) || '[]');
    localStorage.setItem(KEY, JSON.stringify(migrated));
    return migrated;
  } catch { return fresh(); }
}
function emit(key, data) {
  window.dispatchEvent(new CustomEvent('aether-data-change', { detail: { key, data } }));
  window.dispatchEvent(new CustomEvent('aether-content-change', { detail: { key: key === 'announcements' ? 'announcement' : key, value: key === 'announcements' ? (data.find((x) => x.published)?.body || '') : data } }));
  if (key === 'events') publishLocalContent('events', data);
  if (key === 'projects') publishLocalContent('projects', data);
  if (key === 'announcements') publishLocalContent('announcement', data.find((x) => x.published)?.body || '');
}
export const dataMode = () => hasSupabaseConfig ? 'supabase' : 'local';
export async function listRecords(key) {
  if (!TABLES[key]) return read()[key] || [];
  if (hasSupabaseConfig) {
    let query = supabase.from(TABLES[key]).select('*').order('created_at', { ascending: false }).limit(1000);
    if (key === 'events' || key === 'activities') query = query.eq('published', true);
    const { data, error } = await query;
    if (error) throw error;
    return key === 'events' ? cleanEvents(data || []) : data || [];
  }
  const all = read();
  return key === 'events' ? cleanEvents(all.events).filter((event) => event.published === true) : key === 'activities' ? (all.activities||[]).filter((activity)=>activity.published===true) : all[key] || [];
}
export async function listFacultyEvents() {
  if (hasSupabaseConfig) {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!user) return [];
    const { data, error } = await supabase.from('events').select('*').or(`published.eq.true,created_by.eq.${user.id}`).order('created_at', { ascending: false }).limit(1000);
    if (error) throw error;
    return cleanEvents(data || []);
  }
  return cleanEvents(read().events || []);
}
export async function listManagedRecords(key) {
  if (!TABLES[key] || !hasSupabaseConfig) return read()[key] || [];
  const { data, error } = await supabase.from(TABLES[key]).select('*').order('created_at', { ascending: false }).limit(1000);
  if (error) throw error;
  return key === 'events' ? cleanEvents(data || []) : data || [];
}
export async function saveRecord(key, item, id) {
  if (TABLES[key] && hasSupabaseConfig) {
    const payload = { ...item };
    if (key === 'events') {
      // Retain compatibility with the existing schema columns while also supporting the expanded event form.
      Object.assign(payload, { type: item.event_type || item.type, date: item.start_date || item.date, place: item.venue || item.place, cell: item.organizing_cell || item.cell, detail: item.description || item.detail });
    }
    const query = id ? supabase.from(TABLES[key]).update(payload).eq('id', id).select().single() : supabase.from(TABLES[key]).insert(payload).select().single();
    const { data, error } = await query;
    if (error) throw error;
    return data;
  }
  const all = read(); const rows = all[key] || [];
  if (key === 'events') {
    const dupe = rows.some((row) => row.id !== id && row.title?.trim().toLowerCase() === item.title?.trim().toLowerCase() && (row.start_date || row.date) === (item.start_date || item.date));
    if (dupe) throw new Error('An event with this title and start date already exists.');
  }
  const saved = { ...item, id: id || `local-${crypto.randomUUID()}`, created_at: id ? rows.find((r) => r.id === id)?.created_at : new Date().toISOString() };
  all[key] = id ? rows.map((row) => row.id === id ? saved : row) : [saved, ...rows];
  localStorage.setItem(KEY, JSON.stringify(all)); emit(key, all[key]);
  return saved;
}
export async function deleteRecord(key, id) {
  if (TABLES[key] && hasSupabaseConfig) {
    const { error } = await supabase.from(TABLES[key]).delete().eq('id', id);
    if (error) throw error;
    return;
  }
  const all = read(); all[key] = (all[key] || []).filter((row) => row.id !== id);
  localStorage.setItem(KEY, JSON.stringify(all)); emit(key, all[key]);
}
export function subscribeRecords(callback) {
  const onChange = (event) => callback(event.detail?.key);
  const onStorage = (event) => { if (event.key === KEY || event.key?.startsWith('jacsi-')) callback(null); };
  window.addEventListener('aether-data-change', onChange); window.addEventListener('storage', onStorage);
  let channel;
  if (hasSupabaseConfig) {
    channel = supabase.channel('aether-managed-content');
    Object.entries(TABLES).filter(([, table]) => table).forEach(([key, table]) => channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => callback(key)));
    channel.subscribe();
  }
  return () => { window.removeEventListener('aether-data-change', onChange); window.removeEventListener('storage', onStorage); if (channel) supabase.removeChannel(channel); };
}

const MEDIA_TYPES = new Set(['image/jpeg','image/png','image/webp','image/gif','application/pdf','application/vnd.openxmlformats-officedocument.presentationml.presentation','application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/msword','text/plain']);
function readFileAsDataUrl(file) {
  return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('Could not read this file.'));reader.readAsDataURL(file);});
}
export async function uploadManagementFile(file, moduleName) {
  if (!file || !MEDIA_TYPES.has(file.type)) throw new Error('Choose a JPG, PNG, WEBP, GIF, PDF, PPT, PPTX, DOC, DOCX, or TXT file.');
  const maxBytes=hasSupabaseConfig?10*1024*1024:2*1024*1024;
  if(file.size>maxBytes)throw new Error(`File must be ${hasSupabaseConfig?'10 MB':'2 MB'} or smaller.`);
  if(!hasSupabaseConfig)return readFileAsDataUrl(file);
  const {data:{user},error:authError}=await supabase.auth.getUser();
  if(authError||!user)throw new Error('Your sign-in session expired. Sign in again before uploading.');
  const cleanName=file.name.normalize('NFKD').replace(/[^a-zA-Z0-9._-]/g,'_').slice(-100)||'upload';
  const path=`${user.id}/${moduleName}/${crypto.randomUUID()}-${cleanName}`;
  const {error}=await supabase.storage.from('department-media').upload(path,file,{contentType:file.type,upsert:false,cacheControl:'3600'});
  if(error)throw new Error(`Upload failed: ${error.message}`);
  return supabase.storage.from('department-media').getPublicUrl(path).data.publicUrl;
}
