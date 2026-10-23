// ==UserScript==
// @name         AI Chat Quick Delete
// @name:en      AI Chat Quick Delete
// @namespace    https://github.com/xianghongai
// @version      1.0.1
// @description  Add a trash icon to each conversation in the sidebar of ChatGPT, Claude, Gemini, DeepSeek, Qwen and Grok to delete it in one click, with the confirmation dialog handled for you (can be switched off).
// @description:en  Add a trash icon to each conversation in the sidebar of ChatGPT, Claude, Gemini, DeepSeek, Qwen and Grok to delete it in one click, with the confirmation dialog handled for you (can be switched off).
// @description:zh-CN  在 ChatGPT、Claude、Gemini、DeepSeek、通义千问、Grok 的左侧对话列表中，给每个对话添加删除图标，一键删除，并自动点掉确认框（可在脚本菜单中关闭）。
// @description:zh-TW  在 ChatGPT、Claude、Gemini、DeepSeek、通義千問、Grok 的左側對話列表中，為每個對話加上刪除圖示，一鍵刪除，並自動點掉確認框（可在腳本選單中關閉）。
// @author       xianghongai <xianghongai@gmail.com>
// @license      MIT
// @homepageURL  https://github.com/xianghongai/tampermonkey-userscripts
// @supportURL   https://github.com/xianghongai/tampermonkey-userscripts/issues
// @icon         https://xinlu.ink/favicon.ico
// @match        https://chatgpt.com/*
// @match        https://claude.ai/*
// @match        https://gemini.google.com/*
// @match        https://chat.deepseek.com/*
// @match        https://chat.qwen.ai/*
// @match        https://grok.com/*
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @noframes
// ==/UserScript==

console.log(GM_info.script.name);

(() => {
  'use strict';

  const PREFIX = 'user-script-ai-chat-quick-delete';
  const BUSY_ATTR = `data-${PREFIX}-busy`;

  const TEXT = navigator.language.startsWith('zh')
    ? { delete: '删除对话', autoOn: '自动确认删除：开', autoOff: '自动确认删除：关' }
    : { delete: 'Delete chat', autoOn: 'Auto-confirm deletion: on', autoOff: 'Auto-confirm deletion: off' };

  // ---------- 站点规则 ----------
  // 不调用站点接口，而是模拟人的操作：点列表项自带的「更多」按钮，再点菜单里的删除项，最后点确认框的确认按钮。
  // 删除项与确认按钮不按文字匹配（文字随界面语言变化），用 testid、危险色 class 或按钮位置识别。
  //   items        返回侧边栏里每个对话的列表项元素；删除图标挂在列表项里
  //   menuButton   列表项自带的「更多」按钮，用来定位图标，也是模拟点击的起点
  //   pointerOpen  菜单只响应 pointerdown 时为 true（Radix），点击前先补发一次
  //   pointerOnly  只发 pointerdown、不再点击：按钮嵌在对话链接里，点击会跳转到该对话
  //   anchor       可选，删除图标停靠在它左边；省略时停靠在 menuButton 左边
  //   deleteItem   菜单打开后的删除项
  //   confirm      确认框里的确认按钮；站点点了删除项就直接删除、没有确认框时省略
  const lastButton = (dialog) => [...(document.querySelector(dialog)?.querySelectorAll('button') ?? [])].at(-1);

  const SITES = {
    'chatgpt.com': {
      items: () => closestAll('a[href^="/c/"][data-interactive-row-link]', '[data-sidebar-cycle-item]'),
      menuButton: (item) => item.querySelector('button[aria-haspopup="menu"]'),
      pointerOpen: true,
      deleteItem: () => document.querySelector('[role="menu"] [role="menuitem"][class*="text-danger"]'),
      confirm: () => document.querySelector('[role="dialog"] button[type="submit"]'),
    },
    'claude.ai': {
      items: () => closestAll('a[href^="/chat/"][data-row-main-button]', '[data-row]'),
      menuButton: (item) => item.querySelector('button'),
      deleteItem: () => document.querySelector('[data-testid="delete-chat-trigger"]'),
      confirm: () => lastButton('[role="alertdialog"]'),
    },
    'gemini.google.com': {
      items: () => [...document.querySelectorAll('gem-nav-list-item[data-test-id="conversation"]')],
      menuButton: (item) => item.querySelector('button'),
      deleteItem: () => document.querySelector('[data-test-id="delete-button"]'),
      confirm: () => lastButton('mat-dialog-container'),
    },
    'chat.deepseek.com': {
      items: () => [...document.querySelectorAll('a[href^="/a/chat/s/"]')],
      menuButton: (item) => item.querySelector('[role="button"]'),
      deleteItem: () => document.querySelector('.ds-dropdown-menu-option--error'),
      confirm: () => document.querySelector('.ds-modal-content__footer .ds-button--error'),
    },
    'chat.qwen.ai': {
      items: () => [...document.querySelectorAll('.chat-item-drag')],
      menuButton: (item) => item.querySelector('button[aria-label="Chat Menu"]'),
      deleteItem: () => document.querySelector('.chat-menu-item-error'),
      confirm: () => document.querySelector('.qwen-chat-v2-modal-root .qwen-chat-v2-btn-danger'),
    },
    // 菜单按钮在对话链接里；悬停时「置顶」与「更多」两个按钮并排出现，图标停靠在这一组左边。
    // 点了删除项就直接删除，没有确认框，所以「自动确认」开关对它不起作用
    'grok.com': {
      items: () => closestAll('a[href^="/c/"][data-sidebar="menu-button"]', 'li[data-sidebar="menu-item"]'),
      menuButton: (item) => item.querySelector('button[aria-haspopup="menu"]'),
      anchor: (item) => item.querySelector('a[data-sidebar="menu-button"] > div'),
      pointerOpen: true,
      pointerOnly: true,
      deleteItem: () => document.querySelector('[role="menu"] [role="menuitem"].text-fg-danger'),
    },
  };

  const site = SITES[location.hostname];
  if (!site) return;

  /** 找到每个 selector 命中元素的 container 祖先，去掉没有祖先的。 */
  function closestAll(selector, container) {
    return [...document.querySelectorAll(selector)].map((el) => el.closest(container)).filter(Boolean);
  }

  // ---------- 设置 ----------

  let autoConfirm = GM_getValue('autoConfirm', true);

  const registerToggle = () => GM_registerMenuCommand(
    autoConfirm ? TEXT.autoOn : TEXT.autoOff,
    () => {
      autoConfirm = !autoConfirm;
      GM_setValue('autoConfirm', autoConfirm);
      registerToggle();
    },
    { id: 'auto-confirm', autoClose: false },
  );
  registerToggle();

  // ---------- 模拟删除 ----------

  const waitFor = (find, timeout = 3000) => new Promise((resolve) => {
    const start = performance.now();
    const tick = () => {
      const el = find();
      if (el) return resolve(el);
      if (performance.now() - start > timeout) return resolve(null);
      setTimeout(tick, 50);
    };
    tick();
  });

  let busy = false;

  async function remove(item) {
    const opener = site.menuButton(item);
    if (busy || !opener) return;
    busy = true;
    // 模拟期间隐藏弹出的菜单与确认框，避免界面一闪而过；自动确认关闭时确认框要留给使用者
    document.documentElement.setAttribute(BUSY_ATTR, autoConfirm ? 'all' : 'menu');
    try {
      if (site.pointerOpen) {
        opener.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse', isPrimary: true }));
      }
      if (!site.pointerOnly) opener.click();
      const deleteItem = await waitFor(site.deleteItem);
      if (!deleteItem) {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        console.warn(`[${GM_info.script.name}] delete menu item not found`);
        return;
      }
      deleteItem.click();
      if (!autoConfirm || !site.confirm) return;
      const confirm = await waitFor(site.confirm);
      if (confirm) confirm.click();
      else console.warn(`[${GM_info.script.name}] confirm button not found`);
    } finally {
      document.documentElement.removeAttribute(BUSY_ATTR);
      busy = false;
    }
  }

  // ---------- 删除图标 ----------

  GM_addStyle(`
    .${PREFIX}-button {
      position: absolute; top: 50%; right: 6px; z-index: 5; transform: translateY(-50%);
      display: none; align-items: center; justify-content: center; width: 24px; height: 24px; padding: 0;
      border: 0; border-radius: 6px; color: inherit; cursor: pointer;
    }
    .${PREFIX}-button:hover { color: #e5484d; }
    .${PREFIX}-button:hover svg { opacity: 1; }
    .${PREFIX}-button svg { width: 16px; height: 16px; opacity: .6; pointer-events: none; }
    *:hover > .${PREFIX}-button, *:focus-within > .${PREFIX}-button { display: flex; }
    html[${BUSY_ATTR}] :is([role="menu"], .cdk-overlay-backdrop) { opacity: 0 !important; transition: none !important; }
    html[${BUSY_ATTR}="all"] :is([role="alertdialog"], [role="dialog"], mat-dialog-container, .ds-modal-wrapper, .qwen-chat-v2-modal-root) {
      opacity: 0 !important; transition: none !important;
    }
  `);

  // Lucide trash-2
  const createIcon = () => {
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    for (const [name, value] of Object.entries({
      viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
    })) svg.setAttribute(name, value);
    const shapes = [
      ['path', { d: 'M10 11v6' }],
      ['path', { d: 'M14 11v6' }],
      ['path', { d: 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6' }],
      ['path', { d: 'M3 6h18' }],
      ['path', { d: 'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2' }],
    ];
    for (const [tag, attrs] of shapes) {
      const el = document.createElementNS(NS, tag);
      for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
      svg.append(el);
    }
    return svg;
  };

  // 把列表项连同祖先的背景色叠成按钮的底色，得到肉眼看到的不透明底色。
  // 悬停底色常是半透明的，只取单层颜色盖不住下面的文字。
  // 每层颜色写成一层纯色渐变，由浏览器自己合成：不必解析 color-mix、oklab 等新写法，
  // 也不读画布像素，Firefox 的防指纹保护会把画布读回的像素随机化。
  function paintBackground(button, item) {
    const layers = [];
    for (let el = item; el; el = el.parentElement) {
      const color = getComputedStyle(el).backgroundColor;
      if (color !== 'rgba(0, 0, 0, 0)' && color !== 'transparent') layers.push(`linear-gradient(${color}, ${color})`);
    }
    // 靠前的图层画在上面，正好是由内向外；祖先都没有底色时，按页面的明暗取黑或白
    button.style.backgroundImage = layers.join(', ') || 'none';
    button.style.backgroundColor = getComputedStyle(document.documentElement).colorScheme.includes('dark') ? '#000' : '#fff';
  }

  function attach(item) {
    if (item.querySelector(`:scope > .${PREFIX}-button`)) return;
    if (getComputedStyle(item).position === 'static') item.style.position = 'relative';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = `${PREFIX}-button`;
    button.title = TEXT.delete;
    button.setAttribute('aria-label', TEXT.delete);
    button.append(createIcon());

    // 避开列表项自带的「更多」按钮，停靠在它左边
    const place = () => {
      const nativeRect = (site.anchor?.(item) ?? site.menuButton(item))?.getBoundingClientRect();
      const itemRect = item.getBoundingClientRect();
      button.style.right = `${nativeRect?.width ? itemRect.right - nativeRect.left + 2 : 6}px`;
      // 垫一层与列表项相同的底色，长标题才不会和图标叠在一起
      paintBackground(button, item);
    };
    item.addEventListener('pointerenter', () => {
      place();
      requestAnimationFrame(place);
      // 悬停底色常带过渡动画，等它走完再取一次
      setTimeout(place, 300);
    });

    // 列表项可能是链接或可拖拽，图标上的操作不能漏给它们
    for (const type of ['pointerdown', 'mousedown', 'mouseup', 'dblclick']) {
      button.addEventListener(type, (event) => event.stopPropagation());
    }
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      remove(item);
    });
    item.append(button);
  }

  let scanQueued = false;
  const scan = () => {
    scanQueued = false;
    site.items().forEach(attach);
  };
  new MutationObserver(() => {
    if (scanQueued) return;
    scanQueued = true;
    requestAnimationFrame(scan);
  }).observe(document.documentElement, { childList: true, subtree: true });
  scan();
})();
