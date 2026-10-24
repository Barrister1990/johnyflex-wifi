---
site: LaunchKit (demo)
url: https://launchkit-demo.getdesign.md/
https://getdesign.md/design-md/amplemarket?category=productivity-saas
category: AI agent / social media scheduling SaaS
note: >
  This is an INFERRED design reference built from the page's visible
  structure and content, not a scraped CSS/token export. Exact hex values,
  font-family names, and pixel measurements are best-effort approximations
  based on common patterns for this style of product (AI-agent SaaS,
  dashboard-forward marketing site). Verify final values against the live
  rendered site before shipping production UI.
---

# LaunchKit — DESIGN.md

## 1. Brand Personality

A calm, confident "agent does the work" SaaS aesthetic — dashboard-forward,
data-dense but uncluttered. Product screenshots (calendar, agent chat,
analytics) are the hero, not illustration. Copy is short and benefit-led
("Hand your social calendar to an agent"). Trust is built through logos
(NVIDIA, Google, Shopify, Airbnb, Netflix, Spotify) and a marquee of
testimonials rather than heavy claims.

Tone: modern, technical-adjacent, quietly premium. Not playful, not
enterprise-stiff — closer to Linear/Vercel-style restraint than a
consumer app.

## 2. Color System

Light theme primary, with an implied dark mode toggle (mentioned in the
kit's feature list). No saturated brand color dominates the marketing
copy — the UI itself provides color via channel logos and chart accents.

| Token | Approx. Value | Usage |
|---|---|---|
| `--bg-canvas` | `#FFFFFF` | Page background |
| `--bg-surface` | `#F7F7F8` / `#F4F5F7` | Card backgrounds, dashboard panels |
| `--bg-inset` | `#EDEEF1` | Nested panels, input fields |
| `--text-primary` | `#0F1115` | Headlines, body copy |
| `--text-secondary` | `#5B5F6A` | Supporting copy, captions |
| `--text-muted` | `#8A8F98` | Metadata (dates, labels like "REACH BY CHANNEL") |
| `--border-subtle` | `#E4E5E9` | Card borders, dividers |
| `--accent-primary` | `#111827` (near-black) or a single indigo/violet, e.g. `#5B5FEF` | Primary CTA buttons ("Start free") |
| `--accent-success` | `#16A34A`-ish green | Positive deltas ("+18%", "+6 this week") |
| `--chart-1..5` | Multi-hue set (blue, magenta, teal, amber, violet) | Reach-by-channel bar segments, matching channel brand colors (Instagram, X, LinkedIn, TikTok) |

Channel/brand logos (Instagram, X, LinkedIn, TikTok, YouTube) and payment
logos (Stripe, Lemon Squeezy, Polar, Dodo) are used full-color and
unmodified — the palette otherwise stays neutral so these marks pop.

## 3. Typography

Single sans-serif family throughout, no serif or display face.
Best-fit stack:

```
font-family: "Inter", "SF Pro Text", -apple-system, BlinkMacSystemFont,
  "Segoe UI", sans-serif;
```

| Role | Size (approx) | Weight | Notes |
|---|---|---|---|
| Hero H1 | 44–56px | 600–700 | Tight line-height (~1.05–1.1), e.g. "Hand your social calendar to an agent." |
| Section H2 | 28–34px | 600 | e.g. "Everything your posts need, from draft to publish." |
| Eyebrow label | 12–13px | 600, uppercase, letter-spacing +0.04em | "Features", "Marketplace", "Testimonials" |
| Card title | 17–19px | 600 | "Every channel at a glance" |
| Body | 15–16px | 400 | Line-height ~1.6 |
| Small / metadata | 12–13px | 500 | Timestamps, "$29.00", channel %s |
| Metric number | 28–32px | 700 | Dashboard stat values ("38", "128k", "4.6%") |

## 4. Spacing & Layout

- 12-column responsive grid, max content width ~1200–1280px, generous
  side gutters (24px mobile, 64–96px desktop).
- Section vertical rhythm: large — roughly 96–120px between major
  sections (Hero → Trusted-by → Features → Content → Marketplace →
  Blog → Agent → Pricing → FAQ → Footer).
- Card padding: 20–24px internal, 12–16px border-radius.
- Consistent 8px base spacing scale (8 / 12 / 16 / 24 / 32 / 48 / 64 / 96).

## 5. Components

**Navigation bar** — logo left, center or right-aligned links (Home,
Pricing, Docs, Blog, About, Contact), language switch (EN/ES), then
Sign in (ghost/text button) + Sign up (filled button) on the far right.

**Primary button** — filled, dark or single-accent background, white
text, 8–10px radius, medium padding (`~10px 20px`). Used for "Start
free", "Buy post · $29.00".

**Secondary button** — outline or ghost style ("See pricing", "Sign in").

**Dashboard card / widget** — white surface, subtle 1px border, soft
shadow (`0 1px 2px rgba(0,0,0,0.04)`), rounded corners (~12–16px). Used
repeatedly for: stat tiles (Scheduled / Reach / Engagement), the agent
chat composer, the semantic search panel, the notes/campaigns sidebar,
and the media-upload dropzone.

**Metric tile** — large bold number, small label above, small delta
badge below in green/red pill (`+18%`, `+6 this week`).

**Chat / agent composer** — rounded input pill with model-picker
dropdown (Claude Sonnet ▾ with provider logos: OpenAI, Anthropic,
Gemini), placeholder prompt text, up-arrow submit button, and a
"SOURCES" chip row (`brand-voice`, `past-posts`) beneath the response.

**Search panel** — pill input with `⌘K` shortcut hint, results list
showing a percentage match score, source channel, and stat line.

**Pricing table** — 3-tier card layout (Starter / Pro "Most popular" /
Business), monthly–yearly toggle with a "2 months free" badge, feature
checklist with checkmarks, single CTA per card. Below it, a flat
comparison table with row-per-feature and a check/em-dash pattern for
plan differences.

**Testimonial card** — quote in slightly larger/italic-leaning body
text, avatar + name + title beneath, arranged in a horizontal
auto-scrolling marquee (duplicated content loop, seen twice in the
fetch).

**Logo marquee** — grayscale-to-color or full-color logo row, looping
horizontally, used both for "Trusted by" and payment-provider badges.

**FAQ** — accordion list, question as clickable header, plain-text
answer, no icons beyond an expand affordance.

**Footer** — 4-column layout: brand blurb + copyright far left,
"Product" and "Resources" link columns, legal links (Terms/Privacy)
and a "Template from getdesign.md" attribution line at the very bottom.

**Cookie banner** — bottom-fixed bar, plain text + Decline/Allow button
pair, minimal styling.

## 6. Iconography

Simple geometric line/glyph icons for the in-page dashboard sidebar
(Overview ◇, Calendar ▤, Agent ◐, Search ⌕, Settings ◧) — abstract
shape-based marks rather than a standard icon library look, reinforcing
the "product-inside-a-product" mockup framing.

## 7. Imagery

No photography-led hero; the "image" is a live product screenshot
(dashboard mock with real-looking data — "Good morning, Alex.",
channel logos, chart). Blog and testimonial sections use small
avatar photography (headshots) only.

## 8. Motion (inferred)

Marquee/logo strips auto-scroll continuously (seen duplicated 4x in
the fetched content, implying a seamless CSS/JS loop). Likely subtle
fade/slide-in on scroll for section reveals, standard for this template
family — not confirmed from static content alone.

## 9. Responsive Behavior (inferred)

- Desktop: multi-column feature grids (2–3 col), sidebar+content
  dashboard mock shown at full width.
- Tablet/mobile: single-column stacking, nav collapses to a hamburger
  (not directly observed, but standard for this component set), pricing
  cards stack vertically, comparison table likely becomes horizontally
  scrollable.

---

### Confidence notes

- **High confidence:** section order, component inventory, copy tone,
  overall layout rhythm — all directly observed in the fetched page.
- **Low confidence / estimated:** exact hex codes, font family name,
  precise pixel sizes, motion/transition timing — these were not
  present in the fetched markdown (no CSS was returned) and are
  reasonable inferences based on the visual style of comparable
  AI-agent SaaS sites, not measured values.

For pixel-accurate tokens, use browser devtools on the live site, or
purchase the official private DESIGN.md via `getdesign.md/request`.
