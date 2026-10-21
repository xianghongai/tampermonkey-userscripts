// 把工作区的脚本注入目标页面，打开看板，读出可由程序判断的结果，再关掉看板。
// 本文件不能直接运行，先用下面的命令把脚本本体拼进函数体中的占位行，输出到临时目录：
//   awk 'FNR==NR { if (/^console\.log\(GM_info/) on = 1; if (on) body = body $0 "\n"; next } /^ *\/\/ @@SCRIPT@@$/ { printf "%s", body; next } 1' \
//     nav-dashboard/nav-dashboard.user.js nav-dashboard/docs/site-adaptation/verify-board.js > <scratchpad>/verify.js
// 再用 Chrome DevTools MCP 的 evaluate_script 执行，sourcePath 指向生成的文件。
// 注入的脚本会留下快捷键监听，验证完重新加载页面即可清除。
// 页面上已经装了导航看板时，结果里的 preinstalled 大于 0，注入的这份与之并存，判断结果时留意。
async () => {
  const GM_info = { script: { name: 'nav-dashboard-verify' } };
  const preinstalled = document.querySelectorAll('user-script-nav-dashboard').length;

  // @@SCRIPT@@

  const hosts = document.querySelectorAll('user-script-nav-dashboard');
  const host = hosts[hosts.length - 1];
  host.shadowRoot.querySelector('.toggle').click();
  await new Promise((resolve) => setTimeout(resolve, 300));

  const roots = [document];
  for (let i = 0; i < roots.length; i++) {
    for (const el of roots[i].querySelectorAll('*')) if (el.shadowRoot) roots.push(el.shadowRoot);
  }
  const scroller = roots.map((root) => root.querySelector('user-script-nav-dashboard-board')).find(Boolean);
  const result = { url: location.href, preinstalled, total: host.shadowRoot.querySelector('.total').textContent };
  if (scroller) {
    const board = scroller.querySelector('[data-user-script-nav-dashboard-board]');
    const items = [...board.querySelectorAll('[data-user-script-nav-dashboard-item]')];
    const rect = scroller.getBoundingClientRect();
    // 某点最上层的元素，逐层进入 Shadow DOM
    const topAt = (x, y) => {
      let el = document.elementFromPoint(x, y);
      while (el?.shadowRoot) {
        const inner = el.shadowRoot.elementFromPoint(x, y);
        if (!inner || inner === el) break;
        el = inner;
      }
      return el;
    };
    Object.assign(result, {
      inShadow: scroller.getRootNode() !== document,
      viewport: [innerWidth, innerHeight],
      scroller: [rect.x, rect.y, rect.width, rect.height].map(Math.round),
      // 左上、中间、右下三点都应被看板盖住，否则是被网站的其他层压住了
      covered: [[10, 10], [innerWidth / 2, innerHeight / 2], [innerWidth - 60, innerHeight - 10]]
        .map(([x, y]) => scroller.contains(topAt(x, y))),
      columns: new Set(items.map((item) => Math.round(item.getBoundingClientRect().left))).size,
      // 折叠的子菜单没有撑开时，这里会大于 0
      hiddenItems: items.filter((item) => item.getBoundingClientRect().height === 0 || getComputedStyle(item).visibility !== 'visible').length,
      breaks: board.querySelectorAll('[data-user-script-nav-dashboard-break]').length,
      titles: [...board.querySelectorAll('[data-user-script-nav-dashboard-title]')].map((el) => el.textContent.replace(/\s+/g, ' ').trim()),
    });
  }
  host.shadowRoot.querySelector('.close').click();
  host.remove();
  return result;
}
