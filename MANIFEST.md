# Home update delta (25 Nov 2026)
New:     supabase/functions/whos-around/index.ts
New:     frontend/src/lib/useWhosAround.ts, components/WhosAroundPanel.tsx, components/HomeTodayPanel.tsx
Changed: frontend/src/pages/HomePage.tsx, frontend/src/styles/global.css  (global.css includes the earlier nav-v4 CSS)
No migration. Deploy function: npx supabase functions deploy whos-around
