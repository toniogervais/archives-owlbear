"""Build the public factual index and a separate, local six-book import.

python3 shadowrun/build_compendium.py /absolute/task/workspace
Requires the supplied PDFs, the first extraction, and extract_profiles.py.
"""
import collections
import hashlib
import json
import re
import sys
from pathlib import Path

from localization import title as french_title, terms, norm, TITLE_MAP, NOTES_FR, SECTION_OVERRIDES
from rulecards import RULES
from extract_profiles import DERIVED, ATTR
from extract_contacts import contact_profiles
from contact_localization import localize_contact

ROOT=Path(sys.argv[1]);DATA=Path(__file__).parent/'data';ANALYSIS=ROOT/'analysis_sources'


def read(path):return json.loads(path.read_text())
def write(path,data):path.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')))


def topic(e):
    sid=e['source'];p=e['page'];path=' '.join(e.get('path',[]));n=norm(path+' '+e.get('originalTitle',e.get('title','')))
    if sid=='wild':return 'creatures'
    if sid=='core':
        if p<40:return 'univers'
        if 60<=p<100:return 'personnage'
        if 132<=p<174:return 'magie'
        if 174<=p<204:return 'matrice'
        if 204<=p<212:return 'rigging'
        if 212<=p<221:return 'mj'
        if 221<=p<236:return 'creatures'
        if 236<=p<256:return 'mj'
        if 256<=p<=313:return 'equipement'
        return 'combat'
    if sid=='companion':
        if 144<=p<=160:return 'variantes'
        if 161<=p<179:return 'mj'
        if p>=179:return 'personnage'
        return 'personnage'
    if sid=='rigger':return 'rigging'
    if sid=='hacker':return 'matrice'
    return 'equipement' if p<73 or p>=147 else 'combat'


def kind(e):
    sid=e['source'];p=e['page'];n=norm(' '.join([e.get('originalTitle',e.get('title','')),*e.get('path',[])]))
    if sid=='wild' and 20<=p<=175:return 'creature'
    if 'action' in n and not e['title'].lower().startswith('action'):return 'action'
    if sid=='core' and 47<=p<=50 and len(e.get('path',[]))>=2:return 'action'
    if sid=='companion' and 163<=p<=173 and e['level']>=4:return 'npc'
    if sid=='core' and 214<=p<=220 and e['level']>=4:return 'npc'
    return 'rule'


HABITATS=[(20,'Prairies et plaines'),(36,'Montagnes'),(52,'Forêts'),(70,'Marais'),(86,'Jungles et forêts tropicales'),(102,'Savanes'),(116,'Déserts'),(130,'Régions polaires'),(144,'Océans, mers et lacs'),(160,'Milieux urbains')]
def habitat(page):return next((name for start,name in reversed(HABITATS) if page>=start),'Créatures')


def local_value(value):
    # Force F in an English spirit formula is Puissance P, not Strength FOR.
    value=re.sub(r'(?<!\w)F(?!\w)','P',value)
    value=re.sub(r'\bA(\d+),?\s*I(\d+)\b',r'MAJ \1, MIN \2',value)
    value=terms(value)
    value=value.replace('fl ying','vol').replace('fl ying','vol')
    return value


books=read(DATA/'sources.json')
if not any(b['id']=='wild' for b in books):books.append(dict(id='wild',title='Wild Life',language='en',pageCount=194,printedOffset=1,filename='SR6 Wild-Life .pdf'))
for b in books:
    b['displayTitle']={'companion':'Compagnon du Sixième Monde','wild':'Wild Life — Vie sauvage'}.get(b['id'],b['title'])

index=read(DATA/'index.json')
index=[e for e in index if e['source']!='wild']
for e in index:
    if e['source']=='companion':
        e['originalTitle']=e.get('originalTitle',e['title']);e['title']=french_title(e['originalTitle'])
        e['path']=[french_title(t) for t in e['path']]
    e['topic']=topic(e);e['kind']=kind(e);e['optional']=e['source']=='companion' and 144<=e['page']<=160
    e['isStructural']=e['level']==1 and norm(e['title']) in ('table des matieres','table index','index des tableaux','introduction','quartet')
    # The core book TOC calls this care subsection « Magie », while the PDF
    # actually prints « Sorts ». Preserve the indexed title and add an alias.
    if e['source']=='core' and e['page']==126 and e['level']==3 and norm(e['title'])=='magie' and 'soins' in norm(' '.join(e.get('path',[]))):
        e['headingAliases']=['Sorts']

headings=read(ANALYSIS/'06-headings.json')
merges={
 (13,'Putting the “Wild”'):('Putting the “Wild” in Wilderness',['in Wilderness']),
 (15,'Natural'):('Natural Encounters',['Encounters']),
 (16,'How to Win Pets'):('How to Win Pets and Influence Critters',['and Influence','Critters']),
 (127,'Greater Dancing'):('Greater Dancing White Lady',['White Lady']),
 (176,'Interacting'):('Interacting with Critters',['with Critters']),
 (176,'New Influence Skill'):('New Influence Skill Specialization/Expertise: Critters',['Specialization/','Expertise: Critters']),
 (178,'Critter Housing:'):('Critter Housing: Separate Location',['Separate Location']),
 (178,'Critter Taming'):('Critter Taming and Training',['and Training']),
 (180,'Step Three: Appease'):('Step Three: Appease or Capture the Critter',['or Capture the Critter']),
 (181,'Purchasing'):('Purchasing Augmented Critters',['Augmented Critters']),
 (181,'Critter'):('Critter Commands',['Commands']),
 (183,'Critter Special'):('Critter Special Training',['Training']),
 (184,'Paid Training'):('Paid Training Services',['Services']),
 (185,'Critter'):('Critter Companion Qualities',['Companion','Qualities'])}
skip={(page,part) for (page,_),(full,parts) in merges.items() for part in parts}
seen=set()
for i,h in enumerate(headings):
    if (h['page'],h['title']) in skip or h['title']=='Noise Pi eons':continue
    h={**h,'title':merges.get((h['page'],h['title']),(h['title'],[]))[0]}
    key=(norm(h['title']),h['page'])
    if key in seen or h['title'].isdigit() or ' // ' in h['title']:continue
    seen.add(key)
    e=dict(id=f'wild-section-{i}',source='wild',title=french_title(h['title']),originalTitle=h['title'],level=2,page=h['page'],printedPage=h['page']-1,endPage=h['page'],topic='creatures',path=[habitat(h['page'])] if 20<=h['page']<=175 else ['Règles des créatures'])
    e['kind']=kind(e);index.append(e)

profiles=read(ANALYSIS/'profiles.raw.json')+contact_profiles(ROOT)
for e in profiles:
    en=e['name'];e['title']=french_title(en) if e['source'] in ('wild','companion') else en
    e['originalTitle']=en;e['topic']='creatures' if e['kind']=='creature' else 'mj'
    if e['source']=='wild':
        e['habitat']=habitat(e['page'])
        e['attributes']={k:local_value(v) for k,v in e['attributes'].items()}
        e['derived']={DERIVED.get(k,{'MATRIX DR':'SD matriciel','MATRIX I/ID':'I/DI matricielle','MATRIX AC':'PA matricielles','MATRIX CM':'ME matriciel','ASTRAL DR':'SD astral','ASTRAL I/ID':'I/DI astrale','ASTRAL AC':'PA astrales'}.get(k,k)):local_value(v) for k,v in e['original']['derived'].items()}
        if norm(en)=='furfur' and 'MATRIX AC' in e['original']['derived']:
            e['derived']={('AC matriciel (source)' if k=='PA matricielles' else k):v for k,v in e['derived'].items()}
            e['sourceNotes']='La table anglaise intitule « MATRIX AC » la valeur 6/4. Ce libellé ambigu est conservé sans transformer cette valeur en nombre d’actions.'
        e['sections']={terms(k):(NOTES_FR.get(norm(en),terms(v)) if k.lower() in ('note','notes') else terms(v)) for k,v in e['sections'].items()}
        e['sections'].update(SECTION_OVERRIDES.get(norm(en),{}))
        e['title']=e['title'][0].upper()+e['title'][1:]
        e['comparison']=[dict(en=c['label'],fr=c['fr'],source=c['value'],value=e['attributes'][c['fr']]) for c in e['original'].get('attributeCells',[])]
        for (en_key,raw_value),(fr_key,fr_value) in zip(e['original']['derived'].items(),e['derived'].items()):e['comparison'].append(dict(en=en_key,fr=fr_key,source=raw_value,value=fr_value))
    if e['source']=='companion':localize_contact(e)
    if e['source']=='wild':
        e['summary']='Profil de '+e['title']+'. Habitat : '+e['habitat']+'.'
    for ref in index:
        if ref['source']==e['source'] and abs(ref['page']-e['page'])<=2 and norm(ref.get('originalTitle',ref['title']))==norm(en):ref['isStructural']=True

equipment=read(DATA/'equipment.json')
for name,sd,capacity,availability,cost in [('Harnais pour créature','—','4','2','CON × 50 ¥'),('Armure légère pour créature','+2','6','3','CON × 100 ¥'),('Armure lourde pour créature','+4','8','4','CON × 200 ¥'),('Armure renforcée pour créature','+6H','8','6(L)','CON × 1 000 ¥'),('Équipement adapté pour créature','—','—','+1','Prix normal +10 %')]:
    eid='wild-gear-'+hashlib.sha1(name.encode()).hexdigest()[:12]
    if not any(e['id']==eid for e in equipment):equipment.append(dict(id=eid,name=name,source='wild',page=187,printedPage=186,category='Équipement pour créatures',path=['Équipement pour créatures'],origin='table-verifiee',alsoPages=[],fields=[dict(label=k,value=v) for k,v in [('Score Défensif',sd),('Capacité',capacity),('Disponibilité',availability),('Coût',cost)]]))
for e in equipment:
    if e['source']=='companion':
        e['originalTitle']=e.get('originalTitle',e['name']);e['name']=french_title(e['originalTitle']);e['path']=[french_title(v) for v in e['path']]
        e['fields']=[dict(label=terms(f['label']),value=terms(f['value'])) for f in e['fields']]
    if e['source']=='wild':e['related']=[r['id'] for r in RULES if r['source']=='wild' and r['page']==187 and 'Harnais' in r['title']]

for r in RULES:
    r['referenceIds']=[]
    for e in index:
        if e['source']==r['source'] and abs(e['page']-r['page'])<=1 and (norm(e['title'])==norm(r['title']) or r.get('originalTitle') and norm(r['originalTitle']) in [norm(e.get('originalTitle',e['title'])),*(norm(alias) for alias in e.get('headingAliases',[]))]):r['referenceIds'].append(e['id'])
    candidates=[]
    # Cross-links to matching power, action or topic cards, never invented IDs.
    query=norm(r['title'].split(':')[-1]).strip()
    for other in RULES:
        if other['id']==r['id']:continue
        if (other['source']==r['source'] and abs(other['page']-r['page'])<=1) or (len(query)>6 and query in norm(other['title'])):candidates.append(other['id'])
    r['related']=candidates[:5]

pack=read(ROOT/'artifacts/SR6_Bibliotheque_complete.json')
pack['version']=2;pack['title']='Shadowrun 6 — Bibliothèque des six sources';pack['created']='2026-11-19'
pack['books']=[b for b in pack['books'] if b['id']!='wild']
wild_meta=next(b for b in books if b['id']=='wild')
pack['books'].append(dict(**wild_meta,pages=read(ANALYSIS/'06-clean.pages.json'),outline=[e for e in index if e['source']=='wild']))
for book in pack['books']:
    book['displayTitle']=next(b['displayTitle'] for b in books if b['id']==book['id'])
    for page in book['pages']:page['topic']=topic(dict(source=book['id'],page=page['number']))
private=ROOT/'artifacts/SR6_Compendium_six_ouvrages.json';write(private,pack)
coverage=dict(pages=sum(b['pageCount'] for b in books),sections=len(index),equipment=len(equipment),equipmentWithFields=sum(bool(e['fields']) for e in equipment),profiles=len(profiles),reminders=len(RULES),bySource={b['id']:dict(sections=sum(e['source']==b['id'] for e in index),equipment=sum(e['source']==b['id'] for e in equipment),profiles=sum(e['source']==b['id'] for e in profiles),reminders=sum(e['source']==b['id'] for e in RULES)) for b in books},privatePackBytes=private.stat().st_size,validation=dict(profileIssues=[dict(id=e['id'],title=e['title'],page=e['page'],issues=e['issues']) for e in profiles if e['issues']]))
for filename,value in [('sources',books),('index',index),('profiles',profiles),('rules',RULES),('equipment',equipment),('coverage',coverage)]:write(DATA/(filename+'.json'),value)
print(json.dumps(coverage,ensure_ascii=False,indent=2))
