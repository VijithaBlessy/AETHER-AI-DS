# AI & Data Science Department Digital Hub

Premium responsive department portal for Jayaraj Annapackiam CSI College of Engineering. Existing public pages remain in place. The management workspace now provides shared create, view, edit, delete and search flows for events, projects, announcements, achievements, gallery, cell activities, students, faculty, subjects, internal marks, semester results, attendance, timetable and cell records. Local Mode data uses one browser-local data service; public content pages consume those saved records.

## Start locally

On Windows, double-click `start-site.bat`. It installs dependencies if needed, starts Vite, and opens the working localhost URL in your browser. Do not double-click `index.html`: this React/Vite source page must be served over HTTP, or the browser blocks its JavaScript modules with the `file://` CORS error shown in the screenshot.

Alternatively, open PowerShell in this project folder and run:

```sh
npm install
npm run dev
```

## Routes

Public routes: `/`, `/department`, `/academics`, `/faculty`, `/cells`, `/events`, `/projects`, `/achievements`, `/gallery`, `/contact`, `/login`, and `/register`. Authenticated routes: `/student/dashboard`, `/faculty/dashboard`, and `/admin/dashboard`. The Vite dev server and supported SPA hosts handle deep links; configure an `index.html` fallback on static hosting.

## Demo authentication

Demo sign-in is available only when Supabase variables are blank. Student demo: `student.demo@aether.edu` / `AetherStudent2026!` (or ID `AETHER-STUDENT-001`). Local faculty demo: `faculty.demo@aether.edu` / `AetherFaculty2026!`. Local admin demo: `admin.demo@aether.edu` / `AetherAdmin2026!`; records are stored in this browser only. These built-in demo accounts are for local preview and do not provide production security. Student demo registration creates a temporary browser session only and never stores the entered password; configure Supabase for persistent accounts. Supabase faculty access requires department verification, and production admin access requires an approved `admin_members` entry.

## Supabase setup

1. Create a Supabase project and copy `.env.example` to `.env.local`.
2. Fill `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. The anon key is designed for browser use; never put a service-role key in frontend environment variables.
3. Run `supabase/schema.sql` in the Supabase SQL Editor.
4. Student registrations create a `student` profile through a database trigger. Faculty registrations are assigned `pending_faculty`; a trusted administrator must verify the person and promote the profile using the SQL Editor before faculty login is enabled, for example: `update public.profiles set role = 'faculty' where id = (select id from auth.users where email = 'verified-faculty@example.edu') and role = 'pending_faculty';` Never promote an unverified user or grant `admin_members` from the client.
5. Create staff administrator accounts through Supabase Auth and add verified IDs to `admin_members` from the SQL Editor, e.g. `insert into public.admin_members(user_id) select id from auth.users where email = 'verified-staff@example.edu';` Admin membership is separate from student/faculty role metadata.
6. Restart the Vite server. Supabase Auth handles session tokens and password reset. `admin/dashboard` checks signed-in identity against `admin_members`; insert verified staff IDs into this table only using the SQL Editor, never from the browser. The admin workspace manages events, projects, announcements, achievements, gallery records and cell activities with RLS-protected CRUD. Profile RLS prevents users from changing their role; do not expose a service-role key in Vite variables.

All management modules can use Supabase when configured, including student, faculty, subject, marks, results, attendance, timetable and cell records. Run the updated `supabase/schema.sql` in the Supabase SQL Editor before enabling database mode; the script creates the management tables, admin-only RLS policies and Realtime publication entries. Admin members can add, view, edit, and delete records in the connected database. Verified faculty can add and edit their own events; the event owner field and faculty update policy are included in the schema migration. Without Supabase credentials, records persist in this browser only and are not shared across devices. Do not store official or sensitive academic records until the college has reviewed the Supabase project, access policies and deployment. File uploads, audit logs and institution-approved internal-mark formula configuration remain pending. The marks form stores raw marks and a formula reference without assuming an unverified college calculation. Attendance percentage is derived from present/total classes. Password recovery emails require the Supabase Auth email provider and correct redirect URL allow-list. Demo login/profile state is stored in session storage (or local storage only when “Remember me” is selected), never the entered password.

## Deployment

Build with `npm run build`; deploy the generated `dist/` directory to any static host that supports SPA routing. Configure the two Vite Supabase variables in the hosting provider’s environment settings, then rebuild. Use HTTPS, set a restrictive host-level Content Security Policy for the chosen asset/font hosts, and invite only verified staff in Supabase Auth.

## Content to verify before publishing

Replace the clearly marked HOD, faculty, academic/curriculum, laboratory, placement, address and contact placeholders with official college-approved information. Confirm event dates and descriptions, and publish project/achievement details only with student and faculty approval. The Unsplash hero image is a decorative royalty-free hosted visual and can be replaced by a college-owned image.


## Google sign-in, staff MFA and update alerts

- The login screen supports Google OAuth for students, faculty and admins. Student Google accounts may use any Google email address; no email-domain restriction is sent to Google. Supabase creates a student profile by default. Faculty must already have a verified `faculty` profile, and admins must already be in `admin_members`; a Google sign-in choice never grants either staff role.
- In Google Cloud, create a Web OAuth client. Add `http://localhost:5173` and the production site origin as JavaScript origins. Add the exact Supabase Auth callback URI shown in Supabase Authentication > Providers > Google as an authorized redirect URI.
- In Supabase, enable the Google provider with that OAuth client ID and client secret. Add `http://localhost:5173/login` and the production `/login` URL to Authentication > URL Configuration > Redirect URLs. Store the client secret only in the Supabase dashboard; never put it in a `VITE_` variable or browser code.
- Run the updated `supabase/schema.sql`. It gates staff management policies on an `aal2` session. Keep Supabase Auth MFA/TOTP verification enabled. Each verified faculty/admin must enroll an authenticator app and enter its current code before staff routes and management data are available.
- The four named cell leaders need Google Workspace accounts created by the college Workspace administrator. This site cannot create Google accounts or issue Google passwords. Have each leader sign in with their assigned Google email, then add that same email and their matching name in Student Management and set their cell. Google handles their credentials; do not share one password across leaders.
- The notification bell uses Supabase Realtime while the site is open and signed in. Browser notifications can be enabled from the bell; they work while the browser session is alive and permission is granted. This is not offline/mobile push delivery.

Supabase rate limits and CAPTCHA/bot protection remain configured in the Supabase dashboard under Authentication > Rate Limits and Bot and Abuse Protection. Use HTTPS in production, keep the service-role key off the client, restrict Google OAuth redirects to the exact site origins, and review the RLS policies after applying schema changes. A browser app cannot promise complete protection against every cyberattack; server-side policies and the provider configuration are required for production security.
