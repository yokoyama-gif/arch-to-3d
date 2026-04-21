# -*- coding: utf-8 -*-
"""
『半導体戦争』章リストと NotebookLM Slide Deck 用プロンプト生成

使い方:
  python chip_war_chapters.py          # 全章のプロンプトを表示
  python chip_war_chapters.py --ch 1   # 第1章のみ表示
  python chip_war_chapters.py --save   # prompts/ フォルダに保存
"""

import argparse
import os

# 章タイトルは手動確認で補完してください
CHAPTERS = [
    (1,  "世界を支配するチップ"),
    (2,  "アメリカの技術覇権"),
    (3,  "シリコンバレーの誕生"),
    (4,  "日本の挑戦"),
    (5,  "台湾の奇跡"),
    (6,  "韓国の躍進"),
    (7,  "中国の野望"),
    (8,  "EUVリソグラフィの戦い"),
    (9,  "ASMLの独占"),
    (10, "TSMCの支配"),
    (11, "地政学的リスクと台湾海峡"),
    (12, "アメリカの反撃"),
    (13, "チップ戦争の未来"),
]

TEMPLATE = """\
【第{num}章「{title}」のスライドデッキを作成してください】

対象範囲: 第{num}章のみ（それ以外の章には言及しないこと）

構成指示:
- スライド枚数: 8〜12枚
- 対象読者: ビジネス・テクノロジー分野の一般読者
- 各スライドには見出し＋箇条書き3〜5点を含める
- スライド1: 章のサマリー（What / Why / So What）
- 中間スライド: 主要な出来事・人物・企業・技術を章の流れに沿って解説
- 最後のスライド: この章の教訓・次章への示唆
- 固有名詞（企業名・人名・技術名）は省略せず正確に記載
- 時系列または因果関係が明確になる構成にする
"""

CH1_EXTRA = """\
追加指示（第1章専用）:
- フェアチャイルド社とシリコンバレー誕生の経緯を含める
- トランジスタ→集積回路→ムーアの法則の流れを図解的に整理
- アメリカ軍・NASA との需要関係を強調
- ノーチェ・キルビー、ロバート・ノイス、ゴードン・ムーアの役割を明示
- 時系列: 1950年代〜1960年代後半を中心に
"""


def make_prompt(num: int, title: str) -> str:
    prompt = TEMPLATE.format(num=num, title=title)
    if num == 1:
        prompt += CH1_EXTRA
    return prompt


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--ch", type=int, help="章番号を指定（省略で全章）")
    parser.add_argument("--save", action="store_true", help="prompts/ に保存")
    args = parser.parse_args()

    targets = CHAPTERS if args.ch is None else [(n, t) for n, t in CHAPTERS if n == args.ch]

    if not targets:
        print(f"章番号 {args.ch} は見つかりません")
        return

    import sys
    if sys.platform == "win32":
        sys.stdout.reconfigure(encoding="utf-8")

    for num, title in targets:
        prompt = make_prompt(num, title)
        print("=" * 60)
        print(f"第{num}章: {title}")
        print("=" * 60)
        print(prompt)

        if args.save:
            os.makedirs("prompts", exist_ok=True)
            path = f"prompts/ch{num:02d}.txt"
            with open(path, "w", encoding="utf-8") as f:
                f.write(prompt)
            print(f"→ 保存: {path}")


if __name__ == "__main__":
    main()
