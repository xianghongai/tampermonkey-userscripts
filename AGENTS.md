# AGENTS.md

这个项目，Agent 不用 Git Commit 和 Push，除非开发者有明确批示。

## 目录结构

一个脚本一个目录，目录名与脚本文件名去掉 `.user.js` 后一致，使用 kebab-case。根目录只放项目级文件（`AGENTS.md`、`CLAUDE.md`、`.gitignore`、`.agents/`、`test/`），不放脚本、截图或 README 以外的脚本资料。`test/` 只放各脚本测试页共用的测试设施。

脚本目录内的文件：

| 路径 | 必需 | 内容 |
| :--- | :--- | :--- |
| `<script-name>/<script-name>.user.js` | 是 | 脚本本体 |
| `<script-name>/README.md` | 是 | 脚本说明，写法见下节 |
| `<script-name>/screenshots/<script-name>-<scene>-1280x800.png` | 否 | 生成的截图 |
| `<script-name>/screenshots/src/<script-name>-<scene>.html` | 否 | 截图的 HTML 原稿，界面变化时改原稿再重新渲染 |
| `<script-name>/test/<script-name>-test.html` | 否 | 测试页，用浏览器直接打开，先引入 `test/gm-mock.js` 再引入脚本本体；脚本行为变化时同步更新用例 |

- 截图文件名保留 `<script-name>-` 前缀。Greasy Fork 更新时按文件名对应已发布的截图，改名会导致对不上。
- 截图原稿里的渲染命令以项目根目录为工作目录，路径写到脚本目录一级，例如 `<script-name>/screenshots/src/...`。
- 本地设计文档放 `docs.local/<script-name>/`，由 `.gitignore` 的 `*.local/` 忽略，不入库。
- 新增脚本时同时建立目录与 README；脚本改名时目录、文件名、截图前缀一起改。

## README

README 给使用者看，只讲用途，不讲技术实现。

- 内容只包含：一句话说明解决什么问题、在哪些页面生效、使用者看到或能做的功能、必要的使用前提（例如需要设置 Token 时的操作步骤）、截图（有才放）。
- 不写选择器、正则、注入时机、DOM 结构、`@grant` 原理、程序结构、设计取舍等实现细节。这些放在脚本注释或 `docs.local/`。
- 保持简洁：功能用短列表，每条一句；不写背景故事，不重复 `@description` 以外的营销文案。
- 使用简体中文，内容与脚本的 `@description:zh-CN` 保持一致；标题直接使用默认 `@name`，不翻译。脚本功能变化时同步更新 README 与 `@description`。
- 截图用相对路径引用 `screenshots/` 下的图片。

## 脚本约定

- 只写一个默认 `@name`（英文），不加 `@name:xx` 本地化变体。产品名是脚本的标识，不随使用者的浏览器语言变化。
- `@description` 只写三种：默认（英文）、`@description:zh-CN`、`@description:zh-TW`。默认即英文，不再重复写 `@description:en`。
- 元数据块之后的第一条语句固定为 `console.log(GM_info.script.name);`，前后各空一行，让使用者能在 Console 中确认脚本已加载。这一行只输出脚本名，不放进函数或条件分支，确保脚本一加载就执行。
- `@author`、`@namespace`、`@homepageURL`、`@supportURL` 与仓库内已有脚本保持一致，新增脚本照抄现有写法。这些是开发者选定公开的联系方式与仓库地址，不从 `git config`、浏览器登录账号或系统环境推断；已有脚本之间不一致时，先问开发者。
  `@namespace` 与 `@name` 一起决定脚本身份，已发布的脚本不改，否则使用者会装成另一个脚本。
- 脚本添加的类名、自定义元素名、`id` 与 `data-*` 属性统一使用 `user-script-<script-name>-` 前缀，`<script-name>` 即脚本目录名，例如 `user-script-copy-it-box`、`<user-script-copy-it-toast>`、`data-user-script-copy-it-ok`。
  这样既不会与页面自身的样式冲突，也不会与其他脚本冲突；Shadow DOM 内部同样遵守，保持写法一致。
  已有脚本不为对齐此规则单独改动，在修改该脚本时一并调整。

## 验证

- 逻辑与行为用测试页验证：断言复制内容、事件拦截、DOM 结构这类可以由程序判断的结果。
- 测试页统一使用 `test/gm-mock.js` 提供的 Tampermonkey API 替身，通过其中的 `GM_mock` 读取调用记录、预置存储、模拟网络响应。
  缺少某个接口时补进 `test/gm-mock.js`，不在单个测试页里另写模拟；只实现日常用到的接口，只面向最新版浏览器。
- 图标、配色、排版这类视觉效果，Agent 只负责按要求替换，不截图确认，由开发者自行查看是否满意。截图确认耗时长，而视觉是否满意本来就由开发者判断。

## 版本更新

`@version` 使用 `MAJOR.MINOR.PATCH`。这里只是 UserScript，版本控制从简，不追求严格的语义化版本。

Agent 修改脚本时按以下规则直接升级 `@version`，不需要事先询问；交付时说明升到了哪个版本及原因。只改 README、截图等脚本以外的文件时不升级。

版本规则只判定脚本本体。README 与截图是独立产物，与脚本功能解耦：截图没生成好、重新生成一张，不代表脚本有改动，也不触发下面的档位规则。

Greasy Fork 上更新截图不要求升级版本。截图与源码不耦合，换图说明不了脚本改没改；要不要发新版本，由开发者决定。

- 开发者明确批示了版本号时，以批示为准，不受以下规则约束。
- 默认只升 PATCH：修复问题、适配站点改版、调整样式或文案、小幅改进。
- 新增使用者可见的功能，或扩大生效范围（新增页面、站点）时升 MINOR，PATCH 归零。
- 相对上次发布的版本只升一次，发布前的多次修改不重复升级。判断依据是本地 Git：工作区的 `@version` 已与最近一次提交不同，即视为本轮已升级；此时只在档位不够时调整，例如已升 PATCH 但又新增了功能，改为升 MINOR。
- MAJOR 不因破坏性变更自行升级，按脚本类型确定：
  - 跟随社区技术栈的脚本（只服务于某个框架或库特定大版本的官方站点、文档），MAJOR 与目标技术栈的大版本一致。例如为 Vue 3 官方文档开发的脚本，版本从 `3.0.0` 开始，之后只升 MINOR 与 PATCH；脚本改为适配目标技术栈的新大版本时，MAJOR 随之改为新的大版本号。
  - 其他脚本从 `1.0.0` 开始，MAJOR 只在开发者明确批示时升级。
