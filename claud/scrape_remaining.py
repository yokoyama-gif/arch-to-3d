"""Scrape all remaining KMEW series and save to JSON."""
import urllib.request, urllib.parse, re, sys, json
from html.parser import HTMLParser
sys.stdout.reconfigure(encoding='utf-8')

BASE = 'https://www.kmew.co.jp/munsell/search_result.jsp'

REMAINING = [
    '次世代外装パネル\u3000レジェール',
    'FLAT DESIGN PANEL',
    'ネオロック・光セラ16\u3000セラトピア',
    'フィルテクトN・光セラ16 セラトピア',
    'エクセレージ・光セラ15',
    'フィルテクトN・光セラ16',
    'フィルテクトE・光セラ16',
    'セラディール・親水パワーコート16',
    'ネオロック・親水16',
    'エクセレージ・親水16',
    'エクセレージ・親水15',
    'フィルテクトN・親水16',
    'フィルテクトE・親水16',
    'エクセレージ16',
    'シンプルシリーズ（金属サイディング）',
    'デザインシリーズ（金属サイディング）',
    'シンプルシリーズH（金属サイディング）',
    'LAP-WALL',
]

def build_url(series, pageno):
    params = [
        ('shohinType','2'),('seriesNameYane',''),
        ('seriesNameGaihekiIppan', series),
        ('seriesNameGaihekiKanrei',''),
        ('shikisoFrom',''),('shikisoTo',''),('shikisoCircle',''),
        ('meidoFrom',''),('meidoTo',''),('meidoType',''),
        ('shikisoNeutral','0'),('saidoFrom',''),('saidoTo',''),
        ('Hinban',''),('Hinmei',''),
        ('shikisoCircleFrom',''),('shikisoCircleTo',''),
        ('pageno',str(pageno)),
    ]
    return BASE + '?' + urllib.parse.urlencode(params, encoding='cp932')

class RowParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.in_tr=False;self.in_td=False
        self.current_row=[];self.current_cell=''
        self.rows=[];self.body_text='';self.in_body=False
    def handle_starttag(self,tag,attrs):
        if tag=='tr': self.in_tr=True; self.current_row=[]
        elif tag=='td': self.in_td=True; self.current_cell=''
        elif tag=='body': self.in_body=True
    def handle_endtag(self,tag):
        if tag=='tr':
            if len(self.current_row)>=8:
                self.rows.append(self.current_row[1:8])
            self.in_tr=False
        elif tag=='td':
            self.current_row.append(self.current_cell.strip())
            self.in_td=False
    def handle_data(self,data):
        if self.in_td: self.current_cell+=data
        if self.in_body: self.body_text+=data

def fetch(series, pageno):
    url = build_url(series, pageno)
    req = urllib.request.Request(url, headers={'User-Agent':'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=30) as r:
        data = r.read()
    html = data.decode('cp932', errors='replace')
    p = RowParser(); p.feed(html)
    m = re.search(r'全\s*(\d+)', p.body_text)
    return p.rows, (int(m.group(1)) if m else 0)

def scrape_all(series):
    out=[]; page=0; total=0
    while True:
        rows, total = fetch(series, page)
        if not rows: break
        out.extend(rows)
        if len(out) >= total: break
        page += 1
        if page > 50: break
    return out, total

all_data = {}
for s in REMAINING:
    try:
        rows, total = scrape_all(s)
        print(f'{s}: {len(rows)}/{total}')
        all_data[s] = rows
    except Exception as e:
        print(f'{s}: ERROR {e}')
        all_data[s] = []

with open('C:/Users/admin/Desktop/claud/kmew_data_more.json','w',encoding='utf-8') as f:
    json.dump(all_data, f, ensure_ascii=False, indent=1)
print('Saved kmew_data_more.json')
