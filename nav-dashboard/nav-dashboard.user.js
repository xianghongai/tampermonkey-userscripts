// ==UserScript==
// @name         Nav Dashboard
// @namespace    https://github.com/xianghongai
// @version      1.0.0
// @description  Documentation sites list their components and APIs in a long, grouped sidebar that you have to scroll through. This opens a full-screen board that lays all the groups out side by side, so you can see the whole tech stack at a glance and jump to any page.
// @description:zh-CN  技术文档网站的左侧导航分成一组组，需要上下滚动才能看全；打开全屏看板，把所有分组横向铺开，对整个技术栈一览无余，点击即可跳转。
// @description:zh-TW  技術文件網站的左側導覽分成一組組，需要上下捲動才能看全；開啟全螢幕看板，把所有分組橫向鋪開，對整個技術棧一覽無遺，點擊即可跳轉。
// @author       xianghongai <xianghongai@gmail.com>
// @license      MIT
// @homepageURL  https://github.com/xianghongai/tampermonkey-userscripts
// @supportURL   https://github.com/xianghongai/tampermonkey-userscripts/issues
// @icon         https://xinlu.ink/favicon.ico
// @match        https://ant.design/*
// @match        https://*.ant.design/*
// @match        https://ant-design.antgroup.com/*
// @match        https://www.antdv.com/*
// @match        https://element-plus.org/*
// @match        https://element.eleme.cn/*
// @match        https://element.eleme.io/*
// @match        https://cn.vuejs.org/api/*
// @match        https://vuejs.org/api/*
// @match        https://cn.vuejs.org/guide/*
// @match        https://vuejs.org/guide/*
// @match        https://v2.cn.vuejs.org/v2/*
// @match        https://v2.vuejs.org/v2/*
// @match        https://vant-ui.github.io/vant/*
// @match        https://react.dev/reference/*
// @match        https://*.react.dev/reference/*
// @match        https://docs.angularjs.org/*
// @match        https://tdesign.tencent.com/*
// @match        https://devui.design/*
// @match        https://arco.design/*
// @grant        none
// @run-at       document-idle
// @noframes
// ==/UserScript==

console.log(GM_info.script.name);

(() => {
  'use strict';

  // ---------- 网站 ----------
  // 键为生效范围，命中多个时取最长的那个：
  // - 'example.com'：该域名及其子域名，例如 docs.example.com
  // - 'example.com/docs'：该域名下的路径，包含 /docs 本身及 /docs/ 下的全部页面，不包含 /docs-old
  //
  // 值描述该网站的导航结构，都是 CSS 选择器。看板把网站的导航复制一份铺满全屏，样式仍是网站自己的，
  // 这里的配置只决定从哪里分列、在哪里标出项数：
  // - menu：导航的容器
// - shadow（可选）：导航在 Shadow DOM 里时，填它的宿主元素，menu 改在宿主的 shadowRoot 里查找
  // - group：分组，可以写多个、可以互相嵌套；直接含有导航项的分组从新的一列开始，外层分组的标题随第一个内层分组进入同一列
  // - title：分组的标题，取分组内第一个属于它自己（不属于更内层分组）的匹配元素，后面标出分组下的项数
  // - item：导航项，归属于离它最近的分组
  // - heading（可选）：与导航项、分组并列的小标题，直到下一个小标题为止，之后的内容都归到它名下：
  //   小标题之后的导航项从新的一列开始，把一个很长的分组拆成几列；小标题后面同样标出它名下的项数
  // - css（可选）：只作用于看板的额外样式，例如去掉网站给折叠子菜单加的半透明
  // - ignore（可选）：不在看板中显示的元素，选择器数组，例如导航里的推广链接；只从看板中去掉，原导航不受影响
  // - layout（可选）：看板布局，不写时用 LAYOUT，取值见 LAYOUT 上方的注释
  // 一列放不下时接续到下一列。单页应用切换路由后导航会变，每次打开看板时都按当前页面重新复制。
  const ANT_DESIGN = {
    // 5.x 起导航在 <main> 里，4.x 及更早是 .aside-container
    menu: 'main .ant-menu-root, .ant-menu-root.aside-container',
    group: '.ant-menu-submenu, .ant-menu-item-group',
    title: '.ant-menu-submenu-title, .ant-menu-item-group-title',
    item: '.ant-menu-item',
  };
  // Arco 的 React 组件库文档、设计规范与移动端文档共用这套菜单，只是外层不同
  const ARCO_MENU = {
    menu: '.ac-menu-inner > .arco-menu, .arcodesign-pc-menu-list > .arco-menu',
    group: '.arco-menu-inline, .arco-menu-group',
    title: '.arco-menu-inline-header, .arco-menu-group-title',
    item: '.arco-menu-item',
  };
  const SITES = {
    // 含 2x、3x、4x、5x 等历史版本的子域名
    'ant.design': ANT_DESIGN,
    'ant-design.antgroup.com': ANT_DESIGN,
    'antdv.com': { ...ANT_DESIGN, menu: '.main-menu-inner > .ant-menu-root' },
    'element-plus.org': {
      menu: '.sidebar',
      group: '.sidebar-group',
      title: '.sidebar-group__title',
      item: 'a.link',
    },
    'element.eleme.cn': {
      menu: '.side-nav',
      // 第一层是「开发指南」「组件」这类大类，组件之下再分组
      group: '.side-nav > ul > .nav-item:has(> ul, > .nav-group), .nav-group',
      title: '.side-nav > ul > .nav-item > a, .nav-group__title',
      item: '.nav-item',
    },
    // 含中文站 cn.vuejs.org。总览页 /api/ 没有侧栏，读正文的 API 索引，列到每个 API；其他页面读侧栏，只列到页面
    'vuejs.org/api': {
      menu: '#api-index, .VPSidebar nav',
      group: '.api-section, .api-group, .VPSidebarGroup',
      title: '.api-section > h2, .api-group > h3, .VPSidebarGroup .title-text',
      item: '.api-group li, .VPSidebarGroup a.link',
      // 总览页顶部的标题与筛选框、侧栏底部的推广链接
      ignore: ['#api-index > .header', '.VPSidebar nav > .container'],
      // 总览页的分组多而短，按列铺开要横向滚动很久
      layout: 'waterfall',
      css: '.api-section > h2 { border-top: none; margin-block: 0 8px; padding-block-start: 0; }',
    },
    // 含中文站 cn.vuejs.org
    'vuejs.org/guide': {
      menu: '.VPSidebar nav',
      group: '.VPSidebarGroup',
      title: '.VPSidebarGroup .title-text',
      item: '.VPSidebarGroup a.link',
      // 顶部的 API 风格切换（复制到看板里不能用）、底部的推广链接
      ignore: ['.VPSidebar nav > .preference-switch', '.VPSidebar nav > .container'],
      layout: 'waterfall',
    },
    'v2.cn.vuejs.org/v2/': {
      menu: '.sidebar-inner .menu-root',
      group: '.menu-root > li',
      title: 'a.section-link',
      item: '.menu-sub li',
      layout: 'waterfall',
      css: 'li[data-user-script-nav-dashboard-wrap] { margin-block-start: 32px; }'
    },
    // 含 zh-hans.react.dev 等翻译站。react、react-dom 这些包名是与分组并列的 h3，作为小标题让每个包从新的一列开始
    'react.dev/reference': {
      menu: 'nav[role="navigation"]:has(> ul > h3)',
      group: 'li:has(ul)',
      title: 'li:has(ul) > a',
      item: 'li:not(:has(ul)) > a',
      heading: 'nav > ul > h3',
      layout: 'waterfall',
      // 折叠的子菜单外层有半透明
      css: '.opacity-50 { opacity: 1 !important; }',
    },
    'vant-ui.github.io/vant': {
      menu: '.van-doc-nav',
      group: '.van-doc-nav__group',
      title: '.van-doc-nav__title',
      item: '.van-doc-nav__item',
    },
    'docs.angularjs.org': {
      menu: '.nav-list.naked-list',
      group: '.nav-index-group',
      title: '.nav-index-group-heading',
      item: '.nav-index-listing',
      heading: '.nav-index-section',
    },
    // 含 React、Vue、移动端、小程序等各技术栈的文档，导航结构相同。页面里另有一份不显示的导航副本，真正显示的在 <td-doc-aside> 的 Shadow DOM 里
    'tdesign.tencent.com': {
      shadow: 'td-doc-aside',
      menu: '.TDesign-doc-sidenav',
      group: '.TDesign-doc-sidenav-group',
      title: '.TDesign-doc-sidenav-group__title',
      item: '.TDesign-doc-sidenav-item',
    },
    // 含设计规范与组件文档。组件文档顶部有几项不在分组里的链接
    'devui.design': {
      menu: '.sidebar-wrapper',
      group: '.devui-accordion-item:has(> d-accordion-menu)',
      title: 'd-accordion-menu > .devui-accordion-item-title',
      item: '.sidebar-menu-item, d-accordion-item-routerlink',
      // 顶部的搜索框、底部的版本信息
      ignore: ['.sidebar-search-container', '.sidebar-footer'],
    },
    'arco.design': ARCO_MENU,
    // Vue 组件库的导航是另写的，不是 Arco 的菜单组件
    'arco.design/vue': {
      menu: '.aside-nav-body',
      group: '.aside-nav-group',
      title: '.aside-nav-group-name, .aside-nav-component-group-name',
      item: '.aside-nav-item',
    },
  };
  SITES['element.eleme.io'] = SITES['element.eleme.cn'];
  SITES['v2.vuejs.org/v2/'] = SITES['v2.cn.vuejs.org/v2/'];

  // ---------- 布局 ----------
  // 看板的默认布局，各网站可以用 layout 单独指定：
  // | 取值      | 排法                                                              | 滚动 |
  // | --------- | ----------------------------------------------------------------- | ---- |
  // | columns   | 每个分组从新的一列开始，一列放不下时接续到下一列                    | 横向 |
  // | waterfall | 按屏幕宽度分成若干列，分组依次从上往下排，排满一列再排下一列；分组不拆开 | 竖向 |
  const LAYOUT = 'columns';

  // ---------- 快捷键 ----------
  // 打开、关闭看板的快捷键，写作「修饰键+按键」，按下的修饰键必须与写的完全一致；看板打开时 Esc 也可关闭。
  // | 修饰键 | 按键                                  |
  // | ------ | ------------------------------------- |
  // | Ctrl   | Ctrl（macOS 上也是 Control）          |
  // | Alt    | Alt（macOS 为 Option）                |
  // | Shift  | Shift                                 |
  // | Meta   | macOS 为 ⌘ Command，Windows 为 Win 键 |
  // | Mod    | macOS 为 ⌘ Command，其他系统为 Ctrl   |
  // 按键写 KeyboardEvent.code，即物理按键，例如 KeyA … KeyZ、Digit0 … Digit9、F1 … F12、Backquote（`）。
  // 完整列表：https://developer.mozilla.org/docs/Web/API/UI_Events/Keyboard_event_code_values
  const SHORTCUT = 'Alt+KeyM';

  const IS_MAC = /mac/i.test(navigator.userAgentData?.platform ?? navigator.platform);
  const IS_ZH = navigator.language.startsWith('zh');

  /** @typedef {{ shadow?: string, menu: string, group: string, title: string, item: string, heading?: string, css?: string, ignore?: string[], layout?: 'columns' | 'waterfall' }} Site */

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
   * 当前页面对应的网站配置，命中多个时取最长的键，更具体的配置优先。
   * @returns {Site | undefined}
   */
  function currentSite() {
    const keys = Object.keys(SITES).filter((key) => matches(key, location));
    keys.sort((a, b) => b.length - a.length);
    return SITES[keys[0]];
  }

  // ---------- 读取导航 ----------

  /**
   * 元素的文字。各文字片段之间补一个空格：导航项常把英文名与中文名放在相邻的标签里，直接拼接会连在一起。
   * 跳过图标 SVG 里的文字，那是 <title> 这类提示，不是导航项的名字。
   * @param {Element} el
   * @returns {string}
   */
  function textOf(el) {
    const parts = [];
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      if (!walker.currentNode.parentElement.closest('svg')) parts.push(walker.currentNode.nodeValue);
    }
    return parts.join(' ').replace(/\s+/g, ' ').trim();
  }

  /**
   * 按配置分析导航的结构：每列从哪个元素开始、每个标题下有多少项。
   * @param {Site} site
   * @param {Element} menu 导航容器
   * @returns {{ items: Element[], starts: Element[], counts: Map<Element, number> }}
   */
  function readNav(site, menu) {
    /**
     * 元素所属的分组，不在导航内的分组不算。
     * @param {Element | null} el
     * @returns {Element | null}
     */
    const groupOf = (el) => {
      const group = el?.closest(site.group);
      return group && menu.contains(group) ? group : null;
    };
    // 分组 → 它自己的标题元素
    const titles = new Map();
    const titleOf = (group) => {
      if (!titles.has(group)) {
        titles.set(group, [...group.querySelectorAll(site.title)].find((el) => el.closest(site.group) === group) ?? null);
      }
      return titles.get(group);
    };
    // 各层级当前所在的小标题：分组（顶层为 null）→ 小标题元素
    const headings = new Map();
    // 列 → 列的第一个元素；列是分组或小标题，不在分组里的导航项归到 null
    const starts = new Map();
    // 标题或小标题 → 其下的项数
    const counts = new Map();
    const count = (el) => el && counts.set(el, (counts.get(el) ?? 0) + 1);
    const items = [];

    const selector = [site.group, site.item, site.heading].filter(Boolean).join(', ');
    for (const el of menu.querySelectorAll(selector)) {
      if (el.matches(site.group) || !textOf(el)) continue;
      const group = groupOf(el);
      if (site.heading && el.matches(site.heading)) {
        headings.set(group, el);
        continue;
      }
      items.push(el);
      const key = headings.get(group) ?? group;
      if (!starts.has(key)) starts.set(key, key ?? el);
      // 逐层向外计数：所在层级的小标题、所在分组的标题，再到外层分组
      for (let level = group; ; level = groupOf(level.parentElement)) {
        count(headings.get(level));
        if (!level) break;
        count(titleOf(level));
      }
    }
    return { items, starts: [...starts.values()], counts };
  }

  /**
   * 父元素；到了 Shadow DOM 的顶层，接着取它的宿主元素。
   * @param {Element} el
   * @returns {Element | null}
   */
  const parentOf = (el) => el.parentElement ?? el.getRootNode().host ?? null;

  /**
   * 颜色是否完全透明。
   * @param {string} color 计算后的颜色值
   * @returns {boolean}
   */
  const isTransparent = (color) => color === 'transparent' || /[,/]\s*0\s*\)$/.test(color);

  /**
   * 元素实际显示出来的背景色：从自身向外找第一个不透明的背景。
   * @param {Element} el
   * @returns {string}
   */
  function backgroundOf(el) {
    for (let node = el; node; node = parentOf(node)) {
      const color = getComputedStyle(node).backgroundColor;
      if (!isTransparent(color)) return color;
    }
    return 'Canvas';
  }

  // ---------- 看板 ----------
  // 看板是网站导航的副本，插在原导航旁边，网站按父元素写的样式照样生效；脚本只改布局，按列排开。
  // 副本外面包一层自己的滚动容器，由它铺满全屏、提供背景与滚动；副本只负责分列，高度可以随内容撑开，竖向滚动的布局才排得出来。
  const SCROLLER_TAG = 'user-script-nav-dashboard-board';
  const PREFIX = 'data-user-script-nav-dashboard';
  const OPEN_ATTR = `${PREFIX}-open`;
  const BOARD_ATTR = `${PREFIX}-board`;
  const LAYOUT_ATTR = `${PREFIX}-layout`;
  // 滚动容器的祖先：去掉会让 position: fixed 改为相对它定位的属性，并抬高层级
  const ANCESTOR_ATTR = `${PREFIX}-ancestor`;
  // 副本内部：列的起点、直接含有导航项的分组、包着导航项的外层元素、导航项、标题
  const BREAK_ATTR = `${PREFIX}-break`;
  const UNIT_ATTR = `${PREFIX}-unit`;
  const WRAP_ATTR = `${PREFIX}-wrap`;
  const ITEM_ATTR = `${PREFIX}-item`;
  const TITLE_ATTR = `${PREFIX}-title`;
  const COUNT_CLASS = 'user-script-nav-dashboard-count';
  const BOARD = `[${BOARD_ATTR}]`;

  const pageStyle = document.createElement('style');
  pageStyle.className = 'user-script-nav-dashboard-style';
  pageStyle.textContent = `
    /* 看板打开时锁住页面滚动 */
    html[${OPEN_ATTR}] { overflow: hidden !important; }

    /* 滚动容器的祖先：这些属性会让 position: fixed 改为相对祖先定位、或被祖先裁剪，看板就铺不满全屏；
       z-index 抬高，让看板盖过网站的顶栏等其他层 */
    [${ANCESTOR_ATTR}] {
      transform: none !important; translate: none !important; rotate: none !important; scale: none !important;
      filter: none !important; backdrop-filter: none !important; perspective: none !important;
      clip-path: none !important; mask: none !important;
      contain: none !important; container-type: normal !important; will-change: auto !important;
      z-index: 2147483646 !important;
    }

    /* 滚动容器：铺满全屏，背景取导航实际显示的颜色；顶部留出右上角总数与关闭按钮的位置 */
    ${SCROLLER_TAG} {
      position: fixed !important; inset: 0 !important; z-index: 2147483646 !important;
      box-sizing: border-box !important; display: block !important;
      padding: 28px 16px 14px !important; overscroll-behavior: contain;
      background: var(--user-script-nav-dashboard-bg) !important;
    }
    /* 分列布局横向滚动，瀑布流竖向滚动 */
    ${SCROLLER_TAG}[${LAYOUT_ATTR}="columns"] { overflow: auto hidden !important; }
    ${SCROLLER_TAG}[${LAYOUT_ATTR}="waterfall"] { overflow: hidden auto !important; }

    /* 导航副本：去掉网站给侧栏定的位置、尺寸、边距与滚动，只保留内部样式；
       分成宽 240px 的多列，瀑布流按内容平衡各列高度；
       左右外边距 auto，脚本把宽度收窄到实际用到的列数后水平居中 */
    ${BOARD} {
      position: static !important; inset: auto !important; z-index: auto !important; float: none !important;
      box-sizing: border-box !important; display: block !important;
      width: auto !important; height: auto !important; min-width: 0 !important; min-height: 0 !important;
      max-width: none !important; max-height: none !important;
      margin: 0 auto !important; padding: 0 !important; border: 0 !important; box-shadow: none !important;
      overflow: visible !important; background: transparent !important;
      columns: 240px auto !important; column-gap: 20px !important; column-fill: balance !important;
      transform: none !important; translate: none !important; opacity: 1 !important; visibility: visible !important;
    }
    /* 分列布局：高度固定为一屏，排满一列再排下一列，多出的列向右延伸 */
    [${LAYOUT_ATTR}="columns"] > ${BOARD} { height: 100% !important; column-fill: auto !important; }

    /* 包着导航项的外层元素：撑开折叠、取消内部滚动与自带的分栏、浮动，让内容能分到看板的各列 */
    ${BOARD} [${WRAP_ATTR}] {
      width: auto !important; min-width: 0 !important; max-width: none !important;
      height: auto !important; max-height: none !important; overflow: visible !important;
      columns: auto !important; float: none !important; visibility: visible !important;
    }
    /* 原本是 flex、grid 或隐藏的，改为普通块，才能跨列分段 */
    ${BOARD} [${WRAP_ATTR}~="display"] { display: block !important; }
    /* 原本 fixed、sticky 的，改回正常排列，不再脱离各列 */
    ${BOARD} [${WRAP_ATTR}~="position"] { position: static !important; }

    /* 分列布局：每列的起点另起一列 */
    [${LAYOUT_ATTR}="columns"] ${BOARD} [${BREAK_ATTR}] { break-before: column !important; }
    /* 瀑布流：分组整块放在同一列，不拆开 */
    [${LAYOUT_ATTR}="waterfall"] ${BOARD} [${UNIT_ATTR}] { break-inside: avoid; }
    /* 单个导航项不拆到两列 */
    ${BOARD} [${ITEM_ATTR}] { break-inside: avoid; }
    /* 标题不拆开，也不与下面的第一项分到两列 */
    ${BOARD} [${TITLE_ATTR}] { break-inside: avoid; break-after: avoid; }

    /* 标题后的项数：跟随标题的字体与颜色，只是更小、更淡 */
    ${BOARD} .${COUNT_CLASS} { margin-inline-start: 0.5em; font-size: 0.85em; font-weight: normal; opacity: 0.55; }
  `;
  document.head.append(pageStyle);

  // 网站之外的控件（打开按钮、关闭按钮、总数）放在 Shadow DOM 里，颜色与字体取自网站
  const host = document.createElement('user-script-nav-dashboard');
  host.style.cssText = 'all: initial; position: fixed; top: 0; left: 0; z-index: 2147483647;';
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `
    <style>
      :host { color-scheme: light dark; }
      * { box-sizing: border-box; }
      button {
        display: grid; place-items: center; padding: 0; border: 0; border-radius: 50%;
        background: var(--bg, Canvas); color: var(--fg, CanvasText); cursor: pointer;
      }
      .toggle {
        position: fixed; right: 16px; bottom: 16px; width: 40px; height: 40px;
        border: 1px solid color-mix(in srgb, currentColor 15%, transparent); box-shadow: 0 2px 8px rgb(0 0 0 / 0.15);
        opacity: 0.6; transition: opacity 0.15s;
      }
      .toggle:hover, .toggle:focus-visible { opacity: 1; }
      .bar {
        position: fixed; top: 12px; right: 16px;
        display: none; gap: 8px; align-items: center;
        color: var(--fg, CanvasText); font: 14px/1.5 var(--font, system-ui, sans-serif);
      }
      .total { opacity: 0.55; }
      .close { width: 32px; height: 32px; background: transparent; opacity: 0.7; }
      .close:hover, .close:focus-visible { opacity: 1; background: color-mix(in srgb, currentColor 10%, transparent); }
      :host([open]) .bar { display: flex; }
      :host([open]) .toggle { display: none; }
    </style>
    <button class="toggle" type="button"></button>
    <div class="bar"><span class="total"></span><button class="close" type="button"></button></div>
  `;

  const toggleButton = root.querySelector('.toggle');
  const closeButton = root.querySelector('.close');
  const totalEl = root.querySelector('.total');
  const LABEL = IS_ZH ? `导航看板（${SHORTCUT}）` : `Nav dashboard (${SHORTCUT})`;
  toggleButton.title = LABEL;
  toggleButton.setAttribute('aria-label', LABEL);
  closeButton.title = IS_ZH ? '关闭' : 'Close';
  closeButton.setAttribute('aria-label', closeButton.title);
  // 图标取自 Lucide（lucide-static v1.60.0，ISC 许可）：layout-grid、x
  toggleButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>';
  closeButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';
  document.documentElement.append(host);

  /**
   * 让控件的颜色与字体跟随网站。
   * @param {Element} el 取样的网站元素
   */
  function adoptColors(el) {
    const style = getComputedStyle(el);
    host.style.setProperty('--fg', style.color);
    host.style.setProperty('--bg', backgroundOf(el));
    host.style.setProperty('--font', style.fontFamily);
  }
  adoptColors(document.body);

  /**
   * 是否为当前页面的链接：比较路径与 hash，忽略末尾斜杠与查询参数。
   * @param {string} href
   * @returns {boolean}
   */
  function isCurrent(href) {
    const url = new URL(href, location.href);
    const normalize = (path) => path.replace(/\/+$/, '');
    return url.origin === location.origin && normalize(url.pathname) === normalize(location.pathname) && (!url.hash || url.hash === location.hash);
  }

  /**
   * 把看板收窄到实际用到的列数，配合左右 auto 的外边距水平居中。
   * 多列容器总按可用宽度排出列数，内容少时右边空着几列；CSS 无法让它按用到的列收缩，只能量出来再设宽度。
   * 用到的列超出一屏（分列布局横向滚动）时保持原宽。
   * @param {HTMLElement} board
   * @param {Element[]} items
   */
  function fitWidth(board, items) {
    board.style.removeProperty('width');
    const style = getComputedStyle(board);
    const width = board.clientWidth;
    const gap = parseFloat(style.columnGap) || 0;
    // 与浏览器算列数的方式一致：在列宽不小于 column-width 的前提下排尽量多的列，列宽再均分剩余空间
    const count = Math.max(1, Math.floor((width + gap) / (parseFloat(style.columnWidth) + gap)));
    const columnWidth = (width - (count - 1) * gap) / count;
    const left = board.getBoundingClientRect().left;
    let used = 0;
    for (const item of items) {
      used = Math.max(used, Math.floor((item.getBoundingClientRect().left - left + 1) / (columnWidth + gap)) + 1);
    }
    if (used === 0 || used >= count) return;
    board.style.setProperty('width', `${used * columnWidth + (used - 1) * gap}px`, 'important');
  }

  /** @type {{ scroller: Element | null, ancestors: Element[], styles: HTMLStyleElement[], onResize?: () => void } | null} */
  let state = null;
  const isOpen = () => state !== null;

  /**
   * 列的分界：从列的第一个元素往前、往外找，把前面不含导航项的元素（外层分组的标题、小标题、分隔线）一起带进这一列。
   * 一直找到看板开头时返回 null：第一列本来就从开头排起，在开头分列反而会空出一列。
   * @param {Element} start
   * @param {Element} board
   * @param {(el: Element) => boolean} hasItems
   * @returns {Element | null}
   */
  function breakOf(start, board, hasItems) {
    let target = start;
    for (;;) {
      const prev = target.previousElementSibling;
      if (prev) {
        if (hasItems(prev)) return target;
        target = prev;
      } else if (target.parentElement === board) {
        return null;
      } else {
        target = target.parentElement;
      }
    }
  }

  function open() {
    const site = currentSite();
    const scope = site?.shadow ? document.querySelector(site.shadow)?.shadowRoot : document;
    const menu = site && scope?.querySelector(site.menu);
    if (!menu) {
      totalEl.textContent = IS_ZH ? '当前页面没有找到导航' : 'No navigation found on this page';
      host.setAttribute('open', '');
      state = { scroller: null, ancestors: [], styles: [] };
      closeButton.focus();
      return;
    }

    const layout = site.layout ?? LAYOUT;
    const scroller = document.createElement(SCROLLER_TAG);
    scroller.setAttribute(LAYOUT_ATTR, layout);
    scroller.style.setProperty('--user-script-nav-dashboard-bg', backgroundOf(menu));
    const board = menu.cloneNode(true);
    board.setAttribute(BOARD_ATTR, '');
    scroller.append(board);
    // 折叠的内容在副本里要展开，也要能点
    for (const el of board.querySelectorAll('[hidden], [inert], [aria-hidden="true"]')) {
      el.removeAttribute('hidden');
      el.removeAttribute('inert');
      if (!el.matches('svg, svg *')) el.removeAttribute('aria-hidden');
    }
    // 副本与原导航的链接一一对应，要在去掉忽略的元素之前配好
    const originals = menu.querySelectorAll('a[href]');
    const originalOf = new Map([...board.querySelectorAll('a[href]')].map((link, i) => [link, originals[i]]));
    menu.after(scroller);
    // 插入页面后再去掉，带外层上下文的选择器（例如 .sidebar nav > .ad）才能匹配
    for (const selector of site.ignore ?? []) {
      for (const el of board.querySelectorAll(selector)) el.remove();
    }

    const ancestors = [];
    for (let el = scroller.parentElement; el; el = parentOf(el)) {
      el.setAttribute(ANCESTOR_ATTR, '');
      ancestors.push(el);
    }

    // 页面的样式进不了 Shadow DOM，导航在 Shadow DOM 里时往里面再放一份
    const styles = [];
    const styleRoot = menu.getRootNode() === document ? document.head : menu.getRootNode();
    if (styleRoot !== document.head) styles.push(pageStyle.cloneNode(true));
    if (site.css) {
      const style = document.createElement('style');
      style.className = 'user-script-nav-dashboard-site-style';
      style.textContent = `${BOARD} { ${site.css} }`;
      styles.push(style);
    }
    styleRoot.append(...styles);

    const { items, starts, counts } = readNav(site, board);
    const hasItems = (el) => items.some((item) => el === item || el.contains(item));

    // 包着导航项的外层元素：撑开高度、取消滚动，让内容能分到各列；flex、grid、隐藏的改为普通块
    const wraps = new Set();
    for (const item of items) {
      item.setAttribute(ITEM_ATTR, '');
      for (let el = item.parentElement; el && el !== board; el = el.parentElement) wraps.add(el);
    }
    for (const el of wraps) {
      const computed = getComputedStyle(el);
      const tokens = [];
      if (!['block', 'list-item', 'flow-root'].includes(computed.display)) tokens.push('display');
      if (['fixed', 'sticky'].includes(computed.position)) tokens.push('position');
      el.setAttribute(WRAP_ATTR, tokens.join(' '));
    }
    for (const start of starts) {
      breakOf(start, board, hasItems)?.setAttribute(BREAK_ATTR, '');
      if (start.matches(site.group)) start.setAttribute(UNIT_ATTR, '');
    }
    for (const [title, n] of counts) {
      title.setAttribute(TITLE_ATTR, '');
      const badge = document.createElement('span');
      badge.className = COUNT_CLASS;
      badge.textContent = n;
      title.append(badge);
    }

    // 普通点击交给原导航里对应的链接，让网站自己的路由处理；Ctrl/⌘+点击、中键等保留浏览器行为，在新标签页打开
    const boardLinks = [...board.querySelectorAll('a[href]')];
    board.addEventListener('click', (event) => {
      const link = event.target.closest('a[href]');
      if (!link) return;
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      event.stopPropagation();
      const original = originalOf.get(link);
      close();
      if (original?.isConnected) original.click();
      else location.assign(link.href);
    });
    // 横向滚动的布局里，竖向的滚轮也转成横向
    scroller.addEventListener('wheel', (event) => {
      if (layout !== 'columns' || event.deltaX !== 0 || event.ctrlKey) return;
      event.preventDefault();
      scroller.scrollLeft += event.deltaY;
    }, { passive: false });

    // 窗口宽度变了，列数随之变化，重新收窄
    const onResize = () => fitWidth(board, items);
    window.addEventListener('resize', onResize);

    state = { scroller, ancestors, styles, onResize };
    totalEl.textContent = IS_ZH ? `共 ${items.length} 项` : `${items.length} items`;
    adoptColors(board);
    host.setAttribute('open', '');
    document.documentElement.setAttribute(OPEN_ATTR, '');
    fitWidth(board, items);
    boardLinks.find((link) => isCurrent(link.href))?.scrollIntoView({ block: 'center', inline: 'center' });
    closeButton.focus();
  }

  function close() {
    if (!state) return;
    state.scroller?.remove();
    for (const style of state.styles) style.remove();
    if (state.onResize) window.removeEventListener('resize', state.onResize);
    for (const el of state.ancestors) el.removeAttribute(ANCESTOR_ATTR);
    state = null;
    host.removeAttribute('open');
    document.documentElement.removeAttribute(OPEN_ATTR);
    adoptColors(document.body);
  }

  const toggle = () => (isOpen() ? close() : open());
  toggleButton.addEventListener('click', toggle);
  closeButton.addEventListener('click', close);

  // ---------- 快捷键 ----------
  const MODIFIERS = ['Ctrl', 'Alt', 'Shift', 'Meta'];
  const shortcutParts = SHORTCUT.split('+').map((part) => part.trim());
  const shortcutCode = shortcutParts.pop();
  const shortcutMods = new Set(shortcutParts.map((part) => (part === 'Mod' ? (IS_MAC ? 'Meta' : 'Ctrl') : part)));

  // 在 window 的捕获阶段处理，先于页面与输入框；用 code 判断物理按键，macOS 上 Option+字母的 key 是特殊字符
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && isOpen()) {
      event.preventDefault();
      event.stopPropagation();
      close();
      return;
    }
    const pressed = { Ctrl: event.ctrlKey, Alt: event.altKey, Shift: event.shiftKey, Meta: event.metaKey };
    if (event.code !== shortcutCode || !MODIFIERS.every((name) => pressed[name] === shortcutMods.has(name))) return;
    event.preventDefault();
    event.stopPropagation();
    toggle();
  }, true);
})();
