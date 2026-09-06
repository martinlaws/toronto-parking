"""Independent immovable-piece scan (separate BFS from tp_core.solve); asserts cluster sizes match Fogleman's."""
import json, os
from collections import deque
from tp_core import parse, _lane_masks, N, name, solve
S=os.path.dirname(os.path.abspath(__file__))+'/'
D=json.load(open(S+'deck-candidate.json')); cards=D['cards']
res=[]
for c in cards:
    pieces,walls=parse(c['board'])
    wm=0
    for w in walls: wm|=1<<w['cells'][0]
    lanes=[_lane_masks(p) for p in pieces]
    start=tuple(p['col'] if p['orientation']=='h' else p['row'] for p in pieces)
    seen={start}; q=deque([start]); offs=[{s} for s in start]
    while q:
        s=q.popleft(); m=wm
        for i in range(len(s)): m|=lanes[i][s[i]]
        for i in range(len(s)):
            me=lanes[i][s[i]]; blocked=m&~me
            for j in range(len(lanes[i])):
                if j==s[i]: continue
                lo,hi=min(j,s[i]),max(j,s[i])
                # path must be free for all intermediate offsets
                if all((lanes[i][k]&blocked)==0 for k in range(lo,hi+1)):
                    t=s[:i]+(j,)+s[i+1:]
                    offs[i].add(j)
                    if t not in seen: seen.add(t); q.append(t)
    assert len(seen)==c['cluster'],(c['n'],len(seen),c['cluster'])
    im=[pieces[i]['id'] for i in range(len(pieces)) if len(offs[i])==1]
    if im: res.append((c['n'],im))
print('immovable:',res)
# read-aloud for #1
c=cards[0]; pieces,walls=parse(c['board'])
from tp_core import colour; colour(pieces,walls)
byid={p['id']:p for p in pieces}
STEP={'left':-1,'right':1,'up':-N,'down':N}
words=[]
for m in c['solution']:
    p=byid[m['pieceId']]; words.append(f"{name(p)} {m['dir']} {m['cells']}")
    p['cells']=[x+STEP[m['dir']]*m['cells'] for x in p['cells']]
print(' · '.join(words))
# #45 pylon, #60 pylon positions
for n in (45,60):
    print(n,[ (p['row']+1,p['col']+1) for p in cards[n-1]['pieces'] if p['kind']=='pylon'])
# green exhausted #45
print('#45 green cars',sum(1 for p in cards[44]['pieces'] if p['kind']=='car' and p['colour']=='green'))
# check branching-1 cards
print('branching==1:',[c['n'] for c in cards if c['meta']['branching']==1])
# pieces[0] hero
print('hero first all:',all(c['pieces'][0]['kind']=='hero' for c in cards))
# generator header
print({k:v for k,v in D['generator'].items()}, D['source'])
print('cards fields:',list(cards[0].keys()))
print('pylon piece example:',[p for p in cards[44]['pieces'] if p['kind']=='pylon'])
print('size bytes',len(open(S+'deck-candidate.json','rb').read()))
