// ==UserScript==
// @name         BootCDN: Copy All
// @name:en      BootCDN: Copy All
// @name:zh-CN   BootCDN: Copy All
// @namespace    https://github.com/xianghongai
// @version      1.0.1
// @description  On BootCDN library pages, copy the links or <script>/<link> tags of all files currently shown in one click, following the selected version, file type and protocol.
// @description:en  On BootCDN library pages, copy the links or <script>/<link> tags of all files currently shown in one click, following the selected version, file type and protocol.
// @description:zh-CN  在 BootCDN 的库页面一键复制当前显示的全部文件链接或 <script>/<link> 标签，跟随所选的版本、文件类型与协议。
// @description:zh-TW  在 BootCDN 的庫頁面一鍵複製目前顯示的全部檔案連結或 <script>/<link> 標籤，跟隨所選的版本、檔案類型與協定。
// @author       xianghongai <xianghongai@gmail.com>
// @license      MIT
// @homepageURL  https://github.com/xianghongai/tampermonkey-userscripts
// @supportURL   https://github.com/xianghongai/tampermonkey-userscripts/issues
// @icon         https://www.bootcdn.cn/favicon.ico
// @match        https://www.bootcdn.cn/*
// @grant        GM_setClipboard
// @run-at       document-idle
// @noframes
// ==/UserScript==

console.log(GM_info.script.name);

(() => {
  'use strict';

  // 库页面的工具栏：「版本」「文件」两个下拉框所在的标题行。
  // 切换版本时页面只替换下方的文件列表，工具栏保留，所以按钮只需插入一次。
  const toolbar = document.querySelector('main.items-container > h5');
  if (!toolbar) return;

  const style = document.createElement('style');
  style.textContent = `
    .user-script-bootcdn-copy-all-actions {
      display: inline-flex;
      gap: 6px;
      margin-left: 12px;
      vertical-align: middle;
    }
  `;
  document.head.append(style);

  const actions = document.createElement('span');
  actions.className = 'user-script-bootcdn-copy-all-actions';
  actions.append(
    createButton('复制全部链接', 'link', (urls) => urls),
    createButton('复制全部标签', 'code', (urls) => urls.map(toTag).filter(Boolean)),
  );
  toolbar.append(actions);

  /**
   * 创建复制按钮，沿用页面自身的 Bootstrap 按钮样式与 Font Awesome 图标。
   * @param {string} label 按钮文字
   * @param {string} icon Font Awesome 图标名，不含 fa- 前缀
   * @param {(urls: string[]) => string[]} format 把文件链接转成要复制的各行
   * @returns {HTMLButtonElement}
   */
  function createButton(label, icon, format) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-default user-script-bootcdn-copy-all-button';
    btn.innerHTML = `<i class="fa fa-${icon}"></i> <span></span>`;
    const text = btn.querySelector('span');
    text.textContent = label;

    let timer;
    btn.addEventListener('click', () => {
      const lines = format(visibleUrls());
      if (lines.length) GM_setClipboard(lines.join('\n'), 'text');
      text.textContent = lines.length ? `已复制 ${lines.length} 条` : '没有可复制的文件';
      clearTimeout(timer);
      timer = setTimeout(() => (text.textContent = label), 1500);
    });
    return btn;
  }

  /**
   * 当前显示的文件链接。每次点击时现取：版本切换会替换列表，文件类型筛选会隐藏条目，协议切换会改写链接文字。
   * @returns {string[]}
   */
  function visibleUrls() {
    return [...document.querySelectorAll('.file-items > li')]
      .filter((li) => li.checkVisibility())
      .map((li) => li.querySelector('.library-url')?.textContent.trim())
      .filter(Boolean);
  }

  /**
   * 把文件链接转成引用标签，写法与页面自带的「复制标签」一致；JS、CSS 以外的文件没有对应标签，返回 undefined。
   * @param {string} url
   * @returns {string | undefined}
   */
  function toTag(url) {
    if (/\.css$/i.test(url)) return `<link href="${url}" rel="stylesheet">`;
    if (/\.js$/i.test(url)) return `<script src="${url}"></script>`;
    return undefined;
  }
})();
