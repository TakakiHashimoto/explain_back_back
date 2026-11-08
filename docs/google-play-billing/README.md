# Google Play 課金のセットアップとテスト手順（Android）

> 対象：Google Play の課金（Pro サブスクリプション）を設定・テストするメンバー
> 方針（なぜ RevenueCat で entitlement を扱うか）は `docs/spec.md` §30 RevenueCat Architecture / §31 RevenueCat Identity を参照。この資料は「どう設定し、どうテストするか」をまとめたもの。
> 最終更新：2026-11-02

この資料では、情報の出どころを次のように書き分けている。

- 公式：Google / RevenueCat の公式ドキュメントに書かれていること
- 実測：このプロジェクトで実際に試して確認したこと
- 未検証：経験則や推測で、まだ確かめていないこと

## 要点

1. 普段の開発は RevenueCat の **Test Store**（API key `test_...`）で行う。Google Play での確認は最後に1回だけ行う。
2. Google Play での課金テストは、**Play からインストールした AAB** で行う。ローカルで入れた dev build（sideload）では、このプロジェクトでは購入できなかった（→ §6）。
3. Play 版のアプリからバックエンドに届くように、テスト中は PC で **backend と ngrok の両方**を起動しておく（→ §5）。

---

## 1. 全体の構成

```text
Play Console                     RevenueCat                         App
─────────────                    ──────────                         ───
Subscription: pro                Products                           offerings.current
 ├ base plan: monthly  ───────→   pro:monthly ─┐                     ├ .monthly ─→ Paywall
 └ base plan: annual   ───────→   pro:annual  ─┤                     └ .annual  ─→ Paywall
                                               ├→ Entitlement: pro ─→ "is Pro?"
                                 Offering (Current)
                                  ├ $rc_monthly: Test Store product + pro:monthly
                                  └ $rc_annual : Test Store product + pro:annual
```

- アプリは product ID を使わない。「Current offering の monthly / annual」と「entitlement `pro` があるか」だけを見る（spec §30）。
- 同じ package に Test Store と Google Play の product が並んでいる。どちらが返るかは、SDK に渡す API key で決まる（`test_...` → Test Store、`goog_...` → Google Play）。

## 2. Play Console：アプリと AAB の準備

### 2.1 最初の AAB をアップロードする

Play Console でサブスクリプションを作れるのは、`com.android.vending.BILLING` 権限を含む AAB をアップロードした後だけである（`react-native-purchases` がこの権限を追加する）。

```bash
cd apps/mobile
bunx eas-cli build --platform android --profile production
```

- 署名には Play App Signing を使う。EAS が upload key を作って保管する。
- 最初の AAB は Play Console から**手でアップロード**する。2回目以降は `eas submit` も使える。
- `eas.json` は `appVersionSource: "remote"` と `autoIncrement: true` になっている。そのため、`versionCode` は EAS がビルドのたびに1ずつ増やす。ローカルの `android/app/build.gradle` の値は使われない。

### 2.2 EAS の環境変数（production）

`apps/mobile/.env` は git に含めないファイルなので、EAS のクラウドビルドにはアップロードされない。`EXPO_PUBLIC_*` はビルドするときにアプリへ埋め込まれるため、値は EAS の環境変数に登録しておく。

| 変数 | 値 | 注意 |
|---|---|---|
| `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_test_...`（Clerk の dev instance） | ローカル backend の secret key と同じ instance のものにする |
| `EXPO_PUBLIC_REVENUECAT_GOOGLE_API_KEY` | `goog_...` | **Test Store の key（`test_...`）は絶対に入れない**。release ビルドで Test Store の key を使うと、SDK がわざとクラッシュする |
| `EXPO_PUBLIC_API_URL` | `https://<your-domain>.ngrok-free.dev` | 末尾に `/` を付けない（→ §5） |

```bash
bunx eas-cli env:create --environment production \
  --name EXPO_PUBLIC_API_URL --value https://<your-domain>.ngrok-free.dev --visibility plaintext
bunx eas-cli env:list --environment production
```

`EXPO_PUBLIC_*` の値はアプリのバンドルにそのまま入るので、`secret` にしても隠せない。そのため `plaintext` で登録してよい。

### 2.3 テスターの登録

テスターには、次の2つの**別々の**リストがある。両方に同じ Google アカウントを登録する。

| リスト | 場所 | 役割 |
|---|---|---|
| テストトラックのテスター | アプリ →「テスト」→「内部テスト」→「テスター」 | テスト版を Play からインストールできるようにする。登録後に **opt-in URL** を開いて「テスターになる」を押す |
| ライセンステスト | Play Console のアプリ一覧画面（デベロッパーアカウント全体）→「設定」→「ライセンステスト」 | 購入時に**テストカード**を使えるようにする（請求が発生しない）。登録したら「変更を保存」を押す |

- リリースは「内部テスターが利用可能」の状態にしておく。公開してから使えるようになるまで、数時間かかることがある（公式）。
- opt-in URL を開いた後に表示されるインストールのリンクは、§5 の手順でテストするときに使う。

## 3. Play Console：サブスクリプションの作成

「収益化（Monetize with Play）」→「商品」→「定期購入」→「定期購入を作成」

> **注意**：product ID は、削除した後でも二度と使えない。保存する前に確定させること。

### 3.1 サブスクリプション本体

| 項目 | 値 |
|---|---|
| Product ID | `pro` |
| 名前 | `Explain It Back Pro` |

1つのサブスクリプションの中に base plan を2つ作る。同じ特典（Pro）を期間と価格を変えて売る場合は、この形が Play の標準である。価格体系を変えたいときも、base plan を追加するだけで済む。

### 3.2 Benefits（1行40文字以内、最大4行）

| English | 日本語 |
|---|---|
| `20 analyses every 7 days (Free: 3)` | `7日間で分析20回（無料プランは3回）` |
| `120 reviews every 7 days (Free: 18)` | `7日間で復習120回（無料プランは18回）` |
| `Cancel anytime in Google Play` | `Google Play でいつでも解約可能` |

- Free と Pro の違いは利用枠だけである。Follow-up questions と Review reminders は Free でも使えるので、Pro の特典としては書かない。
- 「無制限」とは書かない。Pro にも fair use の上限がある（`docs/free-pro/README.md` §1.6）。

### 3.3 Description（200文字以内）

- English：`Explain It Back Pro raises your limits to 20 analyses and 120 reviews every 7 days, so you can explain more topics and keep reviewing what you learn. Fair-use limits apply.`
- 日本語：`Explain It Back Pro では、7日間あたりの利用枠が分析20回・復習120回に広がります。より多くのテーマを説明し、学んだ内容を復習し続けられます。公正な利用のための上限があります。`

ストアの掲載情報の既定の言語は English (en-US) にして、日本語は「翻訳を追加」で入れる。

### 3.4 Base plan

| 項目 | `monthly` | `annual` |
|---|---|---|
| Base plan ID | `monthly` | `annual` |
| 種類 | 自動更新 | 自動更新 |
| 請求対象期間 | 1 か月 | 1 年 |
| 価格（日本） | ¥980（仮） | ¥7,800（仮） |
| 猶予期間 / 一時停止 / 再登録 | デフォルト | デフォルト |

- Base plan ID に使えるのは、英小文字・数字・`-` だけ（`_` は使えない）。product ID では `_` と `.` も使える。
- 価格は仮の値である。Pro の価格はまだ決まっていない（`docs/free-pro/README.md` §3）。日本の価格を入れてから「価格を更新」で他の国にも設定する。
- **作成したら「有効化」を押す**。base plan は下書きの状態で作られるので、有効化しないと SDK から見えない。
- 無料トライアル（offer）は今は作らない。Paywall にトライアル用の UI がないためである。

## 4. RevenueCat の設定

### 4.1 Products と Entitlement

1. Products で、Google Play の product（`pro:monthly`、`pro:annual`）を import する。RevenueCat での ID は `<subscriptionId>:<basePlanId>` の形になる。
2. 2つの product を **Entitlement `pro`** に attach する。attach していないと、購入できても `pro` が有効にならない（アプリでは `'unverified'` として扱われる）。
3. Google Play のアプリ設定で、サービスアカウントの credentials が valid と表示されているか確認する。有効になるまで最大36時間かかることがある。

### 4.2 Offering

新しい offering は作らない。Test Store 用に作った **Current offering** の各 package に、Google Play の product を追加する。

| Package（種類） | Test Store | Google Play |
|---|---|---|
| `$rc_monthly`（Monthly） | 既存のまま | `pro:monthly` を追加 |
| `$rc_annual`（Annual） | 既存のまま | `pro:annual` を追加 |

アプリのコードの前提（`apps/mobile/src/features/purchases/revenuecat.ts` の `getPlans()`）：

- `offerings.current` しか読まない → 対象の offering を Current にしておく。
- `.monthly` / `.annual` は package の**種類**で探す → Custom の package にすると見つからない。
- 2つのうちどちらかでも欠けていると `null` を返す → Paywall の価格が `—` になり、購入できない。

Offering の metadata、RevenueCat Paywalls、Targeting は使わない。

## 5. テスト手順（Play からインストールした AAB を使う）

### 5.1 なぜ Play からインストールしたアプリを使うのか

- Play から入れたアプリは Play App Signing で署名されているので、署名のチェックで止まることがない。
- その代わり、バックエンドの URL を AAB に埋め込む必要がある。release ビルドでは平文の HTTP がブロックされるため、URL は **HTTPS** にする（このプロジェクトでは `usesCleartextTraffic="true"` が debug 用のマニフェストにしか入っていない）。そのため `http://10.0.2.2:3000` は使えない。
- URL はビルド時に埋め込まれるので、変わるたびにビルドし直しになる。そこで ngrok の**固定ドメイン**（無料プランで1つ使える）を使う。

### 5.2 一度だけやる準備

1. ngrok の dashboard → Domains で固定ドメインを作る。authtoken を設定する（`ngrok config add-authtoken <token>`）。
2. §2.2 に従って、`EXPO_PUBLIC_API_URL` を EAS に登録する。
3. AAB をビルドしてアップロードし、内部テストとして公開する。
4. 端末（エミュレーターでもよい）の準備：
   - Google Play 入りのシステムイメージを使う（`google_apis_playstore`。現在の `Small_Phone` AVD は対応済み）。
   - Google アカウントは、テスター兼ライセンステスターのもの**1つだけ**にする。端末にアカウントが複数あると、テスターではないアカウントで購入画面が開くことがある。
   - 画面ロック（PIN）を設定する（RevenueCat の注意点）。
   - opt-in URL を開き、Play Store からアプリをインストールする。

### 5.3 毎回のテスト

```bash
bun run backend                                             # terminal 1 (repo root)
ngrok http --url=https://<your-domain>.ngrok-free.dev 3000  # terminal 2
curl -s https://<your-domain>.ngrok-free.dev/health         # terminal 3: must match localhost:3000/health
```

1. アプリを開いてサインインし、Paywall を開く。価格（¥980 / ¥7,800）が表示されれば、ここまでの設定はすべて正しくつながっている。
2. Continue → Google Play の購入画面が開く。支払い方法の行（`>`）をタップして、テストカードを選ぶ（→ §5.4）。
3. RevenueCat の dashboard で「View Sandbox Data」をオンにして、購入を確認する。

**デバッグの方法**

- release ビルドでは `__DEV__` が false なので、RevenueCat の DEBUG ログは出ない。代わりに次を使う。
  - `adb logcat | grep -iE "purchases|billing|ReactNativeJS"`
  - ngrok の Inspector（`http://localhost:4040`）：アプリから届いたリクエストと、その応答を確認できる。

### 5.4 テストカード

ライセンステスターのアカウントなら、購入画面の支払い方法の一覧に、テストカードが自動で追加される。

| 選択肢 | 動作 | テストできること |
|---|---|---|
| Test card, always approves | すぐに承認される | 購入成功 |
| Test card, always declines | すぐに拒否される | 購入失敗 |
| Slow test card, approves after a few minutes | 数分後に承認される | 保留中の購入（`'pending'`） |
| Slow test card, declines after a few minutes | 数分後に拒否される | 保留中の購入が最終的に失敗するケース |

- テストカードで購入しても、請求は発生しない（公式）。
- **一覧にテストカードがない場合は購入しないこと**。そのアカウントはライセンステスターとして認識されておらず、本物の請求になる。
- テストのサブスクリプションは数分ごとに更新され、何回か更新されると自動で解約される（未検証：回数と間隔）。Pro がしばらくして Free に戻るのは正常な動きである。
- 確認方法：Play Console の「注文の管理」で、その注文がテスト注文になっているかを見る。本物の注文だった場合は、そこから払い戻しできる。

## 6. つまずいたことと対処

| 症状 | 原因 | 対処 |
|---|---|---|
| `DEVELOPER_ERROR` / `Please ensure the specific App version has been published.` | 端末に入っているアプリの `versionCode` が、トラックに公開した版と違う（ローカルは 1、EAS は 5） | トラックに公開した versionCode でテストする |
| `build.gradle` の `versionCode` を変えたのに反映されない | `bun run dev:android` の中身は `expo start --android` で、ネイティブのビルドをしない | ネイティブ側を変えたら、`apps/mobile` で `bun run android`（`expo run:android`）を実行する |
| `INSTALL_FAILED_UPDATE_INCOMPATIBLE` | Play から入れた版（Play App Signing の署名）と dev build（debug keystore の署名）は、パッケージ名が同じでも署名が違う | `adb uninstall com.explainitback.app` を実行してから入れ直す |
| 購入画面に `This version of the application is not configured for billing through Google Play` が出る（sideload の dev build で） | 署名のチェック。公式ドキュメントでは、ライセンステスターならこのチェックを免除されるとされているが、このプロジェクトではライセンステストを設定しても解消しなかった（実測） | Play から入れた AAB でテストする（§5） |
| Paywall の価格が `—` になる | `/api/v1/me` が失敗した → RevenueCat の SDK が設定されない → `getPlans()` が `null` を返す | ngrok の Inspector で `/me` の応答を確認する（下の2行） |
| ngrok の URL が 404 になり、HTML のページが返る（`ERR_NGROK_3200` "endpoint is offline"） | ngrok が起動していない。固定ドメインは、予約しただけでは転送しない | `ngrok http --url=... 3000` を起動する |
| ngrok の URL が `502 Bad Gateway` を返す | ngrok は動いているが、`localhost:3000` の backend が止まっている | `bun run backend` を起動する |

**インストール元の確認方法**

```bash
adb shell pm list packages -i com.explainitback.app                  # installer=com.android.vending → from Play, null → sideload
adb shell dumpsys package com.explainitback.app | grep versionCode
```

内部テストのアプリを Play からインストールできた場合、そのアカウントのテスター登録と opt-in はできている。

## 7. 未決定 / 今後の課題

| 項目 | 状態 |
|---|---|
| Pro の価格 | 未決定。¥980 / ¥7,800 は仮の値（`docs/free-pro/README.md` §3） |
| sideload の dev build で課金テストができない原因 | 原因は分かっていない。公式ドキュメントの記述（ライセンステスターは sideload でもテストできる）と、実際の結果が食い違っている |
| デプロイ済みの backend | ngrok は PC を起動している間しか使えない。テスターに配るときは Render などにデプロイし、`EXPO_PUBLIC_API_URL` を差し替えてビルドし直す |
| ngrok の無料プランの警告ページ | アプリの fetch では今のところ問題は出ていない。もし応答が HTML になる場合は、リクエストヘッダーに `ngrok-skip-browser-warning` を付ける（未検証） |

## 参考

- Google：[Test your Google Play Billing Library integration](https://developer.android.com/google/play/billing/test)
- RevenueCat：[Google Play Store sandbox testing](https://www.revenuecat.com/docs/test-and-launch/sandbox/google-play-store)
- RevenueCat codelab：[Google Play Issues](https://revenuecat.github.io/codelabs/troubleshooting/google-play/index.html)
