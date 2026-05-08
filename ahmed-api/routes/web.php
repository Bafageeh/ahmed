<?php

use Illuminate\Support\Facades\Route;

Route::get('/health', function () {
    return response()->json([
        'ok' => true,
        'app' => 'Ahmed Web',
        'time' => now()->toDateTimeString(),
    ]);
});

Route::get('/privacy-policy', function () {
    return response(<<<'HTML'
<!doctype html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>سياسة الخصوصية - Afkar API</title>
    <style>
        body{font-family:Arial,Tahoma,sans-serif;line-height:1.8;margin:0;background:#f7f7f7;color:#111}
        main{max-width:900px;margin:40px auto;background:#fff;padding:28px;border-radius:14px;box-shadow:0 4px 18px rgba(0,0,0,.08)}
        h1,h2{color:#0f172a} a{color:#0369a1}
    </style>
</head>
<body>
<main>
    <h1>سياسة الخصوصية</h1>
    <p>توضح هذه السياسة كيفية تعامل Afkar API مع البيانات المستخدمة لتشغيل خدمات واتساب والتنبيهات المرتبطة بتطبيقاتنا.</p>

    <h2>البيانات التي نعالجها</h2>
    <p>قد نعالج أرقام الهاتف، محتوى الرسائل المطلوبة، حالة تسليم الرسائل، ومعلومات فنية لازمة لتشغيل الخدمة وتحسينها.</p>

    <h2>استخدام البيانات</h2>
    <p>تُستخدم البيانات فقط لإرسال التنبيهات والرسائل التي يطلبها المستخدم أو التي ترتبط بخدماته، ومتابعة حالة الإرسال والتسليم.</p>

    <h2>مشاركة البيانات</h2>
    <p>لا نبيع بيانات المستخدمين. قد تُرسل البيانات إلى Meta/WhatsApp عند استخدام WhatsApp Cloud API بهدف إيصال الرسائل.</p>

    <h2>حذف البيانات</h2>
    <p>لطلب حذف بياناتك أو إيقاف الرسائل، تواصل معنا عبر البريد: <a href="mailto:a.baf@live.com">a.baf@live.com</a>.</p>

    <h2>التواصل</h2>
    <p>لأي استفسار متعلق بالخصوصية: <a href="mailto:a.baf@live.com">a.baf@live.com</a>.</p>
</main>
</body>
</html>
HTML)->header('Content-Type', 'text/html; charset=UTF-8');
});

Route::get('/data-deletion', function () {
    return response(<<<'HTML'
<!doctype html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>تعليمات حذف البيانات - Afkar API</title>
    <style>
        body{font-family:Arial,Tahoma,sans-serif;line-height:1.8;margin:0;background:#f7f7f7;color:#111}
        main{max-width:900px;margin:40px auto;background:#fff;padding:28px;border-radius:14px;box-shadow:0 4px 18px rgba(0,0,0,.08)}
        h1,h2{color:#0f172a} a{color:#0369a1}
    </style>
</head>
<body>
<main>
    <h1>تعليمات حذف البيانات</h1>
    <p>يمكنك طلب حذف بياناتك المرتبطة بخدمات Afkar API في أي وقت.</p>
    <h2>طريقة الطلب</h2>
    <p>أرسل طلب حذف البيانات إلى البريد التالي مع ذكر رقم الهاتف أو البريد المرتبط بالخدمة:</p>
    <p><a href="mailto:a.baf@live.com">a.baf@live.com</a></p>
    <h2>مدة المعالجة</h2>
    <p>تتم مراجعة طلبات الحذف ومعالجتها خلال مدة مناسبة بعد التحقق من ملكية الحساب أو وسيلة التواصل.</p>
</main>
</body>
</html>
HTML)->header('Content-Type', 'text/html; charset=UTF-8');
});

Route::get('/terms', function () {
    return response(<<<'HTML'
<!doctype html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>شروط الخدمة - Afkar API</title>
    <style>
        body{font-family:Arial,Tahoma,sans-serif;line-height:1.8;margin:0;background:#f7f7f7;color:#111}
        main{max-width:900px;margin:40px auto;background:#fff;padding:28px;border-radius:14px;box-shadow:0 4px 18px rgba(0,0,0,.08)}
        h1,h2{color:#0f172a} a{color:#0369a1}
    </style>
</head>
<body>
<main>
    <h1>شروط الخدمة</h1>
    <p>باستخدام خدمات Afkar API فإنك توافق على استخدامها للأغراض النظامية والمصرح بها فقط.</p>
    <h2>الاستخدام</h2>
    <p>تُستخدم الخدمة لإرسال التنبيهات والرسائل التشغيلية عبر واتساب وفق سياسات Meta وWhatsApp.</p>
    <h2>المسؤولية</h2>
    <p>يجب الالتزام بالحصول على موافقة المستلمين عند الحاجة والامتثال للأنظمة والسياسات ذات العلاقة.</p>
    <h2>التواصل</h2>
    <p><a href="mailto:a.baf@live.com">a.baf@live.com</a></p>
</main>
</body>
</html>
HTML)->header('Content-Type', 'text/html; charset=UTF-8');
});

Route::get('/{any?}', function () {
    $index = public_path('webapp/index.html');

    if (file_exists($index)) {
        return response()->file($index);
    }

    return response('<h1>Ahmed Web is not built yet.</h1>', 200)
        ->header('Content-Type', 'text/html; charset=UTF-8');
})->where('any', '^(?!api|webapp|storage|favicon.ico|robots.txt|privacy-policy|data-deletion|terms).*$');
