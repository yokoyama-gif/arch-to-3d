"""
NotebookLM Slide Deck 半自動生成 — Playwright スクリプト

前提:
  pip install playwright
  playwright install chromium

使い方:
  python notebooklm_playwright.py --ch 1 --notebook-url "https://notebooklm.google.com/notebook/xxx"

フロー:
  1. Chromium を有頭モードで起動（手動ログインのため）
  2. 指定ノートブックを開く
  3. Studio → Slide Deck → Customize にプロンプトを入力
  4. Generate ボタンをクリック（生成完了まで待機）
  5. "Open in Slides" をクリックして Google Slides を開く
  6. Google Slides を PDF でダウンロード（任意）
"""

import argparse
import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))
from chip_war_chapters import make_prompt, CHAPTERS


async def generate_slide(notebook_url: str, chapter_num: int, headless: bool = False):
    from playwright.async_api import async_playwright

    chapters_map = {n: t for n, t in CHAPTERS}
    if chapter_num not in chapters_map:
        print(f"章番号 {chapter_num} は定義されていません")
        return

    prompt_text = make_prompt(chapter_num, chapters_map[chapter_num])

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=headless)

        # 既存セッションを使う場合は user_data_dir を指定
        # context = await p.chromium.launch_persistent_context(
        #     user_data_dir="./chrome_profile",
        #     headless=False,
        # )

        context = await browser.new_context()
        page = await context.new_page()

        print(f"ノートブックを開いています: {notebook_url}")
        await page.goto(notebook_url, wait_until="networkidle")

        # ログインが必要な場合は手動で完了させる
        print("ログインが必要な場合は、ブラウザ画面で完了させてください。")
        print("準備ができたら Enter を押してください...")
        input()

        # Studio タブをクリック
        print("Studio タブを探しています...")
        studio_tab = page.get_by_text("Studio", exact=True)
        await studio_tab.wait_for(timeout=15000)
        await studio_tab.click()
        await page.wait_for_timeout(1000)

        # Slide Deck カードを探してカスタマイズボタンをクリック
        print("Slide Deck を探しています...")
        customize_btn = page.get_by_role("button", name="Customize")
        if not await customize_btn.is_visible():
            customize_btn = page.locator("button", has_text="カスタマイズ")
        await customize_btn.wait_for(timeout=15000)
        await customize_btn.click()
        await page.wait_for_timeout(500)

        # プロンプトを入力
        print("プロンプトを入力しています...")
        prompt_box = page.get_by_role("textbox")
        await prompt_box.fill(prompt_text)
        await page.wait_for_timeout(500)

        # Generate ボタンをクリック
        print("Slide Deck を生成しています...")
        generate_btn = page.get_by_role("button", name="Generate")
        if not await generate_btn.is_visible():
            generate_btn = page.locator("button", has_text="生成")
        await generate_btn.click()

        # 生成完了を待つ（最大5分）
        print("生成完了を待機中（最大5分）...")
        open_in_slides = page.get_by_text("Open in Slides")
        try:
            await open_in_slides.wait_for(timeout=300000)
            print("生成完了！")
        except Exception:
            print("タイムアウト: 手動で確認してください")
            input("Press Enter to continue...")

        # Google Slides を開く
        if await open_in_slides.is_visible():
            print("Google Slides を開いています...")
            async with context.expect_page() as new_page_info:
                await open_in_slides.click()
            slides_page = await new_page_info.value
            await slides_page.wait_for_load_state("networkidle")
            slides_url = slides_page.url
            print(f"Google Slides URL: {slides_url}")

            # PDF ダウンロード（export URL を直接開く）
            if "/presentation/d/" in slides_url:
                slides_id = slides_url.split("/presentation/d/")[1].split("/")[0]
                pdf_url = f"https://docs.google.com/presentation/d/{slides_id}/export/pdf"
                print(f"PDF ダウンロード URL: {pdf_url}")
                pdf_page = await context.new_page()
                await pdf_page.goto(pdf_url)
                await pdf_page.wait_for_timeout(3000)
                print(f"PDF を手動で保存してください（または Ctrl+S）")

        input("終了するには Enter を押してください...")
        await browser.close()


def main():
    parser = argparse.ArgumentParser(description="NotebookLM Slide Deck 半自動生成")
    parser.add_argument("--ch", type=int, required=True, help="章番号")
    parser.add_argument("--notebook-url", required=True, help="NotebookLM ノートブックの URL")
    parser.add_argument("--headless", action="store_true", help="ヘッドレスモード（ログイン済みセッション必須）")
    args = parser.parse_args()

    asyncio.run(generate_slide(args.notebook_url, args.ch, args.headless))


if __name__ == "__main__":
    main()
