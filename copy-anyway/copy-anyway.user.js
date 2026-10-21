// ==UserScript==
// @name         Copy Anyway
// @namespace    https://github.com/xianghongai
// @version      1.0.0
// @description  Select and copy text on pages that block it with styles or scripts, and stop sites from appending copyright notices to what you copy. Works on built-in sites, and can be switched on for any site from the menu.
// @description:zh-CN  在用样式或脚本禁止选择、复制的页面上照常选择与复制文字，并阻止网站在复制内容后追加版权声明；内置常见网站，也可以通过菜单在任意网站开启。
// @description:zh-TW  在用樣式或腳本禁止選取、複製的頁面上照常選取與複製文字，並阻止網站在複製內容後附加版權聲明；內建常見網站，也可以透過選單在任意網站開啟。
// @author       xianghongai <xianghongai@gmail.com>
// @license      MIT
// @homepageURL  https://github.com/xianghongai/tampermonkey-userscripts
// @supportURL   https://github.com/xianghongai/tampermonkey-userscripts/issues
// @icon         https://xinlu.ink/favicon.ico
// @match        *://*/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addValueChangeListener
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @run-at       document-start
// ==/UserScript==

console.log(GM_info.script.name);

(() => {
  'use strict';

  // ---------- 规则 ----------
  // 生效范围，写法与其他脚本的规则键一致：
  // - 'example.com'：该域名及其子域名，例如 docs.example.com
  // - 'example.com/docs'：该域名下的路径，包含 /docs 本身及 /docs/ 下的全部页面，不包含 /docs-old
  // 键前面带上 https:// 也可以，会被忽略。
  // 不提供 '*'：对所有网站解除限制会弄坏正常网站的自定义右键菜单、「复制代码」按钮等功能。
  const SITES = [
    '360doc.com',
    '1point3acres.com',
    'bilibili.com',
    'blog.skk.moe',
    'csdn.net',
    'douban.com',
    'ftchinese.com',
    'geekbang.org',
    'jianshu.com',
    'juejin.cn',
    'mbalib.com',
    'nowcoder.com',
    'zhihu.com',
  ];

  // 使用者自己开启的范围存在脚本存储的 sites 键中，写法与 SITES 相同，可在菜单里开关，也可在「存储」页直接编辑。
  // 首次运行时写入一个空数组，让它出现在 Tampermonkey 脚本编辑器的「存储」页中。
  const STORAGE_KEY = 'sites';
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
   * 存储中的自定义范围，值不是数组时按空处理。
   * @returns {string[]}
   */
  function userSites() {
    const list = GM_getValue(STORAGE_KEY, []);
    return Array.isArray(list) ? list.filter((key) => typeof key === 'string') : [];
  }

  const builtIn = () => SITES.some((key) => matches(key, location));
  const byUser = () => userSites().some((key) => matches(key, location));

  // 是否在当前页面解除限制；按地址实时判断，单页应用切换路由后路径规则随之生效
  const isEnabled = () => builtIn() || byUser();

  // ---------- 样式 ----------
  // 恢复被 user-select: none 禁止的选择，以及被设成透明的选中高亮。
  // document-start 时 <head> 可能还没有，先挂在 <html> 上。
  const style = document.createElement('style');
  style.className = 'user-script-copy-anyway-style';
  style.textContent = `
    *, *::before, *::after {
      -webkit-user-select: text !important;
      user-select: text !important;
    }
    ::selection {
      background-color: Highlight !important;
      color: HighlightText !important;
    }
  `;

  /** 按当前地址挂上或摘下样式，并确保样式仍在页面中（有的页面会整体替换 <head>）。 */
  function applyStyle() {
    if (!isEnabled()) {
      style.remove();
      return;
    }
    if (!style.isConnected) (document.head ?? document.documentElement).append(style);
  }

  // ---------- 事件 ----------
  // 页面常用这些事件阻止选择与复制，或在复制时改写剪贴板内容（追加版权声明）。
  // 在 window 的捕获阶段最先收到事件，停止传播，页面自己的监听器（包括 oncopy 这类行内写法）就都收不到；
  // 不调用 preventDefault，浏览器的默认行为（选中、复制、弹出右键菜单）照常进行。
  // 脚本在 document-start 运行，早于页面脚本注册监听器。
  const BLOCKED_EVENTS = ['copy', 'cut', 'selectstart', 'contextmenu'];
  for (const type of BLOCKED_EVENTS) {
    window.addEventListener(type, (event) => {
      if (isEnabled()) event.stopImmediatePropagation();
    }, true);
  }

  // 有的页面在按下 Ctrl/⌘+C、A、X 时阻止默认行为，只拦这几个组合，其他快捷键不受影响
  window.addEventListener('keydown', (event) => {
    if (!isEnabled()) return;
    const mod = event.ctrlKey || event.metaKey;
    if (mod && !event.altKey && ['KeyA', 'KeyC', 'KeyX'].includes(event.code)) event.stopImmediatePropagation();
  }, true);

  // ---------- 菜单 ----------
  // 内置网站始终开启，不提供菜单；其他网站可在菜单里开关，开启时记下当前域名，关闭时去掉所有命中当前页面的自定义范围。
  const IS_ZH = navigator.language.startsWith('zh');
  let menuId;

  /** 按当前状态更新菜单命令的标题。 */
  function updateMenu() {
    if (menuId !== undefined) GM_unregisterMenuCommand(menuId);
    menuId = undefined;
    if (builtIn()) return;
    const host = location.hostname;
    const label = IS_ZH
      ? (byUser() ? `在 ${host} 上停用` : `在 ${host} 上启用`)
      : (byUser() ? `Disable on ${host}` : `Enable on ${host}`);
    menuId = GM_registerMenuCommand(label, toggleCurrentSite);
  }

  /** 在当前网站开启或关闭。 */
  function toggleCurrentSite() {
    const list = userSites();
    const next = byUser()
      ? list.filter((key) => !matches(key, location))
      : [...list, location.hostname];
    // 写入后由下方的变化监听统一刷新样式与菜单
    GM_setValue(STORAGE_KEY, next);
  }

  // 同一网站的其他标签页里开关时，这里也随之生效
  GM_addValueChangeListener(STORAGE_KEY, () => {
    applyStyle();
    updateMenu();
  });

  // 单页应用切换路由时地址会变，有的页面还会替换 <head> 把样式带走，所以持续监听；
  // 短时间内的多次变化合并成一次。不用 requestAnimationFrame：后台标签页里它不执行。
  let timer = 0;

  /** 安排稍后应用一次，已有待执行的应用时不重复安排。 */
  function scheduleApply() {
    if (timer) return;
    timer = setTimeout(() => {
      timer = 0;
      applyStyle();
    }, 50);
  }

  applyStyle();
  updateMenu();
  new MutationObserver(scheduleApply).observe(document.documentElement, { childList: true, subtree: true });
})();
