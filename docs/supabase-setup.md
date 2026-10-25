# Supabase setup

Multiplayer rooms run on a free Supabase project. Solo games don't need it.

1. Create a project at https://supabase.com (region: Europe). Keep "Enable Data API"
   ticked.
2. SQL Editor → New query → paste `supabase/schema.sql` → Run. It creates the two tables,
   their access rules, and turns on Realtime for them.
3. Put the Project URL (`https://<ref>.supabase.co`) and the Publishable key
   (`sb_publishable_…`, Project Settings → API Keys) in `src/config.js`. The publishable
   key is public — safe in a static PWA because Row Level Security restricts what it can
   do. Never put the secret key in the repo.

Free projects are paused after about a week without use, and a paused project stops
resolving (rooms fail with "Failed to fetch"). Restore it from the dashboard; if it can't
be restored, create a new project as above and update `src/config.js`.

Current project: `sgflranhpapgmprjxors` (org "HaiHui", created October 2026; the July 2026
project `vuxgvhdyhteooivvlsha` is gone).
