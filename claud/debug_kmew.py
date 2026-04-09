import urllib.request, urllib.parse, sys, re
sys.stdout.reconfigure(encoding='utf-8')

def build_url(series, pageno):
    params = [
        ('shohinType','2'),
        ('seriesNameYane',''),
        ('seriesNameGaihekiIppan', series),
        ('seriesNameGaihekiKanrei',''),
        ('shikisoFrom',''),('shikisoTo',''),('shikisoCircle',''),
        ('meidoFrom',''),('meidoTo',''),('meidoType',''),
        ('shikisoNeutral','0'),('saidoFrom',''),('saidoTo',''),
        ('Hinban',''),('Hinmei',''),
        ('shikisoCircleFrom',''),('shikisoCircleTo',''),
        ('pageno',str(pageno)),
    ]
    q = urllib.parse.urlencode(params, encoding='cp932')
    return 'https://www.kmew.co.jp/munsell/search_result.jsp?'+q

for page in [1, 10, 11, 12]:
    url = build_url('ネオロック・光セラ18', page)
    req = urllib.request.Request(url, headers={'User-Agent':'Mozilla/5.0'})
    with urllib.request.urlopen(req) as r:
        html = r.read().decode('cp932', errors='replace')
    count = html.count('<tr')
    tds = len(re.findall(r'測定値', html))
    print(f'page{page}: <tr>={count}, 測定値={tds}')

# Try 広幅
url = build_url('エクセレージ・親水14広幅', 1)
req = urllib.request.Request(url, headers={'User-Agent':'Mozilla/5.0'})
with urllib.request.urlopen(req) as r:
    html = r.read().decode('cp932', errors='replace')
print(f'\n広幅 page1: <tr>={html.count("<tr")}, 測定値={len(re.findall(r"測定値", html))}')
# Save for inspection
with open('C:/Users/admin/Desktop/claud/debug_hiro.html','w',encoding='utf-8') as f:
    f.write(html)
print('saved debug_hiro.html')
