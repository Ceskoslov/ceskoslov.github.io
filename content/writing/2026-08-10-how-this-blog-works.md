+++
title = "How This Blog Works"
date = 2026-08-17
description = "From Markdown to GitHub Pages."

[taxonomies]
tags = ["Zola", "Markdown", "Tech"]
+++

This blog is built with [Zola](https://www.getzola.org/), a static site generator written in Rust.

## Article Structure

In the `content/writing` directory, create a new Markdown file and write a TOML Front Matter at the beginning:

```toml
+++
title = "文章标题"
date = 2026-08-10
description = "显示在首页和搜索结果中的摘要。"

[taxonomies]
tags = ["技术", "笔记"]
+++
```

From the second `+++` after the TOML Front Matter, you can use regular Markdown. Headings, lists, quotes, code blocks, tables, and images will all have the theme's consistent styling.

## Publishing

After making changes, commit and push to GitHub:

```bash
git add .
git commit -m "Add a new post"
git push
```

GitHub Actions will automatically build and update GitHub Pages using Zola, without needing to export HTML or depend on Ruby.

More local preview, draft, and image usage methods are documented in the repository's `README.md`.
