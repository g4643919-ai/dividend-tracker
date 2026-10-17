"""
JPX official download script
Downloads latest official Tokyo Stock Exchange listed equity spreadsheet
"""
import urllib.request
import os

url = 'https://www.jpx.co.jp/markets/statistics-equities/misc/tvdivq0000001vg2-att/data_j.xlsx'
dest = os.path.join(os.path.dirname(__file__), '..', 'data', 'data_j.xlsx')

print(f"Fetching latest JPX listed company master from: {url}")
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
try:
    with urllib.request.urlopen(req, timeout=15) as resp:
        data = resp.read()
        with open(dest, 'wb') as f:
            f.write(data)
    print(f"Successfully saved {len(data)} bytes to {dest}")
except Exception as e:
    print(f"Error fetching from JPX: {e}")
    if os.path.exists(dest):
        print("Using existing local data_j.xlsx file.")
    else:
        raise e
