# Changelog

All notable changes to `@arumie/question-user` are documented here.

## 1.0.0-alpha.1 — 2026-09-11

- Include non-blank custom text from a multi-select `Type something.` row alongside checked options.
- Show the custom multi-select row as checked while it contains a non-blank draft.
- Keep RPC multi-select custom answers aligned with the terminal UI.
- Add regression coverage for custom multi-select selection behavior.

## 1.0.0-alpha — 2026-09-11

- Initial Git-installable fork of `@juicesharp/rpiv-ask-user-question`.
- Use the `question-user` tool name so the fork can run alongside the upstream package.
- Keep the runtime UI English-only without a localization dependency.
