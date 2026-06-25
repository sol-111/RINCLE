# RINCLEブログ（WordPress）構築 実装手順書

> 2026-06-24 / 社内（弊社エンジニア）向けの実装手順書
> 読者想定: **IT基礎はあるが、DNS・リバースプロキシ・Cloudflare・WordPressの実務は不慣れな人**。用語は都度かみ砕いて説明する（まとめは末尾の「[付録：用語集](#付録用語集)」）。
> 方針の正本: [blog-seo-strategy.md](blog-seo-strategy.md)（なぜWordPress・なぜサブディレクトリか）

---

## 0. これから何を作るのか（全体像）

`rincle.co.jp/blog/` を開いたら **WordPressのブログ**が表示され、それ以外（`rincle.co.jp/...`）は**今まで通りBubble**が表示される——という状態を作る。

ポイント: **BubbleとWordPressは別々の場所で動いている**（BubbleはBubble社のサーバー、WordPressはX-Server）。同じ `rincle.co.jp` の中でURLのパスによって振り分けるので、**入口に「交通整理係」を1枚かませる**。その交通整理係が **Cloudflare**。

### 現状（今）

`rincle.co.jp` は全部Bubbleに向いている。WordPressはまだ無い。メール送信だけ別系統でSendGridを使っている。

```
　　　　　　　ユーザー
　　　　　　　　│  rincle.co.jp/... にアクセス
　　　　　　　　▼
　　　X-ServerのDNS（案内所＝NS）
　　　　　　　　│  A レコード → 104.16.x（BubbleのCloudflare）
　　　　　　　　▼
　┌──────────────────────────┐
　│  Bubbleの裏のCloudflare（Bubble社の管理） │
　└───────────────┬──────────┘
　　　　　　　　　　　　　▼
　　　　　　　　┌──────────┐
　　　　　　　　│ Bubble本体     │ ← rincle.co.jp の全部がここ
　　　　　　　　└──────────┘

　別系統） rincle.co.jp からのメール送信 → SendGrid（DKIMで認証）
　WordPress は まだ無い
```

### こうなる（実装後）

NSをCloudflareに移して交通整理係を入れ、`/blog/` だけWordPressへ振り分ける。

```
　　　　　　　ユーザー
　　　　　　　　│  rincle.co.jp/... にアクセス
　　　　　　　　▼
　┌──────────────────────────┐
　│   Cloudflare（交通整理係＝今回追加）      │
　│   ・/blog/* → WordPressへ                │
　│   ・それ以外 → Bubbleへ                  │
　└───────┬──────────────┬─────┘
　　　　　　│              │
　　　/blog/*           それ以外
　　　　　　▼              ▼
　┌──────────┐   ┌──────────┐
　│ WordPress     │   │ Bubble本体     │
　│ （X-Server）  │   │ （Growthプラン）│
　└──────────┘   └──────────┘
```

「交通整理」はURLの**パス（/blog/）単位**の振り分け。これはDNS（後述）だけでは出来ず、Cloudflareのルーティング機能が要る——というのが今回の肝。**現状との違いは「Cloudflareを自分たちの管理下で前段に差し込む」点**（今はBubble社のCloudflareに直結している）。

---

## 1. 前提・現状（調査済みの実値）

2026-06-24時点でコマンド（`dig`）で確認した `rincle.co.jp` の状態:

| 項目 | 現状 | 意味 |
|------|------|------|
| ドメイン管理／NS（ネームサーバー） | **X-Server**（ns1〜5.xserver.jp） | ドメインの「案内所」は今X-Serverがやっている |
| サイト本体（A レコード） | 104.16.x / 104.19.x（**Cloudflare のIP**＝Bubbleの裏側） | rincle.co.jp は今 Bubble（その内部のCloudflare）に向いている |
| メール受信（MX） | `0 rincle.co.jp`（実質未設定） | 受信メールはほぼ使っていない |
| メール送信（SendGrid） | `s1/s2._domainkey` → `…u106187083.wl084.sendgrid.net`（DKIM） | **SendGridでメール送信中**。このDKIMレコードが認証の要 |
| SPF | `v=spf1 +a:sv15059.xserver.jp +a:rincle.co.jp +mx include:spf.sender.xserver.jp ~all` | X-Server経由送信の許可設定 |
| DMARC | なし | — |

- **Bubbleプラン**: Growth（カスタムドメイン対応 ✓）
- **WordPressの設置先**: X-Server（既契約・WP簡単インストールあり）。X-Serverのサーバーホスト名は `sv15059.xserver.jp`（SPFから判明）
- **権限**: 弊社が X-Server / Bubble / ドメイン管理 すべてにログインできる前提

> ⚠️ **用語**: 「NS（ネームサーバー）」= ドメイン名を実際のサーバーに案内する"案内所"を、どの会社にやらせるかの指定。今はX-Server。今回これをCloudflareに引っ越す。

---

## 2. 設計の確定事項と「検証が必要な勘所」

### 確定

- ブログのURL: **`rincle.co.jp/blog/`**（サブディレクトリ。SEO評価を本体ドメインに集約するため。理由は blog-seo-strategy.md §6）
- 交通整理: **Cloudflare**（NSをCloudflareへ移管して使う）
- WordPress: **X-Server** に設置
- 振り分け: Cloudflareの **Origin Rules**（パスで origin を上書き／Workerより簡単）。Workerでも可

### ⚠️ 最大の勘所（事前検証ポイント）

Bubble は**それ自体がCloudflareの裏で動いている**。そこに弊社のCloudflareをもう1枚かぶせる＝**Cloudflareの二段重ね（orange-to-orange）**になる。これは「動くことが多いが公式サポート外」で、ここが過去調査で言った「**DNS技術検証が必要**」の正体。

→ **Phase 3 で必ず検証チェックポイントを置く**。もし二段重ねでBubbleが正しく表示されない場合のフォールバックは「**サブドメイン方式（blog.rincle.co.jp）に切替**」（SEOは少し弱まるが確実。blog-seo-strategy.md の方式B）。

---

## 用意するもの一覧（着手前に揃える）

### アカウント・ログイン権限

| 対象 | 用途 | 備考 |
|------|------|------|
| **Cloudflare アカウント** | 交通整理（NS・Origin Rules） | 新規作成・**無料プランでOK**（弊社管理） |
| **X-Server 管理パネル** | WordPress設置・サーバーIP確認・**NS変更** | サーバーパネル＋ドメイン設定の両方 |
| **Bubble 管理権限** | カスタムドメイン設定の確認（Growthプラン） | Settings → Domain/email |
| **SendGrid 管理画面** | メール認証レコード（DKIM等）の正解確認 | Settings → Sender Authentication |
| **Google アカウント** | Search Console / GA4 登録 | 既存のRINCLE用アカウントに合わせる |

### 事前に集める情報

- [ ] **現在の全DNSレコード**（X-Server管理画面で全件・Phase 0）— 特に **SendGridのCNAME**（`s1/s2._domainkey`・`em####`・`url####`）、SPF
- [ ] **X-ServerのサーバーIPアドレス**（`wp-origin` のAレコード用。サーバーパネルで確認。SPFの `sv15059.xserver.jp` がヒント）
- [ ] **Bubbleのカスタムドメイン設定値**（指定されるCNAME/IPターゲット）
- [ ] ドメインのNSを変更する場所＝**X-Server**（登録元）

### 決めておくもの（選定）

- [ ] **WordPressテーマ**: 軽量なもの（例: Cocoon〔無料〕/ SWELL〔有料 約1.8万〕）
- [ ] **SEOプラグイン**: Yoast SEO もしくは SEO SIMPLE PACK（国産・軽量）
- [ ] キャッシュ／セキュリティプラグイン（任意）

### 手元ツール

- [ ] ターミナル（`dig` / `nslookup` でDNS確認）
- [ ] ブラウザのシークレットウィンドウ（DNS反映確認・キャッシュ回避用）

### 費用感

| 項目 | 費用 |
|------|------|
| Cloudflare | **無料**（Origin Rules・Workerとも無料枠で足りる） |
| X-Server | **追加ゼロ**（既契約） |
| WordPressテーマ | 無料 or 有料（買う場合のみ1〜2.5万円） |
| ドメイン / Bubble | 既契約（追加なし） |

---

## 3. 作業の全体フロー（Phase一覧）

| Phase | 内容 | リスク | 戻せるか |
|-------|------|--------|---------|
| 0 | 事前バックアップ・DNS棚卸し | 低 | — |
| 1 | X-ServerにWordPressを設置（単体で動かす） | 低 | 容易 |
| 2 | NSをCloudflareへ移管（既存レコード全移行・**Bubbleとメールの維持確認**） | **中** | NSを戻せば復旧 |
| 3 | Cloudflareで `/blog/*` をWordPressへ振り分け（**二段重ね検証**） | **中** | ルール削除で復旧 |
| 4 | WordPressを `/blog/` 配下で正しく動くよう設定 | 中 | 設定変更で復旧 |
| 5 | WordPress初期設定（テーマ・SEOプラグイン） | 低 | — |
| 6 | 運用（記事の書き方・公開フロー） | — | — |

**鉄則**: Phase 2（NS移管）の前に、必ず Phase 0 の棚卸しを完了する。**1つずつ確認しながら進め、各Phaseで動作確認してから次へ**。

---

## ダウンタイムについて（rincleは止まる？）

**結論: 正しくやれば基本ダウンタイムは出ない。** 唯一リスクがあるのはP3の1か所だけで、そこも即戻せる。

| Phase | rincleへの影響 |
|-------|---------------|
| P1 WordPress設置 | 影響ゼロ（別オリジンに作るだけ） |
| P2 NS移管 | 基本ゼロ（条件あり・下記） |
| **P3 オレンジ化＋/blog振り分け** | **唯一のリスク地点**（ただし即戻せる） |
| P4〜6 | rincle本体には影響なし |

- **なぜP2で落ちないか**: NSを切り替えても、Cloudflareに"今と同じレコード"を**先にコピー**してあれば、利用者のDNSが新旧どちらを読んでも同じ答え（Bubble）を返す → 気づかれず無停止。※これが「コピー→NS切替」の順を鉄則にしている理由
- **唯一のリスク=P3でプロキシ(オレンジ)をONにする瞬間**: `/blog` 振り分けには rincle.co.jp をCloudflare経由(オレンジ)にする必要があり、その瞬間に二段重ね(orange-to-orange)の真価が問われる。問題が出ても**オレンジ→グレーに戻せば数秒〜数分で即復旧**

### ゼロダウンタイムにするコツ

1. P2でレコードを**完全ミラー**してからNS切替（落とさない大前提）
2. NS切替前に**TTLを短く**しておく（反映も戻しも速い）
3. P3のオレンジ化は**アクセスの少ない夜間**にやる（万一の影響を最小化）
4. 崩れたら**即グレーに戻す**

> ※ 6/19で話した「リリース時に夜間1h停止」は**DB再構築**の話。**このブログ基盤の作業は原理的にrincleを止めずにやれる**（止めるとしてもP3を安全に試すための短時間で、必須ではない）。

## Phase 0: 事前バックアップ・DNS棚卸し

NSをCloudflareに引っ越すと、**今X-Serverに登録されているDNSレコードを全部Cloudflareに移す**必要がある。1件でも漏らすと、その機能（特に**SendGridメール送信**）が止まる。

### やること

1. **X-Serverの管理画面で、現在のDNSレコードを全件スクショ／メモ**
   - X-Server パネル → 「DNSレコード設定」→ `rincle.co.jp` → 全レコード（A / CNAME / MX / TXT）を控える
   - ※ `dig` では見えない**SendGrid固有のCNAME**（`em####` や `url####` などアカウント固有名）が必ずある。管理画面で実物を確認すること
2. 特に必須で控えるもの:
   - **A レコード**（root・www → 現在のBubble向き）
   - **SendGrid系**: `s1._domainkey` / `s2._domainkey` のCNAME、`em####`（送信元ブランディング）、ある場合は `url####`（クリック計測）
   - **SPF（TXT）**: `v=spf1 +a:sv15059.xserver.jp …`
3. SendGrid側でも、管理画面 → Settings → Sender Authentication で「**どのDNSレコードが必要か**」の正解リストを確認（移行後の答え合わせ用）

> 💡 Cloudflareは移管時に既存レコードを**自動スキャンして取り込む**が、100%ではない（取りこぼしがある）。だから手動の棚卸しリストと突き合わせる。

---

## Phase 1: X-ServerにWordPressを設置（まず単体で動かす）

いきなり `/blog/` に組み込まず、**WordPress単体が動く状態**を先に作る。問題の切り分けがしやすくなる。

### 1-1. WordPressの置き場所（origin）を決める

リバースプロキシで「実体を取りに行く先」を **origin（オリジン＝大元）** と呼ぶ。今回のoriginは X-Server上のWordPress。Cloudflareがここを取りに行けるよう、**専用のホスト名**を用意する:

- 例: `wp-origin.rincle.co.jp` を作り、X-Serverのサーバーへ向ける
- このホスト名は後でCloudflare上では「**DNS only（グレー雲）**」にする（＝Cloudflareの交通整理を通さず、直接X-Serverに繋ぐ。二段重ねを避けるため）

### 1-2. インストール手順

1. X-Server パネル → 「WordPress簡単インストール」
2. インストール先: `wp-origin.rincle.co.jp`（または X-Server初期ドメインでも可）の **`/blog` ディレクトリ**にインストール
   - ※ 公開URLが `rincle.co.jp/blog/` になるので、**originも `/blog` 配下に揃えておく**とパスの食い違いが起きにくい
3. SSL（鍵マーク）: X-Serverの無料独自SSL（Let's Encrypt）を `wp-origin.rincle.co.jp` に発行
4. インストール後、`https://wp-origin.rincle.co.jp/blog/` でWordPressの初期画面が出ることを確認

この時点では「WordPressが単体で見える」だけでOK。`rincle.co.jp/blog/` ではまだ見えない（Phase 3で繋ぐ）。

---

## Phase 2: NSをCloudflareへ移管

> 📌 **考え方**: これはX-Serverのレコードを「**削除**」する作業ではなく、ドメインの**案内所（NS）をX-Server → Cloudflareに"引っ越す"**作業。
> - **鉄則の順序**: ①X-Serverの全レコードを**先にCloudflareへコピー** → ②**最後にNSを切り替える**。逆順（コピー前にNS切替）だとサイト・メールが一瞬切れる
> - 切り替え後、**X-Server側の旧レコードは手で消さなくてOK**。NSがCloudflareを向いた時点で参照されなくなる（自動的に無効化）。残しておいても害はない（万一の切り戻し用に残すのも可）

### 2-1. Cloudflareにドメインを追加

1. Cloudflareアカウント作成（弊社管理。無料プランでOK）
2. 「Add a site」→ `rincle.co.jp` を入力 → **Free プラン**を選択
3. Cloudflareが既存DNSレコードを自動スキャン → 取り込み結果を表示
4. **Phase 0の棚卸しリストと1件ずつ突き合わせ、漏れを手動追加**
   - **A レコード（root・www → Bubble）**: 取り込まれているか確認。雲は後でPhase 3に合わせて設定（基本オレンジ＝プロキシON）
   - **SendGrid: `s1._domainkey` `s2._domainkey` のCNAME**（`…u106187083.wl084.sendgrid.net`）→ **必ず追加**。雲は**グレー（DNS only）**
   - **SendGridの `em####` CNAME** → 追加・グレー
   - **SPF（TXT）** → そのままコピー
   - `wp-origin.rincle.co.jp`（A → X-Server IP）→ 追加・**グレー（DNS only）**

> ⚠️ **DKIMなどメール認証系のCNAME/TXTは必ず「DNS only（グレー雲）」**。プロキシ（オレンジ）にすると値が書き換わり認証が壊れる。

### 2-2. NS（ネームサーバー）をX-Server → Cloudflareに変更

1. Cloudflareが指定する2つのネームサーバー（例: `xxx.ns.cloudflare.com`）を控える
2. **ドメイン登録元＝X-Server** の「ネームサーバー設定」で、X-ServerのNS → Cloudflareの2つに**置き換える**
3. 反映に**数時間〜最大48時間**かかる（NS切替の宿命）。Cloudflareの管理画面が「Active」になれば完了

### 2-3. ★Phase 2の動作確認（Phase 3に進む前に必須）

NSがCloudflareに切り替わった直後、**まだ交通整理（/blog振り分け）は入れていない**状態で:

- [ ] `rincle.co.jp` が**今まで通りBubbleで表示される**（＝二段重ねでもサイトが生きている）
- [ ] **SendGridのメール送信が正常**（テスト送信して届く・迷惑メール判定されない／DKIM passを確認）
- [ ] `https://wp-origin.rincle.co.jp/blog/` でWordPressが見える

> ここで `rincle.co.jp` が表示されない＝**二段重ね（orange-to-orange）問題が発生**。対処はPhase 3冒頭の「検証チェックポイント」を参照。

---

## Phase 3: `/blog/*` をWordPressへ振り分け（交通整理の設定）

### 3-0. ★二段重ね（orange-to-orange）の検証チェックポイント

Phase 2-3で `rincle.co.jp`（Bubble）が表示されていればクリア。もし表示されない/エラー（例: 1000番台エラー）の場合:

1. Bubble側の設定確認: Bubble → Settings → Domain/email で `rincle.co.jp` がカスタムドメインとして正しく登録されているか
2. それでも解決しないなら **Bubbleサポートに「Cloudflare経由でアクセスしたい」旨を問い合わせ**（CNAMEターゲットの案内 or ドメイン許可をもらう）
3. どうしても解決しなければ **フォールバック＝サブドメイン方式**（`blog.rincle.co.jp` をWordPressにCNAME直結。交通整理が不要になる。SEOは少し弱まるが確実。blog-seo-strategy.md 方式B）

> このチェックポイントを越えられるかが本構成の成否。**ここは時間を取って検証する**。

### 3-1. Origin Rule で `/blog/*` をWordPressへ

Cloudflareの **Origin Rules**＝「URLのパスに応じて、取りに行く先（origin）を上書きする」機能。Workerより簡単で今回はこれで十分。

1. Cloudflare → 対象ドメイン → Rules → **Origin Rules** → Create rule
2. 条件: `URI Path` `starts with` `/blog`
3. アクション: **Override origin** → Host を `wp-origin.rincle.co.jp` に上書き（必要に応じてSNIも合わせる）
4. 保存

これで「`/blog/` で始まるURLだけWordPress（X-Server）、それ以外はBubble」が成立。

> 代替: Origin Rulesで詰まる場合は **Cloudflare Worker** でも実現可（`if (path.startsWith('/blog')) fetch(WordPress) else fetch(Bubble)`）。実装例は複数あり（Ghost/WordPress × Bubble × Cloudflare Workers のガイド）。

### 3-2. SSL設定

- Cloudflare → SSL/TLS → 暗号化モードを **Full（または Full strict）**
- origin（X-Server）側にも有効なSSL証明書が要る（Phase 1-2で発行済みのLet's Encrypt）。これが無いと Full strict でエラーになる

### 3-3. ★Phase 3の動作確認

- [ ] `https://rincle.co.jp/blog/` でWordPressが表示される
- [ ] `https://rincle.co.jp/`（トップ）など**他のページが今まで通りBubble**
- [ ] 鍵マーク（SSL）が両方で有効

---

## Phase 4: WordPressを `/blog/` 配下で正しく動かす設定

WordPressは「自分が `rincle.co.jp/blog/` で公開されている」と知らないと、リンクや画像のURLがズレる（origin側のURLを吐いてしまう）。これを直す。

### 4-1. サイトURLの設定

- WordPress管理画面 → 設定 → 一般
  - **サイトアドレス（WordPress Address / `siteurl`）**: origin側の実体URL
  - **サイトアドレス（Site Address / `home`）**: `https://rincle.co.jp/blog`
- ※ ログインできなくなるリスクがあるため、先に `wp-config.php` に直書きする方が安全:
  ```php
  define('WP_HOME', 'https://rincle.co.jp/blog');
  define('WP_SITEURL', 'https://wp-origin.rincle.co.jp/blog');
  ```

### 4-2. パーマリンク（URLの形）

- 設定 → パーマリンク → 「投稿名」など（`/blog/%postname%/` の形になる）を選択 → 保存（これでルールが再生成される）

### 4-3. リバースプロキシ越しの定番対応

- 管理画面（`/blog/wp-admin`）・画像（`/blog/wp-content/...`）・プレビューが正しく表示されるか確認
- 混在コンテンツ（http/httpsの混ざり）が出たら、プラグイン等でURLを `https://rincle.co.jp/blog` に統一
- リダイレクトループが起きる場合は `wp-config.php` に:
  ```php
  if (!empty($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https') {
      $_SERVER['HTTPS'] = 'on';
  }
  ```

### 4-4. ★Phase 4の動作確認

- [ ] 記事を1本テスト投稿 → `rincle.co.jp/blog/記事スラッグ/` で正しく表示
- [ ] 記事内の画像・リンクが `rincle.co.jp/blog/...` になっている
- [ ] `/blog/wp-admin` でログイン・編集できる

---

## Phase 5: WordPress初期設定（テーマ・SEO）

1. **不要なデフォルトの削除**: サンプル記事「Hello World」・既定固定ページ・不要プラグインを削除
2. **テーマ**: 軽量で日本語に強いもの（例: Cocoon〔無料〕/ SWELL〔有料〕等）。**表示速度重視**なので重いテーマは避ける
3. **SEOプラグイン**: **Yoast SEO** または **SEO SIMPLE PACK**（国産・軽量）を入れる
   - title / meta description のテンプレ設定
   - **XMLサイトマップを出力** → Google Search Consoleに登録（`rincle.co.jp/blog/` 配下が対象）
   - 構造化データ（Article）が自動付与されることを確認
4. **キャッシュ／高速化**: Cloudflare側でキャッシュを効かせる（ブログは静的に近いので特に効く）。WP側もキャッシュプラグイン可
5. **セキュリティ**: 管理画面のログイン保護、自動更新ON、定期バックアップ（保守は弊社が準委任で担当）
6. **計測**: GA4 / Search Console を `/blog/` にも適用（本体のSEO設定と整合）

---

## Phase 6: 運用（記事の書き方・公開フロー）

増永さん側が自分で書く前提（WordPressのWYSIWYG）。

### 記事作成フロー

1. `/blog/wp-admin` にログイン → 「投稿」→「新規追加」
2. タイトル・本文を**見たまま編集（ブロックエディタ）**で書く。見出しは「見出し2/3」ブロックを使う（SEOのh2/h3になる）
3. 画像はドラッグ&ドロップで挿入（altテキストを入れる）
4. SEOプラグインの欄で、狙うキーワードに合わせて**タイトル・メタディスクリプション**を設定
5. 記事末尾／本文中に **本体の予約ページ（エリア・店舗）へのリンク**を入れる（集客→予約の導線。blog-seo-strategy.md §3）
6. 「下書き保存」→「プレビュー」で `rincle.co.jp/blog/...` の見た目を確認 → 「公開」

### 記事テンプレ（地域×コース記事の型）

コース概要 / マップ / 所要時間・料金 / 立ち寄りスポット / レンタル導線（→本体エリアページ）。1種のテンプレを用意して量産（keyword-research.md の優先KWに沿う）。

---

## ロールバック（問題が起きたら戻す）

| 状況 | 戻し方 |
|------|--------|
| Phase 3でサイトがおかしい | Origin Rule（またはWorker）を**削除** → 元のBubble表示に戻る |
| Phase 2でサイト/メールが壊れた | ドメイン登録元のNSを**X-Serverに戻す**（反映に数時間〜） |
| 二段重ねがどうしても解決しない | **サブドメイン方式（blog.rincle.co.jp）にフォールバック**（§3-0） |

---

## チェックリスト（最終）

- [ ] Phase 0: 全DNSレコード（特にSendGrid）を棚卸し済み
- [ ] Phase 1: `wp-origin.rincle.co.jp/blog/` でWP単体が動く
- [ ] Phase 2: NS移管後も Bubble表示・SendGrid送信が正常
- [ ] Phase 3: `rincle.co.jp/blog/` でWP、他はBubble、両方SSL有効
- [ ] Phase 4: 記事URL・画像・管理画面が `/blog/` 配下で正常
- [ ] Phase 5: テーマ・SEOプラグイン・サイトマップ・計測
- [ ] Phase 6: 運用フローを増永さんに共有

---

## 未確認・要検証（実機で潰す）

1. **二段重ね（orange-to-orange）でBubbleが正常表示されるか**（最重要・§3-0）
2. SendGridの `em####`/`url####` などアカウント固有CNAMEの**実物**（X-Server管理画面で確認）
3. X-ServerのサーバーIP（`wp-origin` のAレコード用）
4. Origin Rules で詰まった場合のWorker実装

---

## 付録：Cloudflareとは／なぜX-Serverではダメか

### Cloudflareとはどんなサービスか

ひとことで言うと、**サイトの"正面入口"に立つ多機能スタッフ**。ユーザーとサーバーの間に入り、全アクセスがまずCloudflareを通ってから本体に届く位置にいる。世界の多くのサイトが使う定番で、無料から使える。

| Cloudflareができること | 何屋さん |
|----------------------|---------|
| DNS管理 | ドメインの「案内所」（名前→サーバーの変換） |
| リバースプロキシ／ルーティング | アクセスの「交通整理係」（パスで行き先を振り分け） |
| CDN・キャッシュ | コンテンツを各地に配って「高速化」 |
| SSL | 通信の「暗号化」（鍵マーク） |
| セキュリティ（DDoS防御・WAF） | サイトの「警備員」 |
| Workers / Pages | エッジで動く「小さな実行環境・静的ホスティング」 |

**今回使う用途**: ①リバースプロキシ＝Origin Rules（`/blog` 振り分け・主目的）／②DNS（NS移管）／③SSL（＋おまけでCDN高速化）。WAF・画像最適化・Workers有料等は使わない＝**Freeで足りる**。

### なぜX-Serverではダメか

X-Serverとは役割が違う。**X-Server＝中身の置き場（origin）／Cloudflare＝入口の前段（エッジ）**。X-Serverに"交通整理"はできない。理由は3つ：

1. **DNSはホスト名単位**。`rincle.co.jp → どこか1つ`しか指せず、「`/blog`はこっち、それ以外はあっち」という**パスでの振り分けが原理的にできない**
2. **共有レンタルサーバー**なので、自分以外（Bubble）への自由なリバースプロキシ設定（mod_proxy等）が組めない
3. 仮にできても、**全アクセスを共有サーバー経由でBubbleに中継**＝遅い・不安定・本末転倒

ただし**サブドメイン（`blog.rincle.co.jp`）ならX-Serverだけで完結**（DNSにCNAMEを足してWordPressへ向けるだけ・Cloudflare不要）。その代わりSEOはサブディレクトリより弱い（＝方式B）。

### X-Server vs Cloudflare 比較

| | X-Server | Cloudflare |
|--|---------|-----------|
| 正体 | サーバー＝中身の置き場（origin） | 入口に立つ前段（エッジ） |
| 今回の担当 | WordPressを動かす | DNS・交通整理・SSL |
| WordPressホスティング | ◎ 本領 | ✕ 基本やらない |
| DNS管理 | ◯（ホスト名単位のみ） | ◯（＋パス振り分け可） |
| パス単位の振り分け（/blog） | ✕ できない | ◯ できる（Origin Rules） |
| Bubbleの前に立って捌く | ✕（共有で不可） | ◯（エッジで自然） |
| 料金 | 既契約 | 無料 |

→ **サブディレクトリ `/blog/` でやる以上、両方が必要**（X-Server＝中身・Cloudflare＝入口）。サブドメインで妥協するならX-Serverだけで完結（SEOやや弱）。両者は競合ではなく**役割分担**。

## 付録：用語集

本書に出てくる用語を、IT基礎レベルでかみ砕いた一覧。

### ドメイン・DNS まわり

| 用語 | かみ砕いた意味 |
|------|--------------|
| **ドメイン** | サイトの住所の名前（`rincle.co.jp`） |
| **DNS** | ドメイン名を実際のサーバーの場所（IP）に変換する"案内所"の仕組み |
| **NS（ネームサーバー）** | その案内所を**どの会社にやらせるか**の指定（今はX-Server→Cloudflareに移す） |
| **A レコード** | 「ドメイン名 → サーバーのIPアドレス」の対応表の1行 |
| **CNAME レコード** | 「ドメイン名 → 別のドメイン名」への転送（別名）。SendGridのDKIM等で使う |
| **MX レコード** | そのドメイン宛の**受信メール**をどのサーバーに届けるかの指定 |
| **TXT レコード** | 文字情報を入れるレコード。SPF/DKIM/DMARC等の認証設定に使う |
| **SPF** | 「このドメインのメールは、このサーバーから送ってOK」の宣言（なりすまし対策） |
| **DKIM** | 送信メールに電子署名を付けて"本物"だと証明する仕組み（**SendGridが使用中**） |
| **DMARC** | SPF/DKIMが失敗したメールをどう扱うかのポリシー（今回は未設定） |

### サーバー・プロキシ まわり

| 用語 | かみ砕いた意味 |
|------|--------------|
| **リバースプロキシ** | アクセスを受け取って、裏の別サーバーに代理で取りに行き返す仕組み。今回の"交通整理係" |
| **origin（オリジン）** | リバースプロキシが実体を取りに行く"大元"のサーバー（今回はX-ServerのWordPress） |
| **Cloudflare** | DNS・CDN・プロキシを提供する会社。今回の交通整理係 |
| **CDN** | コンテンツを各地に配って表示を速くする仕組み（Cloudflareの機能） |
| **プロキシON（オレンジ雲）/ DNS only（グレー雲）** | Cloudflareで、そのレコードを**Cloudflare経由にする(オレンジ)**か**素通しで直接繋ぐ(グレー)**かの設定 |
| **orange-to-orange（二段重ね）** | 自分のCloudflareの先が、また別のCloudflare（Bubble）になる状態。トラブりやすく要検証 |
| **Origin Rules** | Cloudflareで「パス等の条件に応じて取りに行く先(origin)を上書き」する機能。今回の振り分けに使う |
| **Worker** | Cloudflare上で動かす小さなプログラム。より柔軟な振り分けに使える（Origin Rulesの代替） |
| **SSL/TLS（鍵マーク）** | 通信の暗号化。`Full`/`Full strict` はCloudflare⇔origin間の暗号化の厳しさモード |
| **SNI** | 1つのIPで複数ドメインのSSLを見分ける仕組み（プロキシ時に合わせることがある） |

### WordPress・SEO まわり

| 用語 | かみ砕いた意味 |
|------|--------------|
| **CMS** | コンテンツ管理システム。記事を書く管理画面付きソフト（WordPressはその代表） |
| **siteurl / home（WP_SITEURL / WP_HOME）** | WordPressが認識する「自分のURL」設定。プロキシ越しだとズレるので明示する |
| **パーマリンク** | 記事ごとの固定URLの形式（例: `/blog/記事名/`） |
| **WYSIWYG** | 「見たまま編集」。完成形を見ながら書けるエディタ（What You See Is What You Get） |
| **構造化データ（Article schema）** | 検索エンジンに「これは記事です」と機械的に伝える印。SEOプラグインが自動付与 |
| **XMLサイトマップ** | サイト内のURL一覧をGoogleに知らせるファイル。Search Consoleに登録する |

### 今回の登場サービス

| 用語 | かみ砕いた意味 |
|------|--------------|
| **Bubble** | RINCLE本体を作っているノーコード開発PF（Growthプラン契約中） |
| **X-Server** | 契約中のレンタルサーバー。WordPressの設置先 |
| **SendGrid** | メール送信サービス。rincle.co.jpからの送信で使用中（DKIM設定あり） |
| **サブディレクトリ / サブドメイン** | `rincle.co.jp/blog/`（同じドメイン内）と `blog.rincle.co.jp`（別の名前）の違い。今回は前者 |

---

*前提となる方針（なぜWordPress・なぜサブディレクトリ・note/Bubble/WordPressの使い分け）は [blog-seo-strategy.md](blog-seo-strategy.md) を参照。本書は実装手順に特化した社内向けドキュメント。*
</content>
