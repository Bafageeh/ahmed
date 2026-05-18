#!/usr/bin/env python3
from pathlib import Path

path = Path('ahmed-api/app/Http/Controllers/Api/Ta3meedImageImportController.php')
text = path.read_text(encoding='utf-8')

text = text.replace(
    "قيمة الاستثمار تظهر بجانب كلمة استثمار أو داخل بطاقة قيمة استثمار.\\n" .\n                            "الربح المتوقع يظهر تحت المبلغ أو داخل بطاقة ربح متوقع.\\n" .",
    "قيمة الاستثمار تظهر بجانب كلمة استثمار أو داخل بطاقة قيمة استثمار.\\n" .\n                            "اسم الشركة يظهر غالبًا في أعلى الهيدر الأخضر.\\n" .\n                            "المهام أو وصف العمل يظهر غالبًا تحت اسم الشركة مثل: توريد مستلزمات طبية.\\n" .\n                            "لا تهتم بنوع الفرصة مثل تمويل تعميدات ولا تضعه في الملاحظات.\\n" .\n                            "إذا ظهر الاستحقاق بعدد أيام مثل: 0 يوم أو 12 يوم فاستخرج الرقم في due_days.\\n" .\n                            "الربح المتوقع يظهر تحت المبلغ أو داخل بطاقة ربح متوقع.\\n" ."
)

text = text.replace(
    "reference_number, company_name, sector, principal_amount, expected_profit_amount, expected_rate, months, maturity_date, category, notes.\\n" .",
    "reference_number, company_name, tasks, executor, sector, principal_amount, expected_profit_amount, expected_rate, months, due_days, maturity_date, category, notes.\\n" ."
)

text = text.replace(
    "            'maturity_date' => null,\n            'category' => null,\n            'notes' => null,",
    "            'due_days' => $this->dueDaysFromText($normalized),\n            'maturity_date' => null,\n            'category' => $this->categoryFromText($normalized),\n            'tasks' => $sector,\n            'executor' => null,\n            'notes' => null,"
)

text = text.replace(
    "            'months' => $this->integerOrNull($row['months'] ?? null),\n            'maturity_date' => $this->dateOrNull($row['maturity_date'] ?? null),\n            'category' => $this->text($row['category'] ?? null),\n            'notes' => $this->text($row['notes'] ?? null),",
    "            'months' => $this->integerOrNull($row['months'] ?? null),\n            'due_days' => $this->integerOrNull($row['due_days'] ?? null),\n            'maturity_date' => $this->dateOrNull($row['maturity_date'] ?? null),\n            'category' => $this->text($row['category'] ?? null),\n            'tasks' => $this->text($row['tasks'] ?? $row['sector'] ?? null),\n            'executor' => $this->text($row['executor'] ?? null),\n            'notes' => $this->text($row['notes'] ?? null),"
)

text = text.replace(
    "        foreach (['category', 'months', 'company_name', 'sector'] as $key) {",
    "        if (empty($row['maturity_date']) && ($row['due_days'] ?? null) !== null) {\n            $row['maturity_date'] = now()->addDays((int) $row['due_days'])->toDateString();\n        }\n\n        foreach (['category', 'months', 'company_name', 'sector', 'tasks', 'executor', 'due_days'] as $key) {"
)

insert_before = "    private function openAiChat(array $payload): array\n    {"
helpers = """
    private function dueDaysFromText(string $text): ?int
    {
        if (preg_match('/([0-9]+)\\s*يوم/u', $text, $m)) {
            return (int) $m[1];
        }

        return null;
    }

    private function categoryFromText(string $text): ?string
    {
        if (preg_match('/مخاطرة\\s*[:：]?\\s*([A-C][+-]?)/ui', $text, $m)) {
            return strtoupper($m[1]);
        }

        return null;
    }

"""
if 'function dueDaysFromText' not in text:
    if insert_before not in text:
        raise RuntimeError('openAiChat marker not found')
    text = text.replace(insert_before, helpers + insert_before, 1)

for marker in ['due_days', 'tasks', 'executor', 'dueDaysFromText', 'categoryFromText', "addDays((int) $row['due_days'])"]:
    if marker not in text:
        raise RuntimeError(f'missing marker: {marker}')

path.write_text(text, encoding='utf-8')
print('Ta3meed image import now upserts extra fields and due days')
