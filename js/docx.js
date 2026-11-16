import { buildBrief } from "./readout.js";

const encoder = new TextEncoder();
const xml = value => String(value).replace(/[^\u0009\u000A\u000D\u0020-\uD7FF\uE000-\uFFFD\u{10000}-\u{10FFFF}]/gu, "")
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
// Stored ZIP entries keep the static browser export dependency-free.
function zip(files) {
  const chunks = [], directory = [];
  let offset = 0, directorySize = 0;
  for (const [path, content] of Object.entries(files)) {
    const name = encoder.encode(path), data = encoder.encode(content), crc = crc32(data);
    const local = new Uint8Array(30 + name.length), l = new DataView(local.buffer);
    l.setUint32(0, 0x04034b50, true); l.setUint16(4, 20, true);
    l.setUint16(12, 33, true); l.setUint32(14, crc, true);
    l.setUint32(18, data.length, true); l.setUint32(22, data.length, true);
    l.setUint16(26, name.length, true); local.set(name, 30);
    const central = new Uint8Array(46 + name.length), c = new DataView(central.buffer);
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true);
    c.setUint16(14, 33, true); c.setUint32(16, crc, true);
    c.setUint32(20, data.length, true); c.setUint32(24, data.length, true);
    c.setUint16(28, name.length, true); c.setUint32(42, offset, true); central.set(name, 46);
    chunks.push(local, data); directory.push(central);
    offset += local.length + data.length; directorySize += central.length;
  }
  const end = new Uint8Array(22), e = new DataView(end.buffer);
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, directory.length, true);
  e.setUint16(10, directory.length, true); e.setUint32(12, directorySize, true); e.setUint32(16, offset, true);
  const bytes = new Uint8Array(offset + directorySize + end.length);
  let position = 0;
  for (const chunk of [...chunks, ...directory, end]) { bytes.set(chunk, position); position += chunk.length; }
  return bytes;
}

export function buildDocx(snapshot) {
  const paragraph = (text, heading = false) => `<w:p><w:pPr>${heading ? "<w:keepNext/>" : ""}<w:spacing w:after="${heading ? 70 : 40}"/></w:pPr><w:r><w:rPr>${heading ? '<w:b/><w:color w:val="087560"/><w:sz w:val="21"/>' : '<w:sz w:val="17"/>'}</w:rPr><w:t xml:space="preserve">${xml(text)}</w:t></w:r></w:p>`;
  const body = buildBrief(snapshot).map(([title, lines]) => paragraph(title, true) + lines.map(line => paragraph(line)).join("")).join("");
  return zip({
    "[Content_Types].xml": '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    "_rels/.rels": '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    "word/document.xml": `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="680" w:right="680" w:bottom="680" w:left="680"/></w:sectPr></w:body></w:document>`,
  });
}
