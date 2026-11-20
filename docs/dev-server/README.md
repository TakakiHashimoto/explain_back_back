# 開発用 backend サーバーと共有 APK

この文書は、次の2つの手順をまとめたものです。

- 開発用の backend サーバーを Render に立てる手順
- 1人がビルドした Android の development build（APK）をチームで使う手順

対象はチームの開発者です。各自の PC の **Android エミュレーター**で動かすことを前提にしています。**本番環境ではありません**（本番は新しい DB と Clerk の production instance を使う別の環境にします）。

## 1. なぜこの構成にするか

PC のリソースが足りないと、エミュレーターと次の3つを同時に動かすのは重すぎます。

- Android のネイティブビルド（Gradle）
- Metro
- backend

そこで、重い2つを各自の PC から外します。

- **ネイティブビルド** → 1人がビルドした APK を全員で使う。
- **backend** → 共有の開発用サーバー（Render）を使う。

各自の PC で動かすのは、**エミュレーターと Metro だけ**になります。

```text
各自の PC
├─ Metro ──JS──> エミュレーター（共有 APK: dev client）
│                      │ HTTPS（各自の .env の EXPO_PUBLIC_API_URL）
│                      v
│            [Render: 開発用 backend (dev ブランチ)]
│                      │
│                      v
│            [Supabase: 共有の dev DB] ← 各自のローカル backend も同じ DB を使う
```

## 2. 共有する APK は development build

| | development build（今回使うもの） | preview / release APK |
|---|---|---|
| JS の出どころ | 各自の PC の Metro | APK に埋め込まれている |
| JS を変えたとき | 作り直さなくてよい | 毎回作り直す |
| `EXPO_PUBLIC_*` | **各自の `.env`** の値が使われる | ビルドした人の値で固定される |

JS だけの変更なら、APK を配り直す必要はありません。次のどれかに当てはまるときだけ、作り直して配り直します。

- `apps/mobile/package.json` で、ネイティブコードを含むパッケージを追加・更新した
- `app.json` / `app.config.ts` の `plugins` や Android の設定を変えた
- Expo SDK を上げた

古い APK のまま使うと、dev client が「ネイティブモジュールが見つからない」というエラーを出します。

### 2.1 APK を作る（ビルド担当: Kazi）

```bash
cd apps/mobile
bunx expo prebuild --platform android   # android/ がないときだけ
cd android
./gradlew assembleDebug
```

- 出力: `apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk`
- `./gradlew assembleDebug` を使う理由: `gradle.properties` に書かれたすべての ABI（CPU アーキテクチャ。`armeabi-v7a,arm64-v8a,x86,x86_64`）を1つの APK に入れるため。エミュレーターの ABI は PC によって違う（Intel / AMD の PC は `x86_64`、Apple Silicon の Mac は `arm64-v8a`）が、この APK ならどちらでも動く。`expo run:android` は、接続中の端末の ABI だけでビルドすることがあり、別の種類の PC のエミュレーターでは動かない可能性がある。
- 配るときは、ビルドしたコミットのハッシュも一緒に伝える。

### 2.2 エミュレーターを用意する（各開発者、最初の1回）

Android Studio の Device Manager で、次の条件のエミュレーター（AVD）を作ります。

- **system image は「Google Play」付きのもの**: Google でのログインに Google Play services が必要なため
- **ABI は PC に合わせる**: Intel / AMD の PC なら `x86_64`、Apple Silicon の Mac なら `arm64-v8a`

### 2.3 APK を使う（各開発者）

1. エミュレーターを起動し、APK を入れる。

   ```bash
   adb install app-debug.apk
   ```

   APK ファイルをエミュレーターの画面にドラッグ & ドロップしても入れられる。新しい APK を入れるときも同じ手順（上書きインストール）。
2. `apps/mobile/.env` に次の値を書く。

   ```bash
   EXPO_PUBLIC_API_URL=https://explain-back-back.onrender.com   # 末尾に / を付けない
   EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=<dev instance の pk_test_...>
   ```

3. Metro を起動し、エミュレーターでアプリを開く。

   ```bash
   cd apps/mobile
   bun run start
   ```

   Metro が起動したらターミナルで `a` を押す。エミュレーターの dev client が開き、Metro から JS を読み込む。

`bun run android`（`expo run:android`）は**使わない**でください。これを実行すると、自分の PC でネイティブビルドが始まってしまいます。

backend をローカルで動かして試したいとき（backend のコードをまだ `dev` にマージしていないときなど）は、`EXPO_PUBLIC_API_URL=http://10.0.2.2:3000` にします。`10.0.2.2` は、エミュレーターの中から PC 本体の `localhost` を指す特別なアドレスです。debug ビルドなので、`http` でもつながります。`.env` を変えたら、Metro を起動し直してください（`EXPO_PUBLIC_*` は Metro がバンドルするときに埋め込まれるため）。

## 3. 開発用 backend を Render に立てる

### 3.0 始める前に

- **OpenAI の使用額に上限を設定する**（budget limit）: アプリを持っている人の使用分がすべて、このキーに請求されるため。

### 3.1 Web Service を作る

Render Dashboard → **New** → **Web Service** → GitHub リポジトリを選び、次のように設定します。

| 項目 | 値 | 理由 |
|---|---|---|
| Branch | `dev` | マージ済みのコードだけを動かす |
| Root Directory | **空のまま** | `bun.lock` がリポジトリのルートにあるため。`apps/backend` にすると、その外のファイル（`bun.lock` など）がビルドから見えなくなる |
| Runtime | Node | Node.js / Bun 用のランタイム |
| Build Command | `bun install --frozen-lockfile && cd apps/backend && bunx prisma generate --config prisma7.config.ts && bun run build` | Prisma Client は git に入っていないので、ビルドのたびに生成する |
| Start Command | `cd apps/backend && bun run start` | `node dist/server.js` を実行する |
| Instance Type | Free | 開発用 |

作成後、**Settings → Build Filters** の Included Paths に次の3つを入れます。mobile だけを変えたときに、backend がデプロイし直されないようにするためです。

```text
apps/backend/**
bun.lock
package.json
```

### 3.2 環境変数

`apps/backend/.env.example` を見ながら、**Environment** に設定します。

| 変数 | 値 | 注意 |
|---|---|---|
| `NODE_ENV` | `production` | `development` にすると、テスト用の `/api/v1/dev/*` がインターネットに公開される |
| `BUN_VERSION` | `1.4.2` | ローカルと同じバージョンにそろえる |
| `PORT` | 設定しない | Render が自動で設定する（既定は `10000`） |
| `CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` | dev instance のキー | アプリの publishable key と同じ instance にする |
| `DATABASE_URL` | 共有の dev DB | |
| `OPENAI_API_KEY` ほか OpenAI の設定 | ローカルと同じ | |
| `FAKE_AI_EVALUATION` | 設定しない（または `false`） | `NODE_ENV=production` で `true` にすると、起動時にエラーで止まる |
| `NOTIFICATION_DRY_RUN` | `true` | |
| `ONESIGNAL_*`, `REVENUECAT_*` | 必要になったら設定する | `REVENUECAT_WEBHOOK_AUTH` を設定すると、RevenueCat の webhook をトンネルなしで試せる |

### 3.3 動いているか確かめる

```bash
curl -i https://explain-back-back.onrender.com/api/v1/me
```

`401` が返れば、サーバーは起動していて、認証も効いています（トークンなしのため 401 になる）。

## 4. 運用ルール

- **デプロイするのは `dev` ブランチだけ**。`dev` にマージすると、自動でデプロイし直される。
- **migration**: サーバーは migration を実行しない。共有の dev DB への migration は、これまでどおり [docs/database-migrations.md](../database-migrations.md) の手順で当てる。`dev` にマージする前の migration を共有 DB に当てると、サーバーのコードと DB の schema が合わなくなる。
- **review reminders** は GitHub Actions で動いているので、このサーバーとは関係ない。

## 5. Render 無料プランの制約

[Render の公式ドキュメント](https://render.com/docs/free)（2026-11-19 に確認）によると、次の制約があります。

- **15分間リクエストがないと止まる**（spin down）。次のリクエストで起動するまで、**約1分**かかる。最初の API がタイムアウトしたら、少し待ってもう一度試す。
- 無料のインスタンス時間は、ワークスペースごとに**月750時間**。止まっている間は消費しない。
- ディスクの中身は、再デプロイ、再起動、spin down のたびに消える（このアプリはアップロードされた音声をメモリで処理するので影響しない）。
- Render の都合で、いつでも再起動されることがある。
- シェル（SSH）は使えない。

## 6. 本番との違い

本番では、次のものを**別に**用意します。

- 新しい空の DB（`prisma migrate deploy` で作る）
- Clerk の production instance
- EAS で `EXPO_PUBLIC_API_URL` を設定して作る AAB

開発用サーバーの設定や DB を、本番にそのまま使い回さないでください。
