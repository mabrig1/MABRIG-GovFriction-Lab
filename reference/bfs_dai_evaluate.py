"""Independent standard-library BFS-DAI v0.1 reference; no JavaScript imports.
Input CSV must use official NYC column names. Output aggregated JSON only.
"""
import csv, hashlib, json, math, re, sys
from collections import defaultdict
from datetime import datetime
from pathlib import Path

REGIONS={"BRONX","BROOKLYN","MANHATTAN","QUEENS","STATEN ISLAND"}
SERVICES={"Graffiti","Missed Collection (All Materials)"}
REQUIRED=("unique_key","created_date","closed_date","agency","complaint_type","borough")
HORIZONS=(15,30,45,60,90)
WEIGHTS=(0,.25,.5,.7,.75,1)
BAD=object()

def date(s):
    s=s.strip()
    if not s:return None
    try:
        if re.fullmatch(r"\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)?",s):
            # v0.1 drops fractional seconds and treats wall-clock times as naive.
            return datetime.fromisoformat(s).replace(microsecond=0)
        m=re.fullmatch(r"(\d{1,2})/(\d{1,2})/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?)?",s,re.I)
        if m:
            mo,d,y,h,mi,sec,ampm=m.groups()
            hour=int(h or 0)
            if ampm:hour=hour%12+(12 if ampm.upper()=="PM" else 0)
            return datetime(int(y),int(mo),int(d),hour,int(mi or 0),int(sec or 0))
    except ValueError:pass
    return BAD

def read(path):
    raw=Path(path).read_bytes()
    # CSV parser dialect is standard; unusual malformed quoting fails closed.
    import io
    reader=csv.reader(io.StringIO(raw.decode("utf-8-sig"),newline=""),strict=True)
    headers=[h.strip() for h in next(reader)]
    if len(set(headers))!=len(headers) or not set(REQUIRED)<=set(headers):raise ValueError("Invalid or missing columns")
    rows=[];malformed=0
    for cells in reader:
        if not any(cells):continue
        if len(cells)!=len(headers):malformed+=1;continue
        rows.append(dict(zip(headers,cells)))
    return rows,malformed,hashlib.sha256(raw).hexdigest()

def cohort(rows,h,snapshot):
    counts=dict.fromkeys(("input","scopeExcluded","duplicate","invalidCreated","invalidClosed","invalidLocationService","immature","eligible","statusClosedWithoutDate"),0)
    counts["input"]=len(rows)
    start=datetime(2025,1,1);end=datetime(2025,4,1)
    seen=set();groups=defaultdict(list)
    for row in rows:
        v=lambda key: row.get(key,"").strip()
        key=v("unique_key");created=date(v("created_date"));service=v("complaint_type");borough=v("borough").upper()
        if not key or created is BAD or created is None:counts["invalidCreated"]+=1;continue
        if key in seen:counts["duplicate"]+=1;continue
        seen.add(key)
        if not start<=created<end or v("agency").upper()!="DSNY" or service not in SERVICES:counts["scopeExcluded"]+=1;continue
        if borough not in REGIONS:counts["invalidLocationService"]+=1;continue
        closed=date(v("closed_date"))
        if closed is BAD or (closed is not None and closed<created):counts["invalidClosed"]+=1;continue
        if created>snapshot:counts["scopeExcluded"]+=1;continue
        if (snapshot-created).total_seconds()/86400<h:counts["immature"]+=1;continue
        if v("status").lower()=="closed" and closed is None:counts["statusClosedWithoutDate"]+=1
        t=math.inf if closed is None or closed>snapshot else (closed-created).total_seconds()/86400
        groups[service,borough].append(t)
        counts["eligible"]+=1
    return counts,groups

def summarize(times,h):
    n=len(times);p=sum(t>h for t in times)/n;d=sum(min(t,h)/h for t in times)/n
    return p,d,(p+d)/2

def evaluate(path,snapshot):
    rows,malformed,sha=read(path)
    primary=None;results=[]
    for h in HORIZONS:
        counts,groups=cohort(rows,h,snapshot)
        if h==30:primary=counts
        for w in WEIGHTS:
            cell=[]
            for (s,b),times in sorted(groups.items()):
                peer=[t for (ps,pb),items in groups.items() if ps==s and pb!=b for t in items]
                n=len(times);pn=len(peer);p,d,f=summarize(times,h)
                scoreable=n>=10 and pn>=10
                pf=summarize(peer,h)[2] if scoreable else None
                a=abs(f-pf) if scoreable else None
                cell.append(dict(service=s,borough=b,horizonDays=h,frictionWeight=w,n=n,peerN=pn,eligibleTotal=counts["eligible"],nonclosure=p if n>=10 else None,delayBurden=d if n>=10 else None,friction=f if n>=10 else None,peerFriction=pf,signedDifference=f-pf if scoreable else None,asymmetry=a,score=100*(w*f+(1-w)*a) if scoreable else None))
            for r in cell:
                r["rankWithinService"]=None if r["score"] is None else 1+sum(x["service"]==r["service"] and x["score"] is not None and x["score"]>r["score"]+1e-10 for x in cell)
            results.extend(cell)
    return dict(source_sha256=sha,parsed_rows=len(rows),malformed_csv_rows=malformed,primary_counts=primary,rows=results)

if __name__=="__main__":
    if len(sys.argv)!=3:raise SystemExit("Usage: python reference/bfs_dai_evaluate.py CSV YYYY-MM-DD")
    print(json.dumps(evaluate(sys.argv[1],datetime.strptime(sys.argv[2],"%Y-%m-%d")),allow_nan=False))
