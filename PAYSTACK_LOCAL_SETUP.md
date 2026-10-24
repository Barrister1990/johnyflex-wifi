# Paystack local setup (ngrok + MikroTik)

Use this **after** portal unlock works with mock payments.  
Goal: real Paystack checkout + webhook → Supabase payment row → MikroTik unlock — still on your laptop.

---

## Architecture (local)

```text
Phone on Luks Ventures Wiffi
        ↓
WiFiHub portal (ngrok HTTPS)
        ↓
Paystack Checkout (test or live)
        ↓
  ┌─────┴─────┐
  │           │
callback   webhook
  │           │
  └─────┬─────┘
        ↓
confirmPaymentByReference
        ↓
Supabase: payments + payment_callbacks + device_sessions
        ↓
MikroTik unlock (MAC + speed queue)
```

Both **callback** (browser return) and **webhook** (`charge.success`) call the same fulfillment. A paid user is never marked failed after Paystack confirms success.

---

## 1. Paystack Dashboard — get keys

1. Open [https://dashboard.paystack.com](https://dashboard.paystack.com)  
2. Prefer **Test mode** first (toggle in the dashboard)  
3. **Settings → API Keys & Webhooks**  
4. Copy:
   - **Secret Key** → `sk_test_…` (or `sk_live_…` later)
   - **Public Key** → `pk_test_…` (optional for now; initialize uses secret on server)

---

## 2. Keep ngrok running

```powershell
npx ngrok http 3000
```

Note the HTTPS URL, e.g.:

```text
https://186c-154-160-25-38.ngrok-free.app
```

If ngrok restarts, the host **changes** — update `.env.local`, Paystack webhook, MikroTik `login.html`, and walled garden.

---

## 3. Configure `.env.local`

```env
APP_URL=https://YOUR_CURRENT_NGROK.ngrok-free.app
PAYMENT_MODE=paystack
PAYSTACK_SECRET_KEY=sk_test_xxxxxxxx
PAYSTACK_PUBLIC_KEY=pk_test_xxxxxxxx
# Paystack signs webhooks with your secret key (HMAC SHA512)
PAYSTACK_WEBHOOK_SECRET=sk_test_xxxxxxxx
```

Use the **same** value for `PAYSTACK_SECRET_KEY` and `PAYSTACK_WEBHOOK_SECRET` unless Paystack gives you a separate webhook secret.

Restart the app:

```powershell
# Ctrl+C then:
npm run dev
```

Check Settings in WiFiHub (or):

```text
GET http://localhost:3000/api/health
```

`paymentMode` should be `paystack`.

---

## 4. Register the webhook in Paystack

**Settings → API Keys & Webhooks → Webhook URL:**

```text
https://YOUR_CURRENT_NGROK.ngrok-free.app/api/payments/webhook
```

Example with your current tunnel:

```text
https://186c-154-160-25-38.ngrok-free.app/api/payments/webhook
```

Save.  
You can also copy this from WiFiHub → **Settings** → Webhook URL.

Events used: **`charge.success`** (Paystack sends this; WiFiHub verifies signature + verifies the transaction).

---

## 5. MikroTik walled garden (phones must reach Paystack)

In MikroTik Terminal (keep your ngrok host allow rule too):

```routeros
/ip hotspot walled-garden
add dst-host=YOUR_CURRENT_NGROK.ngrok-free.app action=allow comment="WiFiHub ngrok"
add dst-host=*.ngrok-free.app action=allow comment="ngrok"
add dst-host=*.paystack.com action=allow comment="Paystack"
add dst-host=*.paystack.co action=allow comment="Paystack CDN"
```

Skip lines that say “already exists”.

---

## 6. Update captive `login.html` if ngrok URL changed

`hotspot/login.html` must point at the **current** ngrok host:

```html
https://YOUR_CURRENT_NGROK.ngrok-free.app/portal/luks-ventures?mac=$(mac)
```

Re-drag `Desktop\login.html` (or `public\mikrotik-login.html`) into Winbox → Files → `hotspot`.

---

## 7. End-to-end test

1. Phone joins **Luks Ventures Wiffi** → opens WiFiHub portal with `?mac=…`  
2. Pick a package → Pay  
3. You should land on **Paystack Checkout** (not instant mock success)  
4. Pay with a [Paystack test card](https://paystack.com/docs/payments/test-payments/), e.g.:
   - Card: `4084084084084081`
   - Expiry: any future date  
   - CVV: `408`  
5. After success:
   - Browser returns via `/api/payments/callback` → success page  
   - Paystack POSTs webhook → `payment_callbacks` + `payments.status=success`  
   - Session created → MikroTik unlock  

### Verify in Supabase
- `payments` → row `status = success`, `provider = paystack`  
- `payment_callbacks` → raw webhook/callback payload, `verified = true`  
- `device_sessions` → active session for that payment  

### Verify on MikroTik
```routeros
/ip hotspot ip-binding print
/queue simple print
```

### Watch webhook locally
ngrok inspector: [http://127.0.0.1:4040](http://127.0.0.1:4040) — look for `POST /api/payments/webhook` → `200`.

App logs:

```text
[paystack webhook] …
```

---

## 8. Common failures

| Symptom | Fix |
|--------|-----|
| Still mock (instant success, no Paystack page) | `PAYMENT_MODE` still `mock` — set `paystack`, restart `npm run dev` |
| `PAYSTACK_SECRET_KEY` error | Key empty or wrong in `.env.local` |
| Webhook 401 | Signature mismatch — `PAYSTACK_WEBHOOK_SECRET` must match secret key |
| Webhook never hits | Wrong URL in Paystack dashboard / ngrok URL changed |
| Phone can’t open Paystack | Add `*.paystack.com` / `*.paystack.co` to walled garden |
| Paid but no unlock | Missing `?mac=` in portal URL; fix `login.html` |
| Amount mismatch notify | Rare FX/rounding — app still fulfills; check owner notification |

---

## 9. Go live later (VPS)

When moving off ngrok:

```env
APP_URL=https://wifi.edumatetechnologies.com
PAYMENT_MODE=paystack
PAYSTACK_SECRET_KEY=sk_live_…
PAYSTACK_PUBLIC_KEY=pk_live_…
PAYSTACK_WEBHOOK_SECRET=sk_live_…
```

Paystack webhook:

```text
https://wifi.edumatetechnologies.com/api/payments/webhook
```

Run migration `005_payment_fulfillment.sql` on Supabase if not already applied.

---

## Checklist

- [ ] Paystack test keys in `.env.local`  
- [ ] `PAYMENT_MODE=paystack` + restart  
- [ ] `APP_URL` = current ngrok HTTPS  
- [ ] Paystack webhook URL = `{APP_URL}/api/payments/webhook`  
- [ ] Walled garden: ngrok + Paystack  
- [ ] `login.html` uses current ngrok + `?mac=$(mac)`  
- [ ] Test card pay → success page + session + unlock  
- [ ] Row in `payment_callbacks`  

---

**Next step for you:** paste your `sk_test_…` / `pk_test_…` into `.env.local` (never commit them), set `PAYMENT_MODE=paystack`, restart `npm run dev`, then register the webhook URL in the Paystack dashboard.
