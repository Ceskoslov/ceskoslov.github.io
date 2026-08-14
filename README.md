# Chaos

一个简洁、响应式、可直接部署到 GitHub Pages 的个人博客。使用 Rust 编写的 [Zola](https://www.getzola.org/) 生成静态页面，不依赖 Ruby、数据库或前端框架。

主题在克制的网格中加入少量错位与噪声，以视觉化表达「Chaos」，同时把阅读体验放在首位。

## 已包含

- Zola + Tera 模板，构建快速且仅需一个二进制文件
- Markdown 文章、草稿、代码高亮和 TOML Front Matter
- 首页、文章详情、归档、标签、关于和 404 页面
- Atom Feed、Sitemap、robots.txt 与社交分享元信息
- 响应式导航、深浅色模式、打印样式和减少动态效果支持
- GitHub Actions 自动构建并部署到 Pages
- 不依赖第三方字体或前端 JavaScript 框架

## 安装 Zola

当前 WSL 已有 Rust 和 Cargo，可以直接安装：

```bash
cargo install --locked --git https://github.com/getzola/zola
```

也可以从 [Zola Releases](https://github.com/getzola/zola/releases) 下载预编译二进制，或在 Ubuntu/WSL 使用 snap：

```bash
sudo snap install zola --edge
```

确认安装：

```bash
zola --version
```

## 本地预览

```bash
zola serve
```

浏览器打开 `http://127.0.0.1:1111`。保存 Markdown、模板或 CSS 后，页面会自动刷新。

包含草稿一起预览：

```bash
zola serve --drafts
```

正式构建检查：

```bash
zola check
zola build
```

生成的网站位于 `public/`，该目录已被 Git 忽略。

## 写一篇文章

在 `content/writing/` 中创建 Markdown 文件。推荐文件名使用日期和英文或拼音，例如 `2026-08-14-my-new-post.md`：

````markdown
+++
title = "文章标题"
date = 2026-08-14
description = "一句话摘要，会显示在首页和搜索结果中。"

[taxonomies]
tags = ["技术", "笔记"]
+++

这里开始写正文。

## 二级标题

支持标准 Markdown、表格和代码高亮。

```rust
fn main() {
    println!("hello, chaos");
}
```
````

文章日期决定排序。草稿加入 `draft = true`，正式构建时就不会发布；仓库内的 `content/writing/draft-template.md` 可以直接复制使用。

### 插入图片

将图片放入 `static/assets/images/posts/`，在文章中使用：

```markdown
![图片说明](/assets/images/posts/example.jpg)
```

## 部署到 GitHub Pages

仓库已经包含 `.github/workflows/pages.yml`。首次部署前：

1. 打开 GitHub 仓库的 **Settings → Pages**。
2. 将 **Build and deployment → Source** 设为 **GitHub Actions**。
3. 提交并推送到 `main` 分支。

Actions 会安装 Zola、执行构建并部署 `public/`。仓库名为 `ceskoslov.github.io` 时，站点地址是 `https://ceskoslov.github.io`。

如果默认分支不是 `main`，修改工作流中的 `branches`；如果更换 GitHub 用户名，修改 `zola.toml` 中的 `base_url`、`author` 和 `github_username`。

## 个性化

站点信息在 `zola.toml`，个人介绍在 `content/about.md`，主题变量位于 `static/assets/css/style.css` 顶部：

```css
:root {
  --paper: #f2f0e9;
  --ink: #171714;
  --accent: #e35b36;
}
```

示例文章可以直接修改或删除。

## 目录结构

```text
.
├── .github/workflows/   # GitHub Pages 自动部署
├── content/
│   ├── writing/         # Markdown 文章与草稿
│   ├── about.md         # 关于页
│   └── archive.md       # 归档页
├── static/              # CSS、JavaScript 和图片
├── templates/           # Tera 页面模板
└── zola.toml            # Zola 站点配置
```
