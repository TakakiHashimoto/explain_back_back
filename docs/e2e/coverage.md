# E2E 対応表（仕様書 → テスト）

**状態**：下書き（2026-11-08、2026-11-20 に見直し）
**もとにした仕様書**：`docs/仕様書.md`（日本語版、2026-11-20）
**もとにしたコード**：`dev`（`60f4307`。backend は `06369d6` から変わっていない）

仕様書の各節から、動かして確かめられる振る舞いを洗い出し、1 行につき 1 つの確かめ方を割り当てる。どの行も、下の「分類」のどれか 1 つに入る。これで「全体を網羅した」と言えるようにする。

## 分類

| 分類 | 意味 | 置き場所 |
|---|---|---|
| UI | Maestro で Android の画面から確かめる | `apps/mobile/.maestro/` |
| API | 本物の backend と使い捨ての DB に HTTP を送って確かめる | `apps/backend/e2e/` |
| 手動 | 人が手で確かめる。手順と記録欄がある | `docs/e2e/manual/` |
| 既存 | すでにある結合テストで確かめている | `apps/backend/scripts/*.test.ts` |
| 未実装 | 機能がまだない。実装されたらテストを書く | — |
| ずれ | 仕様とコードが違う。コードを直してからテストを書く | — |
| 対象外 | 動かして確かめるものではない（方式・設計の考え方）。コードレビューで見る | — |

「状態」の列は、テストがすでにあるか（`済`）、これから書くか（`新`）を表す。「要確認」は、実装を読み切れておらず、テストを書くときに確かめる行である。

## 第 3 部　アカウントと本人確認

| ID | 節 | 確かめること | 分類 | 状態 | テスト |
|---|---|---|---|---|---|
| A-01 | §12 | 初めての認証済みリクエストで User の行ができ、2 回目は同じ `id` が返る | API | 新 | `me.e2e.test.ts` |
| A-02 | §13、§59.4 | トークンなし・正しくないトークンでは、守られた API がすべて 401 `UNAUTHENTICATED` を返す | API | 新 | `auth.e2e.test.ts` |
| A-03 | §13、§59.5 | 他人の質問を読む・答えると 404 `NOT_FOUND` になる（403 ではない） | API | 新 | `ownership.e2e.test.ts` |
| A-04 | §14 | 本文に `userId` を入れても無視され、トークンの持ち主のデータとして扱われる | API | 新 | `ownership.e2e.test.ts` |
| A-05 | §15 | サインインするとホームが出る | UI | 済 | `common/sign-in.yaml` |
| A-06 | §15 | サインアウトするとサインイン画面に戻る | UI | 済 | `common/sign-out.yaml` |
| A-07 | §15 | アカウントを切り替えると、前の人のデータが出ない | UI | 済 | `one-due/4-switch-account.yaml` |
| A-08 | §15 | ホームに「説明してみよう」のカードがあり、押すと録音画面に行く | UI | 新 | `learn/start-from-home.yaml` |
| A-09 | §15.1 | 最初の録音の前に、OpenAI に声を送ることの同意画面が出る。同意のボタンでだけ同意になり（戻るなどは同意でない）、断ると録音ボタンを押すたびに出る | 未実装 | — | 合-20 |
| A-10 | §16 | アカウント削除（DB → Clerk の順、すべて消える、解約の案内） | 未実装 | — | `DELETE /api/v1/me` がない。ず-10 も先に直す必要がある |
| A-11 | §16.4 | ウェブからの削除：Clerk の `user.deleted` のウェブフックで User が消える。署名が正しくないと断る。同じ通知が 2 回来ても結果が同じ | 未実装 | — | `POST /api/v1/webhooks/clerk` がない。合-24 |

## 第 4 部　説明と分析

| ID | 節 | 確かめること | 分類 | 状態 | テスト |
|---|---|---|---|---|---|
| L-01 | §17、§69.1 | 録音 → アップロード → 文字起こし → 分析 → 結果画面（文字起こし・点数・理解できている点・弱点）が出る | UI | 新 | `learn/1-record-and-result.yaml` |
| L-02 | §18 | 2 分たつと録音が自動で止まる | 手動 | 新 | `manual/learn.md` |
| L-03 | §19、§55.3 | 説明の API のパスが `POST /api/v1/topics/:topicId/explanations` | ずれ | — | 今は `POST /api/v1/explanations`（topic は文字列）。ず-1。Topic は Kazi が作る予定（2026-11-20） |
| L-04 | §20 | 音声ファイルがない・m4a でない → 400 `INVALID_AUDIO` | API | 新 | `explanation.e2e.test.ts` |
| L-05 | §20 | 録音が 3 秒未満・2 分超 → 400 `INVALID_AUDIO` | API | 新 | `explanation.e2e.test.ts` |
| L-06 | §20 | ファイルが大きすぎる（例：10 MB 超）と断られる | API | 新・要確認 | `explanation.e2e.test.ts`（上限の値をコードで確かめる） |
| L-07 | §20 | 入力が正しくないリクエストでは、利用回数が減らない | API | 新 | `explanation.e2e.test.ts` |
| L-08 | §20 | 確認の順番が「音声 → 上限」：上限に達していても、正しくない音声には 400 `INVALID_AUDIO` が返る | API | 新 | `explanation.e2e.test.ts`（2026-11-20 に仕様書をコードに合わせた。#23） |
| L-09 | §21、§59.6 | 文字起こしに失敗すると `TRANSCRIPTION_FAILED`、記録は残らず、回数も減らない | API | 新 | `explanation.e2e.test.ts` |
| L-10 | §21 | 無音（文字起こしが空）だと `INVALID_AUDIO`、回数は減らない | API | 新 | `explanation.e2e.test.ts` |
| L-11 | §23 | 音声を保存しない | 対象外 | — | 保存先がないことをコードレビューで見る |
| L-12 | §24.2 | 弱点は 0〜3 個。0 個でも正常に結果が出る | API、UI | 新 | `explanation.e2e.test.ts`、`learn/2-no-gaps.yaml` |
| L-13 | §24 | 弱点 1 つにつき質問が 1 問でき、復習一覧に出る | API、UI | 新 | `explanation.e2e.test.ts`、`learn/1-record-and-result.yaml` |
| L-14 | §24、§2 | 分析が本人の誤解を正しく見つける（分析の質） | 手動 | 新 | `manual/analysis.md` |
| L-15 | §24.1 | 分析の後に弱点ごとに質問ができる。作れなかった弱点は `reviewGeneration.failedGapIds` で返り、分析は成功のまま | API | 新 | `explanation.e2e.test.ts`（2026-11-20 に仕様書をコードに合わせた。#21） |
| L-16 | §25、§59.8 | AI の出力が形に合わない（弱点が 4 つ以上など）と保存せず、決まった形のエラーを返す | ずれ | — | コードは弱点を 5 つまで受け付ける（`analysisSchema.ts` の `.max(5)`）。仕様書は 3 つ（§24.2、合-5）。形の確認そのものは API で書ける。#25 |
| L-17 | §26、§27、§55.2 | Topic の作成・読み取り・更新・削除、セッションの状態、分析だけのやり直し | 未実装 | — | ず-1、合-1、合-6 |
| L-18 | §28、§59.10 | 分析結果は全部保存するか、何も保存しない | 対象外 | — | E2E では保存の途中に故障を起こせない。コードレビューで見る |
| L-19 | §30 | 処理中は段階を伝える表示が出て、% は出ない | UI | 新 | `learn/3-processing-and-double-tap.yaml` |
| L-20 | §31 | 点数 4 つと理解できている点を、セッションに保存する | ずれ | — | 今は結果を返すだけで、テーブルに列がない（§52）。Topic と一緒に直す |
| L-21 | §32 | Topic を消すと下の記録も消え、回数は戻らない | 未実装 | — | 合-8 |
| L-22 | §59.1 | マイクの許可を断ると理由が出て、設定アプリへの案内がある | UI | 新 | `learn/4-mic-denied.yaml` |
| L-23 | §59.2 | 録音に失敗しても、ほかの状態を失わずにやり直せる | 手動 | 新 | `manual/learn.md`（故障を起こせない） |
| L-24 | §59.3 | オフラインでアップロードに失敗すると、やり直せる状態になり、録音は残る | UI | 新 | `offline/6-upload-error.offline.yaml` |
| L-25 | §59.7 | 分析に失敗すると `ANALYSIS_FAILED`、回数は減らず、録音し直さずに送り直せる | API、UI | 新 | `explanation.e2e.test.ts`、`learn/5-analysis-failure.yaml` |
| L-26 | §59.11 | 送信中は送信ボタンを押せない（二重送信を防ぐ） | UI | 新 | `learn/3-processing-and-double-tap.yaml` |
| L-27 | §59.11 | サーバーはアプリより先に打ち切り（例：90 秒）、打ち切った分析は数えない | 手動 | 新・要確認 | `manual/learn.md`（打ち切りの時間をコードで確かめる） |
| L-28 | §20 | 分析の残りが 0 回だと録音を始めず、無料なら課金画面、Pro なら次の区切りの日時が出る。残り回数を取れないときは録音できる | 未実装 | — | #18 |

## 第 5 部　復習と定着

| ID | 節 | 確かめること | 分類 | 状態 | テスト |
|---|---|---|---|---|---|
| R-01 | §33 | `POST /knowledge-gaps/:gapId/review-questions` で作れなかった質問ができる。すでにあれば同じ質問が 200 で返り、回答と予定は変わらない。利用回数は減らない | API | 新 | `review.e2e.test.ts`（2026-11-20 に仕様書をコードに合わせた。#21） |
| R-02 | §34 | 同じ質問に何度も答えると、回答がすべて残る | API | 新 | `review.e2e.test.ts` |
| R-03 | §35、§69.1 | 回答すると点数と評価が出て、一覧に戻ると消える | UI | 済 | `one-due/1-submit-and-return.yaml` |
| R-04 | §35 | 他人の質問・ない質問への回答では、回数が減らない（持ち主の確認が上限の確認より先） | API | 新 | `ownership.e2e.test.ts` |
| R-05 | §35 | 評価に失敗すると回答は保存されず、回数も減らない | API、UI | 新、済 | `review.e2e.test.ts`、`one-due/3-evaluation-failure.yaml` |
| R-06 | §35 | 85 点以上だけが正解（84 → 不正解、85 → 正解） | API | 新 | `review.e2e.test.ts` |
| R-07 | §35 | 送信中の表示と二重送信の防止 | UI | 済 | `one-due/2-loading-and-double-tap.yaml` |
| R-08 | §36 | 次の復習日：49 → 1 日、50・69 → 2 日、70・84 → 4 日、85 → 7 日（境界値） | API | 新 | `review.e2e.test.ts` |
| R-09 | §37、§38 | 2 回続けて正解で克服（`resolvedAt`）、克服したものは一覧と通知から消える | 未実装 | — | `resolvedAt` がない。合-11 |
| R-10 | §38 | 期限の前でも答えられ、その回答も回数に数える | API | 新 | `review.e2e.test.ts` |
| R-11 | §39 | 期限の来た復習を見つけて、正しい相手に通知を送る | 既存 | 済 | `review-reminders.test.ts` |
| R-12 | §39、§42 | 通知が端末に届き、押すとその質問の画面が開く | 手動 | 新 | `manual/notifications.md` |
| R-13 | §40、§43 | 15 分ごとに定期実行する | 手動 | 新 | `manual/notifications.md` |
| R-14 | §41 | 最初の回答の後に、アプリの画面で通知を受け取るか聞き、「はい」のときだけ OS の許可を求める（Android 13 以上） | UI | 新・要確認 | `retain/notification-prompt.yaml`（エミュレーターは API 33 以上） |
| R-23 | §41 | Android 12 以前では、「はい」を選んでも OS のダイアログは出ず、通知は届く | 手動 | 新 | `manual/notifications.md` |
| R-15 | §42 | `explainitback://review/<questionId>` を開くと、その質問の画面が出る | UI | 新 | `retain/deep-link.yaml` |
| R-16 | §42 | サインインしていないときにディープリンクを開くと、サインインの後にその画面が出る | UI | 新・要確認 | `retain/deep-link-signed-out.yaml` |
| R-17 | §44 | 復習一覧には期限の来たものだけが、期限の古い順に出る | API、UI | 新、済 | `review.e2e.test.ts`、`mixed/due-filter.yaml` |
| R-18 | §44 | 復習一覧に他人の質問が出ない | API、UI | 新、済 | `ownership.e2e.test.ts`、全フロー（user2 の質問） |
| R-19 | §44 | 期限の来た復習がないと、空の表示が出る | UI | 済 | `empty/empty-list.yaml` |
| R-20 | §44、§55.4 | `GET /api/v1/reviews/history` は自分の回答だけを、新しい順に最大 20 件返す | API | 新 | `review.e2e.test.ts`、`ownership.e2e.test.ts`（2026-11-20 に残すと決めた。#24） |
| R-21 | §59.3 | オフラインで一覧の読み込みに失敗すると、やり直せる | UI | 済 | `offline/1-error`、`offline/2-retry` |
| R-22 | §59.12 | 通知に失敗しても、復習のデータは壊れない | 既存 | 済 | `notification-safety.test.ts` |

## 第 6 部　料金と Pro

| ID | 節 | 確かめること | 分類 | 状態 | テスト |
|---|---|---|---|---|---|
| P-01 | §46 | RevenueCat の App User ID が `User.id` になっている | 手動 | 新 | `manual/purchase.md`（RevenueCat の dashboard で見る） |
| P-02 | §46 | サインアウトすると `OneSignal.logout()` が呼ばれ、前の人宛ての通知が届かない | 手動 | 新 | `manual/notifications.md` |
| P-03 | §47、§49 | 無料：分析の 4 回目、復習の 19 回目が 429 `FREE_LIMIT_REACHED` | API | 新 | `usage.e2e.test.ts` |
| P-04 | §47、§49 | Pro：分析の 21 回目、復習の 121 回目が 429 `USAGE_LIMIT_REACHED` | API | 新 | `usage.e2e.test.ts` |
| P-05 | §49 | 7 日たった後の利用で、新しい区切りが始まる | API | 新 | `usage.e2e.test.ts` |
| P-06 | §49 | プランが変わると区切りが終わり、変わった後の最初の利用から新しい 7 日間が始まる | API | 新 | `usage.e2e.test.ts` |
| P-07 | §50 | 「実行中」のまま 10 分たった記録は数えない | API | 新 | `usage.e2e.test.ts` |
| P-08 | §50、§59.11 | 残り 1 回のときに同時に 2 つ送ると、1 つだけが通る | API | 新 | `usage.e2e.test.ts` |
| P-09 | §49 | 無料の分析の上限に達すると課金画面が出る | UI | 新 | `monetize/1-free-limit-paywall.yaml` |
| P-21 | §49 | 無料の復習の上限に達すると課金画面が出る | ずれ | — | アプリが 429 の `error.code` を読まず、一般的なエラーになる（`api.review.ts:133-136`）。#20 |
| P-10 | §49 | Pro の上限に達すると、次に使えるまでの時間が出る | UI | 新・要確認 | `monetize/2-pro-limit.yaml` |
| P-11 | §48 | 認証ヘッダーのない・違う webhook は断られる | API | 新 | `webhook.e2e.test.ts` |
| P-12 | §48.2 | webhook を受けたら RevenueCat から取り直して上書きし、同じ通知が 2 回来ても結果が同じ | 既存 | 済・要確認 | `revenuecat.test.ts`（中身を確かめる） |
| P-13 | §48.2、§55.5 | 購入直後に `POST /api/v1/me/entitlement/refresh` で取り込み、すぐ Pro になる | UI | 新 | `purchase/1-buy.yaml`（P-15 と同じフロー。2026-11-20 に仕様書をコードに合わせた。#22） |
| P-14 | §51、§51.1 | 課金画面に月額と年額の 2 つのプランが出る。商品ごとに価格、請求の間隔、自動で更新されること、解約の方法が出る | UI | 新 | `monetize/3-paywall-plans.yaml` |
| P-22 | §51.1 | 年額の商品で、月あたりの金額をいちばん目立たせていない（Google Play の定期購入のポリシー） | 手動 | 新 | `manual/purchase.md`（見た目の判断） |
| P-15 | §45、§48.1、§69.1 | Test Store で購入すると、すぐに Pro の表示と Pro の上限になる | UI | 新 | `purchase/1-buy.yaml`（user3） |
| P-16 | §63、§69.1 | 購入を復元すると Pro に戻る | UI | 新 | `purchase/2-restore.yaml`（user3） |
| P-17 | §51.1 | 課金画面と Account 画面にプライバシーポリシーへのリンクがある | UI | 新・要確認 | `monetize/3-paywall-plans.yaml` |
| P-23 | §51.1 | 課金画面と Account 画面に利用規約へのリンクがある | 未実装 | — | 何を使うか決まっていない（未-5） |
| P-18 | §63.1 | Account 画面にメールアドレス、プラン、残り回数、区切りの開始日時、アップグレード、復元、定期購入の管理、通知、規約、サインアウトがある | UI | 新・要確認 | `account/profile-contents.yaml` |
| P-19 | §63.1 | Account 画面で読み込みに失敗すると、やり直せる | UI | 済 | `offline/3-profile-error`、`offline/4-profile-retry` |
| P-20 | §63.1 | Account 画面からアカウントを削除できる | 未実装 | — | A-10 と同じ |

## 横断

| ID | 節 | 確かめること | 分類 | 状態 | テスト |
|---|---|---|---|---|---|
| X-01 | §57 | エラーは `{ "error": { "code", "message" } }` の形で返り、中の例外は出さない | API | 新 | 各 `*.e2e.test.ts` で、エラーのたびに形も確かめる |
| X-02 | §57 | 復習の処理も、決まった形でエラーを返す | ずれ | — | ず-5。`features/review/controllers/` の 9 か所が `{ error: "文字列" }` を返す（2026-11-20 に確かめた）。#19 |
| X-03 | §69.1 | 通しの流れ：サインイン → 録音 → 結果 → 復習一覧 → 回答 → 評価 | UI | 新 | `journey/golden-path.yaml` |
| X-04 | §4.2 | 通しの流れ（iOS） | 対象外 | — | アプリは Android だけにした（合-23） |

## 集計

| 分類 | 行数 |
|---|---|
| UI | 32（済 11、新 21） |
| API | 33 |
| 手動 | 10 |
| 既存 | 3 |
| 未実装 | 9 |
| ずれ | 5 |
| 対象外 | 3 |

全部で 89 行。UI と API の両方で確かめる行が 6 行あり、それぞれの数に入れている。数は 2026-11-20 の見直しの時点のもので、行を足したら直す。

## テストを書く前に足すもの（PR ②）

| もの | 理由 | 関係する行 |
|---|---|---|
| `FAKE_AI_ANALYSIS=true` | 分析 (`analyzeExplanation`) と質問作り (`generateReviewQuestion`) を、OpenAI を呼ばずに決まった結果にする。topic の中の印で結果を変える（`gaps=N`、`fail`、`invalid`、`delay=NNNN`、質問作りだけ失敗させる `question-fail`） | L-01、L-12、L-13、L-15、L-16、L-19、L-25、L-26、R-01 |
| 文字起こしの dry run の印 | topic の中の印で、失敗 (`transcribe-fail`) と空の文字起こし (`silent`) を起こす | L-09、L-10 |
| fixture の追加 | `limit-1`（分析・復習の残り 1 回）、`pro`、`pro-limit-1`、`window-expired`、`stale-reserved` | P-03〜P-10 |
| m4a のテスト用ファイル | 2 秒・5 秒・121 秒と、m4a でないファイル | L-04、L-05 |
| 録音画面の testID | 録音・停止・送信・結果・弱点・失敗の表示 | L-01、L-12、L-19、L-22、L-24〜L-26 |
| `docker-compose.e2e.yml` と `bun run test:e2e` | API の層の使い捨ての DB | API の行すべて |

## 2026-11-20 の見直しで変えたこと

- ずれ 8 行のうち 5 行（L-08、L-15、R-01、R-20、P-13）は、仕様書をコードに合わせた（`60f4307`）。テストを書ける行になった。
- X-02 はずれと確かめた（#19）。L-03、L-20 はずれのまま（Topic を作るときに直す）。
- 新しいずれ：L-16（弱点の数の上限）、P-21（復習の上限で課金画面が出ない、#20）。
- 仕様書を Android だけにした（2026-11-09）ので、X-04 を対象外にし、A-09、A-11、R-14、R-23、P-14、P-17、P-22、P-23 を直した・足した。
- L-28（録音の前の残り回数の確認、#18）を足した。

## 次にやること（今回はやらない）

- API の層を CI（GitHub Actions）で動かす。PostgreSQL は service container で用意し、Clerk の secret key は GitHub Secrets に入れる。チームの合意が要る（§64）。
- 「未実装」と「ずれ」の行は、コードを直したら分類を変えてテストを書く。
