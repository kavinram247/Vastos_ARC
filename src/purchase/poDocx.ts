// ─────────────────────────────────────────────────────────────
// Purchase Order → Word (.docx) generator.
//
// Produces a .docx that matches the firm's reference PO layout:
// A4, 1" margins, Calibri 11pt, a single bordered PO table, payment
// terms/contact rows, and signature space. It also accepts both the purchase
// module's PurchaseOrder shape and the inventory module's normalized data.
// ─────────────────────────────────────────────────────────────
import type { Firm } from '../types';
import type { PurchaseOrder, PurchaseVendor } from './types';
import { projectName, profileName } from './logic';

export interface PoDocData {
  poNumber: string;
  poDate: string;
  deliveryDate: string | null;
  projectName: string;
  vendorName: string;
  deliveryAddress: string | null;
  materialType?: string | null;
  firm: { name: string; address: string; gstin: string; phone?: string; email?: string };
  items: { description: string; quantity: number; uom: string; rate: number; amount: number }[];
  subtotal: number;
  gstRate: number;
  gstType: 'inclusive' | 'exclusive';
  gstAmount: number;
  total: number;
  creditDays?: number | null;
  orderContactName?: string | null;
  orderContactPhone?: string | null;
  deliveryContactName?: string | null;
  deliveryContactPhone?: string | null;
  signatoryName?: string | null;
}

export function generatePoDocx(data: PoDocData): Blob {
  const parts = buildParts(data);
  const entries = parts.map(([name, xml]) => ({ name, data: new TextEncoder().encode(xml) }));
  const zip = buildZip(entries);
  return new Blob([zip as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}

export function buildPoDocx(data: PoDocData): Blob;
export function buildPoDocx(po: PurchaseOrder, firm: Firm, vendor?: PurchaseVendor): Blob;
export function buildPoDocx(input: PoDocData | PurchaseOrder, firm?: Firm, vendor?: PurchaseVendor): Blob {
  return generatePoDocx(resolvePoDocData(input, firm, vendor));
}

export function downloadPoDocx(data: PoDocData): void;
export function downloadPoDocx(po: PurchaseOrder, firm: Firm, vendor?: PurchaseVendor): void;
export function downloadPoDocx(input: PoDocData | PurchaseOrder, firm?: Firm, vendor?: PurchaseVendor): void {
  const data = resolvePoDocData(input, firm, vendor);
  const blob = generatePoDocx(data);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `PO ${safeName(data.poNumber)}.docx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function resolvePoDocData(input: PoDocData | PurchaseOrder, firm?: Firm, vendor?: PurchaseVendor): PoDocData {
  if (isPoDocData(input)) return input;
  if (!firm) throw new Error('Firm details are required to generate a PO document.');

  const orderName = profileName(input.order_contact_id);
  const deliveryName = profileName(input.delivery_contact_id);
  return {
    poNumber: input.po_number,
    poDate: input.po_date || input.created_at,
    deliveryDate: input.delivery_date,
    projectName: projectName(input.project_id) || '',
    vendorName: vendor?.company_name || 'Vendor',
    deliveryAddress: input.delivery_address || null,
    materialType: input.material_type || null,
    firm: { name: firm.name, address: firm.address, gstin: firm.gstin },
    items: input.items.map(i => ({
      description: i.description,
      quantity: i.quantity,
      uom: i.uom,
      rate: i.rate,
      amount: i.amount,
    })),
    subtotal: input.subtotal || input.items.reduce((sum, item) => sum + (item.amount || 0), 0),
    gstRate: input.gst_rate,
    gstType: input.gst_type === 'exclusive' ? 'exclusive' : 'inclusive',
    gstAmount: input.gst_amount,
    total: input.total_amount,
    creditDays: input.credit_days,
    orderContactName: orderName,
    orderContactPhone: input.order_contact_phone,
    deliveryContactName: deliveryName,
    deliveryContactPhone: input.delivery_contact_phone,
    signatoryName: orderName || profileName(input.created_by),
  };
}

function isPoDocData(input: PoDocData | PurchaseOrder): input is PoDocData {
  return 'poNumber' in input;
}

function safeName(name: string): string {
  return (name || 'purchase-order').replace(/[\\/:*?"<>|]+/g, '-');
}

const amt = (n: number): string => String(Math.round(n || 0));

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
}

function esc(s: unknown): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function R(text: unknown, b = false): string {
  return `<w:r>${b ? '<w:rPr><w:b/><w:bCs/></w:rPr>' : ''}<w:t xml:space="preserve">${esc(text)}</w:t></w:r>`;
}

function P(runs: string, jc = ''): string {
  const ppr = jc ? `<w:pPr><w:jc w:val="${jc}"/></w:pPr>` : '';
  return `<w:p>${ppr}${runs}</w:p>`;
}

function TC(content: string, opts: { w?: string; gridSpan?: number; vMerge?: 'restart' | 'continue' } = {}): string {
  const w = opts.w ? `<w:tcW w:w="${opts.w}" w:type="dxa"/>` : '';
  const gs = opts.gridSpan ? `<w:gridSpan w:val="${opts.gridSpan}"/>` : '';
  const vm = opts.vMerge ? (opts.vMerge === 'restart' ? '<w:vMerge w:val="restart"/>' : '<w:vMerge/>') : '';
  return `<w:tc><w:tcPr>${w}${gs}${vm}</w:tcPr>${content || '<w:p/>'}</w:tc>`;
}

function TR(cells: string, height?: number): string {
  const hp = height ? `<w:trPr><w:trHeight w:val="${height}"/></w:trPr>` : '';
  return `<w:tr>${hp}${cells}</w:tr>`;
}

function buildParts(d: PoDocData): [string, string][] {
  return [
    ['[Content_Types].xml', CONTENT_TYPES],
    ['_rels/.rels', ROOT_RELS],
    ['word/_rels/document.xml.rels', DOC_RELS],
    ['word/document.xml', buildDocument(d)],
    ['word/styles.xml', STYLES],
    ['word/settings.xml', SETTINGS],
    ['word/fontTable.xml', FONT_TABLE],
    ['word/header1.xml', HEADER],
  ];
}

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/><Override PartName="/word/fontTable.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.fontTable+xml"/><Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/></Types>`;

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;

const DOC_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/fontTable" Target="fontTable.xml"/><Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/></Relationships>`;

const SETTINGS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:zoom w:percent="100"/><w:defaultTabStop w:val="720"/><w:characterSpacingControl w:val="doNotCompress"/></w:settings>`;

const FONT_TABLE = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:fonts xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:font w:name="Calibri"><w:charset w:val="00"/></w:font><w:font w:name="Times New Roman"><w:charset w:val="00"/></w:font></w:fonts>`;

const HEADER = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:p><w:pPr><w:pStyle w:val="Header"/><w:jc w:val="right"/></w:pPr></w:p></w:hdr>`;

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Times New Roman"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="en-IN"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Header"><w:name w:val="header"/><w:basedOn w:val="Normal"/><w:link w:val="HeaderChar"/><w:pPr><w:tabs><w:tab w:val="center" w:pos="4680"/><w:tab w:val="right" w:pos="9360"/></w:tabs></w:pPr></w:style><w:style w:type="character" w:styleId="HeaderChar"><w:name w:val="Header Char"/><w:basedOn w:val="DefaultParagraphFont"/><w:link w:val="Header"/></w:style><w:style w:type="table" w:default="1" w:styleId="TableNormal"><w:name w:val="Normal Table"/><w:tblPr><w:tblInd w:w="0" w:type="dxa"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="108" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style><w:style w:type="table" w:styleId="TableGrid"><w:name w:val="Table Grid"/><w:basedOn w:val="TableNormal"/><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr><w:rPr><w:lang w:val="en-IN"/></w:rPr><w:tblPr><w:tblInd w:w="0" w:type="dxa"/><w:tblBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:left w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:right w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:insideH w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:insideV w:val="single" w:sz="4" w:space="0" w:color="auto"/></w:tblBorders><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="108" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style></w:styles>`;

function buildDocument(d: PoDocData): string {
  const firmLine = d.firm.name.toUpperCase();
  const poDate = fmtDate(d.poDate);
  const delivDate = fmtDate(d.deliveryDate);

  const fromCell = [
    P(R('From', true)),
    P(R('M/S. ', true) + R(firmLine, true)),
    P(R(d.firm.address || '')),
    ...(d.firm.phone ? [P(R('Ph', true) + R('         : ' + d.firm.phone))] : []),
    ...(d.firm.email ? [P(R('Mail  Id', true) + R(': ' + d.firm.email))] : []),
    P(R('GST NO: ' + (d.firm.gstin || ''), true)),
  ].join('');

  const r0 = TR(
    TC(fromCell, { w: '4361', gridSpan: 2, vMerge: 'restart' }) +
    TC(P(R('PO No: ') + R(d.poNumber, true)), { w: '2693', gridSpan: 2 }) +
    TC(P(R('Date :') + R(poDate, true)), { w: '2054' }),
    540,
  );

  const r1 = TR(
    TC('', { w: '4361', gridSpan: 2, vMerge: 'continue' }) +
    TC(P(R('Delivery date: ') + R(delivDate, true)), { w: '2693', gridSpan: 2 }) +
    TC(P(R('Material: ', true) + R(d.materialType || '', true)) + P(''), { w: '2054' }),
    705,
  );

  const r2 = TR(
    TC('', { w: '4361', gridSpan: 2, vMerge: 'continue' }) +
    TC(P(R('Project: ') + R(d.projectName.toUpperCase(), true)) + P(''), { w: '2693', gridSpan: 2 }) +
    TC(P(''), { w: '2054' }),
    900,
  );

  const r3 = TR(
    TC(P(R('TO ', true)) + P(R(d.vendorName, true)), { w: '4361', gridSpan: 2 }) +
    TC(P(R('Delivery', true) + R(' address:', true)) + P(R(d.deliveryAddress || '')), { w: '4747', gridSpan: 3 }),
    1134,
  );

  const r4 = TR(
    TC(P(R('S.NO', true)), { w: '817' }) +
    TC(P(R('DESCRIPTION OF GOODS', true)), { w: '3544' }) +
    TC(P(R('QUANTITY', true)), { w: '1559' }) +
    TC(P(R('RATE', true)), { w: '1134' }) +
    TC(P(R('AMOUNT', true)), { w: '2054' }),
  );

  const itemRows = d.items.map((it) => TR(
    TC(P(''), { w: '817' }) +
    TC(P(R(it.description)), { w: '3544' }) +
    TC(P(R(`${amt(it.quantity)}${it.uom || ''}`)), { w: '1559' }) +
    TC(P(R(amt(it.rate))), { w: '1134' }) +
    TC(P(R(amt(it.amount))), { w: '2054' }),
    275,
  )).join('');

  const totalRow = TR(
    TC(P(''), { w: '817' }) +
    TC(P(R('TOTAL', true)), { w: '3544' }) +
    TC(P(''), { w: '1559' }) +
    TC(P(''), { w: '1134' }) +
    TC(P(R(amt(d.subtotal), true)), { w: '2054' }),
    185,
  );

  const full = (content: string): string => TR(TC(content, { w: '9108', gridSpan: 5 }));
  const gstLabel = d.gstType === 'exclusive' ? 'Rates Exclusive of GST' : 'Rates Inclusive of GST';
  const termsRows: string[] = [full(P(R(gstLabel)))];

  if (d.gstType === 'exclusive' && d.gstAmount > 0) {
    termsRows.push(full(P(R(`Add: GST @ ${amt(d.gstRate)}% - ${amt(d.gstAmount)}`))));
    termsRows.push(full(P(R('Grand Total - ' + amt(d.total), true))));
  }

  const creditLine = d.creditDays
    ? `Payment terms shall be paid ${d.creditDays} DAYS  from the material delivered at site`
    : 'Payment terms as mutually agreed.';
  termsRows.push(full(P(R(creditLine))));

  if (d.orderContactName) {
    termsRows.push(full(
      P(R('Any question regarding this order should be directed to:', true)) +
      P(R('Purchase Department: ') + R(d.orderContactName)) +
      (d.orderContactPhone ? P(R('Contact No: ') + R(d.orderContactPhone)) : ''),
    ));
  }

  if (d.deliveryContactName) {
    termsRows.push(full(
      P(R('For question regarding delivery should be directed to:', true)) +
      P(R('Site engineer : ') + R(d.deliveryContactName) + (d.deliveryContactPhone ? R(' - ' + d.deliveryContactPhone) : '')),
    ));
  }

  const sigName = (d.signatoryName || '').trim();
  const sigBlock = full(
    P(R('Thanking You,')) +
    P('') +
    P(R('For ' + firmLine, true)) +
    P('') + P('') + P('') +
    (sigName ? P(R('(' + sigName.toUpperCase() + ')', true)) : P('')),
  );

  const tbl =
    '<w:tbl>' +
    '<w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="9108" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblLook w:val="04A0" w:firstRow="1" w:lastRow="0" w:firstColumn="1" w:lastColumn="0" w:noHBand="0" w:noVBand="1"/></w:tblPr>' +
    '<w:tblGrid><w:gridCol w:w="817"/><w:gridCol w:w="3544"/><w:gridCol w:w="1559"/><w:gridCol w:w="1134"/><w:gridCol w:w="2054"/></w:tblGrid>' +
    r0 + r1 + r2 + r3 + r4 + itemRows + totalRow + termsRows.join('') + sigBlock +
    '</w:tbl>';

  const title = '<w:p><w:pPr><w:jc w:val="center"/><w:rPr><w:b/><w:bCs/></w:rPr></w:pPr><w:r><w:rPr><w:b/><w:bCs/></w:rPr><w:t>PURCHASE ORDER</w:t></w:r></w:p>';
  const sectPr =
    '<w:sectPr>' +
    '<w:headerReference w:type="default" r:id="rId4"/>' +
    '<w:pgSz w:w="11906" w:h="16838"/>' +
    '<w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/>' +
    '<w:cols w:space="708"/>' +
    '<w:docGrid w:linePitch="360"/>' +
    '</w:sectPr>';

  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture" mc:Ignorable="w14 wp">' +
    '<w:body>' + title + tbl + sectPr + '</w:body>' +
    '</w:document>'
  );
}

const CRC_TABLE: Uint32Array = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(b: Uint8Array): number {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < b.length; i++) c = CRC_TABLE[(c ^ b[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function u16(n: number): Uint8Array {
  const b = new Uint8Array(2);
  new DataView(b.buffer).setUint16(0, n, true);
  return b;
}

function u32(n: number): Uint8Array {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, n >>> 0, true);
  return b;
}

function concat(arrs: Uint8Array[]): Uint8Array {
  let len = 0;
  for (const a of arrs) len += a.length;
  const out = new Uint8Array(len);
  let o = 0;
  for (const a of arrs) { out.set(a, o); o += a.length; }
  return out;
}

function buildZip(entries: { name: string; data: Uint8Array }[]): Uint8Array {
  const enc = new TextEncoder();
  const now = new Date();
  const dosTime = ((now.getHours() & 0x1f) << 11) | ((now.getMinutes() & 0x3f) << 5) | ((Math.floor(now.getSeconds() / 2)) & 0x1f);
  const dosDate = (((now.getFullYear() - 1980) & 0x7f) << 9) | (((now.getMonth() + 1) & 0xf) << 5) | (now.getDate() & 0x1f);

  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const e of entries) {
    const nameB = enc.encode(e.name);
    const crc = crc32(e.data);
    const local = concat([
      u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(dosTime), u16(dosDate),
      u32(crc), u32(e.data.length), u32(e.data.length),
      u16(nameB.length), u16(0),
    ]);
    const entry = concat([local, nameB, e.data]);
    localParts.push(entry);

    const central = concat([
      u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(dosTime), u16(dosDate),
      u32(crc), u32(e.data.length), u32(e.data.length),
      u16(nameB.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset),
    ]);
    centralParts.push(concat([central, nameB]));
    offset += entry.length;
  }

  const central = concat(centralParts);
  const eocd = concat([
    u32(0x06054b50), u16(0), u16(0),
    u16(entries.length), u16(entries.length),
    u32(central.length), u32(offset), u16(0),
  ]);
  return concat([...localParts, central, eocd]);
}
