# WaynePDF

Amazing Markdown to PDF — offline, private, and yours to configure.

Based on [md2pdf](https://github.com/realdennis/md2pdf) by realdennis (MIT, see `UPSTREAM_LICENSE`).

> This is a stub. The full README lands in a later phase.

## Requirements

- Node 22 LTS (see `.nvmrc`)
- pnpm

## Commands

```bash
pnpm install       # install dependencies
pnpm dev           # start the dev server
pnpm build         # production build to dist/
pnpm preview       # serve the production build
pnpm test          # unit tests (Vitest)
pnpm test:e2e      # browser tests (Playwright)
pnpm lint          # lint src and tests
pnpm format        # format with Prettier
```

## Docker

```bash
docker build -t waynepdf .
docker run -p 8080:80 waynepdf
```

## License

MIT © 2026 Michael Mgbah. Portions © 2019 realdennis.
