# AI コストシミュレーター 計算ロジック説明書

## 概要

本シミュレーターは、Gemini（2.5 Flash / 3 Flash / 3 Pro）、Claude（Haiku 4.5 / Sonnet 4.5 / Opus 4.5）、OpenAI（GPT-5 Mini / GPT-5）、Amazon Nova（Micro / Lite / Pro）の11モデルにおいて、**コンテキストキャッシュを利用した場合**の運用コストを比較するツールです。

---

## 入力パラメーター

APIログの実測値（`input_tokens`, `output_tokens`, `cache_creation_input_tokens`, `cache_read_input_tokens`）をそのまま入力できる設計です。

| 記号 | パラメーター名 | デフォルト値 | 説明 |
|------|---------------|-------------|------|
| P | 入力トークン/req | 3,000 tokens | 1リクエストあたりの入力トークン数（非キャッシュ部分） |
| O | 出力トークン/req | 1,000 tokens | 1リクエストあたりの出力トークン数 |
| CW | キャッシュ書込/req | 5,000 tokens | 1リクエストあたりのキャッシュ書込トークン数（差分。TTL内の場合の`cache_creation_input_tokens`） |
| CR | キャッシュ読込/req | 10,000 tokens | 1リクエストあたりのキャッシュ読込トークン数（`cache_read_input_tokens`） |
| C | 初回キャッシュ書込 | 15,000 tokens | 単発のキャッシュ書込トークン数（システムプロンプト等。TTL切れ時に再書込される） |
| U | 利用者数 | 1,000 人 | テスト対象のユーザー数 |
| N | 回数/ユーザー | 10 回 | 1ユーザーあたりのリクエスト回数 |
| D | テスト日数 | 7 日 | 運用期間 |
| h | 稼働時間/日 | 24 時間 | 1日あたりのサービス稼働時間（Gemini Storage計算 + TTL判定に使用） |

### モデル別設定

| 設定 | 説明 |
|------|------|
| Claude Write TTL | 5分 or 1時間。Write単価に影響（5m: Input×1.25, 1h: Input×2.0） |
| Claude 書込回数/日 | 0=自動計算、>0=手動指定。TTL切れによるキャッシュ再作成の頻度 |

### 導出値

| 値 | 計算式 | 説明 |
|----|--------|------|
| 総リクエスト数 | `U × N` | 全ユーザーの合計リクエスト数 |
| 総保管時間 | `h × D` | キャッシュの累計保管時間 |

---

## 単価データ（2026年2月時点の公式価格）

### USD / 100万トークン

| 費目 | Gemini 2.5 Flash | Gemini 3 Flash | Gemini 3 Pro | Claude Haiku 4.5 | Claude Sonnet 4.5 | Claude Opus 4.5 | GPT-5 Mini | GPT-5 | Nova Micro | Nova Lite | Nova Pro |
|------|------------------|----------------|--------------|------------------|-------------------|-----------------|------------|-------|------------|-----------|----------|
| 通常入力 (Input) | $0.30 | $0.50 | $2.00 | $1.00 | $3.00 | $5.00 | $0.25 | $1.25 | $0.035 | $0.06 | $0.80 |
| 書き込み (Write) | $0.30 | $0.50 | $2.00 | $1.25/$2.00 | $3.75/$6.00 | $6.25/$10.00 | $0.25 | $1.25 | $0.035 | $0.06 | $0.80 |
| 再利用 (Read) | $0.03 | $0.05 | $0.20 | $0.10 | $0.30 | $0.50 | $0.025 | $0.125 | $0.00875 | $0.015 | $0.20 |
| 出力 (Output) | $2.50 | $3.00 | $12.00 | $5.00 | $15.00 | $25.00 | $2.00 | $10.00 | $0.14 | $0.24 | $3.20 |
| 保管料 (Storage) | $1.00/h | $1.00/h | $4.50/h | 無料 | 無料 | 無料 | 無料 | 無料 | 無料 | 無料 | 無料 |

### 出典

- Gemini: [Vertex AI Pricing](https://cloud.google.com/vertex-ai/generative-ai/pricing)
- Claude: [Anthropic Pricing](https://www.anthropic.com/pricing)
- OpenAI: [OpenAI API Pricing](https://openai.com/api/pricing/)
- Nova: [Amazon Bedrock Pricing](https://aws.amazon.com/bedrock/pricing/)

### 課金モデルの違い

- **Gemini**: 書き込みは入力と同額（上乗せなし）。代わりに保管料が時間単位で発生。永続キャッシュ（明示削除まで保持）。共有キャッシュ（全ユーザーで1つ）。
- **Claude**: 書き込みに上乗せ（5分TTL: 1.25倍、1時間TTL: 2.0倍）。保管料は無料。TTL内にリクエストがあればキャッシュが自動延長される（sliding window）。個別キャッシュ（ユーザーごと）。
- **OpenAI**: 書き込みは入力と同額（上乗せなし）。保管料も無料。自動キャッシュ（約5分TTL）で、明示的なキャッシュ作成は不要。個別キャッシュ。
- **Nova**: 書き込みは入力と同額（上乗せなし）。保管料は無料。5分TTLのsliding window方式。個別キャッシュ。

---

## 計算式（6費目）

### 1. キャッシュ再作成費（Cache Re-creation Cost）

TTL切れのたびにシステムプロンプト（C）を再書込するコスト。

```
Gemini:   Cache Re-creation = (C / 1M) × WritePrice × 1          （永続キャッシュ、1回のみ）
その他:   Cache Re-creation = (C / 1M) × WritePrice × wpd × D     （TTL切れで再作成、共有キャッシュ）
```

- **wpd（書込回数/日）**: TTL切れによるキャッシュ再作成の頻度
  - Gemini: 永続キャッシュなので不要
  - Claude/OpenAI/Nova: リクエスト間隔がTTLを超えると再作成が必要

#### TTL切れとキャッシュの動作

キャッシュが有効な場合（TTL内）:
- `cache_creation_input_tokens` = CW（差分のみ。会話履歴の追加分）
- `cache_read_input_tokens` = CR（既存キャッシュの読み出し）

キャッシュが切れた場合（TTL超過）:
- `cache_creation_input_tokens` = **C + CW**（システムプロンプト全体 + 差分を再書込）
- `cache_read_input_tokens` = 0

この再作成コストを `wpd × D` で計算します（Cは全ユーザーで共有されるキャッシュのため、ユーザー数は乗算しない）。

#### wpd（書込回数/日）の自動計算

Cは全ユーザーで共有されるため、全ユーザー合計のリクエスト頻度でTTL判定します。

```
全体リクエスト頻度 = (U × N) / D  （1日あたりの全リクエスト数）
リクエスト間隔 = h / 全体リクエスト頻度

if リクエスト間隔 ≤ TTL:
  wpd = 1  （キャッシュ維持 — 初回書き込みのみ）
else:
  wpd = ceil(h / TTL)  （TTL切れごとに再書き込み）
```

**例: Claude Sonnet 4.5（5分TTL、U=1,000, N=10, D=7, h=24）**
```
全体リクエスト頻度 = (1,000 × 10) / 7 ≈ 1,429 req/日
リクエスト間隔 = 24h / 1,429 ≈ 0.017h (= 60秒) << 5分
→ wpd = 1（キャッシュは常に維持される）
Cache Re-creation = (15,000 / 1M) × $3.75 × 1 × 7 = $0.39
```

### 2. CW 差分書込費（Per-request Write Cost）

リクエスト毎の差分キャッシュ書込コスト。

```
CW Write = (CW / 1M) × WritePrice × (U × N)
```

- Gemini: CW=0（共有キャッシュのため差分書込なし）
- Claude/OpenAI/Nova: 各リクエストで会話履歴の増分をキャッシュに書込

**例: Claude Sonnet 4.5**
```
= (5,000 / 1M) × $3.75 × 10,000
= $187.50
```

### 3. CR 読込費（Cache Read Cost）

各リクエストでキャッシュから読み出す際のコスト。

```
CR Read = (CR / 1M) × CachedInputPrice × (U × N)
```

- Gemini: CR = C（共有キャッシュをそのまま読み出し）
- Claude/OpenAI/Nova: ユーザー入力値をそのまま使用

**例: Claude Sonnet 4.5**
```
= (10,000 / 1M) × $0.30 × 10,000
= $30.00
```

### 4. 入力費（Prompt Cost）

キャッシュに含まれない新規入力部分のコスト。

```
Prompt Cost = (P / 1M) × InputPrice × (U × N)
```

**例: Claude Sonnet 4.5**
```
= (3,000 / 1M) × $3.00 × 10,000
= $90.00
```

### 5. 出力費（Output Cost）

モデルの生成した回答トークンに対するコスト。

```
Output Cost = (O / 1M) × OutputPrice × (U × N)
```

**例: Claude Sonnet 4.5**
```
= (1,000 / 1M) × $15.00 × 10,000
= $150.00
```

### 6. 保管料（Storage Cost）

キャッシュを保持している時間に対する課金。**Geminiのみ発生、Claude/OpenAI/Novaは無料。**

```
Gemini:   Storage = (C / 1M) × StoragePrice × (h × D) × 1
その他:   Storage = (C / 1M) × StoragePrice × (h × D) × 1    （常に$0）
```

---

## 合計コスト

キャッシュ再作成費（初回書込）は合計外の参考値として別途表示されます。

```
Total = CW Write + CR Read + Prompt + Output + Storage
（参考）初回キャッシュ書込 = Cache Re-creation（合計外）
```

**例: Claude Sonnet 4.5（5分TTL、デフォルトパラメーター）**
```
CW Write = $187.50 + CR Read = $30.00 + Prompt = $90.00 + Output = $150.00
Total = $457.50

（参考）初回キャッシュ書込 = (15,000 / 1M) × $3.75 × 1 × 7 = $0.39（合計外）
```

### 1リクエストあたりのコスト

```
Per Request = Total / (U × N)
= $457.50 / 10,000
= $0.04575 ≈ ¥7.09（@¥155/USD）
```

---

## キャッシュなしとの比較（削減率の計算）

キャッシュを使わない場合、CR + CW + P のすべてが通常入力単価で課金されます。

```
No-Cache Cost = ((CR + CW + P) / 1M) × InputPrice × (U × N) + Output Cost
```

```
削減額 = No-Cache Cost - Total Cost
削減率 = (削減額 / No-Cache Cost) × 100
```

**例: Claude Sonnet 4.5**
```
No-Cache Cost = ((10,000 + 5,000 + 3,000) / 1M) × $3.00 × 10,000 + $150.00
             = $540.00 + $150.00
             = $690.00

削減額 = $690.00 - $457.50 = $232.50
削減率 = 33.7%
```

---

## Gemini vs Claude/OpenAI/Nova の違い

| 観点 | Gemini | Claude/OpenAI/Nova |
|------|--------|-----|
| キャッシュ方式 | 共有キャッシュ（全ユーザーで1つ） | 個別キャッシュ（ユーザーごと） |
| スケール倍率 | 1 | U（ユーザー数） |
| CW（差分書込） | 0（差分書込なし） | ユーザー入力値 |
| CR（読込） | C（初回書込 = 読込量） | ユーザー入力値 |
| Storage | 時間課金あり | 無料 |
| TTL | 永続（明示削除まで） | Sliding window（5分/1時間/自動） |
| キャッシュ再作成 | 1回のみ | TTL切れのたびに発生 |

---

## まとめ

| 観点 | Gemini | Claude | OpenAI (GPT-5) | Nova (Bedrock) |
|------|--------|--------|----------------|----------------|
| 書き込み | 入力と同額（安い） | 1.25〜2.0倍の上乗せ | 入力と同額（安い） | 入力と同額（安い） |
| 保管料 | 時間課金（長時間保持で高額化） | 無料 | 無料 | 無料 |
| 再利用 | 入力の10%（安い） | 入力の10% | 入力の10% | 入力の25% |
| TTL | 永続キャッシュ | Sliding window（5分/1時間） | 自動（~5分） | 5分（sliding window） |
| キャッシュ再作成 | 不要 | 頻度に依存 | 頻度に依存 | 頻度に依存 |

---

## AgentCore Memory 計算ロジック

### 概要

AgentCore Memory タブでは、AWS Bedrock AgentCore Memory の月額コストを試算します。LLM の推論コストとは独立した料金体系（イベント単位・レコード単位・リクエスト単位）で、モデルに依存しません。

### 入力パラメーター

| 記号 | パラメーター名 | デフォルト値 | 説明 |
|------|---------------|-------------|------|
| U | ユーザー数 | 10,000 人 | 月間アクティブユーザー数 |
| S | セッション/ユーザー/月 | 20 回 | 1ユーザーあたりの月間セッション数 |
| RT | ラウンドトリップ/セッション | 2 回 | 1セッションあたりのユーザー⇔エージェント往復回数 |
| RV | LTM検索/セッション | 1 回 | 1セッションあたりのLTMセマンティック検索回数 |
| RC | LTMレコード/ユーザー | 10 件 | 1ユーザーあたりの蓄積LTMレコード数 |

### AWS AgentCore Memory 単価（2026年2月時点）

| サービス | 単価 | 単位 |
|---------|------|------|
| STM イベント作成 | $0.25 | /1,000 events |
| LTM ストレージ (Default) | $0.75 | /1,000 records/月 |
| LTM ストレージ (Override) | $0.25 | /1,000 records/月 |
| LTM 検索 | $0.50 | /1,000 requests |

### 計算式

```
STM Cost          = U × S × RT × 2 × ($0.25 / 1,000)
LTM Storage Cost  = U × RC × (Strategy別単価 / 1,000)
LTM Retrieval Cost = U × S × RV × ($0.50 / 1,000)

Total Memory Cost = STM + LTM Storage + LTM Retrieval
```
