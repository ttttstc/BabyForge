# Changelog

## [0.2.0.0] - 2026-08-06

### Added

- Save caregiver observations, measurements, and professional conclusions in one shared event timeline.
- Correct or void records while preserving the original fact and its version history.
- Retry failed online saves manually without losing the current form input.
- Record birth weight, length, head circumference, gestational age, and measurement source.
- Show a compact personal growth state with age-basis and reference context.
- Compare measurements with versioned WS/T 423—2022 and WS/T 800—2022 reference data.

### Changed

- Event queries now support baby, date range, kind, and category filters.
- Shared records use explicit actors and sources, with version conflicts surfaced instead of silently overwritten.
- Legacy page collections are derived from CareEvent rather than used as the source of truth.
- Keep age basis, standard version, input provenance, and evaluation time with growth results.
- Keep incomplete, preterm, and multiple-birth cases explicit instead of fabricating a trend or reference position.

## [0.1.0.0] - 2026-08-06

### Added

- BabyForge newborn growth workspace for days 0–28.
- Account login with admin and read-only guest access.
- Cloudflare Pages Functions, D1 workspace sync, and the seeded 泥蛙 profile.
- Daily care actions, stage milestones, calendar, growth notes, pediatric learning, and care summary.
- Anatomy GLB viewer with 2D fallback and bilingual interface.
- Self-contained image and 3D generation prompts.

### Changed

- Login-first routing with account-scoped local storage and remote profile hydration.
- Unified BabyForge product copy and mobile-responsive layouts.
