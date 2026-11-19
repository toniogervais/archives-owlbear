"""Extract the Companion's factual contact stat cells without deriving values."""
import hashlib,json,re,sys
from pathlib import Path
import fitz
from extract_profiles import lines,row_values,ATTR,clean
from localization import terms,title as french_title

def contact_profiles(root):
    doc=fitz.open(next((root/'project_sources').glob('02*.pdf')));out=[]
    for pno in range(165,174):
        ls=lines(doc[pno-1])
        for start in [l for l in ls if l['text']=='B' and 'Bold' in l['font'] and l['size']<9]:
            x,y=start['x'],start['y'];col=[l for l in ls if x-20<=l['x'] and l['x1']<=x+230]
            headers=sorted([l for l in col if abs(l['y']-y)<1 and 'Bold' in l['font'] and l['size']<9],key=lambda l:l['x'])
            if len(headers)<8:continue
            titles=sorted([l for l in col if 'Njord' in l['font'] and l['size']<12 and 0<y-l['y']<30],key=lambda l:l['y'],reverse=True)
            if not titles:continue
            name=titles[0]['text'];vals=row_values(col,headers,y,20,bounds=(x-20,x+230));raw=dict(zip([h['text'] for h in headers],vals))
            if not all(re.fullmatch(r'\d+',v) for v in vals):raise ValueError((pno,name,raw))
            end=min([l['y'] for l in col if l['y']>y+18 and 'Njord' in l['font'] and l['size']>=9]+[748])
            detail=sorted([l for l in col if y+18<l['y']<end and 'Amplitude' in l['font'] and l['size']<=8],key=lambda l:(l['y'],l['x']))
            sections={};current=None
            for line in detail:
                t=line['text'];m=re.match(r'^(Active Skills|Knowledge Skills|Qualities|Spells|Gear)\s*:\s*(.*)',t)
                if m:current={'Active Skills':'Compétences','Knowledge Skills':'Connaissances','Qualities':'Traits','Spells':'Sorts','Gear':'Équipement'}[m[1]];t=m[2];sections[current]=[]
                if current:sections[current].append(t)
            sections={k:terms(clean(' '.join(v)).replace('- ','')) for k,v in sections.items()}
            attrs={ATTR[k]:v for k,v in raw.items()};cells=[dict(label=k,key=k,fr=ATTR[k],value=v) for k,v in raw.items()]
            out.append(dict(id='companion-profile-'+hashlib.sha1((name+'|'+str(pno)).encode()).hexdigest()[:12],name=name,source='companion',page=pno,printedPage=pno-1,kind='npc',attributes=attrs,derived={},sections=sections,original=dict(name=name,attributes=raw,attributeCells=cells,derived={},sections={}),comparison=[dict(en=k,fr=ATTR[k],source=v,value=v) for k,v in raw.items()],verification='cellules-extraites',issues=[]))
    return out

if __name__=='__main__':
    root=Path(sys.argv[1]);records=contact_profiles(root)
    (root/'analysis_sources/contacts.raw.json').write_text(json.dumps(records,ensure_ascii=False,indent=2))
    print(json.dumps({'contacts':len(records),'names':[r['name'] for r in records]}))
