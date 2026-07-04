# Supabase setup

1. Create a free project at https://supabase.com. Copy the Project URL and the anon key
   (Project Settings → API).
2. Put them in `src/config.js` (created in Task 11). The anon key is public — safe in a
   static PWA because Row Level Security restricts what it can do.
3. Open the SQL editor, paste `supabase/schema.sql`, run it.
4. Enable Realtime for the `rooms`, `players`, and `moves` tables (Database → Replication,
   or Database → Publications → `supabase_realtime` → add the three tables).

Security note: `moves.is_correct` is written by the app but is not shown in the UI until a
challenge or checkpoint reveals the outcome. (A later hardening step can move the
correctness calculation into a `SECURITY DEFINER` RPC so it never travels to clients before
reveal; v1 keeps it client-side for simplicity.)
