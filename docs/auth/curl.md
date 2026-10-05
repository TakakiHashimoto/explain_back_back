# 認証が必要な API を curl で呼ぶ

> 対象：Explain It Back のチームメンバー（A / B / C）
> 開発環境で、ログインが必要な API（`requireUser` を通る route）をアプリなしで確認するための手順。
> 認証の仕組みそのものは `README.md` を参照。

## 要点（3行）

1. Clerk CLI で **session を1回だけ** 作り、そこから **session token** を発行して `Authorization: Bearer <token>` で送る。
2. session token の有効期限は **約60秒**。401 が返ってきたら token だけ取り直す（session は作り直さなくてよい）。
3. 使うのは開発用の Clerk instance と開発用の DB だけ。本番では使わない。

---

## 1. backend を起動する

プロジェクトのルートで実行する。

```bash
bun run backend
```

## 2. 準備（ターミナルごとに1回）

別のターミナルで実行する。

```bash
BASE=http://localhost:3000
```

Clerk の user ID（`user_...`）を確認する。アプリで一度サインインしたユーザーを選ぶ。

```bash
bunx clerk@latest users list --limit 5 | jq '.data[] | {id, email: .email_addresses[0].email_address}'
```

session を作る。`user_xxx` は上で確認した値に置き換える。

```bash
SID=$(bunx clerk@latest api /sessions -d '{"user_id":"user_xxx"}' | jq -r .id)
echo "$SID"   # sess_... と表示されれば成功
```

## 3. token を取得する

401 が返ってきたら、このコマンドだけ再実行する。

```bash
TOKEN=$(bunx clerk@latest api /sessions/$SID/tokens -d '{}' | jq -r .jwt)
echo "${TOKEN:0:10}..."   # eyJ... で始まれば成功
```

## 4. API を呼ぶ

GET：

```bash
curl -i -H "Authorization: Bearer $TOKEN" $BASE/api/v1/me
```

POST（JSON body あり）：

```bash
curl -i -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -X POST $BASE/api/v1/<path> -d '{"key":"value"}'
```

`-i` を付けると、status code とレスポンスヘッダーも表示される。エラーのときは body の `error.code` を見る（→ `docs/error-handling/README.md`）。

## 5. うまくいかないとき

| 症状 | 原因 | 対処 |
|---|---|---|
| `echo "$SID"` が `null` または空 | `user_xxx` を置き換えていない、または存在しない user ID | 2 の `users list` で ID を確認し直す |
| `echo "${TOKEN:0:10}"` が `null` | `SID` が無効（`null` のまま、または session が失効した） | 2 の session 作成からやり直す |
| 401 `UNAUTHENTICATED` | token の有効期限（約60秒）切れ、または `Bearer null` を送っている | 3 を再実行する |
| 404 `NOT_FOUND` | パスの間違い。dev 用の route は `NODE_ENV=production` では無効 | パスと backend の起動環境を確認する |
| `curl: (7) Failed to connect` | backend が起動していない | 1 を実行する |

`jq -r` は、値がないと文字列の `null` を返す。エラーにならずに次のコマンドへ進んでしまうので、`echo` で値を確認してから使う。
