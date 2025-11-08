(function injectLegalHoldExtractor() {
  const install = function install() {
    if (window.__LH_TEMPLATE_V3__) return;
    window.__LH_TEMPLATE_V3__ = true;

    const ID_KEY = /legal[_\-]?hold[_\-]?template[_\-]?id/i;
    const NAME_KEYS = [
      /^template[_\-]?(name|title|label)$/i,
      /^legal[_\-]?hold.*template.*(name|title|label)$/i,
      /^display[_\-]?name$/i,
      /^title$/i,
      /^label$/i,
      /^name$/i,
    ];
    const NAME_EXCLUDES = /(user|file|path|folder|dir|owner|group|env|host|machine)/i;
    const BODY_CHAR_LIMIT = 2_000_000;
    const TOGGLE_HOTKEY = (e) => e.ctrlKey && e.altKey && e.key.toLowerCase() === 'l';

    const foundIds = new Set();
    const idToName = new Map();
    const listeners = new Set();
    const notify = () => listeners.forEach(fn => { try { fn(); } catch {} });

    function addMapping(id, name) {
      if (!id) return;
      const sId = String(id).trim();
      let sName = (name ?? '').trim();
      if (NAME_EXCLUDES.test(sName)) sName = '';
      if (sId) {
        if (!idToName.has(sId) && sName) idToName.set(sId, sName);
        foundIds.add(sId);
        notify();
      }
    }

    function findIdKeys(obj) {
      const ids = [];
      for (const [k, v] of Object.entries(obj)) {
        if (ID_KEY.test(k) && (typeof v === 'string' || typeof v === 'number')) ids.push(String(v));
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

    function parseJsonSafely(text) {
      try {
        if (!text || typeof text !== 'string') return null;
        if (BODY_CHAR_LIMIT && text.length > BODY_CHAR_LIMIT) return null;
        const cleaned = text.trim().replace(/^\)\]\}',?/, '');
        return JSON.parse(cleaned);
      } catch { return null; }
    }

    function walk(rootObj) {
      if (!rootObj || typeof rootObj !== 'object') return;
      const stack = [];
      // Each stack frame: { obj, parents }
      stack.push({ obj: rootObj, parents: [] });
      while (stack.length) {
        const { obj, parents } = stack.pop();
        if (!obj || typeof obj !== 'object') continue;
        if (Array.isArray(obj)) {
          for (let i = obj.length - 1; i >= 0; i--) {
            stack.push({ obj: obj[i], parents });
          }
          continue;
        }
        const ids = findIdKeys(obj);
        const name = findNameCandidate(obj);
        if (ids.length) {
          const inherited = name || parents.map(findNameCandidate).reverse().find(Boolean) || '';
          ids.forEach(id => addMapping(id, name || inherited));
        }
        // Avoid repeated array allocations: reuse parents array with push/pop
        // But since stack is LIFO, we can safely use parents.concat(obj) for each child
        // However, to avoid allocations, we can push the new parent chain only when needed
        const nextParents = parents.length < 20 ? parents.concat(obj) : [...parents, obj]; // limit chain length for safety
        for (const v of Object.values(obj)) {
          if (v && typeof v === 'object') {
            stack.push({ obj: v, parents: nextParents });
          }
        }
      }
    }

    function buildPanel() {
      if (!document.documentElement) {
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', buildPanel, { once: true });
        }
        return;
      }
      const host = document.createElement('div');
      host.id = 'lh-template-v3-shadow-host';
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
      document.documentElement.appendChild(host);
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
        .foot { color: #6b6b6b; font-size: 11px; padding: 0 8px 8px; }
        .hidden { display: none !important; }
      `;
      shadow.appendChild(style);

      const panel = document.createElement('div');
      panel.className = 'panel';
      panel.innerHTML = `
        <div class="hdr" id="drag">
          <div class="title">Starbucks Legal Hold Templates</div>
          <div class="spacer"></div>
          <div class="pill" id="count">0</div>
          <div class="btns">
            <button id="downloadCsv">Download CSV</button>
            <button id="clear">Clear</button>
            <button id="collapse">Collapse</button>
            <button id="close">Close</button>
          </div>
        </div>
        <div class="body" id="body"></div>
        <div class="foot">Ctrl + Alt + L to toggle | © Kyle – Starbucks Legal</div>
      `;
      shadow.appendChild(panel);

      const bodyEl = shadow.getElementById('body');
      const countEl = shadow.getElementById('count');

      function renderHeader() {
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

      function refresh() {
        bodyEl.innerHTML = '';
        renderHeader();

        const rows = Array.from(foundIds.values())
          .map(id => ({ id, name: idToName.get(id) || '' }))
          .sort((a, b) => a.id.localeCompare(b.id, undefined, { sensitivity: 'base' }));

        countEl.textContent = String(rows.length);

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
          copyBtn.addEventListener('click', () =>
            navigator.clipboard.writeText(`${id},${name ?? ''}`).catch(() => {})
          );
          actCell.appendChild(copyBtn);

          bodyEl.appendChild(idCell);
          bodyEl.appendChild(nameCell);
          bodyEl.appendChild(actCell);
        }
      }

      listeners.add(refresh);
      refresh();

      shadow.getElementById('downloadCsv').addEventListener('click', () => {
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
        a.download = `Starbucks_LegalHoldTemplates_${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
        // Use document.body if available, else document.documentElement, else shadow host
        const parent = document.body || document.documentElement || host;
        parent.appendChild(a);
        a.click();
        parent.removeChild(a);
        URL.revokeObjectURL(url);
      });

      shadow.getElementById('clear').addEventListener('click', () => {
        foundIds.clear();
        idToName.clear();
        refresh();
      });

      shadow.getElementById('collapse').addEventListener('click', (e) => {
        bodyEl.classList.toggle('hidden');
        e.target.textContent = bodyEl.classList.contains('hidden') ? 'Expand' : 'Collapse';
      });

      shadow.getElementById('close').addEventListener('click', () => {
        host.classList.add('hidden');
      });

      (function enableDrag() {
        const drag = shadow.getElementById('drag');
        let sx = 0, sy = 0, ox = 0, oy = 0, dragging = false;
        drag.addEventListener('mousedown', (e) => {
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
        window.addEventListener('keydown', (e) => {
          if (TOGGLE_HOTKEY(e)) host.classList.toggle('hidden');
        });
      })();
    }
    buildPanel();

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
        } catch {}
        return res;
      };
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
          } catch {}
        });
        return origSend.apply(this, arguments);
      };
    })();
  };

  const script = document.createElement('script');
  script.textContent = `(${install.toString()})();`;
  (document.head || document.documentElement).appendChild(script);
  script.remove();
})();
