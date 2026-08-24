const OS = {
  version: "24.04.1",
  codename: "Noble Numbat",
  hostname: "oubento-phone",
  user: "oubento",
  startedAt: Date.now(),
  settings: {
    lang: "ar",
    theme: "dark",
    wallpaper: "assets/wallpapers/ubuntu-default.jpg",
    brightness: 100,
    volume: 70,
    wifi: true,
    bt: false,
    airplane: false,
    rotate: true,
    saver: false,
    locate: true,
    night: false,
    hotspot: false,
    pin: "",
    distro: "ubuntu",
    wallpaperLocked: false,
    displayName: "أوبنتو",
    installed: [
      "files", "terminal", "browser", "settings", "store", "help",
      "calculator", "calendar", "clock", "weather", "notes", "gallery",
      "music", "camera", "contacts", "messages", "editor", "writer",
      "calcSheet", "maps", "monitor", "todo", "mail", "code", "mines",
      "snake", "puzzle", "trash", "updater", "disks", "logs", "converter",
      "flashlight", "videos", "recorder", "distros"
    ],
    hidden: [],
  },
  state: {
    locked: true,
    booted: false,
    shade: false,
    overview: false,
    windows: [],
    active: null,
    clipboard: null,
    notifs: [],
    logs: [],
    deferredInstall: null,
  },
};

const WALLS = [
  "assets/wallpapers/ubuntu-default.jpg",
  "assets/wallpapers/ubuntu-orange.jpg",
  "assets/wallpapers/ubuntu-dark.jpg",
  "assets/wallpapers/ubuntu-light.jpg",
];

function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem("oubento-settings") || "null");
    if (s) Object.assign(OS.settings, s);
    if (OS.settings.wallpaper && OS.settings.wallpaper.endsWith(".png")) {
      OS.settings.wallpaper = OS.settings.wallpaper.replace(".png", ".jpg");
    }
  } catch {}
}

function saveSettings() {
  localStorage.setItem("oubento-settings", JSON.stringify(OS.settings));
  applyChrome();
}

function applyChrome() {
  const root = document.documentElement;
  root.lang = OS.settings.lang;
  root.dir = OS.settings.lang === "ar" ? "rtl" : "ltr";
  root.dataset.theme = OS.settings.theme;
  const d = typeof currentDistro === "function" ? currentDistro() : null;
  if (d) {
    root.dataset.de = d.de;
    root.dataset.distro = d.id;
    root.style.setProperty("--orange", d.color);
    root.style.setProperty("--orange-2", d.accent);
    root.style.setProperty("--aubergine", d.accent);
    root.style.setProperty("--panel-solid", d.panel);
    OS.version = d.version;
    OS.codename = d.codename;
    OS.hostname = d.id + "-phone";
  }
  document.body.style.filter = `brightness(${OS.settings.brightness / 100})`;
  if (OS.settings.night) document.body.style.filter += " sepia(.25) hue-rotate(-10deg)";
  const wall = document.querySelector(".wallpaper");
  if (wall) wall.style.backgroundImage = `url("${OS.settings.wallpaper}")`;
  const lock = document.getElementById("lock");
  if (lock) lock.style.backgroundImage = `url("${OS.settings.wallpaper}")`;
}

function log(msg) {
  const line = `${new Date().toISOString()} ${msg}`;
  OS.state.logs.unshift(line);
  OS.state.logs = OS.state.logs.slice(0, 400);
}

function uid(p = "w") {
  return p + Math.random().toString(36).slice(2, 9);
}

function fmtSize(n) {
  if (n < 1024) return n + " B";
  if (n < 1048576) return (n / 1024).toFixed(1) + " KB";
  return (n / 1048576).toFixed(1) + " MB";
}

function fmtTime(d = new Date(), withSec = false) {
  const opt = { hour: "2-digit", minute: "2-digit", hour12: false };
  if (withSec) opt.second = "2-digit";
  return d.toLocaleTimeString(OS.settings.lang === "ar" ? "ar" : "en-GB", opt);
}

function fmtDate(d = new Date()) {
  const L = I18N[OS.settings.lang];
  return `${L.days[d.getDay()]}، ${d.getDate()} ${L.months[d.getMonth()]}`;
}

function h(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

function svgIcon(name) {
  const shapes = {
    folder: `<rect x="3" y="8" width="26" height="18" rx="3" fill="#e8b84a"/><path d="M3 10a3 3 0 0 1 3-3h7l3 3h13a3 3 0 0 1 3 3v2H3z" fill="#f3d27a"/>`,
    files: `<rect width="32" height="32" rx="8" fill="#3584e4"/><path d="M9 8h9l5 5v11a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2z" fill="#fff"/><path d="M18 8v5h5" fill="#cfe3ff"/>`,
    terminal: `<rect width="32" height="32" rx="8" fill="#241f31"/><path d="M8 12l5 4-5 4" stroke="#8ff0a4" stroke-width="2" fill="none"/><path d="M15 20h9" stroke="#e8d5c4" stroke-width="2"/>`,
    settings: `<rect width="32" height="32" rx="8" fill="#77767b"/><circle cx="16" cy="16" r="4.2" fill="none" stroke="#fff" stroke-width="2"/><path d="M16 6v3M16 23v3M6 16h3M23 16h3M8.5 8.5l2 2M21.5 21.5l2 2M23.5 8.5l-2 2M10.5 21.5l-2 2" stroke="#fff" stroke-width="2" stroke-linecap="round"/>`,
    browser: `<rect width="32" height="32" rx="8" fill="#e95420"/><circle cx="16" cy="16" r="8" fill="none" stroke="#fff" stroke-width="2"/><path d="M8 16h16M16 8c2.4 3 2.4 13 0 16M16 8c-2.4 3-2.4 13 0 16" fill="none" stroke="#fff" stroke-width="1.5"/>`,
    calculator: `<rect width="32" height="32" rx="8" fill="#1a5fb4"/><rect x="8" y="7" width="16" height="6" rx="1.5" fill="#99c1f1"/><circle cx="11" cy="18" r="1.4" fill="#fff"/><circle cx="16" cy="18" r="1.4" fill="#fff"/><circle cx="21" cy="18" r="1.4" fill="#fff"/><circle cx="11" cy="23" r="1.4" fill="#fff"/><circle cx="16" cy="23" r="1.4" fill="#fff"/><circle cx="21" cy="23" r="1.4" fill="#f8e45c"/>`,
    calendar: `<rect width="32" height="32" rx="8" fill="#c01c28"/><rect x="7" y="10" width="18" height="14" rx="2" fill="#fff"/><path d="M7 14h18" stroke="#c01c28"/><circle cx="12" cy="18" r="1.2" fill="#c01c28"/><circle cx="16" cy="18" r="1.2" fill="#c01c28"/><circle cx="20" cy="18" r="1.2" fill="#c01c28"/>`,
    clock: `<rect width="32" height="32" rx="8" fill="#1c71d8"/><circle cx="16" cy="16" r="8" fill="#fff"/><path d="M16 10v6l4 2" stroke="#1c71d8" stroke-width="2" fill="none" stroke-linecap="round"/>`,
    weather: `<rect width="32" height="32" rx="8" fill="#3584e4"/><circle cx="12" cy="13" r="4" fill="#f8e45c"/><path d="M12 20h11a4 4 0 1 0-1-7.8A6 6 0 0 0 12 20z" fill="#fff"/>`,
    notes: `<rect width="32" height="32" rx="8" fill="#f5c211"/><rect x="9" y="7" width="14" height="18" rx="2" fill="#fff"/><path d="M12 12h8M12 16h8M12 20h5" stroke="#9a6700"/>`,
    gallery: `<rect width="32" height="32" rx="8" fill="#813d9c"/><rect x="7" y="9" width="18" height="14" rx="2" fill="#fff"/><circle cx="12" cy="14" r="2" fill="#f8e45c"/><path d="M8 20l5-5 4 4 3-3 4 4" fill="#c061cb"/>`,
    music: `<rect width="32" height="32" rx="8" fill="#e01b24"/><path d="M13 10v10a3 3 0 1 1-2-2.8V12l10-2v8a3 3 0 1 1-2-2.8" fill="#fff"/>`,
    videos: `<rect width="32" height="32" rx="8" fill="#3d3846"/><rect x="7" y="10" width="18" height="12" rx="2" fill="#fff"/><path d="M14 13l6 3-6 3z" fill="#e95420"/>`,
    camera: `<rect width="32" height="32" rx="8" fill="#5e5c64"/><rect x="6" y="11" width="20" height="13" rx="3" fill="#fff"/><circle cx="16" cy="17.5" r="4" fill="#241f31"/><circle cx="16" cy="17.5" r="2" fill="#62a0ea"/><rect x="20" y="8" width="5" height="4" rx="1" fill="#e8b84a"/>`,
    contacts: `<rect width="32" height="32" rx="8" fill="#26a269"/><circle cx="16" cy="13" r="4" fill="#fff"/><path d="M8 24c1.5-4 14.5-4 16 0" fill="#fff"/>`,
    messages: `<rect width="32" height="32" rx="8" fill="#1c71d8"/><path d="M7 10h18v11H12l-5 4V10z" fill="#fff"/>`,
    store: `<rect width="32" height="32" rx="8" fill="#e95420"/><path d="M8 13h16l-1.2 11H9.2z" fill="#fff"/><path d="M12 13a4 4 0 0 1 8 0" fill="none" stroke="#fff" stroke-width="2"/>`,
    monitor: `<rect width="32" height="32" rx="8" fill="#241f31"/><path d="M8 22l4-8 4 5 3-3 5 6" fill="none" stroke="#57e389" stroke-width="2"/>`,
    editor: `<rect width="32" height="32" rx="8" fill="#865e3c"/><rect x="8" y="7" width="16" height="18" rx="2" fill="#fff"/><path d="M11 12h10M11 16h10M11 20h6" stroke="#865e3c"/>`,
    writer: `<rect width="32" height="32" rx="8" fill="#1a5fb4"/><rect x="8" y="7" width="16" height="18" rx="2" fill="#fff"/><path d="M11 12h10M11 16h10M11 20h7" stroke="#1a5fb4"/>`,
    calcSheet: `<rect width="32" height="32" rx="8" fill="#26a269"/><rect x="7" y="8" width="18" height="16" rx="2" fill="#fff"/><path d="M7 13h18M7 18h18M13 8v16M19 8v16" stroke="#26a269"/>`,
    maps: `<rect width="32" height="32" rx="8" fill="#2ec27e"/><path d="M16 7c4 0 7 3 7 7 0 6-7 11-7 11s-7-5-7-11c0-4 3-7 7-7z" fill="#fff"/><circle cx="16" cy="14" r="2.4" fill="#e01b24"/>`,
    help: `<rect width="32" height="32" rx="8" fill="#1c71d8"/><circle cx="16" cy="16" r="8" fill="#fff"/><text x="16" y="21" text-anchor="middle" font-size="14" font-weight="700" fill="#1c71d8">?</text>`,
    trash: `<rect width="32" height="32" rx="8" fill="#5e5c64"/><path d="M10 12h12l-1 12H11z" fill="#fff"/><path d="M9 10h14M13 10V8h6v2" stroke="#fff" stroke-width="1.6"/>`,
    recorder: `<rect width="32" height="32" rx="8" fill="#c01c28"/><rect x="13" y="7" width="6" height="12" rx="3" fill="#fff"/><path d="M10 16a6 6 0 0 0 12 0M16 22v3" stroke="#fff" stroke-width="2"/>`,
    code: `<rect width="32" height="32" rx="8" fill="#241f31"/><path d="M12 11l-5 5 5 5M20 11l5 5-5 5" fill="none" stroke="#62a0ea" stroke-width="2"/>`,
    mail: `<rect width="32" height="32" rx="8" fill="#1a5fb4"/><rect x="6" y="10" width="20" height="13" rx="2" fill="#fff"/><path d="M6 11l10 7 10-7" fill="none" stroke="#1a5fb4" stroke-width="1.6"/>`,
    todo: `<rect width="32" height="32" rx="8" fill="#613583"/><rect x="8" y="8" width="16" height="16" rx="2" fill="#fff"/><path d="M11 16l3 3 7-7" fill="none" stroke="#613583" stroke-width="2"/>`,
    mines: `<rect width="32" height="32" rx="8" fill="#3d3846"/><circle cx="16" cy="16" r="6" fill="#f8e45c"/><rect x="14.5" y="8" width="3" height="4" fill="#f8e45c"/>`,
    snake: `<rect width="32" height="32" rx="8" fill="#26a269"/><path d="M8 20c0-6 16-6 16-2s-8 2-8 6 10 2 10-4" fill="none" stroke="#8ff0a4" stroke-width="3" stroke-linecap="round"/>`,
    puzzle: `<rect width="32" height="32" rx="8" fill="#e5a50a"/><text x="16" y="21" text-anchor="middle" font-size="11" font-weight="700" fill="#fff">2048</text>`,
    disks: `<rect width="32" height="32" rx="8" fill="#5e5c64"/><ellipse cx="16" cy="11" rx="9" ry="4" fill="#deddda"/><path d="M7 11v10c0 2 4 4 9 4s9-2 9-4V11" fill="#9a9996"/><ellipse cx="16" cy="21" rx="9" ry="4" fill="#deddda"/>`,
    logs: `<rect width="32" height="32" rx="8" fill="#241f31"/><path d="M9 10h14M9 16h14M9 22h9" stroke="#e8d5c4" stroke-width="2"/>`,
    updater: `<rect width="32" height="32" rx="8" fill="#26a269"/><path d="M16 8v10M11 14l5 5 5-5" fill="none" stroke="#fff" stroke-width="2"/><path d="M8 23h16" stroke="#fff" stroke-width="2"/>`,
    converter: `<rect width="32" height="32" rx="8" fill="#0d7377"/><path d="M10 12h12M18 8l4 4-4 4M22 20H10M14 16l-4 4 4 4" fill="none" stroke="#fff" stroke-width="2"/>`,
    flashlight: `<rect width="32" height="32" rx="8" fill="#f5c211"/><path d="M13 6h6v8l3 4v8H10v-8l3-4z" fill="#fff"/>`,
    about: `<rect width="32" height="32" rx="8" fill="#e95420"/><circle cx="16" cy="16" r="7" fill="#fff"/><circle cx="16" cy="16" r="3" fill="#e95420"/>`,
    home: `<rect width="32" height="32" rx="8" fill="#e95420"/><path d="M6 16 L16 8 L26 16 V25 H6 Z" fill="#fff"/>`,
    image: `<rect x="4" y="6" width="24" height="20" rx="3" fill="#c061cb"/>`,
    file: `<path d="M9 5h9l6 6v16H9z" fill="#deddda"/><path d="M18 5v6h6" fill="#c0bfbc"/>`,
  };
  return `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">${shapes[name] || shapes.file}</svg>`;
}

function iconBtn(id, title) {
  return `<button class="app-ico" data-app="${id}" title="${title}">${svgIcon(id)}</button>`;
}

function notify(title, body, app = "settings") {
  const n = { id: uid("n"), title, body, app, time: Date.now() };
  OS.state.notifs.unshift(n);
  const box = document.getElementById("toasts");
  if (box) {
    const el = h(`<div class="toast"><b>${title}</b><div>${body || ""}</div></div>`);
    box.appendChild(el);
    setTimeout(() => el.remove(), 3200);
  }
  renderShade();
  return n;
}

function batteryInfo() {
  return navigator.getBattery ? navigator.getBattery() : Promise.resolve(null);
}

const CATALOG = [
  { id: "files", cat: "system", score: 4.9 },
  { id: "terminal", cat: "system", score: 4.8 },
  { id: "settings", cat: "system", score: 4.9 },
  { id: "browser", cat: "web", score: 4.6 },
  { id: "store", cat: "system", score: 4.7 },
  { id: "distros", cat: "system", score: 4.9 },
  { id: "editor", cat: "office", score: 4.5 },
  { id: "writer", cat: "office", score: 4.4 },
  { id: "calcSheet", cat: "office", score: 4.3 },
  { id: "calculator", cat: "tools", score: 4.8 },
  { id: "calendar", cat: "tools", score: 4.5 },
  { id: "clock", cat: "tools", score: 4.6 },
  { id: "weather", cat: "web", score: 4.4 },
  { id: "notes", cat: "office", score: 4.7 },
  { id: "todo", cat: "office", score: 4.5 },
  { id: "mail", cat: "web", score: 4.2 },
  { id: "gallery", cat: "media", score: 4.6 },
  { id: "music", cat: "media", score: 4.5 },
  { id: "videos", cat: "media", score: 4.3 },
  { id: "camera", cat: "media", score: 4.4 },
  { id: "recorder", cat: "media", score: 4.2 },
  { id: "contacts", cat: "comm", score: 4.5 },
  { id: "messages", cat: "comm", score: 4.4 },
  { id: "maps", cat: "web", score: 4.3 },
  { id: "monitor", cat: "system", score: 4.6 },
  { id: "disks", cat: "system", score: 4.4 },
  { id: "logs", cat: "system", score: 4.1 },
  { id: "updater", cat: "system", score: 4.7 },
  { id: "help", cat: "system", score: 4.8 },
  { id: "trash", cat: "system", score: 4.9 },
  { id: "code", cat: "office", score: 4.5 },
  { id: "converter", cat: "tools", score: 4.3 },
  { id: "flashlight", cat: "tools", score: 4.6 },
  { id: "mines", cat: "games", score: 4.4 },
  { id: "snake", cat: "games", score: 4.5 },
  { id: "puzzle", cat: "games", score: 4.7 },
];

function isInstalled(id) {
  return OS.settings.installed.includes(id);
}

function appTitle(id) {
  return t(id);
}
