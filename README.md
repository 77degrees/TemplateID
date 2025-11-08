# LEGAL_HOLD_TEMPLATE Extractor – ST Legal Chrome Extension

This repository packages the LEGAL_HOLD_TEMPLATE (ID + Name) extractor userscript as a Chrome Extension.

## Installation

1. Clone or download this repository.
2. Open **chrome://extensions** in Google Chrome.
3. Enable **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select this folder.
5. The extension will begin running on every page at document start.

## Usage

* Open any Starbucks legal tooling page (or any page issuing fetch/XHR JSON responses containing template data).
* The extension monitors JSON responses and collects `LEGAL_HOLD_TEMPLATE_ID` values and their associated names.
* A Starbucks-branded floating panel displays collected IDs and names.
* Use **Download CSV** to export the results, **Clear** to reset, **Collapse** to hide the table, and **Close** to hide the panel entirely.
* Toggle the panel visibility at any time with **Ctrl + Alt + L**.
