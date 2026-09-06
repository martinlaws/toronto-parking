"""Pass 1: stream rush.txt once. Post-filter histogram (moves x walls), cluster
percentiles per move count, rejection reasons, and a deterministic hash-sampled
candidate pool: the K smallest sha1(SEED:board) rows per (moves, walls) bucket."""
import hashlib, json, time, collections, statistics
import os
S=os.path.dirname(os.path.abspath(__file__))+'/'   # rush.txt and the outputs live next to these scripts
SEED='toronto-parking-v1'; K=300
hist=collections.Counter(); reject=collections.Counter()
clusters=collections.defaultdict(list)
pool=collections.defaultdict(list)
t=time.time(); tot=0
with open(S+'rush.txt') as f:
    for line in f:
        m,b,c=line.split(); m=int(m); c=int(c); tot+=1
        walls=b.count('x')
        cnt=collections.Counter(ch for ch in b if ch not in 'ox')
        cars=sum(1 for k,v in cnt.items() if v==2 and k!='A')
        trucks=sum(1 for v in cnt.values() if v==3)
        if trucks>4: reject['trucks>4']+=1; continue
        if cars>12: reject['cars>12']+=1; continue
        if walls>2: reject['walls>2']+=1; continue
        # wall in the exit row to the right of the hero
        hero=b.index('A'); row=b[12:18]
        if 'x' in row[hero-12+2:]: reject['wall right of hero']+=1; continue
        hist[(m,walls)]+=1; clusters[m].append(c)
        h=hashlib.sha1(f'{SEED}:{b}'.encode()).hexdigest()
        bucket=pool[(m,walls)]
        bucket.append((h,b,c,cars,trucks))
        if len(bucket)>2*K:
            bucket.sort(); del bucket[K:]
for k in pool:
    pool[k].sort(); del pool[k][K:]
print('rows',tot,'pass',sum(hist.values()),'reject',dict(reject),'%.0fs'%(time.time()-t))
out={'hist':{f'{m},{w}':v for (m,w),v in hist.items()},
     'cluster_pct':{m:[int(statistics.quantiles(v,n=20)[i]) if len(v)>20 else v[0] for i in (0,9,18)] for m,v in clusters.items()},
     'pool':{f'{m},{w}':v for (m,w),v in pool.items()}}
json.dump(out,open(S+'tp_pass1.json','w'))
print('moves  total   w0     w1     w2   cluster p5/p50/p95')
for m in range(1,61):
    row=[hist[(m,w)] for w in (0,1,2)]
    if sum(row): print(f'{m:5d} {sum(row):7d} {row[0]:6d} {row[1]:6d} {row[2]:6d}   {out["cluster_pct"].get(m)}')
