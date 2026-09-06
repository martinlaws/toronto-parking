"""Pass 2: deterministic deck selection from the pass-1 pool, BFS solve + verify,
colour assignment, JSON out. Everything is a pure function of rush.txt + these constants."""
import json, math, time, hashlib
from tp_core import *
import os
S=os.path.dirname(os.path.abspath(__file__))+'/'   # rush.txt and the outputs live next to these scripts
P=json.load(open(S+'tp_pass1.json'))
pool={tuple(map(int,k.split(','))):v for k,v in P['pool'].items()}
hist={tuple(map(int,k.split(','))):v for k,v in P['hist'].items()}

DECK_SIZE=60
BANDS={'beginner':(5,12),'intermediate':(13,20),'advanced':(21,29),'expert':(30,40),'grandmaster':(41,60)}
PER_TIER=12
MIN_BRANCH={'beginner':2,'intermediate':3,'advanced':3,'expert':3,'grandmaster':3}
MAX_CLUSTER=30000
MAX_PIECES={'beginner':10}   # incl. hero and pylons; keeps the on-ramp cards quick to set up
MAX_SIMILARITY=0.5
# pylon slots per tier: slot index -> pylon count (slots are 0..11 in ascending-moves order)
PYLON_SLOTS={'beginner':{},
            'intermediate':{5:1,10:1},
            'advanced':{3:1,7:1,11:2},
            'expert':{2:1,5:1,8:1,11:2},
            'grandmaster':{1:1,3:1,5:2,7:1,9:2,11:1}}
FINALE='IBBxooIooLDDJAALooJoKEEMFFKooMGGHHHM'   # the 60-move puzzle, pinned as card 60

def targets(lo,hi,n,cap=None):
    hi2=cap if cap else hi
    return [lo+round(i*(hi2-lo)/(n-1)) for i in range(n)]

deck=[]; chosen_fp=[]; log=[]
t0=time.time()
for tier in TIERS:
    lo,hi=BANDS[tier]
    tg=targets(lo,hi,PER_TIER, cap=55 if tier=='grandmaster' else None)
    picks=[]
    for slot,m in enumerate(tg):
        w=PYLON_SLOTS[tier].get(slot,0)
        if tier=='grandmaster' and slot==PER_TIER-1:
            cand=[(hashlib.sha1(FINALE.encode()).hexdigest(),FINALE,2332,8,3)]; m=60
        else:
            cand=None
            for dm in [0,1,-1,2,-2,3,-3,4,-4,5,-5,6,-6]:
                mm=m+dm
                if mm<lo or mm>hi: continue
                cand=pool.get((mm,w),[])
                cand=[c for c in cand if c[2]<=MAX_CLUSTER and branching(c[1])>=MIN_BRANCH[tier]]
                cand=[c for c in cand if sum(map(len,parse(c[1])))<=MAX_PIECES.get(tier,99)]
                cand=[c for c in cand if all(similarity(footprint(*parse(c[1])),fp)<MAX_SIMILARITY for fp in chosen_fp)]
                if cand: m=mm; break
            assert cand, (tier,slot,m,w)
            recent=[p['pieces_total'] for p in picks[-2:]]
            recent_hero=[p['pieces'][0]['col'] for p in picks[-2:]]
            def key(c):
                pcs,wl=parse(c[1]); pc=len(pcs)+len(wl)
                return (1 if pc in recent else 0, 1 if pcs[0]['col'] in recent_hero else 0, c[0])
            cand.sort(key=key)
        h,b,c,cars,trucks=cand[0]
        r=solve(b)
        assert r['moves']==m and r['cluster']==c, (b,m,c,r['moves'],r['cluster'])
        pieces,walls=parse(b)
        conflicts=colour(pieces,walls)
        picks.append(dict(tier=tier,board=b,moves=m,cluster=c,walls=len(walls),pieces=pieces,wallsl=walls,
                          sol=r['path'],ofm=r['optimal_first_moves'],branching=r['branching'],
                          pieces_total=len(pieces)+len(walls),conflicts=conflicts,hash=h))
        chosen_fp.append(footprint(pieces,walls))
    picks.sort(key=lambda p:(p['moves'],p['cluster']))
    deck+=picks
print('selected+solved+verified 60 in %.1fs'%(time.time()-t0))

cards=[]
for n,p in enumerate(deck,1):
    pieces=p['pieces']; walls=p['wallsl']
    allp=pieces+walls
    cards.append(dict(
        n=n, tier=p['tier'], board=p['board'], moves=p['moves'], cluster=p['cluster'],
        pieces=[{k:q[k] for k in ('id','kind','colour','row','col','orientation','length')} for q in allp],
        solution=[dict(pieceId=l,dir=d,cells=k) for l,d,k in p['sol']],
        needs=needs(pieces,walls), staysInBox=stays_in_box(pieces,walls),
        meta=dict(branching=p['branching'],optimalFirstMoves=p['ofm'])))
out=dict(source=dict(file='rush.txt',sha256='fca9f04db491415ac257416cd25b304670f2859f5f1bb1f4948c7f30ba14626f',rows=2577412),
         generator=dict(version=1,seed='toronto-parking-v1',deckSize=DECK_SIZE,bands=BANDS,pylonSlots={t:{str(k):v for k,v in d.items()} for t,d in PYLON_SLOTS.items()}),
         cards=cards)
json.dump(out,open(S+'deck-candidate.json','w'),indent=None,separators=(',',':'))

# ---- report
p_conf={i+1:p['conflicts'] for i,p in enumerate(deck)}
print('\n n  tier          mv cluster w pcs cars trk br ofm conf  board')
for c in cards:
    cars=sum(1 for q in c['pieces'] if q['kind']=='car'); trk=sum(1 for q in c['pieces'] if q['kind']=='truck')
    print(f"{c['n']:3d} {c['tier']:13s} {c['moves']:2d} {c['cluster']:7d} {c['needs']['pylon']} {len(c['pieces']):3d} {cars:4d} {trk:3d} {c['meta']['branching']:2d} {c['meta']['optimalFirstMoves']:3d} {p_conf[c['n']]:4d}  {c['board']}")
# caps proof
worst={}
for c in cards:
    cnt={}
    for q in c['pieces']:
        if q['kind'] in('car','truck'): cnt[(q['kind'],q['colour'])]=cnt.get((q['kind'],q['colour']),0)+1
    for k,v in cnt.items(): worst[k]=max(worst.get(k,0),v)
print('\nmax per (kind,colour) across deck:',worst)
import itertools
fps=[footprint(*parse(c['board'])) for c in cards]
print('max pairwise similarity: %.2f'%max(similarity(a,b) for a,b in itertools.combinations(fps,2)))
print('pylon cards per tier:',{t:sum(1 for c in cards if c['tier']==t and c['needs']['pylon']) for t in TIERS},' 1p:',sum(1 for c in cards if c['needs']['pylon']==1),' 2p:',sum(1 for c in cards if c['needs']['pylon']==2))
print('band populations post-filter:',{t:sum(v for (m,w),v in hist.items() if BANDS[t][0]<=m<=BANDS[t][1]) for t in TIERS})
print('band populations with walls :',{t:sum(v for (m,w),v in hist.items() if BANDS[t][0]<=m<=BANDS[t][1] and w>0) for t in TIERS})
print('pieces_total range per tier:',{t:(min(len(c['pieces']) for c in cards if c['tier']==t),max(len(c['pieces']) for c in cards if c['tier']==t)) for t in TIERS})
print('size of deck-candidate.json:',len(open(S+'deck-candidate.json').read()),'bytes')
