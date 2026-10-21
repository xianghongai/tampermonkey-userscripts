// ==UserScript==
// @name         GitHub & Gist: Mask Secrets
// @namespace    https://github.com/xianghongai
// @version      1.0.1
// @description  Keeps secrets from leaking when you share your screen in an online meeting or select and copy code by hand: on every GitHub repo and gist (or only the accounts you choose), values of secret-looking keys (TOKEN, KEY, SECRET, PASSWORD, CREDENTIAL…) are shown and copied as first4***last4. Raw links, copy buttons and clone still return the real value.
// @description:zh-CN  防止在线会议共享屏幕或用鼠标选中复制代码时不小心泄露凭据：在所有 GitHub 仓库与 Gist 上（也可只限指定账号），敏感键（TOKEN、KEY、SECRET、PASSWORD、CREDENTIAL 等）的值在显示和选中复制时都遮盖为「前4位***后4位」；Raw 链接、复制按钮与克隆拿到的仍是真值。
// @description:zh-TW  防止線上會議分享螢幕或用滑鼠選取複製程式碼時不小心洩漏憑證：在所有 GitHub 儲存庫與 Gist 上（也可只限指定帳號），敏感鍵（TOKEN、KEY、SECRET、PASSWORD、CREDENTIAL 等）的值在顯示和選取複製時都遮蓋為「前4位***後4位」；Raw 連結、複製按鈕與 clone 取得的仍是真值。
// @author       xianghongai <xianghongai@gmail.com>
// @license      MIT
// @homepageURL  https://github.com/xianghongai/tampermonkey-userscripts
// @supportURL   https://github.com/xianghongai/tampermonkey-userscripts/issues
// @icon         https://github.githubassets.com/favicons/favicon.svg
// @match        https://github.com/*
// @match        https://gist.github.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @run-at       document-start
// ==/UserScript==

console.log(GM_info.script.name);

// 用途：在线会议共享屏幕、录屏或截图时，凭据不以明文出现在画面上；
// 手动用鼠标选中代码复制（比如贴进会议聊天）时，剪贴板里也只有遮盖后的值。
// 遮盖只作用于页面显示与选中复制：真值仍在页面源码、网络请求、Raw 链接、复制按钮和隐藏的编辑表单里。
// 它防的是不小心，不是访问权限；凭据一旦明文暴露过，补救只有轮换。
(() => {
  'use strict';

  // ---------- 生效账号 ----------
  // 默认对所有仓库与 gist 生效：漏遮是泄露，误遮只是观感问题，未配置时不能有空窗。
  // 菜单里填了账号，就只对这些账号下的仓库与 gist 生效；留空（或填 *）恢复全部生效。
  // @match 放宽到整站：GitHub 是单页应用，从别处软导航进来时脚本不会重新注入，
  // 只匹配 /<owner>/* 会让"先打开首页再点进仓库"这条路径完全不遮。
  const OWNERS_KEY = 'owners';
  const ALL = '*';

  const normalize = (name) => name.trim().toLowerCase();
  let owners = GM_getValue(OWNERS_KEY, []).map(normalize);

  GM_registerMenuCommand('Set accounts to mask', () => {
    const input = prompt(
      [
        'By default, secrets are masked on every GitHub repo and gist.',
        'To mask only some accounts or organizations, enter their names separated by commas or spaces.',
        "Other accounts' pages are then left as is: code shows right away and nothing is masked by mistake.",
        'Leave empty to mask everywhere again.',
      ].join('\n'),
      owners.join(', '),
    );
    if (input === null) return;
    owners = [...new Set(input.split(/[\s,]+/).map(normalize).filter(Boolean))];
    GM_setValue(OWNERS_KEY, owners);
    // 仍在范围内的页面照常遮盖；移出范围的已遮内容要刷新页面才会恢复
    maskAll();
  });

  // 键名分词后任一段命中即视为敏感键，含复数形式；比较时统一转大写
  const SENSITIVE_WORDS = new Set([
    'TOKEN', 'TOKENS',
    'KEY', 'KEYS',
    'SECRET', 'SECRETS',
    'PASSWORD', 'PASSWORDS',
    'PASSWD',
    'CREDENTIAL', 'CREDENTIALS',
  ]);
  // 预筛关键词：单元格文本里一个都没有就不跑正则（passw 同时覆盖 password 与 passwd）。
  // 用不区分大小写的正则，免得为预筛把整段文本 toLowerCase 复制一份
  const PREFILTER_RE = /token|key|secret|passw|credential/i;

  const KEEP_START = 4; // 露出前 N 位
  const KEEP_END = 4; // 露出后 N 位
  const MASK = '***';
  // 低于此长度就整体遮掉：长度 8 时"前4+后4"等于原文，至少要藏住 3 位；
  // 取值同时保证"已遮盖的值再被匹配一次结果也不变"（幂等）
  const MIN_PARTIAL = KEEP_START + KEEP_END + MASK.length;

  const READY_CLASS = 'ghm-ready'; // 加在 <html> 上，用于解除"遮盖前的隐藏"

  // ---------- 代码容器 ----------
  // 每个选择器取"最内层、一行或一块代码"的容器，文本节点在其中拼接后整体匹配：
  //   .blob-code-inner  gist 详情页（td）与修订页（span）、旧版差异视图
  //   .react-file-line  github.com 文件视图（React 渲染，长文件有虚拟滚动）
  //   .diff-text-inner  github.com commit / PR 差异（React 渲染）
  //   .markdown-body pre  README、渲染后的 .md 文件、Issue / PR / Discussion 评论里的代码块
  const CELL_SELECTOR = [
    '.blob-code-inner',
    '.react-file-line',
    '.diff-text-inner',
    '.markdown-body pre',
  ].join(',');

  // 「键名 + 分隔符 + 值」：
  //   键名可带引号（JSON），引号必须成对；前面不能紧贴标识符字符，免得从半截单词起算
  //   分隔符是 : 或 =，排除 ==、:: 这类运算符
  //   值带引号时取到闭合引号为止（允许含空格），不带引号时取到空白、引号或逗号为止；
  //   值里会有 - . _ / +，不能按字符集限定
  // 用 d 标志拿到值在整段文本里的精确区间，只替换值本身，键名与分隔符的配色不受影响。
  const PATTERN =
    /(?<![\w$.-])(["']?)([A-Za-z_$][\w$.-]*)\1[ \t]*[:=](?![=:])[ \t]*(?:"([^"\n]*)"|'([^'\n]*)'|["']?([^\s"',]+))/dg;

  // 分隔符拆段，再在每段内按大小写边界拆：APIKey → API、Key；KEYBOARD 保持一段
  function isSensitiveKey(key) {
    for (const part of key.split(/[_.$-]+/)) {
      for (const word of part.match(/[A-Z]+(?![a-z])|[A-Z]?[a-z]+|\d+/g) ?? []) {
        if (SENSITIVE_WORDS.has(word.toUpperCase())) return true;
      }
    }
    return false;
  }

  function maskValue(value) {
    return value.length >= MIN_PARTIAL
      ? value.slice(0, KEEP_START) + MASK + value.slice(-KEEP_END)
      : MASK;
  }

  // 返回待替换区间 [start, end, replacement]，按出现顺序排列
  function findMasks(text) {
    if (!PREFILTER_RE.test(text)) return [];
    const masks = [];
    for (const match of text.matchAll(PATTERN)) {
      if (!isSensitiveKey(match[2])) continue;
      const group = [3, 4, 5].find((i) => match[i] !== undefined);
      const value = match[group];
      if (!value) continue; // 空值保持原样
      const masked = maskValue(value);
      if (masked === value) continue;
      const [start, end] = match.indices[group];
      masks.push([start, end, masked]);
    }
    return masks;
  }

  // 记录每个容器遮盖后的文本：文本没变就跳过，变了（React 复用节点换内容、虚拟滚动回收行）就重遮。
  // 不用"处理过就打标记"，因为 React 可能在同一个元素里换掉文本，标记会让新文本漏遮。
  const processed = new WeakMap();

  // 语法高亮常把键名、引号和值拆进多个 span。整段拼接后匹配，
  // 再把每个替换区间映射回涉及的文本节点：区间起点所在节点写入遮盖结果，其余节点删掉区间内的字符。
  // 只动值所在的那几个节点，其余文字的配色保持不变。
  function maskCell(cell) {
    const current = cell.textContent;
    if (processed.get(cell) === current) return;
    // 绝大多数代码行不含关键词，先预筛，不必再遍历文本节点
    if (!PREFILTER_RE.test(current)) {
      processed.set(cell, current);
      return;
    }

    const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT);
    const nodes = [];
    let text = '';
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      nodes.push({ node, start: text.length, value: node.nodeValue });
      text += node.nodeValue;
    }

    // 从后往前替换，前面区间的偏移量不受影响
    for (const [start, end, replacement] of findMasks(text).reverse()) {
      let inserted = false;
      for (const item of nodes) {
        const nodeEnd = item.start + item.value.length;
        if (nodeEnd <= start || item.start >= end) continue;
        const from = Math.max(start, item.start) - item.start;
        const to = Math.min(end, nodeEnd) - item.start;
        item.value = item.value.slice(0, from) + (inserted ? '' : replacement) + item.value.slice(to);
        inserted = true;
      }
    }

    for (const item of nodes) {
      if (item.node.nodeValue !== item.value) item.node.nodeValue = item.value;
    }
    processed.set(cell, cell.textContent);
  }

  // 第一段路径就是 owner：github.com/<owner>/<repo>/…、gist.github.com/<owner>/<id>
  function inScope() {
    if (owners.length === 0 || owners.includes(ALL)) return true;
    return owners.includes(normalize(location.pathname.split('/')[1] ?? ''));
  }

  function maskAll() {
    if (!inScope()) return;
    for (const cell of document.querySelectorAll(CELL_SELECTOR)) maskCell(cell);
  }

  // ---------- 样式：遮完之前先把代码藏起来 ----------
  // document-start 注入，早于正文解析；否则服务器直出的明文会先画到屏幕上，遮得再快也白搭。
  // 用 visibility 而不是 display，解除隐藏时不会引起整页重排。
  // 只在首次加载就落在范围内时注入（默认全部生效时总是注入）；
  // 软导航进来的内容由下面的 MutationObserver 在绘制前遮盖。
  if (inScope()) {
    const style = document.createElement('style');
    style.textContent = `
      html:not(.${READY_CLASS}) :is(${CELL_SELECTOR}) {
        visibility: hidden !important;
      }
    `;
    // documentElement 理论上此时一定存在；真拿不到就放弃防闪烁，遮盖本身照常进行
    document.documentElement?.appendChild(style);
  }

  // ---------- 解除隐藏 ----------
  // 必须等整个文档解析完、且遮盖跑过一遍才显示：
  // 解析中途提前显示，后面的行会以明文画出来，等于白遮。
  let revealed = false;
  function finish() {
    try {
      maskAll();
    } finally {
      if (!revealed) {
        revealed = true;
        document.documentElement.classList.add(READY_CLASS);
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', finish, { once: true });
  } else {
    finish();
  }
  // 兜底：解析卡住或上面某步抛错时，代码区不能永久空着
  window.addEventListener('load', finish, { once: true });
  setTimeout(finish, 1500);

  // ---------- 选中复制 ----------
  // gist、差异视图和代码块里，DOM 文本本身已被遮盖，选中复制拿到的就是遮盖后的值。
  // 例外是 github.com 文件视图：鼠标选中的其实是覆盖在代码上的透明只读 textarea，
  // 它的 value 是真值，GitHub 也不拦截复制，这里在 copy 事件里改写剪贴板内容。
  // 只处理只读 textarea：可编辑的输入框是开发者自己在编辑，不该被改写。

  // 返回 text[from, to) 遮盖后的内容。匹配在整段文本上做，选区只框住值的一部分时也能遮住；
  // 选区与某个值部分重叠时，重叠部分整体换成 MASK，不露出任何片段。
  function maskRange(text, from, to) {
    let out = '';
    let pos = from;
    for (const [start, end, replacement] of findMasks(text)) {
      if (end <= from || start >= to) continue;
      out += text.slice(pos, Math.max(start, from));
      out += start >= from && end <= to ? replacement : MASK;
      pos = Math.min(end, to);
    }
    return out + text.slice(pos, to);
  }

  document.addEventListener(
    'copy',
    (event) => {
      const field = event.target;
      if (!(field instanceof HTMLTextAreaElement) || !inScope()) return;
      if (!field.readOnly && field.getAttribute('aria-readonly') !== 'true') return;
      const { value, selectionStart: from, selectionEnd: to } = field;
      if (from === to) return;
      const masked = maskRange(value, from, to);
      if (masked === value.slice(from, to)) return;
      event.clipboardData.setData('text/plain', masked);
      event.preventDefault();
    },
    true,
  );

  // ---------- 动态插入 ----------
  // React 渲染、虚拟滚动、差异展开、软导航都会再插代码或改文本。
  // 只处理变更涉及的单元格，不整页扫描：GitHub 上随时有无关的 DOM 变化（悬停卡片、实时更新、输入），
  // 整页扫描的开销随页面规模线性增长，大差异页面上一次就要几毫秒到几十毫秒。
  // requestAnimationFrame 回调在下一次绘制之前执行，新内容来不及以明文画出来；
  // 同时把一帧内的多次变更合并成一次处理。
  const dirty = new Set();
  let queued = false;

  // 从变更记录里找出受影响的单元格：文本或子节点变化所在的单元格，以及新插入的单元格
  function collect(records) {
    for (const record of records) {
      const { target } = record;
      const element = target.nodeType === Node.ELEMENT_NODE ? target : target.parentElement;
      const cell = element?.closest(CELL_SELECTOR);
      if (cell) dirty.add(cell);
      for (const node of record.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;
        if (node.matches(CELL_SELECTOR)) dirty.add(node);
        for (const inner of node.querySelectorAll(CELL_SELECTOR)) dirty.add(inner);
      }
    }
  }

  function flush() {
    // 先清除排队标记，使本次处理期间新增的脏单元格可以再次排队
    queued = false;

    // 复制脏集合后立即清空：处理中新增的单元格归入下一轮
    const cells = [...dirty];
    dirty.clear();

    // 不在作用范围内（例如页面状态不满足遮盖条件）时直接放弃本轮
    if (!inScope()) return;

    // 单元格可能在排队期间被移出 DOM，处理前确认仍然连接在文档中
    for (const cell of cells) {
      if (cell.isConnected) maskCell(cell);
    }

    // maskCell 通过改写 nodeValue 遮盖文本，只会产生 characterData 记录。
    // 取出观察者尚未投递的记录，丢弃这类自身写入产生的记录，避免为自己的修改再排一帧；
    // 其他类型的记录（如 childList）照常收集
    collect(observer.takeRecords().filter((record) => record.type !== 'characterData'));

    // 收集后若又出现脏单元格，再排下一帧
    schedule();
  }

  function schedule() {
    // 已经排队，或没有待处理内容时不重复排队
    if (queued || dirty.size === 0) return;
    queued = true;
    // 选择 `requestAnimationFrame` (rAF) 的核心原因是：遮盖必须在浏览器绘制之前完成，且每帧最多执行一次。
    requestAnimationFrame(flush);
  }

  // 创建观察者：DOM 发生变化时，浏览器把一批变化记录 (records) 传给回调
  const observer = new MutationObserver((records) => {
    // revealed 为 false 表示页面仍在解析或首次处理阶段，
    // 代码区被样式隐藏，finish() 会整页扫描一遍，这里无需重复处理
    if (!revealed) return;

    // 把本批变化记录收集起来，留待后续统一处理
    collect(records);

    // 请求一次延迟处理，通常内部做合并或节流，避免每次变化都立即执行
    schedule();
  });

  // 开始观察：从 <html> 根节点起，监听整棵 DOM 树
  observer.observe(document.documentElement, {
    childList: true,     // 子节点的增删
    subtree: true,       // 包含所有后代节点，而不只是根节点本身
    characterData: true, // 文本节点内容的变化
  });
})();
