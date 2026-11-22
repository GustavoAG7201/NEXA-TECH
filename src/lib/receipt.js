import { addressLines, exactMoney, noChargeNotice, orderDate, orderStatus, receiptNotice, totalAmount, totals } from './commerce.js';

const width = 612;
const height = 792;
const margin = 44;
const right = width - margin;
const ink = '#121d32';
const muted = '#465671';
const blue = '#1546c8';
const winAnsi = '€\u0081‚ƒ„…†‡ˆ‰Š‹Œ\u008dŽ\u008f\u0090‘’“”•–—˜™š›œ\u009džŸ';
const byteHex = value => value.toString(16).padStart(2, '0');

function fontBytes(value) {
  let hex = '';
  for (const char of value) {
    const code = char.charCodeAt(0);
    if ((code >= 32 && code < 127) || (code >= 160 && code <= 255)) hex += byteHex(code);
    else {
      const position = winAnsi.indexOf(char);
      if (position < 0) return null;
      hex += byteHex(128 + position);
    }
  }
  return hex;
}

const rgb = color => color.slice(1).match(/../g).map(channel => (parseInt(channel, 16) / 255).toFixed(3)).join(' ');

// Standard PDF fonts cover the usual Spanish receipt text. Draw other scripts
// with the browser's font fallback and retain their text in ActualText.
function unicodeLine(value, x, y, size, bold, color) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  const font = (bold ? 'bold ' : '') + size + 'px Arial, sans-serif';
  context.font = font;
  const w = Math.ceil(context.measureText(value).width) + 2;
  const h = Math.ceil(size * 1.6);
  canvas.width = w * 3;
  canvas.height = h * 3;
  context.scale(3, 3);
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, w, h);
  context.fillStyle = color;
  context.font = font;
  context.fillText(value, 0, size + 2);
  const jpeg = atob(canvas.toDataURL('image/jpeg', .92).split(',')[1]);
  const hex = Array.from(jpeg, char => byteHex(char.charCodeAt(0))).join('');
  const utf16 = 'feff' + value.split('').map(char => char.charCodeAt(0).toString(16).padStart(4, '0')).join('');
  return `/Span << /ActualText <${utf16}> >> BDC
q ${w} 0 0 ${h} ${x} ${height-y+size+2-h} cm
BI /W ${canvas.width} /H ${canvas.height} /CS /RGB /BPC 8 /F [/AHx /DCT] ID
${hex}>
EI Q EMC`;
}

function pdf(pages) {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R /Lang (es-MX) >>',
    `<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_, index) => (5 + index * 2) + ' 0 R').join(' ')}] >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
  ];
  for (const [index, page] of pages.entries()) {
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${6 + index * 2} 0 R >>`);
    objects.push(`<< /Length ${page.length} >>\nstream\n${page}\nendstream`);
  }
  // Streams and object dictionaries contain only ASCII bytes.
  let output = '%PDF-1.4\n';
  const offsets = objects.map((object, index) => {
    const offset = output.length;
    output += `${index + 1} 0 obj\n${object}\nendobj\n`;
    return offset;
  });
  const xref = output.length;
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  output += offsets.map(offset => String(offset).padStart(10, '0') + ' 00000 n \n').join('');
  output += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new Blob([output], { type: 'application/pdf' });
}

export function buildReceipt(order) {
  const pages = [];
  const measure = document.createElement('canvas').getContext('2d');
  let ops;
  let y;
  function text(value, x, baseline, { size = 11, bold = false, color = ink } = {}) {
    const clean = String(value).normalize('NFC').replace(/\s+/gu, ' ').trim();
    const hex = fontBytes(clean);
    ops.push(hex === null ? unicodeLine(clean, x, baseline, size, bold, color)
      : `BT /${bold ? 'F2' : 'F1'} ${size} Tf ${rgb(color)} rg 1 0 0 1 ${x} ${height - baseline} Tm <${hex}> Tj ET`);
  }
  function rect(x, top, w, h, color) {
    ops.push(`${rgb(color)} rg ${x} ${height - top - h} ${w} ${h} re f`);
  }
  function wrap(value, maxWidth, size = 11, bold = false) {
    measure.font = (bold ? 'bold ' : '') + size + 'px Arial, sans-serif';
    const segments = [];
    let line = '';
    for (const word of String(value).trim().split(/\s+/u)) {
      const candidate = line ? line + ' ' + word : word;
      if (measure.measureText(candidate).width <= maxWidth) {
        line = candidate;
        continue;
      }
      if (line) segments.push(line);
      line = '';
      for (const char of word) {
        if (measure.measureText(line + char).width > maxWidth) {
          segments.push(line);
          line = '';
        }
        line += char;
      }
    }
    if (line) segments.push(line);
    return segments;
  }
  function beginPage() {
    ops = [];
    pages.push(ops);
    rect(0, 0, width, 106, '#0b1630');
    rect(margin, 27, 36, 36, blue);
    ops.push('1 1 1 rg 64 759 m 52 745 l 61 745 l 60 735 l 72 749 l 63 749 l h f');
    text('NexaTech', margin + 48, 52, { size: 24, color: '#ffffff', bold: true });
    text(receiptNotice, margin, 85, { size: 10, color: '#d6e3fa' });
    text('Folio ' + order.folio, margin, 133, { bold: true, size: 14 });
    y = 156;
  }
  function heading(label) {
    text(label, margin, y, { color: blue, bold: true, size: 12 });
    y += 22;
  }
  function line(value) {
    for (const segment of wrap(value, right - margin - 4)) {
      text(segment, margin, y);
      y += 15;
    }
  }
  function tableHeader() {
    rect(margin, y - 15, right - margin, 24, '#ebf3ff');
    text('Producto y SKU', margin + 8, y, { bold: true });
    text('Cantidad', 340, y, { bold: true });
    text('Precio unitario', 410, y, { bold: true });
    y += 29;
  }

  beginPage();
  line('Fecha del pedido  ' + orderDate(order.confirmedAt) + ' (hora de Matamoros)');
  line('Estado del pedido  ' + orderStatus(order.status));
  y += 14;
  heading('Cliente y dirección de referencia');
  const address = order.orderAddress_on_order;
  for (const part of [order.contactEmail, address.recipient, ...addressLines(address), address.phone]) line(part);
  y += 17;
  tableHeader();
  for (const item of order.orderItems_on_order) {
    const names = wrap(item.nameSnapshot, 270, 11, true);
    const variants = wrap(item.skuSnapshot + ' · ' + item.optionSnapshot, 270, 10);
    const rowHeight = 15 * (names.length + variants.length) + 8;
    if (y + rowHeight > 727) {
      beginPage();
      tableHeader();
    }
    text(item.quantity, 340, y);
    text(exactMoney(item.unitPriceCents), 410, y);
    for (const name of names) {
      text(name, margin + 8, y, { bold: true });
      y += 15;
    }
    for (const variant of variants) {
      text(variant, margin + 8, y, { size: 10, color: muted });
      y += 15;
    }
    rect(margin, y - 4, right - margin, 1, '#d9e1ee');
    y += 8;
  }
  if (y + 143 > 735) beginPage();
  y += 12;
  for (const [label, field] of totals) {
    const bold = field === 'totalCents';
    const amount = totalAmount(order, field);
    measure.font = (bold ? 'bold ' : '') + '11px Arial, sans-serif';
    if (bold) rect(290, y - 15, right - 290, 24, '#ebf3ff');
    text(label, 299, y, { bold });
    text(amount, Math.floor(right - 12 - measure.measureText(amount).width), y, { bold });
    y += 20;
  }

  const count = pages.length;
  const streams = pages.map((page, index) => {
    ops = page;
    rect(margin, 747, right - margin, 1, '#d9e1ee');
    text(noChargeNotice, margin, 766, { size: 9, color: muted });
    text('Página ' + (index + 1) + ' de ' + count, right - 63, 766, { size: 9, color: muted });
    return ops.join('\n');
  });
  return pdf(streams);
}

export function downloadReceipt(order) {
  const url = URL.createObjectURL(buildReceipt(order));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'NexaTech-' + order.folio + '.pdf';
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
}
