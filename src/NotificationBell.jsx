import React, { useEffect, useState } from 'react';
import { Bell, Check, Trash2 } from 'lucide-react';
import { useAuth } from './auth/AuthContext.jsx';
import { supabase } from './lib/supabase.js';

const TABLE_LABELS={events:'Events',projects:'Projects',announcements:'Announcements',achievements:'Achievements',gallery:'Gallery',cell_activities:'Cell activities',final_year_projects:'Final year projects',students:'Student records',faculty:'Faculty records',subjects:'Academic records',internal_marks:'Internal marks',semester_results:'Semester results',attendance:'Attendance',timetable:'Timetable',department_cells:'Department cells'};
const WATCH_TABLES=Object.keys(TABLE_LABELS);
const makeNotice=(table,eventType)=>({id:`${Date.now()}-${Math.random()}`,label:TABLE_LABELS[table]||'Department records',action:eventType==='INSERT'?'New record':eventType==='DELETE'?'Record removed':'Record updated',createdAt:new Date().toISOString(),read:false});

export function NotificationBell(){
  const {user,profile,mode}=useAuth();const [items,setItems]=useState([]);const [open,setOpen]=useState(false);const [permission,setPermission]=useState(()=>('Notification' in window?Notification.permission:'unsupported'));
  useEffect(()=>{
    if(!user)return undefined;
    const push=(item)=>{setItems(current=>[item,...current].slice(0,20));if('Notification' in window&&Notification.permission==='granted'&&document.hidden)new Notification(`${item.action} · ${item.label}`,{body:'Sign in to AETHER to review the latest department updates.'});};
    if(supabase){let channel=supabase.channel(`aether-notifications-${user.id}`);WATCH_TABLES.forEach(table=>{channel=channel.on('postgres_changes',{event:'*',schema:'public',table},payload=>push(makeNotice(table,payload.eventType)));});channel.subscribe();return()=>{supabase.removeChannel(channel);};}
    const localChange=(event)=>{const table=event.detail?.key;if(TABLE_LABELS[table])push(makeNotice(table,event.detail?.eventType||'UPDATE'));};
    const storageChange=(event)=>{if(event.key==='aether-management-data-v2')push({id:`${Date.now()}-${Math.random()}`,label:'Department records',action:'Records updated',createdAt:new Date().toISOString(),read:false});};
    window.addEventListener('aether-data-change',localChange);window.addEventListener('storage',storageChange);return()=>{window.removeEventListener('aether-data-change',localChange);window.removeEventListener('storage',storageChange);};
  },[user?.id,mode]);
  const unread=items.filter(item=>!item.read).length;
  const toggle=()=>{setOpen(value=>!value);setItems(current=>current.map(item=>({...item,read:true})));};
  const enableBrowserAlerts=async()=>{if(!('Notification' in window)){setPermission('unsupported');return;}setPermission(await Notification.requestPermission());};
  const clear=()=>setItems([]);
  if(!user||!profile)return null;
  return <div className="notification-wrap"><button className="icon-button notification-button" onClick={toggle} aria-label={`Notifications${unread?`, ${unread} unread`:''}`} aria-expanded={open}><Bell size={17}/>{unread>0&&<span className="notification-count">{unread>9?'9+':unread}</span>}</button>{open&&<section className="notification-popover" aria-label="Recent updates"><header><div><div className="eyebrow">LIVE UPDATES</div><b>Notifications</b></div><button className="notification-clear" onClick={clear} disabled={!items.length}><Trash2 size={14}/> Clear</button></header><button className="notification-permission" onClick={enableBrowserAlerts}>{permission==='granted'?'Browser alerts enabled':permission==='denied'?'Browser alerts blocked':permission==='unsupported'?'Browser alerts unavailable':'Enable browser alerts'}</button>{items.length?<div className="notification-list">{items.map(item=><article key={item.id}><span className="notification-dot"/><div><b>{item.action} · {item.label}</b><small>{new Date(item.createdAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</small></div></article>)}</div>:<p className="notification-empty"><Check size={15}/> You’re up to date. Updates appear here while you’re signed in.</p>}</section>}</div>;
}
