# Oubento

نظام ضيف مكتمل قائم بذاته داخل تطبيق أندرويد، مستوحى من أوبنتو.

يعمل بملء الشاشة دون كروم. **ليس** نواة لينكس على عتاد الهاتف، و**ليس** روت لأندرويد.

داخله يوجد: نواة ضيف، نظام ملفات FHS، خدمات، مدير حزم، طرفية، وسطح مكتب.

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

## الطرفية

```
help
neofetch
ls /
cat /etc/os-release
cat /proc/version
Ping www.facebook.com
sudo apt install python3
python3 -c "print(2+2)"
echo hi | grep h
systemctl status
```

الأوامر لا تفرّق بين الأحرف الكبيرة والصغيرة. أنابيب `|` وإعادة توجيه `>` مدعومة.

## روت داخل أوبنتو فقط

- حسابان: `oubento` (sudo) و `root` (uid 0)
- كلمة المرور: `ubuntu`
- لا يؤثر على أندرويد

## ملف APK

**[dist/Oubento.apk](dist/Oubento.apk)** — `os.oubento` 24.04.4

```bash
python3 -m venv .venv && .venv/bin/pip install cryptography
.venv/bin/python tools/make_apk.py
```
