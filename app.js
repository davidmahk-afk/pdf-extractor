import * as mupdf from './vendor/mupdf.js';
import { parsePageSelection, presetPages } from './page-ranges.js';

const $ = id => document.getElementById(id);
const ui = {
  file: $('pdfFile'), drop: $('dropZone'), fileInfo: $('fileInfo'),
  unlockPanel: $('unlockPanel'), sourcePassword: $('sourcePassword'), unlockBtn: $('unlockBtn'),
  pageSummary: $('pageSummary'), ranges: $('pageRanges'), selection: $('selectionInfo'),
  outputName: $('outputName'), protectOutput: $('protectOutput'), outputPasswordArea: $('outputPasswordArea'),
  outputPassword: $('outputPassword'), extract: $('extractBtn'), status: $('status')
};
let documentPdf = null;
let selectedFile = null;
let isWorking = false;

function setStatus(message, type = '') {
  ui.status.textContent = message;
  ui.status.className = `status ${type}`;
}
function activeDocument() {
  return documentPdf !== null && !documentPdf.needsPassword();
}
function setEnabled() {
  const ready = activeDocument() && !isWorking;
  ui.ranges.disabled = !ready;
  ui.extract.disabled = !ready;
  ui.unlockBtn.disabled = !documentPdf || !documentPdf.needsPassword() || isWorking;
  document.querySelectorAll('[data-preset]').forEach(btn => { btn.disabled = !ready; });
}
function updateSelection() {
  if (!activeDocument()) { ui.selection.textContent = ''; return; }
  try {
    const pages = parsePageSelection(ui.ranges.value, documentPdf.countPages());
    ui.selection.textContent = `${pages.length} page${pages.length === 1 ? '' : 's'} selected for export.`;
    ui.selection.style.color = '#147145';
  } catch (err) {
    ui.selection.textContent = err.message;
    ui.selection.style.color = '#b3282c';
  }
}
function clearDocument() {
  if (documentPdf) { try { documentPdf.destroy(); } catch (_) {} }
  documentPdf = null;
  selectedFile = null;
  ui.fileInfo.hidden = true;
  ui.unlockPanel.hidden = true;
  ui.sourcePassword.value = '';
  ui.pageSummary.textContent = 'Choose a PDF to see its page count.';
  ui.ranges.value = '';
  updateSelection();
  setEnabled();
}
function showReady() {
  const count = documentPdf.countPages();
  ui.unlockPanel.hidden = true;
  ui.sourcePassword.value = '';
  ui.pageSummary.textContent = `Ready: ${count} page${count === 1 ? '' : 's'} in this document.`;
  ui.ranges.value = `1-${count}`;
  ui.fileInfo.textContent = `${selectedFile.name} · ${count} page${count === 1 ? '' : 's'} · ${(selectedFile.size / 1048576).toFixed(2)} MB`;
  setEnabled();
  updateSelection();
  setStatus('PDF loaded. Choose the pages to extract.');
}
async function loadFile(file) {
  clearDocument();
  setStatus('');
  if (!file) return;
  if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') { setStatus('Please select a PDF file.', 'error'); return; }
  isWorking = true; setEnabled();
  setStatus('Opening PDF locally…');
  try {
    const bytes = await file.arrayBuffer();
    documentPdf = mupdf.PDFDocument.openDocument(bytes, 'application/pdf');
    selectedFile = file;
    ui.fileInfo.hidden = false;
    ui.fileInfo.textContent = `${file.name} · ${(file.size / 1048576).toFixed(2)} MB`;
    if (documentPdf.needsPassword()) {
      ui.unlockPanel.hidden = false;
      ui.pageSummary.textContent = 'Unlock this PDF to see its pages.';
      setStatus('Password required to open this PDF.');
      ui.sourcePassword.focus();
    } else {
      showReady();
    }
  } catch (err) {
    clearDocument();
    setStatus(`Unable to read PDF: ${err.message || 'invalid or unsupported file'}`, 'error');
  } finally { isWorking = false; setEnabled(); }
}
function unlock() {
  if (!documentPdf || !documentPdf.needsPassword()) return;
  try {
    const password = ui.sourcePassword.value;
    if (!password) { setStatus('Enter the PDF password.', 'error'); return; }
    const result = documentPdf.authenticatePassword(password);
    if (!result || documentPdf.needsPassword()) { setStatus('Incorrect password. Please try again.', 'error'); return; }
    showReady();
  } catch (err) { setStatus(`Unable to unlock PDF: ${err.message}`, 'error'); }
}
function outputFilename() {
  const raw = ui.outputName.value.trim().replace(/[\\/:*?"<>|\x00-\x1f]/g, '-');
  if (!raw) return 'extracted-pages.pdf';
  return /\.pdf$/i.test(raw) ? raw : `${raw}.pdf`;
}
async function downloadExtraction() {
  if (!activeDocument() || isWorking) return;
  let pages;
  try { pages = parsePageSelection(ui.ranges.value, documentPdf.countPages()); }
  catch (err) { setStatus(err.message, 'error'); ui.ranges.focus(); return; }
  const password = ui.outputPassword.value;
  if (ui.protectOutput.checked && password.length < 6) {
    setStatus('Choose an output password with at least 6 characters.', 'error');
    ui.outputPassword.focus(); return;
  }
  isWorking = true; setEnabled();
  let result = null, pdfBuffer = null, objectUrl = null;
  setStatus(`Extracting ${pages.length} page${pages.length === 1 ? '' : 's'} locally…`);
  try {
    await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));
    result = new mupdf.PDFDocument();
    for (const index of pages) result.graftPage(-1, documentPdf, index);
    const opts = { garbage: true, compress: true, encrypt: ui.protectOutput.checked ? 'aes-256' : 'none' };
    if (ui.protectOutput.checked) {
      opts['user-password'] = password;
      opts['owner-password'] = password;
    }
    pdfBuffer = result.saveToBuffer(JSON.stringify(opts));
    const pdfBytes = pdfBuffer.asUint8Array().slice();
    objectUrl = URL.createObjectURL(new Blob([pdfBytes], { type: 'application/pdf' }));
    const anchor = document.createElement('a');
    anchor.href = objectUrl; anchor.download = outputFilename();
    document.body.append(anchor); anchor.click(); anchor.remove();
    setStatus(`Downloaded ${outputFilename()} with ${pages.length} page${pages.length === 1 ? '' : 's'}.`, 'success');
  } catch (err) {
    setStatus(`Could not create the PDF: ${err.message || err}`, 'error');
  } finally {
    if (objectUrl) setTimeout(() => URL.revokeObjectURL(objectUrl), 30000);
    if (pdfBuffer) { try { pdfBuffer.destroy(); } catch (_) {} }
    if (result) { try { result.destroy(); } catch (_) {} }
    isWorking = false; setEnabled();
  }
}
ui.file.addEventListener('change', () => loadFile(ui.file.files?.[0]));
ui.unlockBtn.addEventListener('click', unlock);
ui.sourcePassword.addEventListener('keydown', event => { if (event.key === 'Enter') unlock(); });
ui.ranges.addEventListener('input', updateSelection);
ui.protectOutput.addEventListener('change', () => {
  ui.outputPasswordArea.hidden = !ui.protectOutput.checked;
  if (!ui.protectOutput.checked) ui.outputPassword.value = '';
});
ui.extract.addEventListener('click', downloadExtraction);
document.querySelectorAll('[data-preset]').forEach(btn => btn.addEventListener('click', () => {
  if (!activeDocument()) return;
  ui.ranges.value = presetPages(btn.dataset.preset, documentPdf.countPages());
  updateSelection();
}));
ui.drop.addEventListener('dragover', event => { event.preventDefault(); ui.drop.classList.add('drag'); });
ui.drop.addEventListener('dragleave', () => ui.drop.classList.remove('drag'));
ui.drop.addEventListener('drop', event => {
  event.preventDefault(); ui.drop.classList.remove('drag');
  loadFile(event.dataTransfer.files?.[0]);
});
setEnabled();
