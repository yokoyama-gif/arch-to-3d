#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const MAX_EXCEL_CELL_LENGTH = 32767;
const DEFAULT_RULES_PATH = path.join(__dirname, "category_rules.json");
const SEARCH_ROOTS = [
  path.join(process.env.USERPROFILE || "C:\\Users\\admin", "Desktop"),
  path.join(process.env.USERPROFILE || "C:\\Users\\admin", "Downloads"),
  path.join(process.env.USERPROFILE || "C:\\Users\\admin", "Documents"),
];
const USER_ROOT = process.env.USERPROFILE || "C:\\Users\\admin";

function main() {
  const args = parseArgs(process.argv.slice(2));
  const rules = loadRules(args.rules || DEFAULT_RULES_PATH);
  const inputPath = args.input ? path.resolve(args.input) : autoDetectInput();
  const conversations = loadConversations(inputPath);
  const { summaryRows, messageRows } = buildRows(
    conversations,
    rules,
    args.timezone || "Asia/Tokyo",
    Number(args.previewChars || 180)
  );
  const outputPath = resolveOutputPath(inputPath, args.output);
  writeWorkbook(outputPath, summaryRows, messageRows, Boolean(args.skipMessagesSheet));

  console.log(`Input: ${inputPath}`);
  console.log(`Excel exported: ${outputPath}`);
  console.log(`Conversations: ${summaryRows.length}`);
  console.log(`Messages: ${messageRows.length}`);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--input") args.input = argv[++i];
    else if (token === "--output") args.output = argv[++i];
    else if (token === "--rules") args.rules = argv[++i];
    else if (token === "--timezone") args.timezone = argv[++i];
    else if (token === "--preview-chars") args.previewChars = argv[++i];
    else if (token === "--skip-messages-sheet") args.skipMessagesSheet = true;
    else if (token === "--help" || token === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${token}`);
    }
  }
  return args;
}

function printHelp() {
  console.log("Usage:");
  console.log("  node chatgpt_history_to_excel_node.js [--input PATH] [--output PATH]");
  console.log("  If --input is omitted, the script searches Desktop/Downloads/Documents");
  console.log("  for a ChatGPT export ZIP containing conversations.json.");
}

function loadRules(rulesPath) {
  const raw = JSON.parse(fs.readFileSync(rulesPath, "utf8"));
  return Object.entries(raw).map(([code, payload]) => ({
    code,
    label: payload.label || code,
    keywords: (payload.keywords || []).map((keyword) => normalizeText(keyword)).filter(Boolean),
  }));
}

function autoDetectInput() {
  const primaryHit = chooseBestCandidate(collectCandidates(SEARCH_ROOTS));
  if (primaryHit) return primaryHit;

  const expandedHit = chooseBestCandidate(collectCandidates([USER_ROOT]));
  if (expandedHit) return expandedHit;

  throw new Error(
    "No ChatGPT export was found. Pass --input with the ZIP path or place the export under Desktop/Downloads/Documents."
  );
}

function collectCandidates(roots) {
  const candidates = [];
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    walk(root, (entryPath, stats) => {
      const lower = entryPath.toLowerCase();
      if (stats.isDirectory()) return;
      if (lower.endsWith("conversations.json")) {
        candidates.push({ path: entryPath, mtimeMs: stats.mtimeMs, type: "json" });
      } else if (lower.endsWith(".zip")) {
        candidates.push({ path: entryPath, mtimeMs: stats.mtimeMs, type: "zip" });
      }
    });
  }
  candidates.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return candidates;
}

function chooseBestCandidate(candidates) {
  for (const candidate of candidates) {
    if (candidate.type === "json") return candidate.path;
    if (candidate.type === "zip") {
      try {
        const archive = readZip(candidate.path);
        if (archive.entries.some((entry) => entry.name.toLowerCase().endsWith("conversations.json"))) {
          return candidate.path;
        }
      } catch (error) {
        // Ignore invalid ZIP candidates and continue.
      }
    }
  }
  return "";
}

function walk(root, onEntry) {
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch (error) {
      continue;
    }

    for (const entry of entries) {
      const entryPath = path.join(current, entry.name);
      let stats;
      try {
        stats = fs.statSync(entryPath);
      } catch (error) {
        continue;
      }
      onEntry(entryPath, stats);
      if (entry.isDirectory()) stack.push(entryPath);
    }
  }
}

function resolveOutputPath(inputPath, explicitOutput) {
  if (explicitOutput) {
    const resolved = path.resolve(explicitOutput);
    if (!resolved.toLowerCase().endsWith(".xlsx")) {
      throw new Error("Output must end with .xlsx");
    }
    return resolved;
  }

  const parsed = path.parse(inputPath);
  return path.join(parsed.dir, `${parsed.name}_classified.xlsx`);
}

function loadConversations(inputPath) {
  const stats = fs.statSync(inputPath);
  if (stats.isDirectory()) {
    const found = findConversationsJson(inputPath);
    return JSON.parse(fs.readFileSync(found, "utf8"));
  }

  if (inputPath.toLowerCase().endsWith(".json")) {
    return JSON.parse(fs.readFileSync(inputPath, "utf8"));
  }

  if (inputPath.toLowerCase().endsWith(".zip")) {
    const archive = readZip(inputPath);
    const entry = archive.entries.find((item) => item.name.toLowerCase().endsWith("conversations.json"));
    if (!entry) {
      throw new Error(`conversations.json not found in ZIP: ${inputPath}`);
    }
    return JSON.parse(extractZipEntry(archive.buffer, entry).toString("utf8"));
  }

  throw new Error("Input must be a ZIP export, export directory, or conversations.json");
}

function findConversationsJson(root) {
  let found = null;
  walk(root, (entryPath, stats) => {
    if (found || stats.isDirectory()) return;
    if (entryPath.toLowerCase().endsWith("conversations.json")) found = entryPath;
  });
  if (!found) throw new Error(`conversations.json not found under: ${root}`);
  return found;
}

function buildRows(conversations, rules, timezone, previewChars) {
  const summaryRows = [];
  const messageRows = [];

  for (const conversation of conversations) {
    const title = cleanText(conversation.title || "(no title)");
    const conversationId = String(conversation.id || "");
    const messages = extractMessages(conversation, title, conversationId, timezone);
    if (messages.length === 0) continue;

    messageRows.push(...messages);
    const userText = messages.filter((message) => message.role === "user").map((message) => message.content).join("\n");
    const classification = classifyConversation(title, userText, rules);
    const lastModel = [...messages].reverse().find((message) => message.model)?.model || "";
    const preview = cleanText((userText || messages[0].content || "").slice(0, previewChars));

    summaryRows.push({
      conversation_id: conversationId,
      title,
      category: classification.label,
      category_code: classification.code,
      score: classification.score,
      matched_keywords: classification.matchedKeywords.join(", "),
      created_at: renderTimestamp(conversation.create_time, timezone),
      updated_at: renderTimestamp(conversation.update_time, timezone),
      message_count: messages.length,
      user_message_count: messages.filter((message) => message.role === "user").length,
      assistant_message_count: messages.filter((message) => message.role === "assistant").length,
      last_model: lastModel,
      preview,
    });
  }

  summaryRows.sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
  return { summaryRows, messageRows };
}

function extractMessages(conversation, title, conversationId, timezone) {
  const mapping = conversation.mapping || {};
  if (!mapping || typeof mapping !== "object") return [];

  const pairs = mainPathPairs(mapping, conversation.current_node);
  const rows = buildMessageRowsFromPairs(pairs, title, conversationId, timezone);
  if (rows.length > 0) return rows;

  const fallbackPairs = Object.entries(mapping).sort((a, b) => {
    const timeDelta = extractTimestamp(a[1]) - extractTimestamp(b[1]);
    if (timeDelta !== 0) return timeDelta;
    return computeDepth(a[0], mapping) - computeDepth(b[0], mapping);
  });
  return buildMessageRowsFromPairs(fallbackPairs, title, conversationId, timezone);
}

function mainPathPairs(mapping, currentNode) {
  if (!currentNode) return [];
  const pairs = [];
  const seen = new Set();
  let nodeId = String(currentNode);
  if (!mapping[nodeId]) return [];

  while (nodeId && mapping[nodeId] && !seen.has(nodeId)) {
    seen.add(nodeId);
    const node = mapping[nodeId];
    pairs.push([nodeId, node]);
    nodeId = node.parent == null ? "" : String(node.parent);
  }
  return pairs.reverse();
}

function buildMessageRowsFromPairs(pairs, title, conversationId, timezone) {
  const rows = [];
  let turnIndex = 1;
  for (const [, node] of pairs) {
    const message = node.message || {};
    const role = String(message.author?.role || "unknown").trim().toLowerCase();
    const content = extractContentText(message.content);
    if (!content) continue;
    const metadata = message.metadata || {};
    rows.push({
      conversation_id: conversationId,
      title,
      turn_index: turnIndex,
      role,
      timestamp: renderTimestamp(message.create_time || node.create_time, timezone),
      model: String(metadata.model_slug || metadata.default_model_slug || ""),
      content,
    });
    turnIndex += 1;
  }
  return rows;
}

function extractContentText(content) {
  const fragments = [];

  function visit(value) {
    if (value == null) return;
    if (typeof value === "string") {
      const text = cleanText(value);
      if (text) fragments.push(text);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (typeof value === "object") {
      for (const key of ["parts", "text", "result", "content", "caption", "summary", "transcript", "title", "description"]) {
        if (key in value) visit(value[key]);
      }
    }
  }

  visit(content);
  return cleanText(fragments.join("\n"));
}

function classifyConversation(title, userText, rules) {
  const normalizedTitle = normalizeText(title);
  const normalizedUserText = normalizeText(userText);
  let best = { code: "other", label: "その他", score: 0, matchedKeywords: [] };

  for (const rule of rules) {
    let score = 0;
    const matchedKeywords = [];
    for (const keyword of rule.keywords) {
      if (!keyword) continue;
      if (normalizedTitle.includes(keyword)) {
        score += 3;
        matchedKeywords.push(keyword);
      } else if (normalizedUserText.includes(keyword)) {
        score += 1;
        matchedKeywords.push(keyword);
      }
    }
    if (score > best.score || (score === best.score && matchedKeywords.length > best.matchedKeywords.length)) {
      best = { code: rule.code, label: rule.label, score, matchedKeywords: matchedKeywords.slice(0, 10) };
    }
  }

  if (best.score === 0 && looksLikeCodeRequest(userText)) {
    return { code: "programming", label: "開発", score: 1, matchedKeywords: ["code-pattern"] };
  }

  return best;
}

function looksLikeCodeRequest(text) {
  const lowered = normalizeText(text);
  return ["```", "def ", "class ", "function ", "select ", "from ", "console.log", "traceback", "exception", "syntaxerror"]
    .some((pattern) => lowered.includes(pattern));
}

function renderTimestamp(rawValue, timezone) {
  if (rawValue == null || rawValue === "" || rawValue === 0) return "";
  const date = new Date(Number(rawValue) * 1000);
  if (Number.isNaN(date.getTime())) return String(rawValue);
  const formatter = new Intl.DateTimeFormat("sv-SE", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
}

function extractTimestamp(node) {
  const value = node?.message?.create_time || node?.create_time || 0;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function computeDepth(nodeId, mapping) {
  let depth = 0;
  const seen = new Set();
  let current = String(nodeId);
  while (current && mapping[current] && !seen.has(current)) {
    seen.add(current);
    current = mapping[current].parent == null ? "" : String(mapping[current].parent);
    depth += 1;
  }
  return depth;
}

function normalizeText(text) {
  return cleanText(String(text || "")).toLowerCase().replace(/\s+/g, " ");
}

function cleanText(text) {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+/g, " ")
    .trim()
    .slice(0, MAX_EXCEL_CELL_LENGTH);
}

function writeWorkbook(outputPath, summaryRows, messageRows, skipMessagesSheet) {
  const summaryHeaders = [
    "conversation_id",
    "title",
    "category",
    "category_code",
    "score",
    "matched_keywords",
    "created_at",
    "updated_at",
    "message_count",
    "user_message_count",
    "assistant_message_count",
    "last_model",
    "preview",
  ];
  const messageHeaders = ["conversation_id", "title", "turn_index", "role", "timestamp", "model", "content"];

  const categoryCounts = countBy(summaryRows, "category");
  const monthlyCounts = countBy(
    summaryRows.filter((row) => row.updated_at),
    (row) => row.updated_at.slice(0, 7)
  );
  const modelCounts = countBy(summaryRows.filter((row) => row.last_model), "last_model");
  const roleCounts = countBy(messageRows, "role");

  const sheets = [];
  sheets.push(makeSheet("Summary", [summaryHeaders, ...summaryRows.map((row) => summaryHeaders.map((key) => row[key]))]));
  if (!skipMessagesSheet) {
    sheets.push(makeSheet("Messages", [messageHeaders, ...messageRows.map((row) => messageHeaders.map((key) => row[key]))]));
  }

  const statsRows = [["Category", "Count", "", "Updated Month", "Count", "", "Model", "Count", "", "Role", "Count"]];
  const maxStatsRows = Math.max(categoryCounts.length, monthlyCounts.length, modelCounts.length, roleCounts.length);
  for (let i = 0; i < maxStatsRows; i += 1) {
    statsRows.push([
      categoryCounts[i]?.[0] || "",
      categoryCounts[i]?.[1] || "",
      "",
      monthlyCounts[i]?.[0] || "",
      monthlyCounts[i]?.[1] || "",
      "",
      modelCounts[i]?.[0] || "",
      modelCounts[i]?.[1] || "",
      "",
      roleCounts[i]?.[0] || "",
      roleCounts[i]?.[1] || "",
    ]);
  }
  sheets.push(makeSheet("Stats", statsRows));

  const files = buildWorkbookFiles(sheets);
  writeZip(outputPath, files);
}

function countBy(items, keyOrSelector) {
  const counter = new Map();
  for (const item of items) {
    const key = typeof keyOrSelector === "function" ? keyOrSelector(item) : item[keyOrSelector];
    const normalized = key || "";
    counter.set(normalized, (counter.get(normalized) || 0) + 1);
  }
  return [...counter.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return String(a[0]).localeCompare(String(b[0]));
  });
}

function makeSheet(name, rows) {
  return {
    name,
    rows: rows.map((row) => row.map((value) => (value == null ? "" : value))),
  };
}

function buildWorkbookFiles(sheets) {
  const files = {};
  files["[Content_Types].xml"] =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
    `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
    sheets.map((_, index) =>
      `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
    ).join("") +
    `</Types>`;

  files["_rels/.rels"] =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
    `</Relationships>`;

  files["xl/workbook.xml"] =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<sheets>` +
    sheets.map((sheet, index) => `<sheet name="${escapeXml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join("") +
    `</sheets></workbook>`;

  files["xl/_rels/workbook.xml.rels"] =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    sheets.map((_, index) =>
      `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`
    ).join("") +
    `<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
    `</Relationships>`;

  files["xl/styles.xml"] =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/></font></fonts>` +
    `<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1F4E78"/><bgColor indexed="64"/></patternFill></fill></fills>` +
    `<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>` +
    `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
    `<cellXfs count="3">` +
    `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>` +
    `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>` +
    `<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFill="1" applyFont="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>` +
    `</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>` +
    `</styleSheet>`;

  sheets.forEach((sheet, index) => {
    files[`xl/worksheets/sheet${index + 1}.xml`] = buildSheetXml(sheet.rows);
  });

  return files;
}

function buildSheetXml(rows) {
  const colWidths = inferColumnWidths(rows);
  const maxCol = rows.reduce((max, row) => Math.max(max, row.length), 0);
  const dimension = rows.length > 0 ? `A1:${cellRef(maxCol || 1, rows.length)}` : "A1";

  let xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`;
  xml += `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">`;
  xml += `<dimension ref="${dimension}"/>`;
  xml += `<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>`;
  xml += `<sheetFormatPr defaultRowHeight="15"/>`;
  xml += `<cols>`;
  colWidths.forEach((width, index) => {
    xml += `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`;
  });
  xml += `</cols><sheetData>`;

  rows.forEach((row, rowIndex) => {
    xml += `<row r="${rowIndex + 1}">`;
    row.forEach((value, colIndex) => {
      const ref = cellRef(colIndex + 1, rowIndex + 1);
      const style = rowIndex === 0 ? 2 : 1;
      if (typeof value === "number") {
        xml += `<c r="${ref}" s="${style}"><v>${value}</v></c>`;
      } else {
        xml += `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(cleanText(String(value)))}</t></is></c>`;
      }
    });
    xml += `</row>`;
  });

  xml += `</sheetData></worksheet>`;
  return xml;
}

function inferColumnWidths(rows) {
  const sampleSize = Math.min(rows.length, 200);
  const maxCols = rows.reduce((max, row) => Math.max(max, row.length), 0);
  const widths = [];
  for (let col = 0; col < maxCols; col += 1) {
    let length = 12;
    for (let row = 0; row < sampleSize; row += 1) {
      const value = rows[row]?.[col];
      length = Math.max(length, String(value == null ? "" : value).slice(0, 120).length + 2);
    }
    widths.push(Math.min(length, 60));
  }
  return widths;
}

function cellRef(columnNumber, rowNumber) {
  let columnName = "";
  let current = columnNumber;
  while (current > 0) {
    const remainder = (current - 1) % 26;
    columnName = String.fromCharCode(65 + remainder) + columnName;
    current = Math.floor((current - 1) / 26);
  }
  return `${columnName}${rowNumber}`;
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function readZip(zipPath) {
  const buffer = fs.readFileSync(zipPath);
  const eocdOffset = findEocdOffset(buffer);
  if (eocdOffset < 0) throw new Error(`EOCD not found in ZIP: ${zipPath}`);
  const centralDirSize = buffer.readUInt32LE(eocdOffset + 12);
  const centralDirOffset = buffer.readUInt32LE(eocdOffset + 16);
  const entries = [];
  let offset = centralDirOffset;
  while (offset < centralDirOffset + centralDirSize) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) break;
    const compressionMethod = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.slice(offset + 46, offset + 46 + fileNameLength).toString("utf8");
    entries.push({
      name,
      compressionMethod,
      compressedSize,
      uncompressedSize,
      localHeaderOffset,
    });
    offset += 46 + fileNameLength + extraLength + commentLength;
  }
  return { buffer, entries };
}

function findEocdOffset(buffer) {
  for (let offset = buffer.length - 22; offset >= Math.max(0, buffer.length - 66000); offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) return offset;
  }
  return -1;
}

function extractZipEntry(buffer, entry) {
  const localHeaderOffset = entry.localHeaderOffset;
  if (buffer.readUInt32LE(localHeaderOffset) !== 0x04034b50) {
    throw new Error(`Invalid local header for ${entry.name}`);
  }
  const fileNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
  const extraLength = buffer.readUInt16LE(localHeaderOffset + 28);
  const start = localHeaderOffset + 30 + fileNameLength + extraLength;
  const end = start + entry.compressedSize;
  const compressed = buffer.slice(start, end);
  if (entry.compressionMethod === 0) return compressed;
  if (entry.compressionMethod === 8) return zlib.inflateRawSync(compressed);
  throw new Error(`Unsupported compression method ${entry.compressionMethod} for ${entry.name}`);
}

function writeZip(outputPath, files) {
  const entries = [];
  const localParts = [];
  let offset = 0;

  for (const [name, content] of Object.entries(files)) {
    const data = Buffer.isBuffer(content) ? content : Buffer.from(content, "utf8");
    const nameBuffer = Buffer.from(name.replace(/\\/g, "/"), "utf8");
    const crc = crc32(data);
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(crc >>> 0, 14);
    localHeader.writeUInt32LE(data.length, 18);
    localHeader.writeUInt32LE(data.length, 22);
    localHeader.writeUInt16LE(nameBuffer.length, 26);
    localHeader.writeUInt16LE(0, 28);
    localParts.push(localHeader, nameBuffer, data);
    entries.push({ nameBuffer, data, crc, offset });
    offset += localHeader.length + nameBuffer.length + data.length;
  }

  const centralParts = [];
  let centralSize = 0;
  for (const entry of entries) {
    const header = Buffer.alloc(46);
    header.writeUInt32LE(0x02014b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(20, 6);
    header.writeUInt16LE(0, 8);
    header.writeUInt16LE(0, 10);
    header.writeUInt16LE(0, 12);
    header.writeUInt16LE(0, 14);
    header.writeUInt32LE(entry.crc >>> 0, 16);
    header.writeUInt32LE(entry.data.length, 20);
    header.writeUInt32LE(entry.data.length, 24);
    header.writeUInt16LE(entry.nameBuffer.length, 28);
    header.writeUInt16LE(0, 30);
    header.writeUInt16LE(0, 32);
    header.writeUInt16LE(0, 34);
    header.writeUInt16LE(0, 36);
    header.writeUInt32LE(0, 38);
    header.writeUInt32LE(entry.offset, 42);
    centralParts.push(header, entry.nameBuffer);
    centralSize += header.length + entry.nameBuffer.length;
  }

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralSize, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  fs.writeFileSync(outputPath, Buffer.concat([...localParts, ...centralParts, eocd]));
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) {
    crc = CRC_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

try {
  main();
} catch (error) {
  console.error(error.message || error);
  process.exit(1);
}
