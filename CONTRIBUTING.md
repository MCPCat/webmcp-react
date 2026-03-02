# Contributing

Thanks for wanting to contribute! Bug reports, feature requests, and PRs are all welcome.

If you're planning something non-trivial, [open an issue](https://github.com/MCPCat/webmcp-react/issues) first so we can all talk through it before you spend time on a PR.

## Setup

```bash
git clone https://github.com/mcpcat/webmcp-react.git
cd webmcp-react
pnpm install
```

You'll need pnpm since the repo uses pnpm workspaces.

## Development

| Command | What it does |
|---------|-------------|
| `pnpm build` | Build CJS + ESM + types via tsup |
| `pnpm test` | Run tests via Vitest |
| `pnpm test:watch` | Tests in watch mode |
| `pnpm typecheck` | TypeScript type check |
| `pnpm lint` | Biome lint + format check |
| `pnpm lint:fix` | Auto-fix lint + format issues |
| `pnpm dev:playground` | Vite playground app |
| `pnpm dev:nextjs` | Next.js example app |

There are precommit hooks (Husky + lint-staged) that auto-format staged `.ts`, `.tsx`, and `.json` files with Biome when you commit. This gets set up automatically when you run `pnpm install`.

The playground and Next.js example are handy for testing changes manually since not everthing is easy to cover with unit tests.

## Pull Requests

- One concern per PR
- Add tests for new stuff. Tests live in `src/**/__tests__/`
- Before pushing, make sure everything passes:
```bash
pnpm build && pnpm typecheck && pnpm lint && pnpm test
```

## Code Style

Biome handles formatting and linting, and the pre-commit hooks take care of it automatically, so you mostly don't need to worry about this. Run `pnpm lint:fix` if you want to fix things manually.

Commit messages: simple is preferred, but they get squashed anyway
PR: useful titles and description (TBH you should use AI to generate them anyway)

## AI-Assisted Contributions

This library literally exists to connect React apps with AI agents, so it would be pretty hypocritical to not encourage AI-assisted contributions. :)

If you used AI tools, just mention it brefly in your PR (what tool, how you used it). "Scaffolded tests with Claude, refined manually" that kind of thing is fine.

Otherwise the same rules apply as any other contribution:

- Understand your code. If a reviewer asks why something works, "the AI wrote it" isn't a great answer.
- Test it. Run the suite, check edge cases.
- Review every changed line before submitting.

## License

Contributions are licensed under [MIT](LICENSE), same as the project.
