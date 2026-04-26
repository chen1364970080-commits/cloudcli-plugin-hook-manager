/**
 * Hook Manager plugin — backend HTTP server.
 *
 * Reads and writes ~/.claude/settings.json, exposing hooks
 * configuration via HTTP API with safe read-modify-write.
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// ── Types ──────────────────────────────────────────────────────────────

interface HookEntry {
  type: string;
  command: string;
  [key: string]: unknown;
}

interface HookGroup {
  matcher: string;
  hooks: HookEntry[];
  disabled?: boolean;
}

interface HooksConfig {
  PreToolUse: HookGroup[];
  PostToolUse: HookGroup[];
}

interface SettingsData {
  hooks?: HooksConfig;
  [key: string]: unknown;
}

interface HooksResponse {
  hooks: HooksConfig;
  settingsPath: string;
}

// ── File helpers ───────────────────────────────────────────────────────

function getSettingsPath(): string {
  return path.join(os.homedir(), '.claude', 'settings.json');
}

function readSettings(): SettingsData {
  const settingsPath = getSettingsPath();
  const content = fs.readFileSync(settingsPath, 'utf-8');
  return JSON.parse(content);
}

function writeSettings(data: SettingsData): void {
  const settingsPath = getSettingsPath();
  const content = JSON.stringify(data, null, 2);
  fs.writeFileSync(settingsPath, content, 'utf-8');
}

function getHooks(): HooksConfig {
  const settings = readSettings();
  return settings.hooks ?? { PreToolUse: [], PostToolUse: [] };
}

function setHooks(hooks: HooksConfig): void {
  const settings = readSettings();
  settings.hooks = hooks;
  writeSettings(settings);
}

// ── HTTP server ────────────────────────────────────────────────────────

const server = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'GET' && req.url) {
    const url = new URL(req.url, 'http://127.0.0.1');

    if (url.pathname === '/hooks' || url.pathname === '/hooks/') {
      try {
        res.end(JSON.stringify({
          hooks: getHooks(),
          settingsPath: getSettingsPath(),
        }));
      } catch (err) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: (err as Error).message }));
      }
      return;
    }

    if (url.pathname === '/health') {
      res.end(JSON.stringify({ ok: true }));
      return;
    }
  }

  if (req.method === 'PUT' && req.url) {
    const url = new URL(req.url, 'http://127.0.0.1');

    if (url.pathname === '/hooks' || url.pathname === '/hooks/') {
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (!parsed.hooks || typeof parsed.hooks !== 'object') {
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'Missing hooks field' }));
            return;
          }
          setHooks(parsed.hooks);
          res.end(JSON.stringify({ ok: true }));
        } catch (err) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: (err as Error).message }));
        }
      });
      return;
    }
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(0, '127.0.0.1', () => {
  const addr = server.address();
  if (addr && typeof addr !== 'string') {
    console.log(JSON.stringify({ ready: true, port: addr.port }));
  }
});
