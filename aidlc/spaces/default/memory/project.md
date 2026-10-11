# Project-Level Rules

> Project-specific specialisation and corrections. Loaded after `org.md` and
> `team.md` as strict-additive guidance; contradictions with broader policy
> are rejected. Populated by practices-discovery and the self-learning loop.
>
> Use sparingly: most teams don't need a project layer. Reach for it
> only when this specific project needs stable, durable guidance beyond the
> team practice (for example, package-specific release checks or an additional
> regression suite for a legacy component).

## Way of Working

<!-- Project-specific specialisation. Example: -->
<!-- This monorepo requires package-scoped branch names and a package owner -->
<!-- review in addition to the team's normal merge policy. -->

## Walking Skeleton

<!-- Project-specific specialisation. Example: -->
<!-- The walking skeleton must exercise the legacy service adapter as well -->
<!-- as the new service boundary. -->

## Testing Posture

<!-- Project-specific specialisation. -->

## Guard Policy

<!-- Project-specific. Mode: strict, relaxed, or off. Strict here holds for every intent and cannot be changed from chat. A section under the retired Change Control heading, written by an earlier release, is still read. -->

## Deployment

<!-- Project-specific specialisation. -->

- 公開は GitHub Pages（公開元は GitHub Actions、`actions/deploy-pages`）。サイトは `web/`、`packages/terrarium` のバンドル、fixture、formicarium guest で構成する。ビルドは同一実行の Actions artifact として渡し、`main` や旧 `builds` ブランチへ追加しない。
- Pages は登録ツールの最新安定版を毎回解決し、公式 static musl バイナリを検証して取得するか、未変更ソースをビルドする。手動 ref と `web/tool-refs.json` はブランチ・タグ・コミット・PR、および fork の `owner/repo` に共通対応し、最新版の default を変更せず選択肢を追加する。Node と Chromium・Firefox・WebKit の検証成功後にデプロイする。
- COOP/COEP ヘッダーは `web/coi-serviceworker.js` が付与する。ヘッダーを設定できないホストでも動くことが前提。
- 詳細: `aidlc/spaces/default/knowledge/aidlc-shared/build-and-deploy.md`

## Code Style

<!-- Project-specific specialisation. -->

## Tech Stack

<!-- Technology choices locked for this project. -->

- CLI guest は static x86-64 musl ELF。ブラウザ内実行は固定入力で検証した formicarium RC のランタイムを使う。
- ソースビルドは登録情報の Cargo package/binary に従う共通 `mise-tasks/build/native.sh`。旧 Emscripten、nightly build-std、vendoring/tool パッチは使わない。別ビルド方式や非対応 syscall を必要とする新ツールには追加の builder/実行互換性の検証が必要。
- ブラウザ端末は xterm.js。端末要素とセッションは `packages/terrarium`（TypeScript、npm パッケージ `@aletheia-works/terrarium`）。公開済み `Session` API の互換性は維持する。

## Decided

<!-- Decisions made in earlier stages that should not be re-asked. -->
<!-- Format: DECIDED: [decision] (Stage [slug], [date]) -->

- DECIDED: すべてブラウザ内で実行し、サーバー側では何も実行しない (design discussion, 2026-10-02)
- DECIDED: ディストリビューションではなく 1 つの CLI だけを動かす。汎用シェルや任意バイナリは提供せず、端末組み込みは `ls` / `cat` / `rm -rf` / `cd` のみ (design discussion, 2026-10-02)
- DECIDED: エミュレーターもカーネルも使わず、CLI が使うシステムコールだけを提供する (design discussion, 2026-10-02)
- DECIDED: Vivarium とは別リポジトリとし、Vivarium が terrarium を利用する (design discussion, 2026-10-02)
- DECIDED: terrarium の目的は CLI をウェブ上で使えるようにすることだけ。ページは 1 つの端末で 1 つのビルドを動かし、ビルドは URL（`?ref=`）で選ぶ。修正前後の並列表示やバグ再現の説明は Vivarium の役目で、terrarium には置かない (user correction, 2026-10-04)
- DECIDED: 提供方法は複数用意する（リンク、カスタム要素 `<terrarium-terminal>`、iframe）。実装は要素 1 つにまとめ、ページと iframe はその上に作る。iframe の入口は残す (user decision, 2026-10-04)
- DECIDED: 1 コマンド 1 プロセス、1 セッション 1 ディスク。各コマンドは新しいインスタンスで起動し、ディスクから初期化して終了時に書き戻す (design discussion, 2026-10-02)
- DECIDED: 当面の非ゴールはネットワークアクセス、Node.js の実行（ライフサイクルスクリプト含む） (design discussion, 2026-10-02)
- DECIDED: 2 つ目のツールとして pitchfork を入れる。対象はスーパーバイザーを要しないコマンド（`--version`、`daemons add`、`status`、`settings`、`config` など）で、デーモンの起動・監視は対象外。旧方式では pitchfork 自身への変更を terrarium 側のパッチで保持したが、現在は未変更ソースと fork ref の登録へ移行 (user decisions, 2026-10-04 / 2026-10-11)
- 未決事項は `knowledge/aidlc-shared/design.md` の Open questions を参照。議論ではなく計測で決める。

## Scope Overrides

<!-- Custom scope rules for this project. -->

## Forbidden

<!-- Populated by practices-discovery affirmation gate. -->
<!-- Format: NEVER [behavior] (affirmed [date]) -->
<!-- Example: NEVER throw exceptions across service layer boundaries (affirmed 2026-05-17) -->

## Mandated

<!-- Populated by practices-discovery affirmation gate. -->
<!-- Format: ALWAYS [behavior] (affirmed [date]) -->
<!-- Example: ALWAYS use Result<T,E> for fallible operations in service layer (affirmed 2026-05-17) -->

## Corrections

<!-- Project-specific corrections from human feedback. -->
<!-- Format: NEVER/ALWAYS [behavior] (learned [date]) -->
