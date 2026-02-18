/**
 * Generate Excel spreadsheet from simulator data
 * Usage: deno run --allow-write --allow-read generate_excel.ts
 */
import * as XLSX from "npm:xlsx@0.18.5";

const wb = XLSX.utils.book_new();

const rows: (string | number | { f: string })[][] = [
  ["AI Cost Strategy Simulator"],
  [],
  ["■ パラメーター", "値"],
  ["為替レート (USD/JPY)", 155],
  ["初期キャッシュ量 C (tokens)", 50000],
  ["再利用ヒット量 R (tokens)", 50000],
  ["新規プロンプト P (tokens)", 7000],
  ["回答トークン O (tokens)", 2000],
  ["利用者数 U (人)", 2500],
  ["回数/ユーザー N", 10],
  ["テスト日数 D (日)", 7],
  ["Gemini保持時間 (h/日)", 24],
  ["共有=1 / 個別=0", 1],
  ["Claude Write 5m=1 / 1h=2", 2],
  [],
  ["■ 導出値"],
  ["総リクエスト数", { f: "B9*B10" }],
  ["総保管時間 (h)", { f: "B12*B11" }],
  ["スケール倍率", { f: "IF(B13=1,1,B9)" }],
  [],
  ["■ 単価 ($/MTok)", "", "Gemini 2.5 Flash", "Gemini 3.0 Flash", "Claude Haiku 4.5"],
  ["通常入力 (Input)", "", 0.30, 0.50, 1.00],
  ["書き込み (Write)", "", 0.30, 0.50, { f: "IF($B$14=1,1.25,2.00)" }],
  ["再利用 (Read)", "", 0.03, 0.05, 0.10],
  ["出力 (Output)", "", 2.50, 3.00, 5.00],
  ["保管料 ($/MTok/h)", "", 1.00, 1.00, 0],
  [],
  ["■ コスト内訳 (USD)", "", "Gemini 2.5 Flash", "Gemini 3.0 Flash", "Claude Haiku 4.5", "備考"],
  [
    "1. Write (キャッシュ作成)", "",
    { f: "($B$5/1000000)*C23*$B$11*$B$19" },
    { f: "($B$5/1000000)*D23*$B$11*$B$19" },
    { f: "($B$5/1000000)*E23*$B$11*$B$19" },
    "C/1M × Write単価 × D日 × 倍率",
  ],
  [
    "2. Storage (保管料)", "",
    { f: "($B$5/1000000)*C26*$B$18*$B$19" },
    { f: "($B$5/1000000)*D26*$B$18*$B$19" },
    { f: "($B$5/1000000)*E26*$B$18*$B$19" },
    "C/1M × Storage単価 × 総時間 × 倍率",
  ],
  [
    "3. Read (キャッシュ再利用)", "",
    { f: "($B$6/1000000)*C24*$B$17" },
    { f: "($B$6/1000000)*D24*$B$17" },
    { f: "($B$6/1000000)*E24*$B$17" },
    "R/1M × Read単価 × 総リクエスト",
  ],
  [
    "4. Prompt (新規入力)", "",
    { f: "($B$7/1000000)*C22*$B$17" },
    { f: "($B$7/1000000)*D22*$B$17" },
    { f: "($B$7/1000000)*E22*$B$17" },
    "P/1M × Input単価 × 総リクエスト",
  ],
  [
    "5. Output (出力)", "",
    { f: "($B$8/1000000)*C25*$B$17" },
    { f: "($B$8/1000000)*D25*$B$17" },
    { f: "($B$8/1000000)*E25*$B$17" },
    "O/1M × Output単価 × 総リクエスト",
  ],
  [],
  [
    "合計 (USD)", "",
    { f: "SUM(C29:C33)" },
    { f: "SUM(D29:D33)" },
    { f: "SUM(E29:E33)" },
  ],
  [
    "合計 (JPY)", "",
    { f: "C35*$B$4" },
    { f: "D35*$B$4" },
    { f: "E35*$B$4" },
  ],
  [],
  ["■ 1リクエスト単価の分解", "", "Gemini 2.5 Flash", "Gemini 3.0 Flash", "Claude Haiku 4.5", "備考"],
  [
    "固定費合計 (Write+Storage)", "",
    { f: "C29+C30" }, { f: "D29+D30" }, { f: "E29+E30" },
    "リクエスト数に依存しない",
  ],
  [
    "従量費合計 (Read+Prompt+Output)", "",
    { f: "C31+C32+C33" }, { f: "D31+D32+D33" }, { f: "E31+E32+E33" },
    "リクエスト数に比例",
  ],
  [
    "固定費按分/1req (USD)", "",
    { f: "C39/$B$17" }, { f: "D39/$B$17" }, { f: "E39/$B$17" },
    "← リクエスト数で変動する部分",
  ],
  [
    "従量費/1req (USD)", "",
    { f: "C40/$B$17" }, { f: "D40/$B$17" }, { f: "E40/$B$17" },
    "← リクエスト数に関係なく一定",
  ],
  [
    "合成単価/1req (USD)", "",
    { f: "C41+C42" }, { f: "D41+D42" }, { f: "E41+E42" },
  ],
  [
    "合成単価/1req (JPY)", "",
    { f: "C43*$B$4" }, { f: "D43*$B$4" }, { f: "E43*$B$4" },
  ],
  [],
  ["■ キャッシュ効果", "", "Gemini 2.5 Flash", "Gemini 3.0 Flash", "Claude Haiku 4.5"],
  [
    "キャッシュなし合計 (USD)", "",
    { f: "(($B$6+$B$7)/1000000)*C22*$B$17+C33" },
    { f: "(($B$6+$B$7)/1000000)*D22*$B$17+D33" },
    { f: "(($B$6+$B$7)/1000000)*E22*$B$17+E33" },
  ],
  [
    "削減額 (USD)", "",
    { f: "C47-C35" }, { f: "D47-D35" }, { f: "E47-E35" },
  ],
  [
    "削減率 (%)", "",
    { f: "C48/C47*100" }, { f: "D48/D47*100" }, { f: "E48/E47*100" },
  ],
  [
    "削減額 (JPY)", "",
    { f: "C48*$B$4" }, { f: "D48*$B$4" }, { f: "E48*$B$4" },
  ],
];

const ws = XLSX.utils.aoa_to_sheet(rows);

// Column widths
ws["!cols"] = [
  { wch: 32 }, // A
  { wch: 12 }, // B
  { wch: 18 }, // C
  { wch: 18 }, // D
  { wch: 18 }, // E
  { wch: 30 }, // F
];

XLSX.utils.book_append_sheet(wb, ws, "シミュレーター");
XLSX.writeFile(wb, "price_simulator.xlsx");
console.log("Generated: price_simulator.xlsx");
