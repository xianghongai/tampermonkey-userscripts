# Hi, Jira

Jira 中点击字段文字不再进入编辑，只能点击编辑图标；Alt+L 添加链接。作者在 Jira v8.13.15 编写和使用，其它版本可能需要调整源码；使用前把 @match 换成 Jira 的真实地址。

- 生效页面：`@match` 指定的 Jira 页面
- 点击可编辑字段的文字（包括 Description）不再进入编辑
- 编辑图标、链接和图片照常可以点击
- 按 Alt+L 添加链接，macOS 上按 Option+L

## 使用前提

- 脚本默认的 `@match` 是占位地址 `jira.example.com`，使用前改成自己的 Jira 地址
