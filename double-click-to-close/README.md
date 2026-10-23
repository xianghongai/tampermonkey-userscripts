# Double-click to Close

按住 Shift 双击页面，即可关闭当前标签页，不用再去找标签页上的关闭按钮。

- 生效页面：所有网站，Figma 设计文件、XMind 等在线编辑器除外
- 只有按住 Shift 的双击才会关闭，普通双击照常选中文字
- 双击链接、输入框、可编辑区域时不会关闭

## 排除网站

需要在某个网站上停用时，可以把它加入排除列表，脚本更新后仍然保留。

1. 打开 Tampermonkey 管理面板，进入本脚本的编辑页，切换到「存储」页。看不到该页时，先在 Tampermonkey 设置里把「配置模式」改为「高级」。
2. 编辑 `exclude` 的值并保存，例如：

```json
["example.com", "example.org/editor"]
```

- `example.com`：该域名及其子域名
- `example.org/editor`：该域名下 `/editor` 及其下级页面
