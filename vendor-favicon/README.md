# Vendor Favicon

内网或私有部署的 Jira、Confluence、Axhub，常把原厂图标换成公司图标，标签页一多就分不清哪个是哪个。这个脚本把它们的标签页图标换回原厂图标。

自用脚本，只放在仓库中，不发布到 Greasy Fork。

- 生效页面：脚本 `@match` 中列出的地址
- 图标内置在脚本中，内网无法访问外部网络时同样可用
- 页面之后再改回自己的图标时，自动换回原厂图标

## 使用前

脚本中的地址是占位地址，安装后在 Tampermonkey 编辑器里换成真实地址：

1. 把 `@match` 中的 `jira.example.com`、`wiki.example.com`、`axhub.example.com` 换成真实的内网域名。
2. 脚本按域名中是否包含 `jira.`、`wiki.`、`axhub.` 选择图标。真实域名不含这些词时，同时修改脚本开头规则中的关键词。
