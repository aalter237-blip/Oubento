function renderBoot() {
  const el = document.getElementById("boot");
  el.innerHTML = `
    <img src="assets/branding/boot-mascot.png" alt="">
    <h1>${currentDistro().name}</h1>
    <p>${t("boot")}</p>
    <div class="boot-bar"><i></i></div>
    <div class="boot-log">
      [  0.000001] oubento-kernel 6.8.0-phone SMP PREEMPT<br>
      [  0.214220] Initramfs unpacking... ok<br>
      [  0.881002] Starting GNOME Session / Lomiri shell<br>
      [  1.402110] NetworkManager is running<br>
      [  1.990001] Welcome to ${currentDistro().name} ${OS.version} · ${currentDistro().session}
    </div>`;
}

function renderLock() {
  const el = document.getElementById("lock");
  el.style.backgroundImage = `url("${OS.settings.wallpaper}")`;
  el.innerHTML = `
    <div class="lock-inner">
      <div>
        <div class="lock-time" id="lockTime">${fmtTime()}</div>
        <div class="lock-date" id="lockDate">${fmtDate()}</div>
      </div>
      <div class="lock-user">
        <div class="lock-avatar">${(OS.settings.displayName || "U").slice(0, 1)}</div>
        <div class="lock-name">${OS.settings.displayName}</div>
        <select class="session-pick" id="acct">
          <option value="oubento">oubento (sudo)</option>
          <option value="root">root (uid 0)</option>
        </select>
        <select class="session-pick" id="sess">
          ${DISTROS.map((d) => `<option value="${d.id}" ${d.id === currentDistro().id ? "selected" : ""}>${OS.settings.lang === "ar" ? d.ar : d.name} — ${d.session}</option>`).join("")}
        </select>
        <div class="lock-row">
          <input id="pin" type="password" placeholder="${t("password")}" autocomplete="off">
          <button class="lock-go" id="unlockBtn">${t("unlock")}</button>
        </div>
        <div class="lock-hint">${t("swipe")}</div>
      </div>
    </div>`;
  const unlock = () => {
    const val = document.getElementById("pin").value;
    const acct = document.getElementById("acct")?.value || "oubento";
    if (!AUTH.login(acct, val) && val && val !== OS.settings.pin) {
      notify(t("pinWrong"), "");
      return;
    }
    if (acct === "oubento" && OS.settings.pin && val && val !== OS.settings.pin && val !== "ubuntu") {
      notify(t("pinWrong"), "");
      return;
    }
    AUTH.login(acct, val || "ubuntu");
    const pick = document.getElementById("sess");
    if (pick) applyDistro(pick.value, { persist: true, rerender: true });
    OS.state.locked = false;
    document.getElementById("lock").hidden = true;
    log("session unlocked " + AUTH.session);
  };
  document.getElementById("unlockBtn").onclick = unlock;
  document.getElementById("pin").addEventListener("keydown", (e) => {
    if (e.key === "Enter") unlock();
  });
  let startY = null;
  el.addEventListener("touchstart", (e) => (startY = e.touches[0].clientY), { passive: true });
  el.addEventListener("touchend", (e) => {
    if (startY != null && startY - e.changedTouches[0].clientY > 70) unlock();
    startY = null;
  });
}

function renderDesktop() {
  const desk = document.getElementById("desktop");
  desk.innerHTML = `
    <div class="wallpaper" style="background-image:url('${OS.settings.wallpaper}')"></div>
    <header class="topbar">
      <div class="side">
        <button id="actBtn">${t("activities")}</button>
      </div>
      <button class="clock-center" id="clockBtn">${fmtTime()}</button>
      <div class="side" id="statusSide"></div>
    </header>
    <div class="desktop-icons" id="deskIcons"></div>
    <div id="windows"></div>
    <nav class="dock" id="dock"></nav>
    <div id="overview" hidden></div>
    <div id="shade" hidden></div>
    <div id="toasts"></div>
    <div id="install" hidden></div>
    <div id="ctx" class="ctx" hidden></div>
    <div id="polkit" class="polkit" hidden></div>
  `;
  renderStatus();
  renderDock();
  renderDeskIcons();
  document.getElementById("actBtn").onclick = () => toggleOverview(true);
  document.getElementById("clockBtn").onclick = () => toggleShade();
  document.getElementById("statusSide").onclick = () => toggleShade();
  setupGestures();
  setupInstall();
}

function renderStatus() {
  const side = document.getElementById("statusSide");
  if (!side) return;
  const wifi = OS.settings.wifi && !OS.settings.airplane ? "●" : "○";
  side.innerHTML = `
    ${AUTH && AUTH.isRoot() ? '<span class="root-badge">ROOT</span>' : ""}
    <span class="act">${wifi} ${OS.settings.airplane ? "✈" : ""}</span>
    <span class="act" id="batTxt">🔋</span>
    <span class="act">${fmtTime()}</span>`;
  batteryInfo().then((b) => {
    const el = document.getElementById("batTxt");
    if (el && b) el.textContent = `${Math.round(b.level * 100)}%${b.charging ? "⚡" : ""}`;
  });
}

function dockApps() {
  const fav = ["browser", "files", "terminal", "root", "distros", "settings"];
  return fav.filter(isInstalled);
}

function renderDock() {
  const dock = document.getElementById("dock");
  if (!dock) return;
  const running = new Set(OS.state.windows.map((w) => w.app));
  dock.innerHTML =
    dockApps()
      .map((id) => {
        const run = running.has(id) ? '<i class="dot"></i>' : "";
        return `<button class="app-ico" data-app="${id}">${svgIcon(id)}${run}</button>`;
      })
      .join("") + `<button class="home-pill" id="homeBtn">●</button>`;
  dock.querySelectorAll("[data-app]").forEach((b) => (b.onclick = () => launch(b.dataset.app)));
  document.getElementById("homeBtn").onclick = () => {
    if (OS.state.overview) toggleOverview(false);
    else if (OS.state.active) minimizeAll();
    else toggleOverview(true);
  };
}

function renderDeskIcons() {
  const box = document.getElementById("deskIcons");
  if (!box) return;
  const items = VFS.list("/home/oubento/Desktop");
  box.innerHTML = items
    .map(
      (it) =>
        `<button class="desk-item" data-path="${it.path}">
          <div class="app-ico">${svgIcon(it.type === "dir" ? "folder" : "editor")}</div>
          ${it.name}
        </button>`
    )
    .join("");
  box.querySelectorAll(".desk-item").forEach((b) => {
    b.onclick = () => {
      const n = VFS.stat(b.dataset.path);
      if (n?.type === "dir") launch("files", { path: b.dataset.path });
      else launch("editor", { path: b.dataset.path });
    };
  });
}

function toggleShade(force) {
  const el = document.getElementById("shade");
  OS.state.shade = force ?? !OS.state.shade;
  el.hidden = !OS.state.shade;
  if (OS.state.shade) {
    toggleOverview(false);
    renderShade();
  }
}

function renderShade() {
  const el = document.getElementById("shade");
  if (!el || el.hidden) return;
  const qs = [
    ["wifi", t("wifi"), OS.settings.wifi],
    ["bt", t("bt"), OS.settings.bt],
    ["airplane", t("airplane"), OS.settings.airplane],
    ["dark", t("dark"), OS.settings.theme === "dark"],
    ["rotate", t("rotate"), OS.settings.rotate],
    ["saver", t("saver"), OS.settings.saver],
    ["locate", t("locate"), OS.settings.locate],
    ["night", t("night"), OS.settings.night],
    ["hotspot", t("hotspot"), OS.settings.hotspot],
    ["shot", t("shot"), false],
    ["flashlight", t("flashlight"), document.body.dataset.flash === "1"],
    ["settings", t("settings"), false],
  ];
  const notifs = OS.state.notifs
    .map(
      (n) =>
        `<div class="notif" data-id="${n.id}">
          <div class="app-ico" style="width:32px;height:32px">${svgIcon(n.app)}</div>
          <div class="grow"><b>${n.title}</b><span>${n.body || ""}</span></div>
        </div>`
    )
    .join("");
  el.innerHTML = `
    <div class="shade-panel">
      <div class="qs-grid">
        ${qs
          .map(
            ([id, label, on]) =>
              `<button class="qs ${on ? "on" : ""}" data-qs="${id}">${svgIcon(id === "dark" ? "settings" : id === "shot" ? "camera" : id)}<span>${label}</span></button>`
          )
          .join("")}
      </div>
      <div class="slider-row">☀ <input type="range" id="br" min="40" max="120" value="${OS.settings.brightness}"> </div>
      <div class="slider-row">🔊 <input type="range" id="vol" min="0" max="100" value="${OS.settings.volume}"></div>
      <div class="notif-list">${notifs || `<div class="empty">${t("noNotif")}</div>`}</div>
      ${OS.state.notifs.length ? `<button class="btn" id="clrN" style="margin-top:8px;width:100%">${t("clearAll")}</button>` : ""}
    </div>`;
  el.onclick = (e) => {
    if (e.target === el) toggleShade(false);
  };
  el.querySelectorAll("[data-qs]").forEach((b) => (b.onclick = () => quickAction(b.dataset.qs)));
  el.querySelector("#br").oninput = (e) => {
    OS.settings.brightness = +e.target.value;
    saveSettings();
  };
  el.querySelector("#vol").oninput = (e) => {
    OS.settings.volume = +e.target.value;
    saveSettings();
  };
  const clr = el.querySelector("#clrN");
  if (clr)
    clr.onclick = () => {
      OS.state.notifs = [];
      renderShade();
    };
}

function quickAction(id) {
  if (id === "settings") {
    toggleShade(false);
    launch("settings");
    return;
  }
  if (id === "shot") {
    toggleShade(false);
    setTimeout(takeScreenshot, 280);
    return;
  }
  if (id === "flashlight") {
    document.body.dataset.flash = document.body.dataset.flash === "1" ? "0" : "1";
    document.body.style.background = document.body.dataset.flash === "1" ? "#fff" : "";
    renderShade();
    return;
  }
  if (id === "dark") {
    OS.settings.theme = OS.settings.theme === "dark" ? "light" : "dark";
  } else if (id === "wifi") OS.settings.wifi = !OS.settings.wifi;
  else if (id === "bt") OS.settings.bt = !OS.settings.bt;
  else if (id === "airplane") {
    OS.settings.airplane = !OS.settings.airplane;
    if (OS.settings.airplane) OS.settings.wifi = false;
  } else if (id === "rotate") OS.settings.rotate = !OS.settings.rotate;
  else if (id === "saver") OS.settings.saver = !OS.settings.saver;
  else if (id === "locate") OS.settings.locate = !OS.settings.locate;
  else if (id === "night") OS.settings.night = !OS.settings.night;
  else if (id === "hotspot") OS.settings.hotspot = !OS.settings.hotspot;
  saveSettings();
  renderStatus();
  renderShade();
}

async function takeScreenshot() {
  try {
    const canvas = await htmlToCanvas();
    const data = canvas.toDataURL("image/png");
    const name = `لقطة-${Date.now()}.png`;
    await VFS.write("/home/oubento/Pictures/" + name, data, "image/png");
    notify(t("shotTaken"), name, "gallery");
  } catch {
    notify(t("shotTaken"), "", "gallery");
  }
}

function htmlToCanvas() {
  return new Promise((resolve) => {
    const w = innerWidth;
    const h = innerHeight;
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d");
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, w, h);
      ctx.fillStyle = "rgba(20,8,14,.25)";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#fff";
      ctx.font = "18px Ubuntu";
      ctx.fillText("Oubento " + new Date().toLocaleString(), 16, h - 24);
      resolve(c);
    };
    img.src = OS.settings.wallpaper;
  });
}

function toggleOverview(show) {
  const el = document.getElementById("overview");
  OS.state.overview = show ?? !OS.state.overview;
  el.hidden = !OS.state.overview;
  if (OS.state.overview) {
    OS.state.shade = false;
    document.getElementById("shade").hidden = true;
    renderOverview();
  }
}

function renderOverview(q = "") {
  const el = document.getElementById("overview");
  const query = q.toLowerCase();
  const recents = OS.state.windows;
  const apps = CATALOG.filter((a) => isInstalled(a.id) && t(a.id).toLowerCase().includes(query));
  el.innerHTML = `
    <input class="ov-search" id="ovq" placeholder="${t("search")}" value="${q}">
    <div class="recents">
      ${
        recents.length
          ? recents
              .map(
                (w) =>
                  `<div class="recent-card" data-wid="${w.id}">
                    <header><span>${w.title}</span><button data-x="${w.id}">✕</button></header>
                    <div class="preview"></div>
                  </div>`
              )
              .join("")
          : `<div class="empty" style="color:#fff">${t("noRecents")}</div>`
      }
    </div>
    <div class="app-grid">
      ${apps
        .map(
          (a) =>
            `<button class="app-tile" data-app="${a.id}">
              <div class="app-ico">${svgIcon(a.id)}</div>${t(a.id)}
            </button>`
        )
        .join("")}
    </div>`;
  el.querySelector("#ovq").oninput = (e) => renderOverview(e.target.value);
  el.querySelector("#ovq").focus();
  el.querySelectorAll(".app-tile").forEach((b) => {
    b.onclick = () => {
      toggleOverview(false);
      launch(b.dataset.app);
    };
  });
  el.querySelectorAll(".recent-card").forEach((c) => {
    c.onclick = (e) => {
      if (e.target.dataset.x) return;
      toggleOverview(false);
      focusWin(c.dataset.wid);
    };
  });
  el.querySelectorAll("[data-x]").forEach((b) => {
    b.onclick = (e) => {
      e.stopPropagation();
      closeWin(b.dataset.x);
      renderOverview(q);
    };
  });
}

function launch(app, opts = {}) {
  if (!APPS[app]) {
    notify(t(app), "Not available");
    return;
  }
  if (!isInstalled(app) && app !== "store" && app !== "settings") {
    launch("store", { highlight: app });
    return;
  }
  const existing = OS.state.windows.find((w) => w.app === app && !opts.force);
  if (existing && !opts.path && !opts.force) {
    focusWin(existing.id);
    return;
  }
  const id = uid("w");
  const win = { id, app, title: t(app), opts };
  OS.state.windows.push(win);
  OS.state.active = id;
  const root = document.getElementById("windows");
  const el = h(`
    <section class="window" id="${id}" data-app="${app}">
      <div class="wchrome">
        <button class="wbtn" data-act="back">›</button>
        <div class="title">${t(app)}</div>
        <button class="wbtn" data-act="min">–</button>
        <button class="wbtn" data-act="close">✕</button>
      </div>
      <div class="wbody"></div>
    </section>`);
  if (document.documentElement.dir === "rtl") {
    el.querySelector('[data-act="back"]').textContent = "‹";
  } else {
    el.querySelector('[data-act="back"]').textContent = "‹";
  }
  root.appendChild(el);
  el.querySelector('[data-act="close"]').onclick = () => closeWin(id);
  el.querySelector('[data-act="min"]').onclick = () => minimizeWin(id);
  el.querySelector('[data-act="back"]').onclick = () => {
    const body = el.querySelector(".wbody");
    if (body.dataset.back) {
      try {
        (new Function(body.dataset.back))();
      } catch {
        minimizeWin(id);
      }
    } else minimizeWin(id);
  };
  try {
    APPS[app].mount(el.querySelector(".wbody"), { win, el, opts, setTitle: (s) => setTitle(id, s) });
  } catch (err) {
    el.querySelector(".wbody").innerHTML = `<div class="pad">${err.message}</div>`;
    log("app crash " + app + " " + err.message);
  }
  renderDock();
  log("launch " + app);
}

function setTitle(id, s) {
  const w = OS.state.windows.find((x) => x.id === id);
  if (w) w.title = s;
  const el = document.getElementById(id);
  if (el) el.querySelector(".title").textContent = s;
}

function focusWin(id) {
  const el = document.getElementById(id);
  if (!el) return;
  OS.state.active = id;
  el.style.display = "";
  el.parentNode.appendChild(el);
}

function minimizeWin(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = "none";
  if (OS.state.active === id) OS.state.active = null;
  renderDock();
}

function minimizeAll() {
  OS.state.windows.forEach((w) => minimizeWin(w.id));
}

function closeWin(id) {
  const el = document.getElementById(id);
  if (el) {
    el.classList.add("closing");
    setTimeout(() => el.remove(), 150);
  }
  OS.state.windows = OS.state.windows.filter((w) => w.id !== id);
  if (OS.state.active === id) OS.state.active = null;
  renderDock();
}

function setupGestures() {
  let sy = null, sx = null;
  const desk = document.getElementById("desktop");
  desk.addEventListener(
    "touchstart",
    (e) => {
      sx = e.touches[0].clientX;
      sy = e.touches[0].clientY;
    },
    { passive: true }
  );
  desk.addEventListener("touchend", (e) => {
    if (sy == null) return;
    const y = e.changedTouches[0].clientY;
    const x = e.changedTouches[0].clientX;
    const dy = y - sy;
    const dx = x - sx;
    if (sy < 36 && dy > 50) toggleShade(true);
    if (innerHeight - sy < 28 && dy < -60) toggleOverview(true);
    if (Math.abs(dx) > 90 && Math.abs(dy) < 50 && OS.state.active && sx < 18) {
      minimizeWin(OS.state.active);
    }
    sy = sx = null;
  });
}

function setupInstall() {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    OS.state.deferredInstall = e;
    const bar = document.getElementById("install");
    bar.hidden = false;
    bar.innerHTML = `<div class="grow"><b>${t("installPwa")}</b><br><small>APK / PWA</small></div>
      <button class="btn primary" id="inst">${t("installBtn")}</button>
      <button class="ibtn" id="instx">✕</button>`;
    document.getElementById("inst").onclick = async () => {
      e.prompt();
      await e.userChoice;
      bar.hidden = true;
    };
    document.getElementById("instx").onclick = () => (bar.hidden = true);
  });
}

function tick() {
  const c = document.getElementById("clockBtn");
  if (c) c.textContent = fmtTime();
  const lt = document.getElementById("lockTime");
  const ld = document.getElementById("lockDate");
  if (lt) lt.textContent = fmtTime();
  if (ld) ld.textContent = fmtDate();
  renderStatus();
  const alarms = JSON.parse(localStorage.getItem("oubento-alarms") || "[]");
  const now = fmtTime();
  alarms.forEach((a) => {
    if (a.time === now && !a.fired) {
      a.fired = true;
      notify(t("alarm"), a.label || a.time, "clock");
      try {
        beep();
      } catch {}
    }
  });
  localStorage.setItem("oubento-alarms", JSON.stringify(alarms.map((a) => ({ ...a, fired: a.time === now }))));
}

function beep() {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.frequency.value = 880;
  o.connect(g);
  g.connect(ctx.destination);
  g.gain.value = (OS.settings.volume / 100) * 0.2;
  o.start();
  setTimeout(() => {
    o.stop();
    ctx.close();
  }, 600);
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true || /; wv\)/.test(navigator.userAgent);
}

async function startOS() {
  loadSettings();
  await VFS.init();
  applyDistro(OS.settings.distro || "ubuntu", { persist: false, rerender: false });
  applyChrome();
  renderBoot();
  renderLock();
  renderDesktop();
  applyChrome();
  setTimeout(() => {
    document.getElementById("boot").hidden = true;
    OS.state.booted = true;
    notify(t("welcomeTitle"), t("welcomeBody"), "about");
    log("session greeter ready");
  }, 2500);
  setInterval(tick, 1000);
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
  window.addEventListener("online", () => log("network up"));
  window.addEventListener("offline", () => notify(t("offline"), "", "network"));
}

document.addEventListener("DOMContentLoaded", startOS);
