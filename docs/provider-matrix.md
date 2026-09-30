# Provider submission matrix

Status here describes a documented submission path, not installation, review,
approval, or publication. Sources were checked on 2026-09-30.

| Provider | Package route | Automation in this repository | Current status | Official source |
| --- | --- | --- | --- | --- |
| ChatGPT / OpenAI | Upload the ZIP in the Plugins dashboard, configure MCP and reviewer information, then submit for review | Release assets and a handoff are generated; portal submission remains manual | `manual_required` | [OpenAI plugin submission](https://developers.openai.com/plugins/deploy/submission) |
| Claude / Anthropic | Publish the plugin bundle, then submit the separate directory entry through the developer portal | CLI/package validation and a handoff are generated; portal submission remains manual | `manual_required` | [Claude plugin publishing](https://code.claude.com/docs/en/plugins/publish), [Claude directory publishing](https://claude.com/docs/directory/publish) |
| Grok / xAI | Contribute a SHA-pinned remote plugin entry by pull request to the official catalog | A protected manual job can update a fork, run the catalog's own generators/validator, and open or reuse a PR | `pull_request_supported` | [xAI plugin marketplace](https://github.com/xai-org/plugin-marketplace) |
| Meta / Muse Spark | No compatible plugin-directory submission path was verified from the official material reviewed | Release handoff only; no submission call | `unverified`, `manual_required` | [Meta Business Agent documentation](https://developers.facebook.com/documentation/meta-business-agent/llms.txt) |

The Meta source covers Business Agent APIs and custom connectors for eligible
WhatsApp businesses. It is a different product surface from a general agent
plugin directory. The status should be revisited if Meta publishes a compatible
official program or API.

Public MCP discovery and an optional authenticated tool-catalog scan do not run
the declared reviewer cases, verify the consent UI, or prove approval. Every
release handoff keeps those facts false until human evidence exists.
