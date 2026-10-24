// ==UserScript==
// @name         AI Chat Tweaks
// @name:en      AI Chat Tweaks
// @name:zh-CN   AI Chat Tweaks
// @namespace    https://github.com/xianghongai
// @version      1.0.0
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
  // 底色是单色渐变：左上起点是主色掺 12% 白，与右下的主色只差一点，渐变很轻；
  // 配白色文字和同色的柔和投影；预设五组，在脚本菜单里选。
  // 当前选中的渐变与投影写在 :root 的变量里，切换时即时生效。
  const BUBBLE_PRESETS = {
    violet: { zh: '紫罗兰', en: 'Violet', gradient: 'linear-gradient(135deg, #9970f7, #8b5cf6)', shadow: 'rgba(139, 92, 246, .3)' },
    rose: { zh: '玫红', en: 'Rose', gradient: 'linear-gradient(135deg, #f55671, #f43f5e)', shadow: 'rgba(244, 63, 94, .3)' },
    azure: { zh: '湛蓝', en: 'Azure', gradient: 'linear-gradient(135deg, #5391f7, #3b82f6)', shadow: 'rgba(59, 130, 246, .3)' },
    amber: { zh: '橙黄', en: 'Amber', gradient: 'linear-gradient(135deg, #fa8432, #f97316)', shadow: 'rgba(249, 115, 22, .3)' },
    teal: { zh: '青绿', en: 'Teal', gradient: 'linear-gradient(135deg, #2dc190, #10b981)', shadow: 'rgba(16, 185, 129, .3)' },
  };
  const DEFAULT_PRESET = 'violet';
  // 叠在渐变上的噪点纹理，五组预设共用：SVG feTurbulence 生成白色颗粒，160px 一块无缝平铺。
  // baseFrequency 控制颗粒粗细（越大越细），feColorMatrix 最后一行的 NOISE_OPACITY 控制浓淡。
  const NOISE_OPACITY = 0.3;
  const NOISE = `url("data:image/svg+xml,${encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'>"
    + "<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.6' numOctaves='2' stitchTiles='stitch'/>"
    + `<feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 ${NOISE_OPACITY} 0'/></filter>`
    + "<rect width='100%' height='100%' filter='url(#n)'/></svg>",
  )}")`;
  const USER_BUBBLE = {
    background: `${NOISE}, var(--${PREFIX}-bubble)`,
    color: '#fff',
    'box-shadow': `0 4px 14px var(--${PREFIX}-bubble-shadow)`,
    'border-radius': '18px',
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
      // 官方类名是哈希，不稳定；用户消息是不含 Markdown 正文的 .ds-message，气泡是它的第一个子元素
      userBubble: { selector: '.ds-message:not(:has(.ds-markdown)) > div:first-child', style: USER_BUBBLE },
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

  // ---------- 宽度设置 ----------

  let width = GM_getValue('width', DEFAULT_WIDTH);
  let preset = GM_getValue('bubble', DEFAULT_PRESET);
  if (!BUBBLE_PRESETS[preset]) preset = DEFAULT_PRESET;

  const lang = navigator.language.startsWith('zh') ? 'zh' : 'en';
  const rootStyle = document.documentElement.style;
  const applyVars = () => {
    rootStyle.setProperty(`--${PREFIX}`, width);
    rootStyle.setProperty(`--${PREFIX}-bubble`, BUBBLE_PRESETS[preset].gradient);
    rootStyle.setProperty(`--${PREFIX}-bubble-shadow`, BUBBLE_PRESETS[preset].shadow);
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
    if (rootStyle.getPropertyValue(`--${PREFIX}`) !== width
      || rootStyle.getPropertyValue(`--${PREFIX}-bubble`) !== BUBBLE_PRESETS[preset].gradient
      || rootStyle.getPropertyValue(`--${PREFIX}-bubble-shadow`) !== BUBBLE_PRESETS[preset].shadow) applyVars();
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });

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
