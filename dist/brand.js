"use strict";
(() => {
    window.__snapshotBrand = {
        css: `
:root,.snapshot-root {
 color-scheme:light;
 --sn-font:"Segoe UI",system-ui,sans-serif;
 --sn-text:#262b29; --sn-muted:#626a65; --sn-bg:#f3f4f3;
 --sn-surface:#f9faf9; --sn-white:#fff; --sn-sidebar:#eeefee;
 --sn-line:#dce0dd; --sn-border:#cdd3cd; --sn-hover:#e8ebe8;
 --sn-control-border:#859087;
 --sn-charcoal:#292e2b; --sn-charcoal-hover:#414a43;
 --sn-accent:#32664f; --sn-selected:#dfe5e0; --sn-selected-text:#224d39;
 --sn-danger:#963c31; --sn-danger-bg:#f6e8e5;
 --sn-radius:5px; --sn-panel-radius:8px;
 --sn-shadow:0 4px 18px #0002;
}
/* Dark theme. data-theme is "light", "dark" or "system" (missing counts as system).
   --sn-white is the base surface and --sn-charcoal the strongest ink, so both flip. */
:root[data-theme=dark],.snapshot-root[data-theme=dark] {
 --sn-text:#e4e8e5; --sn-muted:#a3aca6; --sn-bg:#202422;
 --sn-surface:#1c201e; --sn-white:#171a19; --sn-sidebar:#202422;
 --sn-line:#2e3431; --sn-border:#3e4541; --sn-hover:#2a302d;
 --sn-control-border:#6b756f;
 --sn-charcoal:#e4e8e5; --sn-charcoal-hover:#c8cfca;
 --sn-accent:#7cc4a0; --sn-selected:#28382f; --sn-selected-text:#a9dcc1;
 --sn-danger:#f08a7c; --sn-danger-bg:#3a2421;
 --sn-shadow:0 4px 18px #0009; color-scheme:dark;
}
@media (prefers-color-scheme: dark) {
 :root:not([data-theme=light]),.snapshot-root:not([data-theme=light]) {
 --sn-text:#e4e8e5; --sn-muted:#a3aca6; --sn-bg:#202422;
 --sn-surface:#1c201e; --sn-white:#171a19; --sn-sidebar:#202422;
 --sn-line:#2e3431; --sn-border:#3e4541; --sn-hover:#2a302d;
 --sn-control-border:#6b756f;
 --sn-charcoal:#e4e8e5; --sn-charcoal-hover:#c8cfca;
 --sn-accent:#7cc4a0; --sn-selected:#28382f; --sn-selected-text:#a9dcc1;
 --sn-danger:#f08a7c; --sn-danger-bg:#3a2421;
 --sn-shadow:0 4px 18px #0009; color-scheme:dark;
 }
}
.snapshot-root {
 all:initial; font:400 13px/1.5 var(--sn-font); color:var(--sn-text);
 direction:ltr; text-align:left; font-synthesis:none;
 -webkit-text-size-adjust:100%; text-size-adjust:100%;
}
.snapshot-root *, .snapshot-root *::before, .snapshot-root *::after { box-sizing:border-box; }
.snapshot-root button,.snapshot-root select { font:inherit; letter-spacing:normal; text-transform:none; }
.snapshot-root svg {width:16px;height:16px;display:block;flex-shrink:0;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
.snapshot-root .brand-mark {display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:var(--sn-radius);background:var(--sn-charcoal);color:var(--sn-white)}
.snapshot-root .brand-mark svg {width:18px;height:18px}
`,
        paths: {
            folder: '<path d="M3 7V5a2 2 0 0 1 2-2h4l2 3h8a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>',
            sidebar: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/>',
            more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
            up: '<path d="M12 20V4m-6 6 6-6 6 6"/>',
            down: '<path d="M12 4v16m-6-6 6 6 6-6"/>',
            scan: '<path d="M8 3H5a2 2 0 0 0-2 2v3m13-5h3a2 2 0 0 1 2 2v3M3 16v3a2 2 0 0 0 2 2h3m8 0h3a2 2 0 0 0 2-2v-3"/><rect x="8" y="8" width="8" height="8" rx="1"/>',
            grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
            clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
            star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z"/>',
            search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
            list: '<rect x="3" y="4" width="4" height="4" rx="1"/><rect x="3" y="10" width="4" height="4" rx="1"/><rect x="3" y="16" width="4" height="4" rx="1"/><path d="M11 6h10M11 12h10M11 18h10"/>',
            help: '<circle cx="12" cy="12" r="9"/><path d="M9.7 9a2.4 2.4 0 1 1 3.4 2.2c-.9.5-1.1 1-1.1 1.8m0 3h.01"/>',
            arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
            external: '<path d="M14 3h7v7m0-7L10 14m0-10H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-5"/>',
            lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/>',
            sort: '<path d="M8 4v16m-4-4 4 4 4-4M16 20V4m-4 4 4-4 4 4"/>',
            copy: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
            download: '<path d="M12 3v12m-4-4 4 4 4-4M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/>',
            trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
            close: '<path d="m6 6 12 12M6 18 18 6"/>', plus: '<path d="M12 4v16M4 12h16"/>',
            image: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m3 16 5-5 5 5 3-3 5 5"/>',
            info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/>', check: '<path d="m5 12 4 4L19 6"/>',
            settings: '<path d="M10.17 5.24L10.49 2.92L13.51 2.92L13.83 5.24L15.49 5.93L17.35 4.51L19.49 6.65L18.07 8.51L18.76 10.17L21.08 10.49L21.08 13.51L18.76 13.83L18.07 15.49L19.49 17.35L17.35 19.49L15.49 18.07L13.83 18.76L13.51 21.08L10.49 21.08L10.17 18.76L8.51 18.07L6.65 19.49L4.51 17.35L5.93 15.49L5.24 13.83L2.92 13.51L2.92 10.49L5.24 10.17L5.93 8.51L4.51 6.65L6.65 4.51L8.51 5.93Z"/><circle cx="12" cy="12" r="3"/>',
            edit: '<path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/>',
            retry: '<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>'
        }
    };
})();
