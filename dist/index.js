/**
 * Hook Manager plugin — frontend entry point.
 *
 * Visual editor for Claude Code hooks in settings.json.
 * Supports add, remove, enable, disable for PreToolUse and PostToolUse hooks.
 */
const MONO = "'JetBrains Mono', 'Fira Code', ui-monospace, monospace";
function themeColors(dark) {
    return dark
        ? {
            bg: '#08080f',
            surface: '#0e0e1a',
            surface2: '#13131f',
            border: '#1a1a2c',
            text: '#e2e0f0',
            muted: '#52507a',
            accent: '#fbbf24',
            danger: '#f43f5e',
            success: '#34d399',
            mono: MONO,
        }
        : {
            bg: '#fafaf9',
            surface: '#ffffff',
            surface2: '#f4f3ef',
            border: '#e8e6f0',
            text: '#0f0e1a',
            muted: '#9490b0',
            accent: '#d97706',
            danger: '#dc2626',
            success: '#059669',
            mono: MONO,
        };
}
// ── Helpers ────────────────────────────────────────────────────────────
function escHtml(s) {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
function truncateCmd(cmd, max = 60) {
    if (cmd.length <= max)
        return cmd;
    return cmd.slice(0, max - 3) + '...';
}
// ── Render ─────────────────────────────────────────────────────────────
function render(root, ctx, data, loading, error, saving) {
    const c = themeColors(ctx.theme === 'dark');
    root.style.background = c.bg;
    root.style.color = c.text;
    root.style.fontFamily = MONO;
    // Inject/update dynamic CSS
    let styleEl = document.getElementById('hm-styles');
    if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = 'hm-styles';
        document.head.appendChild(styleEl);
    }
    styleEl.textContent = `
    @keyframes hm-fadeup {
      from { opacity:0; transform:translateY(6px) }
      to   { opacity:1; transform:translateY(0) }
    }
    @keyframes hm-pulse {
      0%,100% { opacity:0.2 }
      50%      { opacity:0.4 }
    }
    @keyframes hm-spin {
      to { transform:rotate(360deg) }
    }
    .hm-up { animation: hm-fadeup 0.3s ease both }
    .hm-toggle {
      position:relative;display:inline-block;width:32px;height:18px;cursor:pointer;flex-shrink:0;
    }
    .hm-toggle input { opacity:0;width:0;height:0 }
    .hm-slider {
      position:absolute;inset:0;background:${c.border};border-radius:9px;
      transition:background 0.2s;
    }
    .hm-slider:before {
      content:'';position:absolute;width:12px;height:12px;left:3px;bottom:3px;
      background:white;border-radius:50%;transition:transform 0.2s;
    }
    input:checked + .hm-slider { background:${c.success} }
    input:checked + .hm-slider:before { transform:translateX(14px) }
    .hm-del-btn {
      background:none;border:none;cursor:pointer;padding:2px 6px;font-size:0.7rem;
      color:${c.danger};opacity:0.5;transition:opacity 0.15s;border-radius:3px;
    }
    .hm-del-btn:hover { opacity:1 }
    .hm-add-btn {
      background:none;border:1px dashed ${c.border};cursor:pointer;padding:8px 14px;
      font-family:${MONO};font-size:0.7rem;width:100%;border-radius:5px;
      display:flex;align-items:center;justify-content:center;gap:6px;
      transition:all 0.15s;color:${c.muted};background:${c.surface2};
    }
    .hm-add-btn:hover { border-color:${c.accent};color:${c.accent} }
    .hm-pending { opacity:0.5;pointer-events:none }
  `;
    const contentEl = root.querySelector('#hm-content');
    const savedScrollTop = contentEl ? contentEl.scrollTop : root.scrollTop;
    root.innerHTML = renderHtml(c, data, loading, error, saving);
    // Wire add buttons
    for (const btn of Array.from(root.querySelectorAll('[data-add-type]'))) {
        btn.addEventListener('click', () => {
            const type = btn.dataset.addType;
            const matcher = prompt('Enter matcher pattern (e.g. "Bash", "Read", "*"):', '*');
            if (!matcher)
                return;
            const command = prompt('Enter command to run:');
            if (!command)
                return;
            addHook(root, ctx, type, matcher.trim(), command.trim());
        });
    }
    // Wire delete buttons
    for (const btn of Array.from(root.querySelectorAll('[data-del-group]'))) {
        btn.addEventListener('click', () => {
            const type = btn.dataset.delType;
            const idx = parseInt(btn.dataset.delGroup);
            if (confirm('Delete this hook group?')) {
                deleteGroup(root, ctx, type, idx);
            }
        });
    }
    // Wire toggle switches
    for (const toggle of Array.from(root.querySelectorAll('[data-toggle-group]'))) {
        toggle.addEventListener('change', () => {
            const type = toggle.dataset.toggleType;
            const idx = parseInt(toggle.dataset.toggleGroup);
            toggleGroup(root, ctx, type, idx, toggle.checked);
        });
    }
    // Restore scroll
    const newContent = root.querySelector('#hm-content');
    if (newContent)
        newContent.scrollTop = savedScrollTop;
}
function renderHtml(c, data, loading, error, saving) {
    const totalGroups = (data?.hooks.PreToolUse.length ?? 0) + (data?.hooks.PostToolUse.length ?? 0);
    let content = `<div id="hm-content" style="flex:1;overflow-y:auto;padding:0 20px 20px;${saving ? 'opacity:0.6;pointer-events:none' : ''}">`;
    if (saving) {
        content += `<div style="padding:8px 0;font-size:0.68rem;color:${c.accent};display:flex;align-items:center;gap:6px">
      <span style="display:inline-block;width:10px;height:10px;border:1.5px solid ${c.muted};border-top-color:${c.accent};border-radius:50%;animation:hm-spin 0.6s linear infinite"></span>
      Saving...
    </div>`;
    }
    if (error) {
        content += `<div style="padding:12px;font-size:0.72rem;color:${c.danger};background:${c.danger}12;border:1px solid ${c.danger}44;border-radius:6px;margin-top:8px">✗ ${escHtml(error)}</div>`;
    }
    if (!data && !error) {
        if (loading) {
            for (const w of [60, 45, 70]) {
                content += `
          <div style="background:${c.surface};border:1px solid ${c.border};border-radius:6px;padding:14px;margin-top:10px">
            <div style="height:10px;background:${c.muted};border-radius:2px;opacity:0.2;width:${w}%;margin-bottom:8px;animation:hm-pulse 1.6s ease infinite"></div>
            <div style="height:8px;background:${c.muted};border-radius:2px;opacity:0.12;width:${Math.max(20, w - 20)}%;animation:hm-pulse 1.6s ease infinite;animation-delay:0.1s"></div>
          </div>`;
            }
        }
    }
    else if (data) {
        // Settings path
        content += `
      <div style="font-size:0.6rem;color:${c.muted};margin:8px 0 4px;opacity:0.5;font-family:${c.mono};word-break:break-all;padding:4px 8px;background:${c.surface2};border-radius:4px">
        ${escHtml(data.settingsPath)}
      </div>`;
        // PreToolUse section
        content += renderSection(c, data, 'PreToolUse', 'PreToolUse', 'Runs before a tool executes — validate input, modify params, or block execution');
        // PostToolUse section
        content += renderSection(c, data, 'PostToolUse', 'PostToolUse', 'Runs after a tool executes — format output, run checks, auto-fix');
        if (totalGroups === 0) {
            content += `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:40%;gap:10px;color:${c.muted};text-align:center;margin-top:20px">
          <div style="font-size:2rem;opacity:0.12">⚙</div>
          <div style="font-size:0.75rem;opacity:0.5">no hooks configured</div>
          <div style="font-size:0.65rem;opacity:0.3;max-width:260px;line-height:1.5">Add a PreToolUse or PostToolUse hook below to get started</div>
        </div>`;
        }
    }
    content += `</div>`;
    return `
    <div style="height:100%;display:flex;flex-direction:column;overflow:hidden">
      <div style="
        display:flex;align-items:center;justify-content:space-between;
        padding:16px 20px 12px;
        border-bottom:1px solid ${c.border};flex-shrink:0;
      ">
        <div style="display:flex;align-items:center;gap:10px">
          <span style="font-size:1rem;font-weight:700;letter-spacing:-0.02em">Hooks</span>
          ${loading ? `<span style="
            display:inline-block;width:11px;height:11px;
            border:1.5px solid ${c.muted};border-top-color:${c.accent};
            border-radius:50%;animation:hm-spin 0.7s linear infinite;
          "></span>` : ''}
        </div>
        ${data ? `<div style="font-size:0.65rem;color:${c.muted}">${totalGroups} hook${totalGroups !== 1 ? 's' : ''} configured</div>` : ''}
      </div>
      ${content}
    </div>
  `;
}
function renderSection(c, data, type, label, desc) {
    const groups = data.hooks[type];
    const icon = type === 'PreToolUse' ? '▶' : '✓';
    const iconColor = type === 'PreToolUse' ? c.accent : c.success;
    const labelText = type;
    let html = `
    <div style="margin-top:16px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-size:0.65rem;color:${iconColor};font-weight:700;letter-spacing:0.05em">${icon}</span>
          <span style="font-size:0.78rem;font-weight:600">${labelText}</span>
          <span style="font-size:0.6rem;color:${c.muted};padding:2px 6px;background:${c.surface};border:1px solid ${c.border};border-radius:3px">${groups.length}</span>
        </div>
      </div>
      <div style="font-size:0.65rem;color:${c.muted};margin-bottom:10px;opacity:0.7;line-height:1.4">${escHtml(desc)}</div>
  `;
    if (groups.length > 0) {
        for (let i = 0; i < groups.length; i++) {
            const group = groups[i];
            const isOn = !group.disabled;
            const delay = Math.min(i * 0.03, 0.3);
            html += `
        <div class="hm-up" style="
          background:${c.surface};border:1px solid ${c.border};
          border-radius:6px;padding:12px 14px;margin-bottom:8px;
          animation-delay:${delay}s;
          ${!isOn ? 'opacity:0.5' : ''}
        ">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
            <div style="display:flex;align-items:center;gap:8px">
              <span style="font-size:0.7rem;font-weight:600;padding:2px 7px;background:${c.bg};border:1px solid ${c.border};border-radius:3px;font-family:${c.mono}">${escHtml(group.matcher)}</span>
              ${!isOn ? `<span style="font-size:0.58rem;color:${c.muted};background:${c.surface2};padding:2px 6px;border-radius:3px">disabled</span>` : ''}
            </div>
            <div style="display:flex;align-items:center;gap:10px">
              <label class="hm-toggle">
                <input type="checkbox" ${isOn ? 'checked' : ''} data-toggle-type="${labelText}" data-toggle-group="${i}">
                <span class="hm-slider ${isOn ? 'on' : ''}"></span>
              </label>
              <button class="hm-del-btn" data-del-type="${labelText}" data-del-group="${i}">✗</button>
            </div>
          </div>
      `;
            for (const hook of group.hooks) {
                html += `
          <div style="
            display:flex;align-items:flex-start;gap:8px;
            background:${c.surface2};border-radius:4px;padding:6px 8px;margin-bottom:4px;
          ">
            <span style="font-size:0.58rem;color:${c.muted};flex-shrink:0;padding-top:2px">${escHtml(hook.type)}</span>
            <span style="font-size:0.65rem;color:${c.text};font-family:${c.mono};word-break:break-all;line-height:1.4" title="${escHtml(hook.command)}">${escHtml(truncateCmd(hook.command, 80))}</span>
          </div>`;
            }
            html += `</div>`;
        }
    }
    html += `
    <button class="hm-add-btn" data-add-type="${labelText}" style="margin-bottom:4px">
      <span style="font-size:0.8rem">+</span> Add ${labelText} hook
    </button>
  </div>`;
    return html;
}
// ── Actions ────────────────────────────────────────────────────────────
let api;
async function loadData(root, ctx, saving = false) {
    try {
        const data = (await api.rpc('GET', 'hooks'));
        root._hmData = data;
        root._hmError = null;
        render(root, ctx, data, false, null, saving);
    }
    catch (err) {
        root._hmError = err.message;
        render(root, ctx, root._hmData ?? null, false, err.message, saving);
    }
}
async function saveData(root, ctx, hooks) {
    render(root, ctx, root._hmData ?? null, false, null, true);
    try {
        await api.rpc('PUT', 'hooks', { hooks });
        root._hmData = { hooks, settingsPath: root._hmData?.settingsPath ?? '' };
        render(root, ctx, root._hmData, false, null, false);
    }
    catch (err) {
        render(root, ctx, root._hmData ?? null, false, err.message, false);
    }
}
function addHook(root, ctx, type, matcher, command) {
    const data = root._hmData;
    if (!data)
        return;
    const hooks = JSON.parse(JSON.stringify(data.hooks));
    hooks[type].push({
        matcher,
        hooks: [{ type: 'command', command }],
        disabled: false,
    });
    saveData(root, ctx, hooks);
}
function deleteGroup(root, ctx, type, idx) {
    const data = root._hmData;
    if (!data)
        return;
    const hooks = JSON.parse(JSON.stringify(data.hooks));
    hooks[type].splice(idx, 1);
    saveData(root, ctx, hooks);
}
function toggleGroup(root, ctx, type, idx, enabled) {
    const data = root._hmData;
    if (!data)
        return;
    const hooks = JSON.parse(JSON.stringify(data.hooks));
    hooks[type][idx].disabled = !enabled;
    saveData(root, ctx, hooks);
}
// ── Mount / Unmount ────────────────────────────────────────────────────
let pollInterval = null;
export function mount(container, pluginApi) {
    api = pluginApi;
    const ctx = api.context;
    const root = document.createElement('div');
    Object.assign(root.style, { height: '100%', boxSizing: 'border-box', overflow: 'hidden' });
    container.appendChild(root);
    loadData(root, ctx);
    // Poll every 5 seconds to catch external changes
    pollInterval = setInterval(() => loadData(root, api.context), 5000);
    const unsubscribe = api.onContextChange(() => {
        loadData(root, api.context);
    });
    container._hmUnsubscribe = unsubscribe;
}
export function unmount(container) {
    if (pollInterval !== null) {
        clearInterval(pollInterval);
        pollInterval = null;
    }
    if (typeof container._hmUnsubscribe === 'function') {
        container._hmUnsubscribe();
        delete container._hmUnsubscribe;
    }
    container.innerHTML = '';
}
//# sourceMappingURL=index.js.map