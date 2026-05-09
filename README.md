# Licentium Clockify

Internal time tracker for Licentium. Replaces the paid Clockify subscription with a self-hosted Next.js + Supabase app on Vercel.

- Magic-link sign-in via Supabase (allowlisted emails only)
- One running timer per person; manual entries and per-entry rate edits
- **Two roles:**
  - **Admin** — sees everything across the team (hours, money, balances, payments, invoices); can edit anyone&rsquo;s entries.
  - **Member** — sees only their own entries, payments, and balance. Cannot see any other person&rsquo;s data. Has no access to Invoices, Export, or Team pages.
- Payments tracked alongside hours → live "owed / prepaid" balance per person
- Invoice generator with snapshotted line items, sequential numbering, paid/unpaid status
- Browser-tab title shows the running timer from any page (`[01:24:15] Licentium Clockify`)
- Optional Slack notifications for invoice created / paid / payment logged (toggleable per-event in admin settings)
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
   - **If upgrading from an earlier deploy**, run the migrations in order:
     - `supabase/migrations/002_payments_invoices.sql` (payments + invoices + invoice_settings)
     - `supabase/migrations/003_notification_settings.sql` (Slack toggles)
     - `supabase/migrations/004_member_privacy.sql` (member privacy: only own data)
     All are idempotent and safe to re-run.
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

1. Add their email to `ALLOWED_EMAILS` in Vercel. Redeploy.
2. They visit the app, type their email, click the magic link.
3. The Postgres trigger in `schema.sql` automatically creates their profile row with default rate `$15/hr`. They can update their own rate via `/profile`, or an admin can set it via Profile → Team rates.
4. By default the new user is a **member** — they only see their own data.
5. To promote someone to **admin** (sees everything, can edit anyone), either edit the hardcoded list in `schema.sql`&rsquo;s `handle_new_user` function before their first signup, or run this SQL after:
   ```sql
   UPDATE public.profiles SET is_admin = true WHERE email = 'them@example.com';
   ```

To remove someone, drop them from `ALLOWED_EMAILS` and redeploy. The middleware signs them out on their next request. If you want to fully purge their data, delete them from `auth.users` in Supabase — the FK cascade removes their profile, entries, and payments.

### Privacy model

Members and admins see different things. The split is enforced at the database level via row-level security, so even a clever member can&rsquo;t bypass it through the API:

| Page | Member sees | Admin sees |
|---|---|---|
| Dashboard | Own timer, own recent entries, own balance | Everything |
| History | Own entries with own filters | Everyone, with user filter |
| Projects | Project list, own hours per project | Everyone&rsquo;s hours per project |
| Payments | Own payments only | Everyone&rsquo;s payments |
| Profile | Own profile only | Own + Team rates table |
| Invoices | (no access) | Full |
| Export | (no access) | Full |
| Team | (no access) | List of everyone with stats; per-person detail page |

---

## 4. Generating invoices with Claude

1. Open the **Export** page.
2. Pick the period (e.g. *Last month*) and the user.
3. Click **Download CSV**. Save it locally.
4. Drop it into a Claude conversation: *"Make me an invoice from this CSV. Bill from Licentium to Prokopiev Law, recipient illia@prokopievlaw.com. Include line items grouped by project. Use the rates in the file."*
5. Claude generates a Markdown / PDF / DOCX invoice. Send to Illia.

Or skip the CSV: hit **Print → Save as PDF** on the Export page. The page is print-styled and produces a clean one-document-per-period PDF you can attach directly.

---

## 5. Slack notifications (optional)

Two layers of "off":

1. **Env unset** — if `SLACK_WEBHOOK_URL` is not set in Vercel, the integration is fully dead and the in-app toggles are ignored. This is the master kill switch.
2. **In-app toggles** — once the webhook is set, an admin opens `/invoices` → Settings → "Notifications: Slack" and flips the master toggle + the per-event toggles (Invoice created / Invoice paid / Payment logged).

Setup:

1. In Slack: **Apps → Incoming Webhooks → Add to Slack → pick a channel** (e.g. `#licentium-money`). Copy the webhook URL — looks like `https://hooks.slack.com/services/T.../B.../xxx`.
2. In Vercel project settings → Environment Variables, add `SLACK_WEBHOOK_URL=<that URL>` for Production. Redeploy.
3. In the app: `/invoices` → Settings → "Notifications: Slack" → tick "Slack notifications enabled" + the events you want → Save.

What gets posted:

- **Invoice created** — number, recipient, amount, period, who created it
- **Invoice paid** — number, recipient, amount (only on the unpaid → paid transition; un-marking is silent)
- **Payment logged** — recipient name, amount, date, note, who recorded it

Failures (Slack down, bad URL, timeout) log to Vercel runtime logs and never break the surrounding action — invoice creation / payment logging always succeeds even if Slack rejects the post.

## 6. Architecture notes (for future-you debugging at 1 AM)

- `middleware.ts` runs on every request. It refreshes the Supabase cookie session, gates non-public routes, and enforces the `ALLOWED_EMAILS` list. Anyone signed in with an email not on the list is signed out and bounced to `/login?error=not-allowed`.
- All mutations are **server actions** in `app/actions.ts`. RLS in `supabase/schema.sql` is the actual authorization boundary — the actions assume RLS rejects bad writes.
- The unique partial index `time_entries_one_running_per_user` enforces one timer per user. `startTimerAction` stops any current running timer first, so users can chain projects without surprise errors.
- Time-zone math (`lib/range.ts`) uses system-local time. Set `TZ=Europe/Kyiv` on Vercel.
- The CSV route at `/api/export/csv` mirrors the filters of the Export page exactly — the page builds the CSV link from its own searchParams.

## 7. Things explicitly skipped (YAGNI for now)

- Profile-edit UI (default rate, full name) — set via SQL or add later if it gets annoying
- Email branding (Supabase sends from `noreply@mail.app.supabase.io` by default; can be swapped to `noreply@licentium.io` once Cloudflare DNS migration lands)
- Daylight-saving precision (`TZ=Europe/Kyiv` handles it correctly via Node's tz database, but the date-only filters on history don't account for the tz shift across the boundary)
- Pagination on history — fine for thousands of entries; revisit at ~50k
- Real-time multiplayer — entries refresh on navigation; no live push
