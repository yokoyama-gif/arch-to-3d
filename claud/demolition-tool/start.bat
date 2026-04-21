@echo off
cd /d %~dp0
echo === 解体面積計算ツール 起動中 ===
if not exist .env (
  echo .envファイルが見つかりません
  echo ANTHROPIC_API_KEY=your_api_key_here > .env
  echo .envファイルを作成しました。APIキーを設定してください。
  pause
  exit
)
pip install -r requirements.txt -q
python app.py
pause
