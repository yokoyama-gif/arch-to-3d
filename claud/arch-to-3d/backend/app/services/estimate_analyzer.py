"""PDF analysis service for exterior construction cost estimation.

Uses PyMuPDF to render PDF pages as images, then sends them to the
Claude API for structured extraction of construction quantities.
"""

from __future__ import annotations

import base64
import json
import logging
import os
import uuid
from pathlib import Path

import fitz  # PyMuPDF

from app.models.estimate_schemas import EstimateItemSchema, PdfAnalysisResponse

logger = logging.getLogger(__name__)

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")

SYSTEM_PROMPT = """\
あなたは外構工事の積算エキスパートです。
アップロードされた外構図面の画像を読み取り、以下の4カテゴリに分類して施工項目と数量を抽出してください。

【カテゴリと項目例】
1. earthwork（土工事）: 掘削工事(m3), 埋戻し(m3), 盛土(m3), 残土搬出・処分(m3), 整地・転圧(m2)
2. paving（舗装工事）: コンクリート舗装(m2), アスファルト舗装(m2), インターロッキング(m2), 縁石(m), 側溝(m)
3. fence（塀・フェンス）: CB塀 3段/5段/7段(m), メッシュフェンス(m), アルミフェンス(m), 門扉(箇所), カーポート(式)
4. landscaping（植栽・造園）: 芝張り(m2), 砕石敷き(m2), 防草シート(m2), 高木(本), 中木(本), 低木(本), 花壇(m2)

【出力形式】
以下のJSON配列のみを出力してください。説明文は不要です。
```json
[
  {
    "category": "earthwork",
    "name": "掘削工事",
    "specification": "バックホウ 0.45m3級",
    "quantity": 25.5,
    "unit": "m3",
    "remarks": "駐車場部分"
  }
]
```

【注意事項】
- 図面から寸法を読み取り、面積や体積を計算してquantityに入れてください
- 図面に明示されていない数量は推定値として remarks に「推定」と記載してください
- 図面に記載がない項目は含めないでください
- unitPriceは出力不要です（システム側でデフォルト単価を適用します）
"""


def _render_pdf_pages(pdf_path: Path, dpi: int = 200) -> list[bytes]:
    """Render each page of a PDF as PNG bytes."""
    doc = fitz.open(str(pdf_path))
    images: list[bytes] = []
    try:
        for page in doc:
            mat = fitz.Matrix(dpi / 72, dpi / 72)
            pix = page.get_pixmap(matrix=mat)
            images.append(pix.tobytes("png"))
    finally:
        doc.close()
    return images


def _call_claude_api(images: list[bytes]) -> str:
    """Send page images to Claude API and return the text response."""
    try:
        import anthropic
    except ImportError as exc:
        raise RuntimeError(
            "anthropic パッケージがインストールされていません。"
            "pip install anthropic を実行してください。"
        ) from exc

    if not ANTHROPIC_API_KEY:
        raise RuntimeError(
            "ANTHROPIC_API_KEY が設定されていません。"
            "環境変数に API キーを設定してください。"
        )

    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    content: list[dict] = []
    for img_bytes in images:
        b64 = base64.standard_b64encode(img_bytes).decode("ascii")
        content.append({
            "type": "image",
            "source": {
                "type": "base64",
                "media_type": "image/png",
                "data": b64,
            },
        })
    content.append({
        "type": "text",
        "text": "この外構図面から施工項目と数量を抽出してJSON配列で出力してください。",
    })

    message = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=4096,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": content}],
    )

    return message.content[0].text


def _parse_response(text: str) -> list[dict]:
    """Extract JSON array from Claude's response text."""
    # Try to find JSON in code block first
    import re
    json_match = re.search(r"```(?:json)?\s*(\[[\s\S]*?\])\s*```", text)
    if json_match:
        return json.loads(json_match.group(1))

    # Try raw JSON
    start = text.find("[")
    end = text.rfind("]")
    if start != -1 and end != -1:
        return json.loads(text[start : end + 1])

    return []


def analyze_pdf(pdf_path: Path) -> PdfAnalysisResponse:
    """Analyze an exterior construction PDF and return structured items."""
    images = _render_pdf_pages(pdf_path)
    if not images:
        return PdfAnalysisResponse(items=[], warnings=["PDFのページを読み取れませんでした。"])

    warnings: list[str] = []

    try:
        raw_text = _call_claude_api(images)
    except RuntimeError as exc:
        return PdfAnalysisResponse(items=[], warnings=[str(exc)])

    try:
        raw_items = _parse_response(raw_text)
    except (json.JSONDecodeError, ValueError):
        return PdfAnalysisResponse(
            items=[],
            warnings=["AI応答のJSON解析に失敗しました。手動で入力してください。"],
        )

    items: list[EstimateItemSchema] = []
    for raw in raw_items:
        try:
            item = EstimateItemSchema(
                id=f"ai-{uuid.uuid4().hex[:8]}",
                category=raw.get("category", "earthwork"),
                name=raw.get("name", ""),
                specification=raw.get("specification", ""),
                quantity=float(raw.get("quantity", 0)),
                unit=raw.get("unit", ""),
                unitPrice=0,
                remarks=raw.get("remarks", ""),
                aiSuggested=True,
            )
            items.append(item)
        except (ValueError, TypeError) as exc:
            warnings.append(f"項目解析スキップ: {raw.get('name', '不明')} ({exc})")

    if not items:
        warnings.append("図面から施工項目を検出できませんでした。手動で入力してください。")

    return PdfAnalysisResponse(items=items, warnings=warnings)
