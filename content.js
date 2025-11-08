/* Refactored version 1.1.1 – scoped to Exterro Legal Hold Templates route */
(function injectLegalHoldExtractor() {

  const ROUTE_HASH = '#/settings/lhTemplates';        // Target hash route
  const ROUTE_MATCH = /\/settings\/lhTemplates$/;     // Flexible test if hash evolves

  function onCorrectRoute() {
    // Normalize hash (strip optional leading #)
    const h = location.hash || '';
    return h === ROUTE_HASH || ROUTE_MATCH.test(h.replace(/^#/, ''));
  }

  // Defer injection until correct hash route is active
  function waitForTargetRoute(start) {
    if (onCorrectRoute()) {
      start();
      return;
    }
    const handler = () => {
      if (onCorrectRoute()) {
        window.removeEventListener('hashchange', handler);
        start();
      }
    };
    window.addEventListener('hashchange', handler);
  }

  const install = function install() {
    // We delay activation until the hash route is correct
    waitForTargetRoute(activate);

    function activate() {
      if (window.__LH_TEMPLATE_V3__) return;
      window.__LH_TEMPLATE_V3__ = true;

      /**********************
       * Configuration Flags
       **********************/
      const DEBUG = false; // Set true for console diagnostics
      const BODY_CHAR_LIMIT = 2_000_000;
      const PREFILTER_SUBSTRINGS = ['legal', 'template'];
      const MAX_OBJECTS = 250_000;
      const CLEAR_ON_UNLOAD = true;

      /**********************
       * Matching Patterns
       **********************/
      const ID_KEY = /legal[_\-]?hold[_\-]?template[_\-]?id/i;
      const NAME_KEYS = [
        /^template[_\-]?(name|title|label)$/i,
        /^legal[_\-]?hold.*template.*(name|title|label)$/i,
        /^display[_\-]?name$/i,
        /^title$/i,
        /^label$/i,
        /^name$/i
      ];
      const NAME_EXCLUDES = /(user|file|path|folder|dir|owner|group|env|host|machine)/i;

      const TOGGLE_HOTKEY = (e) => e.ctrlKey && e.altKey && e.key.toLowerCase() === 'l';

      /**********************
       * Data Structures
       **********************/
      const foundIds = new Set();
      const idToName = new Map();

      let needsRender = false;
      function scheduleRender() {
        if (needsRender) return;
        needsRender = true;
        requestAnimationFrame(() => {
          needsRender = false;
            if (panelHost && !panelHost.classList.contains('hidden')) renderTable();
          updateCount();
        });
      }

      function log(...args) {
        if (DEBUG) console.log('[LH Template]', ...args);
      }

      /**********************
       * ID / Name Extraction
       **********************/
      function findIdKeys(obj) {
        const ids = [];
        for (const [k, v] of Object.entries(obj)) {
          if (ID_KEY.test(k) && (typeof v === 'string' || typeof v === 'number')) {
            const s = String(v).trim();
            if (s) ids.push(s);
          }
        }
        return ids;
      }

      function findNameCandidate(obj) {
        for (const re of NAME_KEYS) {
          for (const [k, v] of Object.entries(obj)) {
            if (!re.test(k)) continue;
            const s = String(v ?? '').trim();
            if (s && !NAME_EXCLUDES.test(s)) return s;
          }
        }
        return '';
      }

      function addMapping(id, name) {
        if (!id) return;
        const trimmedId = String(id).trim();
        if (!trimmedId) return;
        let trimmedName = (name || '').trim();
        if (trimmedName && NAME_EXCLUDES.test(trimmedName)) trimmedName = '';
        let changed = false;
        if (!foundIds.has(trimmedId)) {
          foundIds.add(trimmedId);
          changed = true;
        }
        if (trimmedName && !idToName.has(trimmedId)) {
          idToName.set(trimmedId, trimmedName);
          changed = true;
        }
        if (changed) scheduleRender();
      }

      /**********************
       * JSON Parsing
       **********************/
      function prefilterLikelyRelevant(text) {
        if (!PREFILTER_SUBSTRINGS.length) return true;
        const lower = text.slice(0, 20000).toLowerCase();
        return PREFILTER_SUBSTRINGS.some(s => lower.includes(s));
      }

      function parseJsonSafely(text) {
        try {
          if (!text || typeof text !== 'string') return null;
          if (BODY_CHAR_LIMIT && text.length > BODY_CHAR_LIMIT) return null;
          if (!prefilterLikelyRelevant(text)) return null;
          const cleaned = text.trim().replace(/^\)\]\}',?/, '');
          return JSON.parse(cleaned);
        } catch {
          return null;
        }
      }

      /**********************
       * Graph Walk
       **********************/
      function walk(rootObj) {
        if (!rootObj || typeof rootObj !== 'object') return;
        const visited = new WeakSet();
        const stack = [{ obj: rootObj, inheritedName: '' }];
        let processed = 0;

        while (stack.length) {
          const frame = stack.pop();
          const obj = frame.obj;
          if (!obj || typeof obj !== 'object') continue;
          if (visited.has(obj)) continue;
          visited.add(obj);
          processed++;
          if (processed > MAX_OBJECTS) {
            log('Traversal aborted: MAX_OBJECTS limit.');
            break;
          }

          if (Array.isArray(obj)) {
            for (let i = obj.length - 1; i >= 0; i--) {
              const child = obj[i];
              if (child && typeof child === 'object') {
                stack.push({ obj: child, inheritedName: frame.inheritedName });
              }
            }
            continue;
          }

          const ids = findIdKeys(obj);
          const localName = findNameCandidate(obj);
          const effectiveName = localName || frame.inheritedName;
          if (ids.length) {
            for (const id of ids) addMapping(id, effectiveName);
          }

          const nextInherited = localName || frame.inheritedName;
          for (const v of Object.values(obj)) {
            if (v && typeof v === 'object') {
              stack.push({ obj: v, inheritedName: nextInherited });
            }
          }
        }
      }

      /**********************
       * Panel UI
       **********************/
      let panelHost = null;
      let bodyEl = null;
      let countEl = null;

      function buildPanel() {
        if (panelHost) return panelHost;
        if (!document.documentElement) return null;

        const host = document.createElement('div');
        host.id = 'lh-template-v3-shadow-host';
        host.setAttribute('role', 'region');
        host.setAttribute('aria-label', 'Legal Hold Template Panel');
        Object.assign(host.style, {
          all: 'initial',
          position: 'fixed',
          right: '16px',
          bottom: '16px',
          width: '460px',
          maxHeight: '72vh',
          zIndex: 2147483647,
          fontFamily: 'SoDo Sans, Segoe UI, Roboto, Arial, sans-serif'
        });
        (document.head || document.documentElement).appendChild(host);
        const shadow = host.attachShadow({ mode: 'open' });

        const style = document.createElement('style');
        style.textContent = `
          :host { all: initial; }
          .panel {
            box-shadow: 0 8px 24px rgba(0,0,0,0.18);
            border: 1px solid #d0d7de;
            border-radius: 10px;
            background: #ffffff;
            overflow: hidden;
            display: flex;
            flex-direction: column;
          }
          .hdr {
            background: #006241;
            color: #fff;
            padding: 8px 12px;
            display: flex;
            align-items: center;
            gap: 8px;
            user-select: none;
            cursor: move;
          }
            .hdr button:focus, .btns button:focus { outline: 2px solid #1e3932; outline-offset: 2px; }
          .title { font-weight: 600; font-size: 14px; }
          .spacer { flex: 1 }
          .pill { background: rgba(255,255,255,0.25); padding: 2px 8px; border-radius: 999px; font-size: 12px; }
          .btns { display: flex; gap: 6px; }
          button {
            all: unset;
            background: #ffffff;
            color: #006241;
            border: 1px solid #a7c7b7;
            border-radius: 6px;
            padding: 4px 8px;
            font-size: 12px;
            cursor: pointer;
          }
          button:hover { background: #f1f9f6; }
          button:active { background: #e3f2ec; }
          .body {
            padding: 8px;
            display: grid;
            grid-template-columns: 1fr 1fr auto;
            gap: 6px;
            align-items: center;
            max-height: 52vh;
            overflow: auto;
          }
          .head {
            font-weight: 600;
            color: #1e3932;
            border-bottom: 1px solid #e5e7eb;
            padding-bottom: 4px;
            margin-bottom: 2px;
          }
          .cell {
            font-size: 12px;
            background: #f6f8fa;
            border: 1px solid #d0d7de;
            border-radius: 6px;
            padding: 6px 8px;
            overflow: hidden;
            white-space: nowrap;
            text-overflow: ellipsis;
          }
          .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
          .foot { color: #6b6b6b; font-size: 11px; }
          .hidden { display: none !important; }
        `;
        shadow.appendChild(style);

        const panel = document.createElement('div');
        panel.className = 'panel';
        panel.innerHTML = `
          <div class="hdr" id="drag">
            <div class="title">Legal Hold Templates</div>
            <div class="spacer"></div>
            <div class="pill" id="count" aria-live="polite">0</div>
            <div class="btns">
              <button id="downloadCsv" aria-label="Download CSV">Download CSV</button>
              <button id="clear" aria-label="Clear list">Clear</button>
              <button id="collapse" aria-label="Collapse table">Collapse</button>
              <button id="close" aria-label="Close panel">Close</button>
            </div>
          </div>
          <div class="body" id="body" role="table" aria-label="Template IDs"></div>
          <div class="foot">Ctrl + Alt + L to toggle</div>
        `;
        shadow.appendChild(panel);

        bodyEl = shadow.getElementById('body');
        countEl = shadow.getElementById('count');

        enableDrag(host, shadow.getElementById('drag'));
        wireButtons(host, shadow);

        renderTable();
        updateCount();

        panelHost = host;
        return host;
      }

      function renderHeader() {
        if (!bodyEl) return;
        const idHead = document.createElement('div');
        const nameHead = document.createElement('div');
        const actHead = document.createElement('div');
        idHead.textContent = 'Template ID';
        nameHead.textContent = 'Template Name';
        actHead.textContent = 'Actions';
        idHead.className = 'head';
        nameHead.className = 'head';
        actHead.className = 'head';
        bodyEl.appendChild(idHead);
        bodyEl.appendChild(nameHead);
        bodyEl.appendChild(actHead);
      }

      function renderTable() {
        if (!bodyEl) return;
        bodyEl.innerHTML = '';
        renderHeader();

        const rows = Array.from(foundIds.values())
          .map(id => ({ id, name: idToName.get(id) || '' }))
          .sort((a, b) => a.id.localeCompare(b.id, undefined, { sensitivity: 'base' }));

        for (const { id, name } of rows) {
          const idCell = document.createElement('div');
          idCell.className = 'cell mono';
          idCell.title = id;
          idCell.textContent = id;

          const nameCell = document.createElement('div');
          nameCell.className = 'cell';
          nameCell.title = name || '(unknown)';
          nameCell.textContent = name || '—';

          const actCell = document.createElement('div');
          actCell.style.display = 'flex';
          actCell.style.gap = '6px';

          const copyBtn = document.createElement('button');
          copyBtn.textContent = 'Copy';
          copyBtn.setAttribute('aria-label', `Copy ID ${id}`);
          copyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(`${id},${name ?? ''}`).catch(() => {});
          });
          actCell.appendChild(copyBtn);

          bodyEl.appendChild(idCell);
          bodyEl.appendChild(nameCell);
          bodyEl.appendChild(actCell);
        }
      }

      function updateCount() {
        if (countEl) countEl.textContent = String(foundIds.size);
      }

      function wireButtons(host, shadow) {
        shadow.getElementById('downloadCsv').addEventListener('click', downloadCsv);
        shadow.getElementById('clear').addEventListener('click', () => {
          foundIds.clear();
          idToName.clear();
          scheduleRender();
        });
        shadow.getElementById('collapse').addEventListener('click', (e) => {
          bodyEl.classList.toggle('hidden');
          e.target.textContent = bodyEl.classList.contains('hidden') ? 'Expand' : 'Collapse';
        });
        shadow.getElementById('close').addEventListener('click', () => {
          host.classList.add('hidden');
        });
      }

      function downloadCsv() {
        const rows = Array.from(foundIds.values())
          .map(id => ({ id, name: idToName.get(id) || '' }))
          .sort((a, b) => a.id.localeCompare(b.id, undefined, { sensitivity: 'base' }))
          .map(({ id, name }) => [id, name]);
        const csv = ['Template ID,Template Name', ...rows.map(([i, n]) => {
          const esc = (s) => `"${String(s).replace(/"/g, '""')}"`;
          return `${esc(i)},${esc(n)}`;
        })].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `LegalHoldTemplates_${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
        const parent = document.body || document.documentElement || panelHost;
        parent.appendChild(a);
        a.click();
        parent.removeChild(a);
        URL.revokeObjectURL(url);
      }

      function enableDrag(host, dragHandle) {
        let sx = 0, sy = 0, ox = 0, oy = 0, dragging = false;
        dragHandle.addEventListener('mousedown', (e) => {
          dragging = true;
          sx = e.clientX; sy = e.clientY;
          const r = host.getBoundingClientRect();
          ox = window.innerWidth - r.right;
          oy = window.innerHeight - r.bottom;
          e.preventDefault();
        });
        window.addEventListener('mousemove', (e) => {
          if (!dragging) return;
          const dx = e.clientX - sx;
          const dy = e.clientY - sy;
          host.style.right = `${Math.max(8, ox - dx)}px`;
          host.style.bottom = `${Math.max(8, oy - dy)}px`;
        });
        window.addEventListener('mouseup', () => dragging = false);
      }

      /**********************
       * Hotkey Toggle
       **********************/
      window.addEventListener('keydown', (e) => {
        if (TOGGLE_HOTKEY(e)) {
          if (!panelHost) buildPanel();
          if (panelHost) {
            panelHost.classList.toggle('hidden');
            if (!panelHost.classList.contains('hidden')) {
              scheduleRender();
            }
          }
        }
      });

      /**********************
       * Lifecycle
       **********************/
      function ensurePanelReady() {
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', () => buildPanel(), { once: true });
        } else {
          buildPanel();
        }
      }
      ensurePanelReady();

      if (CLEAR_ON_UNLOAD) {
        window.addEventListener('beforeunload', () => {
          foundIds.clear();
          idToName.clear();
        });
      }

      /**********************
       * Network Hooks
       **********************/
      (function hookFetch() {
        const origFetch = window.fetch;
        if (!origFetch) return;
        window.fetch = async function (...args) {
          const res = await origFetch.apply(this, args);
          try {
            const clone = res.clone();
            const ct = (clone.headers && clone.headers.get('content-type')) || '';
            if (/json/i.test(ct)) {
              const txt = await clone.text();
              const json = parseJsonSafely(txt);
              if (json) walk(json);
            }
          } catch (err) { log('fetch hook error', err); }
          return res;
        };
        Object.assign(window.fetch, origFetch);
      })();

      (function hookXHR() {
        const origSend = XMLHttpRequest.prototype.send;
        XMLHttpRequest.prototype.send = function (body) {
          this.addEventListener('load', function () {
            try {
              let text = '';
              if (this.responseType === '' || this.responseType === 'text') {
                text = String(this.responseText || '');
              } else if (this.responseType === 'json') {
                text = JSON.stringify(this.response);
              } else return;
              const json = parseJsonSafely(text);
              if (json) walk(json);
            } catch (err) { log('xhr hook error', err); }
          });
          return origSend.apply(this, arguments);
        };
      })();
    } // end activate()
  };

  // Inject into the page context so fetch/XHR patching applies to page scripts.
  const script = document.createElement('script');
  script.textContent = `(${install.toString()})();`;
  (document.head || document.documentElement).appendChild(script);
  script.remove();
})();
