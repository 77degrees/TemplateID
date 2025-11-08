# Legal Hold Template ID Extractor (Chrome Extension)

Extract and catalog “Legal Hold Template” IDs from any web app you use. This extension observes JSON network traffic in the current tab, finds fields that look like legal hold template identifiers, infers human-readable names when possible, and shows them in a floating, draggable panel. Export everything to CSV in a click.

> Note: The UI text and CSV filename currently reference “Starbucks Legal” for internal use. You can change the branding by editing the display strings in `content.js`.

---

## What it does

- Hooks page-level `fetch` and `XMLHttpRequest` to inspect JSON responses in the current tab.
- Looks for keys matching `legal[_-]?hold[_-]?template[_-]?id` (case-insensitive).
- Infers display names from nearby fields like `templateName`, `title`, `label`, `displayName`, etc., while filtering out noisy names (e.g., path, user, host).
- Shows a floating panel listing all discovered IDs and inferred names.
- Lets you copy individual rows or export all results to CSV.
- Keyboard toggle: press `Ctrl + Alt + L` to show/hide the panel.

---

## Features

- Non-destructive hooks: Original `fetch`/XHR behavior is preserved.
- Robust parsing: Skips overly large bodies, strips JSON prefixes (e.g., Angular `)]}'`), and uses a quick prefilter to avoid parsing irrelevant payloads.
- Efficient traversal: Iterative graph walk with cycle protection and inherited-name propagation (avoids deep recursion and re-scans).
- Debounced UI updates: Smooth rendering without excessive reflows.
- Draggable panel with Collapse/Clear/Close controls and live count.
- CSV export with proper quoting.
- Accessibility: ARIA roles, focus outlines, and live updates on count.

---

## Keyboard Shortcut

- Toggle panel visibility: `Ctrl + Alt + L`
  - On macOS, use `Control + Option + L`.

---

## Install

### Option A: Load Unpacked (recommended for development)
1. Download or clone this repository.
2. Ensure these two files are present at the repo root:
   - `manifest.json` (Manifest V3)
   - `content.js`
3. Open Chrome and navigate to `chrome://extensions`.
4. Enable “Developer mode” (top-right).
5. Click “Load unpacked” and select the repository folder.

### Option B: ZIP package
1. Place `manifest.json` and `content.js` in a folder (e.g., `template-id-extension/`).
2. Zip the folder (examples):
   - macOS/Linux:
     ```bash
     zip -r template-id-extension.zip template-id-extension/
     ```
   - Windows (PowerShell):
     ```powershell
     Compress-Archive -Path template-id-extension -DestinationPath template-id-extension.zip
     ```
3. Distribute the ZIP; recipients can unzip and use “Load unpacked”.

### Option C: CRX (enterprise/internal distribution)
Chrome deprecated simple CRX sideloading for general users. For enterprise:
- Use `chrome://extensions` → “Pack extension” to generate a `.crx` and `.pem`.
- Distribute via your organization’s extension policy or management tooling.

---

## Usage

1. Browse as usual. The extension runs on all pages (configurable via `manifest.json` matches).
2. When a page makes JSON requests, the extension inspects responses and extracts matches.
3. Toggle the panel with `Ctrl + Alt + L` to see:
   - Template ID
   - Inferred Template Name (when available)
   - Per-row “Copy” button (copies `ID,Name`)
4. Use “Download CSV” to export all rows:
   - Filename format: `Starbucks_LegalHoldTemplates_YYYY-MM-DDTHH-MM-SSZ.csv`
5. “Clear” removes all currently collected results (per tab/page session).
6. “Collapse” hides/shows the table content while keeping the header visible.
7. “Close” hides the panel (use hotkey to bring it back).

---

## Privacy & Security

- All processing happens locally in your browser tab.
- No network calls are made by the extension beyond observing the page’s own JSON traffic.
- Be mindful that the panel can display internal IDs and names—handle exported CSVs according to your organization’s data policies.
- The extension accumulates IDs during the current page session; it clears on navigation if configured (see `CLEAR_ON_UNLOAD` in `content.js`).

---

## Configuration (in `content.js`)

- `DEBUG`: Set to `true` for console diagnostics.
- `BODY_CHAR_LIMIT`: Max characters to consider for JSON bodies (default: 2,000,000).
- `PREFILTER_SUBSTRINGS`: Cheap text prefilter before parsing JSON (default: `['legal', 'template']`).
- `MAX_OBJECTS`: Safety cap while traversing large JSON graphs (default: 250,000 objects).
- `CLEAR_ON_UNLOAD`: Clear collected IDs when navigating away (default: `true`).
- UI Branding: search for “Starbucks Legal” strings and adjust to your needs.

---

## Development

- Manifest: Vite or bundlers are not required; this is a single-file content script plus `manifest.json`.
- Context: We inject a small script tag to run in page context so `fetch`/XHR hooks apply to the app’s JS (content scripts alone can’t patch page-level JS).
- Structure:
  ```
  .
  ├── content.js      # Main logic; panel UI + network hooks
  └── manifest.json   # MV3 manifest
  ```
- Recommended test flow:
  1. `chrome://extensions` → “Load unpacked”
  2. Browse a target app that returns JSON
  3. Use `Ctrl + Alt + L` to open/close panel
  4. Verify IDs populate and CSV export works

### Coding Notes
- Avoid heavy logging in production; enable `DEBUG` only when needed.
- Keep matching regexes in sync with your actual data fields.
- If performance becomes an issue on certain pages, narrow `matches` in `manifest.json` or refine `PREFILTER_SUBSTRINGS`.

---

## Troubleshooting

- Panel doesn’t appear:
  - Press `Ctrl + Alt + L`.
  - Ensure the extension is enabled in `chrome://extensions`.
  - Some pages with strict CSP may interfere; the injected script approach typically works around content script isolation, but site CSPs vary.
- No IDs found:
  - Confirm the target app actually returns JSON with fields matching the ID pattern.
  - Adjust `PREFILTER_SUBSTRINGS` if legitimate payloads don’t include “legal” or “template.”
- Performance concerns:
  - Reduce `MAX_OBJECTS`, narrow `matches` in `manifest.json`, or refine the prefilter list.

---

## Roadmap Ideas

- Options page to:
  - Configure hotkeys, branding text, and filters without editing code.
  - Limit scanning to specific domains.
- Multi-export formats (JSON, XLSX).
- Persistent per-domain settings.
- Search/filter in the panel.

---

## Changelog

- 1.1.0
  - Fix: duplicate panel builds and out-of-scope hotkey handler.
  - Perf: debounced renders, inherited-name propagation, WeakSet cycle guard, prefilter before JSON parse, and safety caps.
  - UX: ARIA roles, focus outlines, improved drag behavior, better CSV escaping.
  - Config: `DEBUG`, `CLEAR_ON_UNLOAD`, `MAX_OBJECTS`, `PREFILTER_SUBSTRINGS`.

---

## License

TBD. If this is internal-only, add a suitable notice or license. If open source, consider MIT/Apache-2.0 and add a `LICENSE` file.

---

## Credits

Built by Kyle for Starbucks Legal. Refactors and documentation by contributors.
