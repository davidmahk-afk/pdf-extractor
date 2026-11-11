import test from 'node:test';
import assert from 'node:assert/strict';
import * as mupdf from 'mupdf';

test('extract pages with the original PDF content retained', () => {
  const src = new mupdf.PDFDocument();
  const output = new mupdf.PDFDocument();
  let buf;
  try {
    src.insertPage(-1, src.addPage([0, 0, 200, 300], 0, src.newDictionary(), ''));
    src.insertPage(-1, src.addPage([0, 0, 300, 450], 0, src.newDictionary(), ''));
    src.insertPage(-1, src.addPage([0, 0, 400, 600], 0, src.newDictionary(), ''));
    assert.equal(src.countPages(), 3);
    output.graftPage(-1, src, 2);
    output.graftPage(-1, src, 0);
    output.graftPage(-1, src, 2);
    assert.equal(output.countPages(), 3);
    buf = output.saveToBuffer(JSON.stringify({garbage:true,compress:true,encrypt:'none'}));
    const reopened = mupdf.PDFDocument.openDocument(buf.asUint8Array().slice(), 'application/pdf');
    try {
      assert.equal(reopened.countPages(), 3);
      assert.equal(reopened.needsPassword(), false);
      const page = reopened.loadPage(0);
      try {
        const [x0,y0,x1,y1] = page.getBounds();
        assert.equal(Math.round(x1-x0), 400);
        assert.equal(Math.round(y1-y0), 600);
      } finally { page.destroy(); }
    } finally { reopened.destroy(); }
  } finally {
    if (buf) buf.destroy();
    src.destroy();
    output.destroy();
  }
});

test('AES-256 protected PDF requires the correct password', () => {
  const src = new mupdf.PDFDocument();
  let buf;
  try {
    src.insertPage(-1, src.addPage([0, 0, 210, 297], 0, src.newDictionary(), ''));
    buf = src.saveToBuffer(JSON.stringify({
      garbage:true,compress:true,encrypt:'aes-256',
      'user-password':'example123',
      'owner-password':'example123'
    }));
    const locked = mupdf.PDFDocument.openDocument(buf.asUint8Array().slice(), 'application/pdf');
    try {
      assert.equal(locked.needsPassword(), true);
      assert.equal(locked.authenticatePassword('incorrect'), 0);
      assert.ok(locked.authenticatePassword('example123'));
      assert.equal(locked.needsPassword(), false);
      assert.equal(locked.countPages(), 1);
    } finally { locked.destroy(); }
  } finally {
    if (buf) buf.destroy();
    src.destroy();
  }
});
