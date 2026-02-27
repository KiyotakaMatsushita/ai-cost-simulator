/**
 * AI Cost Strategy Simulator - Deno Edition
 *
 * Usage:
 *   deno run --allow-net --allow-read price_simulation_deno.ts
 *
 * Then open http://localhost:8000 in a browser.
 * Pricing is loaded from pricing.json in the same directory.
 */

const pricingJsonPath = new URL("./pricing.json", import.meta.url);
const pricingJson = await Deno.readTextFile(pricingJsonPath);

const _validated = JSON.parse(pricingJson) as Record<string, { name: string }>;
console.log(
  `Loaded pricing for: ${Object.values(_validated).map((m) => m.name).join(", ")}`,
);

const HTML = /*html*/ `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>AI Cost Strategy Simulator</title>
<script src="https://cdn.tailwindcss.com"></script>
<script src="https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js"></script>
<style>
  body { font-family: 'Inter', system-ui, -apple-system, sans-serif; }
  input[type=number] { -moz-appearance: textfield; }
  input[type=number]::-webkit-inner-spin-button,
  input[type=number]::-webkit-outer-spin-button { opacity: 1; }
  table { border-collapse: collapse; }
  .tip { position: relative; cursor: help; }
  .tip .tip-text { visibility: hidden; opacity: 0; position: absolute; left: 50%; bottom: calc(100% + 6px); transform: translateX(-50%); background: #1e293b; color: #f8fafc; font-size: 11px; line-height: 1.5; padding: 6px 10px; border-radius: 6px; white-space: nowrap; z-index: 50; pointer-events: none; transition: opacity 0.15s; }
  .tip .tip-text::after { content: ''; position: absolute; top: 100%; left: 50%; margin-left: -4px; border: 4px solid transparent; border-top-color: #1e293b; }
  .tip:hover .tip-text { visibility: visible; opacity: 1; }
</style>
</head>
<body class="min-h-screen bg-white text-slate-800 antialiased">
<div id="app" class="max-w-7xl mx-auto px-6 py-10"></div>

<script>
// \u2500\u2500 Pricing Data \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
const pricingData = __PRICING_DATA__;

// \u2500\u2500 Presets \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
const presets = [
  {
    name: '\u5C0F\u898F\u6A21 PoC',
    cacheTokens: 30000, cacheReadTokens: 30000, promptTokens: 5000, outputTokens: 1500,
    userCount: 500, reqPerUser: 5, testDays: 14, hoursPerDay: 24,
    isSharedCache: true, claudeWriteType: '1h', cacheHitRate: 80, claudeWritesPerDay: 0,
  },
  {
    name: '\u672C\u756A\u904B\u7528',
    cacheTokens: 50000, cacheReadTokens: 50000, promptTokens: 7000, outputTokens: 2000,
    userCount: 2500, reqPerUser: 10, testDays: 30, hoursPerDay: 24,
    isSharedCache: true, claudeWriteType: '1h', cacheHitRate: 90, claudeWritesPerDay: 0,
  },
  {
    name: '\u5927\u898F\u6A21\u5C55\u958B',
    cacheTokens: 100000, cacheReadTokens: 80000, promptTokens: 10000, outputTokens: 3000,
    userCount: 10000, reqPerUser: 20, testDays: 30, hoursPerDay: 24,
    isSharedCache: true, claudeWriteType: '1h', cacheHitRate: 95, claudeWritesPerDay: 0,
  },
];

// \u2500\u2500 AgentCore Memory Pricing \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
const memoryPricing = {
  stmEvent:      0.25 / 1000,
  ltmStorage:    0.75 / 1000,
  ltmStorageOvr: 0.25 / 1000,
  ltmRetrieval:  0.50 / 1000,
};

const memoryPresets = [
  { name: '\u5C0F\u898F\u6A21 PoC', desc: '100\u4EBA\u00D7\u9031\u6570\u56DE', userCount: 100, sessionsPerUser: 8, roundtripsPerSession: 2, retrievalsPerSession: 1, recordsPerUser: 5, useOverrideStrategy: false },
  { name: '\u672C\u756A\u904B\u7528', desc: '1\u4E07\u4EBA\u00D7\u65E5\u5E38\u5229\u7528', userCount: 10000, sessionsPerUser: 20, roundtripsPerSession: 2, retrievalsPerSession: 1, recordsPerUser: 10, useOverrideStrategy: false },
  { name: '\u5927\u898F\u6A21', desc: '10\u4E07\u4EBA\u00D7\u9AD8\u983B\u5EA6', userCount: 100000, sessionsPerUser: 30, roundtripsPerSession: 3, retrievalsPerSession: 2, recordsPerUser: 20, useOverrideStrategy: false },
];

// \u2500\u2500 State \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
const state = {
  activeTab: (['simulator','scenario','memory'].indexOf(location.hash.replace('#','')) !== -1 ? location.hash.replace('#','') : 'simulator'),
  exchangeRate: 155.00,
  // Simulator tab
  sim: {
    cacheTokens: 50000, promptTokens: 7000, outputTokens: 2000, cacheReadTokens: 50000,
    userCount: 2500, reqPerUser: 10, testDays: 7, hoursPerDay: 24,
    claudeWriteType: '1h', isSharedCache: true, cacheHitRate: 90, claudeWritesPerDay: 0,
  },
  // Scenario tab
  activeScenario: 0,
  scenarios: presets.map(p => ({ ...p })),
  // Memory tab
  mem: {
    userCount: 10000,
    sessionsPerUser: 20,
    roundtripsPerSession: 2,
    retrievalsPerSession: 1,
    recordsPerUser: 10,
    stmEventsPerRequest: 2,
    ltmRetrievalTiming: 'every',
    useOverrideStrategy: false,
    // LLM extraction cost (linked to Override strategy)
    extractionEnabled: false,
    extractionModel: 'claude45Haiku',
    extractionInputTokens: 2000,
    extractionOutputTokens: 200,
  },
};

// \u2500\u2500 Helpers \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
function fJ(usd) { return (Number(usd) * state.exchangeRate).toLocaleString('ja-JP', { minimumFractionDigits: 0, maximumFractionDigits: 0 }); }
function fJ2(usd) { return (Number(usd) * state.exchangeRate).toLocaleString('ja-JP', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fU(v) { return Number(v).toFixed(2); }

// Auto-calculate Claude writes/day based on request frequency and TTL
// If requests arrive more frequently than the TTL, the cache stays alive (sliding window) → 1 write/day
// Otherwise, each request triggers a fresh cache write
function calcClaudeWpd(p) {
  const totalReqs = p.userCount * p.reqPerUser;
  const rpd = p.isSharedCache ? totalReqs / p.testDays : p.reqPerUser / p.testDays;
  if (rpd === 0 || p.hoursPerDay === 0) return 0;
  const ttlHours = p.claudeWriteType === '1h' ? 1 : 5 / 60;
  const avgInterval = p.hoursPerDay / rpd;
  if (avgInterval <= ttlHours) return 1;
  return Math.ceil(rpd);
}
function getClaudeWpd(p) {
  return (p.claudeWritesPerDay > 0) ? p.claudeWritesPerDay : calcClaudeWpd(p);
}
// OpenAI: automatic caching, no write surcharge, ~5min TTL
function calcOpenAIWpd(p) {
  const totalReqs = p.userCount * p.reqPerUser;
  const rpd = p.isSharedCache ? totalReqs / p.testDays : p.reqPerUser / p.testDays;
  if (rpd === 0 || p.hoursPerDay === 0) return 0;
  const ttlHours = 5 / 60;
  const avgInterval = p.hoursPerDay / rpd;
  if (avgInterval <= ttlHours) return 1;
  return Math.ceil(rpd);
}
function getWpd(key, p) {
  if (key.includes('claude')) return getClaudeWpd(p);
  if (key.includes('gpt')) return calcOpenAIWpd(p);
  return 1; // Gemini: persistent
}

function computeResults(p) {
  const totalReqs = p.userCount * p.reqPerUser;
  const totalHours = p.hoursPerDay * p.testDays;
  const hitRate = (p.cacheHitRate ?? 100) / 100;
  const results = Object.entries(pricingData).map(([key, m]) => {
    const ic = key.includes('claude');
    const io = key.includes('gpt');
    const cM = p.cacheTokens / 1e6, rM = p.cacheReadTokens / 1e6, pM = p.promptTokens / 1e6, oM = p.outputTokens / 1e6;
    const sc = p.isSharedCache ? 1 : p.userCount;
    const wp = ic ? (p.claudeWriteType === '1h' ? m.cacheWrite1h : m.cacheWrite5m) : m.input;
    const wpd = getWpd(key, p);
    const wr = cM * wp * wpd * p.testDays * sc;
    const st = cM * m.storage * totalHours * sc;
    // Cache miss pays full input price instead of cached price
    const rd = rM * (m.cachedInput * hitRate + m.input * (1 - hitRate)) * totalReqs;
    const pr = pM * m.input * totalReqs;
    const ou = oM * m.output * totalReqs;
    const tot = wr + st + rd + pr + ou;
    const pReq = totalReqs > 0 ? tot / totalReqs : 0;
    const noC = (p.cacheReadTokens + p.promptTokens) / 1e6 * m.input * totalReqs + ou;
    return { ...m, id: key, isClaude: ic, isOpenAI: io, writePrice: wp, writesPerDay: wpd, write: wr, storageCost: st, read: rd, prompt: pr, outputCost: ou, total: tot, perReq: pReq, noCache: noC, savPct: (((noC - tot) / noC) * 100).toFixed(1), savUSD: noC - tot };
  });
  return { results, totalReqs, totalHours };
}

function computeTimeSeries(p) {
  const dailyReqs = (p.userCount * p.reqPerUser) / p.testDays;
  const hitRate = (p.cacheHitRate ?? 100) / 100;
  return Object.entries(pricingData).map(([key, m]) => {
    const ic = key.includes('claude');
    const cM = p.cacheTokens / 1e6, rM = p.cacheReadTokens / 1e6, pM = p.promptTokens / 1e6, oM = p.outputTokens / 1e6;
    const sc = p.isSharedCache ? 1 : p.userCount;
    const wp = ic ? (p.claudeWriteType === '1h' ? m.cacheWrite1h : m.cacheWrite5m) : m.input;
    const wpd = getWpd(key, p);
    const dWrite = cM * wp * wpd * sc;
    const dStorage = cM * m.storage * p.hoursPerDay * sc;
    const dRead = rM * (m.cachedInput * hitRate + m.input * (1 - hitRate)) * dailyReqs;
    const dPrompt = pM * m.input * dailyReqs;
    const dOutput = oM * m.output * dailyReqs;
    const daily = dWrite + dStorage + dRead + dPrompt + dOutput;
    const pts = [];
    for (let d = 0; d <= p.testDays; d++) pts.push({ day: d, usd: daily * d });
    return { ...m, id: key, points: pts, daily, total: daily * p.testDays };
  });
}

function computeMemoryResults(m) {
  const totalSessions = m.userCount * m.sessionsPerUser;
  const totalRoundtrips = totalSessions * m.roundtripsPerSession;
  const eventsPerRT = m.stmEventsPerRequest || 2;
  const totalEvents = totalRoundtrips * eventsPerRT;
  const totalRetrievals = m.ltmRetrievalTiming === 'first'
    ? totalSessions * m.retrievalsPerSession
    : totalRoundtrips * m.retrievalsPerSession;
  const totalRecords = m.userCount * m.recordsPerUser;

  const stmCost = totalEvents * memoryPricing.stmEvent;
  const ltmStorageCostDefault = totalRecords * memoryPricing.ltmStorage;
  const ltmStorageCostOverride = totalRecords * memoryPricing.ltmStorageOvr;
  const ltmStorageCost = m.useOverrideStrategy ? ltmStorageCostOverride : ltmStorageCostDefault;
  const ltmRetrievalCost = totalRetrievals * memoryPricing.ltmRetrieval;

  // LLM extraction cost (Override strategy uses appendToPrompt + modelId → Bedrock inference charged separately)
  let extractionCost = 0;
  if (m.extractionModel && pricingData[m.extractionModel]) {
    const em = pricingData[m.extractionModel];
    const inMTok = (m.extractionInputTokens || 0) / 1e6;
    const outMTok = (m.extractionOutputTokens || 0) / 1e6;
    extractionCost = (inMTok * em.input + outMTok * em.output) * totalRoundtrips;
  }

  // Default: AWS handles extraction automatically (included in storage price) → no separate LLM cost
  // Override: User provides custom extraction prompt → LLM inference cost applies
  const totalCostDefault = stmCost + ltmStorageCostDefault + ltmRetrievalCost;
  const totalCostOverride = stmCost + ltmStorageCostOverride + ltmRetrievalCost + extractionCost;
  const totalCost = m.useOverrideStrategy ? totalCostOverride : totalCostDefault;

  const perRequest = totalRoundtrips > 0 ? totalCost / totalRoundtrips : 0;
  const perSession = totalSessions > 0 ? totalCost / totalSessions : 0;
  const perUserMonth = m.userCount > 0 ? totalCost / m.userCount : 0;
  const perUserYear = perUserMonth * 12;

  return {
    totalSessions, totalEvents, totalRetrievals, totalRecords, totalRoundtrips, eventsPerRT,
    stmCost, ltmStorageCost, ltmStorageCostDefault, ltmStorageCostOverride,
    ltmRetrievalCost, extractionCost, totalCost, totalCostDefault, totalCostOverride,
    perRequest, perSession, perUserMonth, perUserYear,
  };
}

function niceNum(v) {
  if (v <= 0) return 1;
  const exp = Math.floor(Math.log10(v));
  const f = v / Math.pow(10, exp);
  let n; if (f <= 1.2) n = 1.2; else if (f <= 1.5) n = 1.5; else if (f <= 2) n = 2; else if (f <= 3) n = 3; else if (f <= 5) n = 5; else if (f <= 7.5) n = 7.5; else n = 10;
  return n * Math.pow(10, exp);
}

function buildChart(series, maxDays, rate) {
  const W = 900, H = 380, pad = { t: 24, r: 140, b: 44, l: 80 };
  const pw = W - pad.l - pad.r, ph = H - pad.t - pad.b;
  const maxJPY = niceNum(Math.max(...series.map(s => s.total * rate)));
  const x = d => pad.l + (d / maxDays) * pw;
  const y = v => pad.t + ph - (v / maxJPY) * ph;

  let svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="w-full border border-slate-200 rounded-lg bg-white">';

  // grid
  const gSteps = 5;
  for (let i = 0; i <= gSteps; i++) {
    const val = (maxJPY / gSteps) * i;
    svg += '<line x1="' + pad.l + '" y1="' + y(val) + '" x2="' + (W - pad.r) + '" y2="' + y(val) + '" stroke="#f1f5f9" stroke-width="1"/>';
    const label = val >= 1e6 ? (val / 1e6).toFixed(1) + 'M' : val >= 1e3 ? (val / 1e3).toFixed(0) + 'k' : val.toFixed(0);
    svg += '<text x="' + (pad.l - 8) + '" y="' + (y(val) + 3) + '" text-anchor="end" fill="#94a3b8" font-size="10">&yen;' + label + '</text>';
  }

  // x axis
  const xStep = maxDays <= 7 ? 1 : maxDays <= 14 ? 2 : maxDays <= 30 ? 5 : 10;
  for (let d = 0; d <= maxDays; d += xStep) {
    svg += '<line x1="' + x(d) + '" y1="' + (pad.t) + '" x2="' + x(d) + '" y2="' + (H - pad.b) + '" stroke="#f8fafc" stroke-width="1"/>';
    svg += '<text x="' + x(d) + '" y="' + (H - pad.b + 18) + '" text-anchor="middle" fill="#94a3b8" font-size="10">' + d + '\u65E5</text>';
  }

  // axes
  svg += '<line x1="' + pad.l + '" y1="' + pad.t + '" x2="' + pad.l + '" y2="' + (H - pad.b) + '" stroke="#e2e8f0" stroke-width="1"/>';
  svg += '<line x1="' + pad.l + '" y1="' + (H - pad.b) + '" x2="' + (W - pad.r) + '" y2="' + (H - pad.b) + '" stroke="#e2e8f0" stroke-width="1"/>';

  // lines + end labels
  series.forEach(s => {
    const pts = s.points.map(p => x(p.day) + ',' + y(p.usd * rate)).join(' ');
    svg += '<polyline points="' + pts + '" fill="none" stroke="' + s.color + '" stroke-width="2.5" stroke-linecap="round"/>';
    const last = s.points[s.points.length - 1];
    const ly = y(last.usd * rate);
    svg += '<circle cx="' + x(last.day) + '" cy="' + ly + '" r="3" fill="' + s.color + '"/>';
    svg += '<text x="' + (x(last.day) + 8) + '" y="' + (ly + 4) + '" fill="' + s.color + '" font-size="10" font-weight="600">' + s.name + '</text>';
    svg += '<text x="' + (x(last.day) + 8) + '" y="' + (ly + 16) + '" fill="#94a3b8" font-size="9">&yen;' + fJ(last.usd) + '</text>';
  });

  svg += '</svg>';
  return svg;
}

function buildPieChart(slices) {
  const total = slices.reduce((s, d) => s + d.value, 0);
  if (total === 0) return '<p class="text-sm text-slate-400">No data</p>';
  const W = 320, H = 240, cx = 120, cy = 120, R = 90, r = 55;
  let svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="w-full max-w-xs">';
  let angle = -Math.PI / 2;
  slices.forEach((d, i) => {
    const pct = d.value / total;
    const a1 = angle;
    const a2 = angle + pct * 2 * Math.PI;
    const large = pct > 0.5 ? 1 : 0;
    const x1o = cx + R * Math.cos(a1), y1o = cy + R * Math.sin(a1);
    const x2o = cx + R * Math.cos(a2), y2o = cy + R * Math.sin(a2);
    const x1i = cx + r * Math.cos(a2), y1i = cy + r * Math.sin(a2);
    const x2i = cx + r * Math.cos(a1), y2i = cy + r * Math.sin(a1);
    svg += '<path d="M' + x1o + ',' + y1o + ' A' + R + ',' + R + ' 0 ' + large + ' 1 ' + x2o + ',' + y2o +
      ' L' + x1i + ',' + y1i + ' A' + r + ',' + r + ' 0 ' + large + ' 0 ' + x2i + ',' + y2i + ' Z" fill="' + d.color + '" opacity="0.85"/>';
    angle = a2;
  });
  // center text
  svg += '<text x="' + cx + '" y="' + (cy - 4) + '" text-anchor="middle" font-size="10" fill="#64748b">Total</text>';
  svg += '<text x="' + cx + '" y="' + (cy + 12) + '" text-anchor="middle" font-size="13" font-weight="600" fill="#1e293b">$' + fU(total) + '</text>';
  // legend
  const lx = 250;
  slices.forEach((d, i) => {
    const ly = 60 + i * 50;
    svg += '<rect x="' + lx + '" y="' + (ly - 6) + '" width="10" height="10" rx="2" fill="' + d.color + '"/>';
    svg += '<text x="' + (lx + 16) + '" y="' + (ly + 3) + '" font-size="10" fill="#475569">' + d.label + '</text>';
    svg += '<text x="' + (lx + 16) + '" y="' + (ly + 17) + '" font-size="11" font-weight="600" fill="#1e293b">$' + fU(d.value) + ' (' + (total > 0 ? (d.value / total * 100).toFixed(1) : '0') + '%)</text>';
  });
  svg += '</svg>';
  return svg;
}

function inputCls() { return 'mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400'; }

function paramGrid(prefix, p, totalHours) {
  return '<div class="grid grid-cols-2 lg:grid-cols-4 gap-3">' +
    [
      ['\u30AD\u30E3\u30C3\u30B7\u30E5\u91CF C', 'cacheTokens'],
      ['\u518D\u5229\u7528\u30D2\u30C3\u30C8 R', 'cacheReadTokens'],
      ['\u65B0\u898F\u30D7\u30ED\u30F3\u30D7\u30C8 P', 'promptTokens'],
      ['\u56DE\u7B54\u30C8\u30FC\u30AF\u30F3 O', 'outputTokens'],
      ['\u5229\u7528\u8005\u6570 U', 'userCount'],
      ['\u56DE\u6570/\u30E6\u30FC\u30B6\u30FC N', 'reqPerUser'],
      ['\u30C6\u30B9\u30C8\u65E5\u6570 D', 'testDays'],
      ['Gemini\u4FDD\u6301 h/\u65E5' + (totalHours ? ' (\u8A08' + totalHours + 'h)' : ''), 'hoursPerDay'],
      ['\u30AD\u30E3\u30C3\u30B7\u30E5\u30D2\u30C3\u30C8\u7387 %', 'cacheHitRate'],
    ].map(([label, key]) =>
      '<label class="block"><span class="text-xs text-slate-500">' + label + '</span>' +
      '<input type="number" data-prefix="' + prefix + '" data-key="' + key + '" value="' + p[key] + '" class="' + inputCls() + '" /></label>'
    ).join('') +
    '</div>';
}

function memoryParamGrid(m) {
  const fields = [
    ['\u30E6\u30FC\u30B6\u30FC\u6570', 'userCount', '\u6708\u9593\u30A2\u30AF\u30C6\u30A3\u30D6\u30E6\u30FC\u30B6\u30FC\u6570'],
    ['\u30BB\u30C3\u30B7\u30E7\u30F3/\u30E6\u30FC\u30B6\u30FC/\u6708', 'sessionsPerUser', '1\u30E6\u30FC\u30B6\u30FC\u304C\u6708\u306B\u958B\u59CB\u3059\u308B\u4F1A\u8A71\u306E\u56DE\u6570\u3002\u30BB\u30C3\u30B7\u30E7\u30F3 = 1\u56DE\u306E\u4F1A\u8A71 (session_id)'],
    ['\u30EA\u30AF\u30A8\u30B9\u30C8/\u30BB\u30C3\u30B7\u30E7\u30F3', 'roundtripsPerSession', '1\u4F1A\u8A71\u5185\u306E\u5F80\u5FA9\u56DE\u6570\u3002\u30E6\u30FC\u30B6\u30FC\u767A\u8A00\u2192AI\u5FDC\u7B54 = 1\u30EA\u30AF\u30A8\u30B9\u30C8'],
    ['STM\u30A4\u30D9\u30F3\u30C8/\u30EA\u30AF\u30A8\u30B9\u30C8', 'stmEventsPerRequest', 'batch_size=1: 2 (user+assistant\u500B\u5225\u9001\u4FE1), batch_size=2: 1 (\u307E\u3068\u3081\u3066\u9001\u4FE1)'],
    ['LTM\u691C\u7D22/\u30EA\u30AF\u30A8\u30B9\u30C8', 'retrievalsPerSession', '\u30EA\u30AF\u30A8\u30B9\u30C8\u3054\u3068\u306BLTM\u304B\u3089\u904E\u53BB\u306E\u8A18\u61B6\u3092\u691C\u7D22\u3059\u308B\u56DE\u6570\u3002\u901A\u5E381\u56DE'],
    ['LTM\u30EC\u30B3\u30FC\u30C9/\u30E6\u30FC\u30B6\u30FC', 'recordsPerUser', '\u30E6\u30FC\u30B6\u30FC\u3054\u3068\u306B\u84C4\u7A4D\u3055\u308C\u308BLTM\u30EC\u30B3\u30FC\u30C9\u6570\uFF08\u597D\u307F\u30FB\u4E8B\u5B9F\u7B49\uFF09'],
  ];
  return '<div class="grid grid-cols-2 lg:grid-cols-3 gap-3">' +
    fields.map(([label, key, desc]) =>
      '<label class="block"><span class="text-xs text-slate-500">' + label +
        ' <span class="tip"><svg class="inline w-3.5 h-3.5 -mt-0.5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke-width="1.5"/><path stroke-width="1.5" d="M9.5 9.5a2.5 2.5 0 0 1 4.99.5c0 1.5-2.49 2-2.49 3M12 17h.01"/></svg>' +
        '<span class="tip-text">' + desc + '</span></span></span>' +
      '<input type="number" data-prefix="mem" data-key="' + key + '" value="' + m[key] + '" class="' + inputCls() + '" /></label>'
    ).join('') +
    '</div>';
}

function extractionModelOptions(m) {
  const models = Object.entries(pricingData).map(([key, mod]) => ({ key, name: mod.name, input: mod.input, output: mod.output }));
  return models.map(mod =>
    '<option value="' + mod.key + '"' + (m.extractionModel === mod.key ? ' selected' : '') + '>' +
      mod.name + ' (in:$' + mod.input.toFixed(2) + ' / out:$' + mod.output.toFixed(2) + '/MTok)' +
    '</option>'
  ).join('');
}

function extractionParamSection(m) {
  if (!m.useOverrideStrategy) return '';
  return '<div class="grid grid-cols-2 lg:grid-cols-3 gap-3 mt-3">' +
    '<label class="block"><span class="text-xs text-slate-500">\u62BD\u51FA\u30E2\u30C7\u30EB <span class="tip"><svg class="inline w-3.5 h-3.5 -mt-0.5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke-width="1.5"/><path stroke-width="1.5" d="M9.5 9.5a2.5 2.5 0 0 1 4.99.5c0 1.5-2.49 2-2.49 3M12 17h.01"/></svg><span class="tip-text" style="white-space:normal;width:300px;">appendToPrompt + modelId \u6307\u5B9A\u6642\u3001\u62BD\u51FA\u30FB\u7D71\u5408\u306E LLM \u63A8\u8AD6\u304C Bedrock \u6599\u91D1\u3068\u3057\u3066\u5225\u9014\u8AB2\u91D1\u3055\u308C\u308B</span></span></span>' +
      '<select data-extraction-model class="' + inputCls() + '">' + extractionModelOptions(m) + '</select></label>' +
    '<label class="block"><span class="text-xs text-slate-500">\u62BD\u51FA\u5165\u529B\u30C8\u30FC\u30AF\u30F3 <span class="tip"><svg class="inline w-3.5 h-3.5 -mt-0.5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke-width="1.5"/><path stroke-width="1.5" d="M9.5 9.5a2.5 2.5 0 0 1 4.99.5c0 1.5-2.49 2-2.49 3M12 17h.01"/></svg><span class="tip-text" style="white-space:normal;width:280px;">\u30B7\u30B9\u30C6\u30E0\u30D7\u30ED\u30F3\u30D7\u30C8 + appendToPrompt + \u4F1A\u8A71\u30B3\u30F3\u30C6\u30AD\u30B9\u30C8\u3002\u7D04 2,000 tok</span></span></span>' +
      '<input type="number" data-prefix="mem" data-key="extractionInputTokens" value="' + m.extractionInputTokens + '" class="' + inputCls() + '" /></label>' +
    '<label class="block"><span class="text-xs text-slate-500">\u62BD\u51FA\u51FA\u529B\u30C8\u30FC\u30AF\u30F3 <span class="tip"><svg class="inline w-3.5 h-3.5 -mt-0.5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke-width="1.5"/><path stroke-width="1.5" d="M9.5 9.5a2.5 2.5 0 0 1 4.99.5c0 1.5-2.49 2-2.49 3M12 17h.01"/></svg><span class="tip-text" style="white-space:normal;width:280px;">\u62BD\u51FA\u3055\u308C\u308B\u30EC\u30B3\u30FC\u30C9 (1\u301C3\u4EF6)\u3002\u7D04 200 tok</span></span></span>' +
      '<input type="number" data-prefix="mem" data-key="extractionOutputTokens" value="' + m.extractionOutputTokens + '" class="' + inputCls() + '" /></label>' +
    '</div>';
}

function optionBtns(prefix, p) {
  const autoWpd = calcClaudeWpd(p);
  const currentWpd = getClaudeWpd(p);
  const isAuto = !p.claudeWritesPerDay || p.claudeWritesPerDay <= 0;
  return '<div class="flex flex-wrap gap-4 mt-3">' +
    '<div class="flex items-center gap-2"><span class="text-xs text-slate-400">\u30AD\u30E3\u30C3\u30B7\u30E5:</span><div class="flex gap-1">' +
      '<button data-prefix="' + prefix + '" data-opt="shared" class="px-3 py-1 text-xs rounded-md border ' + (p.isSharedCache ? 'bg-slate-800 text-white border-slate-800' : 'border-slate-200 text-slate-500') + '">\u5171\u6709</button>' +
      '<button data-prefix="' + prefix + '" data-opt="personal" class="px-3 py-1 text-xs rounded-md border ' + (!p.isSharedCache ? 'bg-slate-800 text-white border-slate-800' : 'border-slate-200 text-slate-500') + '">\u500B\u5225</button>' +
    '</div></div>' +
    '<div class="flex items-center gap-2"><span class="text-xs text-slate-400">Claude Write:</span><div class="flex gap-1">' +
      '<button data-prefix="' + prefix + '" data-wrt="5m" class="px-3 py-1 text-xs rounded-md border ' + (p.claudeWriteType === '5m' ? 'bg-slate-800 text-white border-slate-800' : 'border-slate-200 text-slate-500') + '">5\u5206</button>' +
      '<button data-prefix="' + prefix + '" data-wrt="1h" class="px-3 py-1 text-xs rounded-md border ' + (p.claudeWriteType === '1h' ? 'bg-slate-800 text-white border-slate-800' : 'border-slate-200 text-slate-500') + '">1\u6642\u9593</button>' +
    '</div></div>' +
    '<div class="flex items-center gap-2"><span class="text-xs text-slate-400">Claude\u66F8\u8FBC\u56DE\u6570/\u65E5:</span>' +
      '<input type="number" min="0" data-prefix="' + prefix + '" data-key="claudeWritesPerDay" value="' + (p.claudeWritesPerDay || 0) + '" class="w-16 border border-slate-200 rounded-md px-2 py-1 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/30" />' +
      '<span class="text-[11px] ' + (isAuto ? 'text-blue-500' : 'text-slate-400') + '">' +
        (isAuto ? '\u2192 \u81EA\u52D5: ' + autoWpd + '\u56DE/\u65E5' : '\u624B\u52D5\u8A2D\u5B9A (\u81EA\u52D5: ' + autoWpd + ')') +
        (autoWpd <= 1 ? ' <span class="text-green-600">\u203B TTL\u5185\u306B\u30EA\u30AF\u30A8\u30B9\u30C8\u304C\u3042\u308B\u305F\u3081\u30AD\u30E3\u30C3\u30B7\u30E5\u7DAD\u6301</span>' : '') +
      '</span>' +
    '</div>' +
  '</div>';
}

function modelHeaders(results) {
  return results.map(r => '<th class="px-4 py-2.5 font-semibold text-xs" style="color:' + r.color + '">' + r.name + '</th>').join('');
}

// ── Excel Download ─────────────────────────
function downloadExcel() {
  var p = state.activeTab === 'scenario' ? state.scenarios[state.activeScenario] : state.sim;
  var mKeys = Object.keys(pricingData);
  var mods = mKeys.map(function(k) { return pricingData[k]; });
  var cols = ['C','D','E','F','G','H','I','J'];
  var wb = XLSX.utils.book_new();
  var ws = {};
  function s(a,v) { ws[a] = {t:'s', v:String(v)}; }
  function n(a,v) { ws[a] = {t:'n', v:Number(v)}; }
  function fm(a,formula) { ws[a] = {t:'n', f:formula}; }

  // Row 1: Title
  s('A1', 'AI Cost Strategy Simulator');

  // Row 3-15: Parameters
  s('A3', '【パラメーター】');
  var paramList = [
    ['為替レート (¥/$)', state.exchangeRate],
    ['キャッシュ書込トークン (C)', p.cacheTokens],
    ['キャッシュ再利用トークン (R)', p.cacheReadTokens],
    ['新規プロンプトトークン (P)', p.promptTokens],
    ['回答トークン (O)', p.outputTokens],
    ['利用者数 (U)', p.userCount],
    ['回数/ユーザー (N)', p.reqPerUser],
    ['テスト日数 (D)', p.testDays],
    ['稼働時間/日 (h)', p.hoursPerDay],
    ['キャッシュ共有 (1=共有, 0=個別)', p.isSharedCache ? 1 : 0],
    ['Claude Write TTL (1=1h, 0=5m)', p.claudeWriteType === '1h' ? 1 : 0],
    ['キャッシュヒット率 (%)', p.cacheHitRate != null ? p.cacheHitRate : 100],
    ['Claude書込回数/日 (0=自動)', p.claudeWritesPerDay || 0],
    ['Claude書込回数/日 (実効値)', getClaudeWpd(p)],
  ];
  paramList.forEach(function(row, i) { s('A'+(4+i), row[0]); n('B'+(4+i), row[1]); });

  // Row 19-22: Derived values
  s('A19', '【導出値】');
  s('A20', '総リクエスト数'); fm('B20', 'B9*B10');
  s('A21', '総保管時間 (h)'); fm('B21', 'B12*B11');
  s('A22', 'スケール倍率');   fm('B22', 'IF(B13=1,1,B9)');

  // Row 24-30: Unit price table
  s('A24', '【単価表 ($/MTok)】');
  mods.forEach(function(m,i) { s(cols[i]+'24', m.name); });
  s('A25', '入力 (Input)');
  s('A26', '書込 (Write)');
  s('A27', '再利用 (Cached Read)');
  s('A28', '出力 (Output)');
  s('A29', '保管 (Storage/h)');
  s('A30', '書込回数/日');
  mods.forEach(function(m,i) {
    var c = cols[i], ic = mKeys[i].includes('claude'), io = mKeys[i].includes('gpt');
    n(c+'25', m.input);
    if (ic) { fm(c+'26', 'IF($B$14=1,'+m.cacheWrite1h+','+m.cacheWrite5m+')'); }
    else    { n(c+'26', m.input); }
    n(c+'27', m.cachedInput);
    n(c+'28', m.output);
    n(c+'29', m.storage);
    n(c+'30', getWpd(mKeys[i], p));
  });

  // Row 32-37: Cost breakdown (USD)
  s('A32', '【コスト内訳 (USD)】');
  mods.forEach(function(m,i) { s(cols[i]+'32', m.name); });
  s('A33', 'Write'); s('A34', 'Storage'); s('A35', 'Read'); s('A36', 'Prompt'); s('A37', 'Output');
  mods.forEach(function(m,i) {
    var c = cols[i];
    fm(c+'33', '($B$5/1000000)*'+c+'26*'+c+'30*$B$11*$B$22');
    fm(c+'34', '($B$5/1000000)*'+c+'29*$B$21*$B$22');
    fm(c+'35', '($B$6/1000000)*('+c+'27*$B$15/100+'+c+'25*(1-$B$15/100))*$B$20');
    fm(c+'36', '($B$7/1000000)*'+c+'25*$B$20');
    fm(c+'37', '($B$8/1000000)*'+c+'28*$B$20');
  });

  // Row 39-42: Totals
  s('A39', '【合計】');
  mods.forEach(function(m,i) { s(cols[i]+'39', m.name); });
  s('A40', 'USD 合計'); s('A41', 'JPY 合計'); s('A42', '1リクエスト単価 (JPY)');
  mods.forEach(function(m,i) {
    var c = cols[i];
    fm(c+'40', 'SUM('+c+'33:'+c+'37)');
    fm(c+'41', c+'40*$B$4');
    fm(c+'42', 'IF($B$20>0,'+c+'41/$B$20,0)');
  });

  // Row 44-49: Cache effect
  s('A44', '【キャッシュ効果】');
  mods.forEach(function(m,i) { s(cols[i]+'44', m.name); });
  s('A45', 'キャッシュなし合計 (USD)');
  s('A46', 'キャッシュあり合計 (USD)');
  s('A47', '削減額 (USD)'); s('A48', '削減額 (JPY)'); s('A49', '削減率');
  mods.forEach(function(m,i) {
    var c = cols[i];
    fm(c+'45', '(($B$6+$B$7)/1000000)*'+c+'25*$B$20+'+c+'37');
    fm(c+'46', c+'40');
    fm(c+'47', c+'45-'+c+'46');
    fm(c+'48', c+'47*$B$4');
    ws[c+'49'] = {t:'n', f:'IF('+c+'45>0,('+c+'45-'+c+'46)/'+c+'45,0)', z:'0.0%'};
  });

  // Remarks (column K)
  s('K3', '備考');
  s('K13', '1=全ユーザー共有, 0=ユーザー毎に個別');
  s('K14', '1=1時間TTL, 0=5分TTL');
  s('K16', '0=リクエスト頻度から自動計算, >0=手動指定');
  s('K17', 'TTL内にリクエストがあればキャッシュ維持(sliding window)');
  s('K22', '共有=1, 個別=ユーザー数');
  s('K26', 'Claude: TTLに応じて単価切替, OpenAI: Input同額');
  s('K29', 'Geminiのみ課金 (Claude/OpenAIは0)');
  s('K30', 'Claude: sliding window TTL, OpenAI: 自動~5m, Gemini: 永続=1回/日');
  s('K35', 'ヒット率で Cached/Input 価格を加重平均');
  s('K45', 'キャッシュ未使用: (R+P)を全てInput価格で計算');
  s('K49', '(なし - あり) / なし');

  // Sheet config
  ws['!ref'] = 'A1:K49';
  ws['!cols'] = [{wch:32},{wch:14},{wch:16},{wch:16},{wch:16},{wch:16},{wch:16},{wch:16},{wch:16},{wch:16},{wch:32}];
  var sheetName = state.activeTab === 'scenario' ? state.scenarios[state.activeScenario].name : 'シミュレーション';
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  // AgentCore Memory sheet
  var ms = {};
  function ms_s(a,v) { ms[a] = {t:'s', v:String(v)}; }
  function ms_n(a,v) { ms[a] = {t:'n', v:Number(v)}; }
  function ms_f(a,formula) { ms[a] = {t:'n', f:formula}; }
  var mm = state.mem;
  var isFirstOnly = mm.ltmRetrievalTiming === 'first';
  ms_s('A1', 'AgentCore Memory コストシミュレーション');

  // B4:B11 — Parameters
  ms_s('A3', '【パラメーター】');
  var memParams = [
    ['為替レート (¥/$)', state.exchangeRate],        // B4
    ['ユーザー数', mm.userCount],                     // B5
    ['セッション/ユーザー/月', mm.sessionsPerUser],   // B6
    ['リクエスト/セッション', mm.roundtripsPerSession],// B7
    ['LTM検索/リクエスト', mm.retrievalsPerSession],  // B8
    ['LTMレコード/ユーザー', mm.recordsPerUser],      // B9
    ['STMイベント/リクエスト', mm.stmEventsPerRequest || 2], // B10
    ['LTM検索タイミング (1=初回のみ)', isFirstOnly ? 1 : 0], // B11
  ];
  memParams.forEach(function(row, i) { ms_s('A'+(4+i), row[0]); ms_n('B'+(4+i), row[1]); });
  ms_s('A12', 'Strategy'); ms_s('B12', mm.useOverrideStrategy ? 'Override' : 'Default');
  // Extraction parameters — model name triggers VLOOKUP from LLM単価 sheet
  var exModel = mm.extractionModel && pricingData[mm.extractionModel] ? pricingData[mm.extractionModel] : null;
  ms_s('A13', '抽出モデル ▼');              ms_s('B13', exModel ? exModel.name : 'なし');      // B13 — change this to switch model
  ms_s('A14', '抽出入力トークン');          ms_n('B14', mm.extractionInputTokens || 0);        // B14
  ms_s('A15', '抽出出力トークン');          ms_n('B15', mm.extractionOutputTokens || 0);       // B15
  ms_s('A16', '抽出入力単価 ($/MTok)');     ms_f('B16', "IFERROR(VLOOKUP(B13,'LLM単価'!A:B,2,FALSE),0)"); // B16 — auto from LLM単価
  ms_s('A17', '抽出出力単価 ($/MTok)');     ms_f('B17', "IFERROR(VLOOKUP(B13,'LLM単価'!A:C,3,FALSE),0)"); // B17 — auto from LLM単価

  // B19:B22 — Unit prices (per 1000)
  ms_s('A19', '【単価 ($/1000)】');
  ms_s('A20', 'STM イベント');              ms_n('B20', 0.25);  // B20
  ms_s('A21', 'LTM ストレージ Default');    ms_n('B21', 0.75);  // B21
  ms_s('A22', 'LTM ストレージ Override');   ms_n('B22', 0.25);  // B22
  ms_s('A23', 'LTM 検索');                  ms_n('B23', 0.50);  // B23

  // B25:B30 — Volumes (formulas)
  ms_s('A25', '【ボリューム】');
  ms_s('A26', '総セッション');      ms_f('B26', 'B5*B6');                                // userCount * sessionsPerUser
  ms_s('A27', '総リクエスト');      ms_f('B27', 'B26*B7');                                // totalSessions * roundtripsPerSession
  ms_s('A28', 'STM イベント数');    ms_f('B28', 'B27*B10');                                // totalRoundtrips * stmEventsPerRequest
  ms_s('A29', 'LTM 検索数');       ms_f('B29', 'IF(B11=1,B26*B8,B27*B8)');              // first: sessions*ret, every: roundtrips*ret
  ms_s('A30', 'LTM レコード数');    ms_f('B30', 'B5*B9');                                // userCount * recordsPerUser

  // B32:C41 — Cost breakdown (formulas)
  ms_s('A32', '【コスト内訳 (月額)】');
  ms_s('A33', ''); ms_s('B33', 'USD'); ms_s('C33', 'JPY');
  ms_s('A34', 'STM イベント');      ms_f('B34', 'B28*B20/1000');          ms_f('C34', 'B34*B4');
  ms_s('A35', 'LTM ストレージ');    ms_f('B35', 'IF(B12="Override",B30*B22/1000,B30*B21/1000)'); ms_f('C35', 'B35*B4');
  ms_s('A36', 'LTM 検索');         ms_f('B36', 'B29*B23/1000');          ms_f('C36', 'B36*B4');

  // LLM extraction cost — formula: (inputTok/1M * inputPrice + outputTok/1M * outputPrice) * totalRoundtrips
  // Only applies when Override strategy is selected
  ms_s('A37', 'LLM 抽出');
  ms_f('B37', 'IF(B12="Override",(B14/1000000*B16+B15/1000000*B17)*B27,0)');
  ms_f('C37', 'B37*B4');

  ms_s('A38', '合計');             ms_f('B38', 'B34+B35+B36+B37');       ms_f('C38', 'B38*B4');
  ms_s('A39', '1リクエスト単価');   ms_f('B39', 'IF(B27>0,B38/B27,0)');   ms_f('C39', 'B39*B4');
  ms_s('A40', 'セッション単価');    ms_f('B40', 'IF(B26>0,B38/B26,0)');   ms_f('C40', 'B40*B4');
  ms_s('A41', 'ユーザー月額');      ms_f('B41', 'IF(B5>0,B38/B5,0)');     ms_f('C41', 'B41*B4');
  ms_s('A42', 'ユーザー年額');      ms_f('B42', 'B41*12');                ms_f('C42', 'B42*B4');

  // B44:D50 — Override comparison (formulas)
  ms_s('A44', '【Override比較】');
  ms_s('A45', ''); ms_s('B45', 'Default'); ms_s('C45', 'Override'); ms_s('D45', '差額');
  ms_s('A46', 'LTM ストレージ (USD)');
  ms_f('B46', 'B30*B21/1000');                        // Default storage cost
  ms_f('C46', 'B30*B22/1000');                        // Override storage cost
  ms_f('D46', 'B46-C46');                             // Savings (positive = cheaper)
  ms_s('A47', 'LLM 抽出 (USD)');
  ms_n('B47', 0);                                     // Default: no extraction cost
  ms_f('C47', '(B14/1000000*B16+B15/1000000*B17)*B27'); // Override: extraction cost
  ms_f('D47', 'B47-C47');                             // Increase (negative = more expensive)
  ms_s('A48', '合計 (USD)');
  ms_f('B48', 'B34+B46+B36');                         // Default total (no extraction)
  ms_f('C48', 'B34+C46+B36+C47');                     // Override total (with extraction)
  ms_f('D48', 'B48-C48');                             // Net difference
  ms_s('A49', '差額率');
  ms['D49'] = {t:'n', f:'IF(B48>0,(B48-C48)/B48,0)', z:'0.0%'};

  ms['!ref'] = 'A1:D49';
  ms['!cols'] = [{wch:32},{wch:16},{wch:16},{wch:16}];
  XLSX.utils.book_append_sheet(wb, ms, 'AgentCore Memory');

  // LLM単価 sheet — model pricing table for VLOOKUP
  var ls = {};
  function ls_s(a,v) { ls[a] = {t:'s', v:String(v)}; }
  function ls_n(a,v) { ls[a] = {t:'n', v:Number(v)}; }
  ls_s('A1', 'モデル名'); ls_s('B1', '入力 ($/MTok)'); ls_s('C1', '出力 ($/MTok)'); ls_s('D1', 'プラットフォーム');
  var mKeys = Object.keys(pricingData);
  mKeys.forEach(function(k, i) {
    var m = pricingData[k];
    var row = i + 2;
    ls_s('A'+row, m.name);
    ls_n('B'+row, m.input);
    ls_n('C'+row, m.output);
    ls_s('D'+row, m.platform || '');
  });
  ls['!ref'] = 'A1:D' + (mKeys.length + 1);
  ls['!cols'] = [{wch:24},{wch:16},{wch:16},{wch:16}];
  XLSX.utils.book_append_sheet(wb, ls, 'LLM単価');

  XLSX.writeFile(wb, 'cost_simulation.xlsx');
}

// \u2500\u2500 Render \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
function tabCls(tabName) {
  return state.activeTab === tabName
    ? 'bg-white text-slate-900 font-semibold border-slate-200'
    : 'bg-slate-50 text-slate-400 border-transparent hover:text-slate-600';
}

function render() {
  const app = document.getElementById('app');

  // \u2500\u2500 Tab bar + header \u2500\u2500
  let html = '<header class="mb-8 border-b border-slate-200 pb-6">' +
    '<div class="flex items-baseline justify-between mb-4">' +
      '<div class="flex items-center gap-3">' +
        '<h1 class="text-2xl font-semibold tracking-tight text-slate-900">AI \u30B3\u30B9\u30C8\u30B7\u30DF\u30E5\u30EC\u30FC\u30BF\u30FC</h1>' +
        '<a href="https://github.com/KiyotakaMatsushita/ai-cost-simulator" target="_blank" rel="noopener noreferrer" class="text-slate-400 hover:text-slate-600 transition-colors" title="GitHub">' +
          '<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>' +
        '</a>' +
      '</div>' +
      '<div class="flex items-center gap-2"><span class="text-xs text-slate-400">\u70BA\u66FF:</span><span class="text-sm text-slate-500">&yen;</span>' +
        '<input type="number" data-key="exchangeRate" value="' + state.exchangeRate + '" class="w-20 border border-slate-200 rounded-lg px-2 py-1 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/30" />' +
      '</div>' +
    '</div>' +
    '<nav class="flex gap-1">' +
      '<button data-tab="simulator" class="px-4 py-2 text-sm rounded-t-lg border border-b-0 ' + tabCls('simulator') + '">\u57FA\u672C\u30B7\u30DF\u30E5\u30EC\u30FC\u30BF\u30FC</button>' +
      '<button data-tab="scenario" class="px-4 py-2 text-sm rounded-t-lg border border-b-0 ' + tabCls('scenario') + '">\u30B7\u30CA\u30EA\u30AA\u6BD4\u8F03\uFF08\u7D2F\u7A4D\u30B3\u30B9\u30C8\uFF09</button>' +
      '<button data-tab="memory" class="px-4 py-2 text-sm rounded-t-lg border border-b-0 ' + tabCls('memory') + '">AgentCore Memory</button>' +
    '</nav>' +
  '</header>';

  if (state.activeTab === 'simulator') {
    // \u2500\u2500 Simulator Tab \u2500\u2500
    const p = state.sim;
    const { results, totalReqs, totalHours } = computeResults(p);

    html += '<section class="mb-8">' +
      '<div class="flex items-center justify-between mb-4"><h2 class="text-xs font-semibold text-slate-400 uppercase tracking-wider">\u30D1\u30E9\u30E1\u30FC\u30BF\u8A2D\u5B9A</h2>' +
      '<button onclick="downloadExcel()" class="px-3 py-1.5 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors">Excel \u30C0\u30A6\u30F3\u30ED\u30FC\u30C9</button></div>' +
      paramGrid('sim', p, totalHours) + optionBtns('sim', p) +
    '</section>';

    // Unit price table
    html += '<section class="mb-8"><h2 class="text-sm font-semibold text-slate-700 mb-3">\u5358\u4FA1\u8868 ($/MTok)</h2>' +
      '<div class="overflow-x-auto border border-slate-200 rounded-lg"><table class="w-full text-sm"><thead><tr class="bg-slate-50 text-left"><th class="px-4 py-2.5 text-xs text-slate-500"></th>' + modelHeaders(results) + '</tr></thead>' +
      '<tbody class="font-mono text-xs">' +
        '<tr class="border-t border-slate-100"><td class="px-4 py-2 text-slate-500 font-sans">\u5165\u529B</td>' + results.map(r => '<td class="px-4 py-2">' + r.input.toFixed(2) + '</td>').join('') + '</tr>' +
        '<tr class="border-t border-slate-100"><td class="px-4 py-2 text-slate-500 font-sans">\u66F8\u8FBC (Write)</td>' + results.map(r => '<td class="px-4 py-2 ' + (r.isClaude ? 'text-amber-600 font-semibold' : '') + '">' + r.writePrice.toFixed(2) + (r.isClaude ? ' *' : '') + '</td>').join('') + '</tr>' +
        '<tr class="border-t border-slate-100"><td class="px-4 py-2 text-slate-500 font-sans">\u518D\u5229\u7528 (Read)</td>' + results.map(r => '<td class="px-4 py-2 text-blue-600">' + r.cachedInput.toFixed(2) + '</td>').join('') + '</tr>' +
        '<tr class="border-t border-slate-100"><td class="px-4 py-2 text-slate-500 font-sans">\u51FA\u529B</td>' + results.map(r => '<td class="px-4 py-2">' + r.output.toFixed(2) + '</td>').join('') + '</tr>' +
        '<tr class="border-t border-slate-100"><td class="px-4 py-2 text-slate-500 font-sans">\u4FDD\u7BA1 (/h)</td>' + results.map(r => '<td class="px-4 py-2 ' + (r.storage > 0 ? 'text-orange-600' : 'text-slate-400') + '">' + (r.storage > 0 ? r.storage.toFixed(2) : '\u2014') + '</td>').join('') + '</tr>' +
      '</tbody></table></div>' +
      '<p class="mt-2 text-[11px] text-slate-400">* Claude Write\u306F\u4E0A\u4E57\u305B (5m:1.25x, 1h:2.0x)\u3002Gemini/OpenAI Write = Input\u3068\u540C\u984D\u3002Read = Input\u306E10%\u3002' +
        '<a href="https://cloud.google.com/vertex-ai/generative-ai/pricing" target="_blank" class="text-blue-500 hover:underline ml-1">Vertex AI \u2197</a>' +
        '<a href="https://www.anthropic.com/pricing" target="_blank" class="text-blue-500 hover:underline ml-1">Anthropic \u2197</a>' +
        '<a href="https://openai.com/api/pricing/" target="_blank" class="text-blue-500 hover:underline ml-1">OpenAI \u2197</a></p></section>';

    // Cost breakdown
    html += '<section class="mb-8"><div class="flex items-baseline gap-4 mb-3"><h2 class="text-sm font-semibold text-slate-700">\u30B3\u30B9\u30C8\u5185\u8A33 (\u00A5)</h2><span class="text-xs text-slate-400">\u7DCF\u30EA\u30AF\u30A8\u30B9\u30C8: ' + totalReqs.toLocaleString() + ' / ' + (p.isSharedCache ? '\u5171\u6709' : '\u500B\u5225') + '</span></div>' +
      '<div class="overflow-x-auto border border-slate-200 rounded-lg"><table class="w-full text-sm"><thead><tr class="bg-slate-50 text-left"><th class="px-4 py-2.5 text-xs text-slate-500">\u8CBB\u76EE</th>' + modelHeaders(results) + '</tr></thead>' +
      '<tbody class="font-mono text-xs">' +
        ['Write', 'Read', 'Prompt', 'Output', 'Storage'].map((label, i) => {
          const keys = ['write', 'read', 'prompt', 'outputCost', 'storageCost'];
          const k = keys[i];
          let row = '<tr class="border-t border-slate-100"><td class="px-4 py-2 text-slate-500 font-sans">' + (i+1) + '. ' + label + '</td>' +
            results.map(r => {
              if (k === 'storageCost' && r.storageCost === 0) return '<td class="px-4 py-2 text-slate-400">\u2014</td>';
              return '<td class="px-4 py-2 ' + (k === 'storageCost' && r.storageCost > 0 ? 'text-orange-600' : '') + '">&yen;' + fJ(r[k]) + '</td>';
            }).join('') + '</tr>';
          if (k === 'write') {
            row += '<tr class="border-t border-slate-50 bg-slate-50/50"><td class="px-4 py-1 text-[11px] text-slate-400 font-sans pl-8">\u2514 \u66F8\u8FBC\u56DE\u6570/\u65E5 (TTL)</td>' +
              results.map(r => '<td class="px-4 py-1 text-[11px] text-slate-400">' + r.writesPerDay + '\u56DE/\u65E5' + (r.isClaude ? ' (' + (p.claudeWriteType === '1h' ? '1h TTL' : '5m TTL') + ')' : r.isOpenAI ? ' (\u81EA\u52D5~5m)' : ' (\u6301\u7D9A)') + '</td>').join('') + '</tr>';
          }
          return row;
        }).join('') +
        '<tr class="border-t-2 border-slate-300 bg-slate-50 font-semibold"><td class="px-4 py-3 font-sans font-semibold text-slate-700">\u5408\u8A08</td>' +
          results.map(r => '<td class="px-4 py-3 text-slate-900">&yen;' + fJ(r.total) + ' <span class="text-slate-400 font-normal text-[10px]">($' + fU(r.total) + ')</span></td>').join('') + '</tr>' +
        '<tr class="border-t border-slate-200"><td class="px-4 py-2 font-sans text-slate-500">1\u30EA\u30AF\u30A8\u30B9\u30C8\u5358\u4FA1</td>' +
          results.map(r => '<td class="px-4 py-2 font-semibold">&yen;' + fJ2(r.perReq) + '</td>').join('') + '</tr>' +
      '</tbody></table></div></section>';

    // Cache effect
    html += '<section class="mb-8"><div class="flex items-baseline gap-3 mb-3"><h2 class="text-sm font-semibold text-slate-700">\u30AD\u30E3\u30C3\u30B7\u30E5\u52B9\u679C</h2><span class="text-xs text-slate-400">\u30D2\u30C3\u30C8\u7387 ' + p.cacheHitRate + '%</span></div>' +
      '<div class="overflow-x-auto border border-slate-200 rounded-lg"><table class="w-full text-sm"><thead><tr class="bg-slate-50 text-left"><th class="px-4 py-2.5 text-xs text-slate-500"></th>' + modelHeaders(results) + '</tr></thead>' +
      '<tbody class="font-mono text-xs">' +
        '<tr class="border-t border-slate-100"><td class="px-4 py-2 text-slate-500 font-sans">\u30AD\u30E3\u30C3\u30B7\u30E5\u306A\u3057</td>' + results.map(r => '<td class="px-4 py-2">&yen;' + fJ(r.noCache) + '</td>').join('') + '</tr>' +
        '<tr class="border-t border-slate-100"><td class="px-4 py-2 text-slate-500 font-sans">\u30AD\u30E3\u30C3\u30B7\u30E5\u3042\u308A</td>' + results.map(r => '<td class="px-4 py-2">&yen;' + fJ(r.total) + '</td>').join('') + '</tr>' +
        '<tr class="border-t border-slate-200 bg-green-50/50"><td class="px-4 py-2.5 font-sans font-semibold text-green-700">\u524A\u6E1B\u7387</td>' +
          results.map(r => '<td class="px-4 py-2.5 font-semibold text-green-700">-' + r.savPct + '% <span class="font-normal text-green-600">(&yen;' + fJ(r.savUSD) + ')</span></td>').join('') + '</tr>' +
      '</tbody></table></div></section>';

  } else if (state.activeTab === 'scenario') {
    // \u2500\u2500 Scenario Tab \u2500\u2500
    const sc = state.scenarios[state.activeScenario];

    // Scenario selector
    html += '<section class="mb-6"><div class="flex items-center gap-3 mb-4">' +
      '<h2 class="text-sm font-semibold text-slate-700">\u30B7\u30CA\u30EA\u30AA\u9078\u629E</h2>' +
      '<div class="flex gap-1">' +
        state.scenarios.map((s, i) =>
          '<button data-scenario="' + i + '" class="px-4 py-2 text-xs rounded-lg border transition-colors ' +
          (i === state.activeScenario ? 'bg-slate-800 text-white border-slate-800 font-semibold' : 'border-slate-200 text-slate-500 hover:border-slate-400') +
          '">' + s.name + '</button>'
        ).join('') +
      '</div></div>' +
      paramGrid('sc', sc, sc.hoursPerDay * sc.testDays) + optionBtns('sc', sc) +
    '</section>';

    // Time series chart
    const series = computeTimeSeries(sc);
    html += '<section class="mb-8"><h2 class="text-sm font-semibold text-slate-700 mb-3">\u7D2F\u7A4D\u30B3\u30B9\u30C8\u63A8\u79FB (\u00A5)</h2>' +
      buildChart(series, sc.testDays, state.exchangeRate) +
    '</section>';

    // Daily cost summary
    const { results: scResults, totalReqs: scTotalReqs } = computeResults(sc);
    html += '<section class="mb-8"><div class="flex items-baseline gap-4 mb-3"><h2 class="text-sm font-semibold text-slate-700">\u30B7\u30CA\u30EA\u30AA\u7D50\u679C\u4E00\u89A7</h2><span class="text-xs text-slate-400">' + sc.testDays + '\u65E5\u9593 / ' + scTotalReqs.toLocaleString() + ' reqs / ' + (sc.isSharedCache ? '\u5171\u6709' : '\u500B\u5225') + '</span><button onclick="downloadExcel()" class="ml-auto px-3 py-1.5 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors">Excel \u30C0\u30A6\u30F3\u30ED\u30FC\u30C9</button></div>' +
      '<div class="overflow-x-auto border border-slate-200 rounded-lg"><table class="w-full text-sm"><thead><tr class="bg-slate-50 text-left"><th class="px-4 py-2.5 text-xs text-slate-500"></th>' + modelHeaders(scResults) + '</tr></thead>' +
      '<tbody class="font-mono text-xs">' +
        '<tr class="border-t border-slate-100"><td class="px-4 py-2 text-slate-500 font-sans">1\u65E5\u3042\u305F\u308A\u30B3\u30B9\u30C8</td>' + series.map(s => '<td class="px-4 py-2">&yen;' + fJ(s.daily) + '</td>').join('') + '</tr>' +
        '<tr class="border-t border-slate-100 bg-slate-50 font-semibold"><td class="px-4 py-2 font-sans text-slate-700">' + sc.testDays + '\u65E5\u9593\u5408\u8A08</td>' + scResults.map(r => '<td class="px-4 py-2 text-slate-900">&yen;' + fJ(r.total) + '</td>').join('') + '</tr>' +
        '<tr class="border-t border-slate-100"><td class="px-4 py-2 text-slate-500 font-sans">1\u30EA\u30AF\u30A8\u30B9\u30C8\u5358\u4FA1</td>' + scResults.map(r => '<td class="px-4 py-2">&yen;' + fJ2(r.perReq) + '</td>').join('') + '</tr>' +
        '<tr class="border-t border-slate-200 bg-green-50/50"><td class="px-4 py-2 font-sans font-semibold text-green-700">\u30AD\u30E3\u30C3\u30B7\u30E5\u524A\u6E1B\u7387</td>' +
          scResults.map(r => '<td class="px-4 py-2 font-semibold text-green-700">-' + r.savPct + '%</td>').join('') + '</tr>' +
      '</tbody></table></div></section>';

    // Day-by-day table
    html += '<section class="mb-8"><h2 class="text-sm font-semibold text-slate-700 mb-3">\u65E5\u5225\u7D2F\u7A4D\u30B3\u30B9\u30C8 (\u00A5)</h2>' +
      '<div class="overflow-x-auto border border-slate-200 rounded-lg max-h-[400px] overflow-y-auto"><table class="w-full text-sm"><thead class="sticky top-0 z-10"><tr class="bg-slate-50 text-left"><th class="px-4 py-2.5 text-xs text-slate-500">\u65E5\u6570</th>' + modelHeaders(scResults) + '</tr></thead>' +
      '<tbody class="font-mono text-xs">';
    const step = sc.testDays <= 14 ? 1 : sc.testDays <= 60 ? 2 : 5;
    for (let d = step; d <= sc.testDays; d += step) {
      html += '<tr class="border-t border-slate-100' + (d === sc.testDays ? ' bg-slate-50 font-semibold' : '') + '"><td class="px-4 py-1.5 text-slate-500 font-sans">' + d + '\u65E5\u76EE</td>' +
        series.map(s => '<td class="px-4 py-1.5">&yen;' + fJ(s.daily * d) + '</td>').join('') + '</tr>';
    }
    html += '</tbody></table></div></section>';

  } else if (state.activeTab === 'memory') {
    // \u2500\u2500 Memory Tab \u2500\u2500
    const m = state.mem;
    const mr = computeMemoryResults(m);
    const rate = state.exchangeRate;

    // Hierarchy explainer
    html += '<section class="mb-6">' +
      '<div class="border border-slate-200 rounded-lg p-4 bg-slate-50/50">' +
        '<p class="text-xs font-semibold text-slate-500 mb-2">\u7528\u8A9E\u306E\u95A2\u4FC2</p>' +
        '<div class="font-mono text-xs text-slate-600 leading-relaxed">' +
          '<span class="text-slate-800 font-semibold">\u30E6\u30FC\u30B6\u30FC</span> <span class="text-slate-400">\u2500\u2500</span> \u6708\u9593\u30A2\u30AF\u30C6\u30A3\u30D6\u30E6\u30FC\u30B6\u30FC\u6570<br>' +
          '<span class="text-slate-400">\u2514\u2500</span> <span class="text-slate-800 font-semibold">\u30BB\u30C3\u30B7\u30E7\u30F3</span> <span class="text-slate-400">\u2500\u2500</span> 1\u56DE\u306E\u4F1A\u8A71 (= session_id)\u3002<span class="text-blue-600">LTM\u30B9\u30C8\u30EC\u30FC\u30B8</span>\u306F\u30E6\u30FC\u30B6\u30FC\u5358\u4F4D\u3067\u8AB2\u91D1<br>' +
          '<span class="text-slate-400">&nbsp;&nbsp;&nbsp;\u2514\u2500</span> <span class="text-slate-800 font-semibold">\u30EA\u30AF\u30A8\u30B9\u30C8</span> <span class="text-slate-400">\u2500\u2500</span> \u30E6\u30FC\u30B6\u30FC\u767A\u8A00\u2192AI\u5FDC\u7B54\u306E1\u5F80\u5FA9\u3002<span class="text-blue-600">STM\u30A4\u30D9\u30F3\u30C8</span>\u00D7' + mr.eventsPerRT + ' + <span class="text-blue-600">LTM\u691C\u7D22</span>\u00D7' + m.retrievalsPerSession + (m.ltmRetrievalTiming === 'first' ? ' <span class="text-green-600">(\u521D\u56DE\u306E\u307F)</span>' : '') + ' \u304C\u767A\u751F' +
        '</div>' +
      '</div></section>';

    // Parameters
    html += '<section class="mb-8">' +
      '<div class="flex items-center justify-between mb-4"><h2 class="text-xs font-semibold text-slate-400 uppercase tracking-wider">\u30D1\u30E9\u30E1\u30FC\u30BF\u8A2D\u5B9A</h2>' +
      '<button onclick="downloadExcel()" class="px-3 py-1.5 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors">Excel \u30C0\u30A6\u30F3\u30ED\u30FC\u30C9</button></div>' +
      memoryParamGrid(m) +
      '<div class="flex items-center gap-3 mt-3">' +
        '<span class="text-xs text-slate-400">LTM Strategy: <span class="tip"><svg class="inline w-3.5 h-3.5 -mt-0.5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke-width="1.5"/><path stroke-width="1.5" d="M9.5 9.5a2.5 2.5 0 0 1 4.99.5c0 1.5-2.49 2-2.49 3M12 17h.01"/></svg><span class="tip-text" style="white-space:normal;width:320px;">Default: AWS\u304C\u62BD\u51FA\u30FB\u7D71\u5408\u3092\u5168\u81EA\u52D5\u3067\u5B9F\u884C ($0.75/1K\u30EC\u30B3\u30FC\u30C9/\u6708\u3001LLM\u62BD\u51FA\u30B3\u30B9\u30C8\u306A\u3057)<br>Override: \u62BD\u51FA\u30D7\u30ED\u30F3\u30D7\u30C8\u3092\u30AB\u30B9\u30BF\u30E0 ($0.25/1K\u30EC\u30B3\u30FC\u30C9/\u6708 + LLM\u62BD\u51FA\u30B3\u30B9\u30C8)</span></span></span>' +
        '<button data-mem-strategy="default" class="px-3 py-1 text-xs rounded-md border ' + (!m.useOverrideStrategy ? 'bg-slate-800 text-white border-slate-800' : 'border-slate-200 text-slate-500') + '">Default</button>' +
        '<button data-mem-strategy="override" class="px-3 py-1 text-xs rounded-md border ' + (m.useOverrideStrategy ? 'bg-slate-800 text-white border-slate-800' : 'border-slate-200 text-slate-500') + '">Override</button>' +
      '</div>' +
      '<div class="flex flex-wrap items-center gap-x-6 gap-y-2 mt-3">' +
        '<div class="flex items-center gap-2">' +
          '<span class="text-xs text-slate-400">LTM\u691C\u7D22\u30BF\u30A4\u30DF\u30F3\u30B0: <span class="tip"><svg class="inline w-3.5 h-3.5 -mt-0.5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke-width="1.5"/><path stroke-width="1.5" d="M9.5 9.5a2.5 2.5 0 0 1 4.99.5c0 1.5-2.49 2-2.49 3M12 17h.01"/></svg><span class="tip-text" style="white-space:normal;width:280px;">\u6BCE\u30EA\u30AF\u30A8\u30B9\u30C8: \u5168\u30EA\u30AF\u30A8\u30B9\u30C8\u3067LTM\u691C\u7D22\u3092\u5B9F\u884C\u3002\u6700\u65B0\u306E\u8A18\u61B6\u3092\u5E38\u306B\u53C2\u7167\u3067\u304D\u308B<br>\u521D\u56DE\u306E\u307F: \u30BB\u30C3\u30B7\u30E7\u30F3\u6700\u521D\u306E\u30EA\u30AF\u30A8\u30B9\u30C8\u306E\u307FLTM\u691C\u7D22\u3002\u691C\u7D22\u30B3\u30B9\u30C8\u3092\u524A\u6E1B\u3067\u304D\u308B\u304C\u3001\u4F1A\u8A71\u4E2D\u306E\u30B3\u30F3\u30C6\u30AD\u30B9\u30C8\u66F4\u65B0\u304C\u306A\u3044</span></span></span>' +
          '<button data-mem-retrieval="every" class="px-3 py-1 text-xs rounded-md border ' + (m.ltmRetrievalTiming === 'every' ? 'bg-slate-800 text-white border-slate-800' : 'border-slate-200 text-slate-500') + '">\u6BCE\u30EA\u30AF\u30A8\u30B9\u30C8</button>' +
          '<button data-mem-retrieval="first" class="px-3 py-1 text-xs rounded-md border ' + (m.ltmRetrievalTiming === 'first' ? 'bg-slate-800 text-white border-slate-800' : 'border-slate-200 text-slate-500') + '">\u521D\u56DE\u306E\u307F</button>' +
        '</div>' +
        '<div class="flex items-center gap-2">' +
          '<span class="text-xs text-slate-400">LLM\u62BD\u51FA\u30B3\u30B9\u30C8: <span class="tip"><svg class="inline w-3.5 h-3.5 -mt-0.5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke-width="1.5"/><path stroke-width="1.5" d="M9.5 9.5a2.5 2.5 0 0 1 4.99.5c0 1.5-2.49 2-2.49 3M12 17h.01"/></svg><span class="tip-text" style="white-space:normal;width:320px;">Override Strategy \u3067\u306F appendToPrompt + modelId \u3067\u30AB\u30B9\u30BF\u30E0\u62BD\u51FA\u3092\u884C\u3046\u305F\u3081\u3001LLM \u63A8\u8AD6\u30B3\u30B9\u30C8\u304C Bedrock \u6599\u91D1\u3068\u3057\u3066\u5225\u9014\u767A\u751F\u3002Default \u3067\u306F AWS \u304C\u81EA\u52D5\u51E6\u7406\u3059\u308B\u305F\u3081\u4E0D\u8981</span></span></span>' +
          '<span class="px-3 py-1 text-xs rounded-md ' + (m.extractionEnabled ? 'bg-amber-100 text-amber-700 border border-amber-200' : 'bg-slate-100 text-slate-400 border border-slate-200') + '">' + (m.extractionEnabled ? 'ON (Override\u9023\u52D5)' : 'OFF (Default)') + '</span>' +
        '</div>' +
      '</div>' +
      extractionParamSection(m) +
    '</section>';

    // Unit price table
    html += '<section class="mb-8"><h2 class="text-sm font-semibold text-slate-700 mb-3">AgentCore Memory \u5358\u4FA1</h2>' +
      '<div class="overflow-x-auto border border-slate-200 rounded-lg"><table class="w-full text-sm">' +
      '<thead><tr class="bg-slate-50"><th class="px-4 py-2.5 text-xs text-slate-500 text-left">\u30B5\u30FC\u30D3\u30B9</th><th class="px-4 py-2.5 text-xs text-slate-500 text-right">\u5358\u4FA1 (USD)</th><th class="px-4 py-2.5 text-xs text-slate-500 text-right">\u5358\u4FA1 (JPY)</th><th class="px-4 py-2.5 text-xs text-slate-500 text-left">\u5358\u4F4D</th></tr></thead>' +
      '<tbody class="font-mono text-xs">' +
        '<tr class="border-t border-slate-100"><td class="px-4 py-2 text-slate-600 font-sans">STM \u30A4\u30D9\u30F3\u30C8</td><td class="px-4 py-2 text-right">$0.25</td><td class="px-4 py-2 text-right">&yen;' + (0.25 * rate).toFixed(1) + '</td><td class="px-4 py-2 text-slate-400 font-sans">/1,000 events</td></tr>' +
        '<tr class="border-t border-slate-100"><td class="px-4 py-2 text-slate-600 font-sans"><span class="tip">LTM \u30B9\u30C8\u30EC\u30FC\u30B8 (Default)<span class="tip-text" style="white-space:normal;width:260px;">AWS\u304C\u62BD\u51FA\u30FB\u7D71\u5408\u3092\u5168\u81EA\u52D5\u3067\u5B9F\u884C\u3002\u8A2D\u5B9A\u4E0D\u8981\u3067\u7C21\u5358\u3060\u304C\u5358\u4FA1\u304C\u9AD8\u3044</span></span></td><td class="px-4 py-2 text-right">$0.75</td><td class="px-4 py-2 text-right">&yen;' + (0.75 * rate).toFixed(1) + '</td><td class="px-4 py-2 text-slate-400 font-sans">/1,000 records/\u6708</td></tr>' +
        '<tr class="border-t border-slate-100"><td class="px-4 py-2 text-slate-600 font-sans"><span class="tip">LTM \u30B9\u30C8\u30EC\u30FC\u30B8 (Override)<span class="tip-text" style="white-space:normal;width:260px;">\u62BD\u51FA\u30D7\u30ED\u30F3\u30D7\u30C8\u3092\u30AB\u30B9\u30BF\u30E0\u3057\u3066\u7CBE\u5EA6\u5411\u4E0A\u3002\u5358\u4FA167%\u524A\u6E1B\u3060\u304C\u8A2D\u5B9A\u306B\u624B\u9593\u304C\u304B\u304B\u308B</span></span></td><td class="px-4 py-2 text-right">$0.25</td><td class="px-4 py-2 text-right">&yen;' + (0.25 * rate).toFixed(1) + '</td><td class="px-4 py-2 text-slate-400 font-sans">/1,000 records/\u6708</td></tr>' +
        '<tr class="border-t border-slate-100"><td class="px-4 py-2 text-slate-600 font-sans">LTM \u691C\u7D22</td><td class="px-4 py-2 text-right">$0.50</td><td class="px-4 py-2 text-right">&yen;' + (0.50 * rate).toFixed(1) + '</td><td class="px-4 py-2 text-slate-400 font-sans">/1,000 requests</td></tr>' +
      '</tbody></table></div>' +
      '<p class="mt-2 text-[11px] text-slate-400"><a href="https://aws.amazon.com/bedrock/agentcore/pricing/" target="_blank" class="text-blue-500 hover:underline">AWS AgentCore Pricing \u2197</a></p></section>';

    // Volume cards
    html += '<section class="mb-8"><h2 class="text-sm font-semibold text-slate-700 mb-3">\u6708\u9593\u30DC\u30EA\u30E5\u30FC\u30E0</h2>' +
      '<div class="grid grid-cols-2 lg:grid-cols-5 gap-3">' +
        [
          ['\u7DCF\u30EA\u30AF\u30A8\u30B9\u30C8', mr.totalRoundtrips.toLocaleString(), m.userCount.toLocaleString() + ' \u00D7 ' + m.sessionsPerUser + ' \u00D7 ' + m.roundtripsPerSession],
          ['\u7DCF\u30BB\u30C3\u30B7\u30E7\u30F3', mr.totalSessions.toLocaleString(), m.userCount.toLocaleString() + ' \u00D7 ' + m.sessionsPerUser],
          ['STM \u30A4\u30D9\u30F3\u30C8', mr.totalEvents.toLocaleString(), mr.totalRoundtrips.toLocaleString() + ' \u00D7 ' + mr.eventsPerRT],
          ['LTM \u691C\u7D22', mr.totalRetrievals.toLocaleString(), (m.ltmRetrievalTiming === 'first' ? mr.totalSessions.toLocaleString() : mr.totalRoundtrips.toLocaleString()) + ' \u00D7 ' + m.retrievalsPerSession + (m.ltmRetrievalTiming === 'first' ? ' (\u521D\u56DE\u306E\u307F)' : '')],
          ['LTM \u30EC\u30B3\u30FC\u30C9', mr.totalRecords.toLocaleString(), m.userCount.toLocaleString() + ' \u00D7 ' + m.recordsPerUser],
        ].map(([label, val, formula]) =>
          '<div class="border border-slate-200 rounded-lg p-3 text-center">' +
            '<p class="text-[11px] text-slate-400">' + label + '</p>' +
            '<p class="text-lg font-semibold text-slate-800 font-mono">' + val + '</p>' +
            '<p class="text-[10px] text-slate-400 mt-1 font-mono">' + formula + '</p></div>'
        ).join('') +
      '</div></section>';

    // Cost breakdown
    html += '<section class="mb-8"><h2 class="text-sm font-semibold text-slate-700 mb-3">\u30B3\u30B9\u30C8\u5185\u8A33 (\u6708\u984D)</h2>' +
      '<div class="overflow-x-auto border border-slate-200 rounded-lg"><table class="w-full text-sm">' +
      '<thead><tr class="bg-slate-50"><th class="px-4 py-2.5 text-xs text-slate-500 text-left">\u8CBB\u76EE</th><th class="px-4 py-2.5 text-xs text-slate-500 text-right">USD</th><th class="px-4 py-2.5 text-xs text-slate-500 text-right">JPY</th><th class="px-4 py-2.5 text-xs text-slate-500 text-right">\u5272\u5408</th></tr></thead>' +
      '<tbody class="font-mono text-xs">' +
        '<tr class="border-t border-slate-100"><td class="px-4 py-2 text-slate-600 font-sans">STM \u30A4\u30D9\u30F3\u30C8</td><td class="px-4 py-2 text-right">$' + fU(mr.stmCost) + '</td><td class="px-4 py-2 text-right">&yen;' + fJ(mr.stmCost) + '</td><td class="px-4 py-2 text-right text-slate-400">' + (mr.totalCost > 0 ? (mr.stmCost / mr.totalCost * 100).toFixed(1) : '0') + '%</td></tr>' +
        '<tr class="border-t border-slate-100"><td class="px-4 py-2 text-slate-600 font-sans">LTM \u30B9\u30C8\u30EC\u30FC\u30B8' + (m.useOverrideStrategy ? ' (Override)' : ' (Default)') + '</td><td class="px-4 py-2 text-right">$' + fU(mr.ltmStorageCost) + '</td><td class="px-4 py-2 text-right">&yen;' + fJ(mr.ltmStorageCost) + '</td><td class="px-4 py-2 text-right text-slate-400">' + (mr.totalCost > 0 ? (mr.ltmStorageCost / mr.totalCost * 100).toFixed(1) : '0') + '%</td></tr>' +
        '<tr class="border-t border-slate-100"><td class="px-4 py-2 text-slate-600 font-sans">LTM \u691C\u7D22</td><td class="px-4 py-2 text-right">$' + fU(mr.ltmRetrievalCost) + '</td><td class="px-4 py-2 text-right">&yen;' + fJ(mr.ltmRetrievalCost) + '</td><td class="px-4 py-2 text-right text-slate-400">' + (mr.totalCost > 0 ? (mr.ltmRetrievalCost / mr.totalCost * 100).toFixed(1) : '0') + '%</td></tr>' +
        (m.useOverrideStrategy && mr.extractionCost > 0 ? '<tr class="border-t border-slate-100"><td class="px-4 py-2 text-slate-600 font-sans">LLM \u62BD\u51FA <span class="text-[10px] text-slate-400">(' + (pricingData[m.extractionModel] ? pricingData[m.extractionModel].name : '') + ')</span></td><td class="px-4 py-2 text-right">$' + fU(mr.extractionCost) + '</td><td class="px-4 py-2 text-right">&yen;' + fJ(mr.extractionCost) + '</td><td class="px-4 py-2 text-right text-slate-400">' + (mr.totalCost > 0 ? (mr.extractionCost / mr.totalCost * 100).toFixed(1) : '0') + '%</td></tr>' : '') +
        '<tr class="border-t-2 border-slate-300 bg-slate-50 font-semibold"><td class="px-4 py-3 font-sans text-slate-700">\u5408\u8A08</td><td class="px-4 py-3 text-right">$' + fU(mr.totalCost) + '</td><td class="px-4 py-3 text-right">&yen;' + fJ(mr.totalCost) + '</td><td class="px-4 py-3 text-right">100%</td></tr>' +
        '<tr class="border-t border-slate-200"><td class="px-4 py-2 font-sans text-slate-500">1\u30EA\u30AF\u30A8\u30B9\u30C8\u5358\u4FA1</td><td class="px-4 py-2 text-right">$' + mr.perRequest.toFixed(5) + '</td><td class="px-4 py-2 text-right">&yen;' + fJ2(mr.perRequest) + '</td><td></td></tr>' +
        '<tr class="border-t border-slate-100"><td class="px-4 py-2 font-sans text-slate-500">\u30BB\u30C3\u30B7\u30E7\u30F3\u5358\u4FA1</td><td class="px-4 py-2 text-right">$' + mr.perSession.toFixed(4) + '</td><td class="px-4 py-2 text-right">&yen;' + fJ2(mr.perSession) + '</td><td></td></tr>' +
        '<tr class="border-t border-slate-100"><td class="px-4 py-2 font-sans text-slate-500">\u30E6\u30FC\u30B6\u30FC\u6708\u984D</td><td class="px-4 py-2 text-right">$' + mr.perUserMonth.toFixed(4) + '</td><td class="px-4 py-2 text-right">&yen;' + fJ2(mr.perUserMonth) + '</td><td></td></tr>' +
        '<tr class="border-t border-slate-100"><td class="px-4 py-2 font-sans text-slate-500">\u30E6\u30FC\u30B6\u30FC\u5E74\u984D</td><td class="px-4 py-2 text-right">$' + mr.perUserYear.toFixed(4) + '</td><td class="px-4 py-2 text-right">&yen;' + fJ2(mr.perUserYear) + '</td><td></td></tr>' +
      '</tbody></table></div></section>';

    // Donut chart + Override comparison
    html += '<section class="mb-8"><div class="grid grid-cols-1 lg:grid-cols-2 gap-8">' +
      '<div><h2 class="text-sm font-semibold text-slate-700 mb-3">\u30B3\u30B9\u30C8\u69CB\u6210</h2>' +
        buildPieChart([
          { label: 'STM \u30A4\u30D9\u30F3\u30C8', value: mr.stmCost, color: '#3B82F6' },
          { label: 'LTM \u30B9\u30C8\u30EC\u30FC\u30B8', value: mr.ltmStorageCost, color: '#8B5CF6' },
          { label: 'LTM \u691C\u7D22', value: mr.ltmRetrievalCost, color: '#10B981' },
          ...(m.useOverrideStrategy && mr.extractionCost > 0 ? [{ label: 'LLM \u62BD\u51FA', value: mr.extractionCost, color: '#F59E0B' }] : []),
        ]) +
      '</div>' +
      '<div><h2 class="text-sm font-semibold text-slate-700 mb-3">Override Strategy \u6BD4\u8F03</h2>' +
        '<div class="border border-slate-200 rounded-lg overflow-hidden"><table class="w-full text-sm">' +
        '<thead><tr class="bg-slate-50"><th class="px-4 py-2.5 text-xs text-slate-500 text-left"></th><th class="px-4 py-2.5 text-xs text-slate-500 text-right">Default</th><th class="px-4 py-2.5 text-xs text-slate-500 text-right">Override</th><th class="px-4 py-2.5 text-xs text-slate-500 text-right">\u524A\u6E1B\u984D</th></tr></thead>' +
        '<tbody class="font-mono text-xs">' +
          '<tr class="border-t border-slate-100"><td class="px-4 py-2 text-slate-600 font-sans">LTM \u30B9\u30C8\u30EC\u30FC\u30B8</td><td class="px-4 py-2 text-right">&yen;' + fJ(mr.ltmStorageCostDefault) + '</td><td class="px-4 py-2 text-right">&yen;' + fJ(mr.ltmStorageCostOverride) + '</td><td class="px-4 py-2 text-right text-green-600">&yen;' + fJ(mr.ltmStorageCostDefault - mr.ltmStorageCostOverride) + '</td></tr>' +
          '<tr class="border-t border-slate-100"><td class="px-4 py-2 text-slate-600 font-sans">LLM \u62BD\u51FA</td><td class="px-4 py-2 text-right text-slate-400">&yen;0</td><td class="px-4 py-2 text-right">&yen;' + fJ(mr.extractionCost) + '</td><td class="px-4 py-2 text-right text-red-500">+&yen;' + fJ(mr.extractionCost) + '</td></tr>' +
          '<tr class="border-t border-slate-200 bg-slate-50 font-semibold"><td class="px-4 py-2 font-sans text-slate-700">\u5408\u8A08</td><td class="px-4 py-2 text-right">&yen;' + fJ(mr.totalCostDefault) + '</td><td class="px-4 py-2 text-right">&yen;' + fJ(mr.totalCostOverride) + '</td><td class="px-4 py-2 text-right ' + (mr.totalCostDefault >= mr.totalCostOverride ? 'text-green-600' : 'text-red-500') + '">' + (mr.totalCostDefault >= mr.totalCostOverride ? '&yen;' + fJ(mr.totalCostDefault - mr.totalCostOverride) : '+&yen;' + fJ(mr.totalCostOverride - mr.totalCostDefault)) + '</td></tr>' +
          '<tr class="border-t border-slate-200"><td class="px-4 py-2 font-sans text-slate-500">\u5DEE\u984D\u7387</td><td></td><td></td><td class="px-4 py-2 text-right ' + (mr.totalCostDefault >= mr.totalCostOverride ? 'text-green-600' : 'text-red-500') + ' font-semibold">' + (mr.totalCostDefault > 0 ? ((1 - mr.totalCostOverride / mr.totalCostDefault) * 100).toFixed(1) : '0') + '%</td></tr>' +
        '</tbody></table></div>' +
      '</div></div></section>';

    // Preset comparison table
    const presetResults = memoryPresets.map(p => ({ preset: p, result: computeMemoryResults({
      ...p,
      stmEventsPerRequest: m.stmEventsPerRequest || 2,
      ltmRetrievalTiming: m.ltmRetrievalTiming || 'every',
      extractionEnabled: p.useOverrideStrategy,
      extractionModel: m.extractionModel,
      extractionInputTokens: m.extractionInputTokens,
      extractionOutputTokens: m.extractionOutputTokens,
    }) }));
    html += '<section class="mb-8"><h2 class="text-sm font-semibold text-slate-700 mb-3">規模別シミュレーション比較</h2>' +
      '<div class="overflow-x-auto border border-slate-200 rounded-lg"><table class="w-full text-sm">' +
      '<thead><tr class="bg-slate-50"><th class="px-4 py-2.5 text-xs text-slate-500 text-left">項目</th>' +
      presetResults.map(pr => '<th class="px-4 py-2.5 text-xs text-slate-500 text-right">' + pr.preset.name + '<br><span class="font-normal text-slate-400">' + pr.preset.desc + '</span></th>').join('') +
      '</tr></thead>' +
      '<tbody class="text-xs">' +
        '<tr class="border-t border-slate-100 bg-slate-50/50"><td colspan="' + (presetResults.length + 1) + '" class="px-4 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">パラメータ</td></tr>' +
        '<tr class="border-t border-slate-100"><td class="px-4 py-1.5 text-slate-600">ユーザー数</td>' + presetResults.map(pr => '<td class="px-4 py-1.5 text-right font-mono">' + pr.preset.userCount.toLocaleString() + '</td>').join('') + '</tr>' +
        '<tr class="border-t border-slate-100"><td class="px-4 py-1.5 text-slate-600">セッション/ユーザー</td>' + presetResults.map(pr => '<td class="px-4 py-1.5 text-right font-mono">' + pr.preset.sessionsPerUser + '</td>').join('') + '</tr>' +
        '<tr class="border-t border-slate-100"><td class="px-4 py-1.5 text-slate-600">リクエスト/セッション</td>' + presetResults.map(pr => '<td class="px-4 py-1.5 text-right font-mono">' + pr.preset.roundtripsPerSession + '</td>').join('') + '</tr>' +
        '<tr class="border-t border-slate-100"><td class="px-4 py-1.5 text-slate-600">LTM検索/リクエスト</td>' + presetResults.map(pr => '<td class="px-4 py-1.5 text-right font-mono">' + pr.preset.retrievalsPerSession + '</td>').join('') + '</tr>' +
        '<tr class="border-t border-slate-100"><td class="px-4 py-1.5 text-slate-600">LTMレコード/ユーザー</td>' + presetResults.map(pr => '<td class="px-4 py-1.5 text-right font-mono">' + pr.preset.recordsPerUser + '</td>').join('') + '</tr>' +
        '<tr class="border-t border-slate-100 bg-slate-50/50"><td colspan="' + (presetResults.length + 1) + '" class="px-4 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">月間ボリューム</td></tr>' +
        '<tr class="border-t border-slate-100"><td class="px-4 py-1.5 text-slate-600">総リクエスト</td>' + presetResults.map(pr => '<td class="px-4 py-1.5 text-right font-mono">' + pr.result.totalRoundtrips.toLocaleString() + '</td>').join('') + '</tr>' +
        '<tr class="border-t border-slate-100"><td class="px-4 py-1.5 text-slate-600">STMイベント</td>' + presetResults.map(pr => '<td class="px-4 py-1.5 text-right font-mono">' + pr.result.totalEvents.toLocaleString() + '</td>').join('') + '</tr>' +
        '<tr class="border-t border-slate-100"><td class="px-4 py-1.5 text-slate-600">LTM検索</td>' + presetResults.map(pr => '<td class="px-4 py-1.5 text-right font-mono">' + pr.result.totalRetrievals.toLocaleString() + '</td>').join('') + '</tr>' +
        '<tr class="border-t border-slate-100 bg-slate-50/50"><td colspan="' + (presetResults.length + 1) + '" class="px-4 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">月額コスト (Default Strategy)</td></tr>' +
        '<tr class="border-t border-slate-100"><td class="px-4 py-1.5 text-slate-600">STMイベント</td>' + presetResults.map(pr => '<td class="px-4 py-1.5 text-right font-mono">&yen;' + fJ(pr.result.stmCost) + '</td>').join('') + '</tr>' +
        '<tr class="border-t border-slate-100"><td class="px-4 py-1.5 text-slate-600">LTMストレージ</td>' + presetResults.map(pr => '<td class="px-4 py-1.5 text-right font-mono">&yen;' + fJ(pr.result.ltmStorageCostDefault) + '</td>').join('') + '</tr>' +
        '<tr class="border-t border-slate-100"><td class="px-4 py-1.5 text-slate-600">LTM検索</td>' + presetResults.map(pr => '<td class="px-4 py-1.5 text-right font-mono">&yen;' + fJ(pr.result.ltmRetrievalCost) + '</td>').join('') + '</tr>' +
        '<tr class="border-t-2 border-slate-300 bg-slate-50 font-semibold"><td class="px-4 py-2 text-slate-700">合計 (Default)</td>' + presetResults.map(pr => '<td class="px-4 py-2 text-right font-mono">&yen;' + fJ(pr.result.totalCostDefault) + '</td>').join('') + '</tr>' +
        '<tr class="border-t border-slate-100 bg-amber-50/50"><td colspan="' + (presetResults.length + 1) + '" class="px-4 py-1.5 text-[11px] font-semibold text-amber-600 uppercase tracking-wider">Override Strategy (+ LLM\u62BD\u51FA\u30B3\u30B9\u30C8)</td></tr>' +
        '<tr class="border-t border-slate-100"><td class="px-4 py-1.5 text-slate-600">LTM\u30B9\u30C8\u30EC\u30FC\u30B8 (Override)</td>' + presetResults.map(pr => '<td class="px-4 py-1.5 text-right font-mono">&yen;' + fJ(pr.result.ltmStorageCostOverride) + '</td>').join('') + '</tr>' +
        '<tr class="border-t border-slate-100"><td class="px-4 py-1.5 text-slate-600">LLM\u62BD\u51FA</td>' + presetResults.map(pr => '<td class="px-4 py-1.5 text-right font-mono">&yen;' + fJ(pr.result.extractionCost) + '</td>').join('') + '</tr>' +
        '<tr class="border-t border-slate-200 bg-amber-50 font-semibold"><td class="px-4 py-2 text-amber-700">合計 (Override)</td>' + presetResults.map(pr => '<td class="px-4 py-2 text-right font-mono text-amber-700">&yen;' + fJ(pr.result.totalCostOverride) + '</td>').join('') + '</tr>' +
        '<tr class="border-t border-slate-100 bg-slate-50/50"><td colspan="' + (presetResults.length + 1) + '" class="px-4 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">単価 (Default Strategy)</td></tr>' +
        '<tr class="border-t border-slate-100"><td class="px-4 py-1.5 text-slate-600">1リクエスト単価</td>' + presetResults.map(pr => '<td class="px-4 py-1.5 text-right font-mono">&yen;' + fJ2(pr.result.perRequest) + '</td>').join('') + '</tr>' +
        '<tr class="border-t border-slate-100"><td class="px-4 py-1.5 text-slate-600">ユーザー月額</td>' + presetResults.map(pr => '<td class="px-4 py-1.5 text-right font-mono">&yen;' + fJ2(pr.result.perUserMonth) + '</td>').join('') + '</tr>' +
        '<tr class="border-t border-slate-100"><td class="px-4 py-1.5 text-slate-600">ユーザー年額</td>' + presetResults.map(pr => '<td class="px-4 py-1.5 text-right font-mono">&yen;' + fJ2(pr.result.perUserYear) + '</td>').join('') + '</tr>' +
      '</tbody></table></div></section>';
  }

  // Footer
  html += '<footer class="text-xs text-slate-400 border-t border-slate-200 pt-6 mt-8"><p>2026\u5E742\u6708\u6642\u70B9\u306E\u516C\u5F0F\u4FA1\u683C\u306B\u57FA\u3065\u304F\u3002</p></footer>';

  app.innerHTML = html;

  // \u2500\u2500 Bind Events \u2500\u2500
  app.querySelectorAll('button[data-tab]').forEach(el => {
    el.addEventListener('click', () => { state.activeTab = el.dataset.tab; history.pushState(null, '', '#' + el.dataset.tab); render(); });
  });
  app.querySelectorAll('input[data-key="exchangeRate"]').forEach(el => {
    el.addEventListener('input', (e) => {
      if (e.target.value === '' || isNaN(Number(e.target.value))) return;
      state.exchangeRate = Number(e.target.value);
      debouncedRender('exchangeRate');
    });
  });
  // Param inputs
  app.querySelectorAll('input[data-prefix]').forEach(el => {
    el.addEventListener('input', (e) => {
      if (e.target.value === '' || isNaN(Number(e.target.value))) return;
      const pfx = e.target.dataset.prefix;
      const target = pfx === 'sim' ? state.sim : pfx === 'mem' ? state.mem : state.scenarios[state.activeScenario];
      target[e.target.dataset.key] = Number(e.target.value);
      debouncedRender(e.target.dataset.key, pfx);
    });
  });
  // Option buttons
  app.querySelectorAll('button[data-opt]').forEach(el => {
    el.addEventListener('click', () => {
      const target = el.dataset.prefix === 'sim' ? state.sim : state.scenarios[state.activeScenario];
      target.isSharedCache = el.dataset.opt === 'shared';
      render();
    });
  });
  app.querySelectorAll('button[data-wrt]').forEach(el => {
    el.addEventListener('click', () => {
      const target = el.dataset.prefix === 'sim' ? state.sim : state.scenarios[state.activeScenario];
      target.claudeWriteType = el.dataset.wrt;
      render();
    });
  });
  // Scenario buttons
  app.querySelectorAll('button[data-scenario]').forEach(el => {
    el.addEventListener('click', () => { state.activeScenario = Number(el.dataset.scenario); render(); });
  });
  // Memory strategy buttons (linked to extraction toggle)
  app.querySelectorAll('button[data-mem-strategy]').forEach(el => {
    el.addEventListener('click', () => {
      const isOverride = el.dataset.memStrategy === 'override';
      state.mem.useOverrideStrategy = isOverride;
      state.mem.extractionEnabled = isOverride;
      render();
    });
  });
  // Memory retrieval timing buttons
  app.querySelectorAll('button[data-mem-retrieval]').forEach(el => {
    el.addEventListener('click', () => {
      state.mem.ltmRetrievalTiming = el.dataset.memRetrieval;
      render();
    });
  });
  // Memory extraction toggle removed — now linked to LTM Strategy (Override = ON, Default = OFF)
  // Memory extraction model select
  app.querySelectorAll('select[data-extraction-model]').forEach(el => {
    el.addEventListener('change', () => {
      state.mem.extractionModel = el.value;
      render();
    });
  });
}

let _renderTimer = null;
function debouncedRender(key, prefix) {
  clearTimeout(_renderTimer);
  _renderTimer = setTimeout(function() {
    render();
    if (key) restoreFocus(key, prefix);
  }, 300);
}

function restoreFocus(key, prefix) {
  const sel = prefix ? 'input[data-prefix="' + prefix + '"][data-key="' + key + '"]' : 'input[data-key="' + key + '"]';
  const next = document.querySelector(sel);
  if (next) {
    next.focus();
    try { next.selectionStart = next.selectionEnd = next.value.length; } catch(e) {
      // number inputs don't support selectionStart; re-set value to move cursor to end
      var v = next.value; next.value = ''; next.value = v;
    }
  }
}

// \u2500\u2500 Bootstrap \u2500\u2500
window.addEventListener('popstate', function() {
  var h = location.hash.replace('#','');
  if (['simulator','scenario','memory'].indexOf(h) !== -1) { state.activeTab = h; render(); }
});
render();
</script>
</body>
</html>`;

Deno.serve({ port: 8000 }, (_req: Request) => {
  const html = HTML.replace("__PRICING_DATA__", pricingJson);
  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
});
