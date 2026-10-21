/*
  <vscode-window>: the VS Code workbench. Load with <script defer src="_partials/vscode.js"> and _partials/vscode.css.

  Attributes
    workspace  name in the title bar search box (default my-project)
    icon       the extension's activity bar icon, relative to the scene; leave it out if the
               extension has no activity bar view
    files      Explorer entries, comma-separated; mark the open file with a leading *; files="" hides
               the side bar
    tabs       editor tabs, comma-separated; the first one is active (default: the open file)
    panel-tabs   bottom panel tabs (default Problems, Output, Debug Console, Terminal)
    panel-active the selected panel tab (default Terminal)
    branch, problems, cursor, language   status bar texts

  Children with slot="overlay" are laid over the whole window (e.g. the Command Palette).
  Children with slot="panel" are the bottom panel's content (terminal lines: ok / dir classes); without
  them there is no panel and the editor takes the full height.
  The rest is the editor content: one source line per line, indentation kept, coloured by hand with
  the kw / fn / str / var / cm classes.
*/
(() => {
  // Canvas size from the #canvas=<W>x<H> hash: see "Sizes and the canvas" in scripts/render.sh.
  const canvas = /(?:^#|&)canvas=(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)/.exec(location.hash);
  if (canvas) {
    document.documentElement.style.setProperty('--canvas-w', `${canvas[1]}px`);
    document.documentElement.style.setProperty('--canvas-h', `${canvas[2]}px`);
  }

  const SVG = {
    files:
      '<svg class="lucide lucide-files" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2h-4a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8"/><path d="M16.706 2.706A2.4 2.4 0 0 0 15 2v5a1 1 0 0 0 1 1h5a2.4 2.4 0 0 0-.706-1.706z"/><path d="M5 7a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h8a2 2 0 0 0 1.732-1"/></svg>',
    search: '<svg class="lucide lucide-search" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21 21-4.34-4.34"/><circle cx="11" cy="11" r="8"/></svg>',
    scm: '<svg class="lucide lucide-git-branch" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6a9 9 0 0 0-9 9V3"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/></svg>',
    extensions:
      '<svg class="lucide lucide-blocks" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 22V7a1 1 0 0 0-1-1H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5a1 1 0 0 0-1-1H2"/><rect x="14" y="2" width="8" height="8" rx="1"/></svg>',
    titleSearch:
      '<svg class="lucide lucide-search" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21 21-4.34-4.34"/><circle cx="11" cy="11" r="8"/></svg>',
    remote: '<svg class="lucide lucide-chevrons-right-left" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m20 17-5-5 5-5"/><path d="m4 17 5-5-5-5"/></svg>',
  };
  const FILE_ICON = {
    json: ['J', '#e8c46a'],
    js: ['J', '#e8c46a'],
    md: ['M', '#9cdcfe'],
    ts: ['T', '#4fc1ff'],
    tsx: ['T', '#4fc1ff'],
    css: ['#', '#9cdcfe'],
    html: ['<', '#e37933'],
  };

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const list = (s) => s.split(',').map((x) => x.trim()).filter(Boolean);

  const codeLines = (html) => {
    const lines = html.replace(/^[ \t]*<!--[\s\S]*?-->[ \t]*\n/gm, '').replace(/\t/g, '  ').split('\n');
    while (lines.length && !lines[0].trim()) lines.shift();
    while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
    const indent = Math.min(...lines.filter((l) => l.trim()).map((l) => l.match(/^ */)[0].length));
    return lines.map((l, i) => `<div><span class="ln">${i + 1}</span>${l.slice(indent)}</div>`).join('');
  };

  class VscodeWindow extends HTMLElement {
    connectedCallback() {
      if (this.dataset.rendered) return;
      this.dataset.rendered = '1';

      const attr = (name, fallback = '') => this.getAttribute(name) ?? fallback;
      const take = (slot) =>
        Array.from(this.children)
          .filter((c) => c.getAttribute('slot') === slot)
          .map((c) => {
            c.remove();
            c.removeAttribute('slot');
            return c;
          });
      const overlays = take('overlay');
      const panel = take('panel');
      const code = this.innerHTML;

      const files = list(attr('files', 'package.json, README.md, *index.ts, utils.ts, tsconfig.json'));
      const panelActive = attr('panel-active', 'Terminal');
      const panelTabs = list(attr('panel-tabs', 'Problems, Output, Debug Console, Terminal'));
      const open = (files.find((f) => f.startsWith('*')) ?? '*').slice(1);
      const tabs = list(attr('tabs', open));
      const icon = attr('icon');
      const fileRow = (f) => {
        const name = f.replace(/^\*/, '');
        const [letter, color] = FILE_ICON[name.split('.').pop()] ?? ['#', '#9d9d9d'];
        return `<div class="file${f.startsWith('*') ? ' on' : ''}"><span class="ic" style="background:${color}">${esc(letter)}</span>${esc(name)}</div>`;
      };

      this.innerHTML = `
        <div class="title">
          <div class="window-controls"><span class="dot close"></span><span class="dot min"></span><span class="dot max"></span></div>
          <div class="search">${SVG.titleSearch}${esc(attr('workspace', 'my-project'))}</div>
        </div>
        <div class="main">
          <div class="activity">
            <span class="on">${SVG.files}</span><span>${SVG.search}</span><span>${SVG.scm}</span><span>${SVG.extensions}</span>
            ${icon ? `<img src="${esc(icon)}" alt="">` : ''}
          </div>
          ${files.length ? `<div class="sidebar card"><h3>EXPLORER</h3>${files.map(fileRow).join('')}</div>` : ''}
          <div class="sash v"></div>
          <div class="column">
            <div class="editor card">
              <div class="tabs">${tabs.map((t, i) => `<div class="t${i ? '' : ' on'}">${esc(t)}</div>`).join('')}</div>
              <div class="code">${codeLines(code)}</div>
            </div>
            ${
              panel.length
                ? `<div class="sash h"></div>
                   <div class="panel card">
                     <div class="panel-tabs">${panelTabs.map((t) => `<span${t === panelActive ? ' class="on"' : ''}>${esc(t)}</span>`).join('')}</div>
                     <div class="panel-body"></div>
                   </div>`
                : ''
            }
          </div>
        </div>
        <div class="status">
          ${SVG.remote}
          <span>${esc(attr('branch', 'main'))}</span><span>${esc(attr('problems', '0 errors, 0 warnings'))}</span>
          <span class="right"><span>${esc(attr('cursor', 'Ln 1, Col 1'))}</span><span>${esc(attr('language', 'TypeScript'))}</span></span>
        </div>`;
      this.querySelector('.panel-body')?.append(...panel);
      this.append(...overlays);
    }
  }

  customElements.define('vscode-window', VscodeWindow);
})();
