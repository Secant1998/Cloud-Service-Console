# Private Cloud Model Library

## Simulator Selection Integration: 2026-11-11

The simulator's modern scene Agent now selects at most eight random eligible
matches per query, uses three rendered angles with model parameters, and can
request a bounded local wrist/gripper trial when contact suitability is uncertain.
PartNet eligibility temporarily requires a successfully published source-matching
preprocessing bundle, obtained through authenticated
`GET /api/model-library/preparation-status`. This is a generation-side policy,
not a filter on the console's browsing API.

The readiness route reports bundle keys, source descriptor hashes and recipes;
it does not certify task feasibility or guarantee that every task avoids local
preparation. The server snapshot has a 30-second cache, and the simulator caches
it for 60 seconds. Full contract and deployment details are in
[PARTNET_PREPROCESSING.md](PARTNET_PREPROCESSING.md).

The simulator's three-angle sheets are separate from server WebP thumbnails and
the interactive model viewer. They are generated/cached by the simulator, not
added as mandatory server resources for every catalog entry. The scene designer
may uniformly rescale a task instance with its existing size self-check and
interaction-opening constraints; MOPS midpoint dimensions remain the catalog's
default baseline.

## MOPS PartNet Dimensions: 2026-11-06

All 2,347 PartNet models now include `parameters.physical_scale` in both the
catalog index and `models.entry` in the hosted SQLite database. This stores the
official MOPS scale interval, its fixed arithmetic midpoint, source-frame
physical dimensions/ranges, and the pinned upstream revision. Raw source geometry
and model resources are retained so clients apply the scale exactly once.

At the time of this metadata migration, simulator scene preparation used that
midpoint as a fixed PartNet size. The current task-instance scaling policy above
supersedes that restriction without changing the catalog baseline or source
geometry. Previously compiled scenes keep their saved dimensions.

Metadata migration preserves all 5,920 entries, classifications and 495,413 file
records. Existing images are reused with hard links for the 2,267 available
affected thumbnail cache entries, avoiding duplicate image storage or rerenders.
The original index and databases are backed up under
`/opt/telebot-model-library/_metadata_backups/mops-20261105T173607828884Z`.
No backend restart was required. Live manifest checks passed for an oven, bottle
and window; full database verification found no remaining unapplied entries.

Deployment/audit: `reports/mops-catalog-midpoint-20261106/deployment.json`.
Migration commands: `scripts/model_scale_migration.py` and
`scripts/deploy_mops_scale_metadata.py` (dry-run unless `--apply` is supplied).

## Scoped Model Search: 2026-11-05

The homepage shows category cards when search and source are empty. Typing a
model name, ID (including a numeric PartNet ID), category or indexed keyword
returns individual model cards. Inside a category, search retains its exact
category and selected source; homepage model results can also be filtered by
source. Clearing only the query preserves a selected source. The back arrow
returns to category browsing; opening and closing a model detail preserves the
query, filters, page and scroll position. Both search modes use the existing
authenticated model-list API, without changing catalog data or classification.

Validation: frontend production build and local/online browser checks with
`--search --cards-only --skip-layout` (`--cloud-resources` for the local run).
The search check covers numeric/full IDs, category/source intersections, empty
results, source retention after clearing text, detail-return state and both
themes at desktop/mobile sizes. Screenshots and results are in
`build/model-library-qa/` and `build/model-library-online-qa/`. Static deployment
backup: `/opt/cloud-service-console-web/backups/web-assets-20261105T050451Z`;
no service restart or catalog mutation was required.

## Card Hover Compatibility: 2026-11-05

- Reproduced the black hover surface with the locally installed Dark Reader 4.9.134
  in an isolated browser profile. The extension replaced the transparent reflection
  gradient with an opaque `rgb(24, 26, 27)` background; the overlay became visible
  on hover. Removing the overlay restored real dishwasher thumbnails immediately.
- The highlight now paints in the card/preview backgrounds, below images. No
  full-card reflection pseudo-element remains. Seven-degree tilt, directional
  shadows, carousel crossfade, stable hit areas and reduced-motion handling remain.
  The previous speculative preview compositing workaround has been removed.
- `scripts/verify_model_card_hover.py --dark-reader` checks real thumbnail pixels
  in a disposable extension profile, without changing the user's browser settings.
  Screenshots and diagnostic records: `reports/model-card-hover-20261105/`.
- Frontend build and full card layout/tilt/carousel regressions passed, including
  mobile layouts, both themes and individual/category thumbnail pixels. Static
  assets were deployed with HTML rollback at
  `/opt/cloud-service-console-web/backups/web-assets-20261104T181244Z`.
  Hosted real-thumbnail tests also passed with Dark Reader active in both page
  themes, including hover corners and carousel advance. Backend processes and
  model resources were not changed.

## Deployment Record: 2026-11-04

- Transparent library heading/search deployed with rollback at
  `/opt/cloud-service-console-web/model-library-releases/20261104T132204Z/backup`.
  Removed the solid toolbar/search fills while retaining search borders and sticky
  positioning. Results are clipped below the measured toolbar edge so scrolled
  cards cannot show through the transparent heading. Card loading uses guarded
  clicks and `aria-disabled` to preserve restored focus during background refresh.
  The build and local layout, navigation, controls, tilt and carousel checks passed;
  online desktop/mobile light/dark checks confirmed transparent backgrounds, sticky
  controls, source menus and articulated badges. Screenshots and reports are in
  `build/model-library-qa/` and `build/model-library-online-qa/`.
- Articulated-card indicators and sticky catalog controls deployed with rollback at
  `/opt/cloud-service-console-web/model-library-releases/20261104T124810Z/backup`.
  Individual cards use the API `kind=articulated` field for a joint-link icon,
  hover/keyboard tooltip and accessible label; rigid and category cards stay unmarked.
  Category/model headings, search and source selection remain visible while scrolling.
  The model view suppresses the top fade, uses document scrolling on narrow screens,
  and measures toolbar height for card focus/scroll clearance. Build and local full
  card-layout checks passed; local and online checks verified light/dark themes,
  desktop/mobile scrolling, source-menu stacking, exact badge membership, tooltips,
  carousel lifecycle and hover-preview pixels. Evidence: `build/model-library-qa/`
  and `build/model-library-online-qa/`; repeat with the UI verifier's `--controls` flag.
  The original thumbnail prewarm service remains active without a restart.
- Object-identity taxonomy and separate detail attributes deployed with rollback at
  `/opt/cloud-service-console-web/model-library-releases/20261104T081134Z/backup`.
  Reassigned 503 reviewed models, reducing active categories from 213 to 116;
  559 entries carry subtypes and confirmed attributes. Bags contain 32 models
  (nine pencil cases); two ambiguous identities are in `needs_review` with reasons.
  A fruit-shaped Squirt toy was corrected into `toys` (244 total).
  All 67 backend tests and the frontend build passed. Local and online checks
  covered subtype/attribute search, preserved original-name search, detail metadata,
  mobile/desktop themes, pagination, category membership and hover/carousel behavior.
  Full cloud comparisons preserved all 5,920 original entries and 495,413 resource
  records; all 559 reviewed thumbnail keys remain unchanged. The original prewarm
  worker is still active. Audit: `reports/model-categories-zh/object-taxonomy-merge.json`;
  verification: `build/model-library-object-taxonomy-verification.json`.
- Hover preview layer correction deployed with rollback at
  `/opt/cloud-service-console-web/model-library-releases/20261104T073803Z/backup`.
  Thumbnail containers now form an isolated stacking/compositing layer at z-index
  zero under the existing card reflection. Tilt, lighting and carousel timing are
  retained. This targets a reported blank preview under pointer-driven card tilt;
  the exact reported failure was not reproduced in headless Chromium at that time
  (later reproduced with Dark Reader; see the 2026-11-05 correction above).
  The built CSS differs only in this preview layer rule, and JavaScript behavior is
  unchanged. Build, local layout/tilt/lifecycle checks and online hover pixel checks
  passed in light/dark themes at opposing corners for category and individual images.
  QA evidence lives in `build/model-library-qa` and `build/model-library-online-qa`.
  The thumbnail prewarm worker remains active with its original start time.
- Food consolidation deployed backend-only with rollback at
  `/opt/cloud-service-console-web/model-library-releases/20261104T072704Z/backup`.
  Reclassified 1,101 reviewed models into `food` (1,102 total, including one
  metadata-only Robosuite bread). Foods, beverages and condiments are included;
  fruit (377), vegetables (357), supplements (63), toys (243) and shoes (255)
  retain their categories. Mixed bar/can/sushi/Little Debbie groups were reviewed
  separately to exclude soap, openers, sushi mats, games and DVDs. Active categories
  decreased from 287 to 213. Runtime rules use exact IDs and retain original tags
  for search. All 60 backend tests passed; local/cloud comparisons preserve original
  entries and all 495,413 file records, and all 1,101 affected thumbnail keys are
  unchanged. Live counts, food previews, searches and exclusions were verified.
  The existing thumbnail worker continues with its original start time.
  Audit: `reports/model-categories-zh/food-merge.json`.
- Texture-coordinate adaptation deployed with rollback at
  `/opt/cloud-service-console-web/model-library-releases/20261104T062739Z/backup`.
  RoboCasa normalizer v1 emits compiled MuJoCo UVs with V inverted relative to the
  native OBJ source. The preview API now declares `texture_flip_y: false` for
  explicit textures from that verified import path; native GSO, PartNet MTL and
  future normalizer versions retain the default. This covers 2,422 models and
  2,701 visual parts without modifying catalog entries, files or simulator assets.
  A texture-policy revision changes only affected thumbnail keys. All nine
  lollipop previews were regenerated, and the full-catalog job was resumed against
  the corrected renderer, retaining unaffected valid images.
  Source-OBJ UV comparisons across aigen_objs, objaverse and fixtures matched
  the inverse-V transformation to below 1e-6. Seven corrected renders exactly
  matched the reference-image flip; GSO and PartNet controls were pixel-identical.
  Desktop/mobile online viewing, rotation/zoom, themes and carousel lifecycle
  checks passed, as did the frontend build and 59 backend tests.
  Complete cloud database comparisons verified all model and resource records
  unchanged. Audit code: `scripts/audit_model_textures.py`; evidence:
  `reports/model-texture-audit/`.
  Full material-aware results cover 5,920 entries, 26,441 texture images and
  37,255 textured meshes: 33 models have missing original resources and seven
  have UV findings on actually textured faces. The 1,353 warning-only entries
  are not confirmed defects (mostly legal UV tiling). The initial whole-mesh
  scan overreported missing UVs on pure-color faces; the material-aware report
  supersedes those findings. No source data was fabricated to hide defects.
- Fruit/vegetable consolidation deployed backend-only with rollback at
  `/opt/cloud-service-console-web/model-library-releases/20261104T060947Z/backup`.
  Reclassified 733 reviewed RoboCasa entries from 46 source labels: 376 into
  existing `fruit` (377 total, including one metadata-only Robosuite lemon),
  and 357 into explicitly declared `vegetable`. Active categories decreased
  from 332 to 287. Culinary vegetables include mushrooms, tomatoes, peppers
  and sweet potatoes. Olive Kids bags, the Sapota planter, pretend-play produce,
  fruit snacks, walnuts and pickled foods retain their existing classifications.
  All 56 backend tests passed. Local/cloud verification preserves all original
  entries and 495,413 resource records; all 733 affected thumbnail keys are unchanged.
  Cloud counts, old-name searches and category preview membership were verified.
  The thumbnail batch remains active with its original start time; no restart
  or frontend redeployment was needed. Exact-ID audit:
  `reports/model-categories-zh/produce-merge.json`. The bilingual report is updated.
- Rounded 3D viewport and advance thumbnail preloading deployed with rollback at
  `/opt/cloud-service-console-web/model-library-releases/20261104T052241Z/backup`.
  The viewport clips to an 8 px rounded rectangle (square only in fullscreen).
  Carousels download/decode the next image during the current hold rather than
  waiting until the switch; failed images are skipped promptly and opacity layers
  are promoted during the transition. All 55 backend tests, the build and local/online
  viewer and carousel checks passed, including advance decoding and URL cleanup.
  The full-catalog server job has started with 588 verified cached images and
  5,917 models with resource bodies; three metadata-only entries are excluded.
  This is a running batch, not a claim that all previews have completed. Live
  progress and failures are in `_thumbnail-prewarm/progress.json`. A newly generated
  cloud WebP was retrieved successfully with matching SHA-256 and 480x360 dimensions;
  unauthenticated access remained HTTP 401. No source models were copied or changed.
- Category-first browsing deployed with rollback backup at
  `/opt/cloud-service-console-web/model-library-releases/20261104T050537Z/backup`.
  The initial view contains category cards only; entering one reveals its model
  listing and scoped source filter. The checkbox picker and selection chips are
  removed. Category cards cycle through available member thumbnails using bounded
  preview batches and decoded-image crossfades, retaining the seven-degree tilt
  and lighting. Navigation preserves filters, pagination, focus and scroll.
  All 53 backend tests and the frontend build passed. Local and deployed browser checks cover
  both themes and mobile/desktop layouts, category navigation, source membership,
  interactive 3D viewing, crossfades, skipped failures, singleton/reduced-motion
  behavior, offscreen/background suspension and Blob URL cleanup. Resource files,
  classification rules and the 5,920-model inventory are unchanged.
- Stronger card tilt and pointer lighting deployed with rollback backup at
  `/opt/cloud-service-console-web/model-library-releases/20261104T043708Z/backup`.
  Maximum tilt increased from four to seven degrees. A soft, pointer-tracked
  diagonal reflection, edge highlights and opposing directional shadows provide
  depth; dark mode uses a dimmer reflection and text stays above the lighting layer.
  Lighting ignores pointer hit testing and fades out with the tilt reset. Touch and
  reduced-motion safeguards remain unchanged. Build and local browser checks passed,
  including distinct reflection/shadow positions, both themes and stable card layout.
- Category-picker text selection and card-hover interaction update deployed with
  rollback backup at `/opt/cloud-service-console-web/model-library-releases/20261104T042720Z/backup`.
  Picker labels and card captions are nonselectable; category search retains text
  editing/selection. Cards tilt up to four degrees toward mouse movement, with
  frame-coalesced CSS updates on an inner surface and a stationary button hit area.
  Pointer exit/cancel/down, focus loss and motion-preference changes reset the tilt.
  Touch/coarse-pointer devices and reduced-motion users keep static cards.
  Local production-build browser checks cover both themes, desktop/mobile layout,
  text dragging, search editing, tilt directions/reset, stable hit area and viewer
  rotation/zoom. No new WebGL contexts, model resources or category changes.
- Toy/supplement consolidation deployed backend-only with rollback backup at
  `/opt/cloud-service-console-web/model-library-releases/20261104T041416Z/backup`.
  Reclassified 305 reviewed models: 242 into existing `toys` (243 total) and 63
  into explicitly declared `supplements`. Active labels decreased from 498 to 332.
  Real utensils, foods, cosmetics, medications and videogame software are excluded;
  mixed-category items were reviewed individually, including cloud thumbnails.
  Pet toys and nutritional supplements are included in their respective categories.
  All 51 backend tests passed. Both local and cloud database comparisons verified
  unchanged IDs, source metadata, availability and all 495,413 resource records.
  The 255 footwear assignments and content-addressed thumbnail keys are preserved.
  The current round's exact-ID audit is `reports/model-categories-zh/toys-supplements-merge.json`;
  prior brand/footwear audits remain historical snapshots instead of being regenerated
  from the latest rules. No frontend bundle or model resources were redeployed.
- Footwear consolidation deployed backend-only with rollback backup at
  `/opt/cloud-service-console-web/model-library-releases/20261104T032543Z/backup`.
  Added the explicitly requested `shoes` category and assigned 255 reviewed models
  from 73 source labels. Active labels decreased from 566 to 498. Mixed labels retain
  their non-footwear entries, including ice cream, toys and Womens Multi 13 supplements.
  Grand Prix, Hilary, Real Deal and D ROSE models were confirmed against cloud previews.
  All 50 backend tests passed; live pagination returned exactly 255 unique footwear IDs.
  Local and cloud resource inventories and original metadata are unchanged.
- Brand-category cleanup deployed backend-only with rollback backup at
  `/opt/cloud-service-console-web/model-library-releases/20261104T031258Z/backup`.
  Reassigned 114 individually reviewed models to existing object categories;
  normalized category count decreased from 609 to 566. Model count remains 5,920
  (5,917 stored). Both local and remote before/after database comparisons verified
  identical model IDs, original entries, availability and complete resource inventories.
  All 42 backend tests passed. No meshes, source indexes or thumbnail caches changed.
- Multi-category selector deployed with rollback backup at
  `/opt/cloud-service-console-web/model-library-releases/20261104T024623Z/backup`.
  Categories now use a searchable checkbox dialog instead of a dropdown; repeated
  category parameters select a union. All 34 backend tests passed. Browser checks
  exercise Apply, Cancel, Escape, focus containment/restoration, independent scrolling,
  selected-only mode, tag removal and both themes on desktop/mobile.
- Card-thumbnail update deployed with rollback backup at
  `/opt/cloud-service-console-web/model-library-releases/20261104T022550Z/backup`.
  First-page previews were prewarmed. Online QA covered all four model sources,
  desktop/mobile layouts, both themes, full rows, independent filter scrolling and
  interactive viewer rotation/zoom. The listing creates no WebGL contexts.
- A cold RoboCasa thumbnail request returned HTTP 202 then an image after 3.8 seconds;
  a repeated request returned the identical cached image. The 64 previews created
  during QA occupied 1,198,668 bytes total; server free space remained 4.25 GiB.
- Deployed on the Hong Kong host; only the web-console service was restarted.
- Runtime verification: 495,413 files, 26,908,160,359 logical bytes, no hash failures.
- Source archive: 99,390 original-source paths represented by 92,906 unique blobs
  plus references to runtime files. `sources.tar.zst` is 3,357,347,994 bytes and was
  fully decompressed and hash-verified on the server.
- Preview-resource audit: 5,884 valid manifests; 33 PartNet entries have known missing
  source meshes, and 3 Robosuite entries have no downloaded files. Four representative
  real models passed online canvas, rotation, zoom and mobile-viewport tests.
- Guarded local cleanup removed 597,127 files (49,945,403,972 bytes), with no changed
  files or verification failures skipped. The remaining catalog is about 156 MiB.
  Existing scene packages and downloads outside the catalog were left untouched.
- The post-cleanup empty-body-cache test passed, including 32 GSO collision meshes,
  32 RoboCasa collision meshes, PartNet structural data, Robosuite and shared textures.
  The temporary test cache was removed. All 1,122 texture-index resources are present.
- Related tests: 27 console backend tests and 75 simulator/catalog regression tests.
- Server library allocation including archives and metadata: about 28.54 GiB.
  Available server disk space after deployment: about 4.23 GiB. Capacity is limited.
- Console rollback backup:
  `/opt/cloud-service-console-web/model-library-releases/20261103T210027Z/backup`.

## Scope

The web console's Model Library tab sits between Local Streaming and System Settings.
The initial screen shows paginated category cards, category search and model counts.
Opening a category shows its models and category-scoped source filtering; opening a
model shows its 3D detail. Returning restores the prior query, source, page, focus and
scroll position. Category checkboxes, selection chips and the multiselect dialog are
removed from the UI; the existing multi-category API remains compatible.
Model cards show textured thumbnails, a title, source and file size; category subtitles
are omitted. Fine-pointer mouse hover adds a bounded CSS perspective tilt, disabled
for reduced motion and touch input; the clickable outer card does not move.
Opening a card loads original meshes and textures into a shared Three.js
viewer. The listing does not download model bodies or create per-card WebGL contexts.
No duplicate GLB files are generated. A cloud worker generates transparent WebP
thumbnails on demand, using software rendering without a physical GPU.

Preview texture orientation is an explicit per-part contract. Correct compiled
RoboCasa UVs in the renderer, not by changing source PNGs or catalog OBJ files.
The same viewport renders both interactive details and server thumbnails.
Thumbnail keys include the applicable texture-policy revision so an old incorrect
image cannot be returned under the new policy. There is no global flip for all
sources.

`scripts/audit_model_textures.py --root <library> --output <report.json> --deep`
checks every preview manifest, image decodability and textured OBJ UVs. MTL meshes
are inspected by the active face material: faces with only a constant color do
not require UVs. Missing files, invalid texture images, malformed coordinates and
invalid UV indices get explicit rule IDs and model paths. UVs outside [0,1] can
be intentional tiling and are review warnings, never evidence for automatic
flipping or clamping. Structural checks cannot certify that an arbitrary texture
is semantically the right image; use source comparisons and rendered references
for that. Source defects remain reported rather than inventing texture data.

Category images reuse those thumbnails, hold for four seconds and crossfade for
750 ms. The next image downloads and decodes during the hold, before the switch is
due; slow responses extend the current image instead of showing an empty frame.
Preview IDs are fetched in batches of six,
interleaving sources and continuing through all available members before wrapping.
At most two image Blob URLs are retained per category card (one while paused).
Offscreen and hidden-document carousels abort requests and pause; reduced motion
shows a static preview. Singleton categories do not animate. Failed or slow images
are skipped without removing a working preview, and retries back off after repeated
failures. No additional category image files or per-card WebGL contexts are created.

The catalog has 5,920 object entries: 1,030 GSO, 2,538 RoboCasa, 2,347 PartNet-Mobility,
and 5 Robosuite. Three Robosuite entries are metadata-only. The separate texture index
contains 1,122 entries. Source dimensions are not independently calibrated dimensions.

## Server Layout

`/opt/telebot-model-library/`:

- `catalog/`: ready-to-use model packages, collision meshes, textures, native URDFs,
  structural metadata and source license information. Catalog-relative paths are preserved.
- `library.sqlite`: searchable object metadata and resource inventory.
- `previews/v2/`: private content-addressed 480x360 WebP card thumbnails.
- `_transfer/files.sqlite`: SHA-256 inventory and resumable transfer state.
- `_transfer/verification.json`: complete server-side content verification receipt.
- `_sources/`: optional deduplicated cold archive of original import versions, together
  with a manifest and verification receipt. This is not used for everyday scene generation.

Identical runtime files share disk blocks through hardlinks. They must not be edited
in place: replace a file atomically, then rebuild and verify the index. The active
generator uses the normalized model data, not the original import versions.

## Access

No model directory is mounted as a public static folder. Every model resource endpoint
requires authentication, including textures and native URDFs. Administrator accounts
have access. Other accounts require explicit inclusion in `CLOUD_CONSOLE_MODEL_READERS`
(comma-separated usernames). Self-registering an account does not grant library access.

Scene generation uses a separate read-only token in `X-Model-Library-Token`, accepted
only on GET requests under `/api/model-library`. The server stores its SHA-256 digest
in `CLOUD_CONSOLE_MODEL_TOKEN_SHA256`, not the token itself. Credentials and account data
are never placed inside the asset directory or frontend bundle. Dataset licenses and
access requirements still apply; this private deployment does not authorize redistribution.

## Local Scene Generation

`E:\Desktop\123\code_1015\shared\assets\catalog\remote-library.json` enables cloud mode:

```json
{"base_url": "https://console.cityulive.com"}
```

The private credentials file is outside the repositories:
`C:\Users\SECANT\.config\telebot-model-library.json`. It contains `base_url` and `token`.
Another machine needs its own authorized credential configuration. The environment
variable `TELEBOT_MODEL_LIBRARY_CREDENTIALS` can select a different credentials file.
Never commit or share the token in chat or source control.

The local index remains searchable without downloading model bodies. `AssetCatalog.acquire`
retrieves only the selected model's dependencies. `local_file` retrieves individual
missing resources such as shared textures and PartNet structural metadata. Transfers
are atomic and verified by size and SHA-256; redirects are refused. Existing modified
files are not overwritten. Without the marker, original local-only behavior is unchanged.

Downloads become a local working cache. There is no automatic eviction while a scene
generator may be using a model. Generated scene packages keep their own required assets
so existing scenes remain usable. Restart already-running generator/platform processes
after installing this change so they load the new acquisition code.

Native PartNet URDF preview is supported as an assembled model. It is not the same as
full articulated MuJoCo scene integration: the existing generator deliberately refuses
to flatten native articulated assets until an articulated adapter supports them.
Source defects remain explicit; the viewer does not invent missing geometry.

## API

Category names are trimmed and case-folded for grouping, filtering and display;
`Bottle`, `bottle` and `BOTTLE` share a single count. Original source metadata is
preserved. This normalization also applies to existing catalogs without reimporting.

`backend/model_category_overrides.json` holds reviewed per-model assignments, not
brand-wide aliases. Each group records the expected source category, target,
model IDs and rationale. Targets must already exist or be explicitly declared in
`new_categories`; `shoes`, `supplements` and `vegetable` were added at the user's request.
Every index build reapplies these assignments. Missing targets,
missing models or changed source categories are reported and left unmodified; invalid
or duplicate rules fail before replacing the database. Unlisted models are unchanged.
The indexed category drives listing, filters and details. Original entries and resource
hashes stay unchanged for source provenance, generator downloads and thumbnail reuse;
search includes both original and effective categories plus the original model name.

The reviewed object taxonomy groups by physical identity and use. A separate
`classifications` table stores optional Chinese subtypes, confirmed brand/color/
pattern/material attributes, review status and rationale. These fields appear in
model details, and subtypes and attribute values are searchable without replacing
original labels or tags. A hat printed with an event name remains a hat, and a
horse-pattern pencil case remains a bag. Products with conflicting source names and
visual evidence are placed in `needs_review`, with the ambiguity shown in details;
unconfirmed brands are not inferred from those conflicting names.

The current review covers 559 entries and reassigns 503 of them using exact model
IDs. Rules are reapplied on index builds, with source-category guards for details
as well as primary assignments. New imports are not automatically classified by
the migration's keyword heuristics: review them and add guarded assignments.
`reports/model-categories-zh/classify_objects.py` is the completed one-time migration,
not a routine import command. Its audit and local backup identify the previous state.
Resource manifests, original entry JSON and content-addressed previews are unchanged
by the separate classification table.

For example, brand groups are split into mice, keyboards, headphones and mouse pads
as appropriate. ASUS routers and motherboards are separated into network devices
and computer components. Printer cartridges, plant pots and coffee products are
classified separately from printers, cooking pots and coffee cups. Footwear is consolidated into
`shoes` regardless of brand, series, color, gender or shoe style. Physical toys, tabletop
games, pretend-play sets and pet toys share `toys`. Reviewed nutritional supplements
(including protein powders and pet probiotics) share `supplements`; source health
claims are not endorsed by this classification. Clothing, ordinary foods, skincare,
medications and videogame software are not merged into these groups.
Reviewed fruits share `fruit`; culinary vegetables (including mushrooms, tomatoes
and sweet potatoes) share `vegetable`. Fruit-themed toys and misleading brand names
are not merged with edible produce. Original species names remain searchable.
Classification does not rename source
tags or reclassify the simulator's original catalog. The updated Chinese label report
and item-level audit are in `reports/model-categories-zh/`.

Categories are selected in a searchable rectangular modal with a checkbox grid,
independent scrolling, a selected-only view and explicit Apply/Cancel actions.
Escape or dismissing the modal discards draft changes. Applied categories appear as
removable tags above the results; Clear removes the filter. Selecting several
categories matches any of them (OR), combined with source and search filters (AND).
Changing the source clears selected categories. The API accepts repeated query keys,
for example `?category=bottle&category=bowl`; the legacy single key is still supported.
Values are normalized and deduplicated, with parameterized SQL and input bounds.

The browser page size follows the measured grid column count (complete rows, close
to 36 items). Only the final result page may have a partial row. Resizing preserves
the page containing the previous first item. The source filter still uses a bounded
dropdown. Model previews use a scaled
perspective reference grid with light/dark palettes. Theme changes do not reload
model resources or reset the camera; source material colors stay unchanged.

- `GET /api/model-library`: search, source/category filtering and pagination.
  Optional `exact_category` selects one normalized category, including the empty
  unclassified category; source counts are scoped to selected categories.
- `GET /api/model-library/categories`: category search/pagination, counts and the
  first six available preview IDs per category, without loading model resources.
- `GET /api/model-library/category-previews?category=...&offset=...`: bounded next
  preview batch (default six, maximum twelve), under the existing library auth.
- `GET /api/model-library/{id}`: object metadata.
- `GET /api/model-library/{id}/view`: meshes, transforms, materials and texture references.
- `GET /api/model-library/{id}/thumbnail`: cached image, HTTP 202 while queued, or a
  JSON failure status when a source model cannot be rendered. All responses require
  the same model-library authorization as full model resources.
- `GET /api/model-library/{id}/file?path=...`: model-scoped viewer resources.
- `GET /api/model-library/{id}/manifest`: complete dependency inventory.
- `GET /api/model-library/file?path=...`: authenticated on-demand generator download.

## Deployment and Verification

Thumbnails reuse the viewer's source meshes, material loaders and default camera.
They render at 960x720, then trim transparent margins and downsample to fit 480x360.
One isolated Chromium subprocess runs at a time, with at most 48 queued jobs and a
120-second job timeout. Visual inputs over 128 MiB are rejected to protect the small
server; source defects are reported instead of inventing geometry. Failures have a
five-minute cooldown. New rendering is refused below 256 MiB of free disk space.
The cache is invalidated by renderer version, indexed metadata or resource hashes.
Transparent images adapt to either UI theme without regeneration. Visible cards poll
pending jobs every three seconds; polling is cancelled when offscreen or unmounted.

`python scripts/warm_model_thumbnails.py --limit 36` prewarms the first page;
`--asset <id>` selects specific models, and `--stage <release>` tests a staged renderer.
This administrative utility should not run concurrently with another prewarm process.
It generates only small preview images, never another copy of model bodies. The normal
on-demand queue is automatic; full-catalog pre-rendering is not necessary.

For a fully prebuilt library, run `python scripts/warm_model_thumbnails.py --all`.
This uploads the administrative worker, then starts the singleton server-side
`telebot-model-thumbnail-prewarm.service`; it does not depend on the browser or a
long-lived local SSH session. `--status` reads progress, and `--all --retry-failed`
starts a new pass including previously failed images after the active pass finishes.
Existing valid 480x360 WebP files are verified and reused, unavailable model bodies
are counted separately, and every new success or failure is recorded. Restarted jobs
scan existing outputs; an interrupted in-flight renderer is recorded for explicit
retry rather than repeatedly crashing on the same model. Models with missing source
meshes or over-budget resources remain visible in the failure report.

Full-catalog progress and per-model results live in
`/opt/telebot-model-library/_thumbnail-prewarm/progress.json` and `results.jsonl`.
The systemd job has a 150% CPU quota (1.5 cores), 2 GiB memory-high threshold,
3 GiB hard memory limit, no swap, low scheduling priority and a two-day runtime limit.
It refuses new renders below 1 GiB free disk. A process-shared lock serializes the
online and batch Chromium renderers, and cache existence is rechecked after locking.
Source files, taxonomy and model metadata are not modified by prewarming.

`scripts/model_library_transfer.py` inventories and streams runtime resources in resumable
batches, verifies each uploaded file, then rereads every server file for full verification.
It never removes source data. `scripts/deploy_model_library.py` stages only model-library
backend additions and the built web frontend. Activation requires a verified inventory,
backs up the current console, preserves unrelated server settings, and restarts only
`cloud-service-console-web.service`. A failed health check restores the prior version.
The category rules and SQLite database are included in backup and rollback. Use
`--backend-only` when changing classification without replacing the deployed frontend.

Relevant checks:

```powershell
python -m pytest backend/tests -q
npm.cmd --prefix frontend run build
$env:CLOUD_CONSOLE_CHROMIUM_PATH = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
python scripts/verify_model_library_ui.py
python scripts/verify_model_library_ui.py --cloud-resources
python scripts/verify_model_library_ui.py --online
& E:\Desktop\123\code_1015\.venv\Scripts\python.exe scripts/verify_model_library_remote_cache.py
```

The online browser check uses the real deployed frontend, library API and model bytes;
it stubs unrelated dashboard bootstrap APIs and supplies the read-only machine credential.
It does not claim to test an interactive account login. Login/access controls are covered
separately by backend tests. After local asset cleanup, use `--cloud-resources` to
test the local build and catalog with real remote meshes instead of rebuilding a
local asset copy. Browser checks cover category-first navigation, scoped source
filtering, wide-screen pagination, menu scrolling, theme changes without reloads,
desktop/mobile framing and interactive rotation/zoom. Controlled preview responses
also exercise crossfades, paginated cycling, failures, pausing and object-URL cleanup;
the layout and 3D-viewer checks still use real catalog resources.
The cache proof downloads into an empty temporary directory,
materializes three rigid assets and a texture, fetches native PartNet data, then removes
the temporary directory.

## Interactive Joint Preview (2026-11-05)

`GET /api/model-library/{id}/view` now includes an additive `joints` array for
URDF models: joint name/type, parent/child links, normalized local axis, native
lower/upper limits, optional mimic relation and `disabled_reason`. Fixed joints
remain in the link tree but are not controls. Invalid or absent limits disable
only that control; no guessed motion limits are written into source files.

The detail viewer lists joints as buttons below the canvas. Selection tints the
moving link and its descendants. Rotating joints show a curved arrow around the
axis extension, beyond the moving part, with a faint dashed axis line. Sliding
joints show a straight arrow anchored to the moving assembly's center and updated
with its motion. Optional node `mass` and `center_of_mass` fields preserve valid
URDF inertia; the viewer uses a mass-weighted center for supplied inertial data,
or the moving assembly's visual bounds center when none is available. A slider and numeric
input use degrees or millimeters; dragging the selected visible part horizontally
also adjusts the joint. Background gestures keep controlling the camera. Individual
and all-joint reset controls return coordinates to zero, clamped to native limits.
Continuous joints accept arbitrary numeric angles. Mimic joints follow their
driver; dependent limits narrow the driver's range to preserve coupling.

Transforms use separate origin and motion groups, keeping URDF origin RPY, local
axis, mesh offsets and parent-child kinematics independent. Camera framing reserves
space for opened parts. These are kinematic preview controls, not physics/contact
simulation; changes stay in the browser and do not modify stored assets. Thumbnail
rendering retains the original zero-coordinate appearance without controls or tint.

Validation: `python -m pytest backend/tests/test_model_library.py backend/tests/test_model_joints.py -q`,
`node --test frontend/tests/modelArticulation.test.mjs`, frontend production build,
and `python scripts/verify_model_joints_ui.py` (`--online` for the deployed build).
The browser check uses real cloud microwave, cabinet/drawer and rigid meshes,
checks movement pixels, all available joint buttons, drag, limits, reset, full
screen, both themes, mobile layout and thumbnail rendering. Dashboard bootstrap
and catalog listing are fixtures; the online manifest and model resources are real.

`scripts/deploy_model_joint_preview.py` stages and audits all available articulated
URDFs, backs up only affected backend/HTML entries, retains previous hashed assets,
restarts only the console service and restores the previous entries on activation
failure. Initial inventory: 2,347 models, 11,971 moving joints; 22 axes containing
`None` and one zero-range joint are disabled. Reports: `reports/model-joints-20261105/`.

## LIBERO Import (2026-11-06)

`scripts/import_libero_library.py` incrementally deploys the simulator catalog's LIBERO
entries. Revision `8f1084e3132a39270c3a13ebe37270a43ece2a01` adds 51 entries (10 articulated,
41 rigid), bringing the catalog from 5,920 to 5,971. The four upstream object directories
include some standalone component entries; task files, robots and backgrounds are excluded.
The transfer verifies 1,253 files, 345,756,826 logical bytes, and deduplicates identical
content using server hardlinks. Existing records are verified unchanged before activation.
Index/database/backend snapshots and deployment receipts are retained.

The source filter recognizes `LIBERO`. Articulated previews use the generated URDF graph,
native joint ranges and explicit texture references. Simulation uses the retained native
MJCF, not this preview descriptor. All 51 thumbnails are pre-rendered in the server cache.
Search `libero_microwave` for the appliance used by the existing microwave demo.

```powershell
python scripts/verify_model_joints_ui.py --online --asset libero_microwave --asset libero_wooden_cabinet --asset libero_alphabet_soup --output reports/libero-catalog-20261106/joints
python scripts/verify_model_library_ui.py --online --skip-layout --asset libero_microwave --output reports/libero-catalog-20261106/viewer
```

`--asset` may be repeated to limit checks or `warm_model_thumbnails.py` to the new models.
Online viewer checks obtain the model's category from the deployed API, so they do not
depend on a stale local preview database. The simulator's `verify_libero_catalog.py`
validates all models and can check retrieval into an empty cache with `--cloud-cache`.
Reports and screenshots are under `reports/libero-catalog-20261106/` in both projects.

## RoboCasa v0.2 Fixture Completion (2026-11-18)

`scripts/supplement_robocasa_library.py` stages, converts and incrementally activates
the fixtures missing from the existing RoboCasa v0.2 collection. Definitions are pinned
to `756598a5be52e052339bb2d957426e39015c2afb`. Original resources come from the
`jianzhang96/robocasa-assets` mirror at `866be1d2158a6486af2211156b83eeaeb031f54f`;
the verified archive SHA-256 is
`bd993f47d0ae5f5f3d89cf5f9fc28d55ceb878359c49136d30052de0bb1ef231`.
The archive supplements resources; pinned official XML/YAML supplies the definitions.

The update adds 60 entries: coffee machines 4, counters 2, dishwashers 3, fridges 5,
hoods 4, microwaves 8, ovens 6, sinks 10, stoves 9, stovetops 4 and toasters 5.
There are 22 articulated models with 76 movable joints; the other source models are
static. Existing 5,971 entries are preserved, bringing the server total to 6,031.
The RoboCasa subset is now 2,598 entries, including all 90 standalone v0.2 fixtures.
This is pinned v0.2 coverage, not a claim of RoboCasa365 completeness.

Files live under
`/opt/telebot-model-library/catalog/.imports/robocasa-v02-756598a5be52-completion/`:

- `normalized/<asset-id>/`: portable descriptor, visual/collision resources,
  `asset-parameters/2` metadata, provenance and license notice.
- `source_assets/`: original resources and pinned fixture definitions.
- `repository/`: pinned source definitions, fixture Python implementations,
  22 registry YAMLs and repository license.
- `component_templates.json`: 15 cabinet, drawer, panel and handle templates.
  These require fixture composition and are not advertised as complete usable models.

Simulation keeps original native MJCF joints and collision surfaces. Preview URDFs
represent multiple scalar joints on one physical body using virtual frames; those
frames are not added to native physics. Flat visual and unused mesh assets use shell
inertia; legacy mesh `shellinertia` attributes move to mesh assets for compatibility.
Eight models expose named button contact regions through `parameters.contact_regions`.
They explicitly declare `native_trigger_runtime: false`: device state changes require
a runtime adapter and are not implemented by geometric conversion alone.

Preparation checks all 468 direct resource references for the 60 standalone fixtures.
Conversion compiles every native model, checks joint counts and probes each source
joint at lower, middle and upper positions. Activation checks all 60 viewer graphs,
joint controls and resource manifests, and verifies prior entries remain unchanged.
These are import and kinematic checks, not successful Piper task demonstrations.
Receipts and disposable verification outputs are under
`reports/robocasa_inventory_audit/completion/`; server staging and receipts are under
`/opt/telebot-model-library/_imports/robocasa-v02-completion/`.

## Safe Local Cleanup

`scripts/finalize_model_library.py` defaults to a dry run. It checks the exact server
inventory signature, complete hash verification, a recent successful empty-cache test,
and the explicit cloud-mode marker. With `--remove-verified`, each bulk file is checked
again before it is removed. Changed files are retained. Top-level search indices,
collection-level notices and generated scene directories are not deleted. Per-model
metadata is retrieved on demand along with the model. The script uses exact-file operations, never a
recursive deletion of the catalog. An original-source archive is required before source
versions and verified redundant ZIPs are included; `--runtime-only` excludes those.

Cleanup receipts and browser evidence are in the console project's `build/model-library-*`
files. Source archives outside the catalog, such as packages in `E:\Downloads`, are
outside this cleanup scope and are not removed.
