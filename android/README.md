# Oubento Android (تطبيق مستقل بدون كروم)

مشروع WebView يغلّف النظام داخل تطبيق أندرويد مستقل. لا يفتح Chrome؛ يعمل بملء الشاشة من أيقونة التطبيق.

## تنزيل APK من GitHub Actions

بعد دفع الفرع يُبنى الملف تلقائياً:

1. افتح تبويب **Actions** في المستودع
2. اختر **Build APK** → آخر تشغيل ناجح
3. حمّل الأداة **Oubento-apk** (`app-debug.apk`)
4. ثبّته على الهاتف (اسمح بالمصادر غير المعروفة)

## البناء على جهازك (يلزم Android Studio أو SDK)

```bash
bash tools/sync-android-assets.sh
cd android
# افتح المجلد في Android Studio ثم Build > Build APK
```

هذه الحزمة ليست روت لأندرويد ولا تثبت نواة لينكس حقيقية.
