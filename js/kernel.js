/* Oubento guest kernel — a self-contained OS inside the app.
   Not a Linux kernel on hardware. All of this lives in the APK. */
const KERNEL = (() => {
  const startedAt = Date.now();
  const procs = [];
  const services = [];
  const ifaces = {
    lo: { inet: "127.0.0.1/8", up: true },
    wlan0: { inet: "192.168.1.42/24", up: true },
  };
  let nextPid = 80;
  const pkgKey = "syspkgs";

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

  const CATALOG_PKGS = {
    bash: { ver: "5.2.21", desc: "GNU Bourne Again SHell" },
    coreutils: { ver: "9.4", desc: "ls, cat, cp, …" },
    "util-linux": { ver: "2.39", desc: "mount, dmesg, …" },
    procps: { ver: "4.0.4", desc: "ps, top, free" },
    iproute2: { ver: "6.8.0", desc: "ip" },
    "net-tools": { ver: "2.10", desc: "ifconfig" },
    "iputils-ping": { ver: "20240117", desc: "ping" },
    dnsutils: { ver: "9.18", desc: "nslookup" },
    apt: { ver: "2.7.14", desc: "package manager" },
    sudo: { ver: "1.9.15", desc: "superuser do" },
    neofetch: { ver: "7.1.0", desc: "system info" },
    python3: { ver: "3.12.3", desc: "guest Python" },
    python: { ver: "3.12.3", desc: "alias" },
    pip: { ver: "24.0", desc: "python installer" },
    node: { ver: "20.12.0", desc: "guest Node" },
    git: { ver: "2.43.0", desc: "version control" },
    vim: { ver: "9.1", desc: "editor" },
    nano: { ver: "7.2", desc: "editor" },
    curl: { ver: "8.5.0", desc: "transfer" },
    wget: { ver: "1.21.4", desc: "download" },
    htop: { ver: "3.3.0", desc: "process viewer" },
    openssh: { ver: "9.6p1", desc: "ssh client" },
    gcc: { ver: "13.2.0", desc: "compiler (guest stub)" },
    make: { ver: "4.3", desc: "build" },
    "build-essential": { ver: "12.10", desc: "gcc make libc" },
  };

  function installedPkgs() {
    return storeGet(pkgKey, ["bash", "coreutils", "util-linux", "procps", "iproute2", "net-tools", "apt", "sudo", "neofetch", "iputils-ping"]);
  }

  function spawn(name, user) {
    const p = { pid: nextPid++, cmd: name, user: user || (window.OS && OS.user) || "oubento", state: "S", time: "00:00:00" };
    procs.push(p);
    return p;
  }

  function killPid(pid) {
    const i = procs.findIndex((p) => p.pid === +pid);
    if (i < 0) return false;
    procs.splice(i, 1);
    return true;
  }

  function uptimeSec() {
    return Math.floor((Date.now() - startedAt) / 1000);
  }

  function bootMessages() {
    const d = typeof currentDistro === "function" ? currentDistro() : { name: "Oubento", session: "GNOME", version: "24.04.4" };
    return [
      `[    0.000000] Linux version 6.8.0-oubento (guest) #1 SMP PREEMPT`,
      `[    0.000128] Command line: BOOT_IMAGE=/boot/vmlinuz root=vfs ro quiet splash`,
      `[    0.041102] memory: 8192 MB guest heap`,
      `[    0.118440] vfs: mounted root (oubento-fs) readonly`,
      `[    0.220001] systemd[1]: Starting Oubento guest init…`,
      `[    0.401220] systemd[1]: Mounted /proc /sys /dev /run /tmp`,
      `[    0.612008] systemd[1]: Started dbus.service`,
      `[    0.780441] systemd[1]: Started NetworkManager.service`,
      `[    0.991002] systemd[1]: Started systemd-logind.service`,
      `[    1.204110] systemd[1]: Started ${d.session.replace(/\s+/g, "-").toLowerCase()}.service`,
      `[    1.448002] wlan0: link becomes ready (192.168.1.42/24)`,
      `[    1.702110] gdm: greeter ready`,
      `[    1.990001] Welcome to ${d.name} ${d.version} · guest OS inside the app`,
    ];
  }

  function attachProc() {
    if (!window.VFS || !VFS.registerVirtual) return;
    const live = {
      "/proc/version": () => "Linux version 6.8.0-oubento (guest) (gcc) PREEMPT\n",
      "/proc/uptime": () => uptimeSec() + " " + Math.floor(uptimeSec() / 2) + "\n",
      "/proc/loadavg": () => "0.12 0.18 0.15 1/48 1\n",
      "/proc/meminfo": () => "MemTotal:        8192000 kB\nMemFree:         5792000 kB\nMemAvailable:    6400000 kB\n",
      "/proc/cpuinfo": () => "processor\t: 0\nmodel name\t: Oubento Guest Core\ncpu MHz\t\t: 2400.000\n\n",
      "/proc/cmdline": () => "BOOT_IMAGE=/boot/vmlinuz root=vfs ro quiet splash\n",
      "/proc/mounts": () => "vfs / vfs rw 0 0\ntmpfs /tmp tmpfs rw 0 0\nproc /proc proc rw 0 0\nsysfs /sys sysfs rw 0 0\n",
      "/dev/null": () => "",
      "/dev/zero": () => "\0".repeat(16),
      "/dev/urandom": () => Math.random().toString(36).slice(2).repeat(4),
      "/sys/class/net/wlan0/operstate": () => (window.OS && OS.settings.wifi && !OS.settings.airplane ? "up" : "down") + "\n",
      "/sys/class/net/lo/operstate": () => "up\n",
    };
    Object.entries(live).forEach(([p, fn]) => VFS.registerVirtual(p, fn));
  }

  async function writeBin(name) {
    const body = "#!/usr/bin/env oush\n# " + name + " — guest binary provided by Oubento kernel\n";
    try {
      if (!VFS.exists("/usr/bin")) VFS.ensureDir("/usr/bin");
      if (!VFS.exists("/usr/bin/" + name)) await VFS.write("/usr/bin/" + name, body, "text/x-shellscript");
    } catch {}
  }

  async function installPkg(name) {
    name = String(name || "").toLowerCase();
    if (!name) return "E: no package name";
    const pkgs = installedPkgs();
    const meta = CATALOG_PKGS[name] || { ver: "1.0", desc: "guest package" };
    if (!pkgs.includes(name)) pkgs.push(name);
    storeSet(pkgKey, pkgs);
    await writeBin(name);
    if (name === "python" || name === "python3") {
      await writeBin("python");
      await writeBin("python3");
      if (!pkgs.includes("python3")) pkgs.push("python3");
      storeSet(pkgKey, pkgs);
    }
    try {
      const status = pkgs.map((p) => `${p}\tinstall`).join("\n") + "\n";
      await VFS.write("/var/lib/dpkg/status", status);
    } catch {}
    return `Get:1 oubento-repo noble/main ${name} ${meta.ver}\nUnpacking ${name} (${meta.ver}) ...\nSetting up ${name} (${meta.ver}) ...\n${name} is ready.`;
  }

  function pyRun(args) {
    let code = "";
    if (args[0] === "-c") code = args.slice(1).join(" ").replace(/^['"]|['"]$/g, "");
    else if (args[0] && !args[0].startsWith("-")) {
      try {
        code = String(VFS.read(args[0].startsWith("/") ? args[0] : "/home/oubento/" + args[0]));
      } catch {
        return "python: can't open file '" + args[0] + "': [Errno 2] No such file or directory";
      }
    } else {
      return [
        "Python 3.12.3 (Oubento guest interpreter)",
        "This is the in-app runtime, not CPython.",
        "  python3 -c \"print(2+2)\"",
        "  python3 -c \"import math; print(math.sqrt(16))\"",
        "  python3 script.py",
      ].join("\n");
    }
    try {
      const out = [];
      const src = code
        .replace(/#.*$/gm, "")
        .replace(/\bTrue\b/g, "true")
        .replace(/\bFalse\b/g, "false")
        .replace(/\bNone\b/g, "null")
        .replace(/\belif\b/g, "else if")
        .replace(/\bprint\s*\(/g, "__p(")
        .replace(/\bpass\b/g, "0");
      const math = Math;
      const random = {
        random: Math.random,
        randint: (a, b) => a + Math.floor(Math.random() * (b - a + 1)),
        choice: (a) => a[(Math.random() * a.length) | 0],
      };
      const sys = { version: "3.12.3", platform: "linux", argv: args, exit: (c) => { throw new Error("SystemExit: " + (c || 0)); } };
      const osMod = { name: "posix", getcwd: () => "/home/oubento", listdir: (p) => VFS.list(p || "/").map((i) => i.name) };
      const json = { dumps: (o) => JSON.stringify(o), loads: (s) => JSON.parse(s) };
      const __p = (...x) => out.push(x.map((v) => (v === null ? "None" : v === true ? "True" : v === false ? "False" : String(v))).join(" "));
      const range = (a, b, s = 1) => {
        const start = b == null ? 0 : a;
        const end = b == null ? a : b;
        const r = [];
        for (let i = start; s > 0 ? i < end : i > end; i += s) r.push(i);
        return r;
      };
      const len = (x) => x.length;
      const str = String;
      const int = (x) => parseInt(x, 10);
      const float = parseFloat;
      const list = (x) => Array.from(x || []);
      Function(
        "math", "random", "sys", "os", "json", "__p", "range", "len", "str", "int", "float", "list",
        `"use strict";\n${src}`
      )(math, random, sys, osMod, json, __p, range, len, str, int, float, list);
      return out.join("\n");
    } catch (e) {
      return "Traceback (most recent call last):\n  File \"<stdin>\", line 1, in <module>\n" + e.message;
    }
  }

  function tokenize(line) {
    const out = [];
    let cur = "";
    let q = null;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (q) {
        if (c === q) q = null;
        else cur += c;
        continue;
      }
      if (c === "'" || c === '"') {
        q = c;
        continue;
      }
      if (/\s/.test(c)) {
        if (cur) out.push(cur);
        cur = "";
        continue;
      }
      if ((c === "|" || c === ">" || c === "<" || c === "&" || c === ";") && !q) {
        if (cur) out.push(cur);
        cur = "";
        if (c === ">" && line[i + 1] === ">") {
          out.push(">>");
          i++;
        } else if (c === "&" && line[i + 1] === "&") {
          out.push("&&");
          i++;
        } else if (c === "|" && line[i + 1] === "|") {
          out.push("||");
          i++;
        } else out.push(c);
        continue;
      }
      cur += c;
    }
    if (cur) out.push(cur);
    return out;
  }

  function makeSession() {
    const user = (window.OS && OS.user) || "oubento";
    const home = window.AUTH && AUTH.current ? AUTH.current().home : "/home/oubento";
    return {
      cwd: home,
      env: {
        USER: user,
        HOME: home,
        HOST: (window.OS && OS.hostname) || "oubento-phone",
        PATH: "/usr/local/bin:/usr/bin:/bin:/sbin",
        SHELL: "/bin/bash",
        LANG: (window.OS && OS.settings.lang) === "en" ? "en_US.UTF-8" : "ar_EG.UTF-8",
        TERM: "xterm-256color",
      },
    };
  }

  function resolvePath(sess, p) {
    if (!p) return sess.cwd;
    if (p === "~") return sess.env.HOME;
    if (p.startsWith("~/")) return VFS.norm(sess.env.HOME + p.slice(1));
    if (p.startsWith("/")) return VFS.norm(p);
    return VFS.norm(sess.cwd + "/" + p);
  }

  function commandsFor(sess, hooks) {
    const resolve = (p) => resolvePath(sess, p);
    const commands = {
      help: () =>
        [
          "Oubento guest shell (oush) — self-contained OS inside the app",
          "files:  ls ll cd pwd cat echo mkdir rm touch cp mv tree find head tail wc",
          "sys:    whoami id uname hostname hostnamectl date uptime free df ps top htop",
          "net:    ping nslookup curl wget ip ifconfig",
          "pkg:    apt pkg dnf yum pacman apk zypper pip",
          "lang:   python python3 node",
          "edit:   nano vim vi",
          "svc:    systemctl journalctl dmesg",
          "auth:   sudo su passwd exit",
          "Pipes |  redirect > >>  chain && ;   case-insensitive",
        ].join("\n"),
      ls: (a) => {
        const long = a.includes("-l") || a.includes("-la") || a.includes("-al");
        const p = resolve(a.find((x) => !x.startsWith("-")) || sess.cwd);
        if (!VFS.exists(p)) return "ls: cannot access '" + p + "': No such file or directory";
        const st = VFS.stat(p);
        if (st.type === "file") return VFS.base(p);
        const items = VFS.list(p);
        if (long) {
          return items
            .map((i) => {
              const mode = i.type === "dir" ? "drwxr-xr-x" : "-rw-r--r--";
              return `${mode} 1 ${i.owner || "oubento"} ${i.owner || "oubento"} ${String(i.size || 0).padStart(8)} ${ (i.mtime || "").slice(0, 16)} ${i.name}`;
            })
            .join("\n");
        }
        return items.map((i) => (i.type === "dir" ? i.name + "/" : i.name)).join("  ");
      },
      ll: (a) => commands.ls(["-l", ...a]),
      cd: (a) => {
        const p = resolve(a[0] || sess.env.HOME);
        if (!VFS.exists(p) || VFS.stat(p).type !== "dir") return "cd: no such directory: " + (a[0] || "");
        sess.cwd = p;
        if (hooks && hooks.onCwd) hooks.onCwd();
        return "";
      },
      pwd: () => sess.cwd,
      cat: (a) => {
        try {
          const c = VFS.read(resolve(a[0]));
          return typeof c === "string" && c.startsWith("data:") ? "[binary]" : String(c);
        } catch {
          return "cat: " + (a[0] || "") + ": No such file or directory";
        }
      },
      echo: (a) => a.join(" ").replace(/\$(\w+)/g, (_, k) => sess.env[k] || ""),
      mkdir: async (a) => {
        try {
          await VFS.mkdir(resolve(a[a[0] === "-p" ? 1 : 0]));
          return "";
        } catch (e) {
          return "mkdir: " + e.message;
        }
      },
      touch: async (a) => {
        const p = resolve(a[0]);
        try {
          await VFS.write(p, VFS.exists(p) ? VFS.read(p) : "");
        } catch (e) {
          return "touch: " + e.message;
        }
        return "";
      },
      rm: async (a) => {
        try {
          await VFS.remove(resolve(a[a[0] === "-r" || a[0] === "-rf" ? 1 : 0]));
          return "";
        } catch (e) {
          return "rm: " + e.message;
        }
      },
      cp: async (a) => {
        try {
          await VFS.copy(resolve(a[0]), resolve(a[1] || sess.cwd));
          return "";
        } catch (e) {
          return "cp: " + e.message;
        }
      },
      mv: async (a) => {
        try {
          const src = resolve(a[0]);
          await VFS.rename(src, VFS.base(resolve(a[1])));
          return "";
        } catch (e) {
          return "mv: " + e.message;
        }
      },
      date: () => new Date().toString(),
      whoami: () => (window.OS && OS.user) || "oubento",
      id: () => {
        const u = AUTH.current();
        return `uid=${u.uid}(${OS.user}) gid=${u.gid}(${OS.user}) groups=${u.groups.join(",")}${AUTH.isRoot() ? " euid=0(root)" : ""}`;
      },
      hostname: (a) => (a[0] && AUTH.isRoot() ? ((OS.hostname = a[0]), sess.env.HOST = a[0], "") : OS.hostname),
      hostnamectl: () =>
        `Static hostname: ${OS.hostname}\nOperating System: Oubento 24.04.4 LTS\nKernel: Linux 6.8.0-oubento\nArchitecture: aarch64\nChassis: handset`,
      uname: (a) => {
        if (a.includes("-a")) return `Linux ${OS.hostname} 6.8.0-oubento #1 SMP PREEMPT aarch64 GNU/Linux`;
        if (a.includes("-r")) return "6.8.0-oubento";
        if (a.includes("-m")) return "aarch64";
        return "Linux";
      },
      uptime: () => {
        const s = uptimeSec();
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        return ` ${h}:${String(m).padStart(2, "0")} up,  1 user,  load average: 0.12, 0.18, 0.15`;
      },
      clear: () => {
        if (hooks && hooks.clear) hooks.clear();
        return "";
      },
      history: () => (hooks && hooks.hist ? hooks.hist.map((c, i) => `${i + 1}  ${c}`).join("\n") : ""),
      neofetch: () => {
        const u = VFS.usage();
        const d = currentDistro();
        return [
          "            .-/+osssssso+/-.            " + OS.user + "@" + OS.hostname,
          "        `:+ssssssssssssssssss+:`        -----------",
          "      -+ssssssssssssssssssyyssss+-      OS: Oubento " + OS.version + " LTS (guest)",
          "    .ossssssssssssssssssdMMMNysssso.    Host: " + d.name + " session",
          "   /ssssssssssshdmmNNmmyNMMMMhssssss/   Kernel: 6.8.0-oubento",
          "  +ssssssssshmydMMMMMMMNddddyssssssss+  Uptime: " + Math.floor(uptimeSec() / 60) + " min",
          " /sssssssshNMMMyhhyyyyhmNMMMNhssssssss/ Shell: oush 2.0",
          ".ssssssssdMMMNhsssssssssshNMMMdssssssss. DE: " + d.session,
          "+sssshhhyNMMNyssssssssssssyNMMMysssssss+ WM: oubento-shell",
          "ossyNMMMNyMMhsssssssssssssshmmmhssssssso Packages: " + installedPkgs().length + " (guest apt)",
          "ossyNMMMNyMMhsssssssssssssshmmmhssssssso Terminal: oush",
          "+sssshhhyNMMNyssssssssssssyNMMMysssssss+ CPU: GuestCore",
          ".ssssssssdMMMNhsssssssssshNMMMdssssssss. Memory: " + fmtSize(u.bytes) + " files",
          " /sssssssshNMMMyhhyyyyhdNMMMNhssssssss/",
        ].join("\n");
      },
      apt: async (a) => {
        const sub = (a[0] || "").toLowerCase();
        if (["update", "upgrade", "install", "remove"].includes(sub) && !AUTH.isRoot()) {
          return "E: Permission denied. Use: sudo apt " + a.join(" ");
        }
        if (sub === "update") return "Hit:1 https://oubento.local/ubuntu noble InRelease\nReading package lists... Done";
        if (sub === "upgrade") return "Calculating upgrade... Done\n0 upgraded, 0 newly installed, 0 to remove.";
        if (sub === "install") {
          const id = (a[1] || "").toLowerCase();
          if (id && typeof CATALOG !== "undefined" && CATALOG.some((c) => c.id === id)) {
            if (!isInstalled(id)) {
              OS.settings.installed.push(id);
              saveSettings();
            }
            return `Setting up ${id} ...\nProcessing triggers for desktop ... done.`;
          }
          if (id) return await installPkg(id);
          return "E: Unable to locate package";
        }
        if (sub === "remove") {
          const id = (a[1] || "").toLowerCase();
          const pkgs = installedPkgs().filter((p) => p !== id);
          storeSet(pkgKey, pkgs);
          return `Removing ${id} ...\ndone.`;
        }
        if (sub === "list" || sub === "search") {
          const have = installedPkgs();
          return Object.keys(CATALOG_PKGS)
            .map((p) => `${p}/${CATALOG_PKGS[p].ver} ${have.includes(p) ? "[installed]" : ""}  ${CATALOG_PKGS[p].desc}`)
            .join("\n");
        }
        return "apt 2.7.14 (oubento guest)\nusage: apt update|upgrade|install|remove|list";
      },
      pkg: (a) => commands.apt(a),
      yum: (a) => commands.apt(a),
      dnf: (a) => commands.apt(a),
      zypper: (a) => commands.apt(a),
      apk: (a) => commands.apt(a[0] === "add" ? ["install", a[1]] : a),
      pacman: (a) => commands.apt(a[0] === "-S" ? ["install", a[1]] : a[0] === "-Syu" ? ["upgrade"] : ["list"]),
      pip: (a) => {
        if ((a[0] || "").toLowerCase() === "install") return `Collecting ${a[1] || "package"}\nInstalling collected packages: ${a[1]}\nSuccessfully installed ${a[1]}-guest`;
        if (a[0] === "list") return "pip 24.0 from /usr/lib/python3/dist-packages/pip (python 3.12)";
        return "Usage: pip install <name>";
      },
      free: () => "               total        used        free      shared  buff/cache   available\nMem:         8192000     2400000     5792000           0      800000     6400000\nSwap:              0           0           0",
      df: () => {
        const u = VFS.usage();
        return `Filesystem     Type  Size  Used Avail Use%\n/dev/vfs       vfs   512M  ${fmtSize(u.bytes)}  rest  ${(Math.min(99, (u.bytes / (512 * 1024 * 1024)) * 100) || 1).toFixed(0)}%\ntmpfs          tmpfs  64M     0   64M   0%`;
      },
      ps: (a) => {
        const extra = OS.state.windows.map((w, i) => ({ pid: 200 + i, cmd: w.app, user: OS.user, state: "R", time: "00:00:01" }));
        const all = [{ pid: 1, cmd: "systemd", user: "root", state: "S", time: "00:00:01" }, ...procs, ...extra];
        if (a.includes("aux") || a.includes("-aux")) {
          return "USER       PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND\n" +
            all.map((p) => `${(p.user || "oubento").padEnd(8)} ${String(p.pid).padStart(5)}  0.1  0.4  ${p.state}  ${p.time} ${p.cmd}`).join("\n");
        }
        return "  PID TTY          TIME CMD\n" + all.map((p) => `${String(p.pid).padStart(5)} pts/0    ${p.time} ${p.cmd}`).join("\n");
      },
      top: () => commands.ps(["aux"]) + "\n%Cpu(s):  4.2 us,  1.1 sy,  0.0 ni, 94.5 id\nMiB Mem :   8000.0 total,   5656.0 free",
      htop: () => commands.top(),
      kill: (a) => (killPid(a[0]) ? "" : "kill: (" + a[0] + ") - No such process"),
      tree: (a) => VFS.tree(a[0] ? resolve(a[0]) : sess.cwd, 3),
      find: (a) => VFS.find(a[0] || "", sess.cwd).map((i) => i.path).join("\n"),
      grep: (a, stdin) => {
        const q = a[0];
        if (stdin != null) return String(stdin).split("\n").filter((l) => l.includes(q)).join("\n");
        try {
          return String(VFS.read(resolve(a[1])))
            .split("\n")
            .filter((l) => l.includes(q))
            .join("\n");
        } catch {
          return "grep: " + (a[1] || "") + ": No such file";
        }
      },
      head: (a, stdin) => {
        const n = 10;
        const src = stdin != null ? String(stdin) : (() => { try { return String(VFS.read(resolve(a.find((x) => !x.startsWith("-")) || ""))); } catch { return ""; } })();
        return src.split("\n").slice(0, n).join("\n");
      },
      tail: (a, stdin) => {
        const src = stdin != null ? String(stdin) : (() => { try { return String(VFS.read(resolve(a.find((x) => !x.startsWith("-")) || ""))); } catch { return ""; } })();
        return src.split("\n").slice(-10).join("\n");
      },
      wc: (a, stdin) => {
        try {
          const s = stdin != null ? String(stdin) : String(VFS.read(resolve(a[0])));
          return `${s.split("\n").length} ${s.split(/\s+/).filter(Boolean).length} ${s.length}`;
        } catch {
          return "0 0 0";
        }
      },
      lsb_release: () => {
        const d = currentDistro();
        return `Distributor ID: ${d.name}\nDescription:    ${d.name} ${d.version} (${d.codename})\nRelease:        ${d.version}\nCodename:       ${d.codename}\nDesktop:        ${d.session}`;
      },
      sudo: async (a) => {
        if (!a.length) return "usage: sudo [-i] <command>";
        if (a[0] === "-i" || a[0] === "su" || a[0] === "-") {
          if (!AUTH.isRoot()) {
            const ok = await AUTH.ask("sudo -i");
            if (!ok) return "sudo: Authentication failure";
          }
          AUTH.session = "root";
          OS.user = "root";
          sess.env.USER = "root";
          sess.env.HOME = "/root";
          sess.cwd = "/root";
          if (hooks && hooks.onCwd) hooks.onCwd();
          if (typeof renderStatus === "function") renderStatus();
          return "root@ " + t("authScope");
        }
        if (!AUTH.isRoot()) {
          const ok = await AUTH.ask("sudo " + a.join(" "));
          if (!ok) return "sudo: Authentication failure";
        }
        return await runInner(a[0], a.slice(1), null);
      },
      su: async (a) => commands.sudo(a[0] === "-" || !a.length ? ["-i"] : a),
      passwd: () => "Password unchanged. Guest password remains: ubuntu",
      chmod: (a) => (AUTH.isRoot() ? "mode of '" + (a[1] || ".") + "' changed to " + (a[0] || "755") : "chmod: Operation not permitted"),
      chown: (a) => (AUTH.isRoot() ? "changed ownership of '" + (a[1] || ".") + "'" : "chown: Operation not permitted"),
      startx: (a) => {
        if (a[0]) applyDistro(a[0], { persist: true, rerender: true });
        return "started " + currentDistro().session;
      },
      fortune: () =>
        [
          "With great power comes great responsibility. Also sudo.",
          "There's no place like ~",
          "Have you tried turning it off and on again?",
          "This guest OS is complete inside the app — not a phone kernel.",
        ][(Math.random() * 4) | 0],
      cowsay: (a) => {
        const m = a.join(" ") || "moo";
        return ` ${"_".repeat(m.length + 2)}\n< ${m} >\n ${"-".repeat(m.length + 2)}\n        \\   ^__^\n         \\  (oo)\\_______\n            (__)\\       )\\/\\\n                ||----w |\n                ||     ||`;
      },
      man: (a) => `NAME\n    ${a[0] || "oubento"} — Oubento guest OS command\n\nDESCRIPTION\n    Runs inside the Oubento app. Type help for the command list.`,
      env: () => Object.entries(sess.env).map(([k, v]) => `${k}=${v}`).join("\n"),
      export: (a) => {
        const [k, v] = (a[0] || "").split("=");
        if (k && v != null) sess.env[k] = v;
        return "";
      },
      open: (a) => {
        launch("files", { path: resolve(a[0] || sess.cwd), force: true });
        return "";
      },
      nano: (a) => {
        launch("editor", { path: resolve(a[0] || sess.cwd + "/untitled.txt"), force: true });
        return "";
      },
      vim: (a) => commands.nano(a),
      vi: (a) => commands.nano(a),
      weather: async () => {
        try {
          const r = await fetch("https://api.open-meteo.com/v1/forecast?latitude=30.0&longitude=31.2&current_weather=true");
          const j = await r.json();
          return `Cairo ${j.current_weather.temperature}°C  wind ${j.current_weather.windspeed}`;
        } catch {
          return "weather: offline (guest cache)";
        }
      },
      curl: async (a) => {
        try {
          const r = await fetch(a[0]);
          return (await r.text()).slice(0, 1200);
        } catch {
          return "curl: (7) Failed to connect";
        }
      },
      wget: async (a) => {
        try {
          const r = await fetch(a[0]);
          const text = await r.text();
          const name = (a[0] || "index.html").split("/").pop() || "index.html";
          await VFS.write("/home/oubento/Downloads/" + name, text, "text/plain");
          return `'${name}' saved`;
        } catch {
          return "wget: failed";
        }
      },
      ip: () =>
        Object.entries(ifaces)
          .map(([n, i]) => `${n}: ${i.up ? "UP" : "DOWN"}  inet ${i.inet}`)
          .join("\n"),
      ifconfig: () => commands.ip(),
      ping: async (a) => {
        const host = (a.find((x) => !x.startsWith("-")) || "1.1.1.1").replace(/^https?:\/\//, "").split("/")[0];
        const n = 4;
        const lines = [`PING ${host} (${host}) 56(84) bytes of data.`];
        for (let i = 0; i < n; i++) {
          const t0 = performance.now();
          try {
            await fetch("https://" + host, { mode: "no-cors", cache: "no-store" });
            lines.push(`64 bytes from ${host}: icmp_seq=${i + 1} ttl=56 time=${(performance.now() - t0).toFixed(1)} ms`);
          } catch {
            lines.push(`From oubento: icmp_seq=${i + 1} Destination Host Unreachable`);
          }
        }
        lines.push(`--- ${host} ping statistics ---`, `${n} packets transmitted, ${n} received, 0% packet loss`);
        return lines.join("\n");
      },
      nslookup: async (a) => {
        const host = a[0] || "ubuntu.com";
        try {
          const r = await fetch("https://dns.google/resolve?name=" + encodeURIComponent(host) + "&type=A");
          const j = await r.json();
          const ans = (j.Answer || []).map((x) => x.data).join("\n");
          return `Server:\tdns.google\nName:\t${host}\n${ans || "NXDOMAIN"}`;
        } catch {
          return "nslookup: failed (offline)";
        }
      },
      python: (a) => pyRun(a),
      python3: (a) => commands.python(a),
      py: (a) => commands.python(a),
      node: (a) => {
        const code = a[0] === "-e" || a[0] === "-c" ? a.slice(1).join(" ") : a.join(" ");
        if (!code) return "Welcome to Node.js v20.12.0 (guest).\nUse: node -e 'console.log(1+1)'";
        try {
          const logs = [];
          Function("console", `"use strict";${code}`)({ log: (...x) => logs.push(x.join(" ")) });
          return logs.join("\n") || "undefined";
        } catch (e) {
          return String(e.message);
        }
      },
      which: (a) => {
        const n = (a[0] || "").toLowerCase();
        return n && resolveCmd(n) ? "/usr/bin/" + n : "";
      },
      type: (a) => {
        const n = (a[0] || "").toLowerCase();
        return n && resolveCmd(n) ? n + " is /usr/bin/" + n : "type: " + a[0] + ": not found";
      },
      git: (a) => {
        if (a[0] === "status") return "On branch guest\nnothing to commit, working tree clean";
        if (a[0] === "log") return "commit 267d491 (HEAD -> guest)\nAuthor: oubento <oubento@oubento-phone>\n    Oubento guest OS";
        if (a[0] === "clone") return "Cloning into '" + (a[1] || "repo") + "'...\ndone.";
        if (a[0] === "init") return "Initialized empty Git repository in " + sess.cwd + "/.git/";
        return "usage: git status|log|clone|init";
      },
      ssh: (a) => `ssh: connect to host ${a[0] || "host"} port 22: Connection refused (guest — no remote daemon)`,
      bash: () => "already in oush (bash-compatible guest shell)",
      sh: () => commands.bash(),
      systemctl: (a) => {
        const sub = a[0] || "status";
        const list = services.map((s) => `${s.name.padEnd(28)} loaded active ${s.state}`).join("\n");
        if (sub === "list-units" || sub === "status" && !a[1]) return "UNIT                         LOAD   ACTIVE SUB\n" + list;
        if (sub === "start" && a[1]) {
          const s = services.find((x) => x.name.startsWith(a[1]));
          if (s) s.state = "running";
          return "";
        }
        if (sub === "stop" && a[1]) {
          const s = services.find((x) => x.name.startsWith(a[1]));
          if (s) s.state = "dead";
          return "";
        }
        return list;
      },
      journalctl: () => (OS.state.logs || []).slice(0, 20).join("\n") || "-- No entries --",
      dmesg: () => bootMessages().join("\n"),
      service: (a) => commands.systemctl(a[1] ? [a[1], a[0]] : ["status"]),
      mount: () => "vfs on / type vfs (rw,relatime)\nproc on /proc type proc (rw)\nsysfs on /sys type sysfs (rw)\ntmpfs on /tmp type tmpfs (rw)",
      lsblk: () => "NAME    SIZE TYPE MOUNTPOINT\nvfs     512M disk /\nloop0    64M loop /tmp",
      reboot: () => {
        location.reload();
        return "Rebooting guest OS...";
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
      true: () => "",
      false: () => "false",
      yes: (a) => Array(8).fill(a[0] || "y").join("\n"),
      sleep: async (a) => {
        await new Promise((r) => setTimeout(r, Math.min(5000, (+a[0] || 1) * 1000)));
        return "";
      },
      exit: () => {
        if (AUTH.session === "root") {
          AUTH.drop();
          sess.env.USER = "oubento";
          sess.env.HOME = "/home/oubento";
          sess.cwd = "/home/oubento";
          if (hooks && hooks.onCwd) hooks.onCwd();
          if (typeof renderStatus === "function") renderStatus();
          return "logout";
        }
        if (hooks && hooks.exit) hooks.exit();
        return "";
      },
    };

    function resolveCmd(cmd) {
      if (!cmd) return null;
      if (commands[cmd]) return commands[cmd];
      const low = String(cmd).toLowerCase();
      if (commands[low]) return commands[low];
      const base = low.split("/").pop();
      if (commands[base]) return commands[base];
      const hit = Object.keys(commands).find((k) => k.toLowerCase() === low || k.toLowerCase() === base);
      return hit ? commands[hit] : null;
    }

    async function runInner(cmd, args, stdin) {
      const fn = resolveCmd(cmd);
      if (!fn) {
        const keys = Object.keys(commands);
        const low = String(cmd).toLowerCase();
        const sug = keys.filter((k) => k.startsWith(low) || low.startsWith(k.slice(0, 3))).slice(0, 5);
        return cmd + ": command not found" + (sug.length ? "\nDid you mean: " + sug.join(", ") + " ?" : "");
      }
      return await fn(args, stdin);
    }

    return { commands, resolveCmd, runInner };
  }

  async function execLine(line, sess, hooks) {
    const { runInner } = commandsFor(sess, hooks);
    const tokens = tokenize(line);
    if (!tokens.length) return "";
    const jobs = [];
    let cur = { cmd: null, args: [], redir: null, append: false };
    const flush = () => {
      if (cur.cmd) jobs.push(cur);
      cur = { cmd: null, args: [], redir: null, append: false };
    };
    for (let i = 0; i < tokens.length; i++) {
      const tkn = tokens[i];
      if (tkn === "|" || tkn === "&&" || tkn === ";" || tkn === "||") {
        flush();
        jobs.push({ op: tkn });
      } else if (tkn === ">" || tkn === ">>") {
        cur.redir = tokens[++i];
        cur.append = tkn === ">>";
      } else if (!cur.cmd) cur.cmd = tkn;
      else cur.args.push(tkn);
    }
    flush();
    let last = "";
    let ok = true;
    for (const j of jobs) {
      if (j.op === "|") continue;
      if (j.op === "&&" && !ok) break;
      if (j.op === "||" && ok) continue;
      if (j.op) continue;
      const stdin = jobs[jobs.indexOf(j) - 1] && jobs[jobs.indexOf(j) - 1].op === "|" ? last : null;
      last = await runInner(j.cmd, j.args, stdin);
      ok = !String(last || "").includes("command not found") && !String(last || "").startsWith("E:");
      if (j.redir) {
        const path = resolvePath(sess, j.redir);
        const prev = j.append && VFS.exists(path) ? String(VFS.read(path)) : "";
        try {
          await VFS.write(path, prev + (last || ""));
        } catch (e) {
          last = e.message;
        }
        last = "";
      }
    }
    return last || "";
  }

  function boot() {
    attachProc();
    ["systemd", "dbus", "NetworkManager", "systemd-logind", "gdm", "pipewire", "bluetooth"].forEach((name) => {
      services.push({ name: name + ".service", state: "running" });
      spawn(name, "root");
    });
    spawn("gnome-shell", "oubento");
    try {
      VFS.write("/var/log/syslog", bootMessages().join("\n") + "\nkernel: guest init complete\n");
    } catch {}
  }

  return {
    boot,
    bootMessages,
    execLine,
    makeSession,
    installPkg,
    installedPkgs,
    procs,
    services,
    uptimeSec,
    spawn,
    pyRun,
    version: "6.8.0-oubento",
  };
})();
