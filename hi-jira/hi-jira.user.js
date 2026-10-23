// ==UserScript==
// @name         Hi, Jira
// @name:en      Hi, Jira
// @namespace    https://github.com/xianghongai
// @version      1.2.3
// @description  Clicking the text of a Jira field no longer starts editing; only the edit icon does. Alt+L adds a link. Written for Jira v8.13.15; set @match to your Jira address before use.
// @description:en  Clicking the text of a Jira field no longer starts editing; only the edit icon does. Alt+L adds a link. Written for Jira v8.13.15; set @match to your Jira address before use.
// @description:zh-CN  Jira 中点击字段文字不再进入编辑，只能点击编辑图标；Alt+L 添加链接。作者在 Jira v8.13.15 编写和使用，其它版本可能需要调整源码；使用前把 @match 换成 Jira 的真实地址。
// @description:zh-TW  Jira 中點擊欄位文字不再進入編輯，只能點擊編輯圖示；Alt+L 新增連結。作者在 Jira v8.13.15 編寫和使用，其它版本可能需要調整原始碼；使用前把 @match 換成 Jira 的真實位址。
// @author       xianghongai <xianghongai@gmail.com>
// @license      MIT
// @icon         https://xinlu.ink/favicon.ico
// @match        *://jira.example.com/*
// @grant        unsafeWindow
// @run-at       document-idle
// ==/UserScript==

console.log(GM_info.script.name);

(function () {
  'use strict';

  /**
   * 🚀 可编辑字段禁止点击文本编辑，只能通过点击编辑按钮图标操作
   */

  function editableField(event) {
    const targetEle = event.target;

    // i. 点击的是“编辑”按钮图标
    const isEdit = hasClass(targetEle, 'aui-iconfont-edit');

    // ii. 点击的是图片、链接
    // img
    // a
    const inWhitelist = ['img', 'a'].includes(targetEle.tagName.toLowerCase());

    if (inWhitelist || isEdit) {
      return true;
    }

    // 1. 父层为可编辑字段 (非 Description)
    const editableFieldParent = getParents(
      targetEle,
      '.editable-field:not(#description-val)'
    );
    const isEditableFieldParent =
      editableFieldParent && hasClass(editableFieldParent, 'inactive');

    // 2. 当前层为可编辑字段 (非 Description)
    const isEditableField =
      hasClass(targetEle, 'editable-field') && hasClass(targetEle, 'inactive');

    // 3. Description 字段
    const isDescriptionField = getParents(targetEle, '.user-content-block');

    if (isEditableFieldParent || isEditableField || isDescriptionField) {
      event.preventDefault();
      event.stopPropagation();

      return false;
    }
  }

  /**
   * 🚀 快捷功能
   */

  function keyboardShortcut(event) {
    // 在 macOS 上，Option (ALT) 键有特殊功能，它用于输入特殊字符和符号。
    // 按下 Option+T 时，macOS 可能将其解释为一个特殊字符输入，而不是单纯的修饰键+字母组合，
    // 这就导致 JavaScript 事件系统接收到的不是标准的按键事件，而是 "Unidentified"。
    // event.code 表示物理按键的位置，与键盘布局无关。

    // 按 ALT+L 添加 Link
    if (
      event.altKey &&
      ((event.key === 'Unidentified' && event.code === 'KeyL') ||
        event.key.toLowerCase() === 'l')
    ) {
      document.querySelector('#link-issue')?.click();
    }
  }

  /**
   * 🚀 DOM 事件
   */

  function click(event) {
    editableField(event);
  }

  document.addEventListener('click', click, true);

  function keydown(event) {
    keyboardShortcut(event);
  }

  document.addEventListener('keydown', keydown, true);

  // #region COMMON
  function hasClass(el, className) {
    if (el.classList) {
      return el.classList.contains(className);
    }
    return !!el.className.match(new RegExp('(\\s|^)' + className + '(\\s|$)'));
  }

  function getParents(elem, selector) {
    for (; elem && elem !== document; elem = elem.parentNode) {
      if (elem.matches(selector)) return elem;
    }
    return null;
  }
  // #endregion
})();
