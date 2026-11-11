import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import * as mupdf from 'mupdf';
import { chromium } from 'playwright';

const siteRoot = path.resolve('_site');
const mimeTypes = { '.html':'text/html', '.js':'text/javascript', '.wasm':'application/wasm', '.css':'text/css' };
function createFixture(protectedPdf = false) {
  const doc = new mupdf.PDFDocument();
  let outputBuffer;
  try {
    for (const size of [200, 300, 400]) {
      doc.insertPage(-1, doc.addPage([0, 0, size, size + 80], 0, doc.newDictionary(), ''));
    }
    const options = { garbage:true, compress:true, encrypt: protectedPdf ? 'aes-256':'none' };
    if (protectedPdf) {
      options['user-password'] = 'open123';
      options['owner-password'] = 'open123';
    }
    outputBuffer = doc.saveToBuffer(JSON.stringify(options));
    return Buffer.from(outputBuffer.asUint8Array());
  } finally {
    outputBuffer?.destroy();
    doc.destroy();
  }
}
const server = http.createServer(async(req,res) => {
  try {
    const requested = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = path.resolve(siteRoot, '.' + (requested === '/' ? '/index.html' : requested));
    if (!file.startsWith(siteRoot + path.sep)) {res.writeHead(403);res.end();return;}
    const bytes = await fs.readFile(file);
    res.writeHead(200, { 'Content-Type': mimeTypes[path.extname(file)] || 'application/octet-stream' });
    res.end(bytes);
  } catch(e) {res.writeHead(404);res.end(e.message);}
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
const diagnostics=[];
try {
  const port=server.address().port;
  browser=await chromium.launch({ headless:true });
  const page=await browser.newPage({ acceptDownloads:true });
  page.on('console', message => { if(message.type() === 'error') diagnostics.push('Console: '+message.text()); });
  page.on('pageerror', err => diagnostics.push('Page: '+err.stack));
  page.on('requestfailed', request => diagnostics.push('Request: '+request.url()+' '+request.failure()?.errorText));
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil:'networkidle' });
  assert.equal(await page.title(), 'PDF Page Extractor');
  const fixture=createFixture();
  await page.locator('#pdfFile').setInputFiles({name:'smoke.pdf',mimeType:'application/pdf',buffer:fixture});
  await page.waitForTimeout(1200);
  const status=await page.locator('#status').innerText();
  console.log('Unencrypted PDF status:',status);
  assert.equal(await page.locator('#pageRanges').isEnabled(),true,
    'Page selector did not become enabled: '+status+' / '+diagnostics.join(' | '));
  assert.match(await page.locator('#fileInfo').innerText(), /3 pages/);
  await page.locator('#pageRanges').fill('3, 1');
  const downloadPromise=page.waitForEvent('download');
  await page.locator('#extractBtn').click();
  const download=await downloadPromise;
  const downloaded=await fs.readFile(await download.path());
  const output=mupdf.PDFDocument.openDocument(downloaded,'application/pdf');
  try {
    assert.equal(output.countPages(),2);
    const p=output.loadPage(0);
    try {
      const b=p.getBounds();assert.equal(Math.round(b[2]-b[0]),400);
    } finally {p.destroy();}
  } finally {output.destroy();}
  console.log('Unencrypted upload, reorder and download: PASS');
  await page.locator('#pdfFile').setInputFiles({name:'locked.pdf',mimeType:'application/pdf',buffer:createFixture(true)});
  await page.waitForTimeout(200);
  assert.equal(await page.locator('#unlockPanel').isVisible(),true);
  await page.locator('#sourcePassword').fill('open123');
  await page.locator('#unlockBtn').click();
  assert.equal(await page.locator('#pageRanges').isEnabled(),true,
    'Password unlock failed: '+await page.locator('#status').innerText());
  console.log('Password-protected input: PASS');
  if(diagnostics.length) console.log('Browser diagnostics:',diagnostics.join('\n'));
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
