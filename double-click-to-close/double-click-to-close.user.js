// ==UserScript==
// @name         Double-click to Close
// @name:en      Double-click to Close
// @namespace    https://github.com/xianghongai
// @version      1.0.1
// @description  Hold Shift and double-click a page to close the tab. Plain double-clicks, links and text fields are left alone, and sites can be excluded by rules.
// @description:en  Hold Shift and double-click a page to close the tab. Plain double-clicks, links and text fields are left alone, and sites can be excluded by rules.
// @description:zh-CN  按住 Shift 双击页面即可关闭当前标签页；普通双击、链接与输入框不受影响，可按规则排除网站。
// @description:zh-TW  按住 Shift 雙擊頁面即可關閉目前分頁；一般雙擊、連結與輸入框不受影響，可依規則排除網站。
// @author       xianghongai <xianghongai@gmail.com>
// @license      MIT
// @icon         https://xinlu.ink/favicon.ico
// @match        *://*/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        window.close
// @run-at       document-start
// @noframes
// ==/UserScript==

console.log(GM_info.script.name);

(() => {
  'use strict';

  // ---------- 规则 ----------
  // 不生效的范围，写法与其他脚本的规则键一致：
  // - 'example.com'：该域名及其子域名，例如 docs.example.com
  // - 'example.com/docs'：该域名下的路径，包含 /docs 本身及 /docs/ 下的全部页面，不包含 /docs-old
  // 键前面带上 https:// 也可以，会被忽略。
  // 列入的是 Shift+双击本身有用途的在线编辑器，例如在画布上编辑图层、节点。
  const EXCLUDE = [
    'figma.com/design',
    'xmind.ai',
  ];

  // 使用者自己排除的范围存在脚本存储的 exclude 键中，写法与 EXCLUDE 相同，可在「存储」页直接编辑。
  // 首次运行时写入一个空数组，让它出现在 Tampermonkey 脚本编辑器的「存储」页中。
  const STORAGE_KEY = 'exclude';
  if (GM_getValue(STORAGE_KEY) === undefined) GM_setValue(STORAGE_KEY, []);

  /**
   * 判断规则的键是否命中当前页面。
   * @param {string} key 规则的键
   * @param {Location} url 当前页面地址
   * @returns {boolean}
   */
  function matches(key, url) {
    if (key === '*') return true;
    const target = key.replace(/^[a-z]+:\/\//i, '');
    const slash = target.indexOf('/');
    const host = slash === -1 ? target : target.slice(0, slash);
    const path = slash === -1 ? '' : target.slice(slash).replace(/\/+$/, '');
    const hostMatched = url.hostname === host || (host !== '' && url.hostname.endsWith(`.${host}`));
    if (!hostMatched) return false;
    return path === '' || url.pathname === path || url.pathname.startsWith(`${path}/`);
  }

  /**
   * 当前页面是否被排除；按地址实时判断，单页应用切换路由后路径规则随之生效。
   * @returns {boolean}
   */
  function isExcluded() {
    const custom = GM_getValue(STORAGE_KEY, []);
    const keys = [...EXCLUDE, ...(Array.isArray(custom) ? custom : [])];
    return keys.some((key) => typeof key === 'string' && matches(key, location));
  }

  // ---------- 双击 ----------
  // 链接：双击的第一下就已经让浏览器在新窗口打开了链接，再关闭当前页属于连环误操作。
  // 输入框与可编辑区域：Shift+双击在其中是选择文字的正常操作。
  const SKIP = 'a[href], area[href], input, textarea, select, [contenteditable]:not([contenteditable="false"])';

  /**
   * 是否为关闭手势：左键双击，只按住 Shift。
   * @param {MouseEvent} event
   * @returns {boolean}
   */
  function isTrigger(event) {
    return event.button === 0 && event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey;
  }

  // 在 window 的捕获阶段处理，页面阻止 dblclick 冒泡也不影响
  window.addEventListener('dblclick', (event) => {
    if (!isTrigger(event) || isExcluded()) return;
    // composedPath 能穿透 open 的 Shadow DOM，拿到真正被点中的元素
    const [target] = event.composedPath();
    const el = target instanceof Element ? target : event.target;
    if (el instanceof Element && el.closest(SKIP)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    window.close();
  }, true);
})();
