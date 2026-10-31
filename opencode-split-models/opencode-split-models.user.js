// ==UserScript==
// @name         OpenCode: Split Models
// @name:en      OpenCode: Split Models
// @namespace    https://github.com/xianghongai
// @version      1.1.2
// @description  Split the Models page of the OpenCode console into two lists: enabled models on top and disabled models below. Toggling a model moves it to the matching list. The page's own column sorting still applies to both lists. Turn off the switch next to the Model actions button to show all models in one list.
// @description:en  Split the Models page of the OpenCode console into two lists: enabled models on top and disabled models below. Toggling a model moves it to the matching list. The page's own column sorting still applies to both lists. Turn off the switch next to the Model actions button to show all models in one list.
// @description:zh-CN  把 OpenCode 控制台的 Models 页面分成两个列表：已启用的模型在上，未启用的在下；开关模型后自动移到对应的列表。页面自带的表头排序对两个列表同时生效。关闭 Model actions 按钮旁的开关，可以取消分组，把全部模型放在同一个列表中比较价格。
// @description:zh-TW  把 OpenCode 控制台的 Models 頁面分成兩個列表：已啟用的模型在上，未啟用的在下；切換模型開關後自動移到對應的列表。頁面自帶的表頭排序對兩個列表同時生效。關閉 Model actions 按鈕旁的開關，可以取消分組，把全部模型放在同一個列表中比較價格。
// @author       xianghongai <xianghongai@gmail.com>
// @license      MIT
// @icon         https://xinlu.ink/favicon.ico
// @match        https://opencode.ai/console/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

console.log(GM_info.script.name);

(() => {
  'use strict';

  const PREFIX = 'user-script-opencode-split-models';
  const GROUP_CLASS = `${PREFIX}-group`;
  const GROUP_ATTR = `data-${PREFIX}-group`;
  const TOGGLE_CLASS = `${PREFIX}-toggle`;
  const TRACK_CLASS = `${PREFIX}-track`;
  const GROUPED_KEY = `${PREFIX}-grouped`;
  const STYLE_ID = `${PREFIX}-style`;
  const GUARD_TEXT = `${PREFIX}-guard`;

  // 两组的标题，顺序即页面上的显示顺序
  const GROUPS = [
    { kind: 'enabled', label: 'Enabled models' },
    { kind: 'disabled', label: 'Disabled models' },
  ];

  const CSS = `
    .${GROUP_CLASS} > td {
      padding: 16px 12px 8px;
      font-size: 0.75rem;
      font-weight: 600;
      opacity: 0.6;
    }
    .${TOGGLE_CLASS} {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      flex-shrink: 0;
      padding: 0;
      border: 0;
      background: none;
      color: inherit;
      font: inherit;
      font-size: 0.875rem;
      white-space: nowrap;
      cursor: pointer;
    }
    .${TRACK_CLASS} {
      position: relative;
      width: 2rem;
      height: 1.125rem;
      border-radius: 999px;
      background-color: color-mix(in srgb, currentColor 25%, transparent);
      transition: background-color 0.15s;
    }
    .${TRACK_CLASS}::after {
      content: '';
      position: absolute;
      top: 0.125rem;
      left: 0.125rem;
      width: 0.875rem;
      height: 0.875rem;
      border-radius: 50%;
      background-color: Canvas;
      transition: transform 0.15s;
    }
    .${TOGGLE_CLASS}[aria-checked="true"] .${TRACK_CLASS} {
      background-color: currentColor;
    }
    .${TOGGLE_CLASS}[aria-checked="true"] .${TRACK_CLASS}::after {
      transform: translateX(0.875rem);
    }
  `;

  // 排序交给页面自带的表头按钮。页面会整批重建行，也可能在原位重建个别行；
  // 新行的序号取前后相邻行序号的中点，重建后仍留在原来的位置。
  // 取消分组时按序号还原，不会留下分组后的顺序。
  const siteOrder = new WeakMap();
  let nextSiteOrder = 0;

  function nearestOrder(row, direction) {
    for (let node = row[direction]; node; node = node[direction]) {
      const order = siteOrder.get(node);
      if (order !== undefined) return order;
    }
    return null;
  }

  function siteOrderOf(row) {
    let order = siteOrder.get(row);
    if (order !== undefined) return order;

    const prev = nearestOrder(row, 'previousElementSibling');
    const next = nearestOrder(row, 'nextElementSibling');
    if (prev !== null && next !== null) order = (prev + next) / 2;
    else if (prev !== null) order = prev + 1;
    else if (next !== null) order = next - 1;
    else order = nextSiteOrder++;

    // 序号相同的行由稳定排序按文档顺序排列，因此不必保证严格递增
    siteOrder.set(row, order);
    return order;
  }

  // 是否按可用状态分成两组，默认开启；记在本机，刷新后保持
  // 读写失败（例如隐私模式）时按默认值处理，只是刷新后不保持
  function readGrouped() {
    try {
      return localStorage.getItem(GROUPED_KEY) !== 'false';
    } catch {
      return true;
    }
  }

  function writeGrouped(value) {
    try {
      localStorage.setItem(GROUPED_KEY, String(value));
    } catch {
      // 写入失败时忽略，本次页面内仍然生效
    }
  }

  let grouped = readGrouped();

  // ---------- 查找与读取 ----------

  // 表头文字。页面把可排序的列包成了按钮，后面跟一个排序箭头（↕、↓、↑），这里只取文字。
  function headerLabel(cell) {
    return cell.textContent.replace(/[↕↑↓]/g, '').trim();
  }

  // 模型表的表头第一列是 Model，最后一列是 Enabled，页面上的其他表格不会命中。
  // 站点改版、表头文字变了时，这里要跟着改。
  function isModelTable(table) {
    const heads = [...(table.tHead?.rows[0]?.cells ?? [])].map(headerLabel);
    return heads[0] === 'Model' && heads.at(-1) === 'Enabled';
  }

  function findModelTables() {
    return [...document.querySelectorAll('table')].filter(isModelTable);
  }

  // 模型行的最后一列是开关，分组行没有开关，借此区分两者
  function switchOf(row) {
    return row.cells[row.cells.length - 1]?.querySelector('input[role="switch"]') ?? null;
  }

  function isEnabled(toggle) {
    return toggle.getAttribute('aria-checked') === 'true';
  }

  // ---------- 分组 ----------

  function createTitle(kind, colspan) {
    const tr = document.createElement('tr');
    tr.className = GROUP_CLASS;
    tr.setAttribute(GROUP_ATTR, kind);
    const td = document.createElement('td');
    td.colSpan = colspan;
    tr.append(td);
    return tr;
  }

  // 找出本表已有的标题行（每组只留第一个），并记下模型行及其可用状态。
  // 行按页面当前的顺序排列（页面的排序、搜索都会重排或重建行），分组只在这个顺序上分组，不另排。
  function collect(tbody) {
    const titles = new Map();
    for (const tr of tbody.querySelectorAll(`:scope > .${GROUP_CLASS}`)) {
      const kind = tr.getAttribute(GROUP_ATTR);
      if (titles.has(kind)) tr.remove();
      else titles.set(kind, tr);
    }

    // 没有开关的行（例如空状态提示）不参与分组，会被留在最后
    const rows = [];
    for (const row of tbody.rows) {
      const toggle = switchOf(row);
      if (toggle) rows.push({ row, enabled: isEnabled(toggle), order: siteOrderOf(row) });
    }
    rows.sort((a, b) => a.order - b.order);
    return { titles, rows };
  }

  // 标题里的数量每次都更新，文字没变时不写 DOM
  function setTitleText(tr, text) {
    const cell = tr.cells[0];
    if (cell.textContent !== text) cell.textContent = text;
  }

  // 按目标顺序排列节点。已经在目标位置的节点不再移动，因此整理完成后再次整理不会改动 DOM。
  // 节点只在 tbody 内移动，不搬到别的父元素下：框架按列表增删行，行若被搬走，框架的插入和删除就会出错。
  function placeInOrder(tbody, sequence) {
    // 移动行会让焦点丢失，记下原来的焦点，整理后放回去，并且不滚动页面
    const focused = document.activeElement;
    let ref = tbody.firstElementChild;
    for (const el of sequence) {
      if (el === ref) ref = ref.nextElementSibling;
      else tbody.insertBefore(el, ref);
    }

    if (focused?.isConnected && focused !== document.body && focused !== document.activeElement) {
      focused.focus({ preventScroll: true });
    }
  }

  // 页面用 Solid 渲染表格，它按数组顺序管理行。整批替换行时，Solid 会先记下「最后一行后面的
  // 节点」作为新行的插入位置，再删掉旧行；这个节点若恰好是同一批里被删掉的行，插入时就会抛
  // "insertBefore: ... is not a child of this node"，页面显示 Something went wrong。
  // 在每行后面放一个注释节点作护栏，插入位置就永远是 Solid 不认识的节点。注释不参与渲染。
  function isGuard(node) {
    return node?.nodeType === Node.COMMENT_NODE && node.data === GUARD_TEXT;
  }

  // 护栏紧跟在模型行后面，每行只留一个；表里不再有模型行时全部清掉
  function syncGuards(tbody, rows) {
    const guards = new Set();
    for (const row of rows) {
      let guard = row.nextSibling;
      if (!isGuard(guard)) {
        guard = document.createComment(GUARD_TEXT);
        tbody.insertBefore(guard, row.nextSibling);
      }
      guards.add(guard);
    }
    for (const node of [...tbody.childNodes]) {
      if (isGuard(node) && !guards.has(node)) node.remove();
    }
  }

  function reconcile(table) {
    const tbody = table.tBodies[0];
    if (!tbody) return;

    const { titles, rows } = collect(tbody);

    // 一个模型都没有时（加载中或搜索无结果）不显示分组标题，保留框架原本的空状态
    if (!rows.length) {
      for (const tr of titles.values()) tr.remove();
      syncGuards(tbody, []);
      return;
    }

    const modelRows = rows.map(({ row }) => row);

    // 关闭分组时不显示标题，全部模型放在同一个列表里，保持页面当前的顺序
    if (!grouped) {
      for (const tr of titles.values()) tr.remove();
      placeInOrder(tbody, modelRows);
      syncGuards(tbody, modelRows);
      return;
    }

    const colspan = table.tHead.rows[0].cells.length;
    const sequence = [];
    for (const { kind, label } of GROUPS) {
      if (!titles.has(kind)) titles.set(kind, createTitle(kind, colspan));
      const groupRows = rows.filter(({ enabled }) => enabled === (kind === 'enabled')).map(({ row }) => row);
      setTitleText(titles.get(kind), `${label} (${groupRows.length})`);

      // 目标顺序：本组的标题在前，本组的行接在后面
      sequence.push(titles.get(kind), ...groupRows);
    }
    placeInOrder(tbody, sequence);
    syncGuards(tbody, modelRows);
  }

  function reconcileAll() {
    ensureToggle();
    for (const table of findModelTables()) reconcile(table);
  }

  // ---------- 分组开关 ----------

  function createToggle() {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = TOGGLE_CLASS;
    button.setAttribute('role', 'switch');
    button.setAttribute('aria-checked', String(grouped));
    button.innerHTML = `<span class="${TRACK_CLASS}"></span><span>Group by enabled</span>`;
    button.addEventListener('click', () => {
      grouped = !grouped;
      writeGrouped(grouped);
      button.setAttribute('aria-checked', String(grouped));
      schedule();
    });
    return button;
  }

  // 开关放在工具栏的 Model actions 按钮前面；框架重新生成工具栏后会再放一次
  function ensureToggle() {
    const anchor = document.querySelector('[aria-label="Model actions"]');
    if (!anchor || anchor.previousElementSibling?.classList.contains(TOGGLE_CLASS)) return;
    anchor.before(createToggle());
  }

  // ---------- 调度 ----------

  // 框架一次渲染会产生大量 DOM 变化，合并到同一帧里只整理一次
  let scheduled = false;

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      reconcileAll();
      // 整理时移动的行会产生新的变化记录，它们不需要再处理；本帧之前框架的变化已被上面的整理读到，同样可以丢弃。
      // 不丢弃的话，每次整理都会再排一轮整理。
      observer.takeRecords();
    });
  }

  // 框架增删行（例如搜索）或开关状态变化时都会触发。
  // 控制台是单页应用，切换页面时表格可能会重新生成，表格再次出现时同样会在这里处理。
  const observer = new MutationObserver(schedule);

  // ---------- 启动 ----------

  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.append(style);
  }

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['aria-checked', 'data-checked'],
  });
  reconcileAll();
})();
