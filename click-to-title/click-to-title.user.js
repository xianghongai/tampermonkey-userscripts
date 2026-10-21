// ==UserScript==
// @name         Click to Title
// @namespace    https://github.com/xianghongai
// @version      1.0.0
// @description  Some single-page apps never update the tab title, so every tab shows only the app name. Click any text while holding the configured keys to make it the tab title, kept per route. For personal use.
// @description:zh-CN  有些单页应用切换页面时不更新标题，所有标签页都只显示应用名；按住设定的按键点击任意文字，即可将其设为标签页标题，每个路由各自记住；自用脚本。
// @description:zh-TW  有些單頁應用切換頁面時不更新標題，所有分頁都只顯示應用名稱；按住設定的按鍵點擊任意文字，即可將其設為分頁標題，每個路由各自記住；自用腳本。
// @author       xianghongai <xianghongai@gmail.com>
// @license      MIT
// @homepageURL  https://github.com/xianghongai/tampermonkey-userscripts
// @supportURL   https://github.com/xianghongai/tampermonkey-userscripts/issues
// @icon         https://xinlu.ink/favicon.ico
// @match        *://*/*
// @grant        none
// @run-at       document-idle
// @noframes
// ==/UserScript==

console.log(GM_info.script.name);

(() => {
  'use strict';

  const IS_MAC = /mac/i.test(navigator.userAgentData?.platform ?? navigator.platform);

  // ---------- 配置 ----------
  // 触发点击需要按住的修饰键，多个用 + 连接；按下的修饰键必须与这里写的完全一致。
  // | 写法  | 按键                                   |
  // | ----- | -------------------------------------- |
  // | Ctrl  | Ctrl（macOS 上也是 Control）           |
  // | Alt   | Alt（macOS 为 Option）                 |
  // | Shift | Shift                                  |
  // | Meta  | macOS 为 ⌘ Command，Windows 为 Win 键  |
  // | Mod   | macOS 为 ⌘ Command，其他系统为 Ctrl    |
  // 预设避开了 Copy it 占用的 Alt 组合。
  const TRIGGER = 'Mod+Shift';
  // 是否在设置的文字后附带原来的应用名
  const WITH_APP_NAME = true;
  const SEPARATOR = ' - ';
  // 标题过长时标签页也显示不全，超出部分截断
  const MAX_LENGTH = 80;

  const MODIFIERS = ['Ctrl', 'Alt', 'Shift', 'Meta'];
  const required = new Set(TRIGGER.split('+').map((part) => part.trim()).map((part) => (part === 'Mod' ? (IS_MAC ? 'Meta' : 'Ctrl') : part)));

  /**
   * 是否为触发点击：左键，按下的修饰键与 TRIGGER 完全一致。
   * @param {MouseEvent} event
   * @returns {boolean}
   */
  function isTrigger(event) {
    const pressed = { Ctrl: event.ctrlKey, Alt: event.altKey, Shift: event.shiftKey, Meta: event.metaKey };
    return event.button === 0 && MODIFIERS.every((name) => pressed[name] === required.has(name));
  }

  // ---------- 标题 ----------
  // 应用自己的标题，即「应用名」；脚本在页面加载完成后运行，此时的标题就是它
  const appTitle = document.title;
  // 每个地址各自的标题，只保存在当前标签页内；地址包含 hash，兼容 hash 路由
  const titles = new Map();

  /** 按当前地址写入标题：设置过的用设置的，没设置过的恢复应用名。 */
  function applyTitle() {
    const title = titles.get(location.href) ?? appTitle;
    if (document.title !== title) document.title = title;
  }

  /**
   * 取元素的文字：合并空白成一行，过长时截断。
   * @param {Element} el
   * @returns {string}
   */
  function textOf(el) {
    const text = (el.innerText ?? el.textContent ?? '').replace(/\s+/g, ' ').trim();
    return text.length > MAX_LENGTH ? `${text.slice(0, MAX_LENGTH - 1)}…` : text;
  }

  // ---------- 点击 ----------
  // 一次点击依次触发 pointerdown → mousedown → pointerup → mouseup → click，页面可能在其中任何一步响应；
  // 整条链都在 window 的捕获阶段拦下，避免同时触发页面的跳转、打开新标签页等行为。
  for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
    window.addEventListener(type, (event) => {
      if (!isTrigger(event)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (type !== 'click') return;
      // composedPath 能穿透 open 的 Shadow DOM，拿到真正被点中的元素
      const [target] = event.composedPath();
      const text = textOf(target instanceof Element ? target : event.target);
      if (!text) return;
      titles.set(location.href, WITH_APP_NAME && appTitle && appTitle !== text ? `${text}${SEPARATOR}${appTitle}` : text);
      applyTitle();
      watchRoutes();
    }, true);
  }

  // ---------- 路由 ----------
  // 单页应用切换路由不一定有事件可听（pushState 不触发任何事件），应用也可能自己改回标题，所以定时检查。
  // 第一次设置标题后才开始，没用过的页面不做任何事。
  let timer = 0;

  /** 开始定时按当前地址应用标题，已开始时不重复。 */
  function watchRoutes() {
    timer ||= setInterval(applyTitle, 500);
  }
})();
