+++
title = "这个博客是怎样工作的"
date = 2026-08-10
description = "从一份 Markdown 文件，到 GitHub Pages 上的一篇文章。"

[taxonomies]
tags = ["Zola", "Markdown", "技术"]
+++

这个网站由 Rust 编写的静态站点生成器 Zola 构建，并托管在 GitHub Pages。它没有数据库：每篇文章都是仓库里的一个 Markdown 文件。

## 一篇文章的结构

在 `content/writing` 目录新建 Markdown 文件，并在开头写一段 TOML Front Matter：

```toml
+++
title = "文章标题"
date = 2026-08-10
description = "显示在首页和搜索结果中的摘要。"

[taxonomies]
tags = ["技术", "笔记"]
+++
```

从第二个 `+++` 之后开始，就可以使用普通 Markdown。标题、列表、引用、代码块、表格和图片都会获得与主题一致的样式。

## 发布流程

修改完成后提交并推送到 GitHub：

```bash
git add .
git commit -m "Add a new post"
git push
```

GitHub Actions 会调用 Zola 自动构建并更新 GitHub Pages，无需手动导出 HTML，也不依赖 Ruby 环境。

更多本地预览、草稿和图片使用方法，都记录在仓库的 `README.md` 中。
