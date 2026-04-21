import os
import base64
import json
from flask import Flask, render_template, request, jsonify
from anthropic import Anthropic
from PIL import Image
import io
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 20 * 1024 * 1024  # 20MB
UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'uploads')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

client = Anthropic(api_key=os.getenv('ANTHROPIC_API_KEY'))


def encode_image(image_bytes: bytes) -> tuple[str, str]:
    img = Image.open(io.BytesIO(image_bytes))
    if img.mode in ('RGBA', 'P'):
        img = img.convert('RGB')
    buf = io.BytesIO()
    img.save(buf, format='JPEG', quality=90)
    b64 = base64.standard_b64encode(buf.getvalue()).decode('utf-8')
    return b64, 'image/jpeg'


SATELLITE_PROMPT = """あなたは建設・解体工事の専門家AIです。
この衛星写真（航空写真）から建物の情報を日本語で詳細に分析してください。

以下の情報をJSON形式で返してください：
{
  "building_count": 建物の棟数（整数）,
  "buildings": [
    {
      "id": 1,
      "description": "建物の説明（用途・形状など）",
      "estimated_footprint_m2": 推定建築面積（平方メートル、数値のみ）,
      "shape": "形状（長方形/L字形/複雑など）",
      "estimated_width_m": 推定幅（メートル）,
      "estimated_depth_m": 推定奥行き（メートル）,
      "confidence": "信頼度（高/中/低）",
      "notes": "特記事項"
    }
  ],
  "scale_detected": スケールバー検出できたか（true/false）,
  "scale_notes": "スケール参考情報",
  "analysis_notes": "全体的な分析メモ"
}

重要：
- 画像内にGoogleマップのスケールバーが見えれば必ず利用すること
- 建物の輪郭を慎重にトレースして面積を推定すること
- 隣接する複数の建物を区別して個別に分析すること
- 数値はできる限り根拠を持って推定すること
- JSONのみを返し、他のテキストは含めないこと"""


STREET_PROMPT = """あなたは建設・解体工事の専門家AIです。
この建物の外観写真から階層情報と各階の面積を日本語で詳細に分析してください。

以下の情報をJSON形式で返してください：
{
  "floor_count": 地上階数（整数）,
  "basement_count": 地下階数（整数、なければ0）,
  "building_type": "建物種別（木造/RC造/鉄骨造/不明など）",
  "estimated_building_height_m": 推定建物高さ（メートル）,
  "estimated_floor_height_m": 推定階高（メートル）,
  "floors": [
    {
      "floor": "1F",
      "area_ratio": 各階の面積比率（1Fを1.0として）,
      "notes": "その階の特徴（セットバック、出窓など）"
    }
  ],
  "facade_width_m": 推定正面幅（メートル）,
  "roof_type": "屋根形状（陸屋根/切妻/寄棟/片流れなど）",
  "demolition_notes": "解体工事上の注意点",
  "confidence": "信頼度（高/中/低）",
  "analysis_notes": "全体的な分析メモ"
}

重要：
- 各階の窓の位置・数から階数を正確にカウントすること
- セットバックや増築部分も考慮すること
- 解体工事で必要な情報（アスベスト可能性、構造など）も記載すること
- JSONのみを返し、他のテキストは含めないこと"""


COMBINED_PROMPT = """あなたは建設・解体工事の専門家AIです。
この画像から建物の解体に必要な全情報を日本語で詳細に分析してください。

以下の情報をJSON形式で返してください：
{
  "image_type": "画像種別（衛星写真/外観写真/その他）",
  "floor_count": 地上階数（整数、不明なら推定値）,
  "basement_count": 地下階数（整数）,
  "building_type": "建物種別",
  "estimated_footprint_m2": 推定建築面積（平方メートル）,
  "floors": [
    {
      "floor": "1F",
      "estimated_area_m2": 推定面積（平方メートル）,
      "area_ratio": 面積比率,
      "notes": "特記事項"
    }
  ],
  "total_floor_area_m2": 推定延床面積（平方メートル）,
  "estimated_width_m": 推定幅（メートル）,
  "estimated_depth_m": 推定奥行き（メートル）,
  "estimated_height_m": 推定高さ（メートル）,
  "roof_type": "屋根形状",
  "demolition_priority_items": ["解体で注意すべき項目リスト"],
  "confidence": "総合信頼度（高/中/低）",
  "analysis_notes": "分析メモ"
}

JSONのみを返し、他のテキストは含めないこと"""


def calculate_floor_areas(footprint_m2: float, floors: list, floor_count: int) -> list:
    result = []
    for i in range(1, floor_count + 1):
        floor_key = f"{i}F"
        ratio = 1.0
        notes = ""
        for f in floors:
            if f.get('floor') == floor_key:
                ratio = f.get('area_ratio', 1.0)
                notes = f.get('notes', '')
                break
        area = round(footprint_m2 * ratio, 1)
        result.append({
            'floor': floor_key,
            'area_m2': area,
            'tsubo': round(area / 3.305785, 1),
            'notes': notes
        })
    return result


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/analyze', methods=['POST'])
def analyze():
    if 'image' not in request.files:
        return jsonify({'error': '画像ファイルが必要です'}), 400

    file = request.files['image']
    image_type = request.form.get('image_type', 'combined')
    manual_footprint = request.form.get('manual_footprint', '')
    manual_floors = request.form.get('manual_floors', '')
    scale_reference = request.form.get('scale_reference', '')

    if file.filename == '':
        return jsonify({'error': 'ファイルが選択されていません'}), 400

    image_bytes = file.read()
    b64_image, media_type = encode_image(image_bytes)

    if image_type == 'satellite':
        prompt = SATELLITE_PROMPT
        if scale_reference:
            prompt += f"\n\n参考スケール情報: {scale_reference}"
    elif image_type == 'street':
        prompt = STREET_PROMPT
        if manual_footprint:
            prompt += f"\n\n建築面積は別途 {manual_footprint}㎡ と入力されています。この値を使用して各階面積を計算してください。"
    else:
        prompt = COMBINED_PROMPT
        if manual_footprint:
            prompt += f"\n\n建築面積は別途 {manual_footprint}㎡ と入力されています。"
        if manual_floors:
            prompt += f"\n\n階数は別途 {manual_floors}階 と入力されています。"

    try:
        response = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=2000,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": media_type,
                                "data": b64_image
                            }
                        },
                        {
                            "type": "text",
                            "text": prompt
                        }
                    ]
                }
            ]
        )

        raw_text = response.content[0].text.strip()
        # JSONブロック抽出
        if '```json' in raw_text:
            raw_text = raw_text.split('```json')[1].split('```')[0].strip()
        elif '```' in raw_text:
            raw_text = raw_text.split('```')[1].split('```')[0].strip()

        ai_result = json.loads(raw_text)

        # 手動入力値で上書き
        footprint = float(manual_footprint) if manual_footprint else ai_result.get('estimated_footprint_m2', 0)
        floor_count = int(manual_floors) if manual_floors else ai_result.get('floor_count', 1)

        # 各階面積計算
        floors_raw = ai_result.get('floors', [])
        floor_areas = calculate_floor_areas(footprint, floors_raw, floor_count)

        # 延床面積
        total_area = sum(f['area_m2'] for f in floor_areas)
        total_tsubo = round(total_area / 3.305785, 1)

        result = {
            'success': True,
            'ai_analysis': ai_result,
            'summary': {
                'footprint_m2': footprint,
                'footprint_tsubo': round(footprint / 3.305785, 1),
                'floor_count': floor_count,
                'basement_count': ai_result.get('basement_count', 0),
                'total_floor_area_m2': round(total_area, 1),
                'total_floor_area_tsubo': total_tsubo,
                'building_type': ai_result.get('building_type', '不明'),
                'roof_type': ai_result.get('roof_type', '不明'),
                'estimated_height_m': ai_result.get('estimated_height_m') or ai_result.get('estimated_building_height_m', '不明'),
                'confidence': ai_result.get('confidence', '中'),
            },
            'floor_areas': floor_areas,
            'demolition_notes': ai_result.get('demolition_priority_items', []) or ai_result.get('demolition_notes', ''),
            'analysis_notes': ai_result.get('analysis_notes', '')
        }
        return jsonify(result)

    except json.JSONDecodeError as e:
        return jsonify({
            'success': False,
            'error': f'AI応答のパースエラー: {str(e)}',
            'raw_response': response.content[0].text if response else ''
        }), 500
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/calculate_area', methods=['POST'])
def calculate_area():
    """キャンバス上の多角形から面積を計算（ピクセル座標 → 実面積）"""
    data = request.json
    points = data.get('points', [])
    pixel_per_meter = data.get('pixel_per_meter', 1.0)

    if len(points) < 3:
        return jsonify({'error': '3点以上必要です'}), 400

    # ガウスの公式で面積計算
    n = len(points)
    area_pixels = 0
    for i in range(n):
        j = (i + 1) % n
        area_pixels += points[i]['x'] * points[j]['y']
        area_pixels -= points[j]['x'] * points[i]['y']
    area_pixels = abs(area_pixels) / 2.0

    area_m2 = area_pixels / (pixel_per_meter ** 2)

    return jsonify({
        'area_pixels': round(area_pixels, 1),
        'area_m2': round(area_m2, 2),
        'area_tsubo': round(area_m2 / 3.305785, 2)
    })


if __name__ == '__main__':
    app.run(debug=True, port=5050)
