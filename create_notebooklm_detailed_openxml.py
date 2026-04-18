from __future__ import annotations

import re
import zipfile
from collections import Counter
from datetime import datetime
from pathlib import Path
from tempfile import TemporaryDirectory
from xml.sax.saxutils import escape


SOURCE_PATH = Path(r"C:\Users\admin\Desktop\create_notebooklm_xlsx.py")
OUTPUT_PATH = Path(r"C:\Users\admin\Desktop\NotebookLM_個別一覧_100字要約.xlsx")


def parse_items(source_text: str) -> list[dict[str, object]]:
    pattern = re.compile(r'\((\d+),"([^"]*)","([^"]*)","([^"]*)","([^"]*)"\)')
    items: list[dict[str, object]] = []
    for match in pattern.finditer(source_text):
        items.append(
            {
                "no": int(match.group(1)),
                "title": match.group(2),
                "date": datetime.strptime(match.group(3), "%Y/%m/%d"),
                "major": match.group(4),
                "minor": match.group(5),
            }
        )
    return items


def strip_prefix(label: str) -> str:
    return re.sub(r"^\d+(?:-\d+)?\.\s*", "", label).strip()


def clean_title(title: str) -> str:
    cleaned = re.sub(r"^[^\wA-Za-z0-9\u3040-\u30ff\u3400-\u9fff]+", "", title).strip()
    return cleaned or title.strip()


def shorten(text: str, limit: int) -> str:
    return text if len(text) <= limit else text[: limit - 1].rstrip() + "…"


def fit_summary(text: str, limit: int = 100) -> str:
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) <= limit:
        return text
    clipped = text[: limit - 1].rstrip(" 、。")
    return clipped + "…"


def build_summary(item: dict[str, object]) -> str:
    topic = shorten(clean_title(str(item["title"])), 38)
    major = strip_prefix(str(item["major"]))
    minor = strip_prefix(str(item["minor"]))
    summary = (
        f"{topic}を題材に、{major}の視点から{minor}の構造や背景、主要論点、"
        "実務に活かせる示唆を簡潔に整理した要約。"
    )
    if len(summary) < 90:
        summary += "全体像をつかむための入口になる内容。"
    return fit_summary(summary, 100)


def col_name(index: int) -> str:
    name = ""
    while index > 0:
        index, rem = divmod(index - 1, 26)
        name = chr(65 + rem) + name
    return name


def cell_xml(row_idx: int, col_idx: int, value: object, style_id: int = 0) -> str:
    ref = f"{col_name(col_idx)}{row_idx}"
    text = escape("" if value is None else str(value))
    return (
        f'<c r="{ref}" s="{style_id}" t="inlineStr">'
        f'<is><t xml:space="preserve">{text}</t></is></c>'
    )


def worksheet_xml(rows: list[dict[str, object]], widths: list[float]) -> str:
    cols_xml = ""
    if widths:
        cols = "".join(
            f'<col min="{idx}" max="{idx}" width="{width}" customWidth="1"/>'
            for idx, width in enumerate(widths, start=1)
        )
        cols_xml = f"<cols>{cols}</cols>"

    row_xml_parts: list[str] = []
    for row_idx, row in enumerate(rows, start=1):
        cells = row.get("cells", [])
        header = bool(row.get("header", False))
        style_id = 1 if header else 0
        if not cells:
            row_xml_parts.append(f'<row r="{row_idx}"/>')
            continue
        cells_xml = "".join(
            cell_xml(row_idx, col_idx, value, style_id)
            for col_idx, value in enumerate(cells, start=1)
        )
        row_xml_parts.append(f'<row r="{row_idx}">{cells_xml}</row>')

    sheet_data = "\n    ".join(row_xml_parts)
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        "<sheetViews><sheetView workbookViewId=\"0\"/></sheetViews>"
        f"{cols_xml}<sheetData>{sheet_data}</sheetData></worksheet>"
    )


def make_row(cells: list[object], header: bool = False) -> dict[str, object]:
    return {"cells": cells, "header": header}


def build_workbook_parts(items: list[dict[str, object]]) -> dict[str, str]:
    total = len(items)
    major_counter = Counter(item["major"] for item in items)
    minor_counter = Counter((item["major"], item["minor"]) for item in items)

    major_groups = [
        {
            "major": major,
            "count": count,
            "share": f"{count / total:.1%}",
        }
        for major, count in sorted(major_counter.items(), key=lambda x: (-x[1], x[0]))
    ]
    minor_groups = [
        {
            "major": major,
            "minor": minor,
            "count": count,
            "share": f"{count / total:.1%}",
        }
        for (major, minor), count in sorted(
            minor_counter.items(), key=lambda x: (-x[1], x[0][0], x[0][1])
        )
    ]
    recent_items = sorted(items, key=lambda item: (-int(item["date"].timestamp()), int(item["no"])))[:40]

    detail_rows = [make_row(["#", "タイトル", "作成日", "大分類", "中分類", "100字要約"], header=True)]
    for item in sorted(items, key=lambda row: int(row["no"])):
        detail_rows.append(
            make_row(
                [
                    item["no"],
                    item["title"],
                    item["date"].strftime("%Y/%m/%d"),
                    item["major"],
                    item["minor"],
                    build_summary(item),
                ]
            )
        )

    top_major = major_groups[:5]
    top_minor = minor_groups[:8]
    date_min = min(item["date"] for item in items).strftime("%Y/%m/%d")
    date_max = max(item["date"] for item in items).strftime("%Y/%m/%d")

    summary_rows = [
        make_row(["NotebookLM 目次まとめ", "", "", ""], header=True),
        make_row(["作成日", datetime.now().strftime("%Y/%m/%d %H:%M"), "", ""]),
        make_row(["注記", "100字要約は本文未取得のためタイトルと分類ベースの自動生成", "", ""]),
        make_row(["項目", "値", "補足", ""], header=True),
        make_row(["総件数", total, "一覧データ全件", ""]),
        make_row(["期間", f"{date_min} - {date_max}", "作成日レンジ", ""]),
        make_row(
            [
                "最大カテゴリ",
                f"{top_major[0]['major']} / {top_major[0]['count']}件",
                f"全体の {top_major[0]['share']}",
                "",
            ]
        ),
        make_row(
            [
                "次点カテゴリ",
                f"{top_major[1]['major']} / {top_major[1]['count']}件",
                f"全体の {top_major[1]['share']}",
                "",
            ]
        ),
        make_row(["最近の傾向", "建築・空間デザイン", "2026/03/29-2026/03/30 は空間体験系が集中", ""]),
        make_row([]),
        make_row(["上位大分類", "件数", "構成比", ""], header=True),
    ]
    for group in top_major:
        summary_rows.append(make_row([group["major"], group["count"], group["share"], ""]))
    summary_rows.extend(
        [
            make_row([]),
            make_row(["上位中分類", "", "", ""], header=True),
            make_row(["大分類", "中分類", "件数", "構成比"], header=True),
        ]
    )
    for group in top_minor:
        summary_rows.append(make_row([group["major"], group["minor"], group["count"], group["share"]]))

    major_rows = [make_row(["大分類", "件数", "構成比"], header=True)]
    for group in major_groups:
        major_rows.append(make_row([group["major"], group["count"], group["share"]]))

    minor_rows = [make_row(["大分類", "中分類", "件数", "構成比"], header=True)]
    for group in minor_groups:
        minor_rows.append(make_row([group["major"], group["minor"], group["count"], group["share"]]))

    recent_rows = [make_row(["日付", "大分類", "中分類", "タイトル"], header=True)]
    for item in recent_items:
        recent_rows.append(
            make_row(
                [
                    item["date"].strftime("%Y/%m/%d"),
                    item["major"],
                    item["minor"],
                    item["title"],
                ]
            )
        )

    sheets = {
        "xl/worksheets/sheet1.xml": worksheet_xml(detail_rows, [6, 64, 14, 28, 34, 82]),
        "xl/worksheets/sheet2.xml": worksheet_xml(summary_rows, [24, 36, 48, 16]),
        "xl/worksheets/sheet3.xml": worksheet_xml(major_rows, [28, 12, 12]),
        "xl/worksheets/sheet4.xml": worksheet_xml(minor_rows, [28, 36, 12, 12]),
        "xl/worksheets/sheet5.xml": worksheet_xml(recent_rows, [14, 28, 36, 80]),
    }

    content_types = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet3.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet4.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet5.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>
"""

    root_rels = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>
"""

    workbook = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="個別一覧" sheetId="1" r:id="rId1"/>
    <sheet name="要約" sheetId="2" r:id="rId2"/>
    <sheet name="大分類集計" sheetId="3" r:id="rId3"/>
    <sheet name="中分類集計" sheetId="4" r:id="rId4"/>
    <sheet name="直近トピック" sheetId="5" r:id="rId5"/>
  </sheets>
</workbook>
"""

    workbook_rels = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet3.xml"/>
  <Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet4.xml"/>
  <Relationship Id="rId5" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet5.xml"/>
  <Relationship Id="rId6" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>
"""

    styles = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2">
    <font><sz val="11"/><name val="Arial"/></font>
    <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Arial"/></font>
  </fonts>
  <fills count="3">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF2F5496"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="1">
    <border><left/><right/><top/><bottom/><diagonal/></border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="2">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
  </cellXfs>
  <cellStyles count="1">
    <cellStyle name="Normal" xfId="0" builtinId="0"/>
  </cellStyles>
</styleSheet>
"""

    parts = {
        "[Content_Types].xml": content_types,
        "_rels/.rels": root_rels,
        "xl/workbook.xml": workbook,
        "xl/_rels/workbook.xml.rels": workbook_rels,
        "xl/styles.xml": styles,
    }
    parts.update(sheets)
    return parts


def main() -> None:
    items = parse_items(SOURCE_PATH.read_text(encoding="utf-8"))
    parts = build_workbook_parts(items)

    if OUTPUT_PATH.exists():
        OUTPUT_PATH.unlink()

    with TemporaryDirectory() as tmpdir:
        tmp_path = Path(tmpdir) / OUTPUT_PATH.name
        with zipfile.ZipFile(tmp_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
            for name, content in parts.items():
                zf.writestr(name, content)
        OUTPUT_PATH.write_bytes(tmp_path.read_bytes())

    print(f"Saved: {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
