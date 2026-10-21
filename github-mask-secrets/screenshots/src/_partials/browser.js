/*
  <browser-window>: the browser frame around a scene. Load with <script defer src="_partials/browser.js">.

  Attributes
    tab-title  text of the active tab
    url        address bar text
    icon       the extension icon, relative to the scene (e.g. ../../src/assets/icon.svg)
    favicon    "page" (default) | "github" | "extensions" (chrome://extensions) | "icon" (the extension icon)
               | path to an image
    toolbar    "extension" (default when icon is set) | "tampermonkey" | "none"
               The toolbar never shows anything else; the browser menu button is always last.
    pressed    present = the toolbar icon is pressed (its popup is open)

  Children become the page area (.page-viewport). Every <img data-ext-icon> inside gets the icon as its src.
*/
(() => {
  // Canvas size from the #canvas=<W>x<H> hash: see "Sizes and the canvas" in scripts/render.sh.
  const canvas = /(?:^#|&)canvas=(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)/.exec(location.hash);
  if (canvas) {
    document.documentElement.style.setProperty('--canvas-w', `${canvas[1]}px`);
    document.documentElement.style.setProperty('--canvas-h', `${canvas[2]}px`);
  }

  const SVG = {
    github:
      '<svg viewBox="0 0 16 16" fill="#1f2328"><path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z"/></svg>',
    page: '<svg class="lucide lucide-panel-top" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/></svg>',
    extensions:
      '<svg class="lucide lucide-puzzle" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15.39 4.39a1 1 0 0 0 1.68-.474 2.5 2.5 0 1 1 3.014 3.015 1 1 0 0 0-.474 1.68l1.683 1.682a2.414 2.414 0 0 1 0 3.414L19.61 15.39a1 1 0 0 1-1.68-.474 2.5 2.5 0 1 0-3.014 3.015 1 1 0 0 1 .474 1.68l-1.683 1.682a2.414 2.414 0 0 1-3.414 0L8.61 19.61a1 1 0 0 0-1.68.474 2.5 2.5 0 1 1-3.014-3.015 1 1 0 0 0 .474-1.68l-1.683-1.682a2.414 2.414 0 0 1 0-3.414L4.39 8.61a1 1 0 0 1 1.68.474 2.5 2.5 0 1 0 3.014-3.015 1 1 0 0 1-.474-1.68l1.683-1.682a2.414 2.414 0 0 1 3.414 0z"/></svg>',
    tampermonkey:
      '<svg viewBox="0 0 16 16"><rect x="0.5" y="0.5" width="15" height="15" rx="3.5" fill="#1f2328"/><circle cx="4.9" cy="10.4" r="2.5" fill="#ffffff"/><circle cx="11.1" cy="10.4" r="2.5" fill="#ffffff"/></svg>',
    menu: '<svg class="lucide lucide-ellipsis-vertical" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>',
    close:
      '<svg class="lucide lucide-x" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>',
    back: '<svg class="lucide lucide-chevron-left" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>',
    forward:
      '<svg class="lucide lucide-chevron-right" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>',
    reload:
      '<svg class="lucide lucide-rotate-cw" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>',
    lock: '<svg class="lucide lucide-lock" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
  };

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const img = (src) => `<img src="${esc(src)}" alt="">`;

  class BrowserWindow extends HTMLElement {
    connectedCallback() {
      if (this.dataset.rendered) return;
      this.dataset.rendered = '1';

      const attr = (name, fallback = '') => this.getAttribute(name) ?? fallback;
      const icon = attr('icon');
      const favicon = attr('favicon', 'page');
      const toolbar = attr('toolbar', icon ? 'extension' : 'none');
      const tool =
        toolbar === 'tampermonkey' ? SVG.tampermonkey : toolbar === 'extension' && icon ? img(icon) : '';
      const pressed = this.hasAttribute('pressed') ? ' pressed' : '';

      const page = document.createElement('div');
      page.className = 'page-viewport';
      page.append(...this.childNodes);

      this.innerHTML = `
        <div class="browser-chrome">
          <div class="tabs-bar">
            <div class="window-controls"><span class="dot close"></span><span class="dot min"></span><span class="dot max"></span></div>
            <div class="tab-list">
              <div class="tab active">
                <span class="tab-favicon">${favicon === 'icon' ? img(icon) : (SVG[favicon] ?? img(favicon))}</span>
                <span class="tab-title">${esc(attr('tab-title'))}</span>
                <span class="tab-close">${SVG.close}</span>
              </div>
              <div class="new-tab-btn">+</div>
            </div>
          </div>
          <div class="nav-bar">
            <div class="nav-buttons">
              <span class="nav-btn">${SVG.back}</span>
              <span class="nav-btn disabled">${SVG.forward}</span>
              <span class="nav-btn">${SVG.reload}</span>
            </div>
            <div class="address-bar">
              <span class="address-icon">${SVG.lock}</span>
              <span class="url-text">${esc(attr('url'))}</span>
            </div>
            <div class="toolbar-actions">
              ${tool ? `<span class="toolbar-btn${pressed}">${tool}</span>` : ''}
              <span class="toolbar-btn">${SVG.menu}</span>
            </div>
          </div>
        </div>`;
      this.append(page);

      if (icon) {
        this.querySelectorAll('img[data-ext-icon]').forEach((el) => el.setAttribute('src', icon));
      }
    }
  }

  customElements.define('browser-window', BrowserWindow);
})();
