# BabyForge

[简体中文](README.md) · **English**

BabyForge is a growth and care workspace for families in mainland China with children from birth to age six. It brings daily care, growth measurements, vaccination planning, pediatric education, and fact-based clinical handoffs into one place so family members can keep records that are easy to review and share.

Live demo: [babyforge.pages.dev](https://babyforge.pages.dev)

> BabyForge is a research and education prototype. It does not provide diagnoses, health scores, automated triage, medication advice, or dosage recommendations. Confirm vaccination schedules and health concerns with a vaccination clinic or qualified professional.

## Features

| Area | What it provides |
| --- | --- |
| Daily care | Shows age-based priorities, care tasks, and reminders; saves everyday photos in the album; and provides quick access to daily facts. |
| Unified record center | Records feeding, sleep, diapers, medication, temperature, weight, length/height, and head circumference. The timeline can be filtered by date and type, and saved facts can be reviewed, corrected, or voided. |
| Growth tracking | Stores birth and follow-up measurements, displays charts, stage guidance, and history, and preserves measurement source, method, age basis, and standard version. |
| Vaccination plan | Presents doses from birth through age six using China's 2026 National Immunization Program, stores completed vaccination facts, and flags alternative schedules that require clinic confirmation. |
| Pediatric education | Uses common pediatric topics, anatomy models, and educational cases to explain what caregivers can observe and describe without presenting the material as a diagnosis. |
| Parenting experience | Searches Chinese-language parenting resources by age and topic. Search requests exclude the baby's name, exact birth date, household account, and care records. |
| Naiba AI | A restricted beta that uses authorized baby context and care facts to answer questions, organize observations, or prepare records for confirmation. It supports OpenAI Responses, Chat Completions, and Anthropic Messages-compatible services. |
| Clinical handoff summary | Organizes recent observations, growth measurements, active concerns, and questions into a fact-first summary for a professional conversation. |
| Household collaboration | Separates administrator, editing caregiver, and read-only guest roles. The interface supports Chinese and English. |

## Typical workflow

1. Sign in and create a baby profile, optionally including birth weight, length, and head circumference.
2. Open Today to review the current stage, complete care tasks, and save photos.
3. Use Records to capture feeding, sleep, diaper, temperature, medication, or growth facts.
4. Review longer-term changes and upcoming items in Growth and Vaccines.
5. Before speaking with a professional, open the clinical handoff summary and verify the recorded facts and questions.

## Growth reference rules

- Birth measurements use China's National Health Commission standard `WS/T 800—2022`, scoped to singleton births at 24–42 gestational weeks.
- Completed-month references after birth use `WS/T 423—2022` for children younger than 84 months.
- When data is insufficient, outside the standard, or ineligible for a reference, BabyForge shows the limitation instead of fabricating a trend, percentile, or reference position.

## Data and collaboration

- In local development, baby profiles, care events, plans, and concerns are stored in browser IndexedDB with a `localStorage` fallback. Album photos also stay in the browser.
- The optional Cloudflare deployment uses Pages, Pages Functions, D1, and R2 to synchronize household workspaces, events, recorders, and photos.
- Care events are written online-first. A failed network write remains explicitly retryable; BabyForge does not maintain a background offline queue. Server-side `version` checks prevent silent overwrites.
- Clear local data is available in Settings. It removes data from the current device only and does not delete cloud records.
- Cloud albums retain original uploaded files and currently do not strip EXIF metadata. Remove device or location metadata before sharing when needed.

## Run locally

```powershell
npm install
npm run dev
```

Open the local URL printed by Vite. Development mode uses demo accounts and does not require D1 or R2.

## Verify

```powershell
npm test
npm run lint
npm run build
npm run test:visual
```

## Optional services

- Cloudflare deployment, account roles, and D1/R2 setup: [docs/cloudflare-deploy.md](docs/cloudflare-deploy.md)
- Naiba AI model and protocol configuration: [docs/cloudflare-deploy.md#奶爸-ai-模型配置](docs/cloudflare-deploy.md#奶爸-ai-模型配置)
- Parenting Experience requires a server-side Tavily configuration; the same deployment guide explains the secret setup.

Keep credentials in `.dev.vars`, `.env.local`, or platform secrets. Never place them in source code, `wrangler.jsonc`, or commits.

## Project documentation

- Product boundaries and terminology: [PRODUCT.md](PRODUCT.md) · [CONTEXT.md](CONTEXT.md)
- MVP scope and acceptance criteria: [docs/mvp-spec.md](docs/mvp-spec.md)
- Bilingual pediatric content specification: [docs/pediatric-bilingual-spec.md](docs/pediatric-bilingual-spec.md)
- Long-term vision and research: [docs/vision.md](docs/vision.md) · [docs/prd.md](docs/prd.md) · [docs/research/parenting-app-moat.md](docs/research/parenting-app-moat.md)
- Educational asset guide: [prompt/README.md](prompt/README.md)

## Attribution and licenses

The front-end interaction foundation was adapted from [3DCellForge](https://github.com/huangserva/3DCellForge) at commit `df56957`. BabyForge keeps its own Git history and removes the cell-biology domain, online model-generation providers, and original server code. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for third-party licenses.
