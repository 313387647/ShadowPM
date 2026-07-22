# ShadowPM Iconography

## Brand Mark

ShadowPM uses a single-color geometric mark: a layered control path inside a compact hexagonal frame. It represents structured information moving from source material into an auditable control space.

- Use `BrandMark` for application identity, not Lucide icons or a letter mark.
- Keep the mark single-color. Do not add gradients, glow, outlines, or status colors.
- The mark is decorative when used next to the written name. It is `aria-hidden` by design.
- Standard sizes: `28px` in compact headers, `32px` in the sidebar, `44px` on authentication screens.

## Icon Set

Use Lucide only for product UI icons. Icons clarify a familiar action or category; they do not decorate text.

- Default: `16px`, `stroke-width` inherited from Lucide, muted foreground.
- Compact controls: `14px`.
- Navigation: `16px`; current destination may use the primary color.
- Never mix filled icon families, emoji, custom pictograms, or multiple icons for one action.
- Use `aria-hidden="true"` for icons beside readable text. Icon-only controls require an `aria-label` and a tooltip or `title`.

## Semantic Color

- `primary`: current location, primary action, keyboard focus, trusted AI entry.
- `success`, `warning`, `destructive`: business state only, always accompanied by text.
- Ordinary icons inherit muted or foreground color. Do not make every icon blue.

## Interaction Rules

- One action, one icon. Prefer text for unfamiliar or consequential actions.
- Hover changes surface or text contrast, not the icon shape.
- Icons in rows must not create duplicate clickable targets; use the row or the named action as the primary target.
- Use a meaningful Lucide icon only when it reduces scanning time. Otherwise omit it.
