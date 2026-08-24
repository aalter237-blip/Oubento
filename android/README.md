# Oubento Android (تطبيق مستقل بدون كروم)

مشروع WebView يغلّف النظام داخل تطبيق أندرويد مستقل. لا يفتح Chrome؛ يعمل بملء الشاشة من أيقونة التطبيق.

## البناء على جهازك (يلزم Android Studio أو SDK)

```bash
# من جذر المشروع
bash tools/sync-android-assets.sh
cd android
# افتح المجلد في Android Studio ثم Build > Build APK
# أو:
./gradlew assembleDebug
```

الملف الناتج:

`android/app/build/outputs/apk/debug/app-debug.apk`

ثبّته على الهاتف (مصدر غير معروف).

هذه الحزمة ليست روت لأندرويد ولا تثبت نواة لينكس حقيقية. هي نظام أوبنتو/التوزيعات داخل تطبيق مستقل.
