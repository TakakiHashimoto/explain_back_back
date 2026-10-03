# エラーハンドリングの使い方（backend）

> 対象：backend に route / middleware を追加するメンバー
> 方針（なぜこの形か）は `docs/spec.md` §59 Error Contract を参照。この資料は「どう使うか」をまとめたもの。
> 最終更新：2026-10-02

## 要点（3行）

1. エラーを返すときは **`sendError(res, "<CODE>")`** を使う。`res.status().json()` で直接書かない。
2. 使える code は **`apps/backend/src/lib/errors.ts` の `ERRORS`** にあるものだけ（これが正本）。
3. 想定外のエラーは `throw` するだけでよい。共通の error handler が `500 INTERNAL_ERROR` に変換する。

---

## 1. レスポンスの形

API が返すエラーは、すべて次の形に揃える。

```json
{
  "error": {
    "code": "UNAUTHENTICATED",
    "message": "Authentication required."
  }
}
```

| フィールド | 読む人 | 変えてよいか |
|---|---|---|
| `code` | **プログラム**（mobile が `if` / `switch` で分岐する） | 変えると mobile が壊れる。**contract の一部** |
| `message` | **人間**（開発者、log） | いつでも変えてよい |

mobile 側では、必ず `code` で分岐する。`message` の文字列で分岐しない。

## 2. 基本の使い方

```ts
import { sendError } from "../lib/errors.js";

router.get("/:topicId", async (req, res) => {
  const topic = await prisma.topic.findUnique({ where: { id: req.params.topicId } });

  if (!topic) {
    sendError(res, "NOT_FOUND");
    return; // ← 忘れない（下の「注意」を参照）
  }

  res.json(topic);
});
```

- status code は `ERRORS` の表から自動で決まる。呼ぶ側で `404` などを書く必要はない。
- 表にない code を渡すと **typecheck エラー**になる。typo もここで見つかる。

```ts
sendError(res, "NOT_FUOND");
// error TS2345: Argument of type '"NOT_FUOND"' is not assignable to parameter of type
// '"UNAUTHENTICATED" | "BAD_REQUEST" | "NOT_FOUND" | "INTERNAL_ERROR"'.
```

### ⚠️ 注意：`sendError` のあとは `return`

`sendError` はレスポンスを送るだけで、関数の実行は止めない。`return` を忘れると、後ろの処理が続いて二重にレスポンスを送ろうとし、`Cannot set headers after they are sent` というエラーになる。middleware の中では、`next()` まで進んでしまうので特に注意する。

## 3. 自動で処理されるもの（何も書かなくてよい）

`apps/backend/src/app.ts` の末尾に、共通の handler が登録されている。

| 状況 | 返るもの | 担当 |
|---|---|---|
| 存在しない URL | `404 NOT_FOUND` | 404 handler（すべての route の後ろ） |
| 壊れた JSON の body など、`status` が 4xx のエラー | `400 BAD_REQUEST` | error handler |
| route の中で `throw` された想定外のエラー | `500 INTERNAL_ERROR` | error handler |
| `async` の route / middleware で起きたエラー（DB 接続の失敗など） | `500 INTERNAL_ERROR` | error handler（Express 5 は rejected promise を自動で転送する） |

- 想定外のエラーの中身（stack など）は **server の log にだけ出し、client には返さない**（spec §59「Do not leak raw internal exceptions」）。
- 新しい route は、`app.ts` の 404 handler より**前**に登録する。後ろに置くと、すべて 404 になる。

## 4. 認証が必要な route

`requireUser` を Router 全体にかける。未認証なら `401 UNAUTHENTICATED` が自動で返る。

```ts
const router = Router();
router.use(requireUser); // この Router のすべての route が保護される
router.get("/", (req, res) => {
  res.json({ id: req.user!.id });
});
```

## 5. 新しい code を追加する手順

例：`FORBIDDEN`（認証済みだが、そのリソースへの権限がない）を追加する場合。

1. `apps/backend/src/lib/errors.ts` の `ERRORS` に1行足す。
   ```ts
   FORBIDDEN: { status: 403, message: "You do not have permission to access this resource." },
   ```
2. `docs/spec.md` §59 の code 一覧に載っていなければ足す（チームの contract なので）。
3. 下の「6. 現在の code 一覧」を更新する。
4. PR の description に「code を追加した」と書く。mobile 側の対応が必要になることがあるため。

code の名前は `UPPER_SNAKE_CASE` にし、「何が起きたか」を表す名前にする（例：`FREE_LIMIT_REACHED`、`INVALID_AUDIO`）。

## 6. 現在の code 一覧

正本は `errors.ts`。食い違っていたら、`errors.ts` が正しい。

| code | status | message | いつ使うか |
|---|---|---|---|
| `UNAUTHENTICATED` | 401 | Authentication required. | token がない、または無効（`requireUser` が自動で返す） |
| `BAD_REQUEST` | 400 | Invalid request. | request の形が不正（壊れた JSON は自動で返る） |
| `NOT_FOUND` | 404 | Route not found. | URL やリソースが見つからない |
| `INTERNAL_ERROR` | 500 | Something went wrong. | 想定外のエラー（error handler が自動で返す） |

spec §59 には、ほかにも code の候補（Potential codes）が挙がっている：`FORBIDDEN`、`INVALID_AUDIO`、`TRANSCRIPTION_FAILED`、`ANALYSIS_FAILED`、`INVALID_AI_RESPONSE`、`FREE_LIMIT_REACHED`。使うときに `errors.ts` に追加する。

## 7. やってはいけないこと

| ❌ やらない | ✅ 代わりに |
|---|---|
| `res.status(404).json({ error: "not found" })` と直接書く | `sendError(res, "NOT_FOUND")` |
| `message` に内部の情報（SQL、stack、外部 API の生のエラー）を入れる | 中身は `console.error` で log に出し、client には code だけ返す |
| mobile で `message` の文字列を見て分岐する | `code` で分岐する |
| `errors.ts` にない code を文字列で返す | 先に `errors.ts` に追加する |
