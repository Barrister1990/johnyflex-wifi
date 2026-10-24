# WiFiHub Ghana — DigitalOcean VPS setup (start to finish)

This guide takes you from a new DigitalOcean account to a production VPS that:

- Runs **WiFiHub** (Next.js)
- Runs **WireGuard** so Starlink/MikroTik can dial **out** to the cloud
- Lets WiFiHub unlock customers over RouterOS REST after pay/voucher

```
Customers → Starlink → MikroTik (Wi‑Fi + captive portal)
                              │
                              │ WireGuard OUT (café → VPS)
                              ▼
                    DigitalOcean VPS
                    ├── WireGuard 10.8.0.1
                    ├── WiFiHub (Next.js)
                    └── Nginx + HTTPS
                              │
                              ▼
                    Supabase + Paystack
```

**Time estimate:** 1–2 hours (plus DNS propagation).  
**You need:** DigitalOcean account, domain (recommended), MikroTik on site, Starlink online.

---

## 0. Before you start — checklist

| Item | Notes |
|------|--------|
| Domain | e.g. `wifi.yourcompany.com` → will point at the droplet |
| Supabase | Project ready; migrations `001`–`004` applied |
| Operator login | Created in Supabase Auth (email/password) |
| GitHub repo | This project pushed so the VPS can `git clone` |
| MikroTik | Powered, Starlink on WAN, you can log into Winbox/WebFig |
| Paystack | Optional day-one; keep mock until unlock works |

**Do not** host WiFiHub only on Vercel for production with Starlink. The WireGuard tunnel must live on a VPS you control.

---

## 1. Create the DigitalOcean droplet

1. Log in to [DigitalOcean](https://cloud.digitalocean.com/).
2. **Create** → **Droplets**.
3. Recommended settings:

| Setting | Value |
|---------|--------|
| Region | Closest to Ghana (e.g. **London** or **Frankfurt**) |
| Image | **Ubuntu 24.04 LTS** |
| Size | **Basic** → **Regular** → **$12/mo** (2 GB RAM) minimum; 1 GB can work but is tight |
| Disk | Default SSD is fine |
| Authentication | **SSH key** (strongly preferred) |
| Hostname | `wifihub-gh` |

4. Create the droplet and copy its **public IPv4** (example below: `YOUR_VPS_IP`).

### Add a firewall (Cloud Firewall)

**Networking** → **Firewalls** → create one attached to this droplet:

| Type | Protocol | Port | Sources |
|------|----------|------|---------|
| SSH | TCP | 22 | Your office/home IP (or Anywhere while setting up) |
| HTTP | TCP | 80 | Anywhere |
| HTTPS | TCP | 443 | Anywhere |
| WireGuard | UDP | **51820** | Anywhere |

Save. Without UDP **51820**, MikroTik cannot keep the tunnel up.

---

## 2. First login and OS hardening

From your laptop (PowerShell or terminal):

```bash
ssh root@YOUR_VPS_IP
```

Update packages and create a deploy user:

```bash
apt update && apt upgrade -y
adduser wifihub
usermod -aG sudo wifihub
rsync --archive --chown=wifihub:wifihub ~/.ssh /home/wifihub
```

Optional: disable password SSH after keys work (`/etc/ssh/sshd_config` → `PasswordAuthentication no`), then:

```bash
systemctl reload ssh
```

From now on:

```bash
ssh wifihub@YOUR_VPS_IP
```

---

## 3. Install Node.js 22, Git, Nginx, Certbot

```bash
sudo apt install -y git curl nginx ufw
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node -v   # should show v22.x
npm -v
```

Enable UFW (match cloud firewall):

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 51820/udp
sudo ufw enable
sudo ufw status
```

---

## 4. Install and configure WireGuard (VPS = server)

### 4.1 Install

```bash
sudo apt install -y wireguard
```

### 4.2 Generate VPS keys

```bash
umask 077
wg genkey | tee ~/wg-server-private.key | wg pubkey > ~/wg-server-public.key
sudo mv ~/wg-server-private.key /etc/wireguard/server-private.key
sudo mv ~/wg-server-public.key /etc/wireguard/server-public.key
sudo chmod 600 /etc/wireguard/server-private.key
```

Show the **VPS public key** (you will paste this into MikroTik):

```bash
sudo cat /etc/wireguard/server-public.key
```

### 4.3 Generate MikroTik peer keys (on the VPS for convenience)

```bash
wg genkey | tee ~/mt-private.key | wg pubkey > ~/mt-public.key
echo "MikroTik PRIVATE key (put on router only):"
cat ~/mt-private.key
echo "MikroTik PUBLIC key (put on VPS peer):"
cat ~/mt-public.key
```

Keep the MikroTik **private** key secret. You will paste it into RouterOS.

### 4.4 Create `/etc/wireguard/wg0.conf`

```bash
sudo nano /etc/wireguard/wg0.conf
```

Paste (replace keys):

```ini
[Interface]
Address = 10.8.0.1/24
ListenPort = 51820
PrivateKey = PASTE_VPS_PRIVATE_KEY_HERE
# Optional: NAT if you ever route more than REST; usually not required for WiFiHub
# PostUp = iptables -A FORWARD -i wg0 -j ACCEPT; iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
# PostDown = iptables -D FORWARD -i wg0 -j ACCEPT; iptables -t nat -D POSTROUTING -o eth0 -j MASQUERADE

[Peer]
# Café MikroTik
PublicKey = PASTE_MIKROTIK_PUBLIC_KEY_HERE
AllowedIPs = 10.8.0.2/32
PersistentKeepalive = 25
```

Get the VPS private key:

```bash
sudo cat /etc/wireguard/server-private.key
```

### 4.5 Start WireGuard

```bash
sudo systemctl enable wg-quick@wg0
sudo systemctl start wg-quick@wg0
sudo wg show
```

You should see interface `wg0` listening on port `51820`. The peer will show a handshake **after** MikroTik is configured (section 7).

---

## 5. Deploy WiFiHub on the VPS

### 5.1 Clone the repo

```bash
sudo mkdir -p /var/www
sudo chown wifihub:wifihub /var/www
cd /var/www
git clone https://github.com/YOUR_ORG/wifihub-gh.git
cd wifihub-gh
```

(Use your real GitHub URL. Private repo: use a deploy key or HTTPS token.)

### 5.2 Create production env file

```bash
cp .env.example .env.local
nano .env.local
```

Minimum production values:

```env
APP_URL=https://wifi.yourcompany.com

NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Start with mock until a real phone unlocks
PAYMENT_MODE=mock
PAYSTACK_SECRET_KEY=
PAYSTACK_PUBLIC_KEY=
PAYSTACK_WEBHOOK_SECRET=

ROUTER_ADAPTER=mikrotik
# Optional single-site fallback (prefer wizard credentials):
MIKROTIK_HOST=10.8.0.2
MIKROTIK_USER=wifihub
MIKROTIK_PASSWORD=choose-a-strong-password
MIKROTIK_PORT=80
MIKROTIK_SECURE=0

# Fills the in-app wizard "Paste into MikroTik" script
WIREGUARD_VPS_PUBLIC_IP=YOUR_VPS_IP
WIREGUARD_VPS_PUBLIC_KEY=paste-from-wg-show-or-server-public-key
WIREGUARD_SERVER_ADDRESS=10.8.0.1
WIREGUARD_PEER_ADDRESS=10.8.0.2
WIREGUARD_LISTEN_PORT=51820
```

Notes:

- `APP_URL` must be the **public HTTPS** URL customers and Paystack use.
- `MIKROTIK_HOST` must be the **WireGuard IP** (`10.8.0.2`), **not** `192.168.1.1`.
- Prefer saving the same host/user/password in the **MikroTik setup wizard** in the admin UI.

### 5.3 Install and build

```bash
cd /var/www/wifihub-gh
npm ci
npm run build
```

### 5.4 systemd service

```bash
sudo nano /etc/systemd/system/wifihub.service
```

```ini
[Unit]
Description=WiFiHub Ghana
After=network.target

[Service]
Type=simple
User=wifihub
WorkingDirectory=/var/www/wiffihub
Environment=NODE_ENV=production
Environment=PORT=3000
# Loads WireGuard + secrets into the process (path must match WorkingDirectory)
EnvironmentFile=-/var/www/wiffihub/.env.local
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable wifihub
sudo systemctl start wifihub
sudo systemctl status wifihub
```

App should listen on `127.0.0.1:3000`.

### 5.5 Deploy updates later

```bash
cd /var/www/wiffihub
git pull
npm ci
npm run build
sudo systemctl restart wifihub
```

---

## 6. Nginx reverse proxy + Let’s Encrypt HTTPS

### 6.1 DNS

At your DNS provider, create an **A record**:

| Host | Type | Value |
|------|------|--------|
| `wifi` (or `@`) | A | `YOUR_VPS_IP` |

Wait until it resolves:

```bash
dig +short wifi.yourcompany.com
```

### 6.2 Nginx site

```bash
sudo nano /etc/nginx/sites-available/wifihub
```

```nginx
server {
    listen 80;
    server_name wifi.yourcompany.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/wifihub /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 6.3 TLS certificate

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d wifi.yourcompany.com
```

Follow prompts. Certbot renews automatically.

Visit `https://wifi.yourcompany.com/login` — you should see WiFiHub.

---

## 7. Configure MikroTik WireGuard (on site)

Use Winbox or WebFig on the café LAN.

### 7.1 WireGuard interface + address

In **Terminal** (edit keys/IPs):

```routeros
/interface wireguard
add listen-port=13231 mtu=1420 name=wg-wifihub

/interface wireguard peers
add name=vps allowed-address=10.8.0.1/32 endpoint-address=YOUR_VPS_IP endpoint-port=51820 \
    interface=wg-wifihub public-key="PASTE_VPS_PUBLIC_KEY" \
    private-key="PASTE_MIKROTIK_PRIVATE_KEY" persistent-keepalive=25s

/ip address
add address=10.8.0.2/32 interface=wg-wifihub

# Required on many RouterOS builds — peer allowed-address alone may not install a route
/ip route
add dst-address=10.8.0.1/32 gateway=wg-wifihub comment="WiFiHub VPS via WG"

/interface list member
add list=LAN interface=wg-wifihub
```

> On some RouterOS versions the peer `private-key` is set on the **interface**, not the peer. If the command fails, set:
>
> ```routeros
> /interface wireguard set wg-wifihub private-key="PASTE_MIKROTIK_PRIVATE_KEY"
> ```
> and on the peer only set the VPS **public** key + endpoint.

### 7.2 Confirm tunnel from the VPS

On the VPS:

```bash
sudo wg show
ping -c 3 10.8.0.2
```

You want a recent **handshake** and successful ping.

### 7.3 Enable RouterOS REST (v7+)

Create a dedicated user (example):

```routeros
/user group add name=wifihub policy=read,write,api,rest-api,!local,!telnet,!ssh,!ftp,!reboot,!sensitive
/user add name=wifihub group=wifihub password="choose-a-strong-password"
```

Enable www / www-ssl as needed. Prefer restricting management to the WireGuard network.

Test **from the VPS**:

```bash
curl -u 'wifihub:YOUR_PASSWORD' http://10.8.0.2/rest/system/resource
```

You should get JSON (board name, version, etc.). If this fails, fix WireGuard/REST before continuing.

---

## 8. Wire WiFiHub to the router (admin UI)

1. Open `https://wifi.yourcompany.com/login` and sign in.
2. Go to **MikroTik setup wizard** (`/router/setup`) or **Routers / Hotspots**.
3. Save equipment with:
   - **Host:** `10.8.0.2`
   - **User / password:** same as RouterOS user
   - **Port:** `80` (or `443` if using www-ssl)
4. Attach the router to your hotspot.
5. Click **Test link** / **Test connection** → status should show **MikroTik connected**.

Also ensure on the VPS `.env.local`:

```env
ROUTER_ADAPTER=mikrotik
```

Then:

```bash
sudo systemctl restart wifihub
```

---

## 9. Captive portal (MikroTik → WiFiHub)

Customers must land on your portal **with their MAC** in the query string.

Example login redirect (adjust slug):

```text
https://wifi.yourcompany.com/portal/YOUR-HOTSPOT-SLUG?mac=$(mac)
```

In MikroTik Hotspot **Login** / walled garden:

1. Allow the portal domain through the walled garden (`wifi.yourcompany.com`).
2. Set the login page / redirect to the URL above (or a small local login.html that redirects there).
3. After pay/voucher, WiFiHub calls REST to add an IP binding for that MAC (fail-closed).

**Lab without captive portal yet:** open the portal URL and paste the phone’s Wi‑Fi MAC manually — the portal UI supports that when `ROUTER_ADAPTER=mikrotik`.

---

## 10. Supabase migrations (if not done)

In Supabase → **SQL Editor**, run in order:

1. `supabase/migrations/001_admin_profiles.sql`
2. `002_hotspots_packages.sql`
3. `003_remaining_schema.sql`
4. `004_payment_client_mac.sql`
5. `005_payment_fulfillment.sql`

Create the operator in **Authentication → Users**, then log in to WiFiHub.

---

## 11. Go-live test plan (do this before real money)

Keep `PAYMENT_MODE=mock` until step 4 passes.

1. Phone joins café SSID → captive portal opens with MAC.
2. Redeem a **voucher** (or mock pay).
3. Phone gets internet; hotspot card shows connected; MikroTik shows IP binding / active host.
4. From admin **Devices**, revoke → phone loses access.
5. Only then set:

```env
PAYMENT_MODE=paystack
PAYSTACK_SECRET_KEY=sk_live_...
PAYSTACK_PUBLIC_KEY=pk_live_...
# Usually the same as the secret key (Paystack signs with it)
PAYSTACK_WEBHOOK_SECRET=sk_live_...
APP_URL=https://wifi.edumatetechnologies.com
```

```bash
sudo systemctl restart wifihub
```

Paystack dashboard → **Settings → API Keys & Webhooks** → Webhook URL:

```text
https://wifi.edumatetechnologies.com/api/payments/webhook
```

Events needed: **charge.success** (Paystack will POST; WiFiHub verifies HMAC, writes `payment_callbacks` + marks `payments.status=success`, creates `device_sessions`, then unlocks MikroTik).

Callback / site URL must match `APP_URL` (`…/api/payments/callback`).

**Paid-user guarantee:** if Paystack reports success, the payment row is never marked `failed`. Unlock problems show “Paid / unlock pending” with a retry button — the customer is not sent to the failed page.
---

## 12. Day-two operations

| Task | Command / place |
|------|------------------|
| App logs | `sudo journalctl -u wifihub -f` |
| Nginx logs | `sudo tail -f /var/log/nginx/error.log` |
| WireGuard status | `sudo wg show` |
| Restart app | `sudo systemctl restart wifihub` |
| Renew TLS | Certbot timer (automatic) |
| Deploy code | `git pull && npm ci && npm run build && sudo systemctl restart wifihub` |

Back up:

- `/var/www/wifihub-gh/.env.local`
- `/etc/wireguard/wg0.conf` and keys
- MikroTik export (`.rsc`)

---

## 13. Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `wg show` — no handshake | UDP 51820 blocked, wrong keys, wrong VPS IP | Check cloud firewall + UFW; re-check keys; `endpoint-address` = public VPS IP |
| Ping `10.8.0.2` fails | Peer AllowedIPs / MikroTik address missing | Confirm `10.8.0.2/32` on `wg-wifihub` |
| REST curl fails | www not enabled, wrong password, firewall on router | Enable REST user; allow from `10.8.0.1` |
| Test link offline in UI | App still using `192.168.1.1` or mock mode | Set host to `10.8.0.2`, `ROUTER_ADAPTER=mikrotik`, restart |
| Pay OK but no internet | No MAC / binding failed | Portal must pass `?mac=`; check app logs for authorize errors |
| Portal not opening | Walled garden / DNS | Allow domain in hotspot walled garden; test DNS on phone |

---

## 14. Security reminders

- Never commit `.env.local` or WireGuard private keys to Git.
- Use a dedicated MikroTik user with only the rights WiFiHub needs.
- Prefer REST over WireGuard only (do not expose RouterOS www to the public internet).
- Restrict SSH to your IP when possible.
- Rotate Paystack and Supabase keys if they ever leak.

---

## Quick reference — IPs and ports

| Role | Address / port |
|------|----------------|
| VPS public | `YOUR_VPS_IP` |
| WireGuard VPS | `10.8.0.1/24` UDP `51820` |
| WireGuard MikroTik | `10.8.0.2/32` |
| WiFiHub app | `127.0.0.1:3000` |
| Public site | `https://wifi.yourcompany.com` |
| Router host in WiFiHub | `10.8.0.2` |

---

## Done when

- [ ] Droplet up; firewall allows 22, 80, 443, UDP 51820  
- [ ] `wg show` shows handshake with MikroTik  
- [ ] `curl` REST to `10.8.0.2` works from VPS  
- [ ] `https://your-domain/login` works  
- [ ] Hotspot linked; Test link = **MikroTik connected**  
- [ ] Voucher unlocks a real phone  
- [ ] (Optional) Paystack live after unlock proven  

If you get stuck on one section (WireGuard vs Nginx vs captive portal), fix that layer first — each step above depends on the previous one.

---

## 15. After the VPS is live (production minus Paystack)

Your cloud is up. Finish the **site** side, then use vouchers / test checkout until Paystack is ready.

### On the VPS `.env.local` (already typical)

```env
APP_URL=https://wifi.edumatetechnologies.com
PAYMENT_MODE=mock
ROUTER_ADAPTER=mikrotik
# MikroTik host/user/password → set in the WiFiHub wizard UI, not required in env
```

Redeploy after code updates:

```bash
cd /var/www/wiffihub
git pull
npm ci
npm run build
systemctl restart wifihub
```

### In WiFiHub (browser)

1. Sign in at `/login` (Supabase operator user).
2. Create **Hotspot** (name, SSID, address).
3. **MikroTik wizard** → paste WireGuard script on the router → save host `10.8.0.2` + API user/password → **Test** → Online.
4. Create **packages** (and optional vouchers).
5. Print **portal QR**; set MikroTik captive redirect to  
   `https://wifi.edumatetechnologies.com/portal/YOUR-SLUG?mac=$(mac)`  
   plus walled garden for that domain (+ Paystack later).
6. Test with a **voucher** on a real phone before enabling Paystack.

### Keep for later (not required for go-live unlock)

- `PAYMENT_MODE=paystack` + live keys + webhook  
- Bandwidth simple queues are applied on unlock when speed profiles look like `10Mbps`  
- Session expiry auto-revoke (preferred): Supabase `pg_cron` → Edge Function → this VPS:

```bash
# 1) On VPS .env.local
CRON_SECRET=long-random-string

# 2) Supabase function secrets + deploy
supabase secrets set WIFIHUB_APP_URL=https://wifi.edumatetechnologies.com
supabase secrets set WIFIHUB_CRON_SECRET=long-random-string
supabase functions deploy expire-sessions

# 3) SQL editor: run supabase/migrations/008_expire_sessions_cron.sql
#    (needs Vault secrets project_url + service_role_key, same as other jobs)
```

Every 5 minutes the job POSTs `/api/cron/expire` so MikroTik IP bindings are removed on the VPS. Sessions also expire when you open Dashboard / Sessions.

- Health check: `https://wifi.edumatetechnologies.com/api/health`  
- Optional receipts: `RESEND_API_KEY` + `EMAIL_FROM`  
- Router passwords encrypt at rest when `ROUTER_PASSWORD_SECRET` (or service role key) is present  
- **No subscription auto-renew** — monthly plans expire at period end and access is cut off  
