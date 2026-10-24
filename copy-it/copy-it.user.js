// ==UserScript==
// @name         Copy it 🚀
// @name:en      Copy it 🚀
// @name:zh-CN   Copy it 🚀
// @namespace    https://github.com/xianghongai
// @version      1.5.3
// @description  Alt+click any element to copy its text. Add modifier keys to copy it as snake_case, kebab-case, camelCase or PascalCase, or to copy its title.
// @description:en  Alt+click any element to copy its text. Add modifier keys to copy it as snake_case, kebab-case, camelCase or PascalCase, or to copy its title.
// @description:zh-CN  按住 Alt 点击任意元素复制其文字；配合其他按键可复制为 snake_case、kebab-case、camelCase、PascalCase，或复制 title 提示文字。
// @description:zh-TW  按住 Alt 點擊任意元素複製其文字；搭配其他按鍵可複製為 snake_case、kebab-case、camelCase、PascalCase，或複製 title 提示文字。
// @author       xianghongai <xianghongai@gmail.com>
// @license      MIT
// @homepageURL  https://github.com/xianghongai/tampermonkey-userscripts
// @supportURL   https://github.com/xianghongai/tampermonkey-userscripts/issues
// @icon         https://xinlu.ink/favicon.ico
// @match        *://*/*
// @exclude      *://*.github.dev/*
// @exclude      *://*.cnb.space/*
// @exclude      *://vscode.dev/*
// @grant        GM_setClipboard
// @run-at       document-start
// ==/UserScript==

console.log(GM_info.script.name);

(() => {
  'use strict';

  const IS_MAC = /mac/i.test(navigator.userAgentData?.platform ?? navigator.platform);
  const IS_ZH = navigator.language.startsWith('zh');

  // ---------- 修饰键 ----------
  // MouseEvent 分不出左右 Alt，右 Alt 只能从键盘事件的 location 记下来。
  // 部分键盘布局把右 Alt 当作 AltGr：key 为 AltGraph，点击时 altKey 为 false，Windows 上还会同时带上 ctrlKey。
  // 所以右 Alt 单独记录，并且优先于其他组合判断。
  let rightAltDown = false;

  function isRightAlt(event) {
    return event.key === 'AltGraph' || (event.key === 'Alt' && event.location === KeyboardEvent.DOM_KEY_LOCATION_RIGHT);
  }

  window.addEventListener('keydown', (event) => {
    if (isRightAlt(event)) rightAltDown = true;
    // 单按 Alt 时，Windows 上的浏览器会把焦点移到菜单栏，Alt+点击之后键盘操作就落到了菜单栏上
    if (event.key === 'Alt' || event.key === 'AltGraph') event.preventDefault();
  }, true);

  window.addEventListener('keyup', (event) => {
    if (isRightAlt(event)) rightAltDown = false;
  }, true);

  // 按住 Alt 切走窗口时收不到 keyup
  window.addEventListener('blur', () => {
    rightAltDown = false;
  });

  // 返回 null 表示这次点击与本脚本无关
  // 右手区（右 Alt）负责驼峰类命名，左手区（左 Alt）负责 - 与 _ 分隔的命名
  //
  // Shortcut                     Copies
  // Alt + Click                  Element text
  // Alt + Shift + Click          kebab-case
  // Alt + Ctrl + Click           snake_case
  // Right Alt + Click            camelCase
  // Right Alt + Shift + Click    PascalCase
  // Alt + Shift + Ctrl + Click   Element title
  //
  // macOS: Alt = Option, Ctrl = Command
  function resolveAction(event) {
    if (event.button !== 0) return null;
    if (rightAltDown) return event.shiftKey ? 'pascal' : 'camel';
    if (!event.altKey) return null;
    const mod = IS_MAC ? event.metaKey : event.ctrlKey;
    if (event.shiftKey && mod) return 'title';
    if (event.shiftKey) return 'kebab';
    if (mod) return 'snake';
    return 'text';
  }

  // ---------- 拦截点击 ----------
  // 一次点击依次触发 pointerdown → mousedown → pointerup → mouseup → click，页面可能在其中任何一步响应：
  // 有的在 mousedown 上导航（如 Axure 导出的原型），有的在 pointerdown 上打开菜单。
  // 所以整条链都在 window 的捕获阶段拦下，赶在页面的监听器之前；拦下 mousedown 也顺带阻止了拖选文字。
  for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup']) {
    window.addEventListener(type, (event) => {
      if (resolveAction(event)) block(event);
    }, true);
  }

  window.addEventListener('click', (event) => {
    const action = resolveAction(event);
    if (!action) return;
    block(event);
    // composedPath 能穿透 open 的 Shadow DOM，拿到真正被点中的元素
    const path = event.composedPath();
    const el = path[0] instanceof Element ? path[0] : event.target;
    const text = action === 'title' ? getTitle(el) : convert(getText(el), action);
    copy(text, event.clientX, event.clientY);
  }, true);

  function block(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  // ---------- 取文字 ----------
  function getText(el) {
    const text = readContent(el)?.trim();
    if (text) return text;
    // 图标按钮、图片这类没有文字的元素，退而取无障碍名称；点中的常是按钮里的图标，aria-label 在外层
    return (el.getAttribute('alt') || el.closest('[aria-label]')?.getAttribute('aria-label') || '').trim();
  }

  function readContent(el) {
    if (el instanceof HTMLInputElement) return readInput(el);
    if (el instanceof HTMLTextAreaElement) return el.value.trim() || el.placeholder;
    if (el instanceof HTMLSelectElement) return [...el.selectedOptions].map((option) => option.text).join('\n');
    if (el instanceof SVGElement) return readSvg(el);
    return el.innerText ?? el.textContent;
  }

  function readInput(input) {
    // 不复制密码明文
    if (input.type === 'password') return input.placeholder;
    if (input.type === 'checkbox' || input.type === 'radio') return input.labels?.[0]?.innerText;
    return input.value.trim() || input.placeholder;
  }

  // SVG 里的文字常被拆成多行 tspan，textContent 会把它们直接连在一起
  function readSvg(el) {
    const textEl = el.closest('text') ?? el;
    const spans = textEl.querySelectorAll('tspan');
    const text = spans.length ? [...spans].map((span) => span.textContent).join(' ') : textEl.textContent;
    return text.replace(/\s+/g, ' ');
  }

  // title 常写在外层元素上，点中的往往是里面的文字或图标
  function getTitle(el) {
    return el.closest('[title]')?.getAttribute('title')?.trim() ?? '';
  }

  // ---------- 命名风格 ----------
  // 拆词规则：连续大写后接大小写交替时断开（XMLHttp → XML、Http），数字跟随前一个词（utf8Encode → utf8、Encode），
  // 没有大小写之分的文字（中日韩等）连续的算一个词，标点、符号、空白都是分隔。
  const WORD = /\p{Lu}+(?=\p{Lu}\p{Ll})|\p{Lu}?[\p{Ll}\p{N}]+|\p{Lu}+\p{N}*|[^\p{Lu}\p{Ll}\p{N}\p{P}\p{S}\p{Z}\p{C}]+/gu;

  function words(text) {
    const plain = text
      // 去掉拉丁字母上的变音符号（café → cafe），只动拉丁字母，以免改掉日文浊音这类字符
      .normalize('NFD')
      .replace(/(\p{Script=Latin})\p{Mn}+/gu, '$1')
      .normalize('NFC')
      // 缩写里的撇号不当作分隔（don't → dont）
      .replace(/['’]/g, '');
    return plain.match(WORD) ?? [];
  }

  function convert(text, action) {
    switch (action) {
      case 'snake':
        return words(text).map((word) => word.toLowerCase()).join('_');
      case 'kebab':
        return words(text).map((word) => word.toLowerCase()).join('-');
      case 'camel':
        return words(text).map((word, index) => (index ? capitalize(word) : word.toLowerCase())).join('');
      case 'pascal':
        return words(text).map(capitalize).join('');
      default:
        return text;
    }
  }

  function capitalize(word) {
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }

  // ---------- 复制与提示 ----------
  function copy(text, x, y) {
    if (!text) {
      toast(IS_ZH ? '没有可复制的内容' : 'Nothing to copy', false, x, y);
      return;
    }
    GM_setClipboard(text, 'text');
    toast(text, true, x, y);
  }

  // 图标取自 Lucide（lucide-static v1.60.0，ISC 许可）：check 与 x
  const ICON_ATTRS = 'xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
  const ICONS = {
    check: `<svg ${ICON_ATTRS}><path d="M20 6 9 17l-5-5"/></svg>`,
    x: `<svg ${ICON_ATTRS}><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`,
  };

  // 提示放在 Shadow DOM 里，不受页面样式影响；挂在 <html> 上，document-start 时 body 可能还没有
  let toastHost;
  let toastBox;
  let toastTimer;

  function toast(message, ok, x, y) {
    if (!toastHost?.isConnected) {
      toastHost = document.createElement('user-script-copy-it-toast');
      toastHost.style.cssText = 'all: initial; position: fixed; inset: 0; z-index: 2147483647; pointer-events: none;';
      const root = toastHost.attachShadow({ mode: 'open' });
      root.innerHTML = `
        <style>
          .user-script-copy-it-box {
            position: fixed;
            display: flex;
            gap: 6px;
            align-items: center;
            max-width: min(360px, calc(100vw - 16px));
            padding: 2px 6px;
            border-radius: 4px;
            background: rgb(36 41 47 / 0.92);
            color: #fff;
            font: 12px/1.4 system-ui, sans-serif;
            box-shadow: 0 4px 12px rgb(0 0 0 / 0.2);
            opacity: 0;
            transition: opacity 0.15s;
          }
          .user-script-copy-it-box.user-script-copy-it-show { opacity: 1; }
          .user-script-copy-it-icon { flex: none; display: flex; }
          .user-script-copy-it-box[data-user-script-copy-it-ok="true"] .user-script-copy-it-icon { color: #4ac26b; }
          .user-script-copy-it-box[data-user-script-copy-it-ok="false"] .user-script-copy-it-icon { color: #ff8182; }
          .user-script-copy-it-text { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
        </style>
        <div class="user-script-copy-it-box"><span class="user-script-copy-it-icon"></span><span class="user-script-copy-it-text"></span></div>
      `;
      toastBox = root.querySelector('.user-script-copy-it-box');
      document.documentElement.append(toastHost);
    }

    toastBox.dataset.userScriptCopyItOk = ok;
    toastBox.querySelector('.user-script-copy-it-icon').innerHTML = ok ? ICONS.check : ICONS.x;
    // 多行文字只预览成一行
    toastBox.querySelector('.user-script-copy-it-text').textContent = message.replace(/\s+/g, ' ');

    // 显示在指针右上方，超出视口时收回来
    const { width, height } = toastBox.getBoundingClientRect();
    toastBox.style.left = `${Math.max(8, Math.min(x + 12, innerWidth - width - 8))}px`;
    toastBox.style.top = `${Math.max(8, Math.min(y - height - 8, innerHeight - height - 8))}px`;
    toastBox.classList.add('user-script-copy-it-show');

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastBox.classList.remove('user-script-copy-it-show'), ok ? 1200 : 2000);
  }
})();
