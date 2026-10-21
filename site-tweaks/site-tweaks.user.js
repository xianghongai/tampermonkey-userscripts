// ==UserScript==
// @name         Site Tweaks
// @namespace    https://github.com/xianghongai
// @version      1.0.0
// @description  Tweak how pages look with custom styles by rules, for all sites, a domain, or a specific path.
// @description:zh-CN  按规则为网页添加自定义样式，调整显示效果；规则可对所有网站、某个域名或具体路径生效。
// @description:zh-TW  依規則為網頁加入自訂樣式，調整顯示效果；規則可對所有網站、某個網域或特定路徑生效。
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
  // 键为生效范围，值为要添加的 CSS；一个页面命中的全部规则依次生效。
  // - '*'：所有网站
  // - 'example.com'：该域名及其子域名，例如 docs.example.com
  // - 'example.com/docs'：该域名下的路径，包含 /docs 本身及 /docs/ 下的全部页面，不包含 /docs-old
  // 键前面带上 https:// 也可以，会被忽略。
  // 写法与存储中的自定义规则一致，可以直接互相复制。
  const RULES = {
    // ESDoc：标签目录固定在右侧
    'esdoc.org': `
      #all-tags + ul {
        position: fixed; top: 0; right: 0; bottom: 0; z-index: 9;
        box-sizing: border-box; width: 200px; overflow-y: auto;
        background: white; box-shadow: -1px 0 10px rgba(0, 0, 0, .1); list-style: none;
      }
      #all-tags + ul li { list-style: none; }
      #all-tags + ul ul { padding-left: 0; }
      #all-tags + ul > li { margin-top: 10px; }
      #all-tags + ul > li:first-child { margin-top: 20px; }
      #all-tags + ul > li:last-child { margin-bottom: 50px; }
      #all-tags + ul > li > a { color: #666; font-size: 14px; font-weight: bold; }
      body > .content { padding-right: 220px; }
    `,

    // 阮一峰《ECMAScript 6 入门》：正文随窗口宽度铺满、放大字号，标题左侧标出层级
    'es6.ruanyifeng.com': `
      #content { box-sizing: border-box; width: calc(100% - 20px); padding-right: 20px; font-size: 36px; line-height: 1.8; }
      #content :is(h1, h2, h3, h4, h5, h6) { position: relative; }
      #content :is(h1, h2, h3, h4, h5, h6)::before {
        position: absolute; top: 50%; left: 0; transform: translate(-100%, -50%);
        color: #666; font-size: 12px; font-weight: normal;
      }
      #content h1::before { content: "H1 "; }
      #content h2::before { content: "H2 "; }
      #content h3::before { content: "H3 "; }
      #content h4::before { content: "H4 "; }
      #content h5::before { content: "H5 "; }
      #content h6::before { content: "H6 "; }
      #content h1 { font-size: 1em; }
      #content h2 { font-size: .875em; }
      #content h3 { font-size: .75em; }
      #content :is(h4, h5, h6) { font-size: .7em; }
      #content p, #content ul li { font-size: .5em; }
      #content :is(p, li) code { font-size: 1em; }
      #content pre { line-height: 1 !important; }
      #content pre code { font-size: .5em !important; }
      #content ol li { font-size: .7em; }
      #content :is(ol, ul) li { line-height: 1.8; }
      #content ul li.link, #content ol li.link { font-size: .5em; }
      #content .content-toc { background: #fff; }
      #back_to_top, #flip { left: 100%; margin: 0; transform: scale(1.4) translateX(-100%); }
      #edit { opacity: 0; }
    `,

    // TinyPNG：压缩列表下方留出空间，结果不被底部内容挤住
    'tinypng.com': 'section.files.started { margin-bottom: 25rem !important; }',
  };

  // 使用者自己的规则存在脚本存储的 rules 键中，写法与 RULES 相同，与 RULES 一起生效，脚本更新时不会丢失。
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
   * 当前页面命中的全部样式，内置规则在前，自定义规则在后，合并成一段 CSS。
   * 每次应用前现取：单页应用切换路由时地址会变，路径规则需要随之生效。
   * @returns {string}
   */
  function currentCss() {
    return [RULES, GM_getValue(STORAGE_KEY, {})]
      .flatMap((ruleSet) => Object.entries(ruleSet ?? {}))
      .filter(([key, css]) => typeof css === 'string' && matches(key, location))
      .map(([, css]) => css)
      .join('\n');
  }

  // ---------- 样式 ----------
  // 所有命中规则的样式合进一个 <style>；document-start 时 <head> 可能还没有，先挂在 <html> 上
  const style = document.createElement('style');
  style.className = 'user-script-site-tweaks-style';

  /** 按当前地址更新样式，并确保 <style> 仍在页面中（有的页面会整体替换 <head>）。 */
  function applyCss() {
    const css = currentCss();
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
