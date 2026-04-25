import { app } from "../../scripts/app.js";

export const SAMPLER_PREVIEW_ENABLED_SETTING_ID =
    "samplerPreviews.previewWindow.enabled";
export const SAMPLER_PREVIEW_SETTING_CHANGED_EVENT =
    "samplerPreviews:previewWindowEnabledChanged";

export function isSamplerPreviewWindowEnabled() {
    const value = app.extensionManager?.setting?.get(
        SAMPLER_PREVIEW_ENABLED_SETTING_ID,
    );
    if (value === undefined || value === null) {
        return true;
    }
    return Boolean(value);
}

app.registerExtension({
    name: "comfyui-sampler-previews.settings",
    settings: [
        {
            id: SAMPLER_PREVIEW_ENABLED_SETTING_ID,
            category: [
                "Sampler Previews",
                "Preview Window",
                "Enable sampler preview window",
            ],
            name: "Enable sampler preview window",
            tooltip:
                "Turns the sampler preview window integration on or off for this ComfyUI client.",
            type: "boolean",
            defaultValue: true,
            onChange: (newValue, oldValue) => {
                if (newValue === oldValue) {
                    return;
                }

                window.dispatchEvent(
                    new CustomEvent(SAMPLER_PREVIEW_SETTING_CHANGED_EVENT, {
                        detail: { enabled: Boolean(newValue) },
                    }),
                );

                console.info(
                    `[SamplerPreviews] Preview window ${
                        newValue ? "enabled" : "disabled"
                    }.`,
                );
            },
        },
    ],
});
