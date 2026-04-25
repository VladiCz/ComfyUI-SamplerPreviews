# ComfyUI Sampler Previews

## Quick Summary

ComfyUI Sampler Previews is a frontend-only ComfyUI extension that shows a live
sampler preview window during execution. It can run as a floating in-app panel
or as a detached popup window.

## Settings Summary

- Setting path:
  `Sampler Previews -> Preview Window -> Enable sampler preview window`
- Setting type: `boolean`
- Default value: `true` (preview window opens automatically)
- Behavior:
  - `true`: preview window is enabled and opens automatically
  - `false`: preview window is disabled and kept closed

## Current scope

- Registers a frontend extension through `WEB_DIRECTORY = "./web"`.
- Adds a ComfyUI boolean setting for enabling or disabling the sampler preview
  window.
- Implements sampler preview UI logic in JavaScript inside the `web` directory.
- Keeps the package backend-free (no Python node classes yet).

## Setting location

After restarting ComfyUI, open Settings and look for:

- `Sampler Previews` -> `Preview Window` -> `Enable sampler preview window`

## Files

- `__init__.py`: ComfyUI extension entrypoint.
- `web/settings.js`: Registers the setting and exposes helpers/events for the
  preview-window enabled state.
- `web/sampler_previews.js`: Implements the sampler preview window UI and
  runtime behavior.
