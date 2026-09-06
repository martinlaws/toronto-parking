"""Independent checks on deck-candidate.json + sample grids for the spec."""
import json, hashlib, itertools, collections, subprocess, sys
from tp_core import *
import os
S=os.path.dirname(os.path.abspath(__file__))+'/'   # rush.txt and the outputs live next to these scripts
D=json.load(open(S+'deck-candidate.json')); cards=D['cards']
if os.path.exists(S+'deck-candidate.prev.json'):
    prev=json.load(open(S+'deck-candidate.prev.json'))['cards']
    print('same boards as previous run:', [c['board'] for c in cards]==[c['board'] for c in prev])

def replay(card):
    """Apply solution moves to the board; return (ok, moves_applied)."""
    pieces,walls=parse(card['board'])
    occ=set()
    for w in walls: occ|=set(w['cells'])
    byid={p['id']:p for p in pieces}
    for p in pieces: occ|=set(p['cells'])
    for k,mv in enumerate(card['solution']):
        p=byid[mv['pieceId']]; d=mv['dir']; n=mv['cells']
        step={'left':-1,'right':1,'up':-N,'down':N}[d]
        assert (p['orientation']=='h')==(d in('left','right')), ('axis',card['n'],k)
        occ-=set(p['cells'])
        for s in range(1,n+1):
            cells=[c+step*s for c in p['cells']]
            # stay on board and in lane
            assert all(0<=c<36 for c in cells), ('offboard',card['n'],k)
            if p['orientation']=='h': assert all(c//N==p['cells'][0]//N for c in cells), ('lane',card['n'],k)
            assert not (set(cells)&occ), ('collision',card['n'],k,s)
        p['cells']=[c+step*n for c in p['cells']]; occ|=set(p['cells'])
    hero=byid['A']
    return hero['cells']==[2*N+4,2*N+5], len(card['solution'])

# 1. solver == Fogleman for all 60, solution replays, immovable pieces
bad=0; immov=collections.Counter(); immov_cards=[]
for c in cards:
    r=solve(c['board'])
    if r['moves']!=c['moves'] or r['cluster']!=c['cluster']: bad+=1; print('MISMATCH',c['n'])
    ok,n=replay(c); assert ok and n==c['moves'], ('replay',c['n'],ok,n)
    pieces,walls=parse(c['board'])
    # immovable: pieces that never change offset anywhere in the cluster
    start=tuple(p['col'] if p['orientation']=='h' else p['row'] for p in pieces)
    moved=set()
    # cheap: re-run BFS collecting per-piece offsets
    from collections import deque
    lanes=[]
    wm=0
    for w in walls: wm|=1<<w['cells'][0]
    for p in pieces:
        L=p['length']; ms=[]
        for off in range(N-L+1):
            m=0
            for k in range(L): m|=1<<((p['row']*N+off+k) if p['orientation']=='h' else ((off+k)*N+p['col']))
            ms.append(m)
        lanes.append(ms)
    seen={start}; q=deque([start]); offs=[set([s]) for s in start]
    while q:
        s=q.popleft(); m=wm
        for i in range(len(s)): m|=lanes[i][s[i]]
        for i in range(len(s)):
            me=lanes[i][s[i]]; free=~(m&~me)
            # walk each direction separately and stop at the first blocked offset
            for rng in (range(s[i]-1,-1,-1),range(s[i]+1,len(lanes[i]))):
                for j in rng:
                    if (lanes[i][j]&~free)!=0: break
                    t=s[:i]+(j,)+s[i+1:]
                    offs[i].add(j)
                    if t not in seen: seen.add(t); q.append(t)
    assert len(seen)==c['cluster'], ('cluster',c['n'],len(seen),c['cluster'])
    im=[pieces[i]['id'] for i in range(len(pieces)) if len(offs[i])==1]
    if im: immov[c['tier']]+=1; immov_cards.append((c['n'],im))
print('solver==Fogleman mismatches:',bad,'/ 60;  all 60 solutions replay to hero at cols 4-5 in exactly par moves')
print('cards with an immovable non-hero piece:',sum(immov.values()),dict(immov),immov_cards[:12])

# 2. caps, per-card inventory, pylon rule
for c in cards:
    pcs=c['pieces']; cnt=collections.Counter((p['kind'],p['colour']) for p in pcs)
    for col in ('blue','yellow','green'):
        assert cnt[('car',col)]<=INVENTORY['car'][col] and cnt[('truck',col)]<=INVENTORY['truck'][col],c['n']
    assert cnt[('pylon','yellow')]<=2 and cnt[('hero','red')]==1
    hero=[p for p in pcs if p['kind']=='hero'][0]
    assert not any(p['kind']=='pylon' and p['row']==2 and p['col']>hero['col']+1 for p in pcs), c['n']
    nd=c['needs']; sb=c['staysInBox']
    for k in('car','truck'):
        for col in ('blue','yellow','green'): assert nd[k][col]+sb[k][col]==INVENTORY[k][col]
    assert nd['pylon']+sb['pylon']==2
    assert [p['id'] for p in pcs][0]=='A'
print('caps + needs/staysInBox partition + pylon rule + hero-first: all 60 ok')
# 3. monotone, numbering, tiers
mv=[c['moves'] for c in cards]; assert mv==sorted(mv) and [c['n'] for c in cards]==list(range(1,61))
print('moves monotone in n:',True,' tiers:',collections.Counter(c['tier'] for c in cards))
print('pylons: cards with 1:',sum(1 for c in cards if c['needs']['pylon']==1),' with 2:',sum(1 for c in cards if c['needs']['pylon']==2))
# 4. determinism: rebuild and compare sha256
h1=hashlib.sha256(open(S+'deck-candidate.json','rb').read()).hexdigest()
subprocess.run([sys.executable,S+'tp_select.py'],capture_output=True)
h2=hashlib.sha256(open(S+'deck-candidate.json','rb').read()).hexdigest()
print('rebuild byte-identical:',h1==h2,h1[:16])
# 5. sample grids
def legend(c):
    pcs=[p for p in c['pieces'] if p['kind'] not in('hero','pylon')]
    return ', '.join(f"{p['id']}={p['colour']} {p['kind']}" for p in pcs)
for n in (1,15,30,45,60):
    c=cards[n-1]
    print(f"\n#{c['n']} {c['tier']}  par {c['moves']}  cluster {c['cluster']}  pylons {c['needs']['pylon']}  board {c['board']}")
    print(grid(c['board']))
    print('  A=red car (hero), #=pylon;',legend(c))
    print('  needs:',{k:v for k,v in c['needs'].items()},' stays:',c['staysInBox'])
    print('  solution:',' '.join(f"{m['pieceId']}{m['dir'][0].upper()}{m['cells']}" for m in c['solution']))
    print('  meta:',c['meta'])
