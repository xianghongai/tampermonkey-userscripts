// ==UserScript==
// @name         OpenCode: Split Models
// @name:en      OpenCode: Split Models
// @namespace    https://github.com/xianghongai
// @version      1.0.0
// @description  Split the Models page of the OpenCode console into two lists: enabled models on top and disabled models below. Toggling a model moves it to the matching list.
// @description:en  Split the Models page of the OpenCode console into two lists: enabled models on top and disabled models below. Toggling a model moves it to the matching list.
// @description:zh-CN  把 OpenCode 控制台的 Models 页面分成两个列表：已启用的模型在上，未启用的在下；开关模型后自动移到对应的列表。
// @description:zh-TW  把 OpenCode 控制台的 Models 頁面分成兩個列表：已啟用的模型在上，未啟用的在下；切換模型開關後自動移到對應的列表。
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
  const STYLE_ID = `${PREFIX}-style`;

  // 两组的标题，顺序即页面上的显示顺序
  const GROUPS = [
    { kind: 'enabled', label: 'Enabled models' },
    { kind: 'disabled', label: 'Disabled models' },
  ];

  // 组内排序：不区分大小写，数字按数值比较，与页面原有的字母顺序一致
  const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

  const CSS = `
    .${GROUP_CLASS} > td {
      padding: 16px 12px 8px;
      font-size: 0.75rem;
      font-weight: 600;
      opacity: 0.6;
    }
  `;

  // ---------- 查找与读取 ----------

  // 模型表的表头第一列是 Model，最后一列是 Enabled，页面上的其他表格不会命中。
  // 站点改版、表头文字变了时，这里要跟着改。
  function findModelTables() {
    return [...document.querySelectorAll('table')].filter((table) => {
      const heads = [...(table.tHead?.rows[0]?.cells ?? [])].map((cell) => cell.textContent.trim());
      return heads[0] === 'Model' && heads.at(-1) === 'Enabled';
    });
  }

  // 模型行的最后一列是开关，分组行没有开关，借此区分两者
  function switchOf(row) {
    return row.cells[row.cells.length - 1]?.querySelector('input[role="switch"]') ?? null;
  }

  function isEnabled(toggle) {
    return toggle.getAttribute('aria-checked') === 'true';
  }

  // 模型名称是第一列里的第一个 span，其后的标签与 ID 不参与排序
  function nameOf(row) {
    return row.cells[0].querySelector('span')?.textContent.trim() ?? '';
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

  // 分组行与模型行放在同一个 tbody 里，只在这个 tbody 内移动，不把行搬到别的父元素下。
  // 框架按列表增删行，行若被搬到别处，框架在原 tbody 里的插入和删除就会出错。
  function reconcile(table) {
    const tbody = table.tBodies[0];
    if (!tbody) return;
    const colspan = table.tHead.rows[0].cells.length;

    // 每组只保留一个标题，多出来的删掉
    const titles = new Map();
    for (const tr of tbody.querySelectorAll(`:scope > .${GROUP_CLASS}`)) {
      const kind = tr.getAttribute(GROUP_ATTR);
      if (titles.has(kind)) tr.remove();
      else titles.set(kind, tr);
    }

    // 没有开关的行（例如空状态提示）不参与分组，会被留在最后
    const groups = { enabled: [], disabled: [] };
    for (const row of tbody.rows) {
      const toggle = switchOf(row);
      if (toggle) groups[isEnabled(toggle) ? 'enabled' : 'disabled'].push({ row, name: nameOf(row) });
    }

    // 一个模型都没有时（加载中或搜索无结果）不显示分组标题，保留框架原本的空状态
    if (!groups.enabled.length && !groups.disabled.length) {
      for (const tr of titles.values()) tr.remove();
      return;
    }

    // 标题里的数量每次都更新，文字没变时不写 DOM
    for (const { kind, label } of GROUPS) {
      if (!titles.has(kind)) titles.set(kind, createTitle(kind, colspan));
      const cell = titles.get(kind).cells[0];
      const text = `${label} (${groups[kind].length})`;
      if (cell.textContent !== text) cell.textContent = text;
    }

    // 目标顺序：每组的标题在前，本组的行接在后面
    const sequence = GROUPS.flatMap(({ kind }) => [
      titles.get(kind),
      ...groups[kind].sort((a, b) => collator.compare(a.name, b.name)).map(({ row }) => row),
    ]);

    // 已经在目标位置的节点不再移动，因此整理完成后再次整理不会改动 DOM
    const focused = document.activeElement;
    let ref = tbody.firstElementChild;
    for (const el of sequence) {
      if (el === ref) ref = ref.nextElementSibling;
      else tbody.insertBefore(el, ref);
    }

    // 移动行会让焦点丢失，把焦点放回原来的开关上，并且不滚动页面
    if (focused?.isConnected && focused !== document.body && focused !== document.activeElement) {
      focused.focus({ preventScroll: true });
    }
  }

  function reconcileAll() {
    for (const table of findModelTables()) reconcile(table);
  }

  // ---------- 启动 ----------

  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.append(style);
  }

  // 框架增删行（例如搜索）或开关状态变化时都会触发。
  // 控制台是单页应用，切换页面时表格可能会重新生成，表格再次出现时同样会在这里处理。
  new MutationObserver(reconcileAll).observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['aria-checked', 'data-checked'],
  });
  reconcileAll();
})();
