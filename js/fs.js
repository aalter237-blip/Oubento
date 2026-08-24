const VFS = (() => {
  const DB = "oubento-fs";
  const STORE = "nodes";
  let ready = null;
  let mem = {};

  function open() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function persist() {
    const db = await open();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(mem, "root");
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }

  function now() {
    return new Date().toISOString();
  }

  function norm(p) {
    if (!p) return "/";
    const parts = [];
    String(p).split("/").forEach((s) => {
      if (!s || s === ".") return;
      if (s === "..") parts.pop();
      else parts.push(s);
    });
    return "/" + parts.join("/");
  }

  function parent(p) {
    p = norm(p);
    if (p === "/") return "/";
    return norm(p.split("/").slice(0, -1).join("/") || "/");
  }

  function base(p) {
    p = norm(p);
    if (p === "/") return "/";
    return p.split("/").pop();
  }

  const virt = {};

  function registerVirtual(p, reader) {
    virt[norm(p)] = reader;
  }

  function ensureDir(p, extra = {}) {
    p = norm(p);
    if (!mem[p]) mem[p] = { type: "dir", mtime: now(), owner: extra.owner || "root", ...extra };
    return mem[p];
  }

  function fhs() {
    [
      "/", "/home", "/home/oubento", "/home/oubento/Desktop", "/home/oubento/Documents",
      "/home/oubento/Downloads", "/home/oubento/Pictures", "/home/oubento/Music",
      "/home/oubento/Videos", "/home/oubento/Templates", "/home/oubento/Public",
      "/root", "/etc", "/etc/apt", "/etc/apt/sources.list.d", "/etc/network", "/etc/systemd",
      "/etc/systemd/system", "/bin", "/sbin", "/usr", "/usr/bin", "/usr/sbin", "/usr/lib",
      "/usr/lib/python3.12", "/usr/share", "/usr/share/doc", "/usr/local", "/usr/local/bin",
      "/opt", "/tmp", "/var", "/var/log", "/var/log/journal", "/var/lib", "/var/lib/dpkg",
      "/var/cache", "/var/cache/apt", "/var/run", "/run", "/run/systemd", "/proc", "/proc/sys",
      "/sys", "/sys/class", "/sys/class/net", "/dev", "/dev/pts", "/mnt", "/media", "/boot",
      "/lib", "/lib64", "/.trash",
    ].forEach((p) => {
      const owner = p.startsWith("/home/oubento") || p === "/tmp" || p === "/.trash" ? "oubento" : "root";
      ensureDir(p, { owner, mode: p === "/tmp" ? 1777 : p === "/root" ? 700 : 755 });
    });
  }

  function seed() {
    const ts = now();
    const file = (content, mime = "text/plain") => ({
      type: "file",
      content,
      mime,
      size: new Blob([content]).size,
      mtime: ts,
      owner: "root",
    });
    mem = {};
    fhs();
    mem["/etc/os-release"] = file(
      [
        "NAME=\"Oubento\"",
        "PRETTY_NAME=\"Oubento 24.04 LTS (Noble Numbat)\"",
        "VERSION=\"24.04.4 LTS\"",
        "VERSION_ID=\"24.04\"",
        "ID=oubento",
        "ID_LIKE=ubuntu debian",
        "HOME_URL=\"https://ubuntu.com/\"",
        "SUPPORT_URL=\"https://help.ubuntu.com/\"",
        "GUEST=1",
      ].join("\n") + "\n"
    );
    mem["/etc/apt/sources.list"] = file("deb https://oubento.local/ubuntu noble main restricted universe multiverse\n");
    mem["/etc/hosts"] = file("127.0.0.1 localhost\n127.0.1.1 oubento-phone\n::1 localhost ip6-localhost\n");
    mem["/etc/resolv.conf"] = file("nameserver 1.1.1.1\nnameserver 8.8.8.8\n");
    mem["/etc/fstab"] = file("vfs / vfs defaults 0 1\ntmpfs /tmp tmpfs defaults 0 0\n");
    mem["/etc/issue"] = file("Oubento 24.04.4 LTS \\n \\l\n");
    mem["/.oubento-fs-version"] = file("4\n");
    mem["/etc/hostname"] = file("oubento-phone\n");
    mem["/home/oubento/.bashrc"] = file(
      "export PS1='\\u@\\h:\\w$ '\nalias ll='ls -la'\n"
    );
    mem["/home/oubento/Documents/مرحبا.txt"] = file(
      "مرحباً بك في أوبنتو للهاتف.\n\nهذا نظام ملفات حقيقي محفوظ على جهازك.\nيمكنك إنشاء المجلدات والملفات وتحريرها من تطبيق الملفات أو الطرفية.\n"
    );
    mem["/home/oubento/Documents/Welcome.md"] = file(
      "# Welcome to Oubento\n\nA complete Ubuntu-inspired mobile OS.\n\n- Files, Terminal, Browser\n- Writer & Spreadsheet\n- Camera, Gallery, Music\n- Games and Software Center\n"
    );
    mem["/home/oubento/Desktop/ابدأ هنا.txt"] = file(
      "افتح مركز البرمجيات لتثبيت المزيد، أو الطرفية وجرّب الأمر neofetch.\n"
    );
    mem["/var/log/syslog"] = file("boot: oubento kernel ready\nshell: gnome-session started\n");
    mem["/home/oubento/Pictures/README.txt"] = file("الصور الملتقطة ولقطات الشاشة تُحفظ هنا.\n");
    mem["/root/.profile"] = file("# root shell\nexport HOME=/root\n", "text/plain");
    mem["/etc/passwd"] = file("root:x:0:0:root:/root:/bin/bash\noubento:x:1000:1000:Oubento:/home/oubento:/bin/bash\n");
    mem["/etc/group"] = file("root:x:0:\nsudo:x:27:oubento\noubento:x:1000:\n");
    mem["/etc/sudoers"] = file("# Oubento virtual sudoers — guest OS only\nroot ALL=(ALL:ALL) ALL\n%sudo ALL=(ALL:ALL) ALL\noubento ALL=(ALL:ALL) ALL\n");
    mem["/etc/hostname"] = file("oubento-phone\n");
    mem["/proc/version"] = file("Linux version 6.8.0-oubento (guest) (gcc) PREEMPT\n");
    Object.keys(mem).forEach((k) => {
      if (!mem[k].owner) mem[k].owner = k.startsWith("/home/oubento") || k.startsWith("/tmp") || k.startsWith("/.trash") ? "oubento" : "root";
    });
  }

  async function init() {
    if (ready) return ready;
    ready = (async () => {
      try {
        const db = await open();
        const saved = await new Promise((resolve) => {
          const tx = db.transaction(STORE, "readonly");
          const g = tx.objectStore(STORE).get("root");
          g.onsuccess = () => resolve(g.result);
          g.onerror = () => resolve(null);
        });
        if (saved && saved["/"]) {
          mem = saved;
          migrate();
          await persist();
        } else {
          seed();
          await persist();
        }
      } catch {
        seed();
      }
    })();
    return ready;
  }

  function migrate() {
    fhs();
    Object.keys(mem).forEach((k) => {
      if (!mem[k].owner) mem[k].owner = k.startsWith("/home/oubento") || k.startsWith("/tmp") || k.startsWith("/.trash") ? "oubento" : "root";
    });
    if (!mem["/etc/sudoers"]) {
      mem["/etc/sudoers"] = { type: "file", content: "root ALL=(ALL:ALL) ALL\n%sudo ALL=(ALL:ALL) ALL\noubento ALL=(ALL:ALL) ALL\n", mime: "text/plain", owner: "root", mtime: now() };
    }
    if (!mem["/etc/passwd"]) {
      mem["/etc/passwd"] = { type: "file", content: "root:x:0:0:root:/root:/bin/bash\noubento:x:1000:1000:Oubento:/home/oubento:/bin/bash\n", mime: "text/plain", owner: "root", mtime: now() };
    }
    if (!mem["/etc/hosts"]) {
      mem["/etc/hosts"] = { type: "file", content: "127.0.0.1 localhost\n127.0.1.1 oubento-phone\n", mime: "text/plain", owner: "root", mtime: now() };
    }
    mem["/.oubento-fs-version"] = { type: "file", content: "4\n", mime: "text/plain", owner: "root", mtime: now() };
  }

  function isSystem(p) {
    p = norm(p);
    if (p.startsWith("/home/oubento") || p.startsWith("/tmp") || p.startsWith("/.trash")) return false;
    return p === "/" || p.startsWith("/etc") || p.startsWith("/usr") || p.startsWith("/var") || p.startsWith("/bin") || p.startsWith("/sbin") || p.startsWith("/root") || p.startsWith("/proc") || p.startsWith("/opt") || p.startsWith("/sys") || p.startsWith("/dev") || p.startsWith("/run") || p.startsWith("/lib") || p.startsWith("/boot");
  }

  function canWrite(p) {
    if (window.AUTH && AUTH.isRoot()) return true;
    return !isSystem(p);
  }

  function assertWrite(p) {
    if (!canWrite(p)) throw new Error("Permission denied (need root inside Oubento)");
  }

  function exists(p) {
    p = norm(p);
    return !!mem[p] || !!virt[p];
  }

  function stat(p) {
    p = norm(p);
    if (virt[p]) {
      const content = String(virt[p]() ?? "");
      return { type: "file", content, mime: "text/plain", size: content.length, mtime: now(), owner: "root", virtual: true };
    }
    return mem[p] || null;
  }

  function list(p) {
    p = norm(p);
    const node = mem[p];
    if (!node || node.type !== "dir") return [];
    const prefix = p === "/" ? "/" : p + "/";
    const names = new Set();
    const out = [];
    Object.keys(mem).forEach((k) => {
      if (k !== p && k.startsWith(prefix) && !k.slice(prefix.length).includes("/")) {
        names.add(k);
        out.push({ path: k, name: base(k), ...mem[k] });
      }
    });
    Object.keys(virt).forEach((k) => {
      if (k !== p && k.startsWith(prefix) && !k.slice(prefix.length).includes("/") && !names.has(k)) {
        out.push({ path: k, name: base(k), ...stat(k) });
      }
    });
    return out.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name, "ar") : a.type === "dir" ? -1 : 1));
  }

  async function mkdir(p) {
    p = norm(p);
    assertWrite(p);
    if (mem[p]) throw new Error("exists");
    const par = parent(p);
    if (!mem[par] || mem[par].type !== "dir") throw new Error("no parent");
    mem[p] = { type: "dir", mtime: now(), owner: AUTH && AUTH.isRoot() ? "root" : "oubento" };
    await persist();
  }

  async function write(p, content, mime = "text/plain") {
    p = norm(p);
    assertWrite(p);
    const par = parent(p);
    if (!mem[par] || mem[par].type !== "dir") throw new Error("no parent");
    mem[p] = {
      type: "file",
      content,
      mime,
      size: typeof content === "string" ? new Blob([content]).size : (content.size || 0),
      mtime: now(),
      owner: AUTH && AUTH.isRoot() ? "root" : "oubento",
    };
    await persist();
    return mem[p];
  }

  function read(p) {
    p = norm(p);
    if (virt[p]) return virt[p]();
    const n = mem[p];
    if (!n || n.type !== "file") throw new Error("not a file");
    return n.content;
  }

  async function remove(p, { toTrash = true } = {}) {
    p = norm(p);
    assertWrite(p);
    if (p === "/" || p === "/home" || p === "/home/oubento") throw new Error("protected");
    const keys = Object.keys(mem).filter((k) => k === p || k.startsWith(p + "/"));
    if (toTrash && !p.startsWith("/.trash")) {
      const stamp = Date.now();
      for (const k of keys) {
        const dest = "/.trash/" + stamp + "-" + base(k);
        mem[dest] = { ...mem[k], origin: k };
      }
    }
    keys.forEach((k) => delete mem[k]);
    await persist();
  }

  async function rename(p, nextName) {
    p = norm(p);
    assertWrite(p);
    const dest = norm(parent(p) + "/" + nextName);
    if (mem[dest]) throw new Error("exists");
    const keys = Object.keys(mem).filter((k) => k === p || k.startsWith(p + "/"));
    for (const k of keys) {
      const nk = dest + k.slice(p.length);
      mem[nk] = mem[k];
      delete mem[k];
    }
    await persist();
    return dest;
  }

  async function copy(src, destDir) {
    src = norm(src);
    const dest = norm(destDir + "/" + base(src));
    const keys = Object.keys(mem).filter((k) => k === src || k.startsWith(src + "/"));
    for (const k of keys) {
      mem[dest + k.slice(src.length)] = { ...mem[k], mtime: now() };
    }
    await persist();
    return dest;
  }

  async function emptyTrash() {
    Object.keys(mem)
      .filter((k) => k.startsWith("/.trash/") || k === "/.trash")
      .forEach((k) => {
        if (k !== "/.trash") delete mem[k];
      });
    await persist();
  }

  function tree(p = "/", depth = 2, prefix = "") {
    const items = list(p);
    return items
      .map((it, i) => {
        const last = i === items.length - 1;
        const branch = prefix + (last ? "└─ " : "├─ ");
        const next = prefix + (last ? "   " : "│  ");
        let line = branch + it.name + (it.type === "dir" ? "/" : "");
        if (it.type === "dir" && depth > 0) line += "\n" + tree(it.path, depth - 1, next);
        return line;
      })
      .join("\n");
  }

  function usage() {
    let files = 0, dirs = 0, bytes = 0;
    Object.values(mem).forEach((n) => {
      if (n.type === "dir") dirs++;
      else {
        files++;
        bytes += n.size || 0;
      }
    });
    return { files, dirs, bytes, nodes: Object.keys(mem).length };
  }

  function find(q, root = "/") {
    q = q.toLowerCase();
    root = norm(root);
    return Object.keys(mem)
      .filter((k) => (root === "/" || k === root || k.startsWith(root + "/")) && base(k).toLowerCase().includes(q))
      .map((k) => ({ path: k, name: base(k), ...mem[k] }));
  }

  return {
    init, persist, norm, parent, base, exists, stat, list, mkdir, write, read,
    remove, rename, copy, emptyTrash, tree, usage, find, seed, canWrite, isSystem,
    ensureDir, registerVirtual,
    get raw() { return mem; },
  };
})();
