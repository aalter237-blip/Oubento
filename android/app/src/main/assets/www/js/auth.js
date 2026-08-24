const AUTH = {
  users: {
    oubento: {
      uid: 1000,
      gid: 1000,
      groups: ["oubento", "sudo", "adm", "audio", "video"],
      pass: "ubuntu",
      home: "/home/oubento",
      name: "Oubento",
    },
    root: {
      uid: 0,
      gid: 0,
      groups: ["root"],
      pass: "ubuntu",
      home: "/root",
      name: "root",
    },
  },
  session: "oubento",
  sudoUntil: 0,
  pending: null,

  current() {
    return this.users[this.session] || this.users.oubento;
  },

  isRoot() {
    return this.session === "root" || Date.now() < this.sudoUntil;
  },

  login(name, pass) {
    const u = this.users[name];
    if (!u) return false;
    const ok = pass === u.pass || pass === "ubuntu" || (!pass && name === "oubento" && !OS.settings.pin);
    if (!ok && name === "oubento" && OS.settings.pin && pass === OS.settings.pin) return this._enter(name);
    if (!ok) return false;
    return this._enter(name);
  },

  _enter(name) {
    this.session = name;
    OS.user = name;
    if (name === "root") this.sudoUntil = Date.now() + 15 * 60 * 1000;
    log("auth login " + name);
    if (typeof renderStatus === "function") renderStatus();
    return true;
  },

  drop() {
    this.session = "oubento";
    OS.user = "oubento";
    this.sudoUntil = 0;
    if (typeof renderStatus === "function") renderStatus();
  },

  elevate(pass) {
    const u = this.users[this.session] || this.users.oubento;
    const ok = pass === u.pass || pass === this.users.root.pass || pass === "ubuntu" || (OS.settings.pin && pass === OS.settings.pin);
    if (!ok) return false;
    this.sudoUntil = Date.now() + 15 * 60 * 1000;
    log("sudo ok");
    if (typeof renderStatus === "function") renderStatus();
    return true;
  },

  ask(reason) {
    if (this.isRoot()) return Promise.resolve(true);
    return new Promise((resolve) => {
      const box = document.getElementById("polkit");
      if (!box) {
        const p = prompt((reason || t("authNeed")) + "\n" + t("password") + " (ubuntu)");
        resolve(this.elevate(p || ""));
        return;
      }
      box.hidden = false;
      box.innerHTML = `<div class="pk-card">
        <div class="pk-icon">${svgIcon("root")}</div>
        <h3>${t("authTitle")}</h3>
        <p>${reason || t("authNeed")}</p>
        <p class="muted">${t("authScope")}</p>
        <input class="field" id="pkpass" type="password" placeholder="${t("password")} — ubuntu" autofocus>
        <div class="grid-2" style="margin-top:10px">
          <button class="btn" id="pkno">${t("cancel")}</button>
          <button class="btn primary" id="pkyes">${t("authGrant")}</button>
        </div>
      </div>`;
      const done = (ok) => {
        box.hidden = true;
        box.innerHTML = "";
        resolve(ok);
      };
      box.querySelector("#pkno").onclick = () => done(false);
      box.querySelector("#pkyes").onclick = () => {
        const v = box.querySelector("#pkpass").value;
        const ok = this.elevate(v);
        if (!ok) notify(t("pinWrong"), "", "root");
        done(ok);
      };
      const inp = box.querySelector("#pkpass");
      inp.onkeydown = (e) => {
        if (e.key === "Enter") box.querySelector("#pkyes").click();
      };
      setTimeout(() => inp.focus(), 50);
    });
  },
};

function rootBadge() {
  return AUTH.isRoot() ? `<span class="root-badge">ROOT</span>` : "";
}
