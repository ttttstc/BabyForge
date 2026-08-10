# Hunyuan 3.1 multiview inputs

Only the four files inside each organ's `hunyuan-input/` directory are generation inputs. The 2x2 `turntable-review-*.png` files remain human-review contact sheets and must not be uploaded as a single image.

## Camera slots

| File | Hunyuan slot |
| --- | --- |
| `01-front.png` | 正图 |
| `02-left-front-45.png` | 左45°图 |
| `03-right-front-45.png` | 右45°图 |
| `04-back.png` | 背图 |

All input files are 627x627 PNG images on a white background. Each set depicts one fixed organ assembly at constant scale, color, lighting, cutaway state, and anatomy count.

## Generation queue

| Order | Organ id | Review source | Input directory | Output target | Status |
| --- | --- | --- | --- | --- | --- |
| 1 | `nose` | `nose-sinuses/turntable-review-v3.png` | `nose-sinuses/hunyuan-input/` | `public/assets/anatomy/models/nose.glb` | Generated · 4.55 MB · 0 validation errors |
| 2 | `throat` | `throat-larynx/turntable-review-v3.png` | `throat-larynx/hunyuan-input/` | `public/assets/anatomy/models/throat.glb` | Generated · 5.37 MB · 0 validation errors |
| 3 | `mouth` | `mouth-teeth/turntable-review-v5.png` | `mouth-teeth/hunyuan-input/` | `public/assets/anatomy/models/mouth.glb` | Generated · 3.42 MB · 0 validation errors |
| 4 | `stomach` | `stomach-esophagus/turntable-review-v2.png` | `stomach-esophagus/hunyuan-input/` | `public/assets/anatomy/models/stomach.glb` | Generated · 5.98 MB · 0 validation errors |
| 5 | `bladder` | `bladder-lower-urinary/turntable-review-v2.png` | `bladder-lower-urinary/hunyuan-input/` | `public/assets/anatomy/models/bladder.glb` | Generated · 5.62 MB · 0 validation errors |
| 6 | `bone` | `pediatric-long-bone/turntable-review-v2.png` | `pediatric-long-bone/hunyuan-input/` | `public/assets/anatomy/models/bone.glb` | Generated · 4.84 MB · 0 validation errors |

Generation used Hunyuan3D V3.1 multiview PBR at the 500k-face setting. Final delivery files use Meshopt geometry compression and 2048px WebP textures; raw Hunyuan downloads remain outside the shipped asset tree.

## Required GLB gate

- Visually match the four inputs: anatomy, laterality, counts, cutaway, color, and vessels/nerves where specified.
- No duplicated or missing structures; no fused unrelated parts; no unexpected base, text, background, or floating fragments.
- Embedded PBR color/texture must remain vivid under the BabyForge three-point lighting setup.
- Final optimized GLB must be less than 10 MB.
- Runtime load, stable auto-rotation, disease-page mapping, organ-page mapping, and mobile viewport must pass before deployment.
