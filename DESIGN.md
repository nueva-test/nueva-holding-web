# ヌエヴァホールディング株式会社 コーポレートサイト 設計書（DESIGN.md）

本書はヌエヴァホールディング株式会社のコーポレートHP（リポジトリ `nueva-holding-web`）の構成・ドメイン・メール・問い合わせフォーム・SEO・運用手順・トラブル知見をまとめた設計書である。現状の実装（実コード・実設定）に基づいて記述する。不明な項目は「未確認」と明記する。

- 対象リポジトリ：`nueva-test/nueva-holding-web`
- ローカルパス：`C:\Users\s14_b\OneDrive\ドキュメント\02_新会社\nueva-holding-web`
- 本番URL：<https://nueva.co.jp/>
- 注記：本プロジェクトは「AIで英語（ai-eigo）」とは別プロジェクトである。本書は ai-eigo には一切言及・関与しない。

---

## 1. 概要

ヌエヴァホールディング株式会社のコーポレートサイト。目的は以下の3点。

1. 会社紹介（会社概要・事業内容の掲示）
2. 旗艦事業「AIで英語」への導線
3. 問い合わせ受付（フォームからのメール送信）

技術構成は **単一の静的 `index.html` ＋ 静的アセット群 ＋ `api/contact.js`（Vercel Serverless Function）**。Next.js などのフレームワークは使用していない（プレーンな静的HTML＋関数1本）。

---

## 2. ホスティング / デプロイ

- **Vercel プロジェクト**：`nueva-holding-web`
- **本番ブランチ**：`master`（`master` への push で本番へ自動デプロイ）
- **本番ドメイン**：<https://nueva.co.jp/>（www なし）
- **旧プレビュードメイン**：`nueva-holding-web.vercel.app`
- **デプロイフロー**：`feature/…` ブランチ → `master`（通常マージ）。
  - **force push 禁止**。巻き戻しが必要な場合は `git revert` を用いる（履歴の書き換えはしない）。
- **Bot Protection（Vercel Firewall）**：**Log（モニタリング）モード**。
  - 意味：bot アクセスを**検知・記録するが、チャレンジ画面（Security Checkpoint）でのブロックはしない**。bot も HP 本体を読める。
  - **この方針を採る理由**：
    - ヌエヴァHP は静的なコーポレートサイトで、守るべき高コスト API・機密データが無い（問い合わせフォームはハニーポット＋入力検証で保護済み。→ 第5章）。
    - コーポレートサイトは検索エンジンや外部システム（例：金融機関の法人口座開設審査、各種クローラ）に正しく読まれる必要がある。Bot Protection を**ブロックモード（ON）にすると、プログラム的アクセスに Vercel「Security Checkpoint」bot 検証画面が返り、HP 内容が読めなくなる**。実際に **(a) Xserver のドメイン所有権 WEB 認証**（`webauth.html` のトークンが読めない）、**(b) 法人口座開設審査システム** の両方でこの事象が発生した（→ 第4・5章、第10章）。
    - 対応として、**完全 OFF ではなく Log モードを採用**：外部システム / クローラは通しつつ、bot 検知の記録は残す（監視は維持）。
  - **プロジェクト取り違え注意**：本設定は**「AIで英語」（`ai-eigo` / `ai-eigo-prod`）とは目的が異なる**。AIで英語は守るべき API・課金・データを持つため Firewall 方針が別である。**Firewall 設定の変更時はプロジェクトを取り違えないこと（ヌエヴァHP `nueva-holding-web` のみを操作し、AIで英語の Firewall には触れない）。**

---

## 3. ドメイン / DNS 構成（お名前.com で管理）

- **レジストラ**：お名前.com
- **ネームサーバー**：お名前.com 標準（`01.dnsv.jp`〜`04.dnsv.jp`）

### DNS レコード一覧（現状）

| 種別 | ホスト | 値 | 用途 |
|------|--------|-----|------|
| A | ＠ | `216.150.1.1` | Web 本体（Vercel） |
| MX | ＠ | `sv8440.xserver.jp`（優先度 10） | メール受信（Xserver） |
| TXT | ＠（SPF） | `v=spf1 +a:sv8440.xserver.jp +a:nueva.co.jp +mx include:spf.sender.xserver.jp ~all` | 送信ドメイン認証（SPF） |
| TXT | `default._domainkey`（DKIM） | `v=DKIM1; k=rsa; p=…`（Xserver 発行の DKIM 公開鍵） | 送信ドメイン認証（DKIM） |
| TXT | `_dmarc`（DMARC） | `v=DMARC1; p=none;` | 送信ドメイン認証（DMARC） |

> DKIM の公開鍵（`p=` の値）は長大なため本書では転記を省略する（実値は DNS 設定側を参照）。

### 注記

- **A（Web ＝ Vercel）と MX（メール ＝ Xserver）は同一ドメインで共存**している。Web と メールで別事業者を利用している構成である。
- **SPF は 1 ドメイン 1 本の原則**。SPF レコードを複数本に分割しないこと（分割すると無効化・PASS しなくなる）。

---

## 4. メール構成（Xserver）

- **収容サーバー**：`sv8440.xserver.jp`（IP `183.181.90.121`）
- **ドメイン所有権確認**：Xserver の WEB 認証（`/webauth.html` にトークンを配置する方式）で確認済み。
  - ※この認証時、Bot Protection がブロックモードだと Xserver のクローラが「Security Checkpoint」bot 検証画面で弾かれ、`webauth.html` のトークンを読めず認証に失敗する事象が発生した。これが Bot Protection を Log モードへ変更した理由の一つ（→ 第2章）。
- **メールアドレス**：`support@nueva.co.jp`（受信箱・Xserver）

### メールクライアント設定値

| 項目 | 値 |
|------|-----|
| 受信（IMAP） | `sv8440.xserver.jp` : `993`（SSL） |
| 送信（SMTP） | `sv8440.xserver.jp` : `465`（SSL） |
| ユーザー名 | フルメールアドレス（`support@nueva.co.jp`） |

### 送信ドメイン認証

- SPF / DKIM / DMARC 設定済み（→ 第3章 DNS）。
- Gmail 等の受信側で **SPF=PASS・DKIM=PASS** を確認済み。

### トラブル知見：Outlook（従来版）での受信同期

- IMAP アカウントの「**ルートフォルダーのパス**」に `INBOX`（**半角大文字**）を設定しないと、フォルダー構造は見えるが中身が同期されない（全フォルダーが空に見える）症状が発生する。
- iPhone 等のモバイルクライアントは自動解決するが、**Outlook 従来版は手動設定が必要**。

---

## 5. 問い合わせフォーム（`api/contact.js`）

### 方式

- **Vercel Serverless Function（Node.js runtime）＋ nodemailer** で Xserver の SMTP に接続し、`support@nueva.co.jp` 宛に送信する。
  - 送信元（From）：`"ヌエヴァHP お問い合わせ" <SMTP_USER>`（＝ `@nueva.co.jp`）
  - 宛先（To）：`CONTACT_TO`（＝ `support@nueva.co.jp`）
  - **Reply-To**：問い合わせ者が入力したメールアドレス（返信は問い合わせ者へ直接届く）
- 依存パッケージ：`nodemailer`（`package.json` 記載、`^9.0.3`）。
- POST 以外のメソッドは `405 Method Not Allowed` を返す。

### セキュリティ対策（実装済み）

- **入力検証**
  - 必須：`name` / `email` / `message`
  - 形式：`email` は簡易形式チェック（`^[^\s@]+@[^\s@]+\.[^\s@]+$`）
  - 文字数上限：`name` 100 / `email` 200 / `subject` 200 / `message` 4000
- **制御文字除去**
  - 複数行フィールド（`message`）：C0/C1 制御文字を除去（`\t \n \r` は残す）→ 前後空白除去
  - 単一行フィールド（`name` / `email` / `subject`）：改行・タブ含む全制御文字を除去 → **Subject / Reply-To への CRLF ヘッダインジェクションを防止**
- **ハニーポット**：隠しフィールド `company_hp`。埋まっていた場合はボットとみなし、**成功を装って（`200 ok`）実際には送信しない**。
- **秘密情報の扱い**：SMTP 認証情報は環境変数からのみ読み込む（ハードコード禁止）。パスワードはログにも出力しない。エラー詳細はサーバーログのみ、レスポンスは汎用メッセージ。
- **env 未設定時**：クラッシュせず `500` を返す（`SMTP_HOST` / `SMTP_USER` / `SMTP_PASSWORD` のいずれか欠落時）。

### 環境変数（Vercel `nueva-holding-web`／値は本書に記載しない）

| キー名 | 内容 |
|--------|------|
| `SMTP_HOST` | `sv8440.xserver.jp` |
| `SMTP_PORT` | `465` |
| `SMTP_USER` | `support@nueva.co.jp` |
| `SMTP_PASSWORD` | （秘匿・本書に記載しない） |
| `CONTACT_TO` | `support@nueva.co.jp` |

### 重要なトラブル知見（今回の核心）：Xserver SMTP の国外アクセス制限

- Xserver の共用 SMTP は既定で「**SMTP 認証の国外アクセス制限**」が有効になっている。
- この状態では、Vercel Function（AWS・米国データセンター）からの SMTP 接続が
  `554 5.7.1 Client host rejected: Access denied`
  で拒否される。
- **対処**：Xserver サーバーパネルの「**SMTP 認証の国外アクセス制限設定**」を **無効化** することで、Vercel Function からの送信が可能になる。
- **※ この設定変更が本フォーム稼働の必須前提。**
- 補足：手元の PC / スマホ（国内 IP）からの手動送信は、制限が有効なままでも可能。問題は米国 IP から接続する Vercel Function に限る。

---

## 6. SEO / メタ

- **canonical / og:url / JSON-LD `url`・`logo`・`og:image`** はすべて `https://nueva.co.jp/` 基準。
- **meta keywords / description**：実用英語軸（英語学習・AI英語学習・ビジネス英語・留学英語・日常英語 ＋ 各機能名：シャドーイング / ディクテーション / AIロールプレイ / 多読 / SRS単語帳 / 英語日記 / 英語発音 など）。**TOEIC は前面化させず、キーワード末尾に控えめに配置**。
- **JSON-LD（Organization）**：法人番号 `9130001082446` を `identifier`（PropertyValue）として記載。**資本金は非掲載**。
- **アセット**
  - favicon：`logo.png` のシンボルマークを抽出し、16 / 32 / 48 / `.ico` / apple-touch-icon を用意。
  - `og-image.png`：1200×630・明るい背景・キャッチ「**社会の課題をAIで解決。AIでもっと便利な世の中に。**」。
  - `sitemap.xml`：`https://nueva.co.jp/` を 1 URL 登録（`priority` 1.0・`changefreq` monthly）。
  - `robots.txt`：全許可（`Allow: /`）＋ `Sitemap: https://nueva.co.jp/sitemap.xml`。

---

## 7. 会社概要（サイト掲載値）

| 項目 | 値 |
|------|-----|
| 社名 | ヌエヴァホールディング株式会社（NUEVA HOLDING） |
| 設立 | 2026年6月 |
| 所在地 | 〒600-8223 京都府京都市下京区七条通油小路東入大黒町227番地 第２キョートビル402 |
| 代表者 | 大久保 敦 |
| 法人番号 | 9130001082446 |
| 事業内容 | AIを活用したプロダクトの開発・運営 |

---

## 8. ファイル構成（リポジトリ直下の主要ファイル）

| ファイル | 役割 |
|----------|------|
| `index.html` | サイト本体（単一ページの静的HTML。会社概要・事業紹介・問い合わせフォームUI・SEOメタ・JSON-LD を含む） |
| `api/contact.js` | 問い合わせフォームの送信処理（Vercel Serverless Function ＋ nodemailer） |
| `package.json` | 依存定義（`nodemailer`）。`type: module`・`private: true` |
| `package-lock.json` | 依存ロックファイル |
| `favicon.ico` / `favicon-16.png` / `favicon-32.png` / `favicon-48.png` / `favicon.png` / `apple-touch-icon.png` | favicon 一式 |
| `logo.png` | ロゴ画像（favicon 抽出元） |
| `og-image.png` | OGP 画像（1200×630） |
| `sitemap.xml` | サイトマップ（本番URL 1件） |
| `robots.txt` | クローラ制御（全許可＋サイトマップ参照） |
| `webauth.html` | Xserver ドメイン所有権 WEB 認証用トークンファイル（**認証済みのため削除可**。※本書時点では削除しない） |
| `README.md` | リポジトリ概要（1行） |
| `DESIGN.md` | 本設計書 |

---

## 9. 運用手順 / 変更履歴

### デプロイ手順

1. `master` から `feature/…` ブランチを切って作業する（`master` 直接コミット禁止）。
2. 変更を commit し `origin` へ push。
3. `feature/…` → `master` へ**通常マージ**（force push 禁止）。
4. `master` への push で Vercel が本番（`nueva.co.jp`）へ自動デプロイ。
5. 巻き戻しが必要な場合は `git revert`（履歴の書き換えはしない）。

### 主な変更履歴（日付付き・概略）

| 時期 | 内容 |
|------|------|
| — | 本番ドメイン `nueva.co.jp` の割当（Vercel ↔ お名前.com DNS） |
| — | SEO / 会社情報の整備（canonical・OGP・JSON-LD・法人番号・keywords） |
| — | モバイルヘッダーの修正（ハンバーガーメニュー化） |
| — | OGP 画像・favicon 一式の作成・設置 |
| — | Xserver ドメイン WEB 認証（`webauth.html` トークン配置） |
| — | メール構成（Xserver・SPF/DKIM/DMARC・`support@nueva.co.jp`） |
| — | Xserver SMTP「国外アクセス制限」の解除（Vercel Function からの送信を有効化） |
| — | 問い合わせフォーム実装（`api/contact.js`・nodemailer・ハニーポット・入力検証） |
| — | Bot Protection をブロックから Log モードへ変更（法人口座審査・Xserver 認証で HP／トークンが読めない事象への対応。コーポレートサイトの性質上、外部クローラ・審査システムに読まれる必要があるためブロックしない方針。ただし検知記録は維持） |

> 正確な日付は Git のコミット履歴（`git log`）を参照のこと。本書では時系列の概略のみを示す。

### 今後の候補

- `webauth.html` の削除（Xserver 認証は完了済みのため不要）。※削除は per-item 承認のうえ別途実施する。

---

## 10. 補足：作業上の注意（まとめ）

- **秘密情報（SMTP パスワード等）は本書に記載しない**（環境変数のキー名のみ記載）。
- `master` 直接コミット / push は禁止。作業は `feature/…` ブランチで行う。
- 本プロジェクトは ai-eigo とは別。ai-eigo には触れない。
- Bot Protection は **Log モード**運用（外部クローラ・審査システムに HP を読ませるため）。過去に Xserver の WEB 認証（`webauth.html` トークン）と法人口座開設審査システムが、ブロックモード時の「Security Checkpoint」bot 検証画面で弾かれた経緯がある（→ 第2章）。Firewall を再度ブロックへ戻すと同種の事象が再発しうる点に注意。
- **Firewall 設定変更時はプロジェクトを取り違えないこと**：ヌエヴァHP（`nueva-holding-web`）のみを操作し、AIで英語（`ai-eigo` / `ai-eigo-prod`）の Firewall には触れない。
