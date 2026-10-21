# Gist: Download Commands

在 Gist 页面一键复制下载某个文件的命令，粘贴到终端即可执行。

- 生效页面：`gist.github.com` 上的 Gist 详情页
- 每个文件名右侧新增两个按钮：
  - **gh**：复制 GitHub CLI 命令 `gh gist view ... --raw > `，`>` 后留空，粘贴后借助 Shell 补全填写本机路径
  - **curl**：复制 curl 命令，`-o` 后同样留空；私有（Secret）Gist 的命令通过 GitHub API 下载
- 复制时按钮显示加载中、成功或失败；失败时鼠标悬停可查看原因
- Gist 中带有清单 `.manifest.json` 时，命令直接写入清单为当前系统声明的路径，缺少的目录一并创建
- 清单为多个系统分别声明路径时，点击按钮会在上方弹出列表，列出各系统的路径并标出当前系统，点击每项右侧的复制图标复制对应的命令

## 清单 `.manifest.json`

在 Gist 中添加名为 `.manifest.json` 的文件，为文件声明本机路径。格式与 [Cairn](https://github.com/xianghongai/cairn) 的清单相同，这里只用到条目的 `remote` 与 `path`，其他字段不影响生成的命令。

```json
{
  "entries": {
    "settings.json": {
      "path": "~/.config/example/settings.json"
    },
    "app-keys": {
      "remote": "app-keys.conf",
      "path": {
        "default": "~/.config/example/",
        "macos": "~/Library/Application Support/Example/"
      }
    }
  }
}
```

- `entries` 的键是条目名，值描述 Gist 中的一个文件。
- `remote`：Gist 中的文件名，省略时取条目名。
- `path`：本机路径，规则如下：
  - 字符串适用于所有系统；对象按 `linux`、`macos`、`windows` 为各系统分别指定，当前系统没有对应的键时取 `default`，两者都没有时不填路径。
  - `~` 表示 Home 目录；以 `/` 结尾的路径是目录，文件以 Gist 中的文件名写入其中。

## 私有 Gist 的 curl 命令

私有 Gist 的 curl 命令从环境变量 `GIST_ONLY_GITHUB_ACCESS_TOKEN` 读取 Token，并需要安装 `jq`。

1. 在 GitHub [创建 Token](https://github.com/settings/tokens/new?scopes=gist&description=Gist%20download)，勾选 `gist` 权限。
2. 在 Shell 配置中加入 `export GIST_ONLY_GITHUB_ACCESS_TOKEN=<token>`。

`gh` 命令使用 GitHub CLI 自身的登录状态，无需另外设置。
