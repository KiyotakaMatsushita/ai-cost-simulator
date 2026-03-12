/**
 * Generate Excel spreadsheet from simulator data (multi-sheet version)
 * Usage: deno run --allow-write --allow-read generate_excel.ts
 */
import * as XLSX from "npm:xlsx@0.18.5";

const wb = XLSX.utils.book_new();

// ── パラメーター sheet ──
const paramRows: (string | number | { f: string })[][] = [
  ["AI Cost Strategy Simulator — パラメーター"],
  [],
  ["【パラメーター】", "値", "", "備考"],
  ["為替レート (USD/JPY)", 155],
  ["初期キャッシュ量 C (tokens)", 50000],
  ["再利用ヒット量 R (tokens)", 50000],
  ["新規プロンプト P (tokens)", 7000],
  ["回答トークン O (tokens)", 2000],
  ["利用者数 U (人)", 2500],
  ["回数/ユーザー N", 10],
  ["テスト日数 D (日)", 7],
  ["Gemini保持時間 (h/日)", 24],
  ["共有=1 / 個別=0", 1, "", "1=全ユーザー共有, 0=ユーザー毎に個別"],
  ["Claude Write TTL (1=1h, 0=5m)", 1, "", "1=1時間TTL, 0=5分TTL"],
  [],
  ["【導出値】"],
  ["総リクエスト数", { f: "B9*B10" }],
  ["総保管時間 (h)", { f: "B12*B11" }],
  ["スケール倍率", { f: "IF(B13=1,1,B9)" }, "", "共有=1, 個別=ユーザー数"],
];
const ps = XLSX.utils.aoa_to_sheet(paramRows);
ps["!cols"] = [{ wch: 32 }, { wch: 12 }, { wch: 2 }, { wch: 40 }];
XLSX.utils.book_append_sheet(wb, ps, "パラメーター");

const P = "'パラメーター'!$B$";

// ── Gemini sheet ── (Write=Input, Storage課金あり, 書込1回/日)
const geminiRows: (string | number | { f: string })[][] = [
  ["Gemini (Vertex AI)"],
  [],
  ["【単価 ($/MTok)】", "", "Gemini 2.5 Flash", "Gemini 3.0 Flash", "", "備考"],
  ["入力 (Input)", "", 0.30, 0.50, "", "永続キャッシュ → 書込1回/日"],
  ["書込 (Write)", "", 0.30, 0.50, "", "Storage課金あり"],
  ["再利用 (Cached Read)", "", 0.03, 0.05],
  ["出力 (Output)", "", 2.50, 3.00],
  ["保管 (Storage/h)", "", 1.00, 1.00],
  ["書込回数/日", "", 1, 1],
  [],
  ["【コスト内訳 (USD)】", "", "Gemini 2.5 Flash", "Gemini 3.0 Flash", "", "備考"],
  ["Write (キャッシュ作成)", "", { f: `(${P}5/1000000)*C5*C9*${P}11*${P}19` }, { f: `(${P}5/1000000)*D5*D9*${P}11*${P}19` }, "", "C/1M × Write × wpd × D × 倍率"],
  ["Storage (保管料)", "", { f: `(${P}5/1000000)*C8*${P}18*${P}19` }, { f: `(${P}5/1000000)*D8*${P}18*${P}19` }, "", "C/1M × Storage × 総時間 × 倍率"],
  ["Read (キャッシュ再利用)", "", { f: `(${P}6/1000000)*C6*${P}17` }, { f: `(${P}6/1000000)*D6*${P}17` }, "", "R/1M × Read単価 × 総リクエスト"],
  ["Prompt (新規入力)", "", { f: `(${P}7/1000000)*C4*${P}17` }, { f: `(${P}7/1000000)*D4*${P}17` }, "", "P/1M × Input単価 × 総リクエスト"],
  ["Output (出力)", "", { f: `(${P}8/1000000)*C7*${P}17` }, { f: `(${P}8/1000000)*D7*${P}17` }, "", "O/1M × Output単価 × 総リクエスト"],
  [],
  ["【合計】", "", "Gemini 2.5 Flash", "Gemini 3.0 Flash"],
  ["USD 合計", "", { f: "SUM(C12:C16)" }, { f: "SUM(D12:D16)" }],
  ["JPY 合計", "", { f: `C19*${P}4` }, { f: `D19*${P}4` }],
  ["1リクエスト単価 (JPY)", "", { f: `IF(${P}17>0,C20/${P}17,0)` }, { f: `IF(${P}17>0,D20/${P}17,0)` }],
  [],
  ["【キャッシュ効果】", "", "Gemini 2.5 Flash", "Gemini 3.0 Flash"],
  ["キャッシュなし (USD)", "", { f: `((${P}6+${P}7)/1000000)*C4*${P}17+C16` }, { f: `((${P}6+${P}7)/1000000)*D4*${P}17+D16` }],
  ["キャッシュあり (USD)", "", { f: "C19" }, { f: "D19" }],
  ["削減額 (USD)", "", { f: "C24-C25" }, { f: "D24-D25" }],
  ["削減率 (%)", "", { f: "IF(C24>0,C26/C24*100,0)" }, { f: "IF(D24>0,D26/D24*100,0)" }],
];
const gs = XLSX.utils.aoa_to_sheet(geminiRows);
gs["!cols"] = [{ wch: 28 }, { wch: 2 }, { wch: 18 }, { wch: 18 }, { wch: 2 }, { wch: 36 }];
XLSX.utils.book_append_sheet(wb, gs, "Gemini");

// ── Claude sheet ── (Write=TTL条件分岐, Storage課金なし)
const claudeRows: (string | number | { f: string })[][] = [
  ["Claude (Anthropic)"],
  [],
  ["【単価 ($/MTok)】", "", "Claude Haiku 4.5", "", "備考"],
  ["入力 (Input)", "", 1.00, "", "TTLに応じてWrite単価切替"],
  ["書込 (Write)", "", { f: `IF(${P}14=1,2.00,1.25)` }, "", "1h=2.00, 5m=1.25"],
  ["再利用 (Cached Read)", "", 0.10],
  ["出力 (Output)", "", 5.00],
  ["保管 (Storage/h)", "", 0, "", "Storage課金なし"],
  ["書込回数/日", "", 1],
  [],
  ["【コスト内訳 (USD)】", "", "Claude Haiku 4.5", "", "備考"],
  ["Write (キャッシュ作成)", "", { f: `(${P}5/1000000)*C5*C9*${P}11*${P}19` }, "", "C/1M × Write × wpd × D × 倍率"],
  ["Storage (保管料)", "", { f: `(${P}5/1000000)*C8*${P}18*${P}19` }, "", "常に0 (Claude課金なし)"],
  ["Read (キャッシュ再利用)", "", { f: `(${P}6/1000000)*C6*${P}17` }, "", "R/1M × Read単価 × 総リクエスト"],
  ["Prompt (新規入力)", "", { f: `(${P}7/1000000)*C4*${P}17` }, "", "P/1M × Input単価 × 総リクエスト"],
  ["Output (出力)", "", { f: `(${P}8/1000000)*C7*${P}17` }, "", "O/1M × Output単価 × 総リクエスト"],
  [],
  ["【合計】", "", "Claude Haiku 4.5"],
  ["USD 合計", "", { f: "SUM(C12:C16)" }],
  ["JPY 合計", "", { f: `C19*${P}4` }],
  ["1リクエスト単価 (JPY)", "", { f: `IF(${P}17>0,C20/${P}17,0)` }],
  [],
  ["【キャッシュ効果】", "", "Claude Haiku 4.5"],
  ["キャッシュなし (USD)", "", { f: `((${P}6+${P}7)/1000000)*C4*${P}17+C16` }],
  ["キャッシュあり (USD)", "", { f: "C19" }],
  ["削減額 (USD)", "", { f: "C24-C25" }],
  ["削減率 (%)", "", { f: "IF(C24>0,C26/C24*100,0)" }],
];
const cs = XLSX.utils.aoa_to_sheet(claudeRows);
cs["!cols"] = [{ wch: 28 }, { wch: 2 }, { wch: 18 }, { wch: 2 }, { wch: 36 }];
XLSX.utils.book_append_sheet(wb, cs, "Claude");

// ── サマリー sheet ──
const summaryRows: (string | number | { f: string })[][] = [
  ["全モデル比較サマリー"],
  [],
  ["モデル名", "USD 合計", "JPY 合計", "1req単価 (JPY)", "削減率 (%)"],
  ["Gemini 2.5 Flash", { f: "'Gemini'!C19" }, { f: "'Gemini'!C20" }, { f: "'Gemini'!C21" }, { f: "'Gemini'!C27" }],
  ["Gemini 3.0 Flash", { f: "'Gemini'!D19" }, { f: "'Gemini'!D20" }, { f: "'Gemini'!D21" }, { f: "'Gemini'!D27" }],
  ["Claude Haiku 4.5", { f: "'Claude'!C19" }, { f: "'Claude'!C20" }, { f: "'Claude'!C21" }, { f: "'Claude'!C27" }],
];
const ss = XLSX.utils.aoa_to_sheet(summaryRows);
ss["!cols"] = [{ wch: 24 }, { wch: 16 }, { wch: 16 }, { wch: 18 }, { wch: 12 }];
XLSX.utils.book_append_sheet(wb, ss, "サマリー");

XLSX.writeFile(wb, "price_simulator.xlsx");
console.log("Generated: price_simulator.xlsx");
