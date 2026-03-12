# AI Cost Strategy Simulator

Gemini / Claude / OpenAI / Amazon Nova の11モデルにおけるコンテキストキャッシュ利用時のコストを比較するシミュレーターです。

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
| `calculation_logic.md` | 計算ロジック詳細 |

## 単価の更新

`pricing.json` を編集してサーバーを再起動すれば反映されます。

```jsonc
{
  "gemini25Flash": {
    "name": "Gemini 2.5 Flash",
    "input": 0.30,         // 通常入力 ($/MTok)
    "cacheWrite5m": 0.30,  // 書き込み 5分TTL ($/MTok)
    "cacheWrite1h": 0.30,  // 書き込み 1時間TTL ($/MTok)
    "cachedInput": 0.03,   // キャッシュ読み出し ($/MTok)
    "output": 2.50,        // 出力 ($/MTok)
    "storage": 1.00,       // 保管料 ($/MTok/時間)
    ...
  }
}
```

## パラメーター

APIログの実測値をそのまま入力できる設計です。

| パラメーター | 説明 |
|---|---|
| 入力トークン/req (P) | 1リクエストあたりの入力トークン数 |
| 出力トークン/req (O) | 1リクエストあたりの出力トークン数 |
| キャッシュ書込/req (CW) | 1リクエストあたりのキャッシュ書込トークン数（差分） |
| キャッシュ読込/req (CR) | 1リクエストあたりのキャッシュ読込トークン数 |
| 初回キャッシュ書込 (C) | 単発のキャッシュ書込トークン数（システムプロンプト等） |
| 利用者数 (U) | ユーザー数 |
| 回数/ユーザー (N) | 1ユーザーあたりのリクエスト回数 |
| テスト日数 (D) | 運用期間 |

## コスト計算（5費目 + 参考値）

合計に含まれる5費目：

1. **CW 書込** - リクエスト毎の差分書込（CW × WritePrice × TotalReqs）
2. **CR 読込** - キャッシュ読込（CR × CachedInputPrice × TotalReqs）
3. **入力** - 非キャッシュ入力（P × InputPrice × TotalReqs）
4. **出力** - モデル出力（O × OutputPrice × TotalReqs）
5. **Storage** - 保管料（Geminiのみ、C × StoragePrice × Hours）

参考値（合計外）：

- **初回キャッシュ書込** - TTL切れ時にCを再書込（C × WritePrice × wpd × D）※共有キャッシュ

詳細は [calculation_logic.md](calculation_logic.md) を参照。

## 出典

- [Vertex AI Pricing](https://cloud.google.com/vertex-ai/generative-ai/pricing)
- [Anthropic Pricing](https://www.anthropic.com/pricing)
- [OpenAI API Pricing](https://openai.com/api/pricing/)
- [Amazon Bedrock Pricing](https://aws.amazon.com/bedrock/pricing/)

2026年2月時点の公式価格を反映。
