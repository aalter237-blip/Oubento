# Oubento

نظام مكتبي للهاتف مستوحى من أوبنتو وتوزيعات لينكس (GNOME، Plasma، Xfce، Unity…).

يعمل كتطبيق مستقل بملء الشاشة. **ليس** نواة لينكس على الهاتف، و**ليس** روت لأندرويد.

المستودع: https://github.com/aalter237-blip/Oubento  
الفرع: `arena/01a03395-oubento`

## التجربة السريعة

```bash
git clone -b arena/01a03395-oubento https://github.com/aalter237-blip/Oubento.git
cd Oubento
python3 -m http.server 8080 --bind 0.0.0.0
```

افتح `http://localhost:8080` ثم اضغط دخول.  
كلمة المرور الاختيارية: `ubuntu`

## الطرفية (جاهزة)

افتح تطبيق الطرفية وجرّب:

```
help
whoami
id
neofetch
lsb_release
ls /
ls ~
sudo -i
# كلمة ubuntu
id
apt list
exit
```

أوامر أخرى: `cd` `pwd` `cat` `mkdir` `rm` `nano` `apt` `dnf` `pacman` `tree` `find` `df` `ps`

## روت داخل أوبنتو فقط

- حسابان: `oubento` (sudo) و `root` (uid 0)
- كلمة المرور: `ubuntu`
- `sudo -i` أو `su -` — الموجّه يصبح `#`
- الملفات: **فتح كمسؤول** لمسارات مثل `/etc`

## التوزيعات

Ubuntu · Kubuntu · Xubuntu · Lubuntu · Ubuntu MATE · Ubuntu Budgie · Ubuntu Unity · Edubuntu · Debian · Linux Mint · Pop!_OS · elementary OS · Zorin OS · Fedora · Manjaro · Arch · openSUSE · AlmaLinux

كل جلسة تأتي ببرامجها (دولفين/كيت/ديسكفر، ثونار، نيمو/تايم شفت، dnfdragora…).

## بناء APK على جهازك

```bash
bash tools/sync-android-assets.sh
# افتح android/ في Android Studio → Build APK
```

التفاصيل: `android/README.md`
