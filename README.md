# @arumie/question-user

`@arumie/question-user` is a Git-only pi package that gives the model a structured `question-user` tool instead of making it guess through important decisions. It opens a terminal questionnaire with typed options, custom answers, notes, previews, and support for RPC/ACP hosts.

> **Attribution:** This package is a fork of [`@juicesharp/rpiv-ask-user-question`](https://github.com/juicesharp/rpiv-mono/tree/main/packages/rpiv-ask-user-question), created and maintained by [Sergii Guslystyi (`juicesharp`)](https://github.com/juicesharp). The first version preserves the upstream questionnaire behavior while adapting the package metadata, tool name, English-only UI, and repository documentation. Thanks to the original author for the excellent work. The original MIT license and copyright notice are retained.

## Install

This package is intentionally distributed from Git rather than npm:

```sh
pi install git:github.com/arumie/pi-question-user
```

The `question-user` tool name is intentionally different from the upstream `ask_user_question` tool, so both packages can be installed while testing.

Restart pi (or run `/reload`) after installing. Confirm the package is registered with `pi list`.

For checkout development, load the local package directory:

```sh
pi -e /absolute/path/to/pi-question-user
```

## What it does

- Presents up to four questions in one tabbed dialog, with 2–4 authored options per question.
- Appends a `Type something.` row so the user can always answer in their own words; in multi-select mode, non-blank custom text is selected alongside checked options.
- Supports markdown previews, multiline answers, external-editor input, and per-question or global notes.
- Returns structured answers to the model and works in terminal, RPC, and ACP hosts.
- Removes the tool from non-interactive runs instead of failing every call.

The terminal dialog uses `↑`/`↓` to browse, `Enter` to select, `Tab` to move between questions, `n` to add a note, `Ctrl+]` to collapse the dialog, and `Esc` to cancel. In a multi-select question, type in `Type something.` and the non-blank text is checked and submitted with the authored selections. `Shift+Enter`, `Ctrl+G`, and `Ctrl+U` control multiline input, the external editor, and draft clearing respectively.

## Configuration

Optional settings live in `~/.config/question-user/config.json`; the file is read but never written.

| Setting | What it does | Default |
| --- | --- | --- |
| `collapseKey` | Key that collapses and expands the dialog. Use a Pi keybinding id such as `alt+o`; set it to `off` to disable the shortcut. | `ctrl+]` |
| `guidance.description` | Replaces the complete tool description shown to the model when set to a non-empty string. | Built-in description |
| `guidance.promptSnippet` | Replaces the one-line tool description in the system prompt. | Built-in snippet |
| `guidance.promptGuidelines` | Replaces the built-in usage guidelines supplied to the model. | Four built-in guidelines |

Example:

```json
{ "collapseKey": "alt+o" }
```

Malformed JSON or unusable individual values fall back to the defaults with no hard failure.

The dialog UI is intentionally English-only and has no localization dependency.

## Requirements

- Node.js 22 or newer.
- Pi Agent with an interactive terminal or an RPC/ACP host.
- No native dependencies, compiler, API keys, or model calls of its own.

## Development and validation

```sh
npm install
npm run release:check
```

The package manifest test verifies the Git-installable extension entry point and the packaged runtime files. The type check covers the copied runtime implementation.

## License

[MIT](LICENSE), with the original upstream copyright notice retained. See the [upstream package](https://github.com/juicesharp/rpiv-mono/tree/main/packages/rpiv-ask-user-question) for the source project and its history.
