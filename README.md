# WiFiHub Ghana

**Single-company** Wi‑Fi hotspot billing for Ghana — one operator runs all
locations (Accra, Kumasi, Takoradi, …), sells prepaid / vouchers / monthly
plans via QR + Paystack, and connects MikroTik (or mock) gear.

**Spec:** [`WiFiHub_Ghana_Master_SRS_v2.0.txt`](./WiFiHub_Ghana_Master_SRS_v2.0.txt) (v2.1)  
**Design reference:** [`design.md`](./design.md)

## Getting started

```bash
cp .env.example .env.local   # set Supabase URL, anon key, service role key, APP_URL
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Create the operator in Supabase Auth, then sign in at `/login`.

```bash
# mock (default) | paystack
PAYMENT_MODE=mock
```

## Features you should copy (product roadmap)

These are first-class product goals for WiFiHub — not optional extras.

### 1. Customer self-service portal

Customers can:

- Buy internet  
- Renew packages  
- View usage  
- Download receipts  
- Manage devices  

### 2. Voucher system

Generate vouchers for cafés, shops, and resellers, e.g.:

```text
GH₵5
CODE: WF-83KD-22P9
```

### 3. Device management

Track:

- Device name  
- MAC address  
- Phone  
- Current package  
- Remaining time  
- Current speed  

### 4. Subscription billing

Beyond prepaid — monthly plans, e.g.:

| Plan    | Price        | Notes                      |
|---------|--------------|----------------------------|
| Basic   | GH₵80/month  | Unlimited                  |
| Premium | GH₵150/month | Unlimited + higher speed   |

### 5. Router dashboard

Display:

- Router online  
- Internet status  
- Connected users  
- Bandwidth  
- CPU  
- Memory  
- Traffic  

### 6. Captive portal builder

Owners customize:

- Logo  
- Colors  
- Welcome message  
- Background image  
- Packages  
- Terms & conditions  

### 7. Analytics

Charts for:

- Revenue  
- Users  
- Bandwidth  
- Package sales  
- Peak hours  

### 8. Multi-location support

One owner manages sites such as Accra, Kumasi, Takoradi, and Tamale from a single dashboard.

---

## What works today (Phases 1–3)

| Area | Status |
|------|--------|
| Owner auth, dashboard, settings | Done |
| Packages (owner-wide prepaid) | Done |
| Multi-hotspot locations + QR portal checkout | Done |
| Equipment catalog (Starlink, MikroTik, UniFi, …) | Done |
| Payments (mock / Paystack) + sessions | Done |
| Analytics (revenue, payments, packages, by hotspot) | Partial — bandwidth & peak hours later |
| CSV reports, notifications | Done |
| Mock router adapter | Done |
| Device management (name, MAC, package, remaining, revoke) | Done |
| Router dashboard (online, users, bandwidth, CPU, memory, traffic) | Done (live when MikroTik reachable) |
| MikroTik adapter mode (`ROUTER_ADAPTER=mikrotik`) | Done — fail-closed unlock + MAC |
| Voucher generate / redeem / CSV export | Done |
| Captive portal builder (logo, colors, welcome, terms) | Done |
| Customer self-service (usage, receipts, devices, renew) | Done |
| Monthly subscription plans (Basic / Premium style) | Done |
| Per-hotspot package assignment | Done |
| Analytics peak hours + bandwidth | Done |
| MikroTik live REST (authorize / status when configured) | Done |

## Deployment model

**One company, one operator account** — not multi-tenant SaaS. That account
owns every hotspot, package, voucher batch, and subscription for the business.

## Optional next

- Simple-queue bandwidth profiles on MikroTik  
- Printable voucher sheets  
- Deeper Paystack recurring mandates for monthly plans  

See the SRS roadmap for phase detail.

## Stack

- Next.js (App Router) · TypeScript · Tailwind  
- **Admin auth + data:** Supabase Auth + Postgres (required)  
- Paystack-ready payments · Router abstraction (mock → MikroTik+)  

### Supabase setup

1. Create a Supabase project  
2. Run SQL migrations in order in the SQL editor:
   - [`001_admin_profiles.sql`](./supabase/migrations/001_admin_profiles.sql)
   - [`002_hotspots_packages.sql`](./supabase/migrations/002_hotspots_packages.sql)
   - [`003_remaining_schema.sql`](./supabase/migrations/003_remaining_schema.sql)
   - [`004_payment_client_mac.sql`](./supabase/migrations/004_payment_client_mac.sql)
   - [`005_payment_fulfillment.sql`](./supabase/migrations/005_payment_fulfillment.sql)
   - [`006_expenses.sql`](./supabase/migrations/006_expenses.sql)
   - [`007_free_mode.sql`](./supabase/migrations/007_free_mode.sql)
3. In Authentication → Users, create the operator (email + password).  
   There is no public signup — only operators you create in Supabase can sign in.  
4. In Auth settings, disable “Confirm email” for local testing if needed  
5. Add to `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
APP_URL=http://localhost:3000
```

6. Restart `npm run dev` and sign in at `/login`

All business data (hotspots, packages, routers, payments, sessions, vouchers, …) lives in Supabase.

### Production (DigitalOcean + WireGuard)

For Starlink + MikroTik in production, follow **[DIGITALOCEAN_VPS_SETUP.md](./DIGITALOCEAN_VPS_SETUP.md)** (droplet → WireGuard → Nginx/HTTPS → MikroTik peer → go-live tests).

## Scripts

```bash
npm run dev
npm run build
npm start
```
