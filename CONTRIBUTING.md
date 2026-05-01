# Contributing to Codabind

Thanks for being interested. Codabind is a small, deliberately self-contained project — short PRs are easier to review and merge.

## Before you start

- For **bug fixes**, just open a PR — issues are nice but not required.
- For **new features or larger refactors**, open an issue first so we can confirm fit before you spend time. The project is intentionally narrow (browser-only zone editor with live propagation checks). Adding scope creep — server-side parts, signups, analytics, telemetry — won't land.

## Dev setup

```bash
git clone https://github.com/codarn/codabind.git
cd codabind
npm install
npm run dev          # http://localhost:5173
```

Other useful scripts are in [the README](./README.md#common-scripts).

## Workflow

1. Branch from `main` — `feat/short-name`, `fix/what-broke`, or `chore/cleanup-thing`
2. Make your change, add or update tests
3. Run locally: `npm test && npm run build`
4. Push and open a PR — the CI workflow runs the same commands
5. Squash-merge once green; main is protected and direct pushes are blocked

## What we expect in a PR

- **Tests for new logic.** Pure modules in `src/zone/`, `src/dns/`, and `src/email/` have mirrored test files in `tests/`. Components are thin and don't have component tests today; if you add non-trivial UI logic, consider extracting it into a hook or selector that can be tested in isolation.
- **No new runtime dependencies** without a clear reason. The whole runtime today is `react` + `react-dom`. Dev tools are unconstrained.
- **No analytics / trackers / external embeds.** This is a self-operating tool — only DoH resolver calls and one GitHub stars fetch leave the browser.
- **Keep CSP strict.** If you need a new origin, add it to `vite.config.ts`'s `connect-src` allowlist explicitly. No wildcards.

## Code style

There is no ESLint config yet (might add one later). Until then:

- TypeScript `strict: true` and `noUncheckedIndexedAccess: true` are on — respect them, no `as any`, no `// @ts-ignore`.
- Match the surrounding style — 2-space indent, double-quoted strings, trailing commas, named exports.
- Keep components focused. If a file passes ~250 lines, it usually wants splitting.
- Domain logic (parsing, validating, diffing, linting) lives outside React. Components are presentation; hooks bridge them.

## Commit messages

Free-form, but explain the **why**, not just the what — the diff already shows what.
Good: `Parser: rescue unquoted TXT from registrar exports`
Less good: `Update parser`

## Reporting bugs

Use the [Bug report](https://github.com/codarn/codabind/issues/new?template=bug_report.yml) template. Include the zone snippet that triggered it (with anything sensitive removed) — most parser bugs reproduce from a one-line example.

## License

By contributing, you agree your changes are released under the project's [MIT license](./LICENSE).
