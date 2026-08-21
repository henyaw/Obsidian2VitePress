# Obsidian2VitePress

A local VitePress plugin that converts and imports Obsidian vault notes into VitePress-compatible Markdown.

## Features

- **Multi-Vault Support:** Import notes from multiple Obsidian vaults simultaneously.
- **VitePress Route Generation:** Automatic path mapping for generated Markdown files.
- **Selective Publishing (`filterByPublished`):** Only process notes marked with `published: true` in frontmatter.
- **Custom Folder Hierarchy (`useParentProperty`):** Override directory structures using the `parent` frontmatter property.
- **Ordered Filenames (`useOrderProperty`):** Prefix filenames and routes using a numerical `order` frontmatter property.
- **Homepage Routing (`useHomeRewrite`):** Automatically rewrite notes with `layout: home` to `index.md`.
- **Wikilink Resolution:** Parse standard `[[Wikilinks]]` and handle links to uncreated notes seamlessly.
- **Backlink Generation:** Append backlink lists automatically to referenced target pages.
- **Callout Support:** Convert Obsidian `> [!NOTE]` callout syntax into standard VitePress custom containers.

## Usage

```js
// docs/.vitepress/config.js
import { defineConfig } from 'vitepress'
import { obsidian2vitepress } from '../../src/index.js'

export default defineConfig({
  vite: {
    plugins: [
      obsidian2vitepress({
        vaults: [
          {
            name: 'main',
            root: '../vault',
            routeBase: '/'
          }
        ],
        outDir: 'docs/generated',
        brokenLinks: 'route',
        // Optional feature flags
        filterByPublished: true,  // Include only notes where `published: true`
        useParentProperty: true,  // Route files based on `parent:` frontmatter
        useOrderProperty: true,   // Prefix file slugs with numerical `order:` frontmatter
        useHomeRewrite: true     // Save notes with `layout: home` as `index.md`
      })
    ]
  }
})