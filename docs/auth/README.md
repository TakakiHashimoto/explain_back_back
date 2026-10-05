# 認証の使い方（backend）

> 対象：backend に、ログインが必要な route を追加するメンバー
> 方針（なぜこの形か）は `docs/spec.md` §9 Authentication and Application Identity を参照。この資料は「どう使うか」をまとめたもの。
> エラーの返し方は `docs/error-handling/README.md` を参照。
> 最終更新：2026-10-02

## 要点（3行）

1. ログインが必要な route は、Router に **`router.use(requireUser)`** を付ける。
2. handler では **`req.user!.id`**（内部の UUID）でユーザーを特定する。Clerk の `userId` は使わない。
3. client から送られてきた `userId` は**信用しない**。誰なのかは、必ず token から決める。

---

## 1. 認証の流れ

```text
mobile: getToken() で Clerk の session token を取得
   ↓  Authorization: Bearer <token>
backend: clerkMiddleware()      … token を検証する（app.ts で全 request にかかっている）
   ↓
requireUser                     … 未認証なら 401 UNAUTHENTICATED を返して終わる
   ↓                              認証済みなら、内部の User を get-or-create して req.user に入れる
handler                         … req.user!.id を使う
```

- `requireUser` は、初めてアクセスしたユーザーの `User` 行を自動で作る（upsert）。何度呼ばれても行は増えない。
- `requireUser` の中で DB のエラーが起きた場合は、error handler が `500 INTERNAL_ERROR` を返す。handler は呼ばれない。

## 2. ログインが必要な Router の作り方

```ts
// apps/backend/src/router/xxxRoutes.ts
import { Router } from "express";
import { requireUser } from "../middleware/require-user.js";

const router = Router();

router.use(requireUser); // この Router のすべての route が保護される

router.get("/", (req, res) => {
  res.json({ id: req.user!.id });
});

export default router;
```

```ts
// apps/backend/src/app.ts
app.use("/api/v1/xxx", xxxRoutes); // 404 handler より前に登録する
```

- route ごとに `requireUser` を付けるのではなく、**Router 全体に付ける**。付け忘れがなくなる。
- 保護された Router の中では、存在しない path でも、未認証なら 404 ではなく 401 が返る。未認証の相手に「その URL が存在するか」を教えないので、これで正しい。

## 3. `req.user` の使い方

```ts
const userId = req.user!.id;
```

**ルール：`req.user!` は、`router.use(requireUser)` が付いた Router の中でだけ使う。**

- `requireUser` を通った handler では、`req.user` は必ず入っている。未認証なら handler まで来ないため。
- それでも `!` が必要なのは、型の宣言が `user?: User`（optional）だから。TypeScript は「この route は `requireUser` を通った」ことまでは分からない。`/health` のように `requireUser` を通らない route もあるので、型は optional にしておくしかない。
- `!` は「ここでは必ずある」と人間が保証する印。`requireUser` を付け忘れた Router で使うと、`req.user` が `undefined` になり、500 エラーになる。

`req.user` に入っているもの（`prisma/schema.prisma` の `User`）：

| フィールド | 内容 |
|---|---|
| `id` | **内部の UUID**。他のテーブルから参照するのはこれ |
| `authSubject` | Clerk のユーザー ID。`User` テーブルの中だけで使う |
| `createdAt` / `updatedAt` | 作成・更新日時 |

## 4. ID のルール

### 外部キーには内部の `User.id` を使う（spec §9.1）

```prisma
model Topic {
  id     String @id @default(uuid())
  userId String // ← User.id（内部の UUID）を入れる
  user   User   @relation(fields: [userId], references: [id])
}
```

Clerk の ID（`authSubject`）を、他のテーブルに持たせない。認証のサービスを変えることになっても、直すのは `User` テーブルの1列だけで済む。

### client が送ってきた `userId` を信用しない（spec §9.3）

```ts
// ❌ body の userId をそのまま使う：他人になりすませる
await prisma.topic.create({ data: { title: req.body.title, userId: req.body.userId } });

// ✅ token から決まった req.user を使う
await prisma.topic.create({ data: { title: req.body.title, userId: req.user!.id } });
```

mobile 側も、request の body や URL に自分の `userId` を入れて送る必要はない。

## 5. 所有者のチェックは各 route で行う（spec §9.2、§46.5）

`requireUser` が確認するのは「**あなたは誰か**」（authentication）まで。
「**そのデータはあなたのものか**」（authorization）は、データを読み書きする各 route で確認する。

**他人のデータへのアクセスには `404 NOT_FOUND` を返す。** `403 FORBIDDEN` は使わない。

```ts
// 例：Topic を1件読む（Topic はまだ存在しないモデル）
const topic = await prisma.topic.findUnique({ where: { id: req.params.topicId } });

if (!topic || topic.userId !== req.user!.id) {
  sendError(res, "NOT_FOUND"); // 存在しない場合も、他人のものの場合も同じ返し方
  return;
}
```

- 「存在しない」と「他人のもの」を区別せずに、どちらも 404 にする。403 を返すと「その ID のデータは存在する」と相手に教えてしまう。ID を順番に試して、どのデータが存在するかを探られるのを防ぐため（GitHub も、権限のない private repository には 404 を返す）。
- `!topic` と `topic.userId !== req.user!.id` を同じ `if` にまとめると、2つの場合で返し方がずれる心配がない。

URL の `topicId` は、client がいくらでも書き換えられる。所有者のチェックを省くと、他人のデータを読めてしまう（spec §46.5「client が URL を手で組み立てても、backend は拒否しなければならない」）。

## 6. 動作確認

```bash
# 未認証 → 401
curl -i http://localhost:3000/api/v1/me
# {"error":{"code":"UNAUTHENTICATED","message":"Authentication required."}}
```

認証済みの確認は、アプリでサインインして呼ぶのが一番簡単。アプリなしで確認したいときは `curl.md` の手順で token を取得して呼ぶ。
