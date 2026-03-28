"""CSV export service for exterior construction cost estimation.

Generates a Shift-JIS encoded CSV with category subtotals and tax-inclusive totals,
formatted for Japanese Excel.
"""

from __future__ import annotations

import csv
import io
from datetime import datetime

from app.models.estimate_schemas import CsvExportRequest, EstimateCategory

CATEGORY_LABELS: dict[str, str] = {
    "earthwork": "土工事",
    "paving": "舗装工事",
    "fence": "塀・フェンス",
    "landscaping": "植栽・造園",
}

CATEGORY_ORDER: list[EstimateCategory] = ["earthwork", "paving", "fence", "landscaping"]


def export_csv(project: CsvExportRequest) -> bytes:
    """Generate a CSV file as Shift-JIS encoded bytes."""

    buf = io.StringIO()
    writer = csv.writer(buf)

    # Header rows
    writer.writerow(["外構費用積算書"])
    writer.writerow(["工事名称", project.name])
    writer.writerow(["施主名", project.clientName])
    writer.writerow(["現場住所", project.siteAddress])
    writer.writerow(["作成日", datetime.now().strftime("%Y年%m月%d日")])
    writer.writerow([])

    # Column headers
    writer.writerow(["カテゴリ", "項目名", "規格・仕様", "数量", "単位", "単価(円)", "金額(円)", "備考"])

    grand_total = 0

    for cat in CATEGORY_ORDER:
        cat_items = [item for item in project.items if item.category == cat]
        if not cat_items:
            continue

        cat_label = CATEGORY_LABELS[cat]
        cat_subtotal = 0

        for item in cat_items:
            amount = item.quantity * item.unitPrice
            cat_subtotal += amount
            writer.writerow([
                cat_label,
                item.name,
                item.specification,
                item.quantity,
                item.unit,
                item.unitPrice,
                amount,
                item.remarks,
            ])

        writer.writerow(["", "", "", "", "", f"【{cat_label} 小計】", cat_subtotal, ""])
        writer.writerow([])
        grand_total += cat_subtotal

    # Totals
    writer.writerow([])
    writer.writerow(["", "", "", "", "", "税抜合計", grand_total, ""])
    tax = int(grand_total * project.taxRate)
    writer.writerow(["", "", "", "", "", f"消費税（{int(project.taxRate * 100)}%）", tax, ""])
    writer.writerow(["", "", "", "", "", "税込合計", grand_total + tax, ""])

    csv_text = buf.getvalue()

    # BOM + Shift-JIS for Japanese Excel compatibility
    try:
        return b"\xef\xbb\xbf" + csv_text.encode("cp932", errors="replace")
    except (UnicodeEncodeError, LookupError):
        return b"\xef\xbb\xbf" + csv_text.encode("utf-8")
