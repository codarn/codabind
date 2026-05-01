# Codabind

A browser-only BIND zone file editor with live propagation checks across multiple DNS resolvers and email-deliverability linting.

🌍 **Live**: [codabind.com](https://codabind.com)
📦 **Source**: this repo
📜 **License**: [MIT](./LICENSE)

![Codabind](public/og-image.png)

## What it does

- **Edit BIND zone files** in a structured per-record-type editor (SOA, NS, A, AAAA, CNAME, MX, TXT, SRV, PTR, CAA)
- **Validate as you type** — IPv4/IPv6, hostnames, durations, CNAME-coexistence rules, SOA/NS presence
- **Group by FQDN** with a clickable domain tree on the left and a type filter
- **Check live propagation** across Cloudflare, Google, and DNS.SB DoH resolvers — see per-record match / propagating / mismatch / missing status with one click
- **Lint email config** — MX, SPF, DKIM (with provider recognition), DMARC — at the top of the editor
- **DMARC ramp helper** — one-click progression from monitoring → quarantine 25% → quarantine 100% → reject
- **Import / export** real zone files (handles registrar quirks like Loopia's unquoted TXT)

## Why

Most zone-editing tools either lock you into a registrar's UI or require server-side parsing. Codabind is a single static page — your zone file never leaves the browser, no backend, no telemetry, no signups. The only network I/O is DoH lookups to public resolvers (only when you click "Check propagation") and a single GitHub API call for the star count in the header.

## Stack

- **React 19** + **TypeScript 6** + **Vite 8**
- **Vitest 4** for tests (107 tests, 91 % line coverage)
- **DoH JSON** for live DNS — Cloudflare, Google, DNS.SB
- **No runtime dependencies** beyond React; everything else is dev-only
- Hosted on **GitHub Pages** with a strict CSP (`script-src 'self'`, `connect-src` allowlist)

## Development

```bash
git clone https://github.com/codarn/codabind.git
cd codabind
npm install
npm run dev          # http://localhost:5173
```

### Common scripts

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | TypeScript check + Vite production build to `dist/` |
| `npm test` | Run vitest once |
| `npm run test:watch` | Vitest in watch mode |
| `npm run coverage` | Run tests with coverage report |
| `npm run audit` | `npm audit` filtered to runtime deps + high severity |
| `npm run og:build` | Regenerate `public/og-image.png` from the SVG |

### Project structure

```
src/
  App.tsx                    composition root
  main.tsx                   React 19 createRoot entry
  styles.css                 dark theme, single stylesheet
  zone/                      pure logic, no React
    types.ts                 discriminated union for RecordData
    parser.ts                BIND zone-file parser
    serializer.ts            zone → text
    validator.ts             per-record + zone-level rules
    tree.ts                  FQDN tree for the sidebar
    selectors.ts             pure derivations consumed by App
    constants.ts             named constants (UINT16/32_MAX, etc.)
  dns/                       live propagation checks
    resolvers.ts             DoH endpoint config
    query.ts                 fetch a DoH JSON answer
    diff.ts                  editor record vs live answer set
    types.ts                 LiveAnswer, ResolverResponse, Status
  email/                     email-deliverability linting
    checks.ts                MX / SPF / DKIM / DMARC checks
    dmarc-ramp.ts            ramp suggestions
  components/                presentation
    Topbar.tsx, ZoneMeta.tsx, StatusBar.tsx, IssuesPanel.tsx,
    EmailHealth.tsx, RecordRow.tsx, RdataEditor.tsx, Field.tsx,
    DomainTree.tsx, ResolverChecks.tsx, Preview.tsx,
    Logo.tsx, GitHubLink.tsx
  hooks/
    useZoneFile.ts           import + size guard + export
    useDnsCheck.ts           DoH fan-out with concurrency + cancel
tests/                       vitest, mirrors zone/dns/email layout
public/                      static assets (favicon, og-image)
.github/workflows/ci.yml     CI + Pages deploy
scripts/gen-og-png.mjs       SVG → PNG renderer (resvg-js)
```

## Self-operating

The project is intentionally self-contained:

- **No analytics, no trackers, no third-party JS embeds**
- The only outbound traffic at runtime: DoH JSON to the chosen resolvers (when you click "Check propagation") and `api.github.com` for the star count
- No cookies, no localStorage of user data — only an in-memory zone state and a 10-minute sessionStorage cache for the GitHub star count
- Every dependency is either a runtime essential (React) or a dev-only build/test tool

## Contributing

PRs welcome. Workflow:

1. Branch from `main` (`git checkout -b feat/your-thing`)
2. Code + tests
3. `npm test && npm run build` locally
4. Open a PR — CI runs build, audit, and the test suite
5. Squash-merge once green; main is protected (no direct pushes)

## License

MIT © Codarn AB. See [LICENSE](./LICENSE).
