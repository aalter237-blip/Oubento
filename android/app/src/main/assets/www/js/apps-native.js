function wrapApp(id, target) {
  APPS[id] = {
    mount(el, ctx) {
      ctx.setTitle(t(id));
      const inner = APPS[target];
      if (!inner) {
        el.innerHTML = `<div class="pad">${id}</div>`;
        return;
      }
      inner.mount(el, ctx);
    },
  };
}

[
  ["nautilus", "files"],
  ["dolphin", "files"],
  ["thunar", "files"],
  ["pcmanfm", "files"],
  ["caja", "files"],
  ["nemo", "files"],
  ["pantheon-files", "files"],
  ["cosmic-files", "files"],
  ["gnome-terminal", "terminal"],
  ["konsole", "terminal"],
  ["xfce4-terminal", "terminal"],
  ["qterminal", "terminal"],
  ["mate-terminal", "terminal"],
  ["pantheon-terminal", "terminal"],
  ["cosmic-term", "terminal"],
  ["gedit", "editor"],
  ["kate", "code"],
  ["kwrite", "editor"],
  ["mousepad", "editor"],
  ["featherpad", "editor"],
  ["pluma", "editor"],
  ["xed", "editor"],
  ["eog", "gallery"],
  ["gwenview", "gallery"],
  ["ristretto", "gallery"],
  ["lximage", "gallery"],
  ["pix", "gallery"],
  ["photos", "gallery"],
  ["parole", "videos"],
  ["evince", "writer"],
  ["okular", "writer"],
  ["atril", "writer"],
  ["kcalc", "calculator"],
  ["ksysguard", "monitor"],
  ["gnome-system-monitor", "monitor"],
  ["ark", "files"],
  ["engrampa", "files"],
  ["epiphany", "browser"],
  ["firefox", "browser"],
  ["software", "store"],
  ["gnome-software", "store"],
].forEach(([id, target]) => wrapApp(id, target));

function pkgApp(id, title, manager) {
  APPS[id] = {
    mount(el) {
      const packs = [
        { n: "neofetch", d: "system info" },
        { n: "htop", d: "process viewer" },
        { n: "vim", d: "editor" },
        { n: "git", d: "vcs" },
        { n: "curl", d: "transfer" },
        { n: "ffmpeg", d: "media" },
        { n: "libreoffice", d: "office" },
        { n: "vlc", d: "player" },
        { n: "gimp", d: "graphics" },
        { n: manager, d: "package manager" },
      ];
      let local = storeGet("pkgs-" + currentDistro().id, []);
      const paint = () => {
        el.innerHTML = `<div class="store-hero" style="background:linear-gradient(135deg,${currentDistro().color},${currentDistro().accent})">
          <h2 style="margin:0">${title}</h2>
          <div>${manager} · ${currentDistro().name} ${currentDistro().version}</div>
        </div>
        ${packs
          .map((p) => {
            const on = local.includes(p.n);
            return `<div class="app-card"><div class="grow"><b>${p.n}</b><small>${p.d}</small></div>
              <button class="btn ${on ? "" : "primary"}" data-p="${p.n}">${on ? t("installed") : manager + " install"}</button></div>`;
          })
          .join("")}`;
        el.querySelectorAll("[data-p]").forEach((b) => {
          b.onclick = async () => {
            if (!AUTH.isRoot()) {
              const ok = await AUTH.ask(manager + " install " + b.dataset.p);
              if (!ok) return;
            }
            if (!local.includes(b.dataset.p)) local.push(b.dataset.p);
            storeSet("pkgs-" + currentDistro().id, local);
            notify(manager, b.dataset.p, id);
            paint();
          };
        });
      };
      paint();
    },
  };
}

pkgApp("discover", "Discover", "apt");
pkgApp("synaptic", "Synaptic", "apt");
pkgApp("mintinstall", "Software Manager", "apt");
pkgApp("pop-shop", "Pop!_Shop", "apt");
pkgApp("appcenter", "AppCenter", "apt");
pkgApp("pamac", "Add/Remove Software", "pacman");
pkgApp("dnfdragora", "dnfdragora", "dnf");
pkgApp("yast", "YaST Software", "zypper");

APPS.timeshift = {
  mount(el) {
    let snaps = storeGet("timeshift", []);
    const paint = () => {
      el.innerHTML = `<div class="disclaimer">Timeshift — لقطات نظام الملفات داخل أوبنتو فقط</div>
        <div class="pad"><button class="btn primary" id="mk">${t("add")} snapshot</button></div>
        ${snaps
          .map(
            (s) =>
              `<div class="row"><div class="grow">${s.name}<small>${s.when} · ${s.nodes} nodes</small></div>
               <button class="ibtn" data-r="${s.id}">restore</button></div>`
          )
          .join("") || `<div class="empty">No snapshots</div>`}`;
      el.querySelector("#mk").onclick = async () => {
        const ok = await AUTH.ask("timeshift --create");
        if (!ok) return;
        const raw = VFS.raw;
        const snap = { id: Date.now(), name: "snapshot-" + new Date().toISOString().slice(0, 16), when: new Date().toLocaleString(), nodes: Object.keys(raw).length, data: raw };
        snaps.unshift(snap);
        snaps = snaps.slice(0, 8);
        storeSet("timeshift", snaps);
        notify("Timeshift", snap.name, "timeshift");
        paint();
      };
      el.querySelectorAll("[data-r]").forEach((b) => {
        b.onclick = async () => {
          const ok = await AUTH.ask("timeshift --restore");
          if (!ok) return;
          const s = snaps.find((x) => x.id == b.dataset.r);
          if (!s || !s.data) return;
          Object.keys(VFS.raw).forEach((k) => delete VFS.raw[k]);
          Object.assign(VFS.raw, s.data);
          await VFS.persist();
          notify("Timeshift", "restored " + s.name, "timeshift");
        };
      });
    };
    paint();
  },
};

const NATIVE_CATALOG = [
  "nautilus", "dolphin", "thunar", "pcmanfm", "caja", "nemo", "pantheon-files", "cosmic-files",
  "gnome-terminal", "konsole", "xfce4-terminal", "qterminal", "mate-terminal", "pantheon-terminal", "cosmic-term",
  "gedit", "kate", "kwrite", "mousepad", "featherpad", "pluma", "xed",
  "eog", "gwenview", "ristretto", "lximage", "pix", "photos", "parole",
  "evince", "okular", "atril", "kcalc", "ksysguard", "gnome-system-monitor",
  "ark", "engrampa", "epiphany", "firefox", "software", "gnome-software",
  "discover", "synaptic", "mintinstall", "pop-shop", "appcenter", "pamac", "dnfdragora", "yast", "timeshift",
];

NATIVE_CATALOG.forEach((id) => {
  if (!CATALOG.some((c) => c.id === id)) CATALOG.push({ id, cat: "native", score: 4.6 });
});
