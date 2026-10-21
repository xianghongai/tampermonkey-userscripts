/*
  github.com elements. Load with <script defer src="_partials/github.js"> and _partials/github.css.
  Sample identity: octocat / Hello-World (hubot, mona for other people). Attributes left out use these defaults.

  <gh-icon name="copy">                       an octicon; names are the keys of ICONS below
  <gh-repo-header owner repo visibility tab issues pulls watch fork star>
      Repository title row and tabs (tab = code | issues | pulls). Children are placed first in the
      action row next to Watch / Fork / Star: that is where an injected button goes.
  <gh-file-view repo path author message sha age meta lang controls-callout controls-callout-side>
      A /blob/ file page: breadcrumbs, latest commit, Code|Blame + Raw / copy / download, then the code.
      Children with slot="controls" go first in the Raw / copy / download row. The rest is the code:
      one source line per line, indentation kept, inline markup allowed within a line (e.g. a callout).
      lang="json" colours keys, strings, numbers and constants; other languages are shown as written,
      use the pl-* classes from github.css by hand.
  <gh-comment author age role>
      A timeline comment. Children with slot="actions" go in the header before the ⋯ menu.
      The rest is the rendered Markdown body.
*/
(() => {
  /* ICONS:BEGIN generated from octicons (16px); keys are the names gh-icon accepts */
  const ICONS = {
    book: "<path d=\"M0 1.75A.75.75 0 0 1 .75 1h4.253c1.227 0 2.317.59 3 1.501A3.743 3.743 0 0 1 11.006 1h4.245a.75.75 0 0 1 .75.75v10.5a.75.75 0 0 1-.75.75h-4.507a2.25 2.25 0 0 0-1.591.659l-.622.621a.75.75 0 0 1-1.06 0l-.622-.621A2.25 2.25 0 0 0 5.258 13H.75a.75.75 0 0 1-.75-.75Zm7.251 10.324.004-5.073-.002-2.253A2.25 2.25 0 0 0 5.003 2.5H1.5v9h3.757a3.75 3.75 0 0 1 1.994.574ZM8.755 4.75l-.004 7.322a3.752 3.752 0 0 1 1.992-.572H14.5v-9h-3.495a2.25 2.25 0 0 0-2.25 2.25Z\"/>",
    branch: "<path d=\"M11.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm-2.25.75a2.25 2.25 0 1 1 3 2.122V6A2.5 2.5 0 0 1 10 8.5H6a1 1 0 0 0-1 1v1.128a2.251 2.251 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.5 0v1.836A2.493 2.493 0 0 1 6 7h4a1 1 0 0 0 1-1v-.628A2.25 2.25 0 0 1 9.5 3.25Z\"/>",
    check: "<path d=\"M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z\"/>",
    code: "<path d=\"m11.28 3.22 4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.749.749 0 0 1-1.275-.326.749.749 0 0 1 .215-.734L13.94 8l-3.72-3.72a.749.749 0 0 1 .326-1.275.749.749 0 0 1 .734.215Zm-6.56 0a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042L2.06 8l3.72 3.72a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L.47 8.53a.75.75 0 0 1 0-1.06l4.25-4.25Z\"/>",
    copy: "<path d=\"M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z\"/><path d=\"M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z\"/>",
    download: "<path d=\"M2.75 14A1.75 1.75 0 0 1 1 12.25v-2.5a.75.75 0 0 1 1.5 0v2.5c0 .138.112.25.25.25h10.5a.25.25 0 0 0 .25-.25v-2.5a.75.75 0 0 1 1.5 0v2.5A1.75 1.75 0 0 1 13.25 14Z\"/><path d=\"M7.25 7.689V2a.75.75 0 0 1 1.5 0v5.689l1.97-1.969a.749.749 0 1 1 1.06 1.06l-3.25 3.25a.749.749 0 0 1-1.06 0L4.22 6.78a.749.749 0 1 1 1.06-1.06l1.97 1.969Z\"/>",
    eye: "<path d=\"M8 2c1.981 0 3.671.992 4.933 2.078 1.27 1.091 2.187 2.345 2.637 3.023a1.62 1.62 0 0 1 0 1.798c-.45.678-1.367 1.932-2.637 3.023C11.67 13.008 9.981 14 8 14c-1.981 0-3.671-.992-4.933-2.078C1.797 10.83.88 9.576.43 8.898a1.62 1.62 0 0 1 0-1.798c.45-.677 1.367-1.931 2.637-3.022C4.33 2.992 6.019 2 8 2ZM1.679 7.932a.12.12 0 0 0 0 .136c.411.622 1.241 1.75 2.366 2.717C5.176 11.758 6.527 12.5 8 12.5c1.473 0 2.825-.742 3.955-1.715 1.124-.967 1.954-2.096 2.366-2.717a.12.12 0 0 0 0-.136c-.412-.621-1.242-1.75-2.366-2.717C10.824 4.242 9.473 3.5 8 3.5c-1.473 0-2.825.742-3.955 1.715-1.124.967-1.954 2.096-2.366 2.717ZM8 10a2 2 0 1 1-.001-3.999A2 2 0 0 1 8 10Z\"/>",
    file: "<path d=\"M2 1.75C2 .784 2.784 0 3.75 0h6.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v9.586A1.75 1.75 0 0 1 13.25 16h-9.5A1.75 1.75 0 0 1 2 14.25Zm1.75-.25a.25.25 0 0 0-.25.25v12.5c0 .138.112.25.25.25h9.5a.25.25 0 0 0 .25-.25V6h-2.75A1.75 1.75 0 0 1 9 4.25V1.5Zm6.75.78v2.47c0 .138.112.25.25.25h2.47Z\"/>",
    folder: "<path d=\"M1.75 1A1.75 1.75 0 0 0 0 2.75v10.5C0 14.216.784 15 1.75 15h12.5A1.75 1.75 0 0 0 16 13.25v-8.5A1.75 1.75 0 0 0 14.25 3H7.5a.25.25 0 0 1-.2-.1l-.9-1.2C6.07 1.26 5.55 1 5 1H1.75Z\"/>",
    fork: "<path d=\"M5 5.372v.878c0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75v-.878a2.25 2.25 0 1 1 1.5 0v.878a2.25 2.25 0 0 1-2.25 2.25h-1.5v2.128a2.251 2.251 0 1 1-1.5 0V8.5h-1.5A2.25 2.25 0 0 1 3.5 6.25v-.878a2.25 2.25 0 1 1 1.5 0ZM5 3.25a.75.75 0 1 0-1.5 0 .75.75 0 0 0 1.5 0Zm6.75.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm-3 8.75a.75.75 0 1 0-1.5 0 .75.75 0 0 0 1.5 0Z\"/>",
    issue: "<path d=\"M8 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z\"/><path d=\"M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Z\"/>",
    kebab: "<path d=\"M8 9a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM1.5 9a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm13 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z\"/>",
    mark: "<path d=\"M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z\"/>",
    pr: "<path d=\"M1.5 3.25a2.25 2.25 0 1 1 3 2.122v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.25 2.25 0 0 1 1.5 3.25Zm5.677-.177L9.5 5.396l2.323-2.323a.75.75 0 0 1 1.06 1.06L10.56 6.458a1.75 1.75 0 0 1-2.12 0L6.116 4.133a.75.75 0 0 1 1.061-1.06Z\"/>",
    repo: "<path d=\"M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 1 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5Zm10.5-1h-8a1 1 0 0 0-1 1v6.708A2.486 2.486 0 0 1 4.5 9h8ZM5 12.25a.25.25 0 0 1 .25-.25h7a.25.25 0 0 1 .25.25v1.25a.25.25 0 0 1-.25.25h-7a.25.25 0 0 1-.25-.25Z\"/>",
    star: "<path d=\"M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.751.751 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Zm0 2.445L6.615 5.5a.75.75 0 0 1-.564.41l-3.097.45 2.24 2.184a.75.75 0 0 1 .216.664l-.528 3.084 2.769-1.456a.75.75 0 0 1 .698 0l2.77 1.456-.53-3.084a.75.75 0 0 1 .216-.664l2.24-2.183-3.096-.45a.75.75 0 0 1-.564-.41L8 2.694Z\"/>",
  };
  /* ICONS:END */

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const icon = (name) => `<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">${ICONS[name] ?? ''}</svg>`;

  /** Take the children with the given slot out of the element. */
  const takeSlot = (el, slot) =>
    Array.from(el.children)
      .filter((child) => child.getAttribute('slot') === slot)
      .map((child) => {
        child.remove();
        child.removeAttribute('slot');
        return child;
      });

  /** Define a light-DOM element that renders once, after the page has been parsed. */
  const define = (tag, render) => {
    customElements.define(
      tag,
      class extends HTMLElement {
        connectedCallback() {
          if (this.dataset.rendered) return;
          this.dataset.rendered = '1';
          const attr = (name, fallback = '') => esc(this.getAttribute(name) ?? fallback);
          render(this, attr);
        }
      }
    );
  };

  /** Split source into numbered code lines: drop whole-line HTML comments, the blank first/last line and the common indentation. */
  const codeLines = (html) => {
    const lines = html.replace(/^[ \t]*<!--[\s\S]*?-->[ \t]*\n/gm, '').replace(/\t/g, '  ').split('\n');
    while (lines.length && !lines[0].trim()) lines.shift();
    while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
    const indent = Math.min(...lines.filter((l) => l.trim()).map((l) => l.match(/^ */)[0].length));
    return lines
      .map((l, i) => `<div class="code-line"><span class="ln">${i + 1}</span><span class="lc">${l.slice(indent)}</span></div>`)
      .join('');
  };

  /** JSON colouring on text nodes only, so inline markup inside a line stays intact. Callout text is skipped. */
  const JSON_TOKEN = /("(?:[^"\\]|\\.)*")(\s*:)?|(-?\b\d+(?:\.\d+)?\b|\btrue\b|\bfalse\b|\bnull\b)/g;
  const highlightJson = (root) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => (node.parentElement.closest('.callout, .ln') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      let html = '';
      let last = 0;
      for (const m of node.data.matchAll(JSON_TOKEN)) {
        const [, str, colon, constant] = m;
        html += esc(node.data.slice(last, m.index));
        html += str
          ? `<span class="${colon ? 'pl-ent' : 'pl-s'}">${esc(str)}</span>${colon ?? ''}`
          : `<span class="pl-c1">${constant}</span>`;
        last = m.index + m[0].length;
      }
      if (!last) continue;
      html += esc(node.data.slice(last));
      const span = document.createElement('span');
      span.innerHTML = html;
      node.replaceWith(...span.childNodes);
    }
  };

  define('gh-icon', (el, attr) => {
    el.innerHTML = icon(attr('name'));
  });

  define('gh-repo-header', (el, attr) => {
    const injected = Array.from(el.childNodes);
    const tab = attr('tab', 'code');
    const tabClass = (name) => `repo-tab${tab === name ? ' active' : ''}`;
    const count = (label, value) => (value ? `${label} <span class="counter">${value}</span>` : label);
    el.innerHTML = `
      <div class="repo-header">
        <div class="repo-title-row">
          <div class="repo-name">
            ${icon('repo')}
            <span class="owner">${attr('owner', 'octocat')}</span><span class="slash">/</span><span class="repo">${attr('repo', 'Hello-World')}</span>
            <span class="visibility">${attr('visibility', 'Public')}</span>
          </div>
          <div class="repo-actions">
            <span class="gh-btn">${icon('eye')}${count('Watch', attr('watch', '1.2k'))}</span>
            <span class="gh-btn">${icon('fork')}${count('Fork', attr('fork', '2.1k'))}</span>
            <span class="gh-btn">${icon('star')}${count('Star', attr('star', '4.6k'))}</span>
          </div>
        </div>
        <nav class="repo-tabs">
          <span class="${tabClass('code')}">${icon('code')}Code</span>
          <span class="${tabClass('issues')}">${icon('issue')}Issues <span class="badge">${attr('issues', '12')}</span></span>
          <span class="${tabClass('pulls')}">${icon('pr')}Pull requests <span class="badge">${attr('pulls', '4')}</span></span>
        </nav>
      </div>`;
    el.querySelector('.repo-actions').prepend(...injected);
  });

  define('gh-file-view', (el, attr) => {
    const controls = takeSlot(el, 'controls');
    const code = el.innerHTML;
    const parts = attr('path', 'README.md').split('/');
    const file = parts.pop();
    const crumbs = [attr('repo', 'Hello-World'), ...parts].map((p) => `<span class="link">${p}</span><span class="sep">/</span>`).join('');
    const calloutText = attr('controls-callout');
    const callout = calloutText ? `<span class="callout ${attr('controls-callout-side', 'below')}">${calloutText}</span>` : '';
    el.innerHTML = `
      <div class="file-area">
        <div class="path-row">
          <div class="crumbs">${crumbs}<span class="current">${file}</span><span class="gh-btn">${icon('copy')}Copy path</span></div>
          <div class="path-row-right"><span class="gh-btn">Blame</span><span class="gh-btn icon-only">${icon('kebab')}</span></div>
        </div>
        <div class="file-band">
          <div class="commit-strip">
            <span class="avatar">${icon('mark')}</span>
            <b>${attr('author', 'octocat')}</b>
            <span class="msg">${attr('message', 'Update file')}</span>
            <span class="sha">${icon('check')}${attr('sha', '7f3c9d2')} · ${attr('age', '3 days ago')}</span>
          </div>
          <span class="callout-anchor block">
            <div class="controls">
              <div class="controls-row">
                <div class="segmented"><span class="on">Code</span><span>Blame</span></div>
                <span class="gh-btn">Raw</span>
                <span class="gh-btn icon-only">${icon('copy')}</span>
                <span class="gh-btn icon-only">${icon('download')}</span>
              </div>
              <div class="controls-meta">${attr('meta')}</div>
            </div>
            ${callout}
          </span>
        </div>
        <div class="blob-box">${codeLines(code)}</div>
      </div>`;
    el.querySelector('.controls-row').prepend(...controls);
    if (!attr('meta')) el.querySelector('.controls-meta').remove();
    if (attr('lang') === 'json') highlightJson(el.querySelector('.blob-box'));
  });

  define('gh-comment', (el, attr) => {
    const actions = takeSlot(el, 'actions');
    const body = Array.from(el.childNodes);
    const role = attr('role');
    el.innerHTML = `
      <div class="tl-comment">
        <span class="avatar">${icon('mark')}</span>
        <div class="tl-box">
          <div class="tl-head">
            <span><b>${attr('author', 'octocat')}</b> commented ${attr('age', '3 days ago')}</span>
            <span class="tl-head-right">
              ${role ? `<span class="tl-role">${role}</span>` : ''}
              <span class="tl-action">${icon('kebab')}</span>
            </span>
          </div>
          <div class="markdown-body"></div>
        </div>
      </div>`;
    el.querySelector('.tl-head-right .tl-action').before(...actions);
    el.querySelector('.markdown-body').append(...body);
  });
})();
