// ==UserScript==
// @name         GitHub 😍 DeepWiki
// @name:en      GitHub 😍 DeepWiki
// @namespace    https://github.com/xianghongai
// @version      1.0.1
// @description  Add a shortcut button on GitHub repository pages to jump directly to DeepWiki
// @description:en  Add a shortcut button on GitHub repository pages to jump directly to DeepWiki
// @description:zh-CN  在 GitHub 仓库页面添加快捷按钮，一键跳转到 DeepWiki
// @description:zh-TW  在 GitHub 儲存庫頁面加入快捷按鈕，一鍵跳轉到 DeepWiki
// @author       xianghongai <xianghongai@gmail.com>
// @license      MIT
// @icon         https://xinlu.ink/favicon.ico
// @homepageURL  https://github.com/xianghongai/tampermonkey-userscripts
// @supportURL   https://github.com/xianghongai/tampermonkey-userscripts/issues
// @match        https://github.com/*
// @grant        none
// @run-at       document-idle
// @noframes
// ==/UserScript==

console.log(GM_info.script.name);

(function () {
  'use strict';

  const BUTTON_ID = 'go-deepwiki';

  const BOOK_ICON = `<span data-component="icon"><svg data-component="Octicon" aria-hidden="true" focusable="false" class="octicon octicon-book" viewBox="0 0 16 16" width="16" height="16" fill="currentColor" display="inline-block" overflow="visible" style="vertical-align:text-bottom"><path d="M0 1.75A.75.75 0 0 1 .75 1h4.253c1.227 0 2.317.59 3 1.501A3.743 3.743 0 0 1 11.006 1h4.245a.75.75 0 0 1 .75.75v10.5a.75.75 0 0 1-.75.75h-4.507a2.25 2.25 0 0 0-1.591.659l-.622.621a.75.75 0 0 1-1.06 0l-.622-.621A2.25 2.25 0 0 0 5.258 13H.75a.75.75 0 0 1-.75-.75Zm7.251 10.324.004-5.073-.002-2.253A2.25 2.25 0 0 0 5.003 2.5H1.5v9h3.757a3.75 3.75 0 0 1 1.994.574ZM8.755 4.75l-.004 7.322a3.752 3.752 0 0 1 1.992-.572H14.5v-9h-3.495a2.25 2.25 0 0 0-2.25 2.25Z"></path></svg></span>`;

  function getRepoPath() {
    const parts = location.pathname.split('/').filter(Boolean);
    if (parts.length >= 2) {
      // 排除 GitHub 全局保留路由
      const reserved = ['settings', 'explore', 'marketplace', 'notifications', 'orgs', 'trending'];
      if (!reserved.includes(parts[0])) {
        return `${parts[0]}/${parts[1]}`;
      }
    }
    return null;
  }

  function getActionsList() {
    return (
      // 登录后
      document.querySelector('ul[data-testid="repo-header-actions"]') ||
      // 未登录
      document.querySelector('#repository-details-container ul.pagehead-actions')
    );
  }

  function createBtn(repoPath) {
    const li = document.createElement('li');
    li.id = BUTTON_ID;

    const url = `https://deepwiki.com/${repoPath}`;
    li.innerHTML = `
      <a href="${url}"
         target="_blank"
         rel="noopener noreferrer"
         class="btn btn-sm"
         style="display: inline-flex; align-items: center; gap: 4px;"
         title="Go to DeepWiki">
        ${BOOK_ICON}
        <span>DeepWiki</span>
      </a>
    `;
    return li;
  }

  function injectButton() {
    const repoPath = getRepoPath();
    if (!repoPath) return;

    // 已存在则仅在仓库切换时更新链接（应对 SPA 页面无刷新跳转）
    const existingBtn = document.getElementById(BUTTON_ID);
    if (existingBtn) {
      const link = existingBtn.querySelector('a');
      const url = `https://deepwiki.com/${repoPath}`;
      if (link && link.getAttribute('href') !== url) {
        link.setAttribute('href', url);
      }
      return;
    }

    const targetList = getActionsList();
    if (targetList) {
      // 插入到按钮组的最前面
      targetList.prepend(createBtn(repoPath));
    }
  }

  // 监听 GitHub 的 SPA 路由切换与 DOM 变动
  document.addEventListener('turbo:render', injectButton);
  document.addEventListener('turbo:load', injectButton);
  document.addEventListener('pjax:end', injectButton);

  const observer = new MutationObserver(() => {
    injectButton();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  // 首次运行
  injectButton();
})();