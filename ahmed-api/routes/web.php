<?php

use Illuminate\Support\Facades\Route;

function afkarStaticPage(string $title, string $body): \Illuminate\Http\Response
{
    return response("<!doctype html>\n<html lang=\"ar\" dir=\"rtl\">\n<head>\n    <meta charset=\"utf-8\">\n    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n    <title>{$title}</title>\n    <style>\n        :root{color-scheme:light;--bg:#f6f8fb;--card:#fff;--text:#0f172a;--muted:#475569;--brand:#0f766e;--line:#e2e8f0}\n        *{box-sizing:border-box} body{margin:0;font-family:Arial,Tahoma,sans-serif;line-height:1.8;background:var(--bg);color:var(--text)}\n        header{background:linear-gradient(135deg,#0f766e,#0369a1);color:#fff;padding:56px 20px;text-align:center}\n        header h1{margin:0 0 10px;font-size:34px} header p{margin:0 auto;max-width:760px;font-size:18px;opacity:.96}\n        main{max-width:1040px;margin:28px auto;padding:0 18px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px}\n        .card{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:22px;box-shadow:0 8px 28px rgba(15,23,42,.06)}\n        h2{margin:0 0 12px;font-size:22px}.card p{margin:0;color:var(--muted)}\n        .links{display:flex;gap:10px;flex-wrap:wrap;margin-top:18px}.links a{background:#ecfeff;color:#155e75;border:1px solid #bae6fd;padding:10px 14px;border-radius:12px;text-decoration:none;font-weight:700}\n        footer{max-width:1040px;margin:18px auto 40px;padding:0 18px;color:#64748b;text-align:center} a{color:#0369a1}\n    </style>\n</head>\n<body>{$body}</body>\n</html>")->header('Content-Type', 'text/html; charset=UTF-8');
}

Route::get('/health', function () {
    return response()->json([
        'ok' => true,
        'app' => 'Ahmed Web',
        'time' => now()->toDateTimeString(),
    ]);
});

Route::get('/', function () {
    $body = <<<'HTML'
<header>
    <h1>Afkar Technology</h1>
    <p>حلول تقنية وأدوات أعمال تساعد على إدارة التنبيهات، التكاملات، وخدمات WhatsApp Business API للأعمال.</p>
</header>
<main>
    <section class="grid">
        <article class="card">
            <h2>من نحن</h2>
            <p>Afkar Technology نشاط تقني مقره جدة، المملكة العربية السعودية، يطوّر حلولًا داخلية وتكاملات رقمية للأعمال.</p>
        </article>
        <article class="card">
            <h2>خدماتنا</h2>
            <p>تكامل WhatsApp Business Cloud API، قوالب الرسائل المعتمدة، Webhooks لحالات التسليم، ولوحات تشغيل داخلية.</p>
        </article>
        <article class="card">
            <h2>التواصل</h2>
            <p>البريد الإلكتروني: <a href="mailto:a.baf@live.com">a.baf@live.com</a><br>الموقع: <a href="https://ahmed.pm.sa/">https://ahmed.pm.sa/</a></p>
        </article>
    </section>
    <section class="card" style="margin-top:16px">
        <h2>معلومات قانونية</h2>
        <p>هذه الصفحة مخصصة لعرض معلومات النشاط وروابط السياسات المطلوبة لمراجعة وربط خدمات Meta وWhatsApp Business.</p>
        <div class="links">
            <a href="/privacy-policy">سياسة الخصوصية</a>
            <a href="/terms">شروط الخدمة</a>
            <a href="/datadeletion">تعليمات حذف البيانات</a>
        </div>
    </section>
</main>
<footer>© Afkar Technology</footer>
HTML;

    return afkarStaticPage('Afkar Technology', $body);
});

Route::get('/privacy-policy', function () {
    $body = <<<'HTML'
<main>
    <section class="card">
        <h1>سياسة الخصوصية</h1>
        <p>توضح هذه السياسة كيفية تعامل Afkar Technology / Afkar API مع البيانات المستخدمة لتشغيل خدمات واتساب والتنبيهات المرتبطة بتطبيقاتنا.</p>
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
    </section>
</main>
HTML;

    return afkarStaticPage('سياسة الخصوصية - Afkar Technology', $body);
});

$dataDeletionPage = function () {
    $body = <<<'HTML'
<main>
    <section class="card">
        <h1>تعليمات حذف البيانات</h1>
        <p>يمكنك طلب حذف بياناتك المرتبطة بخدمات Afkar Technology / Afkar API في أي وقت.</p>
        <h2>طريقة الطلب</h2>
        <p>أرسل طلب حذف البيانات إلى البريد التالي مع ذكر رقم الهاتف أو البريد المرتبط بالخدمة:</p>
        <p><a href="mailto:a.baf@live.com">a.baf@live.com</a></p>
        <h2>مدة المعالجة</h2>
        <p>تتم مراجعة طلبات الحذف ومعالجتها خلال مدة مناسبة بعد التحقق من ملكية الحساب أو وسيلة التواصل.</p>
    </section>
</main>
HTML;

    return afkarStaticPage('تعليمات حذف البيانات - Afkar Technology', $body);
};

Route::get('/data-deletion', $dataDeletionPage);
Route::get('/datadeletion', $dataDeletionPage);

Route::get('/terms', function () {
    $body = <<<'HTML'
<main>
    <section class="card">
        <h1>شروط الخدمة</h1>
        <p>باستخدام خدمات Afkar Technology / Afkar API فإنك توافق على استخدامها للأغراض النظامية والمصرح بها فقط.</p>
        <h2>الاستخدام</h2>
        <p>تُستخدم الخدمة لإرسال التنبيهات والرسائل التشغيلية عبر واتساب وفق سياسات Meta وWhatsApp.</p>
        <h2>المسؤولية</h2>
        <p>يجب الالتزام بالحصول على موافقة المستلمين عند الحاجة والامتثال للأنظمة والسياسات ذات العلاقة.</p>
        <h2>التواصل</h2>
        <p><a href="mailto:a.baf@live.com">a.baf@live.com</a></p>
    </section>
</main>
HTML;

    return afkarStaticPage('شروط الخدمة - Afkar Technology', $body);
});

Route::get('/{any?}', function () {
    $index = public_path('webapp/index.html');

    if (file_exists($index)) {
        return response()->file($index);
    }

    return response('<h1>Ahmed Web is not built yet.</h1>', 200)
        ->header('Content-Type', 'text/html; charset=UTF-8');
})->where('any', '^(?!api|webapp|storage|favicon.ico|robots.txt|privacy-policy|data-deletion|datadeletion|terms).*$');
