#!/usr/bin/env python3
from pathlib import Path

mobile = Path('ahmed-mobile/Ta3meedCompactFiltersScreen.js')
text = mobile.read_text(encoding='utf-8')

text = text.replace("    maturity_date: '',\n    allocations: '',", "    maturity_date: '',\n    company_name: '',\n    tasks: '',\n    executor: '',\n    allocations: '',")

text = text.replace("      maturity_date: String(item.maturity_date || '').slice(0, 10),\n      allocations:", "      maturity_date: String(item.maturity_date || '').slice(0, 10),\n      company_name: String(meta.company_name || item.company_name || ''),\n      tasks: String(meta.tasks || item.tasks || ''),\n      executor: String(meta.executor || item.executor || ''),\n      allocations:")

text = text.replace("          maturity_date: opportunityForm.maturity_date || null,\n          notes:", "          maturity_date: opportunityForm.maturity_date || null,\n          company_name: opportunityForm.company_name || null,\n          tasks: opportunityForm.tasks || null,\n          executor: opportunityForm.executor || null,\n          notes:")

insert_after = "                <EditField label=\"تاريخ الاستحقاق\" value={opportunityForm.maturity_date} onChangeText={(v) => setOpportunityField('maturity_date', v)} placeholder=\"YYYY-MM-DD\" />"
extra_fields = insert_after + "\n                <EditField label=\"اسم الشركة\" value={opportunityForm.company_name} onChangeText={(v) => setOpportunityField('company_name', v)} placeholder=\"اسم الشركة المرتبطة بالفرصة\" />\n                <EditField label=\"المهام\" value={opportunityForm.tasks} onChangeText={(v) => setOpportunityField('tasks', v)} placeholder=\"المهام أو وصف العمل\" multiline inputStyle={{ minHeight: 82, textAlignVertical: 'top' }} />\n                <EditField label=\"المنفذ\" value={opportunityForm.executor} onChangeText={(v) => setOpportunityField('executor', v)} placeholder=\"اسم المنفذ\" />"
if insert_after in text and 'label=\"اسم الشركة\"' not in text:
    text = text.replace(insert_after, extra_fields)

for marker in ['company_name:', 'label=\"اسم الشركة\"', 'label=\"المهام\"', 'label=\"المنفذ\"']:
    if marker not in text:
        raise RuntimeError(f'Missing Ta3meed extra field marker: {marker}')
mobile.write_text(text, encoding='utf-8')

controller = Path('ahmed-api/app/Http/Controllers/Api/Ta3meedMutationController.php')
api = controller.read_text(encoding='utf-8')
api = api.replace("            'maturity_date' => ['nullable', 'date'],\n            'returned_amount'", "            'maturity_date' => ['nullable', 'date'],\n            'company_name' => ['nullable', 'string', 'max:255'],\n            'tasks' => ['nullable', 'string'],\n            'executor' => ['nullable', 'string', 'max:255'],\n            'returned_amount'")
api = api.replace("        $meta['returned_amount'] = $data['returned_amount'] ?? ($meta['returned_amount'] ?? null);\n        return $meta;", "        $meta['returned_amount'] = $data['returned_amount'] ?? ($meta['returned_amount'] ?? null);\n        $meta['company_name'] = $data['company_name'] ?? ($meta['company_name'] ?? null);\n        $meta['tasks'] = $data['tasks'] ?? ($meta['tasks'] ?? null);\n        $meta['executor'] = $data['executor'] ?? ($meta['executor'] ?? null);\n        return $meta;")
for marker in ["'company_name' =>", "'tasks' =>", "'executor' =>", "$meta['company_name']", "$meta['tasks']", "$meta['executor']"]:
    if marker not in api:
        raise RuntimeError(f'Missing API extra field marker: {marker}')
controller.write_text(api, encoding='utf-8')

print('Ta3meed extra fields patched: company_name, tasks, executor')
