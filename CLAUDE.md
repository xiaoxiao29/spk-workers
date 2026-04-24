# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run dev          # Start local dev server via wrangler dev

# Build
npm run build        # Runs prebuild (compile templates) then tsc
npm run typecheck    # Type-check without emitting

# Test
npm test             # Run all tests with vitest
npm run test:watch   # Watch mode
npm run test:coverage

# Run a single test file
npx vitest run tests/unit/Config.test.ts

# Lint / Format
npm run lint
npm run lint:fix
npm run format

# Deploy
npm run deploy       # build + upload assets + sync access bypass + wrangler deploy
npm run upload       # Upload R2 assets only (themes, public, config)
npm run upload:themes
npm run upload:public
npm run upload:config
```

## Architecture

This is a **Cloudflare Workers** application that serves as a Synology Package Center (SPK) server. It uses TypeScript compiled by `tsc` and deployed with `wrangler`.

### Request handling

`src/index.ts` bootstraps each request: loads config from env vars, reads the device list from R2 (`conf/synology_models.yaml`), scans packages, then delegates to a **Router** (`src/handlers/Router.ts`).

The Router walks a chain of handlers in registration order (first `canHandle()` match wins):

| Handler | Route |
|---|---|
| `AssetsHandler` | `/_assets/*`, `/public/*`, `/themes/*`, `/icons/*` |
| `IconHandler` | `/api/icon` |
| `SynologyHandler` | Synology DSM XML API (`/?arch=…`) |
| `BrowserHandler` | Browser UI: `/`, `/?arch=…`, `/package/:name` |
| `UploadHandler` | `POST /api/upload` |
| `UploadPageHandler` | `GET /upload` |
| `DownloadHandler` | SPK file download |
| `DeleteHandler` | `DELETE /api/package/:name` |
| `NotFoundHandler` | 404 fallback |

### Storage

Three Cloudflare bindings are used:

- **R2** (`SPKS_BUCKET`): SPK files under `packages/`, themes under `themes/`, `conf/synology_models.yaml`, public JS/CSS
- **D1** (`SPKS_DB`): relational package metadata (name, arch, version, etc.)
- **KV** (`SPKS_CACHE`): metadata cache for fast reads

`SSPKS_STORAGE_BACKEND` env var selects the backend:
- `d1` – D1 only
- `kv` – KV only  
- `hybrid` – D1 for persistence + KV as read cache (**default/recommended**)

`StorageFactory.createStorage()` in `src/db/StorageFactory.ts` returns the appropriate `IStorage` implementation.

### HTML templates

Templates live in `templates/*.mustache` and `templates/partials/*.mustache`. The **`prebuild` script** (`scripts/build-templates.mjs`) compiles them into `src/output/templates.ts` as exported template literals.

> **Do not edit `src/output/templates.ts` directly** — it is auto-generated. Edit the `.mustache` source files instead, then run `npm run build`.

`HtmlOutput` (`src/output/HtmlOutput.ts`) renders templates via Mustache with base variables (siteName, baseUrl, themeUrl, year) merged with page-specific data.

### Configuration

All runtime config comes from Cloudflare env vars (defined in `wrangler.toml` `[vars]` or Worker secrets):

| Var | Purpose |
|---|---|
| `SSPKS_SITE_NAME` | Site title |
| `SSPKS_SITE_THEME` | Theme name (maps to `themes/<name>/` in R2) |
| `SSPKS_SITE_REDIRECTINDEX` | Redirect index page URL |
| `SSPKS_STORAGE_BACKEND` | `kv` / `d1` / `hybrid` |
| `SSPKS_PACKAGES_FILE_MASK` | Glob for SPK files |
| `SSPKS_API_KEY` | Auth key for upload/delete |
| `SSPKS_EXTERNAL_STORAGE_URL` | External storage URL for downloads |

### Testing

Tests use **`@cloudflare/vitest-pool-workers`** which runs tests inside a Miniflare (Workers) environment with mocked R2 and KV bindings. Tests live in `tests/unit/`. The vitest config is `vitest.config.ts`.
