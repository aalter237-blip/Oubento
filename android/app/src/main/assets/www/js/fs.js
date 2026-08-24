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

  function seed() {
    const ts = now();
    const dir = (extra = {}) => ({ type: "dir", mtime: ts, ...extra });
    const file = (content, mime = "text/plain") => ({
      type: "file",
      content,
      mime,
      size: new Blob([content]).size,
      mtime: ts,
    });
    mem = {
      "/": dir(),
      "/home": dir(),
      "/home/oubento": dir({ label: "Home" }),
      "/home/oubento/Desktop": dir(),
      "/home/oubento/Documents": dir(),
      "/home/oubento/Downloads": dir(),
      "/home/oubento/Pictures": dir(),
      "/home/oubento/Music": dir(),
      "/home/oubento/Videos": dir(),
      "/home/oubento/Templates": dir(),
      "/home/oubento/Public": dir(),
      "/usr": dir({ owner: "root" }),
      "/usr/bin": dir({ owner: "root" }),
      "/usr/share": dir({ owner: "root" }),
      "/bin": dir({ owner: "root" }),
      "/sbin": dir({ owner: "root" }),
      "/opt": dir({ owner: "root" }),
      "/root": dir({ owner: "root", mode: 700 }),
      "/etc": dir({ owner: "root" }),
      "/tmp": dir({ owner: "oubento", mode: 1777 }),
      "/var": dir({ owner: "root" }),
      "/var/log": dir({ owner: "root" }),
      "/proc": dir({ owner: "root" }),
      "/.trash": dir(),
    };
    mem["/etc/os-release"] = file(
      [
        "NAME=\"Oubento\"",
        "PRETTY_NAME=\"Oubento 24.04 LTS (Noble Numbat)\"",
        "VERSION=\"24.04.1 LTS\"",
        "ID=oubento",
        "ID_LIKE=ubuntu debian",
        "HOME_URL=\"https://ubuntu.com/\"",
        "SUPPORT_URL=\"https://help.ubuntu.com/\"",
      ].join("\n") + "\n"
    );
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
    const extra = ["/root", "/bin", "/sbin", "/opt", "/usr/bin", "/proc"];
    extra.forEach((p) => {
      if (!mem[p]) mem[p] = { type: "dir", mtime: now(), owner: "root" };
    });
    Object.keys(mem).forEach((k) => {
      if (!mem[k].owner) mem[k].owner = k.startsWith("/home/oubento") || k.startsWith("/tmp") || k.startsWith("/.trash") ? "oubento" : "root";
    });
    if (!mem["/etc/sudoers"]) {
      mem["/etc/sudoers"] = { type: "file", content: "root ALL=(ALL:ALL) ALL\n%sudo ALL=(ALL:ALL) ALL\noubento ALL=(ALL:ALL) ALL\n", mime: "text/plain", owner: "root", mtime: now() };
    }
    if (!mem["/etc/passwd"]) {
      mem["/etc/passwd"] = { type: "file", content: "root:x:0:0:root:/root:/bin/bash\noubento:x:1000:1000:Oubento:/home/oubento:/bin/bash\n", mime: "text/plain", owner: "root", mtime: now() };
    }
  }

  function isSystem(p) {
    p = norm(p);
    if (p.startsWith("/home/oubento") || p.startsWith("/tmp") || p.startsWith("/.trash")) return false;
    return p === "/" || p.startsWith("/etc") || p.startsWith("/usr") || p.startsWith("/var") || p.startsWith("/bin") || p.startsWith("/sbin") || p.startsWith("/root") || p.startsWith("/proc") || p.startsWith("/opt");
  }

  function canWrite(p) {
    if (window.AUTH && AUTH.isRoot()) return true;
    return !isSystem(p);
  }

  function assertWrite(p) {
    if (!canWrite(p)) throw new Error("Permission denied (need root inside Oubento)");
  }

  function exists(p) {
    return !!mem[norm(p)];
  }

  function stat(p) {
    return mem[norm(p)] || null;
  }

  function list(p) {
    p = norm(p);
    const node = mem[p];
    if (!node || node.type !== "dir") return [];
    const prefix = p === "/" ? "/" : p + "/";
    return Object.keys(mem)
      .filter((k) => k !== p && k.startsWith(prefix) && !k.slice(prefix.length).includes("/"))
      .map((k) => ({ path: k, name: base(k), ...mem[k] }))
      .sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name, "ar") : a.type === "dir" ? -1 : 1));
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
    const n = mem[norm(p)];
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
    remove, rename, copy, emptyTrash, tree, usage, find, seed,
    get raw() { return mem; },
  };
})();
