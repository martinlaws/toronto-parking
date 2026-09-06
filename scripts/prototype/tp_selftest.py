import sys, time
from tp_core import parse, unparse, solve, branching
import os
S=os.path.dirname(os.path.abspath(__file__))+'/'   # rush.txt and the outputs live next to these scripts
FIXTURE=S+'../../tests/fixtures/rush1000.txt'   # the 1,000-row fixture lives with the TS tests; one copy only
rows=[l.split() for l in open(FIXTURE)][:int(sys.argv[1])]
# plus the last 40 rows of rush.txt (trivial puzzles) and a sample from the middle
import subprocess
tail=subprocess.run(['tail','-40',S+'rush.txt'],capture_output=True,text=True).stdout.split('\n')
rows+= [l.split() for l in tail if l.strip()]
mid=subprocess.run(['sed','-n','1300000,1300030p',S+'rush.txt'],capture_output=True,text=True).stdout.split('\n')
rows+= [l.split() for l in mid if l.strip()]
t=time.time(); bad=0
for m,b,c in rows:
    p,w=parse(b); assert unparse(p,w)==b, b
    r=solve(b)
    if r['moves']!=int(m) or r['cluster']!=int(c):
        bad+=1; print('MISMATCH',m,c,b,r['moves'],r['cluster'])
print(len(rows),'rows checked,',bad,'mismatches, %.1fs'%(time.time()-t))
