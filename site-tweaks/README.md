# Site Tweaks

按规则为网页添加自定义样式，调整显示效果，可针对所有网站、某个域名或某个路径。

- 生效页面：所有网站，具体样式只在规则命中的网站或路径上生效
- 为部分页面内置样式调整，无需设置
- 为任意网站、域名或路径添加自己的样式规则

## 使用方法

1. 安装后，在 Tampermonkey 编辑器中把脚本改名为自己容易识别的名字，例如「我的网页微调」。改名后这就是你自己的副本，不再跟随 Greasy Fork 版本，更新时不会覆盖你的修改。
2. 在编辑器中修改 `RULES`，按你平时浏览的网站添加规则。键是生效范围，值是要添加的 CSS：

```js
const RULES = {
  'example.com': '.sidebar { display: none; }',
  'example.com/docs': 'main { max-width: none; }',
};
```

- `*`：所有网站
- `example.com`：该域名及其子域名
- `example.com/docs`：该域名下 `/docs` 及其下级页面
