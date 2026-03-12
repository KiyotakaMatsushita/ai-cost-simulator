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
    promptTokens: 2000, outputTokens: 500, cacheWriteTokens: 3000, cacheReadTokens: 8000, cacheTokens: 10000,
    userCount: 100, reqPerUser: 5, testDays: 14, hoursPerDay: 24,
    claudeWriteType: '5m', cacheWritesPerDay: 0,
  },
  {
    name: '\u672C\u756A\u904B\u7528',
    promptTokens: 3000, outputTokens: 1000, cacheWriteTokens: 5000, cacheReadTokens: 15000, cacheTokens: 20000,
    userCount: 1000, reqPerUser: 10, testDays: 30, hoursPerDay: 24,
    claudeWriteType: '5m', cacheWritesPerDay: 0,
  },
  {
    name: '\u5927\u898F\u6A21\u5C55\u958B',
    promptTokens: 5000, outputTokens: 2000, cacheWriteTokens: 10000, cacheReadTokens: 30000, cacheTokens: 40000,
    userCount: 10000, reqPerUser: 20, testDays: 30, hoursPerDay: 24,
    claudeWriteType: '5m', cacheWritesPerDay: 0,
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
    promptTokens: 3000, outputTokens: 1000, cacheWriteTokens: 5000, cacheReadTokens: 10000, cacheTokens: 15000,
    userCount: 1000, reqPerUser: 10, testDays: 7, hoursPerDay: 24,
    claudeWriteType: '5m', cacheWritesPerDay: 0,
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
    extractionInputTokens: 2000,
    extractionOutputTokens: 200,
  },
};

// \u2500\u2500 Helpers \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
function fJ(usd) { return (Number(usd) * state.exchangeRate).toLocaleString('ja-JP', { minimumFractionDigits: 0, maximumFractionDigits: 0 }); }
function fJ2(usd) { return (Number(usd) * state.exchangeRate).toLocaleString('ja-JP', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fU(v) { return Number(v).toFixed(2); }

// Auto-calculate Claude writes/day based on request frequency and TTL
// 初回キャッシュ(C)の再書込回数/日を自動計算
// Cは全ユーザー共通キャッシュなので、全ユーザー合計のリクエスト頻度でTTLを判定
function calcSharedWpd(p, ttlHours) {
  const totalRpd = (p.userCount * p.reqPerUser) / p.testDays;
  if (totalRpd === 0 || p.hoursPerDay === 0) return 0;
  const avgInterval = p.hoursPerDay / totalRpd;
  if (avgInterval <= ttlHours) return 1;
  return Math.ceil(p.hoursPerDay / ttlHours);
}
function getWpd(key, p) {
  if (p.cacheWritesPerDay > 0) {
    if (key.includes('gemini')) return 1;
    return p.cacheWritesPerDay;
  }
  if (key.includes('gemini')) return 1;
  if (key.includes('claude')) {
    const ttl = p.claudeWriteType === '1h' ? 1 : 5 / 60;
    return calcSharedWpd(p, ttl);
  }
  if (key.includes('gpt') || key.includes('nova')) return calcSharedWpd(p, 5 / 60);
  return 1;
}

// モデルごとの共通プロパティを算出
function modelProps(key, m, p) {
  const isClaude = key.includes('claude');
  const isGemini = key.includes('gemini');
  const cwM = (isGemini ? 0 : (p.cacheWriteTokens || 0)) / 1e6;
  const crM = (isGemini ? p.cacheTokens : (p.cacheReadTokens || 0)) / 1e6;
  const cM = p.cacheTokens / 1e6;
  const pM = p.promptTokens / 1e6;
  const oM = p.outputTokens / 1e6;
  const wp = isClaude ? (p.claudeWriteType === '1h' ? m.cacheWrite1h : m.cacheWrite5m) : m.input;
  const wpd = getWpd(key, p);
  return { isClaude, isOpenAI: key.includes('gpt'), isNova: key.includes('nova'), isGemini, cwM, crM, cM, pM, oM, wp, wpd };
}

function computeResults(p) {
  const totalReqs = p.userCount * p.reqPerUser;
  const totalHours = p.hoursPerDay * p.testDays;
  const results = Object.entries(pricingData).map(([key, m]) => {
    const mp = modelProps(key, m, p);
    // TTL切れ時のC再書込コスト (システムプロンプトは共通キャッシュ → scale=1)
    const ttlWr = mp.cM * mp.wp * mp.wpd * p.testDays;
    const cwCost = mp.cwM * mp.wp * totalReqs;
    const st = mp.isGemini ? mp.cM * m.storage * totalHours : 0;
    const rd = mp.crM * m.cachedInput * totalReqs;
    const pr = mp.pM * m.input * totalReqs;
    const ou = mp.oM * m.output * totalReqs;
    const tot = cwCost + st + rd + pr + ou;
    const pReq = totalReqs > 0 ? tot / totalReqs : 0;
    const noC = (mp.crM + mp.cwM + mp.pM) * m.input * totalReqs + ou;
    return {
      ...m, id: key, isClaude: mp.isClaude, isOpenAI: mp.isOpenAI, isNova: mp.isNova, isGemini: mp.isGemini,
      writePrice: mp.wp, writesPerDay: mp.wpd, ttlWrite: ttlWr, cwWrite: cwCost, storageCost: st,
      read: rd, prompt: pr, outputCost: ou, total: tot, perReq: pReq, noCache: noC,
      savPct: noC > 0 ? (((noC - tot) / noC) * 100).toFixed(1) : '0.0', savUSD: noC - tot,
    };
  });
  return { results, totalReqs, totalHours };
}

function computeTimeSeries(p) {
  const dailyReqs = (p.userCount * p.reqPerUser) / p.testDays;
  return Object.entries(pricingData).map(([key, m]) => {
    const mp = modelProps(key, m, p);
    const dCwWrite = mp.cwM * mp.wp * dailyReqs;
    const dStorage = mp.isGemini ? mp.cM * m.storage * p.hoursPerDay : 0;
    const dRead = mp.crM * m.cachedInput * dailyReqs;
    const dPrompt = mp.pM * m.input * dailyReqs;
    const dOutput = mp.oM * m.output * dailyReqs;
    const daily = dCwWrite + dStorage + dRead + dPrompt + dOutput;
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

  // LLM extraction cost per model (Override strategy uses appendToPrompt + modelId → Bedrock inference charged separately)
  const inMTok = (m.extractionInputTokens || 0) / 1e6;
  const outMTok = (m.extractionOutputTokens || 0) / 1e6;
  const baseCostDefault = stmCost + ltmStorageCostDefault + ltmRetrievalCost;
  const baseCostOverride = stmCost + ltmStorageCostOverride + ltmRetrievalCost;

  const extractionResults = Object.entries(pricingData).map(([key, em]) => {
    const extractionCost = (inMTok * em.input + outMTok * em.output) * totalRoundtrips;
    const totalCostOverride = baseCostOverride + extractionCost;
    const totalCost = m.useOverrideStrategy ? totalCostOverride : baseCostDefault;
    return {
      id: key, name: em.name, color: em.color,
      inputPrice: em.input, outputPrice: em.output,
      extractionCost,
      totalCostOverride,
      totalCost,
      perRequest: totalRoundtrips > 0 ? totalCost / totalRoundtrips : 0,
      perSession: totalSessions > 0 ? totalCost / totalSessions : 0,
      perUserMonth: m.userCount > 0 ? totalCost / m.userCount : 0,
      perUserYear: m.userCount > 0 ? (totalCost / m.userCount) * 12 : 0,
    };
  });

  // Default: AWS handles extraction automatically (included in storage price) → no separate LLM cost
  // Override: User provides custom extraction prompt → LLM inference cost applies
  const totalCostDefault = baseCostDefault;
  // For backward compat: use cheapest model for single-value fields
  const cheapestOverride = extractionResults.reduce((a, b) => a.totalCostOverride < b.totalCostOverride ? a : b);
  const extractionCost = cheapestOverride.extractionCost;
  const totalCostOverride = cheapestOverride.totalCostOverride;
  const totalCost = m.useOverrideStrategy ? cheapestOverride.totalCost : baseCostDefault;

  const perRequest = totalRoundtrips > 0 ? totalCost / totalRoundtrips : 0;
  const perSession = totalSessions > 0 ? totalCost / totalSessions : 0;
  const perUserMonth = m.userCount > 0 ? totalCost / m.userCount : 0;
  const perUserYear = perUserMonth * 12;

  return {
    totalSessions, totalEvents, totalRetrievals, totalRecords, totalRoundtrips, eventsPerRT,
    stmCost, ltmStorageCost, ltmStorageCostDefault, ltmStorageCostOverride,
    ltmRetrievalCost, extractionCost, totalCost, totalCostDefault, totalCostOverride,
    perRequest, perSession, perUserMonth, perUserYear,
    extractionResults, baseCostDefault, baseCostOverride,
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

function paramGrid(prefix, p) {
  return '<div class="grid grid-cols-2 lg:grid-cols-4 gap-3">' +
    [
      ['\u5165\u529B\u30C8\u30FC\u30AF\u30F3/req', 'promptTokens'],
      ['\u51FA\u529B\u30C8\u30FC\u30AF\u30F3/req', 'outputTokens'],
      ['\u30AD\u30E3\u30C3\u30B7\u30E5\u66F8\u8FBC/req', 'cacheWriteTokens'],
      ['\u30AD\u30E3\u30C3\u30B7\u30E5\u8AAD\u8FBC/req', 'cacheReadTokens'],
      ['\u521D\u56DE\u30AD\u30E3\u30C3\u30B7\u30E5\u66F8\u8FBC', 'cacheTokens'],
      ['\u521D\u56DE\u66F8\u8FBC\u56DE\u6570/\u65E5', 'cacheWritesPerDay'],
      ['\u5229\u7528\u8005\u6570 U', 'userCount'],
      ['\u56DE\u6570/\u30E6\u30FC\u30B6\u30FC N', 'reqPerUser'],
      ['\u30C6\u30B9\u30C8\u65E5\u6570 D', 'testDays'],
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

function extractionParamSection(m) {
  if (!m.useOverrideStrategy) return '';
  return '<div class="grid grid-cols-2 gap-3 mt-3">' +
    '<label class="block"><span class="text-xs text-slate-500">\u62BD\u51FA\u5165\u529B\u30C8\u30FC\u30AF\u30F3 <span class="tip"><svg class="inline w-3.5 h-3.5 -mt-0.5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke-width="1.5"/><path stroke-width="1.5" d="M9.5 9.5a2.5 2.5 0 0 1 4.99.5c0 1.5-2.49 2-2.49 3M12 17h.01"/></svg><span class="tip-text" style="white-space:normal;width:280px;">\u30B7\u30B9\u30C6\u30E0\u30D7\u30ED\u30F3\u30D7\u30C8 + appendToPrompt + \u4F1A\u8A71\u30B3\u30F3\u30C6\u30AD\u30B9\u30C8\u3002\u7D04 2,000 tok</span></span></span>' +
      '<input type="number" data-prefix="mem" data-key="extractionInputTokens" value="' + m.extractionInputTokens + '" class="' + inputCls() + '" /></label>' +
    '<label class="block"><span class="text-xs text-slate-500">\u62BD\u51FA\u51FA\u529B\u30C8\u30FC\u30AF\u30F3 <span class="tip"><svg class="inline w-3.5 h-3.5 -mt-0.5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke-width="1.5"/><path stroke-width="1.5" d="M9.5 9.5a2.5 2.5 0 0 1 4.99.5c0 1.5-2.49 2-2.49 3M12 17h.01"/></svg><span class="tip-text" style="white-space:normal;width:280px;">\u62BD\u51FA\u3055\u308C\u308B\u30EC\u30B3\u30FC\u30C9 (1\u301C3\u4EF6)\u3002\u7D04 200 tok</span></span></span>' +
      '<input type="number" data-prefix="mem" data-key="extractionOutputTokens" value="' + m.extractionOutputTokens + '" class="' + inputCls() + '" /></label>' +
    '</div>';
}

function modelSettingsSection(prefix, p) {
  const totalHours = p.hoursPerDay * p.testDays;
  const smallInput = 'w-20 border border-slate-200 rounded-md px-2 py-1 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/30';
  return '<div class="mt-4 space-y-2">' +
    '<p class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">\u30E2\u30C7\u30EB\u5225\u8A2D\u5B9A</p>' +
    // Gemini
    '<div class="flex items-center gap-3 px-3 py-2 border border-slate-100 rounded-lg">' +
      '<span class="text-xs font-semibold w-16" style="color:#4285F4">Gemini</span>' +
      '<span class="text-xs text-slate-400">\u4FDD\u6301\u6642\u9593:</span>' +
      '<input type="number" data-prefix="' + prefix + '" data-key="hoursPerDay" value="' + p.hoursPerDay + '" class="' + smallInput + '" />' +
      '<span class="text-xs text-slate-400">h/\u65E5' + (totalHours ? ' (\u8A08' + totalHours + 'h)' : '') + '</span>' +
      '<span class="text-[10px] text-slate-300 ml-auto">\u6C38\u7D9A\u30AD\u30E3\u30C3\u30B7\u30E5\u30FB\u5171\u6709\u30FB Storage\u8AB2\u91D1\u3042\u308A</span>' +
    '</div>' +
    // Claude
    '<div class="flex flex-wrap items-center gap-3 px-3 py-2 border border-slate-100 rounded-lg">' +
      '<span class="text-xs font-semibold w-16" style="color:#D97706">Claude</span>' +
      '<span class="text-xs text-slate-400">Write TTL:</span>' +
      '<div class="flex gap-1">' +
        '<button data-prefix="' + prefix + '" data-wrt="5m" class="px-2 py-0.5 text-[11px] rounded border ' + (p.claudeWriteType === '5m' ? 'bg-slate-800 text-white border-slate-800' : 'border-slate-200 text-slate-500') + '">5\u5206</button>' +
        '<button data-prefix="' + prefix + '" data-wrt="1h" class="px-2 py-0.5 text-[11px] rounded border ' + (p.claudeWriteType === '1h' ? 'bg-slate-800 text-white border-slate-800' : 'border-slate-200 text-slate-500') + '">1\u6642\u9593</button>' +
      '</div>' +
      '<span class="text-[10px] text-slate-300 ml-auto">\u500B\u5225\u30AD\u30E3\u30C3\u30B7\u30E5\u30FB\u4E0A\u4E57\u305B\u66F8\u8FBC\u30FB Storage\u7121\u6599</span>' +
    '</div>' +
    // OpenAI
    '<div class="flex items-center gap-3 px-3 py-2 border border-slate-100 rounded-lg">' +
      '<span class="text-xs font-semibold w-16" style="color:#10A37F">OpenAI</span>' +
      '<span class="text-[11px] text-slate-400">\u81EA\u52D5\u30AD\u30E3\u30C3\u30B7\u30E5 (~5\u5206 TTL, sliding window)</span>' +
      '<span class="text-[10px] text-slate-300 ml-auto">\u500B\u5225\u30AD\u30E3\u30C3\u30B7\u30E5\u30FB\u66F8\u8FBC=Input\u540C\u984D\u30FB Storage\u7121\u6599</span>' +
    '</div>' +
    // Nova
    '<div class="flex items-center gap-3 px-3 py-2 border border-slate-100 rounded-lg">' +
      '<span class="text-xs font-semibold w-16" style="color:#FF9900">Nova</span>' +
      '<span class="text-[11px] text-slate-400">5\u5206 TTL sliding window</span>' +
      '<span class="text-[10px] text-slate-300 ml-auto">\u500B\u5225\u30AD\u30E3\u30C3\u30B7\u30E5\u30FB\u66F8\u8FBC=Input\u540C\u984D\u30FB Storage\u7121\u6599</span>' +
    '</div>' +
  '</div>';
}

function modelHeaders(results) {
  return results.map(r => '<th class="px-4 py-2.5 font-semibold text-xs" style="color:' + r.color + '">' + r.name + '</th>').join('');
}

// ── Excel Download ─────────────────────────
function downloadExcel() {
  var p = state.activeTab === 'scenario' ? state.scenarios[state.activeScenario] : state.sim;
  var wb = XLSX.utils.book_new();
  var P = "'\u30D1\u30E9\u30E1\u30FC\u30BF\u30FC'!$B$";

  // ── パラメーター sheet ──────────────────
  var ps = {};
  function ps_s(a,v) { ps[a] = {t:'s', v:String(v)}; }
  function ps_n(a,v) { ps[a] = {t:'n', v:Number(v)}; }
  function ps_f(a,f) { ps[a] = {t:'n', f:f}; }
  ps_s('A1', 'AI Cost Strategy Simulator \u2014 \u30D1\u30E9\u30E1\u30FC\u30BF\u30FC');
  ps_s('A3', '\u3010\u30D1\u30E9\u30E1\u30FC\u30BF\u30FC\u3011');
  var paramList = [
    ['\u70BA\u66FF\u30EC\u30FC\u30C8 (\u00A5/$)', state.exchangeRate],          // B4
    ['\u5165\u529B\u30C8\u30FC\u30AF\u30F3/req (P)', p.promptTokens],           // B5
    ['\u51FA\u529B\u30C8\u30FC\u30AF\u30F3/req (O)', p.outputTokens],           // B6
    ['\u30AD\u30E3\u30C3\u30B7\u30E5\u66F8\u8FBC/req (CW)', p.cacheWriteTokens || 0], // B7
    ['\u30AD\u30E3\u30C3\u30B7\u30E5\u8AAD\u8FBC/req (CR)', p.cacheReadTokens || 0], // B8
    ['\u521D\u56DE\u30AD\u30E3\u30C3\u30B7\u30E5\u66F8\u8FBC (C)', p.cacheTokens],   // B9
    ['\u5229\u7528\u8005\u6570 (U)', p.userCount],                       // B10
    ['\u56DE\u6570/\u30E6\u30FC\u30B6\u30FC (N)', p.reqPerUser],                 // B11
    ['\u30C6\u30B9\u30C8\u65E5\u6570 (D)', p.testDays],                     // B12
    ['\u7A3C\u52D5\u6642\u9593/\u65E5 (h)', p.hoursPerDay],                  // B13
    ['Claude Write TTL (1=1h, 0=5m)', p.claudeWriteType === '1h' ? 1 : 0], // B14
    ['\u521D\u56DE\u66F8\u8FBC\u56DE\u6570/\u65E5 (0=\u81EA\u52D5)', p.cacheWritesPerDay || 0], // B15
    ['\u521D\u56DE\u66F8\u8FBC\u56DE\u6570/\u65E5 (\u5B9F\u52B9\u5024)', getWpd('claude', p)],     // B16
  ];
  paramList.forEach(function(row, i) { ps_s('A'+(4+i), row[0]); ps_n('B'+(4+i), row[1]); });
  ps_s('A18', '\u3010\u5C0E\u51FA\u5024\u3011');
  ps_s('A19', '\u7DCF\u30EA\u30AF\u30A8\u30B9\u30C8\u6570'); ps_f('B19', 'B10*B11');
  ps_s('A20', '\u7DCF\u4FDD\u7BA1\u6642\u9593 (h)'); ps_f('B20', 'B13*B12');
  ps_s('D3', '\u5099\u8003');
  ps_s('D7', 'Gemini\u306F0\u306B\u81EA\u52D5\u8A2D\u5B9A');
  ps_s('D8', 'Gemini\u306F\u521D\u56DE\u66F8\u8FBC\u5024\u3092\u4F7F\u7528');
  ps_s('D14', '1=1\u6642\u9593TTL, 0=5\u5206TTL');
  ps_s('D15', '0=\u30EA\u30AF\u30A8\u30B9\u30C8\u983B\u5EA6\u304B\u3089\u81EA\u52D5\u8A08\u7B97, >0=\u624B\u52D5\u6307\u5B9A');
  ps['!ref'] = 'A1:D20';
  ps['!cols'] = [{wch:32},{wch:14},{wch:2},{wch:40}];
  XLSX.utils.book_append_sheet(wb, ps, '\u30D1\u30E9\u30E1\u30FC\u30BF\u30FC');

  // ── Platform sheets (Gemini / Claude / OpenAI / Bedrock) ──
  var platforms = [
    { name: 'Gemini', keys: ['gemini25Flash','gemini30Flash','gemini3Pro'],
      useWriteFormula: false, wpd: function() { return 1; },
      remarks: ['\u6C38\u7D9A\u30AD\u30E3\u30C3\u30B7\u30E5 \u2192 \u66F8\u8FBC1\u56DE/\u65E5', 'Storage\u8AB2\u91D1\u3042\u308A'] },
    { name: 'Claude', keys: ['claude45Haiku','claude45Sonnet','claude45Opus'],
      useWriteFormula: true, wpd: function() { return getWpd('claude', p); },
      remarks: ['TTL\u306B\u5FDC\u3058\u3066Write\u5358\u4FA1\u5207\u66FF', 'Sliding window: TTL\u5185\u30EA\u30AF\u30A8\u30B9\u30C8\u3067\u7DAD\u6301', 'Storage\u8AB2\u91D1\u306A\u3057'] },
    { name: 'OpenAI', keys: ['gpt5Mini','gpt5'],
      useWriteFormula: false, wpd: function() { return getWpd('gpt', p); },
      remarks: ['\u81EA\u52D5\u30AD\u30E3\u30C3\u30B7\u30E5 (~5\u5206TTL)', 'Write=Input\u540C\u984D', 'Storage\u8AB2\u91D1\u306A\u3057'] },
    { name: 'Bedrock', keys: ['novaMicro','novaLite','novaPro'],
      useWriteFormula: false, wpd: function() { return getWpd('nova', p); },
      remarks: ['5\u5206TTL sliding window', 'Write=Input\u540C\u984D', 'Storage\u8AB2\u91D1\u306A\u3057'] },
  ];
  var summaryRefs = [];
  var colPool = ['C','D','E','F','G'];

  platforms.forEach(function(plat) {
    var ws = {};
    function s(a,v) { ws[a] = {t:'s', v:String(v)}; }
    function n(a,v) { ws[a] = {t:'n', v:Number(v)}; }
    function fm(a,f) { ws[a] = {t:'n', f:f}; }
    var mods = plat.keys.filter(function(k) { return pricingData[k]; })
                        .map(function(k) { return { key: k, m: pricingData[k] }; });
    var cols = colPool.slice(0, mods.length);
    var remarkCol = colPool[mods.length];

    // Row 1: Title
    s('A1', plat.name);

    // Row 3-9: Unit prices
    s('A3', '\u3010\u5358\u4FA1 ($/MTok)\u3011');
    mods.forEach(function(o,i) { s(cols[i]+'3', o.m.name); });
    s('A4', '\u5165\u529B (Input)');
    s('A5', '\u66F8\u8FBC (Write)');
    s('A6', '\u518D\u5229\u7528 (Cached Read)');
    s('A7', '\u51FA\u529B (Output)');
    s('A8', '\u4FDD\u7BA1 (Storage/h)');
    s('A9', '\u66F8\u8FBC\u56DE\u6570/\u65E5');
    mods.forEach(function(o, i) {
      var c = cols[i];
      n(c+'4', o.m.input);
      if (plat.useWriteFormula) {
        fm(c+'5', 'IF('+P+'14=1,'+o.m.cacheWrite1h+','+o.m.cacheWrite5m+')');
      } else {
        n(c+'5', o.m.input);
      }
      n(c+'6', o.m.cachedInput);
      n(c+'7', o.m.output);
      n(c+'8', o.m.storage);
      n(c+'9', plat.wpd());
    });

    // Row 11-17: Cost breakdown (USD)
    s('A11', '\u3010\u30B3\u30B9\u30C8\u5185\u8A33 (USD)\u3011');
    mods.forEach(function(o,i) { s(cols[i]+'11', o.m.name); });
    s('A12', '\u30AD\u30E3\u30C3\u30B7\u30E5\u518D\u4F5C\u6210 (C\u00D7TTL)');
    s('A13', 'Storage (\u4FDD\u7BA1\u6599)');
    s('A14', 'Read (\u30AD\u30E3\u30C3\u30B7\u30E5\u8AAD\u51FA)');
    s('A15', 'CW Write (\u30EA\u30AF\u30A8\u30B9\u30C8\u66F8\u8FBC)');
    s('A16', 'Prompt (\u65B0\u898F\u5165\u529B)');
    s('A17', 'Output (\u51FA\u529B)');
    mods.forEach(function(o, i) {
      var c = cols[i];
      var isGemini = plat.name === 'Gemini';
      // Write = (C/1M) * WritePrice * WPD * Days * Scale
      if (isGemini) {
        fm(c+'12', '('+P+'9/1000000)*'+c+'5*1');
      } else {
        fm(c+'12', '('+P+'9/1000000)*'+c+'5*'+c+'9*'+P+'12');
      }
      // Storage = (C/1M) * StoragePrice * TotalHours (Geminiのみ実質発生、他はstorage=0)
      fm(c+'13', '('+P+'9/1000000)*'+c+'8*'+P+'20');
      // Read = (CR/1M) * CachedInput * TotalReqs (Gemini uses C instead of CR)
      if (isGemini) {
        fm(c+'14', '('+P+'9/1000000)*'+c+'6*'+P+'19');
      } else {
        fm(c+'14', '('+P+'8/1000000)*'+c+'6*'+P+'19');
      }
      // CW Write = (CW/1M) * WritePrice * TotalReqs (0 for Gemini)
      if (isGemini) {
        n(c+'15', 0);
      } else {
        fm(c+'15', '('+P+'7/1000000)*'+c+'5*'+P+'19');
      }
      // Prompt = (P/1M) * Input * TotalReqs
      fm(c+'16', '('+P+'5/1000000)*'+c+'4*'+P+'19');
      // Output = (O/1M) * Output * TotalReqs
      fm(c+'17', '('+P+'6/1000000)*'+c+'7*'+P+'19');
    });

    // Row 19-22: Totals
    s('A19', '\u3010\u5408\u8A08\u3011');
    mods.forEach(function(o,i) { s(cols[i]+'19', o.m.name); });
    s('A20', 'USD \u5408\u8A08');
    s('A21', 'JPY \u5408\u8A08');
    s('A22', '1\u30EA\u30AF\u30A8\u30B9\u30C8\u5358\u4FA1 (JPY)');
    mods.forEach(function(o, i) {
      var c = cols[i];
      fm(c+'20', 'SUM('+c+'12:'+c+'17)');
      fm(c+'21', c+'20*'+P+'4');
      fm(c+'22', 'IF('+P+'19>0,'+c+'21/'+P+'19,0)');
    });

    // Row 24-29: Cache effect
    s('A24', '\u3010\u30AD\u30E3\u30C3\u30B7\u30E5\u52B9\u679C\u3011');
    mods.forEach(function(o,i) { s(cols[i]+'24', o.m.name); });
    s('A25', '\u30AD\u30E3\u30C3\u30B7\u30E5\u306A\u3057 (USD)');
    s('A26', '\u30AD\u30E3\u30C3\u30B7\u30E5\u3042\u308A (USD)');
    s('A27', '\u524A\u6E1B\u984D (USD)');
    s('A28', '\u524A\u6E1B\u984D (JPY)');
    s('A29', '\u524A\u6E1B\u7387');
    mods.forEach(function(o, i) {
      var c = cols[i];
      var isGemini = plat.name === 'Gemini';
      // No-cache = (CR + CW + P) / 1M * Input * TotalReqs + Output
      if (isGemini) {
        fm(c+'25', '(('+P+'9+'+P+'5)/1000000)*'+c+'4*'+P+'19+'+c+'17');
      } else {
        fm(c+'25', '(('+P+'8+'+P+'7+'+P+'5)/1000000)*'+c+'4*'+P+'19+'+c+'17');
      }
      fm(c+'26', c+'20');
      fm(c+'27', c+'25-'+c+'26');
      fm(c+'28', c+'27*'+P+'4');
      ws[c+'29'] = {t:'n', f:'IF('+c+'25>0,('+c+'25-'+c+'26)/'+c+'25,0)', z:'0.0%'};
    });

    // Remarks
    if (remarkCol) {
      s(remarkCol+'3', '\u5099\u8003');
      plat.remarks.forEach(function(r, i) { s(remarkCol+(4+i), r); });
      s(remarkCol+'14', 'Read = CR \u00D7 CachedInput (Gemini\u306FC)');
      s(remarkCol+'15', 'CW: \u30EA\u30AF\u30A8\u30B9\u30C8\u6BCE\u306E\u30AD\u30E3\u30C3\u30B7\u30E5\u66F8\u8FBC (Gemini\u306F0)');
      s(remarkCol+'25', '\u30AD\u30E3\u30C3\u30B7\u30E5\u672A\u4F7F\u7528: CR+CW+P\u3092Input\u4FA1\u683C\u3067\u8A08\u7B97');
    }

    // Track for summary
    mods.forEach(function(o, i) {
      summaryRefs.push({ name: o.m.name, sheet: plat.name, col: cols[i] });
    });

    // Sheet config
    ws['!ref'] = 'A1:'+(remarkCol||cols[cols.length-1])+'29';
    var cw = [{wch:28},{wch:2}];
    mods.forEach(function() { cw.push({wch:18}); });
    if (remarkCol) cw.push({wch:36});
    ws['!cols'] = cw;
    XLSX.utils.book_append_sheet(wb, ws, plat.name);
  });

  // ── サマリー sheet ──────────────────────
  var ss = {};
  function ss_s(a,v) { ss[a] = {t:'s', v:String(v)}; }
  function ss_f(a,f) { ss[a] = {t:'n', f:f}; }
  ss_s('A1', '\u5168\u30E2\u30C7\u30EB\u6BD4\u8F03\u30B5\u30DE\u30EA\u30FC');
  ss_s('A3', '\u30E2\u30C7\u30EB\u540D');
  ss_s('B3', 'USD \u5408\u8A08');
  ss_s('C3', 'JPY \u5408\u8A08');
  ss_s('D3', '1req\u5358\u4FA1 (JPY)');
  ss_s('E3', '\u524A\u6E1B\u7387');
  summaryRefs.forEach(function(ref, i) {
    var row = 4 + i;
    var sn = "'"+ref.sheet+"'!"+ref.col;
    ss_s('A'+row, ref.name);
    ss_f('B'+row, sn+'20');
    ss_f('C'+row, sn+'21');
    ss_f('D'+row, sn+'22');
    ss['E'+row] = {t:'n', f:sn+'29', z:'0.0%'};
  });
  ss['!ref'] = 'A1:E'+(3+summaryRefs.length);
  ss['!cols'] = [{wch:24},{wch:16},{wch:16},{wch:18},{wch:12}];
  XLSX.utils.book_append_sheet(wb, ss, '\u30B5\u30DE\u30EA\u30FC');

  // AgentCore Memory sheet — all-model comparison
  var ms = {};
  function ms_s(a,v) { ms[a] = {t:'s', v:String(v)}; }
  function ms_n(a,v) { ms[a] = {t:'n', v:Number(v)}; }
  function ms_f(a,formula) { ms[a] = {t:'n', f:formula}; }
  var mm = state.mem;
  var isFirstOnly = mm.ltmRetrievalTiming === 'first';
  var memMKeys = Object.keys(pricingData);
  var memMods = memMKeys.map(function(k) { return pricingData[k]; });
  // Column mapping: A=labels, B=params, C..M+=model columns for Override section
  var memCols = ['C','D','E','F','G','H','I','J','K','L','M','N','O'];
  ms_s('A1', 'AgentCore Memory \u30B3\u30B9\u30C8\u30B7\u30DF\u30E5\u30EC\u30FC\u30B7\u30E7\u30F3');

  // B4:B11 — Parameters
  ms_s('A3', '\u3010\u30D1\u30E9\u30E1\u30FC\u30BF\u30FC\u3011');
  var memParams = [
    ['\u70BA\u66FF\u30EC\u30FC\u30C8 (\u00A5/$)', state.exchangeRate],        // B4
    ['\u30E6\u30FC\u30B6\u30FC\u6570', mm.userCount],                     // B5
    ['\u30BB\u30C3\u30B7\u30E7\u30F3/\u30E6\u30FC\u30B6\u30FC/\u6708', mm.sessionsPerUser],   // B6
    ['\u30EA\u30AF\u30A8\u30B9\u30C8/\u30BB\u30C3\u30B7\u30E7\u30F3', mm.roundtripsPerSession],// B7
    ['LTM\u691C\u7D22/\u30EA\u30AF\u30A8\u30B9\u30C8', mm.retrievalsPerSession],  // B8
    ['LTM\u30EC\u30B3\u30FC\u30C9/\u30E6\u30FC\u30B6\u30FC', mm.recordsPerUser],      // B9
    ['STM\u30A4\u30D9\u30F3\u30C8/\u30EA\u30AF\u30A8\u30B9\u30C8', mm.stmEventsPerRequest || 2], // B10
    ['LTM\u691C\u7D22\u30BF\u30A4\u30DF\u30F3\u30B0 (1=\u521D\u56DE\u306E\u307F)', isFirstOnly ? 1 : 0], // B11
  ];
  memParams.forEach(function(row, i) { ms_s('A'+(4+i), row[0]); ms_n('B'+(4+i), row[1]); });
  ms_s('A12', 'Strategy'); ms_s('B12', mm.useOverrideStrategy ? 'Override' : 'Default');
  ms_s('A13', '\u62BD\u51FA\u5165\u529B\u30C8\u30FC\u30AF\u30F3');   ms_n('B13', mm.extractionInputTokens || 0);   // B13
  ms_s('A14', '\u62BD\u51FA\u51FA\u529B\u30C8\u30FC\u30AF\u30F3');   ms_n('B14', mm.extractionOutputTokens || 0);  // B14

  // B16:B19 — Unit prices (per 1000)
  ms_s('A16', '\u3010\u5358\u4FA1 ($/1000)\u3011');
  ms_s('A17', 'STM \u30A4\u30D9\u30F3\u30C8');              ms_n('B17', 0.25);  // B17
  ms_s('A18', 'LTM \u30B9\u30C8\u30EC\u30FC\u30B8 Default');    ms_n('B18', 0.75);  // B18
  ms_s('A19', 'LTM \u30B9\u30C8\u30EC\u30FC\u30B8 Override');   ms_n('B19', 0.25);  // B19
  ms_s('A20', 'LTM \u691C\u7D22');                  ms_n('B20', 0.50);  // B20

  // B22:B27 — Volumes (formulas)
  ms_s('A22', '\u3010\u30DC\u30EA\u30E5\u30FC\u30E0\u3011');
  ms_s('A23', '\u7DCF\u30BB\u30C3\u30B7\u30E7\u30F3');      ms_f('B23', 'B5*B6');
  ms_s('A24', '\u7DCF\u30EA\u30AF\u30A8\u30B9\u30C8');      ms_f('B24', 'B23*B7');
  ms_s('A25', 'STM \u30A4\u30D9\u30F3\u30C8\u6570');    ms_f('B25', 'B24*B10');
  ms_s('A26', 'LTM \u691C\u7D22\u6570');       ms_f('B26', 'IF(B11=1,B23*B8,B24*B8)');
  ms_s('A27', 'LTM \u30EC\u30B3\u30FC\u30C9\u6570');    ms_f('B27', 'B5*B9');

  // Row 29: Default cost breakdown (model-independent)
  ms_s('A29', '\u3010Default \u30B3\u30B9\u30C8\u5185\u8A33 (USD)\u3011');
  ms_s('A30', 'STM \u30A4\u30D9\u30F3\u30C8');      ms_f('B30', 'B25*B17/1000');
  ms_s('A31', 'LTM \u30B9\u30C8\u30EC\u30FC\u30B8');    ms_f('B31', 'B27*B18/1000');
  ms_s('A32', 'LTM \u691C\u7D22');         ms_f('B32', 'B26*B20/1000');
  ms_s('A33', 'Default \u5408\u8A08');     ms_f('B33', 'B30+B31+B32');

  // Row 35: Override cost — all models comparison
  ms_s('A35', '\u3010Override \u30B3\u30B9\u30C8\u5185\u8A33 \u2014 \u5168\u30E2\u30C7\u30EB\u6BD4\u8F03 (USD)\u3011');
  ms_s('A36', '');
  memMods.forEach(function(mod, i) { ms_s(memCols[i]+'36', mod.name); });
  // Row 37: LLM input price per model
  ms_s('A37', '\u62BD\u51FA\u5165\u529B\u5358\u4FA1 ($/MTok)');
  memMods.forEach(function(mod, i) { ms_n(memCols[i]+'37', mod.input); });
  // Row 38: LLM output price per model
  ms_s('A38', '\u62BD\u51FA\u51FA\u529B\u5358\u4FA1 ($/MTok)');
  memMods.forEach(function(mod, i) { ms_n(memCols[i]+'38', mod.output); });
  // Row 39: Base cost (STM + LTM Storage Override + LTM Retrieval) — shared
  ms_s('A39', 'Memory\u57FA\u672C\u30B3\u30B9\u30C8');
  ms_f('B39', 'B30+B27*B19/1000+B32');
  // Row 40: LLM extraction cost per model
  ms_s('A40', 'LLM \u62BD\u51FA\u30B3\u30B9\u30C8');
  memMods.forEach(function(mod, i) {
    var c = memCols[i];
    ms_f(c+'40', '($B$13/1000000*'+c+'37+$B$14/1000000*'+c+'38)*$B$24');
  });
  // Row 41: Override total per model
  ms_s('A41', 'Override \u5408\u8A08');
  memMods.forEach(function(mod, i) {
    var c = memCols[i];
    ms_f(c+'41', '$B$39+'+c+'40');
  });
  // Row 42: Override total JPY
  ms_s('A42', 'Override \u5408\u8A08 (JPY)');
  memMods.forEach(function(mod, i) {
    var c = memCols[i];
    ms_f(c+'42', c+'41*$B$4');
  });
  // Row 43: Difference vs Default
  ms_s('A43', 'Default\u3068\u306E\u5DEE\u984D (USD)');
  memMods.forEach(function(mod, i) {
    var c = memCols[i];
    ms_f(c+'43', '$B$33-'+c+'41');
  });

  // Row 45: Unit prices per model (Override)
  ms_s('A45', '\u3010\u5358\u4FA1 (Override)\u3011');
  ms_s('A46', '');
  memMods.forEach(function(mod, i) { ms_s(memCols[i]+'46', mod.name); });
  ms_s('A47', '1\u30EA\u30AF\u30A8\u30B9\u30C8\u5358\u4FA1 (USD)');
  memMods.forEach(function(mod, i) { ms_f(memCols[i]+'47', 'IF($B$24>0,'+memCols[i]+'41/$B$24,0)'); });
  ms_s('A48', '\u30BB\u30C3\u30B7\u30E7\u30F3\u5358\u4FA1 (USD)');
  memMods.forEach(function(mod, i) { ms_f(memCols[i]+'48', 'IF($B$23>0,'+memCols[i]+'41/$B$23,0)'); });
  ms_s('A49', '\u30E6\u30FC\u30B6\u30FC\u6708\u984D (USD)');
  memMods.forEach(function(mod, i) { ms_f(memCols[i]+'49', 'IF($B$5>0,'+memCols[i]+'41/$B$5,0)'); });
  ms_s('A50', '\u30E6\u30FC\u30B6\u30FC\u5E74\u984D (USD)');
  memMods.forEach(function(mod, i) { ms_f(memCols[i]+'50', memCols[i]+'49*12'); });

  // Sheet config
  var lastMemCol = memCols[memMods.length - 1] || 'M';
  ms['!ref'] = 'A1:' + lastMemCol + '50';
  var memColWidths = [{wch:32},{wch:16}];
  memMods.forEach(function() { memColWidths.push({wch:16}); });
  ms['!cols'] = memColWidths;
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
      paramGrid('sim', p) + modelSettingsSection('sim', p) +
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
      '<p class="mt-2 text-[11px] text-slate-400">* Claude Write\u306F\u4E0A\u4E57\u305B (5m:1.25x, 1h:2.0x)\u3002Gemini/OpenAI/Nova Write = Input\u3068\u540C\u984D\u3002Read = Input\u306E10% (Nova\u306F25%)\u3002' +
        '<a href="https://cloud.google.com/vertex-ai/generative-ai/pricing" target="_blank" class="text-blue-500 hover:underline ml-1">Vertex AI \u2197</a>' +
        '<a href="https://www.anthropic.com/pricing" target="_blank" class="text-blue-500 hover:underline ml-1">Anthropic \u2197</a>' +
        '<a href="https://openai.com/api/pricing/" target="_blank" class="text-blue-500 hover:underline ml-1">OpenAI \u2197</a>' +
        '<a href="https://aws.amazon.com/bedrock/pricing/" target="_blank" class="text-blue-500 hover:underline ml-1">Bedrock \u2197</a></p></section>';

    // Cost breakdown
    html += '<section class="mb-8"><div class="flex items-baseline gap-4 mb-3"><h2 class="text-sm font-semibold text-slate-700">\u30B3\u30B9\u30C8\u5185\u8A33 (\u00A5)</h2><span class="text-xs text-slate-400">\u7DCF\u30EA\u30AF\u30A8\u30B9\u30C8: ' + totalReqs.toLocaleString() + '</span></div>' +
      '<div class="overflow-x-auto border border-slate-200 rounded-lg"><table class="w-full text-sm"><thead><tr class="bg-slate-50 text-left"><th class="px-4 py-2.5 text-xs text-slate-500">\u8CBB\u76EE</th>' + modelHeaders(results) + '</tr></thead>' +
      '<tbody class="font-mono text-xs">' +
        [
          ['\u5165\u529B (Prompt)', 'prompt'],
          ['\u51FA\u529B (Output)', 'outputCost'],
          ['CW \u66F8\u8FBC', 'cwWrite'],
          ['CR \u8AAD\u8FBC', 'read'],
          ['Storage', 'storageCost'],
        ].map((pair, i) => {
          const label = pair[0], k = pair[1];
          let row = '<tr class="border-t border-slate-100"><td class="px-4 py-2 text-slate-500 font-sans">' + (i+1) + '. ' + label + '</td>' +
            results.map(r => {
              const v = r[k];
              if ((k === 'storageCost' || k === 'cwWrite') && v === 0) return '<td class="px-4 py-2 text-slate-400">\u2014</td>';
              return '<td class="px-4 py-2 ' + (k === 'storageCost' && v > 0 ? 'text-orange-600' : '') + '">&yen;' + fJ(v) + '</td>';
            }).join('') + '</tr>';
          return row;
        }).join('') +
        '<tr class="border-t-2 border-slate-300 bg-slate-50 font-semibold"><td class="px-4 py-3 font-sans font-semibold text-slate-700">\u5408\u8A08</td>' +
          results.map(r => '<td class="px-4 py-3 text-slate-900">&yen;' + fJ(r.total) + ' <span class="text-slate-400 font-normal text-[10px]">($' + fU(r.total) + ')</span></td>').join('') + '</tr>' +
        '<tr class="border-t border-slate-200"><td class="px-4 py-2 font-sans text-slate-500">1\u30EA\u30AF\u30A8\u30B9\u30C8\u5358\u4FA1</td>' +
          results.map(r => '<td class="px-4 py-2 font-semibold">&yen;' + fJ2(r.perReq) + '</td>').join('') + '</tr>' +
        '<tr class="border-t border-slate-100 bg-slate-50/30"><td class="px-4 py-2 font-sans text-[11px] text-slate-400">\u521D\u56DE\u30AD\u30E3\u30C3\u30B7\u30E5\u66F8\u8FBC (\u5408\u8A08\u5916)</td>' +
          results.map(r => '<td class="px-4 py-2 text-[11px] text-slate-400">&yen;' + fJ(r.ttlWrite) + ' <span class="text-slate-300">(' + r.writesPerDay + '\u56DE/\u65E5)</span></td>').join('') + '</tr>' +
      '</tbody></table></div></section>';

    // Cache effect
    html += '<section class="mb-8"><div class="flex items-baseline gap-3 mb-3"><h2 class="text-sm font-semibold text-slate-700">\u30AD\u30E3\u30C3\u30B7\u30E5\u52B9\u679C</h2></div>' +
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
      paramGrid('sc', sc) + modelSettingsSection('sc', sc) +
    '</section>';

    // Time series chart
    const series = computeTimeSeries(sc);
    html += '<section class="mb-8"><h2 class="text-sm font-semibold text-slate-700 mb-3">\u7D2F\u7A4D\u30B3\u30B9\u30C8\u63A8\u79FB (\u00A5)</h2>' +
      buildChart(series, sc.testDays, state.exchangeRate) +
    '</section>';

    // Daily cost summary
    const { results: scResults, totalReqs: scTotalReqs } = computeResults(sc);
    html += '<section class="mb-8"><div class="flex items-baseline gap-4 mb-3"><h2 class="text-sm font-semibold text-slate-700">\u30B7\u30CA\u30EA\u30AA\u7D50\u679C\u4E00\u89A7</h2><span class="text-xs text-slate-400">' + sc.testDays + '\u65E5\u9593 / ' + scTotalReqs.toLocaleString() + ' reqs</span><button onclick="downloadExcel()" class="ml-auto px-3 py-1.5 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors">Excel \u30C0\u30A6\u30F3\u30ED\u30FC\u30C9</button></div>' +
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

    // Cost breakdown — all-model comparison when Override, simple table when Default
    var er = mr.extractionResults;
    var nMod = er.length;
    if (m.useOverrideStrategy) {
      // Override: full model comparison table
      html += '<section class="mb-8"><h2 class="text-sm font-semibold text-slate-700 mb-3">\u30B3\u30B9\u30C8\u5185\u8A33 (\u6708\u984D) \u2014 \u5168\u30E2\u30C7\u30EB\u6BD4\u8F03</h2>' +
        '<div class="overflow-x-auto border border-slate-200 rounded-lg"><table class="w-full text-sm"><thead><tr class="bg-slate-50"><th class="px-3 py-2.5 text-xs text-slate-500 text-left">\u8CBB\u76EE</th>' +
        er.map(function(r) { return '<th class="px-3 py-2.5 text-xs font-semibold text-right" style="color:' + r.color + '">' + r.name + '</th>'; }).join('') +
        '</tr></thead><tbody class="font-mono text-xs">' +
        '<tr class="border-t border-slate-100"><td class="px-3 py-2 text-slate-600 font-sans">STM \u30A4\u30D9\u30F3\u30C8</td><td class="px-3 py-2 text-right" colspan="' + nMod + '">&yen;' + fJ(mr.stmCost) + ' <span class="text-slate-400 text-[10px]">(\u5168\u30E2\u30C7\u30EB\u5171\u901A)</span></td></tr>' +
        '<tr class="border-t border-slate-100"><td class="px-3 py-2 text-slate-600 font-sans">LTM \u30B9\u30C8\u30EC\u30FC\u30B8 (Override)</td><td class="px-3 py-2 text-right" colspan="' + nMod + '">&yen;' + fJ(mr.ltmStorageCostOverride) + ' <span class="text-slate-400 text-[10px]">(\u5168\u30E2\u30C7\u30EB\u5171\u901A)</span></td></tr>' +
        '<tr class="border-t border-slate-100"><td class="px-3 py-2 text-slate-600 font-sans">LTM \u691C\u7D22</td><td class="px-3 py-2 text-right" colspan="' + nMod + '">&yen;' + fJ(mr.ltmRetrievalCost) + ' <span class="text-slate-400 text-[10px]">(\u5168\u30E2\u30C7\u30EB\u5171\u901A)</span></td></tr>' +
        '<tr class="border-t border-slate-200 bg-amber-50/30"><td class="px-3 py-2 text-amber-700 font-sans font-semibold">LLM \u62BD\u51FA</td>' +
        er.map(function(r) { return '<td class="px-3 py-2 text-right">&yen;' + fJ(r.extractionCost) + '</td>'; }).join('') + '</tr>' +
        '<tr class="border-t-2 border-slate-300 bg-slate-50 font-semibold"><td class="px-3 py-3 font-sans text-slate-700">\u5408\u8A08</td>' +
        er.map(function(r) { return '<td class="px-3 py-3 text-right text-slate-900">&yen;' + fJ(r.totalCostOverride) + '</td>'; }).join('') + '</tr>' +
        '<tr class="border-t border-slate-200"><td class="px-3 py-2 font-sans text-slate-500">1\u30EA\u30AF\u30A8\u30B9\u30C8\u5358\u4FA1</td>' +
        er.map(function(r) { return '<td class="px-3 py-2 text-right">&yen;' + fJ2(r.perRequest) + '</td>'; }).join('') + '</tr>' +
        '<tr class="border-t border-slate-100"><td class="px-3 py-2 font-sans text-slate-500">\u30BB\u30C3\u30B7\u30E7\u30F3\u5358\u4FA1</td>' +
        er.map(function(r) { return '<td class="px-3 py-2 text-right">&yen;' + fJ2(r.perSession) + '</td>'; }).join('') + '</tr>' +
        '<tr class="border-t border-slate-100"><td class="px-3 py-2 font-sans text-slate-500">\u30E6\u30FC\u30B6\u30FC\u6708\u984D</td>' +
        er.map(function(r) { return '<td class="px-3 py-2 text-right">&yen;' + fJ2(r.perUserMonth) + '</td>'; }).join('') + '</tr>' +
        '<tr class="border-t border-slate-100"><td class="px-3 py-2 font-sans text-slate-500">\u30E6\u30FC\u30B6\u30FC\u5E74\u984D</td>' +
        er.map(function(r) { return '<td class="px-3 py-2 text-right">&yen;' + fJ2(r.perUserYear) + '</td>'; }).join('') + '</tr>' +
        '</tbody></table></div></section>';
    } else {
      // Default: no model dependency, simple table
      var fTd = '<td class="px-4 py-2 text-[10px] text-slate-400">';
      html += '<section class="mb-8"><h2 class="text-sm font-semibold text-slate-700 mb-3">\u30B3\u30B9\u30C8\u5185\u8A33 (\u6708\u984D)</h2>' +
        '<div class="overflow-x-auto border border-slate-200 rounded-lg"><table class="w-full text-sm">' +
        '<thead><tr class="bg-slate-50"><th class="px-4 py-2.5 text-xs text-slate-500 text-left">\u8CBB\u76EE</th><th class="px-4 py-2.5 text-xs text-slate-500 text-left">\u8A08\u7B97\u5F0F</th><th class="px-4 py-2.5 text-xs text-slate-500 text-right">USD</th><th class="px-4 py-2.5 text-xs text-slate-500 text-right">JPY</th><th class="px-4 py-2.5 text-xs text-slate-500 text-right">\u5272\u5408</th></tr></thead>' +
        '<tbody class="font-mono text-xs">' +
          '<tr class="border-t border-slate-100"><td class="px-4 py-2 text-slate-600 font-sans">STM \u30A4\u30D9\u30F3\u30C8</td>' + fTd + 'STM\u30A4\u30D9\u30F3\u30C8\u6570 \u00D7 \u5358\u4FA1/1K</td><td class="px-4 py-2 text-right">$' + fU(mr.stmCost) + '</td><td class="px-4 py-2 text-right">&yen;' + fJ(mr.stmCost) + '</td><td class="px-4 py-2 text-right text-slate-400">' + (mr.totalCost > 0 ? (mr.stmCost / mr.totalCost * 100).toFixed(1) : '0') + '%</td></tr>' +
          '<tr class="border-t border-slate-100"><td class="px-4 py-2 text-slate-600 font-sans">LTM \u30B9\u30C8\u30EC\u30FC\u30B8 (Default)</td>' + fTd + 'LTM\u30EC\u30B3\u30FC\u30C9\u6570 \u00D7 \u5358\u4FA1/1K</td><td class="px-4 py-2 text-right">$' + fU(mr.ltmStorageCost) + '</td><td class="px-4 py-2 text-right">&yen;' + fJ(mr.ltmStorageCost) + '</td><td class="px-4 py-2 text-right text-slate-400">' + (mr.totalCost > 0 ? (mr.ltmStorageCost / mr.totalCost * 100).toFixed(1) : '0') + '%</td></tr>' +
          '<tr class="border-t border-slate-100"><td class="px-4 py-2 text-slate-600 font-sans">LTM \u691C\u7D22</td>' + fTd + 'LTM\u691C\u7D22\u6570 \u00D7 \u5358\u4FA1/1K</td><td class="px-4 py-2 text-right">$' + fU(mr.ltmRetrievalCost) + '</td><td class="px-4 py-2 text-right">&yen;' + fJ(mr.ltmRetrievalCost) + '</td><td class="px-4 py-2 text-right text-slate-400">' + (mr.totalCost > 0 ? (mr.ltmRetrievalCost / mr.totalCost * 100).toFixed(1) : '0') + '%</td></tr>' +
          '<tr class="border-t-2 border-slate-300 bg-slate-50 font-semibold"><td class="px-4 py-3 font-sans text-slate-700">\u5408\u8A08</td><td></td><td class="px-4 py-3 text-right">$' + fU(mr.totalCost) + '</td><td class="px-4 py-3 text-right">&yen;' + fJ(mr.totalCost) + '</td><td class="px-4 py-3 text-right">100%</td></tr>' +
          '<tr class="border-t border-slate-200"><td class="px-4 py-2 font-sans text-slate-500">1\u30EA\u30AF\u30A8\u30B9\u30C8\u5358\u4FA1</td>' + fTd + '\u5408\u8A08 / \u7DCF\u30EA\u30AF\u30A8\u30B9\u30C8</td><td class="px-4 py-2 text-right">$' + mr.perRequest.toFixed(5) + '</td><td class="px-4 py-2 text-right">&yen;' + fJ2(mr.perRequest) + '</td><td></td></tr>' +
          '<tr class="border-t border-slate-100"><td class="px-4 py-2 font-sans text-slate-500">\u30BB\u30C3\u30B7\u30E7\u30F3\u5358\u4FA1</td>' + fTd + '\u5408\u8A08 / \u7DCF\u30BB\u30C3\u30B7\u30E7\u30F3</td><td class="px-4 py-2 text-right">$' + mr.perSession.toFixed(4) + '</td><td class="px-4 py-2 text-right">&yen;' + fJ2(mr.perSession) + '</td><td></td></tr>' +
          '<tr class="border-t border-slate-100"><td class="px-4 py-2 font-sans text-slate-500">\u30E6\u30FC\u30B6\u30FC\u6708\u984D</td>' + fTd + '\u5408\u8A08 / \u30E6\u30FC\u30B6\u30FC\u6570</td><td class="px-4 py-2 text-right">$' + mr.perUserMonth.toFixed(4) + '</td><td class="px-4 py-2 text-right">&yen;' + fJ2(mr.perUserMonth) + '</td><td></td></tr>' +
          '<tr class="border-t border-slate-100"><td class="px-4 py-2 font-sans text-slate-500">\u30E6\u30FC\u30B6\u30FC\u5E74\u984D</td>' + fTd + '\u30E6\u30FC\u30B6\u30FC\u6708\u984D \u00D7 12</td><td class="px-4 py-2 text-right">$' + mr.perUserYear.toFixed(4) + '</td><td class="px-4 py-2 text-right">&yen;' + fJ2(mr.perUserYear) + '</td><td></td></tr>' +
        '</tbody></table></div></section>';
    }

    // Donut chart + Override comparison
    var cheapest = er.reduce(function(a, b) { return a.totalCostOverride < b.totalCostOverride ? a : b; });
    html += '<section class="mb-8"><div class="grid grid-cols-1 lg:grid-cols-2 gap-8">' +
      '<div><h2 class="text-sm font-semibold text-slate-700 mb-3">\u30B3\u30B9\u30C8\u69CB\u6210' + (m.useOverrideStrategy ? ' <span class="text-xs font-normal text-slate-400">(\u6700\u5B89: ' + cheapest.name + ')</span>' : '') + '</h2>' +
        buildPieChart([
          { label: 'STM \u30A4\u30D9\u30F3\u30C8', value: mr.stmCost, color: '#3B82F6' },
          { label: 'LTM \u30B9\u30C8\u30EC\u30FC\u30B8', value: mr.ltmStorageCost, color: '#8B5CF6' },
          { label: 'LTM \u691C\u7D22', value: mr.ltmRetrievalCost, color: '#10B981' },
          ...(m.useOverrideStrategy ? [{ label: 'LLM \u62BD\u51FA (' + cheapest.name + ')', value: cheapest.extractionCost, color: '#F59E0B' }] : []),
        ]) +
      '</div>' +
      '<div><h2 class="text-sm font-semibold text-slate-700 mb-3">Override Strategy \u6BD4\u8F03 \u2014 \u5168\u30E2\u30C7\u30EB</h2>' +
        '<div class="border border-slate-200 rounded-lg overflow-hidden overflow-x-auto"><table class="w-full text-sm">' +
        '<thead><tr class="bg-slate-50"><th class="px-3 py-2.5 text-xs text-slate-500 text-left"></th>' +
        er.map(function(r) { return '<th class="px-2 py-2.5 text-[10px] font-semibold text-right" style="color:' + r.color + '">' + r.name + '</th>'; }).join('') +
        '</tr></thead>' +
        '<tbody class="font-mono text-[11px]">' +
          '<tr class="border-t border-slate-100"><td class="px-3 py-2 text-slate-600 font-sans">Default\u5408\u8A08</td><td class="px-2 py-2 text-right" colspan="' + nMod + '">&yen;' + fJ(mr.totalCostDefault) + '</td></tr>' +
          '<tr class="border-t border-slate-100"><td class="px-3 py-2 text-slate-600 font-sans">Override\u5408\u8A08</td>' +
          er.map(function(r) { return '<td class="px-2 py-2 text-right">&yen;' + fJ(r.totalCostOverride) + '</td>'; }).join('') + '</tr>' +
          '<tr class="border-t border-slate-200 bg-slate-50 font-semibold"><td class="px-3 py-2 font-sans text-slate-700">\u5DEE\u984D</td>' +
          er.map(function(r) {
            var diff = mr.totalCostDefault - r.totalCostOverride;
            return '<td class="px-2 py-2 text-right ' + (diff >= 0 ? 'text-green-600' : 'text-red-500') + '">' + (diff >= 0 ? '&yen;' + fJ(diff) : '+&yen;' + fJ(-diff)) + '</td>';
          }).join('') + '</tr>' +
        '</tbody></table></div>' +
      '</div></div></section>';

    // Preset comparison table (Default strategy only — Override comparison is in the section above)
    const presetResults = memoryPresets.map(p => ({ preset: p, result: computeMemoryResults({
      ...p,
      stmEventsPerRequest: m.stmEventsPerRequest || 2,
      ltmRetrievalTiming: m.ltmRetrievalTiming || 'every',
      extractionEnabled: false,
      extractionInputTokens: m.extractionInputTokens,
      extractionOutputTokens: m.extractionOutputTokens,
    }) }));
    html += '<section class="mb-8"><h2 class="text-sm font-semibold text-slate-700 mb-3">\u898F\u6A21\u5225\u30B7\u30DF\u30E5\u30EC\u30FC\u30B7\u30E7\u30F3\u6BD4\u8F03 <span class="text-xs font-normal text-slate-400">(Default Strategy)</span></h2>' +
      '<div class="overflow-x-auto border border-slate-200 rounded-lg"><table class="w-full text-sm">' +
      '<thead><tr class="bg-slate-50"><th class="px-4 py-2.5 text-xs text-slate-500 text-left">\u9805\u76EE</th>' +
      presetResults.map(pr => '<th class="px-4 py-2.5 text-xs text-slate-500 text-right">' + pr.preset.name + '<br><span class="font-normal text-slate-400">' + pr.preset.desc + '</span></th>').join('') +
      '</tr></thead>' +
      '<tbody class="text-xs">' +
        '<tr class="border-t border-slate-100 bg-slate-50/50"><td colspan="' + (presetResults.length + 1) + '" class="px-4 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">\u30D1\u30E9\u30E1\u30FC\u30BF</td></tr>' +
        '<tr class="border-t border-slate-100"><td class="px-4 py-1.5 text-slate-600">\u30E6\u30FC\u30B6\u30FC\u6570</td>' + presetResults.map(pr => '<td class="px-4 py-1.5 text-right font-mono">' + pr.preset.userCount.toLocaleString() + '</td>').join('') + '</tr>' +
        '<tr class="border-t border-slate-100"><td class="px-4 py-1.5 text-slate-600">\u30BB\u30C3\u30B7\u30E7\u30F3/\u30E6\u30FC\u30B6\u30FC</td>' + presetResults.map(pr => '<td class="px-4 py-1.5 text-right font-mono">' + pr.preset.sessionsPerUser + '</td>').join('') + '</tr>' +
        '<tr class="border-t border-slate-100"><td class="px-4 py-1.5 text-slate-600">\u30EA\u30AF\u30A8\u30B9\u30C8/\u30BB\u30C3\u30B7\u30E7\u30F3</td>' + presetResults.map(pr => '<td class="px-4 py-1.5 text-right font-mono">' + pr.preset.roundtripsPerSession + '</td>').join('') + '</tr>' +
        '<tr class="border-t border-slate-100"><td class="px-4 py-1.5 text-slate-600">LTM\u691C\u7D22/\u30EA\u30AF\u30A8\u30B9\u30C8</td>' + presetResults.map(pr => '<td class="px-4 py-1.5 text-right font-mono">' + pr.preset.retrievalsPerSession + '</td>').join('') + '</tr>' +
        '<tr class="border-t border-slate-100"><td class="px-4 py-1.5 text-slate-600">LTM\u30EC\u30B3\u30FC\u30C9/\u30E6\u30FC\u30B6\u30FC</td>' + presetResults.map(pr => '<td class="px-4 py-1.5 text-right font-mono">' + pr.preset.recordsPerUser + '</td>').join('') + '</tr>' +
        '<tr class="border-t border-slate-100 bg-slate-50/50"><td colspan="' + (presetResults.length + 1) + '" class="px-4 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">\u6708\u9593\u30DC\u30EA\u30E5\u30FC\u30E0</td></tr>' +
        '<tr class="border-t border-slate-100"><td class="px-4 py-1.5 text-slate-600">\u7DCF\u30EA\u30AF\u30A8\u30B9\u30C8</td>' + presetResults.map(pr => '<td class="px-4 py-1.5 text-right font-mono">' + pr.result.totalRoundtrips.toLocaleString() + '</td>').join('') + '</tr>' +
        '<tr class="border-t border-slate-100"><td class="px-4 py-1.5 text-slate-600">STM\u30A4\u30D9\u30F3\u30C8</td>' + presetResults.map(pr => '<td class="px-4 py-1.5 text-right font-mono">' + pr.result.totalEvents.toLocaleString() + '</td>').join('') + '</tr>' +
        '<tr class="border-t border-slate-100"><td class="px-4 py-1.5 text-slate-600">LTM\u691C\u7D22</td>' + presetResults.map(pr => '<td class="px-4 py-1.5 text-right font-mono">' + pr.result.totalRetrievals.toLocaleString() + '</td>').join('') + '</tr>' +
        '<tr class="border-t border-slate-100 bg-slate-50/50"><td colspan="' + (presetResults.length + 1) + '" class="px-4 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">\u6708\u984D\u30B3\u30B9\u30C8 (Default Strategy)</td></tr>' +
        '<tr class="border-t border-slate-100"><td class="px-4 py-1.5 text-slate-600">STM\u30A4\u30D9\u30F3\u30C8</td>' + presetResults.map(pr => '<td class="px-4 py-1.5 text-right font-mono">&yen;' + fJ(pr.result.stmCost) + '</td>').join('') + '</tr>' +
        '<tr class="border-t border-slate-100"><td class="px-4 py-1.5 text-slate-600">LTM\u30B9\u30C8\u30EC\u30FC\u30B8</td>' + presetResults.map(pr => '<td class="px-4 py-1.5 text-right font-mono">&yen;' + fJ(pr.result.ltmStorageCostDefault) + '</td>').join('') + '</tr>' +
        '<tr class="border-t border-slate-100"><td class="px-4 py-1.5 text-slate-600">LTM\u691C\u7D22</td>' + presetResults.map(pr => '<td class="px-4 py-1.5 text-right font-mono">&yen;' + fJ(pr.result.ltmRetrievalCost) + '</td>').join('') + '</tr>' +
        '<tr class="border-t-2 border-slate-300 bg-slate-50 font-semibold"><td class="px-4 py-2 text-slate-700">\u5408\u8A08</td>' + presetResults.map(pr => '<td class="px-4 py-2 text-right font-mono">&yen;' + fJ(pr.result.totalCostDefault) + '</td>').join('') + '</tr>' +
        '<tr class="border-t border-slate-100 bg-slate-50/50"><td colspan="' + (presetResults.length + 1) + '" class="px-4 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">\u5358\u4FA1</td></tr>' +
        '<tr class="border-t border-slate-100"><td class="px-4 py-1.5 text-slate-600">1\u30EA\u30AF\u30A8\u30B9\u30C8\u5358\u4FA1</td>' + presetResults.map(pr => '<td class="px-4 py-1.5 text-right font-mono">&yen;' + fJ2(pr.result.perRequest) + '</td>').join('') + '</tr>' +
        '<tr class="border-t border-slate-100"><td class="px-4 py-1.5 text-slate-600">\u30E6\u30FC\u30B6\u30FC\u6708\u984D</td>' + presetResults.map(pr => '<td class="px-4 py-1.5 text-right font-mono">&yen;' + fJ2(pr.result.perUserMonth) + '</td>').join('') + '</tr>' +
        '<tr class="border-t border-slate-100"><td class="px-4 py-1.5 text-slate-600">\u30E6\u30FC\u30B6\u30FC\u5E74\u984D</td>' + presetResults.map(pr => '<td class="px-4 py-1.5 text-right font-mono">&yen;' + fJ2(pr.result.perUserYear) + '</td>').join('') + '</tr>' +
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
    if (el.type === 'checkbox') {
      el.addEventListener('change', (e) => {
        const pfx = e.target.dataset.prefix;
        const target = pfx === 'sim' ? state.sim : pfx === 'mem' ? state.mem : state.scenarios[state.activeScenario];
        target[e.target.dataset.key] = e.target.checked;
        render();
      });
    } else {
      el.addEventListener('input', (e) => {
        if (e.target.value === '' || isNaN(Number(e.target.value))) return;
        const pfx = e.target.dataset.prefix;
        const target = pfx === 'sim' ? state.sim : pfx === 'mem' ? state.mem : state.scenarios[state.activeScenario];
        target[e.target.dataset.key] = Number(e.target.value);
        debouncedRender(e.target.dataset.key, pfx);
      });
    }
  });
  // Option buttons
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
