---
name: greasyfork-publish
description: Prepare a userscript for Greasy Fork and fill in the form in the user's Chrome (via chrome-devtools MCP) — either "Post a new script" with English + Simplified Chinese additional info, or a new version of an existing script with a bilingual changelog (§6). The user reviews and submits the form themselves. Manual only.
argument-hint: "[<script-name>/<script-name>.user.js]"
disable-model-invocation: true
---

# Publish a Userscript to Greasy Fork

Arguments: `$ARGUMENTS` — the `*.user.js` file to publish. If omitted, ask which one (or use the only `*.user.js` changed most recently).

**Never click "Post script".** Fill the form, verify it, bring the tab to front, and hand over. The user submits.

For a new version of an **existing** script, read §6 first — that flow is narrower: code + bilingual changelog only, and "what changed" comes from local Git, never from Greasy Fork.

---

## 1. Pre-flight: metadata block

Greasy Fork rejects or flags scripts missing these. Fix them in the local file **before** filling the form.

| Key | Rule |
|---|---|
| `@name` | Default (no suffix) in English. This plus `@description` decides the form's Locale. |
| `@name:xx` | Don't add localized names. The product name stays the same whatever the browser language is; remove any `@name:xx` lines you find. |
| `@description:xx` | Follow the project `AGENTS.md` on which locales to include. Keep descriptions to user-visible features; leave out cosmetic details. |
| `@namespace` | Keep stable across versions; changing it (or `@name`) makes Tampermonkey treat it as a different script. |
| `@version` | Follows the 版本更新 section of the project `AGENTS.md`; normally already bumped when the script was changed. |
| `@license` | **Required.** Without it the post fails with "You did not specify a @license". Match the repo's other scripts (`grep -h "@license" */*.user.js`) and the repo's `LICENSE` file; if neither settles it, ask. |
| `@homepageURL` / `@supportURL` | Point to the GitHub repo and its `/issues`. Check both URLs return 200 (`curl -s -o /dev/null -w '%{http_code}'`). |
| `@author` | Use the form the project `AGENTS.md` prescribes; if it prescribes none, match the repo's other scripts (`grep -h "@author" */*.user.js`). Never take a name or email from `git config`, the signed-in Greasy Fork account or the system: the published contact is the developer's choice. If the repo gives no consistent value, ask. |
| `@icon` | Use a stable official URL (e.g. `https://github.githubassets.com/favicons/favicon.svg`); verify it returns 200. |
| `@grant` / `@connect` | Every one must be explained in the additional info (see §3). |

Then run a syntax check: `node -e "new Function(require('fs').readFileSync('<file>','utf8'))"`.

## 2. Fill the form (chrome-devtools MCP)

The user opens `https://greasyfork.org/<lang>/script_versions/new` and is signed in. Find it with `list_pages`.

The page has **three** `<form>`s; the two first are the site-language switchers. Target `#new_script_version` explicitly.

| Field | Selector | How |
|---|---|---|
| Script type | `input[name="script[script_type]"]` | Leave **Public** (value `1`) unless told otherwise. |
| Code | `#script_version_code` (textarea) | See below. |
| Code upload | `#code-upload` (file input) | Only as a transport; clear it afterwards. |
| Additional info #0 | `#script-version-additional-info-0` + radio `#script_version_additional_info_0_value_markup_markdown` | English, Markdown (default is already Markdown). |
| Add localized info | `button#add-additional-info` | Click once → creates block `[1]`. |
| Additional info #1 | `#script-version-additional-info-1`, `select[name="script_version[additional_info][1][locale]"]`, radio `#script_version_additional_info_1_value_markup_markdown` | New block defaults to **HTML and no locale** — set locale to `Chinese (China) (zh-CN)` and Markdown. |
| Screenshots | `#script_version_attachments` (file input, multiple) | Max **5** PNG/GIF/JPEG/WebP, **< 1 MB** each. Usually `<script>/screenshots/<script>-*.png`. |
| Adult content | `#script_adult_content_self_report` | Leave unchecked. |
| Locale | `select[name="script[locale_id]"]` | `English (en)` — must match default `@name`, `@description`, and the **first** additional info. |

**Code: upload, then copy into the textarea.** Don't paste 20 KB of source into an `evaluate_script` literal.

1. `take_snapshot` (save to a file with `filePath` — the snapshot is long because of the locale lists) and grep for `Choose File` to get the code-upload uid, and `Add:` for the attachments uid.
2. `upload_file` the local script to the code-upload uid.
3. `evaluate_script`: read `input.files[0].text()`, set `#script_version_code.value`, dispatch `input`, then set `#code-upload.value = ''` so only the textarea is submitted.
4. Verify: textarea `length` equals `node -e "console.log(require('fs').readFileSync('<file>','utf8').length)"` (JS counts UTF-16 units, so compare with Node, not `wc -c`).

Set text fields and selects with `evaluate_script` and dispatch `input`/`change` events. Pick select options by their label (`/\(zh-CN\)/`, `'English (en)'`), not hard-coded numeric values.

**Final check** — one `evaluate_script` returning: code length and `@version`/`@license`, both additional-info lengths, block #1 locale + markdown flag, attachment names and sizes, main Locale, code-upload empty. Then `select_page` with `bringToFront: true`.

## 3. Additional info content

Only two languages: **English (block #0)** and **Simplified Chinese (block #1)**, same structure. Write for users, not developers.

```markdown
<One-sentence pitch: what it makes easier.>

## Features
### <Page or area 1>
- <Feature: what the user sees/does. Bold the UI words: **Copy**, **Collapse all**.>
### <Page or area 2>
- …

## <Setup, if any — e.g. "GitHub token">
<Why it's needed; a small table if behavior differs by page/case.>
1. <Step: where to create it; which scopes (prefer "no scopes needed").>
2. <Step: Tampermonkey menu → **<menu command name exactly as in code>**.>
3. <How to clear/reset.>
<Where the secret is stored and where it is sent.>

## Permissions
- `GM_xmlhttpRequest` with `@connect`: <why — e.g. the site's CSP blocks these cross-origin requests>.
  - `<host>`: <what is fetched>.
- `GM_setClipboard`: <why>.
- `GM_getValue`, `GM_setValue`, `GM_registerMenuCommand`: <why>.

## Notes
- <Feedback/states the user will see, e.g. success/failure icons and where to read the error.>
- <Known fragility, e.g. depends on the site's DOM.>
```

Chinese block: translate naturally (权限说明、说明…), keep code identifiers, hostnames and menu command names unchanged.

Before writing, re-read the script to confirm every claimed feature exists and every `@grant`/`@connect` is covered. Don't mention cosmetic tweaks the user asked to keep out of `@description`.

## 4. If the post fails

Greasy Fork re-renders the form at `/script_versions` with the error at the top.

- **Kept:** code textarea, additional info blocks (incl. locale), main Locale.
- **Lost:** every file input — **screenshots must be re-attached**, and the code-upload input is empty.

Fix the cause in the **local file first**, then update the textarea (re-upload + copy, or targeted `replace` in the textarea), re-attach the same screenshots, re-run the final check, and hand back.

## 5. Hand-off message

Report as a table: script type, code (length + version, "matches local file"), both additional infos (language, format, length), screenshots (names), adult content, locale. Then list things the user should check before clicking **Post script**:

- Screenshots that may predate recent UI changes.
- Features present in the code but missing from `@description`.
- The **Preview** tab of the additional info (tables/links render).
- Uncommitted local changes (`git status --short`).

## 6. Updating an existing script

The user opens `https://greasyfork.org/<lang>/scripts/<id>-<slug>/versions/new` in Chrome themselves, already signed in, and names the script to update. Don't navigate, don't search for the page, and **don't reconcile anything with the published copy on Greasy Fork** — the live script is the output of this flow, never an input to it.

Screenshot updates sit outside this flow. Replacing an image on Greasy Fork does not require a new version, and a changed screenshot does not mean the code changed, so never read one as a version delta when filling §6.1. Whether to publish at all is the user's call.

### 6.1 What changed: from local Git

The baseline is the newest commit whose `@version` line differs from the working tree's; everything after it is this release. The user commits after each publish, so these are the only two cases:

1. **Case A — uncommitted (the common case):** `git status --short <file>` and `git diff -- <file>` against HEAD.
2. **Case B — committed but unreleased:** find the baseline commit — the newest commit touching `<file>` whose `@version` differs from the working tree's — then `git diff <commit>:<file> <file>`.
3. **Check the version number** against the delta, using the versioning rules in the project `AGENTS.md`: PATCH by default, MINOR for new user-visible features or wider scope, MAJOR only when the user asked for it or when it tracks the target tech stack's major version. If it doesn't match, correct `@version` in the local file per those rules and say so in the hand-off.
4. Never download the published `.user.js`, fetch `/versions`, or byte-compare published screenshots.

### 6.2 Changelog — the only new content to write

`#script_version_changelog` starts empty, and its markup radio defaults to **HTML** — switch to `#script_version_changelog_markup_markdown`. Write **bilingual, English first then 中文**, one bullet list each, describing user-visible behaviour from the delta in 6.1 (no metadata or cosmetic lines):

```markdown
**English**
- <what users see or do differently>

**中文**
- <同上>
```

### 6.3 Form mechanics

Form is `#new_script_version`, same shape as §2, with these differences:

| Field | Handling |
|---|---|
| Code | Prefilled with the **currently published** code — ignore it. Overwrite with the local file via §2's upload → `files[0].text()` → set value → dispatch `input` → clear `#code-upload`. |
| Additional info #0 / #1 | Prefilled; leave both untouched (6.1.4 — a major bump is the only reason to revisit, and then only when the user asks). Skip §3. |
| Screenshots | Existing ones are kept by hidden signed `script_version[attachments][]` inputs; a `remove-attachment-<token>` checkbox drops one (the token decodes to `{"_rails":{"data":<blob id>}}`). Map local files to attachments **by the filename in the blob redirect URL** — no downloads, no byte comparison. Replace a screenshot only when its local file changed in the 6.1 delta. |
| Changelog | §6.2. |
| Script type / locale / adult content | Prefilled; leave as-is. |

### 6.4 Final check and hand-off

One `evaluate_script` returning: code length + `@version` + sha256 of the textarea (compare with `sha256sum` on the local file) + `#code-upload` empty; changelog length + Markdown flag; attachments (kept / to-be-removed / newly added); additional-info lengths unchanged. Then `select_page` with `bringToFront: true` and hand over per §5, stating which local changes each changelog bullet came from. **Still never click "Post new version".**
