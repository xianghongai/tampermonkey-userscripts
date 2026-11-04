// ==UserScript==
// @name         AI Chat Tweaks
// @name:en      AI Chat Tweaks
// @name:zh-CN   AI Chat Tweaks
// @namespace    https://github.com/xianghongai
// @version      1.0.2
// @description  Make the conversation area and the input box the same width (50vw by default) and your own messages the same bubble style on ChatGPT, Claude, Gemini, DeepSeek, Qwen and Grok, so switching between them does not shift your eyes. The width can be changed from the script menu.
// @description:en  Make the conversation area and the input box the same width (50vw by default) and your own messages the same bubble style on ChatGPT, Claude, Gemini, DeepSeek, Qwen and Grok, so switching between them does not shift your eyes. The width can be changed from the script menu.
// @description:zh-CN  让 ChatGPT、Claude、Gemini、DeepSeek、通义千问、Grok 的对话区与输入框统一为同一宽度（默认 50vw），自己发出的消息统一为同一气泡样式，在几个 AI 之间切换时视线不用来回调整；宽度可在脚本菜单中修改。
// @description:zh-TW  讓 ChatGPT、Claude、Gemini、DeepSeek、通義千問、Grok 的對話區與輸入框統一為同一寬度（預設 50vw），自己發出的訊息統一為同一氣泡樣式，在幾個 AI 之間切換時視線不用來回調整；寬度可在腳本選單中修改。
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
// @run-at       document-start
// @noframes
// ==/UserScript==

console.log(GM_info.script.name);

(() => {
  'use strict';

  const PREFIX = 'user-script-ai-chat-tweaks';
  const DEFAULT_WIDTH = '50vw';
  // 宽度写成 CSS 变量，下面各站点的规则都引用它，菜单里改了宽度只需要改这一个变量
  const W = `var(--${PREFIX})`;

  const TEXT = navigator.language.startsWith('zh')
    ? { menu: (width) => `设置对话区宽度（当前 ${width}）`, preset: (name, on) => `${on ? '✓ ' : ''}消息气泡：${name}`, prompt: '对话区与输入框的宽度，写成 CSS 长度，例如 50vw、900px；留空恢复默认。', invalid: '不是有效的 CSS 长度，宽度没有改动。' }
    : { menu: (width) => `Set conversation width (now ${width})`, preset: (name, on) => `${on ? '✓ ' : ''}Message bubble: ${name}`, prompt: 'Width of the conversation area and input box, as a CSS length such as 50vw or 900px. Leave empty to restore the default.', invalid: 'Not a valid CSS length. The width was not changed.' };

  // ---------- 用户消息气泡 ----------
  // 只统一自己发出的消息，AI 的回复保持各站点原样。
  // 扁平风格：纯色底 + 一层细描边 + 一层柔和投影，圆角 16px，没有渐变也没有内阴影。
  // 亮色边：描边用白色，外侧再套一圈同色系的细暗边和柔和扩散，白边在浅色和深色界面上四边都看得清。
  // 底色取浅色系，跟着站点自己的深浅色界面走：浅色界面浅色底深字，深色界面深色底浅字。
  // 每组预设分 light / dark 两档，切换预设时底色、文字、描边与投影一起换，圆角不变。
  // 配色预设写在菜单里；当前这档的底色、文字、描边与投影写进 :root 变量，切换时即时生效。
  const BUBBLE_PRESETS = {
    ash: {
      zh: '浅灰', en: 'Light Gray',
      light: { background: '#f0f0f2', color: '#1f1f21', border: '1px solid #ffffff', shadow: '0 0 0 1px rgba(31, 31, 33, .065), 0 0 6px rgba(31, 31, 33, .07)' },
      dark: { background: '#2f2f34', color: '#f2f2f5', border: '1px solid rgba(255, 255, 255, .26)', shadow: '0 0 0 1px rgba(0, 0, 0, .28), 0 0 8px rgba(0, 0, 0, .27)' },
    },
    blush: {
      zh: '樱粉', en: 'Blush',
      light: { background: '#f8dfe7', color: '#3d1421', border: '1px solid #ffffff', shadow: '0 0 0 1px rgba(61, 20, 33, .065), 0 0 6px rgba(61, 20, 33, .07)' },
      dark: { background: '#4a2a35', color: '#fbe9ef', border: '1px solid rgba(255, 255, 255, .26)', shadow: '0 0 0 1px rgba(38, 12, 24, .3), 0 0 8px rgba(38, 12, 24, .27)' },
    },
    lavender: {
      zh: '薰衣草', en: 'Lavender',
      light: { background: '#e4e0f5', color: '#262140', border: '1px solid #ffffff', shadow: '0 0 0 1px rgba(38, 33, 64, .065), 0 0 6px rgba(38, 33, 64, .07)' },
      dark: { background: '#2f2a45', color: '#ece9f8', border: '1px solid rgba(255, 255, 255, .26)', shadow: '0 0 0 1px rgba(20, 16, 38, .3), 0 0 8px rgba(20, 16, 38, .27)' },
    },
    amber: {
      zh: '琥珀', en: 'Amber',
      light: { background: '#f6e3c4', color: '#3a2508', border: '1px solid #ffffff', shadow: '0 0 0 1px rgba(58, 37, 8, .065), 0 0 6px rgba(58, 37, 8, .07)' },
      dark: { background: '#4a3816', color: '#fbeed8', border: '1px solid rgba(255, 255, 255, .26)', shadow: '0 0 0 1px rgba(45, 28, 6, .3), 0 0 8px rgba(45, 28, 6, .27)' },
    },
    lime: {
      zh: '青柠', en: 'Lime',
      light: { background: '#e3f1c9', color: '#22300f', border: '1px solid #ffffff', shadow: '0 0 0 1px rgba(34, 48, 15, .065), 0 0 6px rgba(34, 48, 15, .07)' },
      dark: { background: '#3a4a22', color: '#f2f8e2', border: '1px solid rgba(255, 255, 255, .26)', shadow: '0 0 0 1px rgba(28, 38, 12, .3), 0 0 8px rgba(28, 38, 12, .27)' },
    },
  };
  const DEFAULT_PRESET = 'ash';
  const USER_BUBBLE = {
    background: `var(--${PREFIX}-bubble)`,
    color: `var(--${PREFIX}-bubble-color)`,
    border: `var(--${PREFIX}-bubble-border)`,
    'box-shadow': `var(--${PREFIX}-bubble-shadow)`,
    'border-radius': '16px',
    padding: '10px 16px',
    // 各站点的气泡有的按内容收窄、有的铺满整行，统一成对话区宽度的 68%、靠右，几个 AI 里一样宽
    width: `calc(${W} * .68)`,
    'max-width': '100%',
    'box-sizing': 'border-box',
    'margin-left': 'auto',
  };

  // ---------- 站点规则 ----------
  // 做法：用站点官方的选择器找到元素，给它们打上我们自己的类名（PREFIX-角色），样式只写在我们的类上。
  // 这样在开发者工具里一眼能看出哪些元素被本脚本改过；站点改版时，只需要更新对应角色的官方选择器。
  // 每个角色：selector 是站点官方的选择器，style 是要覆盖的样式（自动加 !important）。
  const SITES = {
    // 宽度由 --thread-content-max-width 决定，变量在多个元素上各自声明，必须逐个覆盖
    'chatgpt.com': {
      vars: {
        selector: ':root, [class*="--thread-content-max-width"], [class*="--thread-content-responsive-max-width"]',
        style: { '--thread-content-max-width': W, '--thread-content-responsive-max-width': W },
      },
      userBubble: { selector: '[data-user-message-bubble="true"]', style: USER_BUBBLE },
    },
    // 对话列与输入框共用 --transcript-width
    'claude.ai': {
      vars: {
        selector: ':root, [data-testid="chat-column"]',
        style: { '--transcript-width': W },
      },
      // 官方没有给气泡单独的标记，用「包着用户消息正文」的那层
      userBubble: { selector: 'div:has(> div > .cds-user-message-body)', style: USER_BUBBLE },
    },
    // 宽度既有变量，也有多处写死的 708px、660px、760px，变量与这些写死的上限一并覆盖
    'gemini.google.com': {
      vars: {
        selector: ':root, .enable-luminous-content-width-update',
        style: {
          '--bard-chat-window-content-width-default': W,
          '--bard-chat-window-max-width-default': `calc(${W} + 16px)`,
        },
      },
      caps: {
        selector: [
          '.enable-extended-and-xl-grid user-query', '.enable-extended-and-xl-grid .response-container-header',
          '.enable-extended-and-xl-grid .response-container-footer', '.enable-extended-and-xl-grid .response-footer',
          '.enable-extended-and-xl-grid message-actions', '.enable-extended-and-xl-grid model-response-disclaimers',
          '.enable-extended-and-xl-grid .markdown > *', 'thinking-overlay', '.input-area-container', 'prompt-flow-bar',
          'condensed-tos-disclaimer', 'remy-access-restricted-banner',
        ].join(', '),
        style: { 'max-width': W },
      },
      userBubble: { selector: '.user-query-bubble-with-background', style: USER_BUBBLE },
    },
    // 消息列表左右留白按 (容器宽 - 变量) / 2 计算，列表自带 44px 左右外边距，补回来才是想要的正文宽度
    'chat.deepseek.com': {
      vars: {
        selector: ':root, body',
        style: { '--message-list-max-width': `calc(${W} + 88px)` },
      },
      // 官方类名是哈希，不稳定；用户消息是不含 Markdown 正文的 .ds-message，正文气泡包着 .ds-collapsible-text。
      // 带附件时附件卡片和正文气泡是两个并列的子元素，只取正文气泡：附件卡片自带底色和自己的文字颜色，
      // 一起涂成气泡底色会把卡片里的文字也刷成白色，浅色主题下就是白底白字
      userBubble: { selector: '.ds-message:not(:has(.ds-markdown)) > div:has(> .ds-collapsible-text)', style: USER_BUBBLE },
    },
    // 消息气泡自带 32px 左右内边距；输入框容器两侧有 20px 外边距，扣掉后与气泡等宽
    'chat.qwen.ai': {
      caps: {
        selector: '.qwen-chat-message, .agent-mode-feedback-gate, .chat-detail-skeleton-group',
        style: { 'max-width': W },
      },
      composer: { selector: '.message-input-wrapper', style: { 'max-width': `calc(${W} - 40px)` } },
      userBubble: { selector: '.chat-user-message', style: USER_BUBBLE },
    },
    // 对话列宽度是 --content-max-width，输入框宽度是 --content-breakout-max-width（原本比对话列多出两侧留白），
    // 两个变量都声明在对话区容器上，一起改成统一宽度
    'grok.com': {
      vars: {
        selector: ':root, [class*="--content-max-width"]',
        style: { '--content-max-width': W, '--content-breakout-max-width': W },
      },
      userBubble: { selector: '[data-testid="user-message"]', style: USER_BUBBLE },
    },
  };

  const roles = SITES[location.hostname];
  if (!roles) return;

  // ---------- 深浅色判断 ----------
  // 站点自己的深浅色不一定跟系统设置一致（在浅色系统里手动把 ChatGPT 切成深色很常见），
  // 所以按页面上真正渲染出来的背景色算亮度；页面背景全透明时退回系统的 prefers-color-scheme。
  const pageIsDark = () => {
    for (const el of [document.body, document.documentElement]) {
      if (!el) continue;
      const parts = getComputedStyle(el).backgroundColor.match(/[\d.]+/g);
      if (!parts) continue;
      const [r, g, b, a = 1] = parts.map(Number);
      if (a < .5) continue;
      return (r * .2126 + g * .7152 + b * .0722) / 255 < .5;
    }
    return matchMedia('(prefers-color-scheme: dark)').matches;
  };

  // ---------- 宽度设置 ----------

  let width = GM_getValue('width', DEFAULT_WIDTH);
  let preset = GM_getValue('bubble', DEFAULT_PRESET);
  if (!BUBBLE_PRESETS[preset]) preset = DEFAULT_PRESET;

  const lang = navigator.language.startsWith('zh') ? 'zh' : 'en';
  const rootStyle = document.documentElement.style;
  let dark = pageIsDark();
  // 当前预设取当前界面深浅色对应的那一档
  const spec = () => BUBBLE_PRESETS[preset][dark ? 'dark' : 'light'];

  const applyVars = () => {
    const { background, color, border, shadow } = spec();
    rootStyle.setProperty(`--${PREFIX}`, width);
    rootStyle.setProperty(`--${PREFIX}-bubble`, background);
    rootStyle.setProperty(`--${PREFIX}-bubble-color`, color);
    rootStyle.setProperty(`--${PREFIX}-bubble-border`, border);
    rootStyle.setProperty(`--${PREFIX}-bubble-shadow`, shadow);
  };

  // 站点切换深浅色后重新判断一次，变了就换成另一档配色
  const refreshTheme = () => {
    const next = pageIsDark();
    if (next === dark) return;
    dark = next;
    applyVars();
  };

  const registerMenus = () => {
    GM_registerMenuCommand(
      TEXT.menu(width),
      () => {
        const input = prompt(TEXT.prompt, width);
        if (input === null) return;
        const next = input.trim() || DEFAULT_WIDTH;
        if (!CSS.supports('width', next)) {
          alert(TEXT.invalid);
          return;
        }
        width = next;
        GM_setValue('width', width);
        applyVars();
        registerMenus();
      },
      { id: 'width', autoClose: true },
    );
    for (const [key, { [lang]: name }] of Object.entries(BUBBLE_PRESETS)) {
      GM_registerMenuCommand(
        TEXT.preset(name, key === preset),
        () => {
          preset = key;
          GM_setValue('bubble', preset);
          applyVars();
          registerMenus();
        },
        { id: `bubble-${key}`, autoClose: false },
      );
    }
  };

  // 变量写在 :root 的行内样式上，页面脚本替换 <html> 属性时也要补回来
  applyVars();
  new MutationObserver(() => {
    const { background, color, border, shadow } = spec();
    if (rootStyle.getPropertyValue(`--${PREFIX}`) !== width
      || rootStyle.getPropertyValue(`--${PREFIX}-bubble`) !== background
      || rootStyle.getPropertyValue(`--${PREFIX}-bubble-color`) !== color
      || rootStyle.getPropertyValue(`--${PREFIX}-bubble-border`) !== border
      || rootStyle.getPropertyValue(`--${PREFIX}-bubble-shadow`) !== shadow) applyVars();
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });

  // 站点切换深浅色时，<html> 或 <body> 上的 class / data-theme / style 会变，变了就重新判断
  const themeObserver = new MutationObserver(() => refreshTheme());
  const watched = new WeakSet();
  const watchTheme = (el) => {
    if (!el || watched.has(el)) return;
    watched.add(el);
    themeObserver.observe(el, { attributes: true, attributeFilter: ['class', 'style', 'data-theme'] });
  };
  watchTheme(document.documentElement);
  // body 在文档开始时还不存在，出来之后才能读到它真正的背景色
  const onReady = () => {
    watchTheme(document.body);
    refreshTheme();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', onReady);
  else onReady();
  // 跟着系统走的站点，切系统深浅色时也要跟着换
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', refreshTheme);

  // ---------- 打标记与样式 ----------

  const className = (role) => `${PREFIX}-${role}`;

  GM_addStyle(Object.entries(roles).map(([role, { style }]) => {
    const declarations = Object.entries(style).map(([name, value]) => `${name}: ${value} !important;`).join(' ');
    // 设了文字颜色的角色，里面的文字也跟着变，否则站点写在内层元素上的深色文字会压在深色底上
    const inherit = 'color' in style ? `\n.${className(role)} * { color: inherit !important; }` : '';
    return `.${className(role)} { ${declarations} }${inherit}`;
  }).join('\n'));

  let markQueued = false;
  const mark = () => {
    markQueued = false;
    for (const [role, { selector }] of Object.entries(roles)) {
      for (const el of document.querySelectorAll(`:is(${selector}):not(.${className(role)})`)) {
        el.classList.add(className(role));
      }
    }
  };
  // 页面是单页应用，对话与输入框随时会重新渲染，每次节点变动后补打标记
  new MutationObserver(() => {
    if (markQueued) return;
    markQueued = true;
    requestAnimationFrame(mark);
  }).observe(document.documentElement, { childList: true, subtree: true });
  mark();
  registerMenus();
})();
