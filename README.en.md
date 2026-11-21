# second mind

> A neuronal map of who you are.

[![License: Source-Available](https://img.shields.io/badge/license-source--available-orange.svg)](LICENSE)
[![No Derivatives](https://img.shields.io/badge/derivatives-not%20permitted-c03636.svg)](LICENSE)

**Source-available, not open source.** You may clone, build and self-host it — including as a publicly accessible site — for non-commercial personal use. You may not modify it, redistribute the code, or use it commercially. See [LICENSE](LICENSE) and [docs/LICENSING.md](docs/LICENSING.md).
[![React 19](https://img.shields.io/badge/react-19-0b7285.svg)](https://react.dev)

Identity keywords are first-class neurons; skills, steps, progress and todos are their synapses. Most of the time you only see the first level — a branch reveals itself only when your pointer **comes near** it.

```
● designer            ● writer
  ╲    ·  ·              ·        ← level 2+ are just dots
   (approach to reveal this cluster)
```

## Run it in 30 seconds

```bash
git clone https://github.com/<your-account>/second-mind.git
cd second-mind
npm install
npm run dev        # http://localhost:5173
```

No signup, no database, no phone number. The default is **local mode**: data lives in `localStorage`, and the app is fully usable.

## Two modes

| | Local (default) | Cloud |
|---|---|---|
| Enabled when | `VITE_CLOUD_*` unset | `VITE_CLOUD_ENDPOINT` + `VITE_CLOUD_KEY` set |
| Storage | browser `localStorage` | PostgreSQL with row-level security |
| Auth | none | phone + SMS code, max 3 devices, 15-day trust |
| Sync | none | merges within ~1–2 s |

## Three views, one dataset

- **Network** — force-directed canvas. Level-1 identities always show their names; deeper nodes are dots that expand into a cluster (the node plus its direct neighbours) when the pointer rests within 28px for 120ms.
- **Board** — the workbench for one identity. Real DOM cards: double-click to rename, real checkboxes, real progress sliders, drag from a card's edge dot to another card to link them.
- **Outline** — the same data as an accessible tree. Canvas is hostile to keyboards and screen readers, so this view is not optional.

## Cloud setup

```bash
cp .env.example .env.local    # fill in endpoint + publishable key
npm run build
```

Then apply [`docs/schema.sql`](docs/schema.sql) to your PostgreSQL/PostgREST-compatible backend — four tables, a global `rev` sequence with triggers, RLS policies, and two device RPCs.

The frontend picks its backend in `src/cloud.ts`; all business logic lives in `src/data.ts`. Any PostgREST-compatible backend works through environment variables alone. A non-compatible API would require changing code, which counts as modification under the LICENSE and needs prior permission.

## Honest limits

**"Realtime" is polling, not push.** Local edits apply instantly; tabs in the same browser sync via `BroadcastChannel`; other devices poll every 1.5 s for `rev > cursor`. Cross-device latency is ~1–2 s. For true push, replace `src/data.ts` with a subscription-capable backend.

**"Device binding" cannot be absolute on the web.** The 15-day window is a 15-day session token weakly bound to a device fingerprint. Tokens are client-side, devices can be revoked remotely, and a 4th device must evict one — but whoever holds the token can act as you. The only thorough fix is end-to-end encryption, which costs you recoverability. Not enabled by default.

## Scripts

`npm run dev` · `npm run build` (→ `dist/`) · `npm run build:web` (→ `site/`) · `npm run preview` · `npm run typecheck` · `npm test`

## Docs

- [Architecture](docs/ARCHITECTURE.md)
- [Database schema](docs/DATABASE.md) · [`schema.sql`](docs/schema.sql)
- [Design record](docs/DESIGN.md) (Chinese)
- [Contributing](CONTRIBUTING.md) · [Security](SECURITY.md)

## License

[Second Mind Source-Available License v1.0](LICENSE) — **this is not an open source license**.

Permitted: viewing and cloning, building, running on your own machines or servers, and non-commercial personal deployments — **including a deployment that is publicly accessible over the internet**. Prohibited: modification, derivative works, redistribution of the source or compiled output, and any commercial use, including charging for access or operating it as a hosted service. A public deployment must be run by you as an individual, must not be offered as a product or service, and must keep the copyright notice. Serving compiled assets to visitors' browsers is not redistribution; visitors gain no rights to the code. Commercial or derivative licensing is available from the author on request.

See [docs/LICENSING.md](docs/LICENSING.md) for the boundary cases (ads, donations, internal company use, and so on).

Third-party dependencies (React, d3-force, zustand, and others) remain under their own licenses, mostly MIT. This license does not alter their terms.
