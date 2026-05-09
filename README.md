# Licentium Clockify

Internal time tracker for Licentium. Replaces the paid Clockify subscription with a self-hosted Next.js + Supabase app on Vercel.

- Magic-link sign-in via Supabase (allowlisted emails only)
- One running timer per person; manual entries and per-entry rate edits
- Everyone sees everyone — only the owner (or an admin) can edit/delete
- CSV download and printable PDF export, ready to feed into Claude for invoice generation

---

## 1. Local setup

You need: Node 18.18+, an account on [Supabase](https://supabase.com), and access to the team's Vercel team.

```bash
cd "Licentium Clockify"
npm install
cp .env.local.example .env.local
```

### Supabase project

1. In the Supabase dashboard, create a **new project** (free tier is fine — we use ~1 MB).
2. Open the **SQL editor** and run the entire contents of `supabase/schema.sql`. This creates the tables, the row-level security policies, the profile-on-signup trigger, and seeds Dmytro and Illia as admins.
3. Open **Authentication → Email Templates** if you want to customise the magic-link email. The defaults from Supabase work out of the box.
4. **Authentication → URL Configuration**:
   - **Site URL**: `http://localhost:3000` for dev, `https://clockify.licentium.io` (or whatever Illia wires up) for prod
   - **Redirect URLs**: add both of the above plus `https://*.vercel.app` for preview deploys
5. **Project Settings → API**:
   - copy `URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - copy `anon` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - copy `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`

### Fill in `.env.local`

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

ALLOWED_EMAILS=dmytro.o@licentium.io,illia@prokopievlaw.com,eliwonderer@gmail.com
ADMIN_EMAILS=dmytro.o@licentium.io,illia@prokopievlaw.com

NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### Run

```bash
npm run dev
```

Open http://localhost:3000, enter your email, click the magic link, and you're in.

---

## 2. Deploy to Vercel

```bash
npx vercel
# follow the prompts; pick the team scope, accept defaults
```

After the first deploy, set the production env vars in the Vercel dashboard (Settings → Environment Variables) — copy them from `.env.local` but change `NEXT_PUBLIC_SITE_URL` to the production URL:

```
NEXT_PUBLIC_SITE_URL=https://clockify.licentium.io
```

Also set `TZ=Europe/Kyiv` so the **today / this week / this month** presets line up with the team's wall clock instead of UTC.

Push back to Supabase: in **Authentication → URL Configuration**, add the production URL to both **Site URL** and **Redirect URLs**. Without this, magic links emailed in production redirect to `localhost`.

Then redeploy: `npx vercel --prod`.

If Illia points `clockify.licentium.io` at the Vercel project, magic links will arrive with the right hostname.

---

## 3. Onboarding a teammate

1. Add their email to `ALLOWED_EMAILS` in Vercel (and locally if needed). Redeploy.
2. They visit the app, type their email, click the magic link.
3. The Postgres trigger in `schema.sql` automatically creates their profile row (default rate $0). They can update their default rate in the DB or via the profile UI (TODO if needed) — until then it's whatever was set on signup, and they can override it per entry on each row.
4. To make someone an admin, edit the `admin_emails` array in `schema.sql`'s `handle_new_user` function before they sign up, **or** run this SQL once they've signed up:
   ```sql
   UPDATE public.profiles SET is_admin = true WHERE email = 'them@example.com';
   ```

To remove someone, drop them from `ALLOWED_EMAILS` and redeploy. The middleware signs them out on their next request. If you want to fully purge their data, delete them from `auth.users` in Supabase — the FK cascade removes their profile and entries.

---

## 4. Generating invoices with Claude

1. Open the **Export** page.
2. Pick the period (e.g. *Last month*) and the user.
3. Click **Download CSV**. Save it locally.
4. Drop it into a Claude conversation: *"Make me an invoice from this CSV. Bill from Licentium to Prokopiev Law, recipient illia@prokopievlaw.com. Include line items grouped by project. Use the rates in the file."*
5. Claude generates a Markdown / PDF / DOCX invoice. Send to Illia.

Or skip the CSV: hit **Print → Save as PDF** on the Export page. The page is print-styled and produces a clean one-document-per-period PDF you can attach directly.

---

## 5. Architecture notes (for future-you debugging at 1 AM)

- `middleware.ts` runs on every request. It refreshes the Supabase cookie session, gates non-public routes, and enforces the `ALLOWED_EMAILS` list. Anyone signed in with an email not on the list is signed out and bounced to `/login?error=not-allowed`.
- All mutations are **server actions** in `app/actions.ts`. RLS in `supabase/schema.sql` is the actual authorization boundary — the actions assume RLS rejects bad writes.
- The unique partial index `time_entries_one_running_per_user` enforces one timer per user. `startTimerAction` stops any current running timer first, so users can chain projects without surprise errors.
- Time-zone math (`lib/range.ts`) uses system-local time. Set `TZ=Europe/Kyiv` on Vercel.
- The CSV route at `/api/export/csv` mirrors the filters of the Export page exactly — the page builds the CSV link from its own searchParams.

## 6. Things explicitly skipped (YAGNI for now)

- Profile-edit UI (default rate, full name) — set via SQL or add later if it gets annoying
- Email branding (Supabase sends from `noreply@mail.app.supabase.io` by default; can be swapped to `noreply@licentium.io` once Cloudflare DNS migration lands)
- Daylight-saving precision (`TZ=Europe/Kyiv` handles it correctly via Node's tz database, but the date-only filters on history don't account for the tz shift across the boundary)
- Pagination on history — fine for thousands of entries; revisit at ~50k
- Real-time multiplayer — entries refresh on navigation; no live push
