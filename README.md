# CloudCLI Plugin: Hook Manager

A sidebar tab plugin for [Claude Code](https://claude.ai/code) for managing hooks in `~/.claude/settings.json` with a visual editor.

## What It Does

Claude Code hooks are configured in `~/.claude/settings.json` under the `hooks` key. There is no built-in UI for managing them — you have to edit JSON manually. This plugin provides a visual interface to add, remove, enable, and disable `PreToolUse` and `PostToolUse` hooks. Auto-refreshes every 5 seconds to detect external changes.

## Features

- **Visual editor** — No need to edit JSON by hand
- **PreToolUse hooks** — Configure hooks that run before tool execution
- **PostToolUse hooks** — Configure hooks that run after tool execution
- **Enable/disable** — Toggle hooks without deleting them
- **Matcher patterns** — Support for tool-specific hooks (e.g. "Bash", "Read")
- **Add new hooks** — Simple prompt-based hook creation
- **Delete hooks** — Remove unwanted hook groups
- **Dark + light themes** — Automatic theme switching

## Architecture

```
hook-manager/
├── manifest.json       # Plugin descriptor
├── src/
│   ├── server.ts       # Backend HTTP server — reads/writes settings.json
│   │                    # Safe read-modify-write with JSON validation
│   ├── index.ts        # Frontend (vanilla JS, polling every 5s)
│   └── types.ts        # PluginAPI type definitions
├── dist/               # Compiled output (tsc)
├── icon.svg
├── package.json
└── tsconfig.json
```

## How It Works

The server reads `~/.claude/settings.json` and exposes the hooks configuration:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "pnpm prettier --write \"$FILE_PATH\""
          }
        ],
        "disabled": false
      }
    ],
    "PostToolUse": []
  }
}
```

### Hook Group Structure

- **matcher** — Pattern to match tool names (`*` = all tools, `Bash` = only Bash tool, etc.)
- **hooks** — Array of hook entries to execute
- **disabled** — When `true`, the hook group is inactive (not deleted)

### Hook Entry Types

- **command** — Execute a shell command. Can use `$FILE_PATH` variable.
- **transform** — Transform tool input/output (advanced)

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/hooks` | GET | Get current hooks configuration from settings.json |
| `/hooks` | PUT | Replace hooks configuration (write to settings.json) |
| `/health` | GET | Server health check |

### Response: `/hooks`

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "*",
        "hooks": [
          { "type": "command", "command": "..." }
        ],
        "disabled": false
      }
    ],
    "PostToolUse": []
  },
  "settingsPath": "C:\Users\...\settings.json"
}
```

## Installation

```bash
# 1. Clone or copy the plugin
git clone https://github.com/chen1364970080-commits/cloudcli-plugin-hook-manager.git

# 2. Install into Claude Code plugins directory
cp -r cloudcli-plugin-hook-manager ~/.claude-code-ui/plugins/hook-manager

# 3. Build
cd ~/.claude-code-ui/plugins/hook-manager
npm install
npm run build

# 4. Restart Claude Code — the "Hooks" tab appears in the sidebar
```

## Requirements

- Claude Code with plugin support (UI v2+)
- Node.js (the backend server uses native Node APIs)

## Key Design Decisions

- **No framework** — vanilla JS + CSS for the frontend.
- **Poll-based** — 5-second polling to detect external settings.json changes.
- **Safe write** — Reads settings.json, modifies hooks section, writes back. Never overwrites unrelated settings.
- **Toggle vs delete** — Disabling a hook sets `disabled: true` rather than removing it, preserving configuration for later re-enable.

## License

MIT
