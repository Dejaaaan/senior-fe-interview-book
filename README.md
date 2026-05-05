# Senior Frontend Interview Prep — Book

A practical, code-first reference for senior frontend engineers preparing for technical interviews.

Covers the full stack a senior FE candidate is expected to discuss in 2026:

- **Web platform foundations** — TypeScript, modern JavaScript, HTML/CSS, accessibility, browser & web platform APIs.
- **Modern React** & **Next.js** (App Router, Server Components, Server Actions).
- **Angular basics** for interview survival.
- **Frontend architecture** — design systems, state machines, micro-frontends.
- **Production concerns** — performance & Core Web Vitals, testing, observability, build tooling, CI/CD, i18n, PWA, AI features.
- **Node.js backends** — the same Tasks API in **Express**, **Fastify**, and **NestJS**.
- **REST APIs & networking** (HTTP/2-3, TLS, caching) plus real-time (WebSockets, SSE, WebRTC).
- **Authentication & authorization** (sessions, JWT, OAuth2 / OIDC, PKCE, RBAC/ABAC).
- **Security & privacy** (OWASP Top 10, CSP, CORS, GDPR essentials).
- **Core AWS** for frontend engineers (IAM, S3, CloudFront, Lambda, API Gateway, DynamoDB, Cognito, CloudWatch, …).
- **Interview prep toolkit** — frontend system-design framework, worked prompts, behavioral & senior leadership.

Every chapter ends with **Key takeaways**, **Common interview questions**, and **Further reading**.

## Repository layout

```text
.
├── content/                 # SINGLE SOURCE OF TRUTH for the book (.md)
├── code/                    # Runnable code samples per chapter (pnpm workspaces)
├── web/                     # Docusaurus site (reads ../content)
└── print/                   # Quarto book project (renders ../content to PDF/EPUB/HTML)
```

The same Markdown is rendered by two pipelines:

- **Docusaurus** for the live web reading experience (search, navigation, dark mode).
- **Quarto** for distributable PDF and EPUB.

To stay portable, content uses only standard Markdown, fenced code blocks, Mermaid diagrams, YAML frontmatter, and blockquote-style callouts — no MDX imports and no renderer-specific shortcodes.

## Local development

### Prerequisites

- Node.js >= 20
- pnpm >= 9 (`npm install -g pnpm`)
- Quarto >= 1.6 — only needed for the PDF / EPUB / HTML print outputs; see [Installing Quarto](#installing-quarto) below.

### Installing Quarto

Download and install Quarto from the official Get Started page: <https://quarto.org/docs/get-started/>. The page lists installers for Windows, macOS, and Linux (deb / rpm / tarball).

Verify the installation:

```bash
quarto --version
quarto check
```

For PDF output, install the bundled minimal TeX distribution once after Quarto itself is installed:

```bash
quarto install tinytex
```

Mermaid diagrams are pre-rendered to PNG by [`@mermaid-js/mermaid-cli`](https://github.com/mermaid-js/mermaid-cli) (`mmdc`) before Quarto runs, so Quarto's own Chromium-based Mermaid pipeline is bypassed entirely. `mmdc` and a matching `puppeteer` are declared as root dev dependencies, and the `pnpm.onlyBuiltDependencies` whitelist in `package.json` allows Puppeteer's `postinstall` to download a headless Chromium (~150 MB) into `~/.cache/puppeteer/` on the first `pnpm install`. The `pnpm print:render` chain also calls `pnpm print:setup` (an idempotent `puppeteer browsers install`) so a missing browser is fixed automatically on the next render.

If `pnpm install` ran *before* the `puppeteer` whitelist landed in `package.json`, no `postinstall` fired. Recover with one of:

```bash
pnpm print:setup    # explicit re-install of chrome-headless-shell + chrome
# or
pnpm install --force   # re-run lifecycle scripts for everything
```

### Web (Docusaurus)

```bash
pnpm install
pnpm web:dev          # http://localhost:3000 — fast iteration, no search
pnpm web:build        # static site to web/build
pnpm web:preview      # build + serve at http://localhost:3000 — search works here
```

> **Note on search.** The local in-browser search index is generated only during
> `pnpm web:build`. The `pnpm web:dev` server skips indexing for fast hot-reload,
> so the search bar appears but returns no results in dev mode. To exercise
> search locally, run `pnpm web:preview`. The deployed site (built by CI) always
> has working search.

### Print (Quarto -> HTML, PDF, EPUB)

```bash
pnpm print:render     # outputs to print/_book/
pnpm print:preview    # live preview
```

> **Note on the print pipeline.** Both commands first run
> `print/scripts/preprocess.py`, which mirrors `content/` into `print/content/`
> with three transformations: every ` ```mermaid ` block is pre-rendered to
> a PNG by `mmdc` (Mermaid CLI) and replaced by an `![](path.png)` reference;
> internal Markdown links are rewritten from `.md` to `.qmd`; and the staged
> files themselves are renamed to `.qmd`. Pre-rendering Mermaid avoids a race
> condition in Quarto's bundled Chromium that produces truncated SVGs for
> some diagrams. The original Markdown source in `content/` keeps the
> Docusaurus-friendly ` ```mermaid ` form, so a single source feeds both
> pipelines. Diagrams are cached in `print/.mermaid-cache/` (keyed by SHA-256
> of each block's source) so re-renders only cost the diagrams that changed.
> Both `print/content/` and `print/.mermaid-cache/` are regenerated as needed
> and are gitignored.

### Code samples

Each subdirectory in [`code/`](./code) is its own package. Install everything with `pnpm install` from the repo root, then run a sample, e.g.:

```bash
pnpm --filter express-api dev
pnpm --filter nestjs-api start:dev
```

## Reading paths

You don't need to read all 13 parts linearly. Parts are numbered with Roman numerals (I–XIII) in the printable editions; the bullets below use those numbers. Suggested subsets:

- **AWS-heavy interview**: Parts II, III, IX, X, XI, XII.
- **Senior FE generalist**: Parts II, III, IV, VI, VII, IX, XIII.
- **Backend-leaning FE**: Parts II, III, VIII, IX, X, XI, XII.

## CI / CD

A single GitHub Actions workflow at [`.github/workflows/build-and-deploy.yml`](.github/workflows/build-and-deploy.yml) runs five jobs in parallel on every push to `main` and on every pull request:

| Job          | What it does                                                                                                                 | Required for deploy |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| `web`        | Installs dependencies and builds the Docusaurus site. Uploads the result as the GitHub Pages artifact.                       | Yes                 |
| `print`      | Renders the Quarto book to HTML, PDF, and EPUB. Uploads `print-build` as a downloadable workflow artifact (7-day retention). | No                  |
| `code-tests` | Runs `pnpm -r --if-present test` across the `code/*` workspace packages.                                                     | No (best-effort)    |
| `link-check` | Markdown link check (PR runs only).                                                                                          | No                  |
| `deploy`     | Pulls the `web` artifact and publishes it to GitHub Pages. Runs only on `push` to `main` and only if `web` succeeds.         | —                   |

Print artifacts (PDF + EPUB + HTML) are downloadable from the run page on `https://github.com/<owner>/<repo>/actions` under the **Artifacts** section.

### One-time GitHub Pages setup

Before the first successful deploy, enable GitHub Actions as the Pages source:

1. Open `Settings → Pages` in the repository.
2. Under **Build and deployment → Source**, select **GitHub Actions**.

The default `GITHUB_TOKEN` cannot create the Pages site itself, which is why this step has to be done in the UI exactly once per repository.

### Deploying somewhere other than GitHub Pages

Swap the final `deploy` job's `actions/deploy-pages@v4` step for the equivalent action (S3 + CloudFront, Vercel, Cloudflare Pages, Netlify, …). The artifact uploaded by `web` is the same `web/build/` directory regardless of target.

## Search

The Docusaurus site ships with offline, in-browser full-text search via [`@easyops-cn/docusaurus-search-local`](https://github.com/easyops-cn/docusaurus-search-local). The search index is generated as part of `pnpm web:build` and queried entirely on the client — no external service, no API keys, no network call per search. The index covers every chapter under [`content/`](./content) and matches both titles and body text; matches are highlighted on the destination page.

The dev server (`pnpm web:dev`) intentionally skips indexing for fast hot-reload, so the search bar in dev mode appears but returns no results. To test search locally, run `pnpm web:preview` (which is `web:build` followed by `web:serve`) and open `http://localhost:3000`.

If you later want to swap to a hosted search service (Algolia DocSearch, Typesense, Meilisearch), the wiring is a one-file change in [`web/docusaurus.config.ts`](./web/docusaurus.config.ts) — drop the `@easyops-cn/docusaurus-search-local` theme and add the relevant integration block. Algolia DocSearch is free for open-source documentation but requires an application and a 1–2 week approval, which is why the local search is the default.

## Contributing

See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for chapter conventions, callout style, and how to run the build locally.

## License

Content: [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/).
Code samples: MIT (see `LICENSE-CODE`).
