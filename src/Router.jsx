import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext.jsx';
import { useAuth } from './auth/AuthContext.jsx';

const HomePage=lazy(()=>import('./App.jsx'));
const page=(name)=>lazy(()=>import('./pages.jsx').then((module)=>({default:module[name]})));
const InnerLayout=page('InnerLayout');const ContentPage=page('ContentPage');const SecurityPage=page('SecurityPage');const FacultyDashboard=page('FacultyDashboard');const LoginPage=page('LoginPage');const NotFoundPage=page('NotFoundPage');const RegisterPage=page('RegisterPage');const StudentDashboard=page('StudentDashboard');
const AdminDashboard=lazy(()=>import('./AdminDashboard.jsx'));

function ProtectedRoute({role}){const {user,profile,ready,aal,mode}=useAuth();const location=useLocation();if(!ready)return <main className="loading-state"><span className="spinner"/> Restoring your session…</main>;if(!user||!profile)return <Navigate to="/login" replace state={{from:location.pathname}}/>;if(mode==='supabase'&&['admin','faculty'].includes(profile.role)&&aal!=='aal2'&&location.pathname!=='/security')return <Navigate to="/security" replace state={{from:location.pathname}}/>;if(role&&profile.role!==role){if(profile.role==='pending_faculty')return <main className="interior-main"><section className="section interior-section"><div className="eyebrow">FACULTY VERIFICATION</div><h1>Access is pending <em>verification.</em></h1><p className="section-lede">The department must verify your faculty role before protected faculty pages become available.</p></section></main>;return <Navigate to={profile.role==='admin'?'/admin/dashboard':profile.role==='faculty'?'/faculty/dashboard':'/student/dashboard'} replace/>;}return <Outlet/>;}

export default function Router(){
  return <BrowserRouter basename={import.meta.env.BASE_URL}><AuthProvider><Suspense fallback={<main className="loading-state"><span className="spinner"/> Loading AETHER…</main>}><Routes>
    <Route path="/" element={<HomePage/>}/>
    <Route element={<ProtectedRoute role="admin"/>}><Route path="/admin/dashboard" element={<AdminDashboard/>}/><Route path="/admin/dashboard/:module" element={<AdminDashboard/>}/></Route>
    <Route element={<ProtectedRoute role="faculty"/>}><Route path="/faculty/dashboard" element={<AdminDashboard/>}/><Route path="/faculty/dashboard/:module" element={<AdminDashboard/>}/></Route>
    <Route element={<InnerLayout/>}>
      <Route path="department" element={<ContentPage slug="department"/>}/>
      <Route path="academics" element={<ContentPage slug="academics"/>}/>
      <Route path="laboratories" element={<ContentPage slug="laboratories"/>}/>
      <Route path="placements" element={<ContentPage slug="placements"/>}/>
      <Route path="faculty" element={<ContentPage slug="faculty"/>}/>
      <Route path="cells" element={<ContentPage slug="cells"/>}/>
      <Route path="cells/technical" element={<ContentPage slug="technical-cell"/>}/>
      <Route path="cells/sports" element={<ContentPage slug="sports-cell"/>}/>
      <Route path="cells/competitions" element={<ContentPage slug="competition-cell"/>}/>
      <Route path="cells/projects" element={<ContentPage slug="project-cell"/>}/>
      <Route path="events" element={<ContentPage slug="events"/>}/>
      <Route path="timetable" element={<ContentPage slug="timetable"/>}/>
      <Route path="announcements" element={<ContentPage slug="announcements"/>}/>
      <Route path="projects" element={<ContentPage slug="projects"/>}/>
      <Route path="achievements" element={<ContentPage slug="achievements"/>}/>
      <Route path="gallery" element={<ContentPage slug="gallery"/>}/>
      <Route path="contact" element={<ContentPage slug="contact"/>}/>
      <Route path="login" element={<LoginPage/>}/>
      <Route path="security" element={<SecurityPage/>}/>
      <Route path="register" element={<RegisterPage/>}/>
      <Route element={<ProtectedRoute role="student"/>}><Route path="student/dashboard" element={<StudentDashboard/>}/><Route path="student/dashboard/:section" element={<StudentDashboard/>}/></Route>
      
      <Route path="*" element={<NotFoundPage/>}/>
    </Route>
  </Routes></Suspense></AuthProvider></BrowserRouter>;
}
