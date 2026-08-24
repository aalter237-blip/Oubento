const DISTROS = [
  { id: "ubuntu", name: "Ubuntu", ar: "أوبنتو", family: "debian", de: "gnome", version: "24.04.1", codename: "Noble Numbat", color: "#e95420", accent: "#77216f", panel: "#1c1218", wall: "assets/wallpapers/ubuntu-default.jpg", pkg: "apt", session: "GNOME / Yaru" },
  { id: "kubuntu", name: "Kubuntu", ar: "كوبونتو", family: "debian", de: "plasma", version: "24.04", codename: "Noble", color: "#1d99f3", accent: "#3daee9", panel: "#1e1e20", wall: "assets/wallpapers/ubuntu-dark.jpg", pkg: "apt", session: "KDE Plasma" },
  { id: "xubuntu", name: "Xubuntu", ar: "زوبونتو", family: "debian", de: "xfce", version: "24.04", codename: "Noble", color: "#0044aa", accent: "#0d7377", panel: "#2a2e32", wall: "assets/wallpapers/ubuntu-dark.jpg", pkg: "apt", session: "Xfce" },
  { id: "lubuntu", name: "Lubuntu", ar: "لوبونتو", family: "debian", de: "lxqt", version: "24.04", codename: "Noble", color: "#0068c8", accent: "#6c6c6c", panel: "#303030", wall: "assets/wallpapers/ubuntu-light.jpg", pkg: "apt", session: "LXQt" },
  { id: "ubuntu-mate", name: "Ubuntu MATE", ar: "أوبنتو ماتيه", family: "debian", de: "mate", version: "24.04", codename: "Noble", color: "#87a556", accent: "#2c3e50", panel: "#2d3436", wall: "assets/wallpapers/ubuntu-orange.jpg", pkg: "apt", session: "MATE" },
  { id: "ubuntu-budgie", name: "Ubuntu Budgie", ar: "أوبنتو بادجي", family: "debian", de: "budgie", version: "24.04", codename: "Noble", color: "#4c90d2", accent: "#2e3440", panel: "#3b4252", wall: "assets/wallpapers/ubuntu-dark.jpg", pkg: "apt", session: "Budgie" },
  { id: "ubuntu-unity", name: "Ubuntu Unity", ar: "أوبنتو يونيتي", family: "debian", de: "unity", version: "24.04", codename: "Noble", color: "#e95420", accent: "#300a24", panel: "#2c001e", wall: "assets/wallpapers/ubuntu-default.jpg", pkg: "apt", session: "Unity 7" },
  { id: "edubuntu", name: "Edubuntu", ar: "إيدوبونتو", family: "debian", de: "gnome", version: "24.04", codename: "Noble", color: "#f0a30a", accent: "#e95420", panel: "#3a2a10", wall: "assets/wallpapers/ubuntu-orange.jpg", pkg: "apt", session: "GNOME" },
  { id: "debian", name: "Debian", ar: "ديبيان", family: "debian", de: "gnome", version: "12", codename: "Bookworm", color: "#a80030", accent: "#d70a53", panel: "#1a1a1a", wall: "assets/wallpapers/ubuntu-dark.jpg", pkg: "apt", session: "GNOME" },
  { id: "linuxmint", name: "Linux Mint", ar: "لينكس منت", family: "debian", de: "cinnamon", version: "22", codename: "Wilma", color: "#87cf3e", accent: "#6daa2c", panel: "#2b2b2b", wall: "assets/wallpapers/ubuntu-orange.jpg", pkg: "apt", session: "Cinnamon" },
  { id: "popos", name: "Pop!_OS", ar: "بوب أو إس", family: "debian", de: "cosmic", version: "22.04", codename: "Jammy", color: "#48b9c7", accent: "#63d0df", panel: "#111111", wall: "assets/wallpapers/ubuntu-dark.jpg", pkg: "apt", session: "COSMIC" },
  { id: "elementary", name: "elementary OS", ar: "إلمنتاري", family: "debian", de: "pantheon", version: "8", codename: "Circe", color: "#64baff", accent: "#3689e6", panel: "#333333", wall: "assets/wallpapers/ubuntu-light.jpg", pkg: "apt", session: "Pantheon" },
  { id: "zorin", name: "Zorin OS", ar: "زورين", family: "debian", de: "gnome", version: "17", codename: "Core", color: "#15a6f0", accent: "#0d7377", panel: "#0e1518", wall: "assets/wallpapers/ubuntu-dark.jpg", pkg: "apt", session: "Zorin Desktop" },
  { id: "fedora", name: "Fedora", ar: "فيدورا", family: "rhel", de: "gnome", version: "41", codename: "Adams", color: "#51a2da", accent: "#294172", panel: "#1a1b1e", wall: "assets/wallpapers/ubuntu-dark.jpg", pkg: "dnf", session: "GNOME" },
  { id: "manjaro", name: "Manjaro", ar: "مانجارو", family: "arch", de: "plasma", version: "24.2", codename: "Wynsdey", color: "#35bf5c", accent: "#1a7f37", panel: "#1f2421", wall: "assets/wallpapers/ubuntu-orange.jpg", pkg: "pacman", session: "KDE Plasma" },
  { id: "arch", name: "Arch Linux", ar: "آرتش", family: "arch", de: "plasma", version: "rolling", codename: "Rolling", color: "#1793d1", accent: "#0d7377", panel: "#111111", wall: "assets/wallpapers/ubuntu-dark.jpg", pkg: "pacman", session: "KDE Plasma" },
  { id: "opensuse", name: "openSUSE", ar: "أوبن سوزي", family: "suse", de: "plasma", version: "15.6", codename: "Leap", color: "#73ba25", accent: "#173f4f", panel: "#173f4f", wall: "assets/wallpapers/ubuntu-light.jpg", pkg: "zypper", session: "KDE Plasma" },
  { id: "almalinux", name: "AlmaLinux", ar: "ألما لينكس", family: "rhel", de: "gnome", version: "9.5", codename: "Teal Serval", color: "#0f826e", accent: "#082c28", panel: "#0b1f1c", wall: "assets/wallpapers/ubuntu-dark.jpg", pkg: "dnf", session: "GNOME" },
];

function currentDistro() {
  return DISTROS.find((d) => d.id === (OS.settings.distro || "ubuntu")) || DISTROS[0];
}

function applyDistro(id, { persist = true, rerender = false } = {}) {
  const d = DISTROS.find((x) => x.id === id) || DISTROS[0];
  OS.settings.distro = d.id;
  OS.version = d.version;
  OS.codename = d.codename;
  OS.hostname = d.id + "-phone";
  const root = document.documentElement;
  root.dataset.de = d.de;
  root.dataset.distro = d.id;
  root.style.setProperty("--orange", d.color);
  root.style.setProperty("--orange-2", d.accent);
  root.style.setProperty("--aubergine", d.accent);
  root.style.setProperty("--panel-solid", d.panel);
  root.style.setProperty("--canonical", d.panel);
  if (!OS.settings.wallpaperLocked) OS.settings.wallpaper = d.wall;
  if (persist) saveSettings();
  applyChrome();
  if (rerender) {
    renderLock();
    renderDesktop();
    applyChrome();
  }
  log("session " + d.id + " / " + d.session);
  return d;
}
