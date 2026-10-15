# Public landing — Shekof Task Manager

The home page at `/` uses the visual family of Shekoflow: warm cream `#fbf8ef`, forest green `#205a49`, sage/pistachio, soft supporting colors and IRANYekan. The reference was inspected read-only from `E:/Shekoflow/Shekoflow`, whose origin matches the supplied GitHub repository. Its working tree remained clean. No reference project files were edited or assets copied into this project.

## Artwork

Two original illustrations were generated for this product with the built-in image generation tool, using reference artwork only for style consistency:

- `apps/web/public/images/landing/project-garden.webp`: team planning around a task board, calendar and delivery path.
- `apps/web/public/images/landing/team-delivery.webp`: teammates handing over work, feedback and completion.

Transparent 1200 × 800 WebP assets total approximately 382 KiB. Source PNG files remain in the Codex generated-images directory; production uses only the local optimized assets. The hero loads eagerly with high priority; the second image loads lazily. Intrinsic dimensions reserve image space.

## Page behavior

- Hero, capability overview, interactive product preview, three-step workflow, deployment options, FAQ and final call to action.
- HeroUI cards, buttons, links and tabs. The product preview uses clearly identified sample data for board, Gantt and conversation views. No protected APIs or business mutations are used by the demo.
- Existing signup/login/setup destination rules, lead submission logic and legal content/configuration remain. Contact requests stay on `/contact`; deployment links preselect the relevant deployment option.
- Responsive menu with Escape dismissal/focus restoration; keyboard-operable native FAQ; visible focus states; sample dates in Persian.
- One IntersectionObserver reveals sections once. Reduced-motion settings disable entrances and reveal content immediately. Without observer support all content remains visible.

## Validation

Production TypeScript/Vite build passed. Narrow read-only browser checks covered 1440px desktop, 390px and 320px mobile widths, artwork loading, product tabs, workflow disclosure, FAQ, menu dismissal, reduced-motion presentation, contact/privacy routing and public API usage. No browser errors or horizontal page overflow occurred. The public page requested only `/api/product-config`. No leads or business records were submitted. Comprehensive acceptance testing remains deferred by user instruction.
