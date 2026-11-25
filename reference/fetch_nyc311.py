"""Fetch a frozen NYC 311 pilot CSV and write a SHA-256 source manifest.
No data will be invented or marked complete if the API cannot be reached.
"""
import argparse
import csv
import hashlib
import json
import os
import sys
import time
from pathlib import Path
from datetime import datetime, timezone
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

DATASET_URL="https://data.cityofnewyork.us/resource/erm2-nwe9.json"
FIELDS=["unique_key","created_date","closed_date","agency","complaint_type","borough","status"]
WHERE=("created_date >= '2025-01-01T00:00:00' AND "
       "created_date < '2025-04-01T00:00:00' AND agency = 'DSNY' "
       "AND complaint_type in ('Graffiti', 'Missed Collection (All Materials)')")

def download(output:Path,max_records:int|None=None):
    if max_records is not None and max_records<=0:raise ValueError("--max-records must be positive")
    output.parent.mkdir(parents=True,exist_ok=True)
    temporary=output.with_suffix(".partial.csv")
    total=0
    extraction_started=datetime.now(timezone.utc).isoformat()
    try:
        with temporary.open("w",encoding="utf-8",newline="") as f:
            writer=csv.DictWriter(f,fieldnames=FIELDS)
            writer.writeheader()
            while True:
                limit=10000 if max_records is None else min(10000,max_records-total)
                if limit<=0:break
                params={"$select":",".join(FIELDS),"$where":WHERE,"$order":"unique_key ASC",
                        "$limit":limit,"$offset":total}
                request=Request(DATASET_URL+"?"+urlencode(params),
                    headers={"User-Agent":"MABRIG-GovFrictionLab/0.2",
                             "Accept":"application/json"})
                print(f"Downloading page offset={total} limit={limit}...",flush=True)
                with urlopen(request,timeout=70) as response: records=json.load(response)
                if not isinstance(records,list):raise RuntimeError("Expected JSON array")
                for record in records:writer.writerow({col:record.get(col,"") for col in FIELDS})
                total+=len(records)
                if len(records)<limit:break
                time.sleep(.3)
        if total==0:raise RuntimeError("No records returned; check current source categories")
        os.replace(temporary,output)
    except (RuntimeError,ValueError,HTTPError,URLError) as error:
        print("DOWNLOAD FAILED; do not use any partial file for research:",error,file=sys.stderr)
        try:temporary.unlink(missing_ok=True)
        finally:raise SystemExit(2)
    sha=hashlib.sha256(output.read_bytes()).hexdigest()
    manifest={"source":"NYC 311 from 2020 to present",
        "source_url":"https://data.cityofnewyork.us/Social-Services/311-Service-Requests/erm2-nwe9",
        "dataset_id":"erm2-nwe9","filter":WHERE,"order":"unique_key ASC",
        "rows":total,"sha256":sha,"extraction_started_utc":extraction_started,
        "extraction_finished_utc":datetime.now(timezone.utc).isoformat(),"truncated_for_exploration":max_records is not None}
    output.with_suffix(".source.json").write_text(json.dumps(manifest,indent=2),encoding="utf-8")
    print(json.dumps(manifest,indent=2))

if __name__=="__main__":
    cli=argparse.ArgumentParser(description=__doc__)
    cli.add_argument("--output",type=Path,default=Path("data/nyc311_dsny_2025_q1.csv"))
    cli.add_argument("--max-records",type=int,help="Exploratory subset only; not research-complete")
    opts=cli.parse_args()
    download(opts.output,opts.max_records)
