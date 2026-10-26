# Geist (bundled fonts)

The v2 typeface, the same release the web uses (RN-SPEC-v2-foundation §2: "the SAME files on web and native").

- Source: https://github.com/vercel/geist-font release **1.8.0** (`geist-font-1.8.0.zip`, `fonts/Geist/ttf/`), static TTFs.
- Why 1.8.0: web pins `@fontsource/geist@5.3.0`, whose files report **Version 1.800** (name table) and were built on
  2026-05-13. Release 1.8.0 (2026-03-03) is the release with Version 1.800 before that date (1.8.1+ is 1.801).
  iOS and Android can't load woff2, so native takes the TTF build of the same release.
- Licence: SIL Open Font License 1.1, see `OFL.txt` (shipped with the app as the licence requires).
- Weights: 400 / 500 / 600 / 700 only (no 900). File name = PostScript name, which is also the `fontFamily` name
  on both platforms (embedded at build time by the `expo-font` config plugin; changing these needs a dev-client rebuild).

| File | PostScript name | SHA-256 |
|---|---|---|
| `Geist-Regular.ttf` | `Geist-Regular` | `bde046ddd9f20be35b0bd56cc79eb752b967fb6661a3fe76cb067bb09f871d76` |
| `Geist-Medium.ttf` | `Geist-Medium` | `0df231732ab7454ba3315d2878e145080d7f4ee92827a8d469bdd66e459ee48b` |
| `Geist-SemiBold.ttf` | `Geist-SemiBold` | `097409e9fabf676be0764b47297c2cdab3750e84dc0f575298c7fbd45f3b3819` |
| `Geist-Bold.ttf` | `Geist-Bold` | `dfdc2884902716223465a2815ef4599d84df0a155078433b863b19fcb2c7f820` |
