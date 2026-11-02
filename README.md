# OpenCode Usage Dashboard

A lightweight local web dashboard for **OpenCode V2** that shows token usage, model costs, tool performance, and per-request session context in your browser.

## Quick Start

Add the plugin to your `opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": ["github:createOne999/opencode-usage-webui#release"]
}
```

Then run **`/usage-dashboard`** inside OpenCode, or open <http://127.0.0.1:7331/stats> directly.

### Customizing the Port

The default port is `7331`. Set `options.port` to use a different port (`0` picks any available port):

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": [
    { "package": "github:createOne999/opencode-usage-webui#release", "options": { "port": 7332 } }
  ]
}
```

## Documentation & Source

Full multilingual documentation and source development instructions are on the [`main` branch](https://github.com/createOne999/opencode-usage-webui/tree/main).

## License

[MIT](./LICENSE)
