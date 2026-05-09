import { buildSite } from '../core/buildSite.js'

export function obsidian2vitepress(config) {
  return {
    name: 'obsidian2vitepress',
    enforce: 'pre',
    async buildStart() {
      await buildSite(config)
    },
    configureServer(server) {
      const roots = config.vaults.map((vault) => vault.root)

      for (const root of roots) {
        server.watcher.add(root)
      }

      const rebuild = async (file) => {
        if (!file.endsWith('.md')) return
        await buildSite(config)
        server.moduleGraph.invalidateAll()
        server.ws.send({ type: 'full-reload' })
      }

      server.watcher.on('add', rebuild)
      server.watcher.on('change', rebuild)
      server.watcher.on('unlink', rebuild)
    }
  }
}
