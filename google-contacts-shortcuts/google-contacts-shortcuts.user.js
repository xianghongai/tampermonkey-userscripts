// ==UserScript==
// @name         Google Contacts: Shortcuts
// @name:en      Google Contacts: Shortcuts
// @namespace    https://github.com/xianghongai
// @version      1.0.1
// @description  Keyboard shortcuts for Google Contacts, so opening a contact for editing and saving changes no longer means hunting for buttons with the mouse. For personal use.
// @description:en  Keyboard shortcuts for Google Contacts, so opening a contact for editing and saving changes no longer means hunting for buttons with the mouse. For personal use.
// @description:zh-CN  为 Google 通讯录添加快捷键，进入联系人编辑、保存修改不必再用鼠标找按钮；自用脚本。
// @description:zh-TW  為 Google 通訊錄加入快捷鍵，進入聯絡人編輯、儲存修改不必再用滑鼠找按鈕；自用腳本。
// @author       xianghongai <xianghongai@gmail.com>
// @license      MIT
// @icon         https://www.gstatic.com/images/branding/product/1x/contacts_2022_48dp.png
// @match        https://contacts.google.com/*
// @grant        none
// @run-at       document-idle
// @noframes
// ==/UserScript==

console.log(GM_info.script.name);

(() => {
  'use strict';

  const IS_MAC = /mac/i.test(navigator.userAgentData?.platform ?? navigator.platform);

  // ---------- 按钮 ----------
  // 操作对应的按钮选择器。Google 更新页面后选择器可能失效，在这里更新。
  const BUTTONS = {
    edit: '[jsname="rhPddf"]',
    save: '[jsname="JbVpqb"]',
  };

  /**
   * 找到操作对应的按钮中当前可见、可用的那个。
   * @param {keyof BUTTONS} action
   * @returns {HTMLElement | undefined}
   */
  function findButton(action) {
    return [...document.querySelectorAll(BUTTONS[action])]
      .find((el) => el.checkVisibility() && !el.disabled && el.getAttribute('aria-disabled') !== 'true');
  }

  // ---------- 快捷键 ----------
  // 每个操作可以有多个快捷键，写作「修饰键+按键」，修饰键可以有多个，也可以没有，例如 'Alt+KeyL'、'Mod+Shift+KeyS'、'F2'。
  // 按下的修饰键必须与写的完全一致：'Alt+KeyL' 不会被 Alt+Shift+L 触发。
  //
  // 修饰键：
  // | 写法  | 按键                                   |
  // | ----- | -------------------------------------- |
  // | Ctrl  | Ctrl（macOS 上也是 Control）           |
  // | Alt   | Alt（macOS 为 Option）                 |
  // | Shift | Shift                                  |
  // | Meta  | macOS 为 ⌘ Command，Windows 为 Win 键  |
  // | Mod   | macOS 为 ⌘ Command，其他系统为 Ctrl    |
  //
  // 按键写 KeyboardEvent.code，表示键盘上的物理按键，与输入法、键盘布局无关
  // （macOS 上 Option+字母会输入特殊字符，按字符判断不可靠）：
  // | 写法                                    | 按键                 |
  // | --------------------------------------- | -------------------- |
  // | KeyA … KeyZ                             | 字母键               |
  // | Digit0 … Digit9                         | 主键盘区的数字键     |
  // | F1 … F12                                | 功能键               |
  // | Enter、Escape、Space、Tab、Backspace    | 回车、Esc、空格等    |
  // | ArrowUp、ArrowDown、ArrowLeft、ArrowRight | 方向键             |
  // | Comma、Period、Slash、Semicolon、Quote  | , . / ; '            |
  // | BracketLeft、BracketRight、Minus、Equal | [ ] - =              |
  // 完整列表：https://developer.mozilla.org/docs/Web/API/UI_Events/Keyboard_event_code_values
  const SHORTCUTS = {
    edit: ['Alt+KeyL'],
    save: ['Alt+KeyO', 'Mod+KeyS'],
  };

  const MODIFIERS = ['Ctrl', 'Alt', 'Shift', 'Meta'];

  /**
   * 把快捷键写法解析成要求的修饰键与按键；写法有误时提示并跳过。
   * @param {string} shortcut 例如 'Mod+Shift+KeyS'
   * @returns {{ code: string, Ctrl: boolean, Alt: boolean, Shift: boolean, Meta: boolean } | undefined}
   */
  function parseShortcut(shortcut) {
    const parts = shortcut.split('+').map((part) => part.trim());
    const code = parts.pop();
    const parsed = { code, Ctrl: false, Alt: false, Shift: false, Meta: false };
    for (const part of parts) {
      const name = part === 'Mod' ? (IS_MAC ? 'Meta' : 'Ctrl') : part;
      if (!MODIFIERS.includes(name)) {
        console.warn(`[${GM_info.script.name}] Unknown modifier "${part}" in shortcut:`, shortcut);
        return undefined;
      }
      parsed[name] = true;
    }
    return code ? parsed : undefined;
  }

  // 解析后的快捷键：[操作, 要求]
  const BINDINGS = Object.entries(SHORTCUTS).flatMap(([action, list]) => list
    .map((shortcut) => [action, parseShortcut(shortcut)])
    .filter(([, parsed]) => parsed));

  /**
   * 按键对应的操作；修饰键须与快捷键要求的完全一致。
   * @param {KeyboardEvent} event
   * @returns {keyof BUTTONS | undefined}
   */
  function actionOf(event) {
    const pressed = { Ctrl: event.ctrlKey, Alt: event.altKey, Shift: event.shiftKey, Meta: event.metaKey };
    return BINDINGS.find(([, parsed]) => parsed.code === event.code && MODIFIERS.every((name) => parsed[name] === pressed[name]))?.[0];
  }

  // 编辑时焦点在输入框里，在 window 的捕获阶段处理，先于输入框收到按键。
  // 找到按钮才拦下按键：避免 macOS 上 Option+字母往输入框里打出特殊字符、Ctrl/⌘+S 弹出浏览器的「保存网页」；
  // 找不到时按键照常交给页面和浏览器。
  window.addEventListener('keydown', (event) => {
    const action = actionOf(event);
    if (!action) return;
    const button = findButton(action);
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    button.click();
  }, true);
})();
