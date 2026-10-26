// ==UserScript==
// @name         Claude Quick Usage
// @name:en      Claude Quick Usage
// @namespace    https://github.com/xianghongai
// @version      1.0.0
// @description  Add a direct shortcut to Settings/Usage in the user profile menu and sidebar on Claude, and automatically refresh usage data.
// @description:en  Add a direct shortcut to Settings/Usage in the user profile menu and sidebar on Claude, and automatically refresh usage data.
// @description:zh-CN  在 Claude 左下角用户菜单及侧边栏添加直达「Settings/Usage」的快捷入口，进入后自动刷新用量额度。
// @description:zh-TW  在 Claude 左下角使用者選單及側邊欄添加直達「Settings/Usage」的快捷項目，進入後自動重新整理用量額度。
// @author       xianghongai <xianghongai@gmail.com>
// @license      MIT
// @icon         https://xinlu.ink/favicon.ico
// @match        https://claude.ai/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

console.log(GM_info.script.name);

(() => {
  'use strict';

  const PREFIX = 'user-script-claude-quick-usage';
  const ATTR_MENU_ITEM = `data-${PREFIX}-menu-item`;
  const ATTR_QUICK_BTN = `data-${PREFIX}-quick-btn`;
  const USAGE_HASH = '#settings/usage';

  // 是否需要在进入 Usage 后自动点击 Refresh 按钮
  let shouldAutoRefresh = false;

  // Lucide Gauge 图标 (SVG)
  const LUCIDE_GAUGE_SVG = (size = 18) => `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-gauge" aria-hidden="true">
      <path d="m12 14 4-4"/>
      <path d="M3.34 19a10 10 0 1 1 17.32 0"/>
    </svg>
  `.trim();

  /**
   * 自动点击 Usage 页面中的刷新按钮
   */
  function triggerAutoRefresh() {
    if (!shouldAutoRefresh || location.hash !== USAGE_HASH) {
      return false;
    }

    const refreshBtn = document.querySelector('button[aria-label="Refresh"]');
    if (refreshBtn && !refreshBtn.disabled && refreshBtn.getAttribute('aria-disabled') !== 'true') {
      shouldAutoRefresh = false;
      refreshBtn.click();
      return true;
    }

    return false;
  }

  /**
   * 打开 Settings/Usage 页面并标记刷新
   */
  function openUsage() {
    shouldAutoRefresh = true;
    if (location.hash === USAGE_HASH) {
      // 若当前已在 usage hash，先清空再重新写入，确保触发 hash 路由变更
      history.replaceState(null, '', location.pathname + location.search);
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    }
    location.hash = USAGE_HASH;

    // 保底轮询：若 MutationObserver 稍有延迟，进行短时检测
    const startTime = Date.now();
    const timer = setInterval(() => {
      if (!shouldAutoRefresh || Date.now() - startTime > 4000) {
        clearInterval(timer);
        return;
      }
      if (triggerAutoRefresh()) {
        clearInterval(timer);
      }
    }, 150);
  }

  /**
   * 在弹出的用户中心菜单中注入 Usage 项
   */
  function injectMenuItem() {
    const settingsItem = document.querySelector('[data-testid="user-menu-settings"]');
    if (!settingsItem || settingsItem.parentElement?.querySelector(`[${ATTR_MENU_ITEM}]`)) {
      return;
    }

    const usageItem = settingsItem.cloneNode(true);
    usageItem.setAttribute(ATTR_MENU_ITEM, 'true');
    usageItem.setAttribute('data-testid', 'user-menu-usage');
    usageItem.removeAttribute('id');
    usageItem.removeAttribute('aria-keyshortcuts');

    // 设置文案
    const label = usageItem.querySelector('.truncate');
    if (label) {
      label.textContent = 'Usage';
    }

    // 移除快捷键提示区域
    const shortcutWrap = usageItem.querySelector('[data-cds="Shortcut"]')?.closest('span.flex');
    if (shortcutWrap) {
      shortcutWrap.remove();
    }

    // 设置 Lucide Gauge 图标
    const iconSlot = usageItem.querySelector('.size-icon') || usageItem.querySelector('[data-cds="Icon"]')?.parentElement;
    if (iconSlot) {
      iconSlot.innerHTML = LUCIDE_GAUGE_SVG(16);
    }

    // 鼠标悬停高亮
    usageItem.addEventListener('mouseenter', () => {
      usageItem.setAttribute('data-highlighted', '');
    });
    usageItem.addEventListener('mouseleave', () => {
      usageItem.removeAttribute('data-highlighted');
    });

    // 点击事件
    const handleTrigger = (e) => {
      e.preventDefault();
      e.stopPropagation();

      // 发送 Escape 关闭菜单浮层
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

      // 直达 Settings/Usage
      openUsage();
    };

    usageItem.addEventListener('click', handleTrigger);
    usageItem.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        handleTrigger(e);
      }
    });

    settingsItem.after(usageItem);
  }

  /**
   * 在 Get apps and extensions 左边注入基于 Lucide 的 Usage 快捷按钮
   */
  function injectQuickButton() {
    const aux = document.querySelector('.df-footer-aux');
    if (!aux || aux.querySelector(`[${ATTR_QUICK_BTN}]`)) {
      return;
    }

    // 定位目标元素：Get apps and extensions 按钮或其外层容器
    const appBtn = aux.querySelector('a[aria-label*="Get apps"], button[aria-label*="Get apps"], a[href="/downloads"], a, button');
    if (!appBtn) {
      return;
    }

    const spanWrap = appBtn.closest('span.relative') || appBtn;

    const clone = spanWrap.cloneNode(true);
    clone.setAttribute(ATTR_QUICK_BTN, 'true');
    clone.removeAttribute('id');

    const btn = clone.matches('a, button') ? clone : clone.querySelector('a, button');
    if (!btn) {
      return;
    }

    btn.removeAttribute('href');
    btn.removeAttribute('id');
    btn.setAttribute('aria-label', 'Usage');
    btn.setAttribute('title', 'Settings / Usage');

    // 替换为 Lucide Gauge 图标
    const iconContainer = btn.querySelector('.inline-flex') || btn;
    iconContainer.innerHTML = LUCIDE_GAUGE_SVG(18);

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openUsage();
    });

    // 精确插入到 Get apps and extensions 的左侧
    spanWrap.before(clone);
  }

  /**
   * 刷新并尝试注入各入口
   */
  function update() {
    injectMenuItem();
    injectQuickButton();
    triggerAutoRefresh();
  }

  // 监听外部 hash 变化（如用户直接通过链接进入 #settings/usage）
  window.addEventListener('hashchange', () => {
    if (location.hash === USAGE_HASH) {
      shouldAutoRefresh = true;
      update();
    } else {
      shouldAutoRefresh = false;
    }
  });

  // 页面初始加载与 DOM 变化监听
  if (location.hash === USAGE_HASH) {
    shouldAutoRefresh = true;
  }
  update();

  let scheduled = false;
  const observer = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      update();
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
})();
