# Local MikroTik + WiFiHub (Phase 1 — no separate AP)

Test everything on your **laptop + MikroTik** before VPS and before buying access points.

Inspired by `MIKROTIK_HOTSPOT_PROJECT.md`, but **Phase 1** collapses AP + controller onto one box.

---

## Architecture (now vs later)

### Phase 1 — local lab (do this now)

```text
Internet (MTN Turbonet / any modem)
        ↓
   MikroTik WAN (ether1)
        ↓
   MikroTik wifi1  ← customers join THIS SSID
        ↓
   Hotspot captive portal
        ↓
   WiFiHub on laptop (localhost:3000)
        ↑
   ngrok public HTTPS URL  ← phones + Paystack webhooks
```

- MikroTik = **controller + Wi‑Fi** (no separate AP yet).
- Customers connect **directly to MikroTik**.
- Laptop runs WiFiHub; Host for REST = MikroTik LAN IP (`192.168.88.1`).
- ngrok exposes the portal/webhooks so phones on Hotspot can reach your app.

### Phase 2 — production (later)

```text
Starlink → MikroTik (controller only) → Access Point(s) → Customers
```

- APs only broadcast Wi‑Fi (bridge).
- Customers never join MikroTik radio; they join APs.
- WiFiHub on VPS; Host = WireGuard `10.8.0.2`.

---

## Prerequisites

1. MikroTik factory-reset, Winbox working (`admin` + your new password).
2. Laptop Ethernet or Wi‑Fi to MikroTik **LAN** (not only through Turbonet Wi‑Fi).
3. Node app: `npm run dev` in this repo.
4. [ngrok](https://ngrok.com) account + CLI installed.
5. Supabase keys already in `.env.local`.

---

## Step A — Cable & basic MikroTik

1. Turbonet/modem LAN → MikroTik **ether1** (WAN).
2. Laptop → MikroTik LAN port (or join MikroTik Wi‑Fi after SSID is set).
3. Winbox → Neighbors → MAC → login as `admin`.
4. **Bypass your admin PC** so Hotspot never locks you out:

```routeros
/ip hotspot ip-binding
add mac-address=XX:XX:XX:XX:XX:XX type=bypassed comment="admin laptop"
```

(Use your PC Ethernet/Wi‑Fi MAC from `ipconfig /all`.)

5. Set a strong admin password and store it.

---

## Step B — Open Wi‑Fi on MikroTik (SSID)

```routeros
/interface wifi security
add name=open authentication-types=""
/interface wifi
set wifi1 configuration.ssid="Luks Ventures Wiffi" security=open configuration.mode=ap
```

Confirm:

```routeros
/interface wifi print
```

Phone should see **Luks Ventures Wiffi** (open). Internet may still be free until Hotspot is on.

---

## Step C — Hotspot (block unpaid clients)

Winbox: **IP → Hotspot → Hotspot Setup**

- Interface: **bridge** (or the LAN that includes `wifi1`)
- Local address of network: keep default / `192.168.88.1/24` if that is your LAN
- Finish wizard
- Server Profile → **Trial = none** (important)

Confirm phones get `http://192.168.88.1/login` (MikroTik page) when not authorized.

---

## Step D — WiFiHub on laptop

`.env.local` (local phase):

```env
APP_URL=http://localhost:3000
PAYMENT_MODE=mock
ROUTER_ADAPTER=mikrotik
```

```bash
npm run dev
```

1. Open `http://localhost:3000` → login.
2. **Hotspots** → create/edit hotspot, SSID = `Luks Ventures Wiffi`, note the **slug**.
3. **Router / MikroTik wizard** → **Local LAN**:
   - Host: `192.168.88.1`
   - Port: `80`
   - User/password: Winbox admin (or dedicated `wifihub` user)
4. Save → **Test** → must show **connected**.

Enable WWW on MikroTik if needed:

```routeros
/ip service set www disabled=no
```

---

## Step E — ngrok (phones + webhooks)

Terminal 2:

```bash
ngrok http 3000
```

Copy the HTTPS URL, e.g. `https://abc123.ngrok-free.app`.

Update `.env.local`:

```env
APP_URL=https://abc123.ngrok-free.app
```

Restart `npm run dev`.

Walled garden (phones must reach ngrok before pay):

```routeros
/ip hotspot walled-garden
add dst-host=abc123.ngrok-free.app action=allow comment="WiFiHub ngrok"
add dst-host=*.ngrok-free.app action=allow comment="ngrok"
add dst-host=*.ngrok.io action=allow comment="ngrok legacy"
```

(Adjust host to your real ngrok domain.)

---

## Step F — Captive redirect → WiFiHub (not MikroTik login)

Replace MikroTik `hotspot/login.html` with (use **your** ngrok URL + **your** hotspot slug):

```html
<html>
<head>
<meta http-equiv="refresh" content="0; url=https://YOUR_NGROK/portal/YOUR_SLUG?mac=$(mac)">
<script>
  window.location =
    "https://YOUR_NGROK/portal/YOUR_SLUG?mac=$(mac)";
</script>
</head>
<body>
  <p>Opening WiFiHub…</p>
  <a href="https://YOUR_NGROK/portal/YOUR_SLUG?mac=$(mac)">Continue</a>
</body>
</html>
```

Upload via Winbox **Files** → `hotspot` → `login.html`.

---

## Step G — End-to-end test

1. Phone: forget Turbonet; join **Luks Ventures Wiffi**.
2. Captive page should open **WiFiHub portal** (not MikroTik user/password).
3. Buy with **mock** payment (or voucher).
4. Phone gets internet; WiFiHub shows session; MikroTik Hotspot host/binding updates.
5. When package expires (or you revoke), internet stops.

Paystack (local with ngrok): see **[PAYSTACK_LOCAL_SETUP.md](./PAYSTACK_LOCAL_SETUP.md)**.

```env
PAYMENT_MODE=paystack
```

Paystack webhook URL:

```text
https://YOUR_NGROK/api/payments/webhook
```

---

## Checklist before VPS / APs

- [ ] Winbox stable; admin PC bypassed  
- [ ] SSID open: `Luks Ventures Wiffi`  
- [ ] Hotspot blocks unpaid traffic  
- [ ] WiFiHub Test = connected to `192.168.88.1`  
- [ ] ngrok portal opens on phone with `?mac=`  
- [ ] Mock pay → unlock works  
- [ ] Expire/revoke works  

Then: deploy to VPS, WireGuard Host `10.8.0.2`, add APs in bridge mode (Phase 2).

---

## Common mistakes

| Symptom | Cause |
|--------|--------|
| Free internet | Hotspot off, Trial on, or still on Turbonet Wi‑Fi |
| MikroTik login form | `login.html` not redirected to WiFiHub |
| Portal won’t load on phone | Missing walled-garden for ngrok; or `APP_URL` still localhost |
| Winbox locked out | No IP-binding bypass for admin MAC |
| Unlock fails | MAC missing (`?mac=$(mac)`); or REST Test not connected |
