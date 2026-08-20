# Changelog

## [0.4.0.0] - 2026-08-20

### Added

- Browse date covers with cached private WebP thumbnails and open an immersive same-day large-photo viewer with previous/next navigation.
- Generate private `thumb` and `display` variants on demand through the Cloudflare Images transformer Worker, including local browser thumbnail caching.

### Changed

- Sort album photos by capture time (`takenAt`) newest first, keep the home shelf focused on the latest 12 photos, and index the cloud timeline for that order.
- Keep original downloads unchanged while date grids and lightbox views use appropriately sized variants with retryable transform failures.

### Fixed

- Make photos selected from the date calendar open as real large images instead of only changing the home selection.

## [0.3.0.0] - 2026-08-11

### Added

- Add Better Auth personal users with email/password, username, Google OAuth configuration, email verification/reset delivery through Resend, D1 rate limiting, and stable `/api/me` identity summaries.
- Add additive Household membership schema, one-active-membership enforcement, owner/member lifecycle APIs, one-time 24-hour invites, soft deletion and seven-day restore.
- Add user-first authorization helpers and compatibility bridge from legacy accounts so BabyForge business APIs reject inactive or deleted Household access while old data remains available during migration.

### Changed

- Split Issue #53 into seven independently deployable child issues and documented the first four designs under `docs/issue-53/`.
- Require a Household name and enforce the V1 one-Household/one-Baby rule at the sync boundary; clear user-scoped local caches on logout or 401/403 revocation.

### Fixed

- Preserve the existing Chinese `账号` accessibility locator while exposing the clearer email-or-username login label.

## [Unreleased] - 2026-08-07

### Changed

- Today is intentionally album-first: caregivers can keep a visual memory layer in the center while the right rail still retains care records, stage actions, and safety guidance; the empty album keeps a neutral baby illustration so no upload is required.
- The 0–6 year stage timeline now uses age-appropriate daily care actions and collapses older completed stages behind an explicit toggle. Stage milestones remain lightweight caregiver review prompts, not developmental screening content.

### Fixed

- Preserve the legacy `#/doctor-summary` deep link by routing it to the shared record center after the summary tab was removed.
- Block direct cloud-photo reads for detached baby profiles, await local album deletion before clearing a workspace, and disclose that Cloudflare R2 keeps original EXIF metadata visible to household members.

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
