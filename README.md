# SAF Studio (Sagar Arts & Frames)

Web app for Sagar Arts & Frames: "Custom art. Timeless frames." Customers create an account, then use
the **Memory Wall Planner** to design a gallery wall and request a quote.

SAF Studio is a **port of the Moonlight Studio frontend** (`../Moonlight Studio Project/frontend`).
Logic, state, data flow and inputs are identical. Only the UI follows SAF's own designs in
`reference-designs/`.

| Layer    | Stack                                                     | Owner    |
| -------- | --------------------------------------------------------- | -------- |
| Frontend | React 19, TypeScript, Tailwind CSS v4, Vite, React Router | Frontend |
| Backend  | Python, FastAPI, MongoDB (same contract as Moonlight)     | Backend  |

## Repository layout

```
SAF Studio Project/
├── frontend/            React + TS + Tailwind app
├── docs/                Project documentation, start here
└── reference-designs/   Source-of-truth mockups (login, register, memory-wall-design)
```

## Quick start (frontend)

Requires **Node.js 20.19+** (developed on Node 24).

```bash
cd frontend
npm install
cp .env.example .env.local   # then fill in values
npm run dev                  # http://localhost:5173
```

| Script              | What it does                                              |
| ------------------- | --------------------------------------------------------- |
| `npm run dev`       | Dev server with HMR; proxies `/api` → FastAPI             |
| `npm run build`     | Type-check, then production build to `dist/`              |
| `npm run preview`   | Serve the production build locally                        |
| `npm run lint`      | Lint with oxlint                                          |
| `npm run typecheck` | TypeScript check only                                     |
| `npm run format`    | Format with Prettier (sorts Tailwind classes)             |
| `npm run test`      | Unit tests (Vitest)                                       |
| `npm run check`     | **Quality gate:** typecheck + lint + tests + format check |

## Documentation

| Doc                                              | Read it when…                                                |
| ------------------------------------------------ | ------------------------------------------------------------ |
| [docs/PORTING_PARITY.md](docs/PORTING_PARITY.md) | Picking up work: what's ported, what's left, open decisions  |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)     | Adding files: the Moonlight mapping and the porting workflow |
| [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md)   | Styling anything: tokens, type, components, token map        |
| [docs/RESPONSIVE.md](docs/RESPONSIVE.md)         | Building a screen: per-breakpoint layout                     |
| [docs/ASSETS.md](docs/ASSETS.md)                 | Adding images, icons or the logo                             |
| [docs/ROADMAP.md](docs/ROADMAP.md)               | Checking what each phase delivers                            |
| [docs/API_CONTRACT.md](docs/API_CONTRACT.md)     | Looking up an endpoint (inherited, backend-owned)            |
| [docs/API_ALIGNMENT.md](docs/API_ALIGNMENT.md)   | Contract ↔ design mismatches (inherited)                     |
| [docs/SECURITY.md](docs/SECURITY.md)             | Deploying or touching auth/tokens (inherited)                |
