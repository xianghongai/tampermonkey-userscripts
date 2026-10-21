// 在目标页面中找出侧栏导航的候选容器，并打印最可能的那个的结构。
// 用法：Chrome DevTools MCP 的 evaluate_script，sourcePath 指向本文件。
// 会穿透 Shadow DOM 查找，只看页面上实际显示的元素：有的网站另有一份不显示的导航副本。
() => {
  const roots = [document];
  for (let i = 0; i < roots.length; i++) {
    for (const el of roots[i].querySelectorAll('*')) if (el.shadowRoot) roots.push(el.shadowRoot);
  }
  const visible = (el) => {
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };
  const name = (el) => el.tagName + [...el.classList].map((c) => `.${c}`).join('') + (el.shadowRoot ? '[shadowRoot]' : '');
  const where = (el) => {
    const host = el.getRootNode().host;
    return host ? ` (in shadowRoot of ${host.tagName})` : '';
  };
  const candidates = roots
    .flatMap((root) => [...root.querySelectorAll('nav, aside, ul, [class*=menu], [class*=nav], [class*=side]')])
    .filter(visible)
    .map((el) => [el, el.querySelectorAll('a').length])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
  // 只展开每层的前几个子元素，足够看出分组、标题与导航项的写法
  const tree = (el, depth = 0) => depth > 5 ? '' : [...el.children].slice(0, 3).map((child) => {
    const text = child.children.length ? '' : ` "${child.textContent.trim().slice(0, 20)}"`;
    return `${'  '.repeat(depth)}${name(child)}${text}\n${tree(child, depth + 1)}`;
  }).join('');
  const [best] = candidates[0] ?? [];
  return {
    url: location.href,
    shadowRoots: roots.length - 1,
    candidates: candidates.map(([el, n]) => `${name(el)} links=${n}${where(el)}`),
    tree: best && tree(best),
  };
}
