# Vaultline brand direction

Status: selected product identity for `bankagent`.

## Name

**Vaultline** is the protected line between a user's intent and the bank's execution system.

## Mark

The selected identity is **Reserve**:

- deep navy circular seal;
- white V-shaped channel;
- one cobalt execution marker;
- tightly tracked `VAULTLINE` wordmark in Instrument Sans Bold.

Canonical implementation: [`components/vaultline/seal.tsx`](components/vaultline/seal.tsx). App icon: [`app/icon.svg`](app/icon.svg).

## Visual system

- Base surfaces: platinum `#F7F9FC`, cool surface `#F1F4F8`, ice `#EAF0FF`.
- Structure and primary text: reserve navy `#0B1423`.
- Primary action: execution cobalt `#315BFF`.
- Read-only and verified evidence: teal `#2AA88A`.
- Explicit confirmation: amber `#D29A3D`.
- MFA and high-risk states: red `#C8574F`.
- Type: Noto Serif SC for major statements, Noto Sans SC / PingFang SC for product UI, Instrument Sans for the wordmark, JetBrains Mono for amounts and evidence IDs.
- Surfaces: thin steel borders, small radii, restrained shadows.

Green/teal, amber and red always pair color with text or an icon. Success is shown only when the server returns a business receipt.

## Product-film grammar

- The homepage opens as a navy banking control surface, not a generic SaaS landing page.
- A single control line connects intent, server decision, authorization and receipt.
- Real UI is shown as evidence. Do not replace it with fabricated dashboards or a stack of equal feature cards.
- Motion should reveal a real state change or guide the eye through the control line. Avoid per-card fade-ins and decorative AI loops.
- README uses the Vaultline lockup, version badges, one product-film cover and concise evidence-led copy.

## Avoid

Purple AI gradients, neon effects, glassmorphism, oversized rounded cards, fake terminal chrome, decorative security icons, and any visual that implies authorization or success without server evidence.

Use the repository skills [`frontend-design`](../.agents/skills/frontend-design/SKILL.md) and [`web-design-guidelines`](../.agents/skills/web-design-guidelines/SKILL.md) when shaping or reviewing a new surface.
