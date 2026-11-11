# PDF Page Extractor

A responsive, private PDF page extraction web application.

**Live URL (after Pages enablement):** https://davidmahk-afk.github.io/pdf-extractor/

- Extract pages with ranges like `1-3, 5, 8-10`, custom order, or duplicates.
- Open password-protected source PDFs when you know the password.
- Optional AES-256 output password.
- No account, no backend, no file uploads, no analytics, no runtime third-party CDN.
- Files are processed on your computer or phone directly in the browser.

## Deployment

The included GitHub Actions workflow builds the site from `main` using the pinned version of official MuPDF.js and tests the page-selection parser.

**One-time:** Navigate to **Settings → Pages → Build and deployment → Source**, select **GitHub Actions**. Then rerun the workflow (Actions → Publish PDF Extractor to GitHub Pages → Run workflow). After setup, pushes to `main` deploy automatically.

## Local development

Install Node.js 22 or later:

```bash
npm install
npm test
mkdir -p vendor
cp node_modules/mupdf/dist/mupdf.js node_modules/mupdf/dist/mupdf-wasm.js node_modules/mupdf/dist/mupdf-wasm.wasm vendor/
python3 -m http.server 8000
```

Open http://localhost:8000 in a browser. The PDF engine must be served over HTTP (not opened as a local file).

## Privacy

The PDF input and passwords are handled in the user's browser; no PDF bytes are transmitted to GitHub. Static application code, the MuPDF WebAssembly engine, and files needed by the site are served from GitHub Pages. For sensitive documents avoid unknown public computers.

PDF page grafting retains vector content and searchable text in ordinary PDFs, unlike image-only export. Some advanced forms, embedded attachments and digital signatures may not survive page extraction, and signatures on the original are not preserved.

## Licensing

This application's source is distributed under **AGPL-3.0-or-later** to comply with the open-source license of [MuPDF.js](https://github.com/ArtifexSoftware/mupdf.js). See [GNU AGPL v3](https://www.gnu.org/licenses/agpl-3.0.html) and [ArtifexSoftware/mupdf](https://github.com/ArtifexSoftware/mupdf).
