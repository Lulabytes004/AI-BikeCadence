BIKE CADENCE VISION v0.2 — iPhone HTTPS prototype

1. Deploy the contents of this folder to any static HTTPS host (GitHub Pages, Netlify, Vercel, Cloudflare Pages, etc.).
2. Open the resulting https:// URL in Safari on the iPhone.
3. Tap “Iniciar cámara” and allow camera access.
4. Put the iPhone approximately side-on to the cyclist so hip, knee and ankle are visible.

IMPORTANT: opening index.html directly from Files (file://) is not a secure web context and iOS will not expose getUserMedia().

The page now displays diagnostics for HTTPS/security context, camera API availability, permission errors and MediaPipe startup.
