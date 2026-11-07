@echo off
chcp 65001 > nul
echo =======================================================
echo  JGVA ^& 配当トラッカー 最新データ更新
echo =======================================================
echo.

cd /d %~dp0

echo [1/2] 配当開示情報の更新...
python scripts/fetch_disclosures.py

echo.
echo [2/2] JGVA 全3,897銘柄スコア再計算...
python jgva/scripts/download_jpx.py
python jgva/scripts/build_dataset.py

echo.
echo =======================================================
echo  完了しました！
echo =======================================================
pause
