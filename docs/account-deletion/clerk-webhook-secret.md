# Clerk の webhook の signing secret

> 対象：backend を deploy・運用するメンバー（特に production の環境を作るとき、secret を作り直すとき）
> 方針は `docs/仕様書.md` §16.4（ウェブからのアカウント削除）を参照。
> 最終更新：2026-11-21

## 要点（3行）

1. `CLERK_WEBHOOK_SIGNING_SECRET` は、**Clerk の webhook の endpoint ごとに 1 つ**ある。Clerk の Development と Production では**別の値**になる。
2. 値は Clerk のダッシュボードで取得して、**backend を動かしている環境（Render）の環境変数**に入れる。コードにも git にも入れない。
3. 値がない、または間違っていると、webhook は**すべて 400 になり、ウェブからのアカウント削除が動かない**。アプリからの削除（`DELETE /api/v1/me`）には影響しない。

---

## 1. 何に使うか

`POST /api/v1/webhooks/clerk` は、Clerk の Account Portal でアカウントが削除されたとき（`user.deleted`）に呼ばれ、そのユーザーのデータを消す（§16.4）。

この URL は誰でも呼べるので、本物の Clerk からの通知かどうかを確かめる必要がある。Clerk（配信は Svix）は、この secret で計算した署名を `svix-signature` ヘッダーに付けて送る。backend の `verifyWebhook()`（`@clerk/express/webhooks`）は、同じ secret で署名を計算し直して比べる。合わなければ、偽物として処理しない。

- `verifyWebhook()` は、環境変数 `CLERK_WEBHOOK_SIGNING_SECRET` を自動で読む。**名前は 1 文字も変えない。**
- 値がないと、`verifyWebhook()` は `Missing webhook signing secret` で失敗する。**確かめられないときは、何も通さない（fail-closed）。**

## 2. production で作る・作り直す手順

次のどれかに当てはまるときに行う。

- production の環境を新しく作る
- webhook の endpoint を作り直した、または URL を変えた（**secret も変わる**）
- secret が漏れたかもしれない（→ §3 の rotate）

```text
1. Clerk Dashboard で、Production の instance を選ぶ（Development ではない）
2. Webhooks → Add Endpoint
     URL:    https://<production の backend>/api/v1/webhooks/clerk
     Events: user.deleted だけ
3. 作った endpoint の画面で Signing Secret（whsec_…）をコピーする
4. Render の production 用の service → Environment に追加する
     Key:   CLERK_WEBHOOK_SIGNING_SECRET
     Value: whsec_…
   保存すると再 deploy される。終わるまで待つ
5. Clerk の endpoint の画面の Testing から user.deleted の例を送る
     → Message Attempts に 2xx が出れば OK
```

- 手順 5 の例のイベントは、存在しないユーザーの ID なので、backend は何も消さずに 2xx を返す。
- Development（共有の開発用サーバー）でも手順は同じ。**Development の値を Production に使い回さない。**

## 3. secret を rotate する（漏れたかもしれないとき）

```text
1. Clerk の endpoint の画面で、Signing Secret を rotate する
2. すぐに Render の CLERK_WEBHOOK_SIGNING_SECRET を新しい値に変えて、再 deploy する
3. §2 の手順 5 で確かめる
```

- 手順 1 と 2 の間に届いた通知が 400 になっても、Svix は **2xx 以外を失敗として、時間をあけて送り直す**。そのため、送り直しの期間のうちに直せば、削除は取りこぼさない。取りこぼしたときは、endpoint の画面の Message Attempts から送り直せる。
- rotate の後もしばらく古い secret が有効か（猶予期間）は、Svix の仕様によるので、実際に作業するときに Clerk・Svix のドキュメントで確かめる。

## 4. うまくいかないとき

webhook の結果は、Clerk の endpoint の画面（Message Attempts）と、Render のログで見る。

| 症状 | 原因 | 直し方 |
|---|---|---|
| すべて 400。ログに `Missing webhook signing secret` | 環境変数が設定されていない、または名前が違う | §2 の手順 4 |
| すべて 400。ログに署名が合わないという内容 | 値が違う（Development の値を使った、endpoint を作り直したのに古い値のまま、rotate の後で更新していない） | §2 の手順 3〜4 で正しい値を入れ直す |
| deploy した後から、すべて 400 | `app.ts` で、Clerk の webhook の route が `express.json()` より後ろに移った。署名は受け取ったままの本文で確かめるので、JSON に変換された後では合わない | route を `express.json()` より前に戻す |
| 5xx | 署名は合っていて、削除（RevenueCat・OneSignal・DB）が失敗した | ログで原因を見る。Svix が送り直すので、直れば自動で消える |

## 5. やってはいけないこと

- 値を commit する、`console.log` する、チャットやスクリーンショットに出す
- 値を `.env.example` に書く（`.env.example` には `CLERK_WEBHOOK_SIGNING_SECRET=` と**名前だけ**を書く）
- 漏れたかもしれないのに、そのまま使い続ける（→ §3）
