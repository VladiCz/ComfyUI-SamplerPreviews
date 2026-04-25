"""ComfyUI-SamplerPreviews custom node entrypoint.

This extension is currently frontend-only. The Python module exports the web
directory so ComfyUI can load the JavaScript settings integration.
"""

NODE_CLASS_MAPPINGS = {}
NODE_DISPLAY_NAME_MAPPINGS = {}
WEB_DIRECTORY = "./web"

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]
