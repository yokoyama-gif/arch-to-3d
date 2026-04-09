"""Scrape KMEW Munsell search results directly via HTTP."""
import urllib.request
import urllib.parse
import re
import sys
import json
from html.parser import HTMLParser

sys.stdout.reconfigure(encoding='utf-8')

BASE = 'https://www.kmew.co.jp/munsell/search_result.jsp'

def build_url(series_name, pageno):
    # The site uses SJIS for form params
    params = {
        'shohinType': '2',
        'seriesNameYane': '',
        'seriesNameGaihekiIppan': series_name.encode('cp932'),
        'seriesNameGaihekiKanrei': '',
        'shikisoFrom': '',
        'shikisoTo': '',
        'shikisoCircle': '',
        'meidoFrom': '',
        'meidoTo': '',
        'meidoType': '',
        'shikisoNeutral': '0',
        'saidoFrom': '',
        'saidoTo': '',
        'Hinban': '',
        'Hinmei': '',
        'shikisoCircleFrom': '',
        'shikisoCircleTo': '',
        'pageno': str(pageno),
    }
    query = urllib.parse.urlencode(params, encoding='cp932')
    return f'{BASE}?{query}'

class RowParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.in_table = False
        self.in_tr = False
        self.in_td = False
        self.current_row = []
        self.current_cell = ''
        self.rows = []
        self.total = 0
        self.body_text = ''
        self.in_body = False

    def handle_starttag(self, tag, attrs):
        if tag == 'tr':
            self.in_tr = True
            self.current_row = []
        elif tag == 'td':
            self.in_td = True
            self.current_cell = ''
        elif tag == 'body':
            self.in_body = True

    def handle_endtag(self, tag):
        if tag == 'tr':
            if len(self.current_row) >= 8:
                self.rows.append(self.current_row[1:8])
            self.in_tr = False
        elif tag == 'td':
            self.current_row.append(self.current_cell.strip())
            self.in_td = False

    def handle_data(self, data):
        if self.in_td:
            self.current_cell += data
        if self.in_body:
            self.body_text += data

def fetch(series, pageno):
    url = build_url(series, pageno)
    req = urllib.request.Request(url, headers={'User-Agent':'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = resp.read()
    # Response is shift-jis
    html = data.decode('cp932', errors='replace')
    p = RowParser()
    p.feed(html)
    # total
    m = re.search(r'全\s*(\d+)', p.body_text)
    total = int(m.group(1)) if m else 0
    return p.rows, total

def scrape_all(series):
    all_rows = []
    page = 0  # 0-indexed
    total = 0
    while True:
        rows, total = fetch(series, page)
        if not rows:
            break
        all_rows.extend(rows)
        if len(all_rows) >= total:
            break
        page += 1
        if page > 30:
            break
    return all_rows, total

SERIES = [
    'ネオロック・光セラ18',
    'ネオロック・光セラ18　セラトピア',
    'ネオロック・光セラ18　セラトピア　ディズニーシリーズ',
    'エクセレージ・親水14',
    'エクセレージ・親水14広幅',
]

import json
all_data = {}
for s in SERIES:
    try:
        rows, total = scrape_all(s)
        print(f'{s}: got {len(rows)} / total {total}')
        all_data[s] = rows
    except Exception as e:
        print(f'{s}: ERROR {e}')

with open('C:/Users/admin/Desktop/claud/kmew_data.json','w',encoding='utf-8') as f:
    json.dump(all_data, f, ensure_ascii=False, indent=1)
print('Saved kmew_data.json')
