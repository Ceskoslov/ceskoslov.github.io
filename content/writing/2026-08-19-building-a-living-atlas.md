+++
title = "Building a Living Atlas"
date = 2026-08-19
description = "Birth of contours."
draft = false

[taxonomies]
tags = ["Techs", "Designs"]

+++

Starting with commit `eab60e3`, the site moved away from being a mostly static editorial layout and gradually became a small, living atlas. The first experiments used separate map fragments, but those pieces eventually felt too literal and too disconnected from the rest of the page. The better idea was to treat the terrain as an atmospheric system rather than an isolated animation.

## Terrains

The current background is generated once per browser session from a seed stored in `sessionStorage`. A seeded random generator places multiple peaks and basins, then combines them with warped sine fields and several high-frequency folds. This produces denser, less symmetrical contours while keeping the same terrain stable as the reader moves between pages.

The seed logic is deliberately small. `>>> 0` normalizes the stored value to an unsigned 32-bit integer, while `crypto.getRandomValues` creates a new composition only when the session has no seed. This is the core path; the implementation also catches unavailable browser storage and has a time-based fallback:

```javascript
const key = 'chaos-contour-seed-v1';
let seed = Number(sessionStorage.getItem(key)) >>> 0;

if (!seed) {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  seed = values[0] || 1;
  sessionStorage.setItem(key, String(seed));
}
```

Each hill is a Gaussian contribution. Positive strength creates a peak and negative strength creates a basin; the surrounding sine fields bend these clean radial forms into less predictable ridges:

```javascript
const isBasin = index % 4 === 3 || (index > 13 && random() > 0.55);
hills.push({
  x: (column + 0.16 + random() * 0.68) / 6,
  y: (row + 0.14 + random() * 0.72) / 3,
  radius: 0.035 + random() * 0.09,
  strength: isBasin
    ? -(0.25 + random() * 0.42)
    : 0.34 + random() * 0.62
});

// During field sampling:
hills.forEach(function (hill) {
  const dx = warpedX - hill.x;
  const dy = warpedY - hill.y;
  value += hill.strength * Math.exp(
    -(dx * dx + dy * dy) / (2 * hill.radius * hill.radius)
  );
});
```

The renderer uses a full-device-resolution WebGL canvas fixed behind the document. Its fragment shader quantizes elevation into bands, draws configurable contour intervals, and applies local displacement around the pointer. A red survey grid appears near the cursor, while its central meridian and parallel continue across the viewport. A two-dimensional canvas implementation remains as a fallback.

The contour itself is not stored as geometry. It is derived per pixel by measuring how close the normalized height is to the nearest interval:

```glsl
float density = max(u_contour_density, 12.0);
float levels = max(density * 0.68, 12.0);
float band = floor(height * levels) / max(levels - 1.0, 1.0);

vec3 color = mix(u_terrain_low, u_terrain_high, 0.16 + band * 0.72);
float contourDistance = abs(height * density - floor(height * density + 0.5));
float contour = 1.0 - smoothstep(0.03, 0.068, contourDistance);
color = mix(color, u_terrain_line, contour * 0.82);
```

This keeps the lines sharp at native screen resolution and allows contour density and palette values to change without rebuilding a mesh.

Scrolling does not move the canvas element itself. Instead, it changes the sampled terrain coordinates, creating a slow geological drift. The homepage also adjusts contour density through its scroll progression. Page-specific profiles control intensity: the homepage is expressive, indexes are quieter, and articles use the weakest treatment.

The main page profiles can be condensed to the following:

```javascript
const profile = isHome
  ? { drift: 0.18, density: 24 }
  : isPost
    ? { drift: 0.06, density: 21 }
    : { drift: 0.10, density: 24 };

const progress = clamp(window.scrollY / scrollHeight, 0, 1);
scrollTargetY = (progress - 0.5) * profile.drift;
scrollTargetX = Math.sin(progress * Math.PI * 2) * profile.drift * 0.1;
```

These are target values rather than direct render values. The animation frame interpolates toward them with `lerp`, preventing wheel and trackpad events from producing visible jumps.

## Visuals

The palette was rebuilt around mineral paper, charcoal ink, blue-grey terrain, and oxide-red survey marks. These colors are exposed as CSS custom properties and have corresponding dark-mode values. Article bodies sit on a high-opacity paper layer, and pointer interaction is disabled over the main reading column so that the map never competes with long-form text.

The homepage Hero now reads directly from `about.md`, making the profile visible without duplicating its source. The former multilingual headline survives as small cartographic specimens. At the bottom of the page, the three questions—*D'où venons-nous? Que sommes-nous? Où allons-nous?*—are revealed by a replayable survey scan built on the existing intersection observer.

Zola's template API makes the About page the single source of truth:

{% raw %}
```jinja2
{% set about = get_page(path="about.md") %}
<p class="eyebrow">{{ about.extra.kicker }}</p>
<div class="hero__profile">
  {{ about.content | safe }}
</div>
```
{% endraw %}

Because the scan section uses the same `data-atlas-reveal` observer as the headings, leaving the viewport removes its revealed state and entering it again replays the animation without another event system.

The same language now reaches the smallest identity elements. The header mark and adaptive SVG favicon use irregular closed contours, offset survey axes, registration corners, and a single red datum point rather than a literal initial.

Reduced-motion preferences freeze the terrain and remove scan animations, touch input avoids pointer-following effects, and print styles remove the atlas entirely. On post pages, pointer movement inside `.post-content` explicitly clears the interaction, so the red grid and coordinate readout fade before they can obstruct the text.

The result is not simply a decorative background: it is a shared coordinate system for the whole site, designed to remain present without obstructing the writing.
