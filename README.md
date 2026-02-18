# AI Cost Strategy Simulator

Gemini 2.5 Flash / Gemini 3.0 Flash / Claude Haiku 4.5 のコンテキストキャッシュ利用時のコストを比較するシミュレーターです。

## 起動方法

```bash
deno run --allow-net --allow-read price_simulation_deno.ts
```

ブラウザで http://localhost:8000 を開いてください。

### 必要環境

- [Deno](https://deno.com/) v1.40+

## ファイル構成

| ファイル | 内容 |
|---|---|
| `price_simulation_deno.ts` | シミュレーター本体（HTTPサーバー + UI） |
| `pricing.json` | モデル別単価データ |

## 単価の更新

`pricing.json` を編集してサーバーを再起動すれば反映されます。

```jsonc
{
  "gemini25Flash": {
    "name": "Gemini 2.5 Flash",
    "input": 0.30,         // 通常入力 ($/MTok)
    "cachedInput": 0.03,   // キャッシュ読み出し ($/MTok)
    "output": 2.50,        // 出力 ($/MTok)
    "storage": 1.00,       // 保管料 ($/MTok/時間)
    ...
  }
}
```

## シミュレーション概要

### 計算する5つのコスト

1. **Write** - キャッシュ作成費（Gemini: 入力と同額 / Claude: 上乗せあり）
2. **Storage** - 保管料（Gemini: 時間課金 / Claude: 無料）
3. **Read** - キャッシュ再利用費（全モデル入力の10%）
4. **Prompt** - 新規入力費（通常入力単価）
5. **Output** - 出力費（固定単価）

### キャッシュモデル

- **共有 (Shared)** - 全ユーザーで1つのキャッシュ。保管料は固定。Gemini有利。
- **個別 (Personalized)** - ユーザーごとに専用キャッシュ。保管料がユーザー数に比例。Claude有利。

## 出典

- [Vertex AI Pricing](https://cloud.google.com/vertex-ai/generative-ai/pricing)
- [Anthropic Pricing](https://www.anthropic.com/pricing)

2026年2月時点の公式価格を反映。
