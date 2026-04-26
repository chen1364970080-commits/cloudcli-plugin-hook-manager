# Hook Manager Plugin

CloudCLI UI plugin that manages Claude Code hooks in ~/.claude/settings.json.

## Build

```bash
npm install
npm run build
```

## Files

- `src/server.ts` — HTTP backend, reads/writes settings.json hooks section
- `src/index.ts` — Frontend UI, polls server every 5s
- `src/types.ts` — PluginAPI type definitions
- `dist/` — Compiled TypeScript output
