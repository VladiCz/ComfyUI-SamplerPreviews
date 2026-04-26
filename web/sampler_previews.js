import { app } from "../../scripts/app.js";
import {
    isSamplerPreviewWindowEnabled,
    SAMPLER_PREVIEW_SETTING_CHANGED_EVENT,
} from "./settings.js";

app.registerExtension({
    name: "live.sampler.preview.ux",

    setup() {
        const ENABLE_BUFFER = false;
        const BUFFER_FPS = 8;

        const previews = new Map();
        let activeNodeId = null;
        let popupWindow = null;
        let popupWrap = null;
        let previewEnabled = isSamplerPreviewWindowEnabled();

        let viewMode = localStorage.getItem("sampler_monitor_view_mode") || "grid";
        // "grid" | "active"

        const STORAGE_KEY = "sampler_monitor_window_state_v1";
        const POPUP_STATE_KEY = "sampler_monitor_popup_state_v1";

        const FLOATING_STYLE = {
            position: "fixed",
            top: "20px",
            left: "20px",
            width: "380px",
            height: "520px",
            maxHeight: "80vh",
            overflow: "hidden",
            background: "rgba(0,0,0,0.92)",
            border: "1px solid #444",
            zIndex: "9999",
            resize: "both",
            display: "flex",
            flexDirection: "column",
            color: "#ccc",
            fontFamily: "sans-serif",
            boxSizing: "border-box"
        };

        const DETACHED_STYLE = {
            position: "relative",
            top: "0px",
            left: "0px",
            width: "100%",
            height: "100%",
            maxHeight: "none",
            overflow: "hidden",
            background: "rgba(0,0,0,0.92)",
            border: "none",
            zIndex: "",
            resize: "none",
            display: "flex",
            flexDirection: "column",
            color: "#ccc",
            fontFamily: "sans-serif",
            boxSizing: "border-box"
        };

        function applyStyle(el, styleObj) {
            Object.assign(el.style, styleObj);
        }

        const win = document.createElement("div");
        applyStyle(win, FLOATING_STYLE);

        applySavedWindowState();

        function hidePreviewWindow() {
            if (popupWindow && !popupWindow.closed) {
                popupWindow.onbeforeunload = null;
                savePopupState();
                popupWindow.close();
            }

            popupWindow = null;
            popupWrap = null;

            if (win.parentElement) {
                win.parentElement.removeChild(win);
            }
        }

        function showPreviewWindow() {
            const popup = getOrCreatePopup();

            if (popup && popup.document.body.childNodes.length > 0) {
                // Reuse the popup if it already exists.
                mountWinIntoPopup(popup);
                return;
            }

            if (!document.body.contains(win)) {
                document.body.appendChild(win);
            }
        }

        function applyPreviewEnabledState() {
            if (previewEnabled) {
                showPreviewWindow();
                return;
            }

            hidePreviewWindow();
        }

        applyPreviewEnabledState();

        const resizeObserver = new ResizeObserver(() => {
            saveWindowState();
            updateLayout();
        });

        resizeObserver.observe(win);

        const header = document.createElement("div");
        Object.assign(header.style, {
            height: "28px",
            background: "#1a1a1a",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 8px",
            cursor: "grab",
            userSelect: "none",
            flexShrink: "0"
        });
        header.innerHTML = `<span>Sampler Monitor</span>`;

        const controls = document.createElement("div");
        Object.assign(controls.style, {
            display: "flex",
            alignItems: "center",
            gap: "6px"
        });

        const viewBtn = document.createElement("button");
        Object.assign(viewBtn.style, {
            background: "none",
            color: "#ccc",
            border: "none",
            cursor: "pointer",
            fontSize: "14px",
            lineHeight: "1"
        });

        const detachBtn = document.createElement("button");
        detachBtn.textContent = "⧉";
        Object.assign(detachBtn.style, {
            background: "none",
            color: "#ccc",
            border: "none",
            cursor: "pointer"
        });

        function updateViewButton() {
            // ▦ = grid, ● = focus on the active sampler
            viewBtn.textContent = viewMode === "grid" ? "▣" : "●";
            viewBtn.title = viewMode === "grid"
                ? "Switch to showing only the active sampler"
                : "Switch to a grid of all samplers";
        }

        updateViewButton();

        controls.appendChild(viewBtn);
        controls.appendChild(detachBtn);
        header.appendChild(controls);

        win.appendChild(header);

        const content = document.createElement("div");
        Object.assign(content.style, {
            flex: "1",
            minHeight: "0",
            overflow: "hidden",
            padding: "6px",
            display: "grid",
            gap: "10px",
            alignItems: "stretch",
            justifyItems: "stretch",
            boxSizing: "border-box"
        });
        win.appendChild(content);

        function loadPopupState() {
            try {
                const raw = localStorage.getItem(POPUP_STATE_KEY);
                if (!raw) return null;
                return JSON.parse(raw);
            } catch {
                return null;
            }
        }

        function savePopupState() {
            if (!popupWindow || popupWindow.closed) return;

            localStorage.setItem(POPUP_STATE_KEY, JSON.stringify({
                left: popupWindow.screenLeft ?? popupWindow.screenX,
                top: popupWindow.screenTop ?? popupWindow.screenY,
                width: popupWindow.outerWidth,
                height: popupWindow.outerHeight,
            }));

            console.log( {
                functionName: "savePopupState()",
                left: popupWindow.screenLeft ?? popupWindow.screenX,
                top: popupWindow.screenTop ?? popupWindow.screenY,
                width: popupWindow.outerWidth,
                height: popupWindow.outerHeight} );
        }

        function getPopupFeatures() {
            const state = loadPopupState();

            const width = state?.width ?? 500;
            const height = state?.height ?? 700;
            const left = state?.left ?? 100;
            const top = state?.top ?? 100;

            return `width=${width},height=${height},left=${left},top=${top},resizable=yes`;
        }

        function getOrCreatePopup() {
            console.log( getPopupFeatures() );

            const popup = window.open("", "SamplerMonitor", getPopupFeatures());
            if (!popup || popup.closed) return null;
            return popup;
        }

        function attachPopupStateListeners() {
            if (!popupWindow || popupWindow.closed) return;

            const save = () => savePopupState();

            popupWindow.addEventListener("resize", save);
            popupWindow.addEventListener("move", save);
            popupWindow.addEventListener("beforeunload", save);

            if (popupWindow.__samplerMonitorStateTimer) {
                clearInterval(popupWindow.__samplerMonitorStateTimer);
            }

            /*
            popupWindow.__samplerMonitorStateTimer = setInterval(() => {
                if (!popupWindow || popupWindow.closed) return;
                savePopupState();
            }, 1000);*/
        }

        function mountWinIntoPopup(targetWindow) {
            if (!targetWindow || targetWindow.closed) return false;

            const doc = targetWindow.document;

            doc.body.style.margin = "0";
            doc.body.style.overflow = "hidden";
            doc.body.style.background = "#111";

            let wrap = doc.getElementById("sampler-monitor-popup-wrap");
            if (!wrap) {
                wrap = doc.createElement("div");
                wrap.id = "sampler-monitor-popup-wrap";

                Object.assign(wrap.style, {
                    position: "fixed",
                    inset: "0",
                    width: "100vw",
                    height: "100vh",
                    overflow: "hidden",
                    display: "block"
                });

                doc.body.innerHTML = "";
                doc.body.appendChild(wrap);
            } else {
                wrap.innerHTML = "";
            }

            applyStyle(win, DETACHED_STYLE);
            wrap.appendChild(win);

            popupWindow = targetWindow;
            popupWrap = wrap;

            attachPopupStateListeners();
            savePopupState();

            popupWindow.onbeforeunload = () => {
                savePopupState();
                setTimeout(() => {
                    restoreFloatingWindow();
                }, 0);
            };

            return true;
        }

        function loadWindowState() {
            try {
                const raw = localStorage.getItem(STORAGE_KEY);
                if (!raw) return null;
                return JSON.parse(raw);
            } catch {
                return null;
            }
        }

        function saveWindowState() {
            if (popupWindow && !popupWindow.closed) return;

            const rect = win.getBoundingClientRect();

            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                left: win.style.left || `${rect.left}px`,
                top: win.style.top || `${rect.top}px`,
                width: win.style.width || `${rect.width}px`,
                height: win.style.height || `${rect.height}px`,
            }));
        }

        function applySavedWindowState() {
            const state = loadWindowState();
            if (!state) return;

            if (state.left) win.style.left = state.left;
            if (state.top) win.style.top = state.top;
            if (state.width) win.style.width = state.width;
            if (state.height) win.style.height = state.height;
        }

        function restoreFloatingWindow() {
            if (popupWindow && !popupWindow.closed) {
                savePopupState();

                if (popupWindow.__samplerMonitorStateTimer) {
                    clearInterval(popupWindow.__samplerMonitorStateTimer);
                    popupWindow.__samplerMonitorStateTimer = null;
                }

                popupWindow.close();
            }

            popupWindow = null;
            popupWrap = null;

            applyStyle(win, FLOATING_STYLE);
            applySavedWindowState();

            if (!document.body.contains(win)) {
                document.body.appendChild(win);
            }

            updateLayout();
        }

        function moveToDetachedWindow() {
            const popup = getOrCreatePopup();
            if (!popup) return;

            mountWinIntoPopup(popup);
        }

        viewBtn.onclick = () => {
            viewMode = viewMode === "grid" ? "active" : "grid";
            localStorage.setItem("sampler_monitor_view_mode", viewMode);
            updateViewButton();
            updateSamplerVisibility();
            updateLayout();
        };

        detachBtn.onclick = () => {
            if (popupWindow && !popupWindow.closed) {
                restoreFloatingWindow();
            } else {
                moveToDetachedWindow();
            }
        };

        let dragging = false;
        let offsetX = 0;
        let offsetY = 0;

        header.addEventListener("mousedown", (e) => {
            if (popupWindow && !popupWindow.closed) return;
            dragging = true;
            offsetX = e.clientX - win.offsetLeft;
            offsetY = e.clientY - win.offsetTop;
            header.style.cursor = "grabbing";
        });

        window.addEventListener("mousemove", (e) => {
            if (!dragging) return;
            win.style.left = (e.clientX - offsetX) + "px";
            win.style.top = (e.clientY - offsetY) + "px";
        });

        window.addEventListener("mouseup", () => {
            if (dragging) {
                saveWindowState();
            }
            dragging = false;
            header.style.cursor = "grab";
        });

        function findNode(nodeId, graph = app.graph, parent = null) {
            if (!graph?._nodes) return null;
            for (const n of graph._nodes) {
                if (n.id == nodeId) return { node: n, parent };
                if (n.subgraph) {
                    const found = findNode(nodeId, n.subgraph, n);
                    if (found) return found;
                }
            }
            return null;
        }

        function getLabel(nodeId) {
            const res = findNode(nodeId);
            if (!res) return `#${nodeId}`;
            if (res.parent) return res.parent.title || `Subgraph ${res.parent.id}`;
            return res.node.title || res.node.type || `Sampler ${nodeId}`;
        }

        function updateSamplerVisibility() {
            let fallbackFirstVisible = null;

            previews.forEach((entry, nodeId) => {
                if (!fallbackFirstVisible) fallbackFirstVisible = nodeId;

                if (viewMode === "grid") {
                    entry.wrapper.style.display = "flex";
                    return;
                }

                const targetId = activeNodeId || fallbackFirstVisible;
                entry.wrapper.style.display = nodeId === targetId ? "flex" : "none";
            });
        }

        function updateLayout() {
            const visibleEntries = Array.from(previews.entries()).filter(([_, entry]) => {
                return entry.wrapper.style.display !== "none";
            });

            const count = visibleEntries.length;

            if (count <= 1) {
                content.style.display = "flex";
                content.style.flexDirection = "column";
                content.style.gridTemplateColumns = "";
                content.style.gridAutoRows = "";
                content.style.overflow = "hidden";

                visibleEntries.forEach(([_, entry]) => {
                    entry.wrapper.style.flex = "1 1 0";
                    entry.wrapper.style.minHeight = "120px";
                });
                return;
            }

            content.style.display = "grid";
            content.style.flexDirection = "";
            content.style.gridTemplateColumns = "1fr 1fr";
            content.style.gridAutoRows = "minmax(120px, 1fr)";
            content.style.overflow = "auto";

            visibleEntries.forEach(([_, entry]) => {
                entry.wrapper.style.flex = "";
                entry.wrapper.style.minHeight = "120px";
            });
        }

        function createSampler(nodeId) {
            const wrapper = document.createElement("div");
            wrapper.dataset.id = nodeId;
            Object.assign(wrapper.style, {
                border: "1px solid #333",
                padding: "6px",
                borderRadius: "4px",
                background: "#0f0f0f",
                display: "flex",
                flexDirection: "column",
                minHeight: "120px",
                boxSizing: "border-box",
                overflow: "hidden"
            });

            const label = document.createElement("div");
            label.textContent = getLabel(nodeId);
            label.style.fontSize = "12px";

            const progress = document.createElement("div");
            Object.assign(progress.style, {
                height: "6px",
                background: "#222",
                margin: "4px 0"
            });

            const bar = document.createElement("div");
            Object.assign(bar.style, {
                height: "100%",
                width: "0%",
                background: "#4caf50"
            });
            progress.appendChild(bar);

            const img = document.createElement("img");
            Object.assign(img.style, {
                width: "100%",
                flex: "1 1 0",
                minHeight: "0",
                objectFit: "contain",
                background: "#000",
                border: "1px solid #222",
                boxSizing: "border-box"
            });

            wrapper.appendChild(label);
            wrapper.appendChild(progress);
            wrapper.appendChild(img);
            content.appendChild(wrapper);

            const entry = { wrapper, img, bar, queue: [], lastUrl: null };
            previews.set(nodeId, entry);

            updateSamplerVisibility();
            updateLayout();

            return entry;
        }

        function ensure(nodeId) {
            return previews.get(nodeId) || createSampler(nodeId);
        }

        function setActive(nodeId) {
            activeNodeId = nodeId;

            previews.forEach((e, id) => {
                e.wrapper.style.border =
                    id === nodeId ? "1px solid #4caf50" : "1px solid #333";
            });

            updateSamplerVisibility();
            updateLayout();
        }

        app.api.addEventListener("progress", (e) => {
            if (!previewEnabled) return;
            const { node, value, max } = e.detail;
            if (!node) return;
            const nodeId = node.includes(":") ? node.split(":").pop() : node;
            setActive(nodeId);
            const entry = ensure(nodeId);
            if (max) entry.bar.style.width = `${(value / max) * 100}%`;
        });

        let socket = null;

        async function handleSocketMessage(event) {
            if (!previewEnabled) return;
            let buffer;
            if (event.data instanceof ArrayBuffer) buffer = event.data;
            else if (event.data instanceof Blob) buffer = await event.data.arrayBuffer();
            else return;

            const bytes = new Uint8Array(buffer);
            const start = findImageStart(bytes);
            if (start === -1 || !activeNodeId) return;

            const imageData = buffer.slice(start);
            const url = URL.createObjectURL(new Blob([imageData]));
            const entry = ensure(activeNodeId);

            if (ENABLE_BUFFER) {
                entry.queue.push(url);
                if (entry.queue.length > 8) {
                    const old = entry.queue.shift();
                    URL.revokeObjectURL(old);
                }
            } else {
                if (entry.lastUrl) URL.revokeObjectURL(entry.lastUrl);
                entry.lastUrl = url;
                entry.img.src = url;
            }
        }

        function bindSocketListener() {
            const nextSocket = app.api.socket;
            if (!nextSocket || nextSocket === socket) return;

            if (socket) {
                socket.removeEventListener("message", handleSocketMessage);
            }

            socket = nextSocket;
            socket.addEventListener("message", handleSocketMessage);
        }

        function findImageStart(bytes) {
            for (let i = 0; i < bytes.length - 3; i++) {
                if (bytes[i] === 0xff && bytes[i + 1] === 0xd8) return i;
                if (bytes[i] === 0x89 && bytes[i + 1] === 0x50 && bytes[i + 2] === 0x4e && bytes[i + 3] === 0x47) return i;
            }
            return -1;
        }

        bindSocketListener();
        window.addEventListener("focus", bindSocketListener);
        window.addEventListener("online", bindSocketListener);
        document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "visible") {
                bindSocketListener();
            }
        });
        setInterval(bindSocketListener, 5000);

        if (ENABLE_BUFFER) {
            setInterval(() => {
                previews.forEach((e) => {
                    if (!e.queue.length) return;
                    const frame = e.queue.shift();
                    if (e.lastUrl) URL.revokeObjectURL(e.lastUrl);
                    e.lastUrl = frame;
                    e.img.src = frame;
                });
            }, 1000 / BUFFER_FPS);
        }

        app.api.addEventListener("execution_start", () => {
            if (!previewEnabled) {
                hidePreviewWindow();
                return;
            }

            previews.forEach((e) => {
                if (e.lastUrl) URL.revokeObjectURL(e.lastUrl);
                e.queue.forEach((u) => URL.revokeObjectURL(u));
            });
            previews.clear();
            content.innerHTML = "";
            updateViewButton();
            updateSamplerVisibility();
            updateLayout();

            if (popupWindow && popupWindow.closed) {
                restoreFloatingWindow();
            } else if (!popupWindow && !document.body.contains(win)) {
                document.body.appendChild(win);
                applyStyle(win, FLOATING_STYLE);
            }
        });

        window.addEventListener(SAMPLER_PREVIEW_SETTING_CHANGED_EVENT, (event) => {
            previewEnabled = Boolean(event.detail?.enabled);
            applyPreviewEnabledState();
        });

        console.log("Sampler Monitor UX loaded");
    }
});
