# Oubento

نظام مكتبي للهاتف مستوحى من أوبنتو وتوزيعات لينكس الأخرى (GNOME، Plasma، Xfce، Unity…).

يعمل كتطبيق مستقل بملء الشاشة بعد التثبيت. **ليس** نواة لينكس على الهاتف، و**ليس** روت لأندرويد.

## التوزيعات المضمّنة (جلسات سطح مكتب)

Ubuntu · Kubuntu · Xubuntu · Lubuntu · Ubuntu MATE · Ubuntu Budgie · Ubuntu Unity · Edubuntu · Debian · Linux Mint · Pop!_OS · elementary OS · Zorin OS · Fedora · Manjaro · Arch · openSUSE · AlmaLinux

اختر الجلسة من شاشة الدخول أو تطبيق **التوزيعات**.

## التشغيل هنا

المعاينة الحية تعمل الآن. كلمة المرور الاختيارية: `ubuntu`

## تطبيق أندرويد مستقل (بدون فتح كروم)

مشروع WebView جاهز في مجلد `android/`.  
هذه البيئة لا تحتوي JDK/Android SDK لذلك **لا يمكن توليد ملف `.apk` موقّع من هنا**.

على جهازك:

```bash
bash tools/sync-android-assets.sh
# افتح android/ في Android Studio → Build APK
```

التفاصيل: `android/README.md`
