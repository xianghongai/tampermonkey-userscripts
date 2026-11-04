// ==UserScript==
// @name         DeepSeek: Compact Tokens
// @name:en      DeepSeek: Compact Tokens
// @namespace    https://github.com/xianghongai
// @version      1.0.1
// @description  Show token usage on the DeepSeek Platform usage page in compact K/M/B units and add a refresh button to the toolbar; hover the number for the exact value and the unit for Chinese unit conversions.
// @description:en  Show token usage on the DeepSeek Platform usage page in compact K/M/B units and add a refresh button to the toolbar; hover the number for the exact value and the unit for Chinese unit conversions.
// @description:zh-CN  把 DeepSeek 平台用量页面的 Token 数量显示为 K/M/B 缩写，并在工具栏添加刷新按钮；悬停数值可看精确值与中文换算，悬停单位可看千/万/亿等对照。
// @description:zh-TW  把 DeepSeek 平台用量頁面的 Token 數量顯示為 K/M/B 縮寫，並在工具列加入重新整理按鈕；懸停數值可看精確值與中文換算，懸停單位可看千/萬/億等對照。
// @author       xianghongai <xianghongai@gmail.com>
// @license      MIT
// @icon         https://xinlu.ink/favicon.ico
// @match        https://platform.deepseek.com/usage*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

console.log(GM_info.script.name);

(() => {
  'use strict';

  const PREFIX = 'user-script-deepseek-compact-tokens';
  const UNIT_CLASS = `${PREFIX}-unit`;
  const COUNT_RE = /^(?:\d{1,3}(?:,\d{3})+|\d+)$/;
  const UNIT_RE = /^([\d.]+)([KMB])$/;
  const SUFFIXES = ['K', 'M', 'B'];
  const SCAN_DELAY = 250;

  // 页面上 Tokens 的文案；站点改文案或切换语言后不生效时，在这里补上新文案
  const LABEL_TEXTS = ['Tokens', 'Token usage', 'Token 用量', '令牌'];
  const LABEL_SET = new Set(LABEL_TEXTS.map((text) => text.toLowerCase()));

  // 缩写数值保留的小数位数，按需改这里
  const DECIMALS = 2;

  const REFRESH_ATTR = `data-${PREFIX}-refresh`;
  // Lucide refresh-cw
  const REFRESH_ICON = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"',
    ' stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">',
    '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>',
    '<path d="M21 3v5h-5"/>',
    '<path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>',
    '<path d="M8 16H3v5"/>',
    '</svg>',
  ].join('');

  const UNIT_HELP = [
    'Token 单位换算',
    '1K = 千',
    '10K = 万',
    '100K = 十万',
    '1M = 百万',
    '10M = 千万',
    '100M = 亿',
    '1B = 十亿',
    '10B = 百亿',
    '100B = 千亿',
  ].join('\n');

  // 把已放大 10^digits 倍的整数还原成小数文本；小数位直接截断，不四舍五入
  function fromScaled(scaled, digits) {
    if (digits === 0) return String(scaled);

    const text = String(scaled).padStart(digits + 1, '0');
    const whole = text.slice(0, -digits);
    const fraction = text.slice(-digits).replace(/0+$/, '');
    return fraction ? `${whole}.${fraction}` : whole;
  }

  // 1234 -> 1.23K，95773316 -> 95.77M；小数直接截断，不四舍五入
  function formatCount(count) {
    if (count < 1000) return String(count);

    let unit = 0;
    while (unit < SUFFIXES.length - 1 && count >= 1000 ** (unit + 2)) {
      unit += 1;
    }

    const scaled = Math.floor((count * 10 ** DECIMALS) / 1000 ** (unit + 1));
    return `${fromScaled(scaled, DECIMALS)}${SUFFIXES[unit]}`;
  }

  // 中文语境下的近似值，供数值的悬停提示使用
  function formatChinese(count) {
    if (count < 1e4) return '';

    const [divisor, unit] = count < 1e8 ? [1e4, '万'] : [1e8, '亿'];
    const digits = count >= divisor * 100 ? 0 : DECIMALS;
    const scaled = Math.floor((count * 10 ** digits) / divisor);
    const [whole, fraction] = fromScaled(scaled, digits).split('.');

    return `${Number(whole).toLocaleString('zh-CN')}${fraction ? `.${fraction}` : ''}${unit}`;
  }

  // 从 Tokens 标签向上找最近一层包含数字的容器：汇总卡片里标签与数值分处两行，
  // 分 API Key 卡片里两者同处一行，这种方式都不依赖站点生成的哈希类名。
  function findValues(label) {
    let scope = label.parentElement;

    for (let level = 0; level < 4 && scope; level += 1) {
      const values = [...scope.querySelectorAll('span, div')].filter(
        (el) => el.children.length === 0 && COUNT_RE.test(el.textContent.trim()),
      );
      if (values.length > 0) return values;
      scope = scope.parentElement;
    }

    return [];
  }

  // 保留页面原有的文本节点，只改它的值并在后面追加单位元素；
  // React 更新数据时会写回原文本节点，脚本还能据此再次转换。
  function setLeadingText(container, text) {
    const first = container.firstChild;
    if (first && first.nodeType === Node.TEXT_NODE) {
      if (first.nodeValue !== text) first.nodeValue = text;
      return;
    }
    container.insertBefore(document.createTextNode(text), first);
  }

  function compact(container, original) {
    const count = Number(original.replace(/,/g, ''));
    const compacted = formatCount(count);

    const chinese = formatChinese(count);
    const exact = chinese ? `${original}（${chinese}）` : original;
    if (container.title !== exact) container.title = exact;

    const match = UNIT_RE.exec(compacted);
    if (!match) {
      setLeadingText(container, compacted);
      container.querySelector(`.${UNIT_CLASS}`)?.remove();
      return;
    }

    setLeadingText(container, match[1]);

    let unit = container.querySelector(`.${UNIT_CLASS}`);
    if (!unit) {
      unit = document.createElement('span');
      unit.className = UNIT_CLASS;
      unit.title = UNIT_HELP;
      unit.style.cursor = 'help';
      container.append(unit);
    }
    if (unit.textContent !== match[2]) unit.textContent = match[2];
  }

  function scan() {
    for (const label of document.querySelectorAll('span, div')) {
      if (label.children.length > 0) continue;
      if (!LABEL_SET.has(label.textContent.trim().toLowerCase())) continue;

      for (const value of findValues(label)) {
        compact(value, value.textContent.trim());
      }
    }
  }

  // 页面数据更新时 React 会把原值写回数值的文本节点，单位元素仍留在原地；
  // 这里单独找出这些节点，重新拆分数值与单位。
  function refreshUnits() {
    for (const unit of document.querySelectorAll(`.${UNIT_CLASS}`)) {
      const container = unit.parentElement;
      const first = container.firstChild;
      if (!first || first.nodeType !== Node.TEXT_NODE) continue;

      const original = first.nodeValue.trim();
      if (COUNT_RE.test(original)) compact(container, original);
    }
  }

  // 按钮提示随站点语言切换；站点没有本地化时退回英文
  function refreshLabel() {
    const lang = (document.documentElement.lang || navigator.language || '').toLowerCase();
    if (lang.startsWith('zh-tw') || lang.startsWith('zh-hk') || lang.includes('hant')) return '重新整理';
    return lang.startsWith('zh') ? '刷新' : 'Refresh';
  }

  // 站点没有提供页内刷新：用量数据由 SWR 按筛选参数缓存，重新选择同一条件不会重新请求；
  // 站点自身需要刷新时也是 window.location.reload()，这里采用同样的方式。
  // 按钮沿用站点 ds-button 的图标按钮样式，跟随工具栏一起显示。
  function createRefreshButton() {
    const label = refreshLabel();
    const button = document.createElement('div');
    button.setAttribute(REFRESH_ATTR, '');
    button.setAttribute('role', 'button');
    button.setAttribute('tabindex', '0');
    button.setAttribute('aria-label', label);
    button.title = label;
    button.className =
      'ds-button ds-button--iconLabelPrimary ds-button--icon ds-button--circle ds-button--m ds-button--icon-relative-m';
    button.style.setProperty('--dsl-button-height', '34px');
    button.innerHTML = `<div class="ds-button__background"></div><div class="ds-button__icon ds-button__icon--last-child">${REFRESH_ICON}</div>`;

    const reload = () => window.location.reload();
    button.addEventListener('click', reload);
    button.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      reload();
    });

    return button;
  }

  // 工具栏随页面重绘时按钮可能被移除，每次扫描顺带补回
  function ensureRefreshButton() {
    const dateFilter = document.querySelector('[data-filter-item="date"]');
    const toolbar = dateFilter && dateFilter.parentElement;
    if (!toolbar || toolbar.querySelector(`[${REFRESH_ATTR}]`)) return;

    const actions = toolbar.querySelectorAll('.ds-button');
    const group = actions.length > 0 ? actions[actions.length - 1].parentElement : null;
    if (!group) return;

    group.append(createRefreshButton());
  }

  function refresh() {
    ensureRefreshButton();
    refreshUnits();
    scan();
  }

  // 页面数据会异步加载、随筛选条件重绘，数值被还原后再次转换
  let timer = null;
  function scheduleScan() {
    if (timer !== null) return;
    timer = window.setTimeout(() => {
      timer = null;
      refresh();
    }, SCAN_DELAY);
  }

  // 图表动画会持续产生 SVG 变更，脚本自身也会改动数值文字；
  // 只对可能是 Tokens 文案或原始数字的变更重新扫描。
  function closestElement(node) {
    return node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
  }

  function isChartNode(node) {
    const el = closestElement(node);
    return Boolean(el && el.closest('svg'));
  }

  function isUnitNode(node) {
    const el = closestElement(node);
    return Boolean(el && el.closest(`.${UNIT_CLASS}`));
  }

  function onMutations(records) {
    for (const record of records) {
      if (record.type === 'characterData') {
        const text = (record.target.nodeValue || '').trim();
        if (!COUNT_RE.test(text) && !LABEL_SET.has(text.toLowerCase())) continue;
        if (isChartNode(record.target) || isUnitNode(record.target)) continue;
        scheduleScan();
        return;
      }

      for (const node of record.addedNodes) {
        if (isChartNode(node) || isUnitNode(node)) continue;
        scheduleScan();
        return;
      }
    }
  }

  refresh();
  new MutationObserver(onMutations).observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  });
})();
