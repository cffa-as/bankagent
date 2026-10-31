# Vaultline brand direction

Status: provisional product brand for the `bankagent` repository.

## Name

**Vaultline** means a protected line between a user's intent and a bank's execution system. The name is short in English, works in a GitHub repository header, and supports a security focused visual identity without sounding like a consumer finance app.

## Mark

The primary mark is a **hexagonal security seal**. Its outer shape signals an institutional control boundary; the three internal lines represent intent, review, and authorization; the short cobalt segment marks the final controlled gate. It is compact, recognizable at small sizes, and works as both a product logo and a demo cover image.

The primary asset is [`public/vaultline-mark.svg`](public/vaultline-mark.svg). The presentation asset is [`public/brand/vaultline-brand-hero.png`](public/brand/vaultline-brand-hero.png). Alternative geometric studies live in [`public/brand/`](public/brand/).

## Visual direction

- Product character: regulated financial institution, private banking terminal, calm under risk.
- Base: cold porcelain white, platinum gray, deep navy.
- Accent: restrained cobalt blue.
- Status: amber for explicit confirmation, red for MFA or high sensitivity, green for read only or validated states.
- Type: Noto Sans SC / PingFang SC for Chinese, Space Grotesk for Latin, JetBrains Mono for IDs and technical labels.
- Surfaces: flat, 1px steel borders, 4–8px radius, deliberate whitespace.

## Avoid

Purple AI gradients, neon glow, glassmorphism, crypto dashboard patterns, warm paper themes, oversized rounded cards, and decorative locks that do not carry product meaning.

## v0 instruction

Use Vaultline as the product brand. Read this file and `bankagent-frontend/SKILL.md` before generating UI. Build visual variations on the homepage first. Keep the interactive demo synthetic and clearly labeled; do not turn the demo into a real banking workflow or modify `backend/` and `docs/`.
