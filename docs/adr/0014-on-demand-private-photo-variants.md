# Generate private photo variants on demand

BabyForge will generate fixed `thumb` and `display` WebP variants on demand in a dedicated Cloudflare Images Worker called through a Pages Service Binding, then persist the derived bytes under deterministic private R2 keys. Pages Functions remain responsible for household authorization and never expose arbitrary transform parameters; this keeps original photos private, gives existing photos the same path as new uploads, and avoids coupling photo uploads to image conversion. Browser-only albums generate and cache thumbnails locally, while downloads continue to use the original bytes.

## Consequences

Deployments must publish the transformer Worker before Pages and enable Cloudflare Images. A missing or failed transform returns a retryable image error instead of silently loading the full original into thumbnail grids; deleting a photo also deletes its derived variants.

Album metadata is bounded at the API boundary: the home shelf requests the newest 12 records, while the calendar requests only its visible 42-day window (up to 500 records) and still renders each date cover from the cached `thumb` variant. The native adapter explicitly requests the larger bounded page and can use the response's `hasMore` marker for later paging.
