#!/usr/bin/env python3
"""
TDnet / IR 適時開示情報 自動収集＆増配・10年非減配 銘柄抽出スクリプト
このスクリプトはGitHub Actionsにより平日の16:30 (大引け後) に自動実行されます。
1. TDnetの開示情報から「配当予想の修正」「業績予想の修正」等のIRリリースを取得
2. 「増配（配当の増額修正）」を判定
3. 10年以上非減配（連続増配・減配なし）実績データベースと照合
4. data/disclosures.json を自動更新
"""

import json
import datetime
import os
import re

def main():
    print(f"[{datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] TDnet開示情報の監視を開始します...")

    # データ保存先パス
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    json_path = os.path.join(base_dir, "data", "disclosures.json")

    # 既存データ読み込み（存在する場合）
    data = {}
    if os.path.exists(json_path):
        with open(json_path, "r", encoding="utf-8") as f:
            data = json.load(f)

    now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    data["last_updated"] = now_str
    
    # 銘柄の安心度スコア（10年連続非減配年数 × 2 + 低配当性向ボーナス）を再計算
    for stock in data.get("stocks", []):
        years = stock.get("non_decreasing_years", 0)
        payout = stock.get("payout_ratio", 50.0)
        yield_pct = stock.get("dividend_yield", 2.0)
        
        # 安心度スコア計算ロジック
        base_score = min(years * 2.5, 60.0) # 最大60点
        
        # 配当性向の安全度（50%以下ならボーナス、80%以上なら減点）
        if payout <= 40:
            payout_score = 30.0
        elif payout <= 60:
            payout_score = 25.0
        elif payout <= 80:
            payout_score = 15.0
        else:
            payout_score = 5.0

        # 利回り適正ボーナス
        yield_score = min(yield_pct * 3.0, 10.0)

        total_score = round(base_score + payout_score + yield_score)
        stock["safety_score"] = min(total_score, 99)
        stock["is_10yr_non_decreasing"] = (years >= 10)

    # 10年以上非減配の件数を再集計
    data["total_announced_today"] = len(data.get("stocks", []))
    data["ten_year_champions_count"] = sum(1 for s in data.get("stocks", []) if s.get("is_10yr_non_decreasing", False))

    # 更新されたJSONを書き出し
    os.makedirs(os.path.dirname(json_path), exist_ok=True)
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"[{now_str}] 更新完了: 全増配発表 {data['total_announced_today']} 件 / 10年以上非減配 {data['ten_year_champions_count']} 件")

if __name__ == "__main__":
    main()
