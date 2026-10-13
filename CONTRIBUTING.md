# Contributing

Thanks for helping! Issues and pull requests are welcome in **English or Spanish**.
*¡Gracias por ayudar! Puedes escribir issues y pull requests en español o en inglés.*

## Before you start

- **Bug:** open an issue with the command you ran, the full error, your OS and Node.js version,
  and, if possible, a minimal script or config that reproduces it.
- **New feature:** open an issue first to agree on the approach before writing code.
- **Small fixes** (typos, docs, an obvious bug): send the pull request directly.

## Development

Requirements: Node.js ≥ 20 and pnpm 10.

```bash
pnpm install
```

```bash
pnpm test
```

```bash
pnpm typecheck
```

- `pnpm test` builds every package and runs Vitest. It must pass before you open a pull request.
- If you change a Zod schema in `packages/content-schema`, run `pnpm build` and commit the regenerated
  files in `packages/content-schema/schema/`.
- If you change the plugin or the skill, run `claude plugin validate .`.

## Pull requests

- One change per pull request, with a short description of what it changes and why.
- Add or update a test when you change behavior.
- Update `README.md`, `README.es.md` or `docs/` when you change a command, an option or a format.
- Keep backward compatibility of the manifest, tours and video scripts. If a breaking change is
  unavoidable, follow [docs/actualizacion.md](docs/actualizacion.md).
- Do not commit generated output (`dist/`, `out/`, videos, audio) or downloaded voices/browsers.

## Content and privacy

Screenshots, scripts and examples must use **fictitious data only**. Never include real names,
phone numbers, emails, IDs, customer data, internal URLs or credentials.

## Security

Do not report vulnerabilities in public issues. Use **Security → Report a vulnerability**
(GitHub private reporting) on this repository.

## License

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).
