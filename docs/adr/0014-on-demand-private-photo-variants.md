# Generate private photo variants on demand

BabyForge will generate fixed `thumb` and `display` WebP variants on demand in a dedicated Cloudflare Images Worker called through a Pages Service Binding, then persist the derived bytes under deterministic private R2 keys. Pages Functions remain responsible for household authorization and never expose arbitrary transform parameters; this keeps original photos private, gives existing photos the same path as new uploads, and avoids coupling photo uploads to image conversion. Browser-only albums generate and cache thumbnails locally, while downloads continue to use the original bytes.

## Consequences

Deployments must publish the transformer Worker before Pages and enable Cloudflare Images. A missing or failed transform returns a retryable image error instead of silently loading the full original into thumbnail grids; deleting a photo also deletes its derived variants.
