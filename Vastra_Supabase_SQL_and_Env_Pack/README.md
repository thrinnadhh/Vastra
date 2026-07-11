# Vastra Supabase SQL and Environment Pack

This is a comprehensive implementation starter, not a substitute for staging tests or a security review.

Recommended order:
1. Install the Supabase CLI and run `supabase init`.
2. Copy numbered SQL files into `supabase/migrations` with timestamps or run the full schema in a fresh project.
3. Test locally with `supabase start` and `supabase db reset`.
4. Link the remote project and run `supabase db push --dry-run`, then `supabase db push`.
5. Add seed data with `supabase db push --include-seed` or run `seed.sql` through a controlled deployment.
6. Copy the correct `.env.*.example` file for each app. Never expose `SUPABASE_SECRET_KEY`, database passwords or provider secrets in frontend apps.
7. Replace placeholder external provider keys and configure Auth, Storage and Realtime as documented in the runbook PDF.

Important:
- Supabase owns `auth.users`; Vastra uses `public.profiles` linked by UUID.
- Self-registration always creates a CUSTOMER profile. Merchant, captain and admin roles require trusted approval.
- RLS is enabled/forced on every public table. Test policies with separate test users for every app.
- Critical order, inventory, payment, refund, payout and role changes belong in trusted backend transactions or reviewed RPC functions.
- Foreground merchant order alerts use Realtime; background/terminated ringing requires FCM/APNs.
