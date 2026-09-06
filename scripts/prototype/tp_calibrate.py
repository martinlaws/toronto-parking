from tp_core import solve, branching
import os
S=os.path.dirname(os.path.abspath(__file__))+'/'   # rush.txt and the outputs live next to these scripts
for fn in ('princeton-jams-36.txt','fogleman-forty-36.txt'):
    print('==',fn)
    rows=[l.split() for l in open(S+fn) if l.strip()]
    res=[]
    for name,b in rows:
        b=b.replace('.','o')
        r=solve(b); res.append((name,r['moves'],r['cluster'],branching(b),r['optimal_first_moves']))
    for t in range(4):
        grp=res[t*10:(t+1)*10]
        mv=[x[1] for x in grp]
        print(f' tier{t+1} moves={mv} min={min(mv)} max={max(mv)} med={sorted(mv)[5]}  cluster med={sorted(x[2] for x in grp)[5]} branching={[x[3] for x in grp]}')
