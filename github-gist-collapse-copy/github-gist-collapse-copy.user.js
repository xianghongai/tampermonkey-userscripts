// ==UserScript==
// @name         GitHub & Gist: Collapse & Copy
// @namespace    https://github.com/xianghongai
// @version      1.0.2
// @description  Gist list: hides code previews. Gist files: collapse one by one or all at once, copy raw content. Copy Gist IDs, file names and repository names. Issue/PR/Discussion comments: collapse and copy the Markdown source.
// @description:zh-CN  Gist 列表隐藏代码预览；Gist 文件可单独或一键全部折叠，可复制 Raw 内容；可复制 Gist ID、文件名与仓库名；Issue/PR/Discussion 评论可折叠，可复制 Markdown 原文。
// @description:zh-TW  Gist 列表隱藏程式碼預覽；Gist 檔案可單獨或一鍵全部摺疊，可複製 Raw 內容；可複製 Gist ID、檔案名稱與儲存庫名稱；Issue/PR/Discussion 留言可摺疊，可複製 Markdown 原文。
// @author       xianghongai <xianghongai@gmail.com>
// @license      MIT
// @homepageURL  https://github.com/xianghongai/tampermonkey-userscripts
// @supportURL   https://github.com/xianghongai/tampermonkey-userscripts/issues
// @icon         https://github.githubassets.com/favicons/favicon.svg
// @match        https://gist.github.com/*
// @match        https://github.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setClipboard
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @connect      gist.github.com
// @connect      gist.githubusercontent.com
// @connect      api.github.com
// @run-at       document-start
// ==/UserScript==

console.log(GM_info.script.name);

(() => {
  'use strict';

  const IS_GIST = location.hostname === 'gist.github.com';

  // ---------- 样式 ----------
  // 折叠：在容器上打 data-ghc-collapsed，隐藏除头部以外的所有子元素。
  // 用 data 属性而不是 class，避免 React 重渲染时覆盖 className。
  const style = document.createElement('style');
  style.textContent = `
    /* Gist 列表页：.gist-snippet 只存在于列表页，详情页不受影响 */
    .gist-snippet > .js-gist-file-update-container.js-task-list-container {
      display: none !important;
    }
    .gist-snippet {
      margin-bottom: 16px !important;
    }
    .gist-snippet + .gist-snippet {
      padding-top: 16px;
      border-top: 1px solid var(--borderColor-muted, #d1d9e0b3);
    }

    [data-ghc-collapsed] > :not([data-ghc-header]) {
      display: none !important;
    }

    .ghc-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      width: 28px;
      height: 28px;
      padding: 0;
      border: 0;
      border-radius: 6px;
      background: transparent;
      color: var(--fgColor-muted, #59636e);
      cursor: pointer;
    }
    .ghc-btn:hover {
      background: var(--bgColor-neutral-muted, #818b981f);
      color: var(--fgColor-default, #1f2328);
    }
    .ghc-btn:focus-visible {
      outline: 2px solid var(--focus-outlineColor, #0969da);
      outline-offset: -2px;
    }
    .ghc-toggle svg {
      transition: transform .15s ease;
    }
    .ghc-toggle[aria-expanded="false"] svg {
      transform: rotate(-90deg);
    }
    .ghc-copy[data-state="done"] {
      color: var(--fgColor-success, #1a7f37);
    }
    .ghc-copy[data-state="error"] {
      color: var(--fgColor-danger, #d1242f);
    }
    .ghc-copy[data-state="busy"] {
      cursor: progress;
    }
    /* 请求中：省略号三个点依次闪烁 */
    .ghc-copy[data-state="busy"] circle {
      animation: ghc-dot 1s ease-in-out infinite;
    }
    .ghc-copy[data-state="busy"] circle:nth-child(2) {
      animation-delay: .2s;
    }
    .ghc-copy[data-state="busy"] circle:nth-child(3) {
      animation-delay: .4s;
    }
    @keyframes ghc-dot {
      0%, 80%, 100% { opacity: .2; }
      40% { opacity: 1; }
    }
    /* Gist 描述行：放“全部折叠/展开”按钮 */
    [itemprop="about"]:has(> .ghc-toggle-all) {
      display: flex;
      align-items: center;
      gap: 4px;
      margin-left: -6px;
    }
    /* Gist 文件头：和 Raw 按钮同高同风格 */
    .file-actions .ghc-btn {
      margin-right: 4px;
      vertical-align: middle;
    }
    /* 行内小号复制按钮：Gist 列表标题、文件名旁。弱化显示，悬停时才清晰 */
    .ghc-btn.ghc-inline {
      width: 20px;
      height: 20px;
      margin-left: 4px;
      vertical-align: middle;
      opacity: .5;
    }
    .ghc-btn.ghc-inline:hover,
    .ghc-btn.ghc-inline:focus-visible,
    .ghc-btn.ghc-inline[data-state] {
      opacity: 1;
    }
    .ghc-inline svg {
      width: 14px;
      height: 14px;
    }
  `;
  document.documentElement.appendChild(style);

  // Lucide 图标
  const lucide = (paths) =>
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" ' +
    'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    paths +
    '</svg>';
  const ICONS = {
    chevronDown: lucide('<path d="m6 9 6 6 6-6"/>'), // 折叠时用 CSS 旋转成 chevron-right
    copy: lucide(
      '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>' +
        '<path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
    ),
    chevronsDownUp: lucide('<path d="m7 20 5-5 5 5"/><path d="m7 4 5 5 5-5"/>'),
    chevronsUpDown: lucide('<path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/>'),
    check: lucide('<path d="M20 6 9 17l-5-5"/>'),
    ellipsis: lucide('<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>'),
    x: lucide('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'),
    // 复制 Gist 文件 Raw 内容用 files 图标，和文件名旁的 copy 图标区分
    files: lucide(
      '<path d="M20 7h-3a2 2 0 0 1-2-2V2"/>' +
        '<path d="M9 18a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h7l4 4v10a2 2 0 0 1-2 2Z"/>' +
        '<path d="M3 7.6v12.8A1.6 1.6 0 0 0 4.6 22h9.8"/>',
    ),
  };

  // ---------- 折叠目标 ----------
  // 每个 finder 返回 [header, slot]：header 是容器内保留可见的直接子元素，slot 是按钮插入位置。
  // 容器即 header.parentElement。
  const finders = [];

  if (IS_GIST) {
    // Gist 详情页文件：.file > .file-header > .file-actions（Raw 按钮所在处）
    finders.push(() =>
      [...document.querySelectorAll('.file > .file-header')].map((h) => [h, h.querySelector('.file-actions')]),
    );
  }

  // Issue（React 版）评论：按钮放在“…”菜单前
  finders.push(() =>
    [...document.querySelectorAll('[data-testid="comment-header"]')].map((h) => [
      h,
      h.querySelector('[data-testid="comment-header-hamburger"]')?.parentElement ||
        h.querySelector('[data-testid="comment-header-right-side-items"]'),
    ]),
  );

  // Issue（React 版）正文：头部是 issue-body-viewer 的前一个兄弟。
  // 这里没有 data-testid，只能用 CSS Modules 类名前缀（哈希后缀会变，前缀相对稳定）
  finders.push(() =>
    [...document.querySelectorAll('[data-testid="issue-body"] :has(+ [data-testid="issue-body-viewer"])')].map(
      (h) => [h, h.querySelector('[class*="actionsSection"]') || h.querySelector('[class*="actionsWrapper"]') || h],
    ),
  );

  // 经典版时间线评论：PR、Discussion、Gist 评论，以及 PR 中的 review 评论。
  // 以操作区 .timeline-comment-actions 为锚点，头部 = 评论框中包含它的那个直接子元素。
  finders.push(() =>
    [...document.querySelectorAll('.timeline-comment-actions')].flatMap((actions) => {
      const box = actions.closest('.timeline-comment, .review-comment, .timeline-comment-group');
      const header = box && [...box.children].find((c) => c.contains(actions));
      // Discussion 的操作区自身不是 flex，按钮要放进内层的 .d-flex 才能和“…”同一行
      return header ? [[header, actions.querySelector(':scope > .d-flex') || actions]] : [];
    }),
  );

  // ---------- 注入 ----------
  function createToggle(container) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ghc-btn ghc-toggle';
    btn.innerHTML = ICONS.chevronDown;
    syncToggle(btn, !container.hasAttribute('data-ghc-collapsed'));
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const expanded = container.toggleAttribute('data-ghc-collapsed') === false;
      syncToggle(btn, expanded);
      if (IS_GIST) syncToggleAll();
    });
    return btn;
  }

  function syncToggle(btn, expanded) {
    btn.setAttribute('aria-expanded', String(expanded));
    btn.setAttribute('aria-label', expanded ? 'Collapse' : 'Expand');
    btn.title = expanded ? 'Collapse' : 'Expand';
  }

  // ---------- 复制按钮（Gist Raw 与 Issue/PR/Discussion 评论共用）----------
  // 页面 CSP 禁止跨域请求（gist.githubusercontent.com、api.github.com），统一用 GM_xmlhttpRequest 绕过。
  function gmRequest(url, { method = 'GET', headers = {}, data } = {}) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method,
        url,
        headers,
        data,
        onload: resolve,
        onerror: () => reject(new Error('network error')),
        ontimeout: () => reject(new Error('timeout')),
      });
    });
  }

  // getText: () => Promise<string>；icon 为 ICONS 的键，复制完成后恢复成它
  function createCopyButton(getText, label, icon = 'copy') {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ghc-btn ghc-copy';
    btn.innerHTML = ICONS[icon];
    btn.dataset.icon = icon;
    btn.title = label;
    btn.dataset.label = label;
    btn.setAttribute('aria-label', label);
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (btn.dataset.state === 'busy') return;
      btn.dataset.state = 'busy';
      // 需要网络请求的复制（Raw、评论原文）会停留在这个状态，本地取值的会立即被结果覆盖
      btn.innerHTML = ICONS.ellipsis;
      try {
        GM_setClipboard(await getText(), 'text');
        flash(btn, 'done', ICONS.check, 'Copied');
      } catch (err) {
        flash(btn, 'error', ICONS.x, `Copy failed: ${err.message}`);
      }
    });
    return btn;
  }

  function flash(btn, state, icon, title) {
    btn.dataset.state = state;
    btn.innerHTML = icon;
    btn.title = title;
    // 失败时多停留一会儿，方便看清原因
    setTimeout(() => {
      delete btn.dataset.state;
      btn.innerHTML = ICONS[btn.dataset.icon];
      btn.title = btn.dataset.label;
    }, state === 'error' ? 4000 : 1500);
  }

  // ---------- Gist：复制 Raw ----------
  // 页面里隐藏的 textarea 并非总存在，大文件在 DOM 中也可能被截断，所以请求 Raw 链接。
  function scanGistRaw() {
    for (const raw of document.querySelectorAll('.file > .file-header .file-actions a[href*="/raw/"]')) {
      if (raw.previousElementSibling?.classList.contains('ghc-copy')) continue;
      const getText = async () => {
        const res = await gmRequest(raw.href);
        if (res.status < 200 || res.status >= 300) throw new Error(`HTTP ${res.status}`);
        return res.responseText;
      };
      raw.before(createCopyButton(getText, 'Copy raw content', 'files'));
    }
  }

  // ---------- Issue/PR：复制评论 Markdown 原文 ----------
  // DOM 里没有原文（PR 编辑表单延迟加载，React Issue 只有首屏数据），所以走 REST API。
  // Token 通过 Tampermonkey 菜单设置，存在 GM 存储里；未设置时匿名请求，限 60 次/小时。
  if (!IS_GIST) {
    GM_registerMenuCommand('Set GitHub token', () => {
      const value = prompt('GitHub Personal Access Token（公开仓库无需任何 scope）。留空则清除：', '');
      if (value !== null) GM_setValue('token', value.trim());
    });
  }

  // /owner/repo/issues/123 或 /owner/repo/pull/123（含 /pull/123/files 等子页）
  function parseIssuePage() {
    const m = /^\/([^/]+)\/([^/]+)\/(issues|pull)\/(\d+)/.exec(location.pathname);
    return m && { base: `/repos/${m[1]}/${m[2]}`, number: m[4] };
  }

  // 头部 → API 路径：向上找第一个带评论 id 的祖先（React 评论头部自身就带 id）
  function commentApiPath(header, { base, number }) {
    if (header.closest('[data-testid="issue-body"]')) return `${base}/issues/${number}`;
    for (let el = header; el && el !== document.body; el = el.parentElement) {
      const m = /^(issuecomment|pullrequestreview|discussion_r|issue|pullrequest)-?(\d+)$/.exec(el.id);
      if (!m) continue;
      switch (m[1]) {
        case 'issuecomment':
          return `${base}/issues/comments/${m[2]}`;
        case 'pullrequestreview':
          return `${base}/pulls/${number}/reviews/${m[2]}`;
        case 'discussion_r':
          return `${base}/pulls/comments/${m[2]}`;
        default: // issue-<id> / pullrequest-<id>：PR 正文
          return `${base}/issues/${number}`;
      }
    }
    return null;
  }

  async function fetchCommentBody(path) {
    const token = GM_getValue('token', '');
    const res = await gmRequest(`https://api.github.com${path}`, {
      headers: {
        Accept: 'application/vnd.github+json',
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    });
    if (res.status === 403 || res.status === 429) {
      throw new Error(token ? 'rate limited' : 'rate limited, set a token via Tampermonkey menu');
    }
    if (res.status === 401) throw new Error('invalid token');
    if (res.status === 404) throw new Error('not found (private repo needs a token with repo access)');
    if (res.status < 200 || res.status >= 300) throw new Error(`HTTP ${res.status}`);
    return JSON.parse(res.responseText).body ?? '';
  }

  // ---------- Discussion：复制 Markdown 原文 ----------
  // REST 没有 Discussion 接口，只能走 GraphQL（必须带 token）。
  // 主帖和每条评论/回复的外层都有 data-gid（D_… / DC_…），即 GraphQL 节点 ID，可直接按节点查询。
  const DISCUSSION_BODY_QUERY =
    'query($id: ID!) { node(id: $id) { ... on Discussion { body } ... on DiscussionComment { body } } }';

  async function fetchDiscussionBody(id) {
    const token = GM_getValue('token', '');
    if (!token) throw new Error('Discussions need a token, set one via Tampermonkey menu');
    const res = await gmRequest('https://api.github.com/graphql', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: JSON.stringify({ query: DISCUSSION_BODY_QUERY, variables: { id } }),
    });
    if (res.status === 401) throw new Error('invalid token');
    if (res.status === 403 || res.status === 429) throw new Error('rate limited');
    if (res.status < 200 || res.status >= 300) throw new Error(`HTTP ${res.status}`);
    // GraphQL 出错时 HTTP 仍是 200，错误在 errors 字段里
    const json = JSON.parse(res.responseText);
    if (json.errors?.length) throw new Error(json.errors[0].message);
    const body = json.data?.node?.body;
    if (body == null) throw new Error('not found');
    return body;
  }

  // ---------- Gist：全部折叠/展开 ----------
  // 按钮放在描述行 [itemprop="about"] 前；只要还有展开的文件就“全部折叠”，否则“全部展开”。
  const gistFiles = () => [...document.querySelectorAll('.file:has(> .file-header)')];

  function syncToggleAll() {
    const btn = document.querySelector('.ghc-toggle-all');
    if (!btn) return;
    const anyExpanded = gistFiles().some((f) => !f.hasAttribute('data-ghc-collapsed'));
    btn.innerHTML = anyExpanded ? ICONS.chevronsDownUp : ICONS.chevronsUpDown;
    btn.title = anyExpanded ? 'Collapse all files' : 'Expand all files';
    btn.setAttribute('aria-label', btn.title);
    btn.setAttribute('aria-expanded', String(anyExpanded));
  }

  function scanGistToggleAll() {
    const about = document.querySelector('[itemprop="about"]');
    if (!about || about.querySelector(':scope > .ghc-toggle-all') || !gistFiles().length) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ghc-btn ghc-toggle-all';
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const collapse = btn.getAttribute('aria-expanded') === 'true';
      for (const file of gistFiles()) {
        file.toggleAttribute('data-ghc-collapsed', collapse);
        const toggle = file.querySelector(':scope > .file-header .ghc-toggle');
        if (toggle) syncToggle(toggle, !collapse);
      }
      syncToggleAll();
    });
    about.prepend(btn);
    syncToggleAll();
  }

  // ---------- Gist 列表：描述作为标题链接（新标签页打开）----------
  // 原结构：作者 / <a><strong>文件名</strong></a> Secret … <span.f6.color-fg-muted>描述</span>
  // 改为：  <a><strong>描述</strong></a> Secret。没有描述的项保留文件名，避免标题变空。
  // 作者是当前页面主人时（/<user> 下自己的 gist）隐藏“作者 /”；加星标等列表里别人的 gist 保留作者。
  function scanGistList() {
    const pageOwner = location.pathname.split('/')[1].toLowerCase();
    for (const strong of document.querySelectorAll('.gist-snippet a > strong.css-truncate-target')) {
      const link = strong.parentElement;
      const line = link.parentElement;
      if (line.hasAttribute('data-ghc-done')) continue;
      line.setAttribute('data-ghc-done', '');

      const author = line.querySelector(':scope > a[data-hovercard-type="user"]');
      if (author && pageOwner && author.getAttribute('href').toLowerCase() === `/${pageOwner}`) {
        author.hidden = true;
        // “ / ” 是裸文本节点，CSS 选不到，直接清空
        if (author.nextSibling?.nodeType === Node.TEXT_NODE) author.nextSibling.textContent = '';
      }

      link.target = '_blank';
      link.rel = 'noopener';

      // 标题右侧复制 Gist ID（链接形如 /<user>/<id>）；有 Secret 等标签时放在标签后面
      const id = gistIdFromPath(new URL(link.href).pathname);
      const labels = line.querySelectorAll(':scope > .Label');
      if (id) (labels[labels.length - 1] || link).after(createInlineCopy(() => id, 'Copy Gist ID'));

      // 描述文案替换文件名，沿用原有链接样式；原描述行隐藏
      const desc = link.closest('.gist-snippet').querySelector('span.f6.color-fg-muted');
      const text = desc?.textContent.trim();
      if (!text) continue;
      strong.textContent = text;
      desc.hidden = true;
    }
  }

  // ---------- 复制 ID / 名称 ----------
  function createInlineCopy(getText, label, icon) {
    const btn = createCopyButton(async () => getText(), label, icon);
    btn.classList.add('ghc-inline');
    return btn;
  }

  // Gist ID 是 20 或 32 位十六进制：/<id>、/<user>/<id>、/<user>/<id>/revisions 等
  function gistIdFromPath(pathname) {
    return pathname.split('/').find((s) => /^[0-9a-f]{20,}$/i.test(s)) || null;
  }

  // Gist 详情页：描述行 [itemprop="about"] 右侧复制 Gist ID，样式同文件名旁的复制图标
  function scanGistAboutId() {
    const about = document.querySelector('[itemprop="about"]');
    if (!about || !gistIdFromPath(location.pathname) || about.querySelector('.ghc-copy')) return;
    about.append(createInlineCopy(() => gistIdFromPath(location.pathname), 'Copy Gist ID'));
  }

  // Gist 详情页：文件名右侧复制文件名
  function scanGistFileNames() {
    for (const name of document.querySelectorAll('.file > .file-header .gist-blob-name')) {
      const anchor = name.closest('a') || name;
      if (anchor.nextElementSibling?.classList.contains('ghc-copy')) continue;
      anchor.after(createInlineCopy(() => name.textContent.trim(), 'Copy file name'));
    }
  }

  // 仓库页：仓库标题（头像、名称、Public 标签）右侧复制 <owner>/<repo>，行内弱化图标。
  // 不放进 Watch/Fork/Star 操作区：别的脚本往那里插元素会触发重渲染，按钮被反复移除重插而抖动。
  // 标题只在仓库页出现，仓库名直接取 URL 前两段
  function scanRepoTitle() {
    const title = document.querySelector('#repo-title-component > div');
    if (!title || title.querySelector('.ghc-copy')) return;
    const btn = createInlineCopy(
      () => location.pathname.split('/').filter(Boolean).slice(0, 2).join('/'),
      'Copy repository name',
    );
    title.append(btn);
  }

  function scan() {
    if (IS_GIST) {
      scanGistList();
      scanGistRaw();
      scanGistToggleAll();
      scanGistAboutId();
      scanGistFileNames();
    } else {
      scanRepoTitle();
    }
    // Turbo 无刷新跳转会改变 URL，所以每次扫描时重新解析
    const issuePage = IS_GIST ? null : parseIssuePage();
    // 仓库下 /owner/repo/discussions/1 与组织下 /orgs/x/discussions/1 都算
    const isDiscussion = !IS_GIST && /\/discussions\/\d+/.test(location.pathname);
    for (const find of finders) {
      for (const [header, slot] of find()) {
        const container = header.parentElement;
        if (!slot || !container) continue;
        // React 重渲染可能移除按钮，所以以“按钮是否存在”判断，而不是只看标记
        let toggle = header.querySelector('.ghc-toggle');
        if (!toggle) {
          header.setAttribute('data-ghc-header', '');
          toggle = createToggle(container);
          slot.prepend(toggle);
        }
        if (issuePage && !header.querySelector('.ghc-copy')) {
          const path = commentApiPath(header, issuePage);
          if (path) toggle.after(createCopyButton(() => fetchCommentBody(path), 'Copy Markdown'));
        }
        if (isDiscussion && !header.querySelector('.ghc-copy')) {
          // 回复嵌在父评论内部，最近的 [data-gid] 祖先就是它自己
          const id = header.closest('[data-gid]')?.dataset.gid;
          if (id) toggle.after(createCopyButton(() => fetchDiscussionBody(id), 'Copy Markdown'));
        }
      }
    }
  }

  // GitHub 是 Turbo + React 混合渲染，评论会懒加载/分页加载，统一用 MutationObserver 兜底
  let queued = false;
  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      scan();
    });
  };

  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
  schedule();
})();
