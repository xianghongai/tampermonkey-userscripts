// ==UserScript==
// @name         No AD
// @name:en      No AD
// @namespace    https://github.com/xianghongai
// @version      1.0.1
// @description  Hide ads, pop-ups and other distractions by rules, for all sites, a domain, or a specific path. Hidden elements keep their size and display, so most "ad blocker detected" checks are not triggered.
// @description:en  Hide ads, pop-ups and other distractions by rules, for all sites, a domain, or a specific path. Hidden elements keep their size and display, so most "ad blocker detected" checks are not triggered.
// @description:zh-CN  按规则隐藏广告、弹窗等干扰内容，规则可对所有网站、某个域名或具体路径生效；隐藏的元素保留尺寸与显示状态，不易触发网站的广告拦截检测。
// @description:zh-TW  依規則隱藏廣告、彈窗等干擾內容，規則可對所有網站、某個網域或特定路徑生效；隱藏的元素保留尺寸與顯示狀態，不易觸發網站的廣告攔截偵測。
// @author       xianghongai <xianghongai@gmail.com>
// @license      MIT
// @icon         https://xinlu.ink/favicon.ico
// @match        *://*/*
// @grant        GM_getValue
// @grant        GM_setValue
// @run-at       document-start
// ==/UserScript==

console.log(GM_info.script.name);

(() => {
  'use strict';

  // ---------- 规则 ----------
  // 键为生效范围，值为要隐藏的元素的 CSS 选择器；一个页面命中的全部规则合并生效。
  // - '*'：所有网站
  // - 'example.com'：该域名及其子域名，例如 docs.example.com
  // - 'example.com/docs'：该域名下的路径，包含 /docs 本身及 /docs/ 下的全部页面，不包含 /docs-old
  // 键前面带上 https:// 也可以，会被忽略。
  // 写法与存储中的自定义规则一致，可以直接互相复制。
  const RULES = {
    // Forvo：弹窗、遮罩、推广横幅，以及占据大量空间的页头与导航
    'forvo.com': [
      'body > .mfp-wrap',
      'body > .mfp-bg',
      '.banner-academy',
      '.language-container + #mapContainer',
      '.modals.dimmer',
      '#header',
      '#wrap_main_nav_and_search',
      '.main_section > header',
    ],
    // 全历史：会员推广弹窗
    'allhistory.com': ['.vip-tool-box-component.pop-box-mask'],
    // Photopea：右侧广告栏、新建项目窗口中的推广区、通知窗口
    'photopea.com': [
      '.flexrow.app > div + div',
      '.window.newproject > .body > .flexrow > div + div',
      '.flexrow.app > div > div > .window.bnotify',
    ],
    'mastergo.com': ['.hot-resource-wrapper']
  };

  // 使用者自己的规则存在脚本存储的 rules 键中，写法与 RULES 相同，与 RULES 合并生效，脚本更新时不会丢失。
  // 首次运行时写入一个空对象，让它出现在 Tampermonkey 脚本编辑器的「存储」页中，方便直接编辑。
  const STORAGE_KEY = 'rules';
  if (GM_getValue(STORAGE_KEY) === undefined) GM_setValue(STORAGE_KEY, {});

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
   * 当前页面命中的全部选择器，去重并剔除写错的选择器。
   * 每次应用前现取：单页应用切换路由时地址会变，路径规则需要随之生效。
   * @returns {string[]}
   */
  function currentSelectors() {
    const selectors = new Set();
    for (const ruleSet of [RULES, GM_getValue(STORAGE_KEY, {})]) {
      for (const [key, list] of Object.entries(ruleSet ?? {})) {
        if (matches(key, location)) for (const selector of [list].flat()) selectors.add(selector);
      }
    }
    return [...selectors].filter(isValidSelector);
  }

  const invalidSelectors = new Set();

  /**
   * 检查选择器是否合法；一个写错的选择器会让合并后的整条规则失效，所以单独剔除并提示一次。
   * @param {unknown} selector
   * @returns {boolean}
   */
  function isValidSelector(selector) {
    try {
      if (typeof selector !== 'string') throw new TypeError();
      document.createDocumentFragment().querySelector(selector);
      return true;
    } catch {
      if (!invalidSelectors.has(selector)) {
        invalidSelectors.add(selector);
        console.warn(`[${GM_info.script.name}] Invalid selector ignored:`, selector);
      }
      return false;
    }
  }

  // ---------- 隐藏 ----------
  // 不用 display: none 或 visibility: hidden：不少网站正是检查广告元素的计算样式、尺寸来判断是否装了拦截器。
  // 这里保留元素原有的 display 与尺寸，只把它移出文档流、移到视口上方，并让它不响应鼠标：
  // 页面上不留空白、看不到也点不到，而检测脚本读到的仍是一个正常显示的元素。
  // 向上移而不向左移：从右到左排版的页面里，左侧的溢出会出现横向滚动条，上方的溢出不会。
  const HIDE = `
    position: absolute !important;
    top: -100000px !important;
    left: 0 !important;
    pointer-events: none !important;
  `;

  // 所有选择器合进一个 <style>；document-start 时 <head> 可能还没有，先挂在 <html> 上
  const style = document.createElement('style');
  style.className = 'user-script-no-ad-style';

  /** 按当前地址更新样式，并确保 <style> 仍在页面中（有的页面会整体替换 <head>）。 */
  function applyCss() {
    const selectors = currentSelectors();
    const css = selectors.length ? `${selectors.join(',\n')} {${HIDE}}` : '';
    if (style.textContent !== css) style.textContent = css;
    if (css && !style.isConnected) (document.head ?? document.documentElement).append(style);
  }

  // 单页应用切换路由时地址会变，有的页面还会替换 <head> 把样式带走，所以持续监听；
  // 短时间内的多次变化合并成一次。不用 requestAnimationFrame：后台标签页里它不执行。
  let timer = 0;

  /** 安排稍后应用一次，已有待执行的应用时不重复安排。 */
  function scheduleApply() {
    if (timer) return;
    timer = setTimeout(() => {
      timer = 0;
      applyCss();
    }, 50);
  }

  applyCss();
  new MutationObserver(scheduleApply).observe(document.documentElement, { childList: true, subtree: true });
})();
