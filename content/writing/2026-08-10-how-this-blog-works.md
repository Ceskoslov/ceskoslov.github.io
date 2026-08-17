+++
title = "How This Blog Works"
date = 2026-08-10
description = "From Markdown to GitHub Pages."

[taxonomies]
tags = ["Zola", "Markdown", "Tech"]
+++

This blog is built with [Zola](https://www.getzola.org/), a static site generator written in Rust.

## Article Structure

Create a Markdown file in `content/writing` and add TOML front matter at the beginning:

```toml
+++
title = "Post Title"
date = 2026-08-10
description = "A summary shown on the homepage and in search results."

[taxonomies]
tags = ["Technology", "Notes"]
+++
```

After the closing `+++`, you can use standard Markdown. Headings, lists, quotes, code blocks, tables, and images all share the theme's styling.

## Publishing

After making changes, commit and push to GitHub:

```bash
git add .
git commit -m "Add a new post"
git push
```

GitHub Actions will automatically build and update GitHub Pages using Zola, without needing to export HTML or depend on Ruby.

More information about local previews, drafts, and images is available in the repository's `README.md`.
