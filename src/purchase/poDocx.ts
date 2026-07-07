// ─────────────────────────────────────────────────────────────
// Purchase Order → Word (.docx) export.
//
// Produces a real OOXML .docx entirely client-side with NO external library:
// a tiny hand-written ZIP writer (STORE method + CRC32) packs the three parts a
// minimal valid Word document needs ([Content_Types].xml, _rels/.rels,
// word/document.xml). Layout mirrors the firm's standard PO sheet: a header
// block (From / PO No / Date / Delivery date / Material / Project), the vendor +
// delivery-address row, the S.NO / DESCRIPTION / QUANTITY / RATE / AMOUNT items
// table with totals, and the payment-terms / contact / signature footer.
// ─────────────────────────────────────────────────────────────
import type { Firm } from '../types';
import type { PurchaseOrder, PurchaseVendor } from './types';
import { projectName, profileName } from './logic';

// ── ZIP (store, no compression) ──────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

interface ZipEntry { name: string; data: Uint8Array }

function zipStore(entries: ZipEntry[]): Uint8Array {
  const chunks: number[] = [];
  const central: number[] = [];
  const enc = new TextEncoder();
  const u16 = (arr: number[], v: number) => { arr.push(v & 0xff, (v >>> 8) & 0xff); };
  const u32 = (arr: number[], v: number) => { arr.push(v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff); };
  const push = (arr: number[], bytes: Uint8Array | number[]) => { for (let i = 0; i < bytes.length; i++) arr.push(bytes[i]); };

  for (const e of entries) {
    const nameBytes = enc.encode(e.name);
    const crc = crc32(e.data);
    const offset = chunks.length;
    // local file header
    u32(chunks, 0x04034b50); u16(chunks, 20); u16(chunks, 0); u16(chunks, 0); // sig, ver, flags, method(store)
    u16(chunks, 0); u16(chunks, 0x21);                                        // modtime, moddate (1980-01-01)
    u32(chunks, crc); u32(chunks, e.data.length); u32(chunks, e.data.length); // crc, comp, uncomp
    u16(chunks, nameBytes.length); u16(chunks, 0);                            // nameLen, extraLen
    push(chunks, nameBytes); push(chunks, e.data);
    // central directory record
    u32(central, 0x02014b50); u16(central, 20); u16(central, 20); u16(central, 0); u16(central, 0);
    u16(central, 0); u16(central, 0x21);
    u32(central, crc); u32(central, e.data.length); u32(central, e.data.length);
    u16(central, nameBytes.length); u16(central, 0); u16(central, 0);          // name/extra/comment len
    u16(central, 0); u16(central, 0); u32(central, 0);                         // disk, internal, external attrs
    u32(central, offset);                                                      // local header offset
    push(central, nameBytes);
  }
  const cdOffset = chunks.length;
  push(chunks, central);
  const end: number[] = [];
  u32(end, 0x06054b50); u16(end, 0); u16(end, 0);
  u16(end, entries.length); u16(end, entries.length);
  u32(end, central.length); u32(end, cdOffset); u16(end, 0);
  push(chunks, end);
  return new Uint8Array(chunks);
}

// ── OOXML helpers ────────────────────────────────────────────
const esc = (s: unknown) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const fmtNum = (n: number) => Number(n || 0).toLocaleString('en-IN');
function fmtDate(d?: string | null): string {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return String(d);
  const p = (x: number) => String(x).padStart(2, '0');
  return `${p(dt.getDate())}.${p(dt.getMonth() + 1)}.${dt.getFullYear()}`;
}

interface RunOpts { bold?: boolean; size?: number; align?: 'left' | 'center' | 'right' }
function run(text: string, o: RunOpts = {}): string {
  const rpr = `<w:rPr>${o.bold ? '<w:b/><w:bCs/>' : ''}${o.size ? `<w:sz w:val="${o.size}"/><w:szCs w:val="${o.size}"/>` : ''}</w:rPr>`;
  const parts = String(text ?? '').split('\n')
    .map((ln, i) => `${i > 0 ? '<w:br/>' : ''}<w:t xml:space="preserve">${esc(ln)}</w:t>`).join('');
  return `<w:r>${rpr}${parts}</w:r>`;
}
function para(text: string | null, o: RunOpts = {}): string {
  const ppr = `<w:pPr>${o.align ? `<w:jc w:val="${o.align}"/>` : ''}<w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr>`;
  return `<w:p>${ppr}${text == null ? '' : run(text, o)}</w:p>`;
}
interface CellOpts { w?: number; span?: number; vmerge?: 'restart' | 'continue'; shade?: string }
function tc(content: string, o: CellOpts = {}): string {
  const pr = `<w:tcPr>${o.w ? `<w:tcW w:w="${o.w}" w:type="dxa"/>` : ''}${o.span ? `<w:gridSpan w:val="${o.span}"/>` : ''}`
    + `${o.vmerge ? `<w:vMerge${o.vmerge === 'restart' ? ' w:val="restart"' : ''}/>` : ''}`
    + `${o.shade ? `<w:shd w:val="clear" w:color="auto" w:fill="${o.shade}"/>` : ''}<w:vAlign w:val="center"/></w:tcPr>`;
  return `<w:tc>${pr}${content || '<w:p/>'}</w:tc>`;
}
const tr = (cells: string) => `<w:tr>${cells}</w:tr>`;
function table(grid: number[], rows: string): string {
  const borders = ['top', 'left', 'bottom', 'right', 'insideH', 'insideV']
    .map(s => `<w:${s} w:val="single" w:sz="4" w:space="0" w:color="000000"/>`).join('');
  const gridXml = grid.map(w => `<w:gridCol w:w="${w}"/>`).join('');
  return `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders>${borders}</w:tblBorders>`
    + `<w:tblLook w:val="04A0" w:firstRow="1" w:lastRow="0" w:firstColumn="1" w:lastColumn="0" w:noHBand="0" w:noVBand="1"/></w:tblPr>`
    + `<w:tblGrid>${gridXml}</w:tblGrid>${rows}</w:tbl>`;
}

// ── document.xml ─────────────────────────────────────────────
function buildDocumentXml(po: PurchaseOrder, firm: Firm, vendor?: PurchaseVendor): string {
  const project = projectName(po.project_id) || '';
  const orderName = profileName(po.order_contact_id) || '';
  const deliveryName = profileName(po.delivery_contact_id) || '';
  const subtotal = po.subtotal || po.items.reduce((s, i) => s + (i.amount || 0), 0);

  // Header block
  const fromBlock =
    para(`From M/S. ${firm.name}`, { bold: true })
    + (firm.address ? para(firm.address, { bold: true }) : '')
    + (firm.gstin ? para(`GST NO: ${firm.gstin}`, { bold: true }) : '');

  const G3 = [4548, 2280, 2280];
  const headerTable = table(G3,
    tr(
      tc(fromBlock, { w: G3[0], vmerge: 'restart' })
      + tc(para(`PO No: ${po.po_number}`, { bold: true }), { w: G3[1] })
      + tc(para(`Date : ${fmtDate(po.po_date)}`), { w: G3[2] }),
    )
    + tr(
      tc('', { w: G3[0], vmerge: 'continue' })
      + tc(para(`Delivery date: ${fmtDate(po.delivery_date)}`), { w: G3[1] })
      + tc(para(`Material: ${po.material_type || ''}`, { bold: true }), { w: G3[2] }),
    )
    + tr(
      tc('', { w: G3[0], vmerge: 'continue' })
      + tc(para(`Project: ${project}`, { bold: true }), { w: G3[1] + G3[2], span: 2 }),
    ),
  );

  // Vendor + delivery address
  const vendorLabel = vendor?.company_name || 'Vendor';
  const vendorExtra = [vendor?.contact_person, vendor?.phone].filter(Boolean).join(' · ');
  const vendorTable = table([4548, 4560],
    tr(
      tc(para(`TO  ${vendorLabel}`, { bold: true }) + (vendorExtra ? para(vendorExtra) : ''), { w: 4548 })
      + tc(para(`Delivery address:\n${po.delivery_address || ''}`, { bold: true }), { w: 4560 }),
    ),
  );

  // Items table
  const IG = [817, 3544, 1559, 1134, 2054];
  const headRow = tr(
    tc(para('S.NO', { bold: true, align: 'center' }), { w: IG[0], shade: 'D9D9D9' })
    + tc(para('DESCRIPTION OF GOODS', { bold: true }), { w: IG[1], shade: 'D9D9D9' })
    + tc(para('QUANTITY', { bold: true, align: 'center' }), { w: IG[2], shade: 'D9D9D9' })
    + tc(para('RATE', { bold: true, align: 'center' }), { w: IG[3], shade: 'D9D9D9' })
    + tc(para('AMOUNT', { bold: true, align: 'center' }), { w: IG[4], shade: 'D9D9D9' }),
  );
  const itemRows = (po.items.length ? po.items : []).map((it, idx) => tr(
    tc(para(String(idx + 1), { align: 'center' }), { w: IG[0] })
    + tc(para(it.description || ''), { w: IG[1] })
    + tc(para(`${fmtNum(it.quantity)}${it.uom ? ` ${it.uom}` : ''}`, { align: 'center' }), { w: IG[2] })
    + tc(para(fmtNum(it.rate), { align: 'right' }), { w: IG[3] })
    + tc(para(fmtNum(it.amount), { align: 'right' }), { w: IG[4] }),
  )).join('');
  const totalRow = (label: string, value: number, bold = true) => tr(
    tc(para(label, { bold, align: 'right' }), { w: IG[0] + IG[1] + IG[2] + IG[3], span: 4 })
    + tc(para(fmtNum(value), { bold, align: 'right' }), { w: IG[4] }),
  );
  let totalsRows = totalRow('TOTAL', subtotal);
  if (po.freight_charges) totalsRows += totalRow('Freight', po.freight_charges, false);
  if (po.gst_amount) {
    totalsRows += totalRow(`GST${po.gst_rate ? ` @ ${po.gst_rate}%` : ''}`, po.gst_amount, false);
    totalsRows += totalRow('GRAND TOTAL', po.total_amount);
  }
  const itemsTable = table(IG, headRow + itemRows + totalsRows);

  // Footer notes
  const gstNote = para(`Rates ${po.gst_type === 'exclusive' ? 'Exclusive' : 'Inclusive'} of GST`);
  const payTerms = po.credit_days != null
    ? para(`Payment terms shall be paid ${po.credit_days} DAYS from the material delivered at site`)
    : (po.additional_terms ? para(po.additional_terms) : '');
  const extraTerms = po.credit_days != null && po.additional_terms ? para(po.additional_terms) : '';

  const orderContactBlock = (orderName || po.order_contact_phone)
    ? para(`Any question regarding this order should be directed to:\nPurchase Department: ${orderName}${po.order_contact_phone ? `\nContact No: ${po.order_contact_phone}` : ''}`, { bold: true })
    : '';
  const deliveryContactBlock = (deliveryName || po.delivery_contact_phone)
    ? para(`For question regarding delivery should be directed to:\nSite engineer : ${deliveryName}${po.delivery_contact_phone ? ` - ${po.delivery_contact_phone}` : ''}`, { bold: true })
    : '';
  const notesBlock = po.notes ? para(po.notes) : '';
  const signature = para(`Thanking You,\nFor ${firm.name}${orderName ? `\n(${orderName})` : ''}`, { bold: true });

  const body =
    para('PURCHASE ORDER', { bold: true, size: 32, align: 'center' })
    + para(null)
    + headerTable + para(null)
    + vendorTable + para(null)
    + itemsTable + para(null)
    + gstNote + payTerms + extraTerms + para(null)
    + orderContactBlock + deliveryContactBlock + notesBlock + para(null) + para(null)
    + signature;

  const sectPr = '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>'
    + '<w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr>';

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
    + `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">`
    + `<w:body>${body}${sectPr}</w:body></w:document>`;
}

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
  + `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">`
  + `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>`
  + `<Default Extension="xml" ContentType="application/xml"/>`
  + `<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>`
  + `</Types>`;
const RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
  + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
  + `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>`
  + `</Relationships>`;

/** Build the .docx bytes for a purchase order. */
export function buildPoDocx(po: PurchaseOrder, firm: Firm, vendor?: PurchaseVendor): Blob {
  const enc = new TextEncoder();
  const entries: ZipEntry[] = [
    { name: '[Content_Types].xml', data: enc.encode(CONTENT_TYPES) },
    { name: '_rels/.rels', data: enc.encode(RELS) },
    { name: 'word/document.xml', data: enc.encode(buildDocumentXml(po, firm, vendor)) },
  ];
  const bytes = zipStore(entries);
  return new Blob([bytes as unknown as BlobPart], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
}

/** Generate + trigger a browser download of the PO as a .docx file. */
export function downloadPoDocx(po: PurchaseOrder, firm: Firm, vendor?: PurchaseVendor): void {
  const blob = buildPoDocx(po, firm, vendor);
  const safe = (po.po_number || 'purchase-order').replace(/[\\/:*?"<>|]+/g, '-');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `PO ${safe}.docx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
