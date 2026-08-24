#!/usr/bin/env python3
"""Build a signed debug APK for Oubento without the Android SDK."""
from __future__ import annotations

import hashlib
import os
import shutil
import struct
import zipfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "dist" / "Oubento.apk"
TEMPLATE = ROOT / "tools" / "apk-template" / "base.apk"

# android: attribute resource IDs
ATTR = {
    "theme": 0x01010000,
    "label": 0x01010001,
    "icon": 0x01010002,
    "name": 0x01010003,
    "permission": 0x01010006,
    "exported": 0x01010010,
    "hardwareAccelerated": 0x010102D3,
    "configChanges": 0x0101001F,
    "screenOrientation": 0x0101001E,
    "versionCode": 0x0101021B,
    "versionName": 0x0101021C,
    "minSdkVersion": 0x0101020C,
    "targetSdkVersion": 0x01010270,
    "debuggable": 0x0101000F,
    "allowBackup": 0x01010280,
    "value": 0x01010024,
    "usesCleartextTraffic": 0x010104EC,
}

TYPE_NULL = 0x00
TYPE_REFERENCE = 0x01
TYPE_STRING = 0x03
TYPE_INT_DEC = 0x10
TYPE_INT_HEX = 0x11
TYPE_INT_BOOLEAN = 0x12

NS_ANDROID = "http://schemas.android.com/apk/res/android"


def u16(n: int) -> bytes:
    return struct.pack("<H", n & 0xFFFF)


def u32(n: int) -> bytes:
    return struct.pack("<I", n & 0xFFFFFFFF)


class Pool:
    def __init__(self) -> None:
        self.items: list[str] = []
        self.idx: dict[str, int] = {}

    def add(self, s: str | None) -> int:
        if s is None:
            return 0xFFFFFFFF
        if s not in self.idx:
            self.idx[s] = len(self.items)
            self.items.append(s)
        return self.idx[s]


def utf16_str(s: str) -> bytes:
    chars = s.encode("utf-16le")
    n = len(s)
    return u16(n) + chars + b"\x00\x00"


def build_string_pool(strings: list[str]) -> bytes:
    data = b"".join(utf16_str(s) for s in strings)
    offsets = []
    off = 0
    for s in strings:
        offsets.append(off)
        off += 2 + len(s.encode("utf-16le")) + 2
    header_size = 0x1C
    strings_start = header_size + 4 * len(strings)
    chunk = (
        u32(len(strings))
        + u32(0)
        + u32(0)  # UTF-16
        + u32(strings_start)
        + u32(0)
        + b"".join(u32(o) for o in offsets)
        + data
    )
    pad = (4 - (len(chunk) % 4)) % 4
    chunk += b"\x00" * pad
    return u16(0x0001) + u16(header_size) + u32(8 + len(chunk)) + chunk


def chunk(typ: int, header_size: int, body: bytes) -> bytes:
    # ResChunk_header.size is the full chunk including the 8-byte header.
    return u16(typ) + u16(header_size) + u32(8 + len(body)) + body


def res_value(typ: int, data: int) -> bytes:
    return u16(8) + bytes([0, typ]) + u32(data)


def start_ns(line: int, prefix: int, uri: int) -> bytes:
    body = u32(line) + u32(0xFFFFFFFF) + u32(prefix) + u32(uri)
    return chunk(0x0100, 0x10, body)


def end_ns(line: int, prefix: int, uri: int) -> bytes:
    body = u32(line) + u32(0xFFFFFFFF) + u32(prefix) + u32(uri)
    return chunk(0x0101, 0x10, body)


def start_el(line: int, ns: int, name: int, attrs: list[tuple[int, int, int, int, int]]) -> bytes:
    # attr: (ns, name, raw_str, type, data)
    attr_data = b""
    for a_ns, a_name, raw, typ, data in attrs:
        attr_data += u32(a_ns) + u32(a_name) + u32(raw) + res_value(typ, data)
    body = (
        u32(line)
        + u32(0xFFFFFFFF)
        + u32(ns)
        + u32(name)
        + u16(0x14)
        + u16(0x14)
        + u16(len(attrs))
        + u16(0)
        + u16(0)
        + u16(0)
        + attr_data
    )
    return chunk(0x0102, 0x10, body)


def end_el(line: int, ns: int, name: int) -> bytes:
    body = u32(line) + u32(0xFFFFFFFF) + u32(ns) + u32(name)
    return chunk(0x0103, 0x10, body)


def build_manifest() -> bytes:
    p = Pool()
    # Resource-map strings MUST occupy the first pool slots.
    android_attrs_order = [
        "theme",
        "label",
        "name",
        "exported",
        "hardwareAccelerated",
        "configChanges",
        "screenOrientation",
        "versionCode",
        "versionName",
        "minSdkVersion",
        "targetSdkVersion",
        "debuggable",
        "allowBackup",
        "value",
        "usesCleartextTraffic",
    ]
    for a in android_attrs_order:
        p.add(a)

    android = p.add("android")
    uri = p.add(NS_ANDROID)
    manifest = p.add("manifest")
    uses_sdk = p.add("uses-sdk")
    uses_perm = p.add("uses-permission")
    application = p.add("application")
    activity = p.add("activity")
    intent = p.add("intent-filter")
    action = p.add("action")
    category = p.add("category")
    meta = p.add("meta-data")
    package_name_id = p.add("package")

    pkg = p.add("os.oubento")
    ver_name = p.add("24.04.2")
    act_name = p.add("com.nicron.webview.MainActivity")
    app_label = p.add("Oubento")
    perm_net = p.add("android.permission.INTERNET")
    perm_ns = p.add("android.permission.ACCESS_NETWORK_STATE")
    perm_cam = p.add("android.permission.CAMERA")
    perm_mic = p.add("android.permission.RECORD_AUDIO")
    perm_loc = p.add("android.permission.ACCESS_FINE_LOCATION")
    perm_loc2 = p.add("android.permission.ACCESS_COARSE_LOCATION")
    main = p.add("android.intent.action.MAIN")
    launcher = p.add("android.intent.category.LAUNCHER")
    md_back = p.add("nitron.backButton")
    md_hist = p.add("history")
    md_splash = p.add("nitron.splashBackground")
    md_color = p.add("#1a0b14")
    md_cache = p.add("nitron.clearCacheOnStart")

    A = NS = uri  # android namespace index for attributes

    def attr_android(key: str, typ: int, data: int, raw: int = 0xFFFFFFFF) -> tuple:
        return (uri, p.idx[key], raw, typ, data)

    def attr_name_str(sidx: int) -> tuple:
        return (uri, p.idx["name"], sidx, TYPE_STRING, sidx)

    line = 1
    parts: list[bytes] = []
    parts.append(start_ns(line, android, uri))
    parts.append(
        start_el(
            line,
            0xFFFFFFFF,
            manifest,
            [
                (0xFFFFFFFF, package_name_id, pkg, TYPE_STRING, pkg),
                attr_android("versionCode", TYPE_INT_DEC, 3),
                attr_android("versionName", TYPE_STRING, ver_name, ver_name),
            ],
        )
    )
    parts.append(
        start_el(
            line,
            0xFFFFFFFF,
            uses_sdk,
            [
                attr_android("minSdkVersion", TYPE_INT_DEC, 21),
                attr_android("targetSdkVersion", TYPE_INT_DEC, 29),
            ],
        )
    )
    parts.append(end_el(line, 0xFFFFFFFF, uses_sdk))

    for perm in (perm_net, perm_ns, perm_cam, perm_mic, perm_loc, perm_loc2):
        parts.append(start_el(line, 0xFFFFFFFF, uses_perm, [attr_name_str(perm)]))
        parts.append(end_el(line, 0xFFFFFFFF, uses_perm))

    parts.append(
        start_el(
            line,
            0xFFFFFFFF,
            application,
            [
                attr_android("label", TYPE_STRING, app_label, app_label),
                attr_android("debuggable", TYPE_INT_BOOLEAN, 1),
                attr_android("allowBackup", TYPE_INT_BOOLEAN, 1),
                attr_android("usesCleartextTraffic", TYPE_INT_BOOLEAN, 1),
                attr_android("hardwareAccelerated", TYPE_INT_BOOLEAN, 1),
            ],
        )
    )
    # meta-data
    for k, v, is_bool in (
        (md_back, md_hist, False),
        (md_splash, md_color, False),
        (md_cache, 0, True),
    ):
        if is_bool:
            attrs = [attr_name_str(k), attr_android("value", TYPE_INT_BOOLEAN, 0)]
        else:
            attrs = [attr_name_str(k), attr_android("value", TYPE_STRING, v, v)]
        parts.append(start_el(line, 0xFFFFFFFF, meta, attrs))
        parts.append(end_el(line, 0xFFFFFFFF, meta))

    # configChanges: keyboard|keyboardHidden|orientation|screenSize = 0x4A0
    # orientation|keyboardHidden|screenSize|keyboard = 0x480 + 0x20 + 0x10? 
    # keyboard=0x0010, keyboardHidden=0x0020, orientation=0x0080, screenSize=0x0400 → 0x04B0
    parts.append(
        start_el(
            line,
            0xFFFFFFFF,
            activity,
            [
                attr_name_str(act_name),
                attr_android("exported", TYPE_INT_BOOLEAN, 1),
                attr_android("hardwareAccelerated", TYPE_INT_BOOLEAN, 1),
                attr_android("configChanges", TYPE_INT_HEX, 0x04B0),
                attr_android("screenOrientation", TYPE_INT_DEC, 1),
                attr_android("label", TYPE_STRING, app_label, app_label),
            ],
        )
    )
    parts.append(start_el(line, 0xFFFFFFFF, intent, []))
    parts.append(start_el(line, 0xFFFFFFFF, action, [attr_name_str(main)]))
    parts.append(end_el(line, 0xFFFFFFFF, action))
    parts.append(start_el(line, 0xFFFFFFFF, category, [attr_name_str(launcher)]))
    parts.append(end_el(line, 0xFFFFFFFF, category))
    parts.append(end_el(line, 0xFFFFFFFF, intent))
    parts.append(end_el(line, 0xFFFFFFFF, activity))
    parts.append(end_el(line, 0xFFFFFFFF, application))
    parts.append(end_el(line, 0xFFFFFFFF, manifest))
    parts.append(end_ns(line, android, uri))

    pool = build_string_pool(p.items)
    # resource map for android attributes that appear in pool after they were added
    res_ids = [ATTR[k] for k in android_attrs_order]
    res_map = u16(0x0180) + u16(8) + u32(8 + 4 * len(res_ids)) + b"".join(u32(i) for i in res_ids)

    inner = pool + res_map + b"".join(parts)
    xml = u16(0x0003) + u16(8) + u32(8 + len(inner)) + inner
    return xml


def collect_www() -> list[tuple[str, bytes]]:
    files = []
    www = ROOT
    keep = ["index.html", "manifest.json", "sw.js"]
    for name in keep:
        p = www / name
        files.append((f"assets/www/{name}", p.read_bytes()))
    for folder in ("css", "js", "assets"):
        base = www / folder
        for p in base.rglob("*"):
            if p.is_file() and ".git" not in p.parts:
                rel = p.relative_to(www).as_posix()
                files.append((f"assets/www/{rel}", p.read_bytes()))
    return files


def empty_arsc() -> bytes:
    pool_body = u32(0) + u32(0) + u32(0) + u32(0x1C) + u32(0)
    pool = u16(0x0001) + u16(0x1C) + u32(8 + len(pool_body)) + pool_body
    return u16(0x0002) + u16(0x0C) + u32(12 + len(pool)) + u32(0) + pool


def pack_unsigned(manifest: bytes, dex: bytes, www_files: list[tuple[str, bytes]], dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists():
        dest.unlink()
    arsc = empty_arsc()
    with zipfile.ZipFile(dest, "w") as zf:
        info = zipfile.ZipInfo("AndroidManifest.xml")
        info.compress_type = zipfile.ZIP_STORED
        zf.writestr(info, manifest)
        info = zipfile.ZipInfo("resources.arsc")
        info.compress_type = zipfile.ZIP_STORED
        zf.writestr(info, arsc)
        info = zipfile.ZipInfo("classes.dex")
        info.compress_type = zipfile.ZIP_STORED
        zf.writestr(info, dex)
        for name, data in www_files:
            info = zipfile.ZipInfo(name)
            info.compress_type = zipfile.ZIP_DEFLATED
            zf.writestr(info, data)


def sha256_b64(data: bytes) -> str:
    import base64

    return base64.b64encode(hashlib.sha256(data).digest()).decode("ascii")


def sign_v1(apk_path: Path) -> None:
    from cryptography import x509
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import rsa
    from cryptography.hazmat.primitives.serialization import pkcs7
    from cryptography.x509.oid import NameOID

    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "Oubento Debug")])
    now = datetime.now(timezone.utc)
    cert = (
        x509.CertificateBuilder()
        .subject_name(name)
        .issuer_name(name)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - timedelta(days=1))
        .not_valid_after(now + timedelta(days=3650))
        .sign(key, hashes.SHA256())
    )

    with zipfile.ZipFile(apk_path, "r") as zf:
        entries = [(i.filename, zf.read(i.filename)) for i in zf.infolist() if not i.is_dir()]

    mf_lines = ["Manifest-Version: 1.0", "Created-By: Oubento", ""]
    sf_entries = []
    for fname, data in entries:
        digest = sha256_b64(data)
        block = [f"Name: {fname}", f"SHA-256-Digest: {digest}", ""]
        mf_lines.extend(block)
        sf_entries.append((fname, sha256_b64(("\r\n".join(block) + "\r\n").encode("utf-8"))))

    def wrap(lines: list[str]) -> bytes:
        out = []
        for line in lines:
            while len(line) > 70:
                out.append(line[:70])
                line = " " + line[70:]
            out.append(line)
        return ("\r\n".join(out) + "\r\n").encode("utf-8")

    manifest_mf = wrap(mf_lines)
    sf_lines = [
        "Signature-Version: 1.0",
        "Created-By: Oubento",
        f"SHA-256-Digest-Manifest: {sha256_b64(manifest_mf)}",
        "",
    ]
    for fname, dgst in sf_entries:
        sf_lines.extend([f"Name: {fname}", f"SHA-256-Digest: {dgst}", ""])
    cert_sf = wrap(sf_lines)

    cert_rsa = (
        pkcs7.PKCS7SignatureBuilder()
        .set_data(cert_sf)
        .add_signer(cert, key, hashes.SHA256())
        .sign(serialization.Encoding.DER, [pkcs7.PKCS7Options.DetachedSignature])
    )

    tmp = apk_path.with_suffix(".signed.apk")
    with zipfile.ZipFile(apk_path, "r") as src, zipfile.ZipFile(tmp, "w") as dst:
        for item in src.infolist():
            if item.filename.startswith("META-INF/"):
                continue
            dst.writestr(item, src.read(item.filename))
        for name, data in (
            ("META-INF/MANIFEST.MF", manifest_mf),
            ("META-INF/CERT.SF", cert_sf),
            ("META-INF/CERT.RSA", cert_rsa),
        ):
            info = zipfile.ZipInfo(name)
            info.compress_type = zipfile.ZIP_DEFLATED
            dst.writestr(info, data)
    tmp.replace(apk_path)


def _lp(data: bytes) -> bytes:
    return struct.pack("<I", len(data)) + data


def _zip_eocd(buf: bytes) -> int:
    for i in range(len(buf) - 22, max(-1, len(buf) - 22 - 65535), -1):
        if buf[i : i + 4] == b"PK\x05\x06":
            return i
    raise ValueError("EOCD not found")


def _chunked_sha256(parts: list[bytes]) -> bytes:
    chunks = []
    for part in parts:
        off = 0
        while off < len(part):
            piece = part[off : off + 1024 * 1024]
            h = hashlib.sha256()
            h.update(b"\xa5")
            h.update(struct.pack("<I", len(piece)))
            h.update(piece)
            chunks.append(h.digest())
            off += 1024 * 1024
    h = hashlib.sha256()
    h.update(b"\x5a")
    h.update(struct.pack("<I", len(chunks)))
    for c in chunks:
        h.update(c)
    return h.digest()


def sign_v2(apk_path: Path) -> None:
    """APK Signature Scheme v2 so modern Android will parse the package."""
    from cryptography import x509
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import padding, rsa
    from cryptography.x509.oid import NameOID

    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "Oubento")])
    now = datetime.now(timezone.utc)
    cert = (
        x509.CertificateBuilder()
        .subject_name(name)
        .issuer_name(name)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - timedelta(days=1))
        .not_valid_after(now + timedelta(days=3650))
        .sign(key, hashes.SHA256())
    )
    cert_der = cert.public_bytes(serialization.Encoding.DER)
    pub_der = key.public_key().public_bytes(
        serialization.Encoding.DER, serialization.PublicFormat.SubjectPublicKeyInfo
    )

    data = apk_path.read_bytes()
    eocd = _zip_eocd(data)
    cd_off = struct.unpack_from("<I", data, eocd + 16)[0]
    cd = data[cd_off:eocd]
    eocd_bytes = bytearray(data[eocd:])
    before = data[:cd_off]
    digest = _chunked_sha256([before, cd, bytes(eocd_bytes)])

    alg = 0x0103  # RSASSA-PKCS1-v1_5 with SHA-256
    digest_item = struct.pack("<I", alg) + _lp(digest)
    signed_data = _lp(_lp(digest_item)) + _lp(_lp(cert_der)) + _lp(b"")
    signature = key.sign(signed_data, padding.PKCS1v15(), hashes.SHA256())
    sig_item = struct.pack("<I", alg) + _lp(signature)
    signer = _lp(signed_data) + _lp(_lp(sig_item)) + _lp(pub_der)
    v2_block = _lp(_lp(signer))

    pair = struct.pack("<I", 0x7109871A) + v2_block
    pair_lp = struct.pack("<Q", len(pair)) + pair
    # size field excludes itself but includes trailing size+magic
    magic = b"APK Sig Block 42"
    block_wo_first = pair_lp + struct.pack("<Q", 0) + magic
    size = len(block_wo_first)
    block = struct.pack("<Q", size) + pair_lp + struct.pack("<Q", size) + magic

    new_cd = cd_off + len(block)
    struct.pack_into("<I", eocd_bytes, 16, new_cd)
    apk_path.write_bytes(before + block + cd + bytes(eocd_bytes))


def main() -> None:
    if not TEMPLATE.exists():
        raise SystemExit(f"missing template {TEMPLATE} — run: cd /tmp && npm pack nitron && tar xf")
    with zipfile.ZipFile(TEMPLATE) as zf:
        dex = zf.read("classes.dex")
    print("crafting AndroidManifest.xml …")
    manifest = build_manifest()
    print("manifest", len(manifest), "bytes")
    print("collecting web OS …")
    www = collect_www()
    print("files", len(www))
    pack_unsigned(manifest, dex, www, OUT)
    print("signing v1 + v2 …")
    sign_v1(OUT)
    sign_v2(OUT)
    print("APK", OUT, OUT.stat().st_size, "bytes")


if __name__ == "__main__":
    main()
