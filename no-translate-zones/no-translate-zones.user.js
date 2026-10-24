// ==UserScript==
// @name         No-Translate Zones
// @name:en      No-Translate Zones
// @name:zh-CN   No-Translate Zones
// @namespace    https://github.com/xianghongai
// @version      1.1.1
// @description  Mark code blocks and other parts of a page chosen by rules as "do not translate" (translate="no"), so Google Translate, the browser's page translation and any other translator that honors the standard keep them in the original language. Rules apply to all sites, a domain, or a specific path.
// @description:en  Mark code blocks and other parts of a page chosen by rules as "do not translate" (translate="no"), so Google Translate, the browser's page translation and any other translator that honors the standard keep them in the original language. Rules apply to all sites, a domain, or a specific path.
// @description:zh-CN  把代码块及按规则指定的内容标记为不翻译（translate="no"），谷歌翻译、浏览器整页翻译等遵循该标准的翻译工具都会保留原文；规则可对所有网站、某个域名或具体路径生效。
// @description:zh-TW  把程式碼區塊及依規則指定的內容標記為不翻譯（translate="no"），Google 翻譯、瀏覽器整頁翻譯等遵循該標準的翻譯工具都會保留原文；規則可對所有網站、某個網域或特定路徑生效。
// @author       xianghongai <xianghongai@gmail.com>
// @license      MIT
// @homepageURL  https://github.com/xianghongai/tampermonkey-userscripts
// @supportURL   https://github.com/xianghongai/tampermonkey-userscripts/issues
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
  // 键为生效范围，值为不翻译的元素的 CSS 选择器；一个页面命中的全部规则合并生效。
  // - '*'：所有网站
  // - 'example.com'：该域名及其子域名，例如 docs.example.com
  // - 'example.com/docs'：该域名下的路径，包含 /docs 本身及 /docs/ 下的全部页面，不包含 /docs-old
  // 键前面带上 https:// 也可以，会被忽略。
  const RULES = {
    '*': ['pre', 'code', 'kbd', 'samp'],
    'formatjs.io': ['.prism-code'],
    'nodejs.org': ['a.type'],
    'wolframalpha.com': ['.example-wrap', 'font > font', 'section > div'],
    'wolfram.com': ['.example-wrap', 'font > font', 'section > div'],
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
   * 每次标记前现取：单页应用切换路由时地址会变，路径规则需要随之生效。
   * @returns {string}
   */
  function currentSelector() {
    const rules = [RULES, GM_getValue(STORAGE_KEY, {})];
    const selectors = new Set();
    for (const ruleSet of rules) {
      for (const [key, list] of Object.entries(ruleSet ?? {})) {
        if (matches(key, location)) for (const selector of [list].flat()) selectors.add(selector);
      }
    }
    return [...selectors].filter(isValidSelector).join(',');
  }

  const invalidSelectors = new Set();

  /**
   * 检查选择器是否合法；一个写错的选择器会让合并后的整条选择器失效，所以单独剔除并提示一次。
   * @param {string} selector
   * @returns {boolean}
   */
  function isValidSelector(selector) {
    try {
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

  // ---------- 标记 ----------

  /**
   * 给命中的元素加上不翻译标记。translate="no" 是 HTML 标准写法；
   * notranslate 类名是谷歌翻译的约定，名字由谷歌规定，不加本项目的前缀。
   */
  function markAll() {
    const selector = currentSelector();
    if (!selector) return;
    for (const el of document.querySelectorAll(selector)) {
      if (el.getAttribute('translate') === 'no') continue;
      el.setAttribute('translate', 'no');
      el.classList.add('notranslate');
    }
  }

  // 内容常在加载后才出现（单页应用、懒加载、翻译本身也会改写 DOM），所以持续监听；
  // 短时间内的多次变化合并成一次标记。不用 requestAnimationFrame：后台标签页里它不执行。
  let timer = 0;

  /** 安排稍后标记一次，已有待执行的标记时不重复安排。 */
  function scheduleMark() {
    if (timer) return;
    timer = setTimeout(() => {
      timer = 0;
      markAll();
    }, 50);
  }

  new MutationObserver(scheduleMark).observe(document.documentElement, { childList: true, subtree: true });
  scheduleMark();
})();
