const APPS = {};

function storeGet(k, d) {
  try {
    return JSON.parse(localStorage.getItem("oubento-" + k) || "null") ?? d;
  } catch {
    return d;
  }
}
function storeSet(k, v) {
  localStorage.setItem("oubento-" + k, JSON.stringify(v));
}

/* ---------------- Files ---------------- */
APPS.files = {
  mount(el, ctx) {
    let path = ctx.opts.path || "/home/oubento";
    let sel = null;
    const go = (p) => {
      path = VFS.norm(p);
      paint();
    };
    const paint = () => {
      ctx.setTitle(t("files"));
      const items = path === "/.trash" ? VFS.list("/.trash") : VFS.list(path);
      el.innerHTML = `
        <div class="files">
          <div class="toolbar">
            <button class="ibtn" id="up">↑</button>
            <button class="ibtn" id="home">${t("home")}</button>
            <button class="ibtn" id="newd">+</button>
            <button class="ibtn" id="newf">${t("createFile")}</button>
            <button class="ibtn" id="del">${t("delete")}</button>
            ${OS.state.clipboard ? `<button class="ibtn" id="pst">${t("paste")}</button>` : ""}
          </div>
          <div class="files-path">${path}</div>
          <div class="files-grid">
            ${items
              .map((it) => {
                const ic = it.type === "dir" ? "📁" : it.mime?.startsWith("image/") ? "🖼️" : it.mime?.startsWith("audio/") ? "🎵" : "📄";
                return `<button class="fitem ${sel === it.path ? "sel" : ""}" data-p="${it.path}">
                  <div class="fi">${ic}</div><div class="fn">${it.name}</div>
                </button>`;
              })
              .join("") || `<div class="empty">${path === "/.trash" ? t("trash") : "—"}</div>`}
          </div>
        </div>`;
      el.querySelector("#up").onclick = () => go(VFS.parent(path));
      el.querySelector("#home").onclick = () => go("/home/oubento");
      el.querySelector("#newd").onclick = async () => {
        const n = prompt(t("createFolder"), OS.settings.lang === "ar" ? "مجلد جديد" : "New folder");
        if (!n) return;
        await VFS.mkdir(path + "/" + n);
        paint();
      };
      el.querySelector("#newf").onclick = async () => {
        const n = prompt(t("createFile"), "note.txt");
        if (!n) return;
        await VFS.write(path + "/" + n, "");
        paint();
      };
      const pst = el.querySelector("#pst");
      if (pst) {
        pst.onclick = async () => {
          if (OS.state.clipboard) {
            await VFS.copy(OS.state.clipboard, path);
            paint();
          }
        };
      }
      el.querySelector("#del").onclick = async () => {
        if (!sel) return;
        await VFS.remove(sel, { toTrash: path !== "/.trash" });
        sel = null;
        notify(t("deleted"), "", "trash");
        paint();
        renderDeskIcons();
      };
      el.querySelectorAll(".fitem").forEach((b) => {
        b.onclick = () => {
          const n = VFS.stat(b.dataset.p);
          sel = b.dataset.p;
          openNode(b.dataset.p, n);
        };
        b.oncontextmenu = (e) => {
          e.preventDefault();
          sel = b.dataset.p;
          fileMenu(e.clientX, e.clientY, b.dataset.p, paint);
        };
      });
    };
    const openNode = (p, n) => {
      if (n.type === "dir") go(p);
      else if (n.mime?.startsWith("image/")) launch("gallery", { path: p, force: true });
      else if (n.mime?.startsWith("audio/")) launch("music", { path: p, force: true });
      else if (n.mime?.startsWith("video/")) launch("videos", { path: p, force: true });
      else launch("editor", { path: p, force: true });
    };
    paint();
  },
};

function fileMenu(x, y, p, refresh) {
  const m = document.getElementById("ctx");
  m.hidden = false;
  m.style.left = Math.min(x, innerWidth - 190) + "px";
  m.style.top = Math.min(y, innerHeight - 220) + "px";
  m.innerHTML = `
    <button data-a="open">${t("open")}</button>
    <button data-a="rename">${t("rename")}</button>
    <button data-a="copy">${t("copy")}</button>
    <button data-a="del">${t("delete")}</button>`;
  const hide = () => (m.hidden = true);
  setTimeout(() => document.addEventListener("click", hide, { once: true }));
  m.onclick = async (e) => {
    const a = e.target.dataset.a;
    if (a === "open") {
      const n = VFS.stat(p);
      if (n.type === "dir") launch("files", { path: p, force: true });
      else launch("editor", { path: p, force: true });
    }
    if (a === "rename") {
      const n = prompt(t("rename"), VFS.base(p));
      if (n) await VFS.rename(p, n);
    }
    if (a === "copy") OS.state.clipboard = p;
    if (a === "del") await VFS.remove(p);
    hide();
    refresh();
    renderDeskIcons();
  };
}

/* ---------------- Terminal ---------------- */
APPS.terminal = {
  mount(el) {
    let cwd = "/home/oubento";
    const hist = [];
    let hi = 0;
    const env = { USER: OS.user, HOME: "/home/oubento", HOST: OS.hostname, PATH: "/usr/bin" };
    el.innerHTML = `<div class="term"><div class="term-out" id="tout"></div>
      <div class="term-in"><span class="prompt" id="pr"></span><input id="tin" spellcheck="false"></div></div>`;
    const out = el.querySelector("#tout");
    const input = el.querySelector("#tin");
    const pr = el.querySelector("#pr");
    const prompt = () => {
      const short = cwd.replace("/home/oubento", "~");
      pr.textContent = `${OS.user}@${OS.hostname}:${short}$`;
    };
    const print = (s, cls = "") => {
      const d = document.createElement("div");
      if (cls) d.className = cls;
      d.textContent = s;
      out.appendChild(d);
      out.scrollTop = out.scrollHeight;
    };
    const html = (s) => {
      const d = document.createElement("div");
      d.innerHTML = s;
      out.appendChild(d);
      out.scrollTop = out.scrollHeight;
    };
    print(`Oubento ${OS.version} LTS (${OS.codename})`);
    print(`Type 'help' or 'neofetch'.`);
    prompt();
    input.focus();
    el.querySelector(".term").onclick = () => input.focus();

    const commands = {
      help: () =>
        "Available: ls cd pwd cat echo mkdir rm touch nano date whoami uname hostname clear history neofetch apt free df ps tree find grep head tail wc reboot shutdown lsb_release uname fortune cowsay man curl wget open weather calc htop top ip env export exit",
      ls: (a) => {
        const p = a[0] && !a[0].startsWith("-") ? resolve(a[0]) : cwd;
        return VFS.list(p)
          .map((i) => (i.type === "dir" ? i.name + "/" : i.name))
          .join("  ") || "";
      },
      ll: () =>
        VFS.list(cwd)
          .map((i) => `${i.type === "dir" ? "d" : "-"}rw-r--r--  ${String(i.size || 0).padStart(8)}  ${i.mtime?.slice(0, 16) || ""}  ${i.name}`)
          .join("\n"),
      cd: (a) => {
        const p = resolve(a[0] || env.HOME);
        if (!VFS.exists(p) || VFS.stat(p).type !== "dir") return "cd: no such directory";
        cwd = p;
        prompt();
        return "";
      },
      pwd: () => cwd,
      cat: (a) => {
        try {
          const c = VFS.read(resolve(a[0]));
          return typeof c === "string" && c.startsWith("data:") ? "[binary]" : String(c);
        } catch {
          return "cat: no such file";
        }
      },
      echo: (a) => a.join(" ").replace(/\$(\w+)/g, (_, k) => env[k] || ""),
      mkdir: async (a) => {
        try {
          await VFS.mkdir(resolve(a[0]));
          return "";
        } catch (e) {
          return "mkdir: " + e.message;
        }
      },
      touch: async (a) => {
        await VFS.write(resolve(a[0]), VFS.exists(resolve(a[0])) ? VFS.read(resolve(a[0])) : "");
        return "";
      },
      rm: async (a) => {
        try {
          await VFS.remove(resolve(a[a[0] === "-r" ? 1 : 0]));
          return "";
        } catch (e) {
          return "rm: " + e.message;
        }
      },
      date: () => new Date().toString(),
      whoami: () => OS.user,
      hostname: () => OS.hostname,
      uname: (a) => (a.includes("-a") ? `Linux ${OS.hostname} 6.8.0-oubento aarch64 GNU/Linux` : "Linux"),
      clear: () => {
        out.innerHTML = "";
        return "";
      },
      history: () => hist.map((c, i) => `${i + 1}  ${c}`).join("\n"),
      neofetch: () => {
        const u = VFS.usage();
        return [
          "            .-/ +osssssso+/-.            " + OS.user + "@" + OS.hostname,
          "        `:+ssssssssssssssssss+:`        -----------",
          "      -+ssssssssssssssssssyyssss+-      OS: Oubento " + OS.version + " LTS",
          "    .ossssssssssssssssssdMMMNysssso.    Host: Phone (Web Runtime)",
          "   /ssssssssssshdmmNNmmyNMMMMhssssss/   Kernel: 6.8.0-oubento",
          "  +ssssssssshmydMMMMMMMNddddyssssssss+  Uptime: " + Math.floor((Date.now() - OS.startedAt) / 60000) + " min",
          " /sssssssshNMMMyhhyyyyhmNMMMNhssssssss/ Shell: oush 1.0",
          ".ssssssssdMMMNhsssssssssshNMMMdssssssss. DE: GNOME / Yaru",
          "+sssshhhyNMMNyssssssssssssyNMMMysssssss+ WM: oubento-shell",
          "ossyNMMMNyMMhsssssssssssssshmmmhssssssso Theme: Yaru-dark",
          "ossyNMMMNyMMhsssssssssssssshmmmhssssssso Terminal: oush",
          "+sssshhhyNMMNyssssssssssssyNMMMysssssss+ CPU: WebCore",
          ".ssssssssdMMMNhsssssssssshNMMMdssssssss. Memory: " + fmtSize(u.bytes) + " files",
          " /sssssssshNMMMyhhyyyyhdNMMMNhssssssss/",
        ].join("\n");
      },
      apt: (a) => {
        if (a[0] === "update") return "Hit:1 oubento-repo noble InRelease\nReading package lists... Done";
        if (a[0] === "upgrade") return "0 upgraded, 0 newly installed.";
        if (a[0] === "install") {
          const id = a[1];
          if (id && CATALOG.some((c) => c.id === id)) {
            if (!isInstalled(id)) {
              OS.settings.installed.push(id);
              saveSettings();
            }
            return `Setting up ${id} ...\nProcessing triggers ... done.`;
          }
          return "E: Unable to locate package " + (a[1] || "");
        }
        if (a[0] === "list") return CATALOG.map((c) => c.id + "/noble " + (isInstalled(c.id) ? "[installed]" : "")).join("\n");
        return "apt 2.7.14 (oubento)\nusage: apt update|upgrade|install|list";
      },
      free: () => "               total        used        free\nMem:         8192000     2400000     5792000",
      df: () => {
        const u = VFS.usage();
        return `Filesystem     Size  Used Avail\nvfs            512M  ${fmtSize(u.bytes)}  rest`;
      },
      ps: () =>
        "PID TTY          TIME CMD\n  1 ?        00:00:01 systemd\n" +
        OS.state.windows.map((w, i) => `${120 + i} pts/0    00:00:00 ${w.app}`).join("\n"),
      top: () => commands.ps() + "\n%Cpu: 4.2  Mem: 29%",
      htop: () => commands.top(),
      tree: (a) => VFS.tree(a[0] ? resolve(a[0]) : cwd, 3),
      find: (a) => VFS.find(a[0] || "", cwd).map((i) => i.path).join("\n"),
      grep: (a) => {
        const q = a[0];
        const f = a[1] && resolve(a[1]);
        try {
          return String(VFS.read(f))
            .split("\n")
            .filter((l) => l.includes(q))
            .join("\n");
        } catch {
          return "grep: error";
        }
      },
      head: (a) => {
        try {
          return String(VFS.read(resolve(a[0] || a[1])))
            .split("\n")
            .slice(0, 10)
            .join("\n");
        } catch {
          return "";
        }
      },
      tail: (a) => {
        try {
          return String(VFS.read(resolve(a[0] || a[1])))
            .split("\n")
            .slice(-10)
            .join("\n");
        } catch {
          return "";
        }
      },
      wc: (a) => {
        try {
          const s = String(VFS.read(resolve(a[0])));
          return `${s.split("\n").length} ${s.split(/\s+/).length} ${s.length}`;
        } catch {
          return "0";
        }
      },
      lsb_release: () => `Distributor ID: Oubento\nDescription:    Oubento ${OS.version} LTS\nRelease:        24.04\nCodename:       noble`,
      fortune: () =>
        [
          "With great power comes great responsibility. Also sudo.",
          "There's no place like ~",
          "Have you tried turning it off and on again?",
          "Ubuntu is an ancient African word meaning 'I can't configure Debian'.",
        ][Math.floor(Math.random() * 4)],
      cowsay: (a) => {
        const m = a.join(" ") || "moo";
        return ` ${"_".repeat(m.length + 2)}\n< ${m} >\n ${"-".repeat(m.length + 2)}\n        \\   ^__^\n         \\  (oo)\\_______\n            (__)\\       )\\/\\\n                ||----w |\n                ||     ||`;
      },
      man: (a) => `Manual page ${a[0] || "oubento"} (1)\nA complete Ubuntu-like mobile operating environment.`,
      env: () => Object.entries(env).map(([k, v]) => `${k}=${v}`).join("\n"),
      export: (a) => {
        const [k, v] = (a[0] || "").split("=");
        if (k && v) env[k] = v;
        return "";
      },
      open: (a) => {
        launch("files", { path: resolve(a[0] || cwd), force: true });
        return "";
      },
      nano: (a) => {
        launch("editor", { path: resolve(a[0] || cwd + "/untitled.txt"), force: true });
        return "";
      },
      weather: async () => {
        try {
          const r = await fetch("https://api.open-meteo.com/v1/forecast?latitude=24.7&longitude=46.7&current_weather=true");
          const j = await r.json();
          return `Riyadh ${j.current_weather.temperature}°C  wind ${j.current_weather.windspeed}`;
        } catch {
          return "weather: offline";
        }
      },
      curl: async (a) => {
        try {
          const r = await fetch(a[0]);
          const t = await r.text();
          return t.slice(0, 800);
        } catch {
          return "curl: failed";
        }
      },
      wget: async (a) => {
        try {
          const r = await fetch(a[0]);
          const t = await r.text();
          const name = a[0].split("/").pop() || "index.html";
          await VFS.write("/home/oubento/Downloads/" + name, t, "text/plain");
          return `saved '${name}'`;
        } catch {
          return "wget: failed";
        }
      },
      ip: () => "wlan0: inet 192.168.1.42/24\nlo: inet 127.0.0.1/8",
      reboot: () => {
        location.reload();
        return "Rebooting...";
      },
      shutdown: () => {
        OS.state.locked = true;
        document.getElementById("lock").hidden = false;
        return "";
      },
      calc: (a) => {
        try {
          return String(Function(`"use strict";return (${a.join("")})`)());
        } catch {
          return "NaN";
        }
      },
      exit: () => {
        const w = OS.state.windows.find((x) => x.app === "terminal" && x.id === OS.state.active);
        if (w) closeWin(w.id);
        return "";
      },
    };

    function resolve(p) {
      if (!p) return cwd;
      if (p === "~") return env.HOME;
      if (p.startsWith("~/")) return env.HOME + p.slice(1);
      if (p.startsWith("/")) return VFS.norm(p);
      return VFS.norm(cwd + "/" + p);
    }

    async function run(line) {
      const parts = line.trim().split(/\s+/);
      const cmd = parts[0];
      const args = parts.slice(1);
      if (!cmd) return;
      print(`${pr.textContent} ${line}`);
      const fn = commands[cmd];
      if (!fn) {
        print(`${cmd}: command not found`, "err");
        return;
      }
      try {
        const res = await fn(args);
        if (res) print(res);
      } catch (e) {
        print(String(e.message || e), "err");
      }
    }

    input.addEventListener("keydown", async (e) => {
      if (e.key === "Enter") {
        const v = input.value;
        hist.push(v);
        hi = hist.length;
        input.value = "";
        await run(v);
      } else if (e.key === "ArrowUp") {
        if (hi > 0) input.value = hist[--hi] || "";
        e.preventDefault();
      } else if (e.key === "ArrowDown") {
        input.value = hist[++hi] || "";
      } else if (e.key === "Tab") {
        e.preventDefault();
        const names = Object.keys(commands).concat(VFS.list(cwd).map((i) => i.name));
        const cur = input.value.split(/\s+/).pop();
        const hit = names.find((n) => n.startsWith(cur));
        if (hit) input.value = input.value.replace(/[^\s]*$/, hit);
      } else if (e.key === "c" && e.ctrlKey) {
        input.value = "";
        print("^C");
      } else if (e.key === "l" && e.ctrlKey) {
        out.innerHTML = "";
      }
    });
  },
};

/* ---------------- Settings ---------------- */
APPS.settings = {
  mount(el) {
    const page = (name, inner) => {
      el.innerHTML = `<div class="settings">
        <div class="toolbar"><button class="ibtn" id="back">${t("settings")}</button><b>${name}</b></div>
        ${inner}
      </div>`;
      el.querySelector("#back").onclick = home;
    };
    const home = () => {
      el.innerHTML = `
        <div class="hero-about">
          <h2>Oubento ${OS.version}</h2>
          <div>${OS.codename} · ${t("tagline")}</div>
        </div>
        ${[
          ["appearance", t("appearance")],
          ["network", t("network")],
          ["sound", t("sound")],
          ["display", t("display")],
          ["language", t("language")],
          ["users", t("users")],
          ["notifications", t("notifications")],
          ["privacy", t("privacy")],
          ["power", t("power")],
          ["storage", t("storage")],
          ["about", t("about")],
        ]
          .map(
            ([id, label]) =>
              `<button class="row" data-p="${id}"><div class="icon-bubble" style="background:#5e2750">${svgIcon(id === "about" ? "about" : "settings")}</div><div class="grow">${label}</div>‹</button>`
          )
          .join("")}`;
      el.querySelectorAll("[data-p]").forEach((b) => (b.onclick = () => open(b.dataset.p)));
    };
    const toggle = (key) => {
      OS.settings[key] = !OS.settings[key];
      saveSettings();
      open(key === "wifi" || key === "bt" || key === "airplane" ? "network" : "appearance");
    };
    const open = (p) => {
      if (p === "appearance") {
        page(
          t("appearance"),
          `<div class="section">${t("wallpaper")}</div>
           <div class="wall-pick">${WALLS.map((w) => `<button data-w="${w}"><img src="${w}" alt=""></button>`).join("")}</div>
           <div class="card">
             <button class="row" id="th"><div class="grow">${t("dark")}</div><div class="switch ${OS.settings.theme === "dark" ? "on" : ""}"><i></i></div></button>
           </div>`
        );
        el.querySelectorAll("[data-w]").forEach((b) => {
          b.onclick = () => {
            OS.settings.wallpaper = b.dataset.w;
            saveSettings();
          };
        });
        el.querySelector("#th").onclick = () => {
          OS.settings.theme = OS.settings.theme === "dark" ? "light" : "dark";
          saveSettings();
          open("appearance");
        };
      } else if (p === "network") {
        page(
          t("network"),
          `<div class="card">
            ${["wifi", "bt", "airplane", "hotspot"]
              .map(
                (k) =>
                  `<button class="row" data-k="${k}"><div class="grow">${t(k)}</div><div class="switch ${OS.settings[k] ? "on" : ""}"><i></i></div></button>`
              )
              .join("")}
          </div>
          <div class="pad muted">${OS.settings.wifi ? "oubento-net  ·  WPA2  ·  192.168.1.42" : ""}</div>`
        );
        el.querySelectorAll("[data-k]").forEach((b) => (b.onclick = () => toggle(b.dataset.k)));
      } else if (p === "sound") {
        page(t("sound"), `<div class="pad"><div>${t("volume")}</div><input type="range" id="v" min="0" max="100" value="${OS.settings.volume}" style="width:100%"></div>`);
        el.querySelector("#v").oninput = (e) => {
          OS.settings.volume = +e.target.value;
          saveSettings();
        };
      } else if (p === "display") {
        page(t("display"), `<div class="pad"><div>${t("brightness")}</div><input type="range" id="b" min="40" max="120" value="${OS.settings.brightness}" style="width:100%"></div>`);
        el.querySelector("#b").oninput = (e) => {
          OS.settings.brightness = +e.target.value;
          saveSettings();
        };
      } else if (p === "language") {
        page(
          t("language"),
          `<div class="card">
            <button class="row" data-l="ar"><div class="grow">${t("arabic")}</div>${OS.settings.lang === "ar" ? "✓" : ""}</button>
            <button class="row" data-l="en"><div class="grow">${t("english")}</div>${OS.settings.lang === "en" ? "✓" : ""}</button>
          </div>`
        );
        el.querySelectorAll("[data-l]").forEach((b) => {
          b.onclick = () => {
            OS.settings.lang = b.dataset.l;
            if (b.dataset.l === "en") OS.settings.displayName = "Oubento";
            else OS.settings.displayName = "أوبنتو";
            saveSettings();
            renderDesktop();
            applyChrome();
            launch("settings");
          };
        });
      } else if (p === "users") {
        page(
          t("users"),
          `<div class="pad">
            <input class="field" id="dn" value="${OS.settings.displayName}">
            <p></p>
            <input class="field" id="pw" type="password" placeholder="${t("password")}">
            <p></p>
            <button class="btn primary" id="sv">${t("save")}</button>
          </div>`
        );
        el.querySelector("#sv").onclick = () => {
          OS.settings.displayName = el.querySelector("#dn").value;
          OS.settings.pin = el.querySelector("#pw").value;
          saveSettings();
          notify(t("saved"), "", "users");
        };
      } else if (p === "notifications") {
        page(t("notifications"), `<div class="pad">${OS.state.notifs.length} — ${t("notifications")}</div>`);
      } else if (p === "privacy") {
        page(t("privacy"), `<div class="card">
          <button class="row" id="loc"><div class="grow">${t("locate")}</div><div class="switch ${OS.settings.locate ? "on" : ""}"><i></i></div></button>
        </div>`);
        el.querySelector("#loc").onclick = () => toggle("locate");
      } else if (p === "power") {
        page(
          t("power"),
          `<div class="pad">
            <button class="btn" id="lockb" style="width:100%;margin-bottom:8px">${t("unlock") === "دخول" ? "قفل الشاشة" : "Lock"}</button>
            <button class="btn danger" id="off" style="width:100%">${OS.settings.lang === "ar" ? "إعادة التشغيل" : "Restart"}</button>
          </div>`
        );
        el.querySelector("#lockb").onclick = () => {
          OS.state.locked = true;
          document.getElementById("lock").hidden = false;
        };
        el.querySelector("#off").onclick = () => location.reload();
      } else if (p === "storage") {
        const u = VFS.usage();
        page(t("storage"), `<div class="pad"><b>${fmtSize(u.bytes)}</b> / 512 MB<br>${u.files} ${t("files")} · ${u.dirs} ${OS.settings.lang === "ar" ? "مجلدات" : "folders"}</div>`);
      } else if (p === "about") {
        page(
          t("about"),
          `<div class="hero-about"><h2>Oubento</h2><div>Ubuntu-compatible mobile OS</div></div>
           <div class="card">
             <div class="row"><div class="grow">Version</div>${OS.version} LTS</div>
             <div class="row"><div class="grow">Codename</div>${OS.codename}</div>
             <div class="row"><div class="grow">GNOME</div>46 (Yaru)</div>
             <div class="row"><div class="grow">Kernel</div>6.8.0-oubento</div>
             <div class="row"><div class="grow">Device</div>${navigator.userAgent.split("(")[1]?.split(")")[0] || "Phone"}</div>
           </div>`
        );
      }
    };
    home();
  },
};

/* ---------------- Browser ---------------- */
APPS.browser = {
  mount(el) {
    const marks = storeGet("bookmarks", [
      { t: "Ubuntu", u: "https://ubuntu.com" },
      { t: "Wikipedia", u: "https://ar.wikipedia.org" },
      { t: "DuckDuckGo", u: "https://duckduckgo.com/html/?q=أوبنتو" },
      { t: "OpenStreetMap", u: "https://www.openstreetmap.org/export/embed.html" },
    ]);
    const start = () => {
      el.innerHTML = `<div class="browser">
        <div class="toolbar"><input id="url" placeholder="${t("searchWeb")}"><button class="btn primary" id="go">→</button></div>
        <div class="start-page">
          <h2>Oubento Web</h2>
          <div class="chips">${marks.map((m) => `<button class="chip" data-u="${m.u}">${m.t}</button>`).join("")}</div>
          <p class="section">${t("bookmarks")}</p>
        </div>
      </div>`;
      bind();
    };
    const open = (raw) => {
      let u = raw.trim();
      if (!/^https?:/i.test(u)) u = "https://duckduckgo.com/html/?q=" + encodeURIComponent(u);
      el.innerHTML = `<div class="browser">
        <div class="toolbar">
          <button class="ibtn" id="homeb">⌂</button>
          <input id="url" value="${u}">
          <button class="btn primary" id="go">→</button>
        </div>
        <iframe src="${u}" sandbox="allow-scripts allow-same-origin allow-forms allow-popups"></iframe>
      </div>`;
      bind();
      el.querySelector("#homeb").onclick = start;
    };
    const bind = () => {
      const run = () => open(el.querySelector("#url").value);
      el.querySelector("#go").onclick = run;
      el.querySelector("#url").addEventListener("keydown", (e) => e.key === "Enter" && run());
      el.querySelectorAll("[data-u]").forEach((b) => (b.onclick = () => open(b.dataset.u)));
    };
    start();
  },
};

/* ---------------- Calculator ---------------- */
APPS.calculator = {
  mount(el) {
    let cur = "0",
      acc = null,
      op = null,
      fresh = true;
    const keys = ["C", "±", "%", "÷", "7", "8", "9", "×", "4", "5", "6", "−", "1", "2", "3", "+", "0", ".", "⌫", "="];
    el.innerHTML = `<div class="calc"><div class="calc-disp"><div class="calc-sub" id="sub"></div><div id="disp">0</div></div>
      <div class="calc-keys">${keys
        .map((k) => {
          const cls = "÷×−+".includes(k) ? "op" : k === "=" ? "eq" : "C±%⌫".includes(k) ? "fn" : "";
          return `<button class="${cls}" data-k="${k}">${k}</button>`;
        })
        .join("")}</div></div>`;
    const disp = el.querySelector("#disp");
    const sub = el.querySelector("#sub");
    const n = () => parseFloat(cur);
    const apply = () => {
      const b = n();
      if (op === "+") acc += b;
      else if (op === "−") acc -= b;
      else if (op === "×") acc *= b;
      else if (op === "÷") acc = b === 0 ? NaN : acc / b;
      else acc = b;
      cur = String(acc);
      fresh = true;
    };
    el.querySelectorAll("[data-k]").forEach((b) => {
      b.onclick = () => {
        const k = b.dataset.k;
        if (/[0-9]/.test(k)) {
          cur = fresh || cur === "0" ? k : cur + k;
          fresh = false;
        } else if (k === ".") {
          if (!cur.includes(".")) cur += ".";
          fresh = false;
        } else if (k === "C") {
          cur = "0";
          acc = op = null;
        } else if (k === "⌫") cur = cur.length > 1 ? cur.slice(0, -1) : "0";
        else if (k === "±") cur = String(-n());
        else if (k === "%") cur = String(n() / 100);
        else if ("÷×−+".includes(k)) {
          if (op && !fresh) apply();
          else acc = n();
          op = k;
          fresh = true;
        } else if (k === "=") {
          apply();
          op = null;
        }
        disp.textContent = cur;
        sub.textContent = acc != null && op ? acc + " " + op : "";
      };
    });
  },
};

/* ---------------- Editor / Writer / Code / Notes ---------------- */
function textApp(el, ctx, key, mono = false) {
  const path = ctx.opts.path || `/home/oubento/Documents/${key}-${Date.now()}.txt`;
  let content = "";
  try {
    if (VFS.exists(path)) content = VFS.read(path);
  } catch {}
  if (typeof content !== "string") content = "";
  el.innerHTML = `<div class="editor">
    <div class="toolbar"><span class="grow">${VFS.base(path)}</span><button class="btn primary" id="sv">${t("save")}</button></div>
    <textarea class="${mono ? "code-ed" : ""}" id="tx">${content.replace(/</g, "&lt;")}</textarea>
  </div>`;
  const tx = el.querySelector("#tx");
  tx.value = content;
  el.querySelector("#sv").onclick = async () => {
    await VFS.write(path, tx.value, "text/plain");
    notify(t("saved"), VFS.base(path), "editor");
  };
}
APPS.editor = { mount: (el, ctx) => textApp(el, ctx, "note") };
APPS.writer = {
  mount(el, ctx) {
    const docs = storeGet("writer", { title: t("welcomeTitle"), body: t("welcomeBody") });
    el.innerHTML = `<div class="editor">
      <div class="toolbar"><input id="tt" value="${docs.title}"><button class="btn primary" id="sv">${t("save")}</button></div>
      <textarea id="tx" style="font-size:16px">${docs.body}</textarea>
    </div>`;
    el.querySelector("#sv").onclick = async () => {
      const title = el.querySelector("#tt").value;
      const body = el.querySelector("#tx").value;
      storeSet("writer", { title, body });
      await VFS.write("/home/oubento/Documents/" + title.replace(/\s+/g, "_") + ".odt.txt", body);
      notify(t("saved"), title, "writer");
    };
  },
};
APPS.code = { mount: (el, ctx) => textApp(el, ctx, "code", true) };
APPS.notes = {
  mount(el) {
    let notes = storeGet("notes", [{ id: 1, title: t("welcomeTitle"), body: t("welcomeBody") }]);
    const list = () => {
      el.innerHTML = `<div class="toolbar"><b>${t("notes")}</b><button class="btn primary" id="n">+</button></div>
        ${notes.map((n) => `<button class="row" data-id="${n.id}"><div class="grow">${n.title}<small>${(n.body || "").slice(0, 60)}</small></div></button>`).join("")}`;
      el.querySelector("#n").onclick = () => {
        const n = { id: Date.now(), title: t("new"), body: "" };
        notes.unshift(n);
        storeSet("notes", notes);
        edit(n.id);
      };
      el.querySelectorAll("[data-id]").forEach((b) => (b.onclick = () => edit(+b.dataset.id)));
    };
    const edit = (id) => {
      const n = notes.find((x) => x.id === id);
      el.innerHTML = `<div class="notes-ed">
        <div class="toolbar"><button class="ibtn" id="back">‹</button>
          <input id="tt" value="${n.title}"><button class="ibtn" id="rm">${t("delete")}</button></div>
        <textarea id="tx">${n.body}</textarea></div>`;
      const save = () => {
        n.title = el.querySelector("#tt").value;
        n.body = el.querySelector("#tx").value;
        storeSet("notes", notes);
      };
      el.querySelector("#tx").oninput = save;
      el.querySelector("#tt").oninput = save;
      el.querySelector("#back").onclick = list;
      el.querySelector("#rm").onclick = () => {
        notes = notes.filter((x) => x.id !== id);
        storeSet("notes", notes);
        list();
      };
    };
    list();
  },
};

/* ---------------- Calendar / Clock / Todo ---------------- */
APPS.calendar = {
  mount(el) {
    let view = new Date();
    const events = storeGet("events", []);
    const paint = () => {
      const y = view.getFullYear(),
        m = view.getMonth();
      const first = new Date(y, m, 1).getDay();
      const days = new Date(y, m + 1, 0).getDate();
      const cells = [];
      for (let i = 0; i < first; i++) cells.push("<div></div>");
      const today = new Date();
      for (let d = 1; d <= days; d++) {
        const isT = today.getDate() === d && today.getMonth() === m && today.getFullYear() === y;
        const key = `${y}-${m + 1}-${d}`;
        const has = events.some((e) => e.day === key);
        cells.push(`<button class="${isT ? "today" : ""}" data-d="${key}">${d}${has ? '<div class="event-dot"></div>' : ""}</button>`);
      }
      const L = I18N[OS.settings.lang];
      el.innerHTML = `<div class="cal-head">
        <button class="ibtn" id="p">‹</button>
        <b>${L.months[m]} ${y}</b>
        <button class="ibtn" id="n">›</button>
      </div>
      <div class="cal-grid">${L.days.map((d) => `<b>${d}</b>`).join("")}${cells.join("")}</div>
      <div class="pad"><button class="btn primary" id="ad">${t("addEvent")}</button>
        <div id="evs"></div></div>`;
      el.querySelector("#p").onclick = () => {
        view.setMonth(m - 1);
        paint();
      };
      el.querySelector("#n").onclick = () => {
        view.setMonth(m + 1);
        paint();
      };
      el.querySelector("#ad").onclick = () => {
        const day = prompt(t("addEvent") + " YYYY-M-D", `${y}-${m + 1}-${today.getDate()}`);
        const title = prompt(t("events"));
        if (day && title) {
          events.push({ day, title });
          storeSet("events", events);
          paint();
        }
      };
      el.querySelectorAll("[data-d]").forEach((b) => {
        b.onclick = () => {
          const list = events.filter((e) => e.day === b.dataset.d);
          el.querySelector("#evs").innerHTML = list.map((e) => `<div class="row">${e.title}</div>`).join("") || `<div class="empty">${t("events")}</div>`;
        };
      });
    };
    paint();
  },
};

APPS.clock = {
  mount(el) {
    let tab = "world";
    let sw = 0,
      swT = null,
      tm = 60,
      tmT = null;
    const paint = () => {
      el.innerHTML = `<div class="toolbar">
        ${["world", "alarm", "stopwatch", "timer"].map((k) => `<button class="ibtn ${tab === k ? "primary btn" : ""}" data-t="${k}">${t(k)}</button>`).join("")}
      </div><div id="cbody" class="pad"></div>`;
      el.querySelectorAll("[data-t]").forEach((b) => (b.onclick = () => {
        tab = b.dataset.t;
        paint();
      }));
      const body = el.querySelector("#cbody");
      if (tab === "world") {
        const cities = [
          ["الرياض", 3],
          ["القاهرة", 2],
          ["لندن", 0],
          ["نيويورك", -4],
          ["طوكيو", 9],
        ];
        const now = new Date();
        body.innerHTML = cities
          .map(([n, o]) => {
            const d = new Date(now.getTime() + o * 3600000 + now.getTimezoneOffset() * 60000);
            return `<div class="row"><div class="grow">${n}</div><b>${d.toISOString().slice(11, 16)}</b></div>`;
          })
          .join("");
      } else if (tab === "alarm") {
        const alarms = storeGet("alarms", []);
        body.innerHTML = `${alarms.map((a) => `<div class="row"><div class="grow">${a.time}<small>${a.label || ""}</small></div></div>`).join("")}
          <button class="btn primary" id="aa">${t("add")}</button>`;
        body.querySelector("#aa").onclick = () => {
          const time = prompt("HH:MM", "07:00");
          if (time) {
            alarms.push({ time, label: t("alarm"), fired: false });
            storeSet("alarms", alarms);
            paint();
          }
        };
      } else if (tab === "stopwatch") {
        body.innerHTML = `<div style="font-size:48px;text-align:center" id="sw">${(sw / 100).toFixed(2)}</div>
          <div class="grid-2"><button class="btn primary" id="st">${t("start")}</button><button class="btn" id="rs">${t("reset")}</button></div>`;
        body.querySelector("#st").onclick = () => {
          if (swT) {
            clearInterval(swT);
            swT = null;
          } else {
            swT = setInterval(() => {
              sw++;
              const s = el.querySelector("#sw");
              if (s) s.textContent = (sw / 100).toFixed(2);
            }, 10);
          }
        };
        body.querySelector("#rs").onclick = () => {
          sw = 0;
          paint();
        };
      } else {
        body.innerHTML = `<div style="font-size:48px;text-align:center" id="tm">${tm}s</div>
          <div class="grid-2"><button class="btn primary" id="st">${t("start")}</button><button class="btn" id="rs">${t("reset")}</button></div>`;
        body.querySelector("#st").onclick = () => {
          if (tmT) return;
          tmT = setInterval(() => {
            tm--;
            const s = el.querySelector("#tm");
            if (s) s.textContent = tm + "s";
            if (tm <= 0) {
              clearInterval(tmT);
              tmT = null;
              notify(t("timer"), t("done"), "clock");
              beep();
            }
          }, 1000);
        };
        body.querySelector("#rs").onclick = () => {
          tm = 60;
          paint();
        };
      }
    };
    paint();
  },
};

APPS.todo = {
  mount(el) {
    let items = storeGet("todo", [{ id: 1, text: t("welcomeTitle"), done: false }]);
    const paint = () => {
      el.innerHTML = `<div class="toolbar"><input id="n" placeholder="${t("task")}"><button class="btn primary" id="a">+</button></div>
        ${items
          .map(
            (i) =>
              `<button class="row" data-id="${i.id}"><div class="grow" style="${i.done ? "text-decoration:line-through;opacity:.6" : ""}">${i.text}</div>${i.done ? "✓" : ""}</button>`
          )
          .join("")}`;
      el.querySelector("#a").onclick = () => {
        const text = el.querySelector("#n").value.trim();
        if (!text) return;
        items.unshift({ id: Date.now(), text, done: false });
        storeSet("todo", items);
        paint();
      };
      el.querySelectorAll("[data-id]").forEach((b) => {
        b.onclick = () => {
          const i = items.find((x) => x.id == b.dataset.id);
          i.done = !i.done;
          storeSet("todo", items);
          paint();
        };
      });
    };
    paint();
  },
};

/* ---------------- Weather / Maps ---------------- */
APPS.weather = {
  async mount(el) {
    el.innerHTML = `<div class="pad">${t("weather")}…</div>`;
    const pos = await new Promise((res) => {
      if (!OS.settings.locate || !navigator.geolocation) return res({ lat: 24.7136, lon: 46.6753, name: "Riyadh" });
      navigator.geolocation.getCurrentPosition(
        (p) => res({ lat: p.coords.latitude, lon: p.coords.longitude, name: "" }),
        () => res({ lat: 24.7136, lon: 46.6753, name: "Riyadh" })
      );
    });
    try {
      const r = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${pos.lat}&longitude=${pos.lon}&current_weather=true&daily=temperature_2m_max,temperature_2m_min,weathercode&timezone=auto`
      );
      const j = await r.json();
      const c = j.current_weather;
      const days = j.daily.time
        .map(
          (d, i) =>
            `<div class="row"><div class="grow">${d}</div>${j.daily.temperature_2m_min[i]}° / ${j.daily.temperature_2m_max[i]}°</div>`
        )
        .join("");
      el.innerHTML = `<div class="weather-hero"><div>${pos.name || t("weather")}</div>
        <div class="t">${Math.round(c.temperature)}°</div>
        <div>Wind ${c.windspeed} km/h</div></div>
        <div class="days">${days}</div>`;
    } catch {
      el.innerHTML = `<div class="empty">${t("offline")}</div>`;
    }
  },
};

APPS.maps = {
  mount(el) {
    el.innerHTML = `<div class="maps" style="height:100%"><iframe src="https://www.openstreetmap.org/export/embed.html?bbox=46.5,24.5,46.9,24.9&layer=mapnik"></iframe></div>`;
  },
};

/* ---------------- Media ---------------- */
APPS.gallery = {
  mount(el, ctx) {
    const pics = VFS.find("", "/home/oubento/Pictures").filter((f) => f.type === "file" && (f.mime?.startsWith("image/") || String(f.content).startsWith("data:image")));
    if (ctx.opts.path) {
      const n = VFS.stat(ctx.opts.path);
      el.innerHTML = `<img src="${n.content}" style="width:100%;height:100%;object-fit:contain;background:#111">`;
      return;
    }
    el.innerHTML = `<div class="files-grid" style="grid-template-columns:repeat(3,1fr)">
      ${
        pics
          .map(
            (p) =>
              `<button class="fitem" data-p="${p.path}"><img src="${typeof p.content === "string" ? p.content : ""}" style="height:88px;width:100%;object-fit:cover;border-radius:10px"><div class="fn">${p.name}</div></button>`
          )
          .join("") || `<div class="empty">${t("gallery")}</div>`
      }
      ${WALLS.map((w, i) => `<button class="fitem" data-w="${w}"><img src="${w}" style="height:88px;width:100%;object-fit:cover;border-radius:10px"><div class="fn">Wallpaper ${i + 1}</div></button>`).join("")}
    </div>`;
    el.querySelectorAll("[data-p]").forEach((b) => (b.onclick = () => launch("gallery", { path: b.dataset.p, force: true })));
    el.querySelectorAll("[data-w]").forEach((b) => {
      b.onclick = () => {
        el.innerHTML = `<img src="${b.dataset.w}" style="width:100%;height:100%;object-fit:contain;background:#111">`;
      };
    });
  },
};

APPS.camera = {
  async mount(el) {
    el.innerHTML = `<div class="cam"><video id="v" autoplay playsinline></video><div class="cam-bar"><button class="shutter" id="sh"></button></div></div>`;
    const v = el.querySelector("#v");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      v.srcObject = stream;
      el.querySelector("#sh").onclick = async () => {
        const c = document.createElement("canvas");
        c.width = v.videoWidth || 720;
        c.height = v.videoHeight || 1280;
        c.getContext("2d").drawImage(v, 0, 0);
        const data = c.toDataURL("image/jpeg", 0.9);
        await VFS.write(`/home/oubento/Pictures/IMG_${Date.now()}.jpg`, data, "image/jpeg");
        notify(t("saved"), t("camera"), "gallery");
      };
    } catch {
      el.innerHTML = `<div class="empty">${t("needCam")}</div>`;
    }
  },
};

APPS.recorder = {
  async mount(el) {
    let rec = null,
      chunks = [];
    el.innerHTML = `<div class="pad" style="text-align:center">
      <div class="cover">🎙</div>
      <button class="btn primary" id="r">${t("recStart")}</button>
      <div id="clips"></div>
    </div>`;
    const clips = () => {
      const list = VFS.list("/home/oubento/Music").filter((f) => f.mime?.startsWith("audio/") || f.name.endsWith(".webm"));
      el.querySelector("#clips").innerHTML = list.map((f) => `<div class="row">${f.name}</div>`).join("");
    };
    clips();
    el.querySelector("#r").onclick = async () => {
      if (rec) {
        rec.stop();
        rec = null;
        el.querySelector("#r").textContent = t("recStart");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        rec = new MediaRecorder(stream);
        chunks = [];
        rec.ondataavailable = (e) => chunks.push(e.data);
        rec.onstop = async () => {
          const blob = new Blob(chunks, { type: "audio/webm" });
          const reader = new FileReader();
          reader.onload = async () => {
            await VFS.write(`/home/oubento/Music/REC_${Date.now()}.webm`, reader.result, "audio/webm");
            clips();
          };
          reader.readAsDataURL(blob);
        };
        rec.start();
        el.querySelector("#r").textContent = t("recStop");
      } catch {
        notify(t("needMic"), "", "recorder");
      }
    };
  },
};

APPS.music = {
  mount(el, ctx) {
    const tracks = [
      { name: "Oubento Amber", freq: [261, 329, 392] },
      { name: "Noble Nights", freq: [220, 277, 330] },
      { name: "Yaru Pulse", freq: [196, 247, 294] },
    ];
    let ctxA = null,
      nodes = [],
      idx = 0,
      on = false;
    const stop = () => {
      nodes.forEach((n) => {
        try {
          n.stop();
        } catch {}
      });
      nodes = [];
      on = false;
    };
    const play = (i) => {
      stop();
      idx = i;
      ctxA = ctxA || new (window.AudioContext || window.webkitAudioContext)();
      tracks[i].freq.forEach((f, k) => {
        const o = ctxA.createOscillator();
        const g = ctxA.createGain();
        o.type = k ? "triangle" : "sine";
        o.frequency.value = f;
        g.gain.value = (OS.settings.volume / 100) * 0.08;
        o.connect(g);
        g.connect(ctxA.destination);
        o.start();
        nodes.push(o);
      });
      on = true;
      paint();
    };
    const paint = () => {
      el.innerHTML = `<div class="player">
        <div class="cover">♪</div>
        <h2 style="text-align:center;margin:0">${tracks[idx].name}</h2>
        <input class="seek" type="range" value="30">
        <div class="grid-2">
          <button class="btn" id="pv">${t("prev")}</button>
          <button class="btn primary" id="pp">${on ? t("pause") : t("play")}</button>
        </div>
        ${tracks.map((tr, i) => `<button class="row" data-i="${i}"><div class="grow">${tr.name}</div></button>`).join("")}
        <p class="section">${t("musicFolder")}</p>
        <input type="file" id="up" accept="audio/*">
        <audio id="au" controls style="width:100%;margin-top:8px"></audio>
      </div>`;
      el.querySelector("#pp").onclick = () => (on ? (stop(), paint()) : play(idx));
      el.querySelector("#pv").onclick = () => play((idx + tracks.length - 1) % tracks.length);
      el.querySelectorAll("[data-i]").forEach((b) => (b.onclick = () => play(+b.dataset.i)));
      el.querySelector("#up").onchange = (e) => {
        const f = e.target.files[0];
        if (!f) return;
        el.querySelector("#au").src = URL.createObjectURL(f);
        el.querySelector("#au").play();
        stop();
      };
    };
    paint();
    if (ctx.opts.path) {
      try {
        const n = VFS.read(ctx.opts.path);
        setTimeout(() => {
          const au = el.querySelector("#au");
          if (au && typeof n === "string") au.src = n;
        }, 50);
      } catch {}
    }
  },
};

APPS.videos = {
  mount(el) {
    el.innerHTML = `<div class="pad">
      <p>${t("videos")}</p>
      <input type="file" id="up" accept="video/*">
      <video id="v" controls style="width:100%;margin-top:12px;border-radius:12px;background:#000"></video>
    </div>`;
    el.querySelector("#up").onchange = (e) => {
      const f = e.target.files[0];
      if (f) el.querySelector("#v").src = URL.createObjectURL(f);
    };
  },
};

/* ---------------- Contacts / Messages / Mail ---------------- */
APPS.contacts = {
  mount(el) {
    let list = storeGet("contacts", [
      { id: 1, name: "أوبنتو", phone: "100", mail: "hello@oubento.os" },
      { id: 2, name: "Canonical", phone: "200", mail: "info@ubuntu.com" },
    ]);
    const paint = () => {
      el.innerHTML = `<div class="toolbar"><b>${t("contacts")}</b><button class="btn primary" id="a">+</button></div>
        ${list
          .map((c) => {
            const col = ["#e95420", "#1c71d8", "#26a269"][c.id % 3];
            return `<button class="row" data-id="${c.id}"><div class="avatar-sm" style="background:${col}">${c.name[0]}</div>
              <div class="grow">${c.name}<small>${c.phone} · ${c.mail}</small></div></button>`;
          })
          .join("")}`;
      el.querySelector("#a").onclick = () => {
        const name = prompt(t("contacts"));
        const phone = prompt("Tel");
        if (name) {
          list.push({ id: Date.now(), name, phone: phone || "", mail: "" });
          storeSet("contacts", list);
          paint();
        }
      };
    };
    paint();
  },
};

APPS.messages = {
  mount(el) {
    let threads = storeGet("msg", [
      { id: 1, who: "Oubento", text: t("welcomeBody") },
    ]);
    const paint = () => {
      el.innerHTML = `${threads.map((m) => `<div class="row"><div class="grow"><b>${m.who}</b><small>${m.text}</small></div></div>`).join("")}
        <div class="toolbar"><input id="tx" placeholder="${t("messages")}"><button class="btn primary" id="s">${t("send")}</button></div>`;
      el.querySelector("#s").onclick = () => {
        const text = el.querySelector("#tx").value.trim();
        if (!text) return;
        threads.push({ id: Date.now(), who: OS.settings.displayName, text });
        storeSet("msg", threads);
        paint();
      };
    };
    paint();
  },
};

APPS.mail = {
  mount(el) {
    let mails = storeGet("mail", [
      { id: 1, from: "noreply@oubento.os", sub: t("welcomeTitle"), body: t("welcomeBody") },
    ]);
    const inbox = () => {
      el.innerHTML = `<div class="toolbar"><b>${t("inbox")}</b><button class="btn primary" id="c">${t("compose")}</button></div>
        ${mails.map((m) => `<button class="row" data-id="${m.id}"><div class="grow">${m.sub}<small>${m.from}</small></div></button>`).join("")}`;
      el.querySelector("#c").onclick = compose;
      el.querySelectorAll("[data-id]").forEach((b) => {
        b.onclick = () => {
          const m = mails.find((x) => x.id == b.dataset.id);
          el.innerHTML = `<div class="pad"><button class="ibtn" id="b">‹</button><h3>${m.sub}</h3><small>${m.from}</small><p>${m.body}</p></div>`;
          el.querySelector("#b").onclick = inbox;
        };
      });
    };
    const compose = () => {
      el.innerHTML = `<div class="pad">
        <input class="field" id="to" placeholder="to@mail">
        <p></p><input class="field" id="su" placeholder="${t("subject")}">
        <p></p><textarea class="field" id="bo" style="min-height:160px"></textarea>
        <p></p><button class="btn primary" id="s">${t("send")}</button>
      </div>`;
      el.querySelector("#s").onclick = () => {
        mails.unshift({ id: Date.now(), from: OS.user + "@oubento.os", sub: el.querySelector("#su").value, body: el.querySelector("#bo").value });
        storeSet("mail", mails);
        notify(t("send"), t("mail"), "mail");
        inbox();
      };
    };
    inbox();
  },
};

/* ---------------- Spreadsheet ---------------- */
APPS.calcSheet = {
  mount(el) {
    const cols = 8,
      rows = 16;
    let data = storeGet("sheet", {});
    const key = (r, c) => r + ":" + c;
    const letters = "ABCDEFGH";
    let html = `<div class="toolbar"><button class="btn primary" id="sv">${t("save")}</button></div>
      <div style="overflow:auto;height:calc(100% - 48px)"><table class="sheet-table"><tr><th></th>`;
    for (let c = 0; c < cols; c++) html += `<th>${letters[c]}</th>`;
    html += "</tr>";
    for (let r = 1; r <= rows; r++) {
      html += `<tr><th>${r}</th>`;
      for (let c = 0; c < cols; c++) html += `<td contenteditable="true" data-k="${key(r, c)}">${data[key(r, c)] || ""}</td>`;
      html += "</tr>";
    }
    html += "</table></div>";
    el.innerHTML = html;
    el.querySelectorAll("td").forEach((td) => {
      td.oninput = () => (data[td.dataset.k] = td.textContent);
    });
    el.querySelector("#sv").onclick = async () => {
      storeSet("sheet", data);
      await VFS.write("/home/oubento/Documents/Sheet.csv", Object.entries(data).map(([k, v]) => k + "," + v).join("\n"));
      notify(t("saved"), t("calcSheet"), "calcSheet");
    };
  },
};

/* ---------------- System apps ---------------- */
APPS.monitor = {
  mount(el) {
    const paint = () => {
      const mem = performance.memory;
      const ram = mem ? Math.round((mem.usedJSHeapSize / mem.jsHeapSizeLimit) * 100) : 32 + Math.round(Math.random() * 8);
      const cpu = 6 + Math.round(Math.random() * 18);
      const u = VFS.usage();
      el.innerHTML = `<div class="mon-grid">
        <div class="stat"><small>${t("cpu")}</small><b>${cpu}%</b><div class="bar"><i style="width:${cpu}%"></i></div></div>
        <div class="stat"><small>${t("ram")}</small><b>${ram}%</b><div class="bar"><i style="width:${ram}%"></i></div></div>
        <div class="stat"><small>${t("storage")}</small><b>${fmtSize(u.bytes)}</b><div class="bar"><i style="width:${Math.min(100, u.bytes / 50000)}%"></i></div></div>
        <div class="stat"><small>${t("battery")}</small><b id="bat">—</b><div class="bar"><i id="batb"></i></div></div>
      </div>
      <div class="section">Processes</div>
      ${["oubento-shell", "gnome-session", ...OS.state.windows.map((w) => w.app)].map((p) => `<div class="row"><div class="grow">${p}</div>running</div>`).join("")}`;
      batteryInfo().then((b) => {
        if (!b) return;
        const p = Math.round(b.level * 100);
        const e = el.querySelector("#bat");
        const bb = el.querySelector("#batb");
        if (e) e.textContent = p + "%";
        if (bb) bb.style.width = p + "%";
      });
    };
    paint();
    const iv = setInterval(paint, 1500);
    el.addEventListener("DOMNodeRemoved", () => clearInterval(iv), { once: true });
  },
};

APPS.disks = {
  mount(el) {
    const u = VFS.usage();
    el.innerHTML = `<div class="pad">
      <div class="stat"><small>vfs /</small><b>${fmtSize(u.bytes)} / 512 MB</b>
      <div class="bar"><i style="width:${Math.min(99, (u.bytes / (512 * 1024 * 1024)) * 100 + 8)}%"></i></div></div>
      <div class="row"><div class="grow">ext4</div>oubento-root</div>
      <div class="row"><div class="grow">tmpfs</div>/tmp</div>
    </div>`;
  },
};

APPS.logs = {
  mount(el) {
    el.innerHTML = `<div class="term" style="height:100%"><div class="term-out">${(OS.state.logs.join("\n") || "no logs")
      .replace(/</g, "&lt;")
      .replace(/\n/g, "<br>")}</div></div>`;
  },
};

APPS.updater = {
  mount(el) {
    el.innerHTML = `<div class="pad" style="text-align:center">
      <div class="cover" style="font-size:42px">↓</div>
      <h2>${t("updateReady")}</h2>
      <button class="btn primary" id="ck">${t("checkUpdates")}</button>
      <pre id="log" class="muted"></pre>
    </div>`;
    el.querySelector("#ck").onclick = () => {
      const log = el.querySelector("#log");
      log.textContent = "Get:1 oubento.archive noble InRelease\nReading package lists...\nAll packages are up to date.";
      notify(t("updateReady"), "0 updates", "updater");
    };
  },
};

APPS.help = {
  mount(el) {
    el.innerHTML = `<div class="pad">
      <h2>${t("brand")}</h2>
      <p>${t("helpIntro")}</p>
      <h3>${t("gestures")}</h3>
      <div class="card">
        <div class="row"><div class="grow">${t("g1")}</div></div>
        <div class="row"><div class="grow">${t("g2")}</div></div>
        <div class="row"><div class="grow">${t("g3")}</div></div>
      </div>
      <h3>Terminal</h3>
      <p><span class="kbd">neofetch</span> <span class="kbd">apt install weather</span> <span class="kbd">ls</span></p>
    </div>`;
  },
};

APPS.trash = {
  mount(el, ctx) {
    ctx.opts.path = "/.trash";
    APPS.files.mount(el, ctx);
  },
};

APPS.converter = {
  mount(el) {
    el.innerHTML = `<div class="pad">
      <div class="section">°C → °F</div>
      <input class="field" id="c" type="number" value="25">
      <div id="f" class="pad">77 °F</div>
      <div class="section">km → mi</div>
      <input class="field" id="km" type="number" value="10">
      <div id="mi" class="pad">6.21 mi</div>
    </div>`;
    el.querySelector("#c").oninput = (e) => (el.querySelector("#f").textContent = ((+e.target.value * 9) / 5 + 32).toFixed(1) + " °F");
    el.querySelector("#km").oninput = (e) => (el.querySelector("#mi").textContent = (+e.target.value * 0.621371).toFixed(2) + " mi");
  },
};

APPS.flashlight = {
  mount(el) {
    let on = document.body.dataset.flash === "1";
    const paint = () => {
      document.body.dataset.flash = on ? "1" : "0";
      el.innerHTML = `<div style="height:100%;background:${on ? "#fff" : "#111"};display:grid;place-items:center">
        <button class="btn ${on ? "danger" : "primary"}" id="t" style="font-size:20px;padding:16px 28px">${on ? t("stop") : t("start")}</button>
      </div>`;
      el.querySelector("#t").onclick = () => {
        on = !on;
        paint();
      };
    };
    paint();
  },
};

/* ---------------- Store ---------------- */
APPS.store = {
  mount(el, ctx) {
    const paint = (q = "") => {
      const list = CATALOG.filter((a) => t(a.id).includes(q) || a.id.includes(q.toLowerCase()));
      el.innerHTML = `<div class="store-hero"><h2 style="margin:0">${t("store")}</h2><div>Ubuntu Software · ${CATALOG.length} apps</div></div>
        <div class="toolbar"><input id="q" placeholder="${t("search")}" value="${q}"></div>
        ${list
          .map((a) => {
            const on = isInstalled(a.id);
            return `<div class="app-card" id="c-${a.id}">
              <div class="app-ico" style="width:48px;height:48px">${svgIcon(a.id)}</div>
              <div class="grow"><b>${t(a.id)}</b><div class="stars">${"★".repeat(Math.round(a.score))}${"☆".repeat(5 - Math.round(a.score))} ${a.score}</div></div>
              <button class="btn ${on ? "" : "primary"}" data-id="${a.id}">${on ? t("openApp") : t("install")}</button>
            </div>`;
          })
          .join("")}`;
      el.querySelector("#q").oninput = (e) => paint(e.target.value);
      el.querySelectorAll("[data-id]").forEach((b) => {
        b.onclick = () => {
          const id = b.dataset.id;
          if (!isInstalled(id)) {
            OS.settings.installed.push(id);
            saveSettings();
            notify(t("installed"), t(id), "store");
            paint(q);
          } else {
            launch(id);
          }
        };
      });
      if (ctx.opts.highlight) {
        const n = el.querySelector("#c-" + ctx.opts.highlight);
        if (n) n.scrollIntoView();
      }
    };
    paint();
  },
};

/* ---------------- Games ---------------- */
APPS.mines = {
  mount(el) {
    const s = 8,
      mines = 10;
    let board = [],
      dead = false,
      won = false;
    const reset = () => {
      dead = won = false;
      board = Array.from({ length: s * s }, () => ({ m: 0, o: 0, f: 0 }));
      let n = 0;
      while (n < mines) {
        const i = Math.floor(Math.random() * board.length);
        if (!board[i].m) {
          board[i].m = 1;
          n++;
        }
      }
      paint();
    };
    const around = (i) => {
      const x = i % s,
        y = (i / s) | 0,
        r = [];
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx,
            ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < s && ny < s) r.push(ny * s + nx);
        }
      return r;
    };
    const count = (i) => around(i).filter((j) => board[j].m).length;
    const open = (i) => {
      if (dead || board[i].o || board[i].f) return;
      board[i].o = 1;
      if (board[i].m) {
        dead = true;
        notify("Boom", t("mines"), "mines");
        paint();
        return;
      }
      if (count(i) === 0) around(i).forEach(open);
      if (board.every((c) => c.m || c.o)) {
        won = true;
        notify(t("done"), t("mines"), "mines");
      }
      paint();
    };
    const paint = () => {
      el.innerHTML = `<div class="game-wrap"><div>${dead ? "💥" : won ? "🏆" : "🙂"} <button class="ibtn" id="rs">${t("reset")}</button></div>
        <div style="display:grid;grid-template-columns:repeat(${s},32px);gap:3px">
          ${board
            .map((c, i) => {
              const n = count(i);
              const lab = !c.o ? (c.f ? "🚩" : "") : c.m ? "💣" : n || "";
              return `<button style="width:32px;height:32px;border-radius:6px;background:${c.o ? "#ddd" : "#5e5c64"};color:${["", "#1c71d8", "#26a269", "#c01c28", "#613583"][n] || "#000"}">${lab}</button>`;
            })
            .join("")}
        </div></div>`;
      el.querySelector("#rs").onclick = reset;
      [...el.querySelectorAll(".game-wrap button")].slice(1).forEach((b, i) => {
        b.onclick = () => open(i);
        b.oncontextmenu = (e) => {
          e.preventDefault();
          board[i].f = board[i].f ? 0 : 1;
          paint();
        };
      });
    };
    reset();
  },
};

APPS.snake = {
  mount(el) {
    const N = 16;
    let snake = [136, 135, 134],
      dir = 1,
      food = 50,
      live = true,
      sc = 0;
    el.innerHTML = `<div class="game-wrap"><div>Score <b id="sc">0</b></div><canvas class="game" id="cv" width="320" height="320"></canvas>
      <div class="grid-2" style="grid-template-columns:repeat(3,1fr);width:220px">
        <span></span><button class="btn" data-d="-16">▲</button><span></span>
        <button class="btn" data-d="-1">◀</button><button class="btn" id="rs">${t("reset")}</button><button class="btn" data-d="1">▶</button>
        <span></span><button class="btn" data-d="16">▼</button><span></span>
      </div></div>`;
    const cv = el.querySelector("#cv");
    const g = cv.getContext("2d");
    const cell = 320 / N;
    const draw = () => {
      g.fillStyle = "#1a1216";
      g.fillRect(0, 0, 320, 320);
      g.fillStyle = "#e95420";
      g.fillRect((food % N) * cell, ((food / N) | 0) * cell, cell - 1, cell - 1);
      snake.forEach((p, i) => {
        g.fillStyle = i ? "#57e389" : "#f8e45c";
        g.fillRect((p % N) * cell, ((p / N) | 0) * cell, cell - 1, cell - 1);
      });
    };
    const step = () => {
      if (!live) return;
      const h = snake[0];
      const x = h % N,
        y = (h / N) | 0;
      let nx = x + (dir === 1 ? 1 : dir === -1 ? -1 : 0);
      let ny = y + (dir === 16 ? 1 : dir === -16 ? -1 : 0);
      if (nx < 0 || ny < 0 || nx >= N || ny >= N) {
        live = false;
        notify("Game over", sc, "snake");
        return;
      }
      const np = ny * N + nx;
      if (snake.includes(np)) {
        live = false;
        notify("Game over", sc, "snake");
        return;
      }
      snake.unshift(np);
      if (np === food) {
        sc += 10;
        el.querySelector("#sc").textContent = sc;
        do {
          food = Math.floor(Math.random() * N * N);
        } while (snake.includes(food));
      } else snake.pop();
      draw();
    };
    el.querySelectorAll("[data-d]").forEach((b) => {
      b.onclick = () => {
        const d = +b.dataset.d;
        if (d !== -dir) dir = d;
      };
    });
    el.querySelector("#rs").onclick = () => {
      snake = [136, 135, 134];
      dir = 1;
      live = true;
      sc = 0;
    };
    draw();
    const iv = setInterval(step, 180);
    el.addEventListener("DOMNodeRemoved", () => clearInterval(iv), { once: true });
  },
};

APPS.puzzle = {
  mount(el) {
    let grid = [
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    const spawn = () => {
      const empty = [];
      grid.forEach((r, i) => r.forEach((v, j) => !v && empty.push([i, j])));
      if (!empty.length) return;
      const [i, j] = empty[(Math.random() * empty.length) | 0];
      grid[i][j] = Math.random() < 0.9 ? 2 : 4;
    };
    const slide = (row) => {
      const a = row.filter((x) => x);
      for (let i = 0; i < a.length - 1; i++)
        if (a[i] === a[i + 1]) {
          a[i] *= 2;
          a[i + 1] = 0;
        }
      const b = a.filter((x) => x);
      while (b.length < 4) b.push(0);
      return b;
    };
    const rotate = () => {
      const n = [
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ];
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) n[j][3 - i] = grid[i][j];
      grid = n;
    };
    const move = (dir) => {
      const copy = JSON.stringify(grid);
      for (let k = 0; k < dir; k++) rotate();
      grid = grid.map(slide);
      for (let k = 0; k < (4 - dir) % 4; k++) rotate();
      if (JSON.stringify(grid) !== copy) spawn();
      paint();
    };
    const paint = () => {
      const colors = { 0: "#3d3846", 2: "#deddda", 4: "#c0bfbc", 8: "#e66100", 16: "#e95420", 32: "#c01c28", 64: "#a51d2d", 128: "#f5c211", 256: "#e5a50a", 512: "#e5a50a", 1024: "#f8e45c", 2048: "#f9f06b" };
      el.innerHTML = `<div class="game-wrap">
        <div style="display:grid;grid-template-columns:repeat(4,70px);gap:6px">
          ${grid.flat().map((v) => `<div style="height:70px;border-radius:8px;display:grid;place-items:center;font-weight:700;background:${colors[v] || "#241f31"};color:${v < 8 ? "#241f31" : "#fff"}">${v || ""}</div>`).join("")}
        </div>
        <div class="grid-2" style="grid-template-columns:repeat(3,1fr);width:220px">
          <span></span><button class="btn" id="u">▲</button><span></span>
          <button class="btn" id="l">◀</button><button class="btn" id="rs">${t("reset")}</button><button class="btn" id="r">▶</button>
          <span></span><button class="btn" id="d">▼</button><span></span>
        </div>
      </div>`;
      el.querySelector("#l").onclick = () => move(0);
      el.querySelector("#u").onclick = () => move(1);
      el.querySelector("#r").onclick = () => move(2);
      el.querySelector("#d").onclick = () => move(3);
      el.querySelector("#rs").onclick = () => {
        grid = [
          [0, 0, 0, 0],
          [0, 0, 0, 0],
          [0, 0, 0, 0],
          [0, 0, 0, 0],
        ];
        spawn();
        spawn();
        paint();
      };
    };
    spawn();
    spawn();
    paint();
  },
};

/* default install extras so the OS feels complete on first boot */
["calculator", "calendar", "clock", "weather", "notes", "gallery", "music", "camera", "contacts", "messages", "editor", "writer", "calcSheet", "maps", "monitor", "todo", "mail", "code", "mines", "snake", "puzzle", "trash", "updater", "disks", "logs", "converter", "flashlight", "videos", "recorder"].forEach((id) => {
  if (!OS.settings.installed.includes(id)) OS.settings.installed.push(id);
});
