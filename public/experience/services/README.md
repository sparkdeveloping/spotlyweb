# Spotly service illustration family

Decorative product illustrations for Home, service entrances, First Access and Search. These are not merchant photographs, inventory, maps or evidence of service availability. Approved logo artwork remains at `/api/branding/assets/` and is never baked into these illustrations.

Created using the built-in image-generation workflow on 30 October 2026. Book and Live were integrated on 31 October 2026 with more recognizable appointment and event imagery. Original transparent PNGs were encoded as WebP at 320px and 640px, preserving alpha. No original image is fetched at runtime. The 320px family totals 126,106 bytes; each 640px entrance asset is below 80,000 bytes. See the automated asset and contrast checks in `tests/premium-experience-2026.test.mjs`.

## Production prompt set

The following common prompt was used for each separate asset:

> Use case: stylized-concept. Asset type: production illustration for Spotly's premium digital product experience. Create ONE refined sculptural 3D product still life, square composition, actual transparent alpha background. Cohesive art direction: contemporary industrial design meets a warm Zimbabwe-first everyday super-app, tactile glazed ceramic, satin resin and tiny brushed-metal details, believable sophisticated physical materials, precise bevels, cinematic soft studio light from upper left, subtle contact shadow only. Three-quarter orthographic camera, complete central subject framed with 12% clear margin, beautifully legible silhouette at 160px, composition fills most of the square. Gallery-quality minimal design, considered rather than toy-like, no visual clutter. No text, no lettering, no logos, no watermark, no backdrop or ground plane.

Each asset added its own subject brief:

- **bite:** Subject: an inviting warm orange glazed ceramic bowl holding one elegantly curled cream-colored pasta ribbon with a few sculptural red tomato halves and two deep green basil leaves, a small brushed-metal fork resting diagonally beside the bowl. Color emphasis official Spotly Bite #FF8A00 with warm cream and restrained tangerine highlights. Sensory, rich, warm, elegant.
- **shopper:** Subject: a structured fresh mint green reusable shopping tote, thick rolled handles, a cream rectangular package and one glossy green apple rising from its opening, a small pale mint cylinder beside it. Color emphasis official Spotly Shopper #10C981, warm ivory and a tiny soft violet accent. Tactile, organized, beautifully simple.
- **ride:** Subject: a continuous flowing cobalt blue ribbon bent into a graceful elevated road with one sweeping banked curve and two small brushed silver lane lines; a compact unbranded silver-blue car riding the curve. A single small blue polished spherical destination marker. Color emphasis official Spotly Ride #2F80FF and cool pearl. Dynamic spatial intelligence, confidence, clean controlled geometry, not a city diorama.
- **send:** Subject: a softly beveled lavender parcel cube wrapped with one semi-transparent lilac band, with a sculptural violet curved route ribbon floating gracefully around it and ending in one small polished sphere. Tiny pearl metal corner detail. Color emphasis official Spotly Send #A855F7 and soft lilac. Precise, reliable, premium parcel movement.
- **book (replacement art direction):** A violet and warm-ivory standing appointment calendar, two substantial purple binding loops, a highlighted appointment tile with a brushed-metal check, and a clear analog clock leaning at the lower right. Color emphasis official Spotly Book #7C3AED. Sculptural glossy ceramic and restrained warm metal; unmistakable appointments and time, no text or numbers.
- **live (replacement art direction):** A saturated pink admission ticket with unmistakable notched edges, a perforated stub and raised pearl star, accompanied by a microphone and two pink spotlights. Color emphasis official Spotly Live #FF2D6F with pearl and restrained warm metal. Sculptural studio rendering with an energetic diagonal silhouette; unmistakable events and performances, no text or lettering.

## Integration contract

`ServiceArtwork` reserves intrinsic dimensions, selects the small tile variant where appropriate, lazy-loads ordinary assets, and supplies a deterministic glyph fallback on failure. Images are static at rest. Fine-pointer hover responses are CSS transforms with a reduced-motion alternative. No WebGL, extra runtime library or additional Firebase query is introduced.
