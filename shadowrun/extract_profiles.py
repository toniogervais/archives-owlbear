"""Extract factual stat blocks; retain source cells for independent checks.

Usage: python3 shadowrun/extract_profiles.py /absolute/task/workspace
Source PDFs and their text are never copied into the public checkout.
"""
import collections
import hashlib
import json
import re
import sys
import unicodedata
from pathlib import Path

import fitz

ROOT = Path(sys.argv[1])
OUT = Path(__file__).parent / 'data'
TMP = ROOT / 'analysis_sources'


def clean(s):
    s = unicodedata.normalize('NFKC', s).replace('\u00ad', '')
    return re.sub(r'\s+', ' ', s).strip()


def norm(s):
    return re.sub('[^a-z0-9]', '', unicodedata.normalize('NFKD', s.lower()).encode('ascii', 'ignore').decode())


def lines(page):
    buckets = collections.defaultdict(list)
    for block in page.get_text('dict')['blocks']:
        for line in block.get('lines', []):
            spans = line['spans']
            t = clean(''.join(s['text'] for s in spans))
            if not t:
                continue
            x, y, x1, y1 = line['bbox']
            v = dict(x=x, y=y, x1=x1, y1=y1, text=t, font=spans[0]['font'], size=spans[0]['size'])
            # Wild Life has a second, almost identical text layer. One copy
            # sometimes contains a complete line and the other split spans.
            bucket = round(y)
            nearby = [p for k in (bucket-1,bucket,bucket+1) for p in buckets[k] if abs(p['y']-y)<.3]
            same = [p for p in nearby if abs(p['x']-x) < .3]
            if any(p['text'] == t or p['text'].startswith(t) for p in same):
                continue
            if any(p['x']-.3 <= x and x1 <= p['x1']+.3 and t in p['text'] for p in nearby):
                continue
            for k in (bucket-1,bucket,bucket+1):
                buckets[k] = [p for p in buckets[k] if not (abs(p['y']-y) < .3 and p['text'] in t and x-.3 <= p['x'] and p['x1'] <= x1+.3)]
            buckets[bucket].append(v)
    return [p for row in buckets.values() for p in row]


def reading_text(ls, width):
    # Read columns separately. Preserve tables using the dedicated extractor,
    # rather than interpreting position-dependent prose as stat cells.
    body = [l for l in ls if 30 < l['y'] < 748 and 35 < l['x'] < width-35]
    out = []
    # These PDFs alternate their binding margin. The two frequent paragraph
    # starts identify the actual gutter more reliably than the MediaBox.
    starts=collections.Counter(round(l['x']/3)*3 for l in body if l['size']>=9 and l['x1']-l['x']>130)
    frequent=starts.most_common(20)
    lx=min((x for x,n in frequent if x<200),default=50)
    rx=min((x for x,n in frequent if 240<x<400),default=width/2)
    gutter=(lx+rx+220)/2
    for col in (0, 1):
        group = sorted([l for l in body if (l['x'] < gutter) == (col == 0)], key=lambda l:(round(l['y'], 1), l['x']))
        rows = []
        for l in group:
            if rows and abs(rows[-1][0]['y']-l['y']) < 2:
                rows[-1].append(l)
            else:
                rows.append([l])
        out.extend(' '.join(l['text'] for l in sorted(row, key=lambda l:l['x'])) for row in rows)
    return '\n'.join(out)


def row_values(ls, headers, y, tolerance=17, bounds=None):
    hx = [(h['x']+h['x1'])/2 for h in headers]
    mid = [(a+b)/2 for a,b in zip(hx,hx[1:])]
    vals = [[] for h in headers]
    left, right = bounds or (min(h['x'] for h in headers)-15, max(h['x1'] for h in headers)+15)
    for l in sorted(ls, key=lambda l:(l['y'],l['x'])):
        if not (y+3 < l['y'] < y+tolerance and left <= l['x'] and l['x1'] <= right):
            continue
        if 'Amplitude' not in l['font'] or any(x in l['font'] for x in ('Bold', 'Black')):
            continue
        c = (l['x']+l['x1'])/2
        col = sum(c > m for m in mid)
        vals[col].append(l['text'])
    return [clean(' '.join(v)) for v in vals]


ATTR = {'B':'CON','A':'AGI','R':'RÉA','R (Résonance)':'RÉS','S':'FOR','W':'VOL','L':'LOG','I':'INT','C':'CHA','M':'MAG','RES':'RÉS','RÉS':'RÉS','ESS':'ESS','EDG':'ATO','E':'ATO'}
DERIVED = {'DR':'SD','I/ID':'I/DI','AC':'PA','CM':'ME','MOVE':'Déplacement','M':'Déplacement','DÉPLA.':'Déplacement','DÉPLACEMENT':'Déplacement','M DR':'SD matriciel','M I/ID':'I/DI matricielle','M AC':'PA matricielles','MCM':'ME matriciel','A':'Attaque','S':'Corruption','D':'Traitement de données','F':'Firewall','ASTRAL DR':'SD astral','ASTRAL I/ID':'I/DI astrale','ASTRAL AC':'PA astrales','TECHNO.':'Technodrain','CON':'CON','RÉA':'RÉA'}


def profiles(doc, source, first, last):
    records=[]
    for pno in range(first,last+1):
        pg=doc[pno-1]; ls=lines(pg)
        begins=[l for l in ls if l['text']==('B' if source=='wild' else 'CON') and ('Bold' in l['font'] or 'Black' in l['font']) and l['size']<9]
        for start in begins:
            x,y=start['x'],start['y']; column = 0 if x<220 else 1
            col_ls=[l for l in ls if x-19 <= l['x'] and l['x1'] <= x+222]
            hs=sorted([l for l in col_ls if abs(l['y']-y)<1 and l['size']<9 and ('Bold' in l['font'] or 'Black' in l['font'])], key=lambda l:l['x'])
            if len(hs)<8:continue
            title_ls=[l for l in col_ls if 'Njord' in l['font'] and l['size']>=8 and 0 < y-l['y'] < 55 and abs(l['x']-(x-9))<18 and not l['text'].isdigit()]
            if not title_ls:continue
            title_ls.sort(key=lambda l:l['y'],reverse=True)
            ttl=title_ls[0]
            name=ttl['text']
            above=[l for l in title_ls[1:] if abs(ttl['y']-l['y'])<13 and abs(ttl['x']-l['x'])<6]
            if above:name=' '.join([l['text'] for l in sorted([ttl,*above],key=lambda l:l['y'])])
            av=row_values(col_ls,hs,y,18)
            skills_y=min([l['y'] for l in col_ls if l['y']>y and re.match(r'^(Skills|Compétences|Attaques?|Armes|Weapons|Attacks?)\s*[:：]',l['text'])]+[y+90])
            dls=[l for l in col_ls if y+18 < l['y'] < skills_y-2 and l['size']<9 and ('Bold' in l['font'] or 'Black' in l['font']) and not re.search(r'[:>]',l['text'])]
            if not dls:continue
            dy=min(l['y'] for l in dls)
            groups=[]
            for l in sorted(dls,key=lambda l:(l['y'],l['x'])):
                if groups and abs(groups[-1][0]['y']-l['y'])<2:groups[-1].append(l)
                else:groups.append([l])
            draw={}
            for j,group in enumerate(groups):
                group.sort(key=lambda l:l['x'])
                gy=group[0]['y'];stop=groups[j+1][0]['y'] if j+1<len(groups) else skills_y-1
                if len(group)<2:continue
                if all(h['text'] in ('ASTRAL','MATRIX') for h in group):continue
                labels=[]
                for h in group:
                    center=(h['x']+h['x1'])/2
                    upper=[u for u in dls if u['text'] in ('ASTRAL','MATRIX') and 0<gy-u['y']<9 and abs((u['x']+u['x1'])/2-center)<12]
                    labels.append((upper[0]['text']+' ' if upper else '')+h['text'])
                vals=row_values(col_ls,group,gy,stop-gy,bounds=(x-19,x+222))
                draw.update(zip(labels,vals))
            next_start=min([l['y']-23 for l in begins if l is not start and (l['x']<220)==(column==0) and l['y']>y]+[748])
            # A stat panel ends at the next heading (not at the next profile's
            # attributes). This avoids pulling in surrounding body paragraphs.
            next_title=min([l['y'] for l in col_ls if 'Njord' in l['font'] and l['size']>=8 and l['y']>dy+15]+[748])
            end=min(next_start,next_title)
            detail=sorted([l for l in col_ls if skills_y-.3 <= l['y'] < end and 'Amplitude' in l['font'] and l['size']<=8.1],key=lambda l:(round(l['y'],1),l['x']))
            sections={}; current=None
            for l in detail:
                t=l['text']
                m=re.match(r'^(Skills|Powers(?:/Traits)?|Weakness(?:es)?|Weapons|Attacks?|Notes?|Complex Forms|Qualities|Adept Powers?|Optional Powers?|Compétences|Pouvoirs(?:/Traits)?|Pouvoirs optionnels|Attaques?|Faiblesses?|Armes|Équipement|Sorts|Traits|Augmentations|Programmes|Formes complexes)\s*[:：]\s*(.*)',t,re.I)
                if m:current=m[1];sections.setdefault(current,[]);t=m[2]
                if current and t:sections[current].append(t)
            sections={k:clean(' '.join(v)).replace('- ', '') for k,v in sections.items()}
            if not any(k.lower() in ('skills','compétences','attaque','attaques','weapons','armes') for k in sections):continue
            attr_labels=[('R (Résonance)' if source=='wild' and i>=8 and h['text']=='R' else h['text']) for i,h in enumerate(hs)]
            raw=dict(zip(attr_labels,av))
            translated={ATTR.get(k,k):v for k,v in raw.items()}
            derived={DERIVED.get(k,k):v for k,v in draw.items()}
            validation=[]
            if any(not v for v in raw.values()) or any(not v for v in draw.values()):validation.append('cellule absente')
            if any(not re.fullmatch(r'[\dFPD×*().,+–—−/ -]+',v) for v in raw.values()):validation.append('attribut à vérifier')
            records.append(dict(id=source+'-profile-'+hashlib.sha1((name+'|'+str(pno)).encode()).hexdigest()[:12],name=name,source=source,page=pno,printedPage=pno-(1 if source=='wild' else 2),kind='creature' if source=='wild' or pno>=222 else 'npc',attributes=translated,derived=derived,sections=sections,original=dict(name=name,attributes=raw,attributeCells=[dict(label=h['text'],key=attr_labels[i],fr=ATTR.get(attr_labels[i],attr_labels[i]),value=av[i]) for i,h in enumerate(hs)],derived=draw,sections=sections),verification='cellules-extraites' if not validation else 'a-verifier',issues=validation))
    return records


if __name__=='__main__':
    wild=fitz.open(ROOT/'upload/SR6 Wild-Life .pdf')
    if '--profiles-only' not in sys.argv:
        pages=[]
        headings=[]
        for i,pg in enumerate(wild):
            ls=lines(pg)
            text=reading_text(ls,pg.rect.width)
            pages.append(dict(number=i+1,printed=i,text=text,layout=text))
            for l in ls:
                if 'Njord' in l['font'] and 13<=l['size']<25 and 35<l['x']<pg.rect.width-35 and len(l['text'])>2:
                    if i+1>=9:headings.append(dict(title=l['text'],page=i+1,x=l['x'],y=l['y']))
            if i%50==0:print('pages',i+1,flush=True)
        (TMP/'06-clean.pages.json').write_text(json.dumps(pages,ensure_ascii=False))
        (TMP/'06-headings.json').write_text(json.dumps(headings,ensure_ascii=False,indent=2))
    core=fitz.open(ROOT/'project_sources/03-SR6-livre-de-base-2-.pdf')
    entries=profiles(wild,'wild',20,175)+profiles(core,'core',214,227)
    (TMP/'profiles.raw.json').write_text(json.dumps(entries,ensure_ascii=False,indent=2))
    print(json.dumps({'profiles':len(entries),'bySource':dict(collections.Counter(e['source'] for e in entries)),'issues':[{k:e[k] for k in ('name','page','issues')} for e in entries if e['issues']]},ensure_ascii=False,indent=2))
