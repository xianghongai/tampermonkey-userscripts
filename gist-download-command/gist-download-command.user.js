// ==UserScript==
// @name         Gist: Download Commands
// @namespace    https://github.com/xianghongai
// @version      1.0.0
// @description  Gist detail page: copy a GitHub CLI or curl command that downloads each file. When the Gist has a Cairn manifest, the command writes to the path it declares.
// @description:zh-CN  Gist 详情页：为每个文件复制 GitHub CLI 或 curl 下载命令；Gist 带有 Cairn 清单时，命令写入清单声明的路径。
// @description:zh-TW  Gist 詳情頁：為每個檔案複製 GitHub CLI 或 curl 下載指令；Gist 帶有 Cairn 清單時，指令寫入清單宣告的路徑。
// @author       xianghongai <xianghongai@gmail.com>
// @license      MIT
// @homepageURL  https://github.com/xianghongai/tampermonkey-userscripts
// @supportURL   https://github.com/xianghongai/tampermonkey-userscripts/issues
// @icon         https://github.githubassets.com/favicons/favicon.svg
// @match        https://gist.github.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setClipboard
// @connect      gist.github.com
// @connect      gist.githubusercontent.com
// @run-at       document-start
// ==/UserScript==

console.log(GM_info.script.name);

(() => {
  'use strict';

  const P = 'user-script-gist-download-command';

  // 私有 Gist 的 curl 命令从这个环境变量读 Token，由使用者事先 export
  const TOKEN_ENV = 'GIST_ONLY_GITHUB_ACCESS_TOKEN';

  // Cairn 清单在 Gist 中的约定文件名，与 cairn pull 的缺省值一致
  const MANIFEST_NAME = '.manifest.json';

  // ---------- 样式 ----------
  const style = document.createElement('style');
  style.textContent = `
    .${P}-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 2px;
      min-width: 32px;
      flex-shrink: 0;
      height: 20px;
      margin-left: 6px;
      padding: 0 6px;
      border: 1px solid var(--borderColor-default, #d1d9e0);
      border-radius: 6px;
      background: transparent;
      color: var(--fgColor-muted, #59636e);
      font: 500 12px/1 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      vertical-align: middle;
      cursor: pointer;
    }
    .${P}-btn + .${P}-btn {
      margin-left: 4px;
    }
    .${P}-btn:hover {
      background: var(--bgColor-neutral-muted, #818b981f);
      color: var(--fgColor-default, #1f2328);
    }
    .${P}-btn:focus-visible {
      outline: 2px solid var(--focus-outlineColor, #0969da);
      outline-offset: -2px;
    }
    .${P}-btn[data-${P}-state="done"] {
      border-color: currentColor;
      color: var(--fgColor-success, #1a7f37);
    }
    .${P}-btn[data-${P}-state="error"] {
      border-color: currentColor;
      color: var(--fgColor-danger, #d1242f);
    }
    .${P}-btn[data-${P}-state="busy"] {
      cursor: progress;
    }
    /* 请求中：省略号三个点依次闪烁 */
    .${P}-btn[data-${P}-state="busy"] circle {
      animation: ${P}-dot 1s ease-in-out infinite;
    }
    .${P}-btn[data-${P}-state="busy"] circle:nth-child(2) {
      animation-delay: .2s;
    }
    .${P}-btn[data-${P}-state="busy"] circle:nth-child(3) {
      animation-delay: .4s;
    }
    @keyframes ${P}-dot {
      0%, 80%, 100% { opacity: .2; }
      40% { opacity: 1; }
    }
    /* 多平台路径的选择框：浮在按钮上方 */
    .${P}-popover {
      position: fixed;
      z-index: 100;
      max-width: min(560px, calc(100vw - 16px));
      margin: 0;
      padding: 4px;
      border: 1px solid var(--borderColor-default, #d1d9e0);
      border-radius: 8px;
      background: var(--overlay-bgColor, var(--bgColor-default, #fff));
      box-shadow: var(--shadow-floating-small, 0 6px 12px -3px #25292e0a, 0 6px 18px 0 #25292e1f);
      list-style: none;
    }
    .${P}-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 2px 4px 2px 8px;
      border-radius: 6px;
      color: var(--fgColor-default, #1f2328);
      font: 12px/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    }
    .${P}-item:hover {
      background: var(--bgColor-neutral-muted, #818b981f);
    }
    .${P}-key {
      flex-shrink: 0;
      min-width: 56px;
      color: var(--fgColor-muted, #59636e);
    }
    .${P}-item[data-${P}-current] .${P}-key {
      color: var(--fgColor-accent, #0969da);
      font-weight: 600;
    }
    .${P}-path {
      flex: auto;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    /* 行内复制按钮：与 github-gist-collapse-copy 文件名旁的复制图标一致，弱化显示，悬停时才清晰 */
    .${P}-copy {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      width: 20px;
      height: 20px;
      padding: 0;
      border: 0;
      border-radius: 6px;
      background: transparent;
      color: var(--fgColor-muted, #59636e);
      opacity: .5;
      cursor: pointer;
    }
    .${P}-copy:hover {
      background: var(--bgColor-neutral-muted, #818b981f);
      color: var(--fgColor-default, #1f2328);
    }
    .${P}-copy:focus-visible {
      outline: 2px solid var(--focus-outlineColor, #0969da);
      outline-offset: -2px;
    }
    .${P}-copy:hover,
    .${P}-copy:focus-visible,
    .${P}-copy[data-${P}-state] {
      opacity: 1;
    }
    .${P}-copy[data-${P}-state="done"] {
      color: var(--fgColor-success, #1a7f37);
    }
  `;
  document.documentElement.appendChild(style);

  // Lucide 图标，与 github-gist-collapse-copy 的复制按钮一致
  const lucide = (paths) =>
    '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" ' +
    'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    paths +
    '</svg>';
  const ICONS = {
    copy: lucide(
      '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>' +
        '<path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
    ),
    check: lucide('<path d="M20 6 9 17l-5-5"/>'),
    ellipsis: lucide('<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>'),
    x: lucide('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'),
  };

  // ---------- 页面信息 ----------
  // 详情页路径为 /<id> 或 /<user>/<id>；/revisions、/forks 等子页不处理
  const isSubPage = () => /\/(revisions|forks|stargazers|edit)\/?$/.test(location.pathname);

  // Gist ID 取自 Raw 链接 /<user>/<id>/raw/<sha>/<file>，不依赖地址栏
  function gistIdFromRaw(raw) {
    return new URL(raw).pathname.split('/').find((s) => /^[0-9a-f]{20,}$/i.test(s)) || null;
  }

  // 私有（Secret）Gist 的标题旁有 Secret 标签；文件区内的同名文字不算
  function isSecretGist() {
    return [...document.querySelectorAll('.Label')].some(
      (el) => el.textContent.trim() === 'Secret' && !el.closest('.file'),
    );
  }

  // 每个文件：[文件名, Raw 链接, 文件名所在的 .file-info]
  function gistFiles() {
    return [...document.querySelectorAll('.file > .file-header')].flatMap((header) => {
      const name = header.querySelector('.gist-blob-name')?.textContent.trim();
      const raw = header.querySelector('.file-actions a[href*="/raw/"]');
      const info = header.querySelector('.file-info');
      return name && raw && info ? [{ name, raw: raw.href, info }] : [];
    });
  }

  // 当前平台的 Cairn 键：macos、windows 或 linux
  function platformKey() {
    const p = navigator.userAgentData?.platform || navigator.platform || '';
    if (/mac/i.test(p)) return 'macos';
    if (/win/i.test(p)) return 'windows';
    return 'linux';
  }

  // ---------- 网络 ----------
  // 页面 CSP 禁止跨域请求（Raw 会重定向到 gist.githubusercontent.com），统一用 GM_xmlhttpRequest
  function gmGet(url) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'GET',
        url,
        onload: resolve,
        onerror: () => reject(new Error('network error')),
        ontimeout: () => reject(new Error('timeout')),
      });
    });
  }

  // Raw 链接带修订版本号，按链接缓存，切换修订时自然重新请求
  const manifestCache = new Map();

  function loadManifest(raw) {
    if (!manifestCache.has(raw)) {
      const promise = gmGet(raw).then((res) => {
        if (res.status < 200 || res.status >= 300) throw new Error(`manifest HTTP ${res.status}`);
        try {
          return JSON.parse(res.responseText);
        } catch {
          throw new Error('manifest is not valid JSON');
        }
      });
      // 失败不缓存，下次点击重试
      promise.catch(() => manifestCache.delete(raw));
      manifestCache.set(raw, promise);
    }
    return manifestCache.get(raw);
  }

  // ---------- 目标路径 ----------
  // 按 Cairn 清单为远程文件列出本机目标路径，只读条目的 remote 与 path，规则与 cairn pull 一致：
  // 条目的 remote 缺省为条目名；path 为字符串时适用于所有平台，为对象时按平台键分别给出；
  // 以 / 结尾或恰为 ~、. 的路径是目录，文件以远程文件名写入其中。
  const PATH_KEYS = ['default', 'linux', 'macos', 'windows'];

  // 返回 [{ key, target, current }]：字符串路径只有一项（key 为 null）；
  // 对象路径每个平台键一项，current 标出当前平台实际采用的那一项（平台键优先，其次 default）
  function targetsFromManifest(manifest, fileName, platform) {
    const entries = manifest && typeof manifest.entries === 'object' ? manifest.entries : {};
    const entry = Object.entries(entries).find(([n, e]) => e && (e.remote || n) === fileName)?.[1];
    const toTarget = (p) => (p.endsWith('/') || p === '~' || p === '.' ? `${p.replace(/\/$/, '')}/${fileName}` : p);
    if (typeof entry?.path === 'string' && entry.path) return [{ key: null, target: toTarget(entry.path), current: true }];
    if (!entry?.path || typeof entry.path !== 'object') return [];
    const keys = Object.keys(entry.path).filter((k) => PATH_KEYS.includes(k) && typeof entry.path[k] === 'string' && entry.path[k]);
    const currentKey = keys.includes(platform) ? platform : keys.includes('default') ? 'default' : null;
    return keys.map((key) => ({ key, target: toTarget(entry.path[key]), current: key === currentKey }));
  }

  // ---------- Shell 引用 ----------
  // 双引号内只有 \ " $ ` 需要转义
  const escapeDq = (s) => s.replace(/[\\"$`]/g, '\\$&');
  const dq = (s) => `"${escapeDq(s)}"`;

  // 本机路径转成双引号参数：~ 换成 $HOME，引号内照样展开
  function quotePath(p) {
    if (p === '~' || p.startsWith('~/')) return `"$HOME${escapeDq(p.slice(1))}"`;
    return dq(p);
  }

  // 目标的上级目录；当前目录与 Home 无需创建，返回 null
  function parentDir(p) {
    const i = p.lastIndexOf('/');
    if (i <= 0) return null;
    const dir = p.slice(0, i);
    return dir === '~' || dir === '.' ? null : dir;
  }

  // ---------- 命令 ----------
  // 没有目标路径时 > 后留空，方便使用者粘贴后借助 Shell 补全填写本机路径
  function ghCommand({ id, name, target }) {
    const cmd = `gh gist view ${dq(id)} -f ${dq(name)} --raw > `;
    if (!target) return cmd;
    const dir = parentDir(target);
    return `${dir ? `mkdir -p ${quotePath(dir)} && ` : ''}${cmd}${quotePath(target)}`;
  }

  // 与 gh 一样，没有目标路径时 -o 后留空；有目标路径时由 --create-dirs 创建缺失的目录
  function curlCommand({ id, name, target, secret }) {
    const out = target ? `${quotePath(target)} --create-dirs` : '';
    if (!secret) {
      return `curl -L ${dq(`https://gist.github.com/${id}/raw/${encodeURIComponent(name)}`)} -o ${out}`;
    }
    const auth = `-H "Authorization: Bearer $${TOKEN_ENV}"`;
    return [
      'curl -sL \\',
      `  ${auth} \\`,
      `  "$(curl -sL ${auth} \\`,
      `    ${dq(`https://api.github.com/gists/${id}`)} \\`,
      `    | jq -r --arg f ${dq(name)} '.files[$f].raw_url')" \\`,
      `  -o ${out}`,
    ].join('\n');
  }

  // 点击时才读取清单与平台，清单还在加载时按钮显示忙碌
  async function commandContext({ name, raw }) {
    const id = gistIdFromRaw(raw);
    const manifestFile = gistFiles().find((f) => f.name === MANIFEST_NAME);
    const targets = manifestFile ? targetsFromManifest(await loadManifest(manifestFile.raw), name, platformKey()) : [];
    return { id, name, targets, secret: isSecretGist() };
  }

  // ---------- 按钮 ----------
  // build({ id, name, target, secret }) 生成命令。
  // 路径按多个平台给出时弹出选择框，逐项复制；否则直接复制当前平台的命令
  function createButton(label, title, file, build) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `${P}-btn`;
    btn.textContent = label;
    btn.dataset[labelKey] = label;
    btn.title = title;
    btn.setAttribute('aria-label', title);
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (btn.dataset[stateKey] === 'busy') return;
      if (closePopover() === btn) return;
      btn.dataset[stateKey] = 'busy';
      // 清单还在加载时停留在这个状态，已加载时会立即被结果覆盖
      btn.innerHTML = ICONS.ellipsis;
      try {
        const { targets, ...ctx } = await commandContext(file);
        if (targets.length > 1) {
          resetButton(btn);
          openPopover(btn, targets.map((t) => ({ ...t, text: build({ ...ctx, target: t.target }) })));
          return;
        }
        const target = targets.find((t) => t.current)?.target ?? null;
        GM_setClipboard(build({ ...ctx, target }), 'text');
        flash(btn, 'done', 'Copied');
      } catch (err) {
        flash(btn, 'error', `Copy failed: ${err.message}`);
      }
    });
    return btn;
  }

  // ---------- 多平台选择框 ----------
  // 同一时间只开一个；点击框外或按 Esc 关闭，复制后保持打开，方便接着复制其他平台
  let popover = null;

  // 关闭选择框，返回它所属的按钮，用于判断是否点了同一个按钮（再点一次即关闭）
  function closePopover() {
    if (!popover) return null;
    const { el, anchor } = popover;
    el.remove();
    anchor.setAttribute('aria-expanded', 'false');
    popover = null;
    return anchor;
  }

  function openPopover(anchor, items) {
    const el = document.createElement('ul');
    el.className = `${P}-popover`;
    el.setAttribute('role', 'menu');
    // 每行：平台键、目标路径、复制按钮；悬停路径可看完整命令
    for (const { key, target, current, text } of items) {
      const item = document.createElement('li');
      item.className = `${P}-item`;
      item.setAttribute('role', 'none');
      if (current) item.dataset[currentKey] = '';
      const keyEl = document.createElement('span');
      keyEl.className = `${P}-key`;
      keyEl.textContent = key;
      const pathEl = document.createElement('span');
      pathEl.className = `${P}-path`;
      pathEl.textContent = target;
      pathEl.title = text;
      const copy = document.createElement('button');
      copy.type = 'button';
      copy.className = `${P}-copy`;
      copy.setAttribute('role', 'menuitem');
      copy.setAttribute('aria-label', `Copy command for ${key}`);
      copy.title = 'Copy command';
      copy.innerHTML = ICONS.copy;
      copy.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        GM_setClipboard(text, 'text');
        copy.dataset[stateKey] = 'done';
        copy.innerHTML = ICONS.check;
        copy.title = 'Copied';
        setTimeout(() => {
          delete copy.dataset[stateKey];
          copy.innerHTML = ICONS.copy;
          copy.title = 'Copy command';
        }, 1500);
      });
      item.append(keyEl, pathEl, copy);
      el.append(item);
    }
    document.body.append(el);
    anchor.setAttribute('aria-expanded', 'true');
    popover = { el, anchor };

    // 默认放在按钮上方、左对齐；上方放不下时放到下方，右侧超出时向左收
    const a = anchor.getBoundingClientRect();
    const { width, height } = el.getBoundingClientRect();
    const top = a.top - height - 4 >= 0 ? a.top - height - 4 : a.bottom + 4;
    el.style.top = `${top}px`;
    el.style.left = `${Math.max(8, Math.min(a.left, innerWidth - width - 8))}px`;
    (el.querySelector(`[data-${P}-current] button`) || el.querySelector('button')).focus();
  }

  document.addEventListener('pointerdown', (e) => {
    if (popover && !popover.el.contains(e.target) && !popover.anchor.contains(e.target)) closePopover();
  }, true);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && popover) closePopover()?.focus();
  });
  // 页面滚动后位置失效，直接关闭
  addEventListener('scroll', () => closePopover(), { passive: true });

  // data-user-script-gist-download-command-* 对应的 dataset 键
  const datasetKey = (name) => `${P}-${name}`.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  const stateKey = datasetKey('state');
  const currentKey = datasetKey('current');
  const labelKey = datasetKey('label');

  // 成功显示对勾，失败显示叉号，提示里写明原因；之后恢复成文字
  function flash(btn, state, title) {
    btn.dataset[stateKey] = state;
    btn.innerHTML = state === 'done' ? ICONS.check : ICONS.x;
    btn.title = title;
    // 失败时多停留一会儿，方便看清原因
    setTimeout(() => resetButton(btn), state === 'error' ? 4000 : 1500);
  }

  function resetButton(btn) {
    delete btn.dataset[stateKey];
    btn.textContent = btn.dataset[labelKey];
    btn.title = btn.getAttribute('aria-label');
  }

  function scan() {
    if (isSubPage()) return;
    // 有清单时先行加载，点击时多半已就绪。每个链接只预载一次：
    // 失败会清掉缓存，而按钮切换图标也会触发扫描，不限制会反复请求；失败的原因留到点击时显示
    const manifestFile = gistFiles().find((f) => f.name === MANIFEST_NAME);
    if (manifestFile && !prefetched.has(manifestFile.raw)) {
      prefetched.add(manifestFile.raw);
      loadManifest(manifestFile.raw).catch(() => {});
    }
    for (const file of gistFiles()) {
      if (file.info.querySelector(`.${P}-btn`) || !gistIdFromRaw(file.raw)) continue;
      file.info.append(
        createButton('gh', 'Copy GitHub CLI command', file, ghCommand),
        createButton('curl', 'Copy curl command', file, curlCommand),
      );
    }
  }

  const prefetched = new Set();

  // Turbo 无刷新跳转与重渲染会替换文件区，用 MutationObserver 兜底
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
