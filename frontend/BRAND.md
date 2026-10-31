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
- Type: Noto Sans SC / PingFang SC for Chinese, Instrument Sans for English, JetBrains Mono for amounts and evidence IDs.
- Surfaces: thin steel borders, small radii, restrained shadows.

Green/teal, amber and red always pair color with text or an icon. Success is shown only when the server returns a business receipt.

## Avoid

Purple AI gradients, neon effects, glassmorphism, oversized rounded cards, fake terminal chrome, decorative security icons, and any visual that implies authorization or success without server evidence.
