"""Compile research notebooks and smoke-run predictive Kaggle reference on synthetic rows.

No private data or live NYC API required. Assumes numpy, pandas, scikit-learn installed.
"""
import csv
import json
import os
import tempfile
from datetime import datetime, timedelta
from pathlib import Path

ROOT=Path(__file__).resolve().parent.parent
REFERENCE=ROOT/"reference/GovFriction_Predictive_Kaggle.ipynb"
for path in [ROOT/"reference/GovFriction_Kaggle_Reference.ipynb",REFERENCE]:
    nb=json.loads(path.read_text())
    for n,cell in enumerate(nb["cells"],1):
        if cell["cell_type"]=="code":
            compile("".join(cell["source"]),str(path)+f":cell-{n}","exec")
    print("PASS notebook Python syntax:",path.name)

nb=json.loads(REFERENCE.read_text())
with tempfile.TemporaryDirectory() as folder:
    os.chdir(folder)
    Path("data").mkdir()
    input_file=Path("data/fixture_predictive.csv")
    with input_file.open("w",newline="",encoding="utf-8") as fh:
        writer=csv.DictWriter(fh,fieldnames=["unique_key","created_date","closed_date","agency","complaint_type","borough","status"])
        writer.writeheader()
        locations=["BRONX","BROOKLYN","MANHATTAN","QUEENS","STATEN ISLAND"]
        for i in range(900):
            created=datetime(2025,1,1)+timedelta(days=i%90,hours=i%24)
            service="Graffiti" if i%3==0 else "Missed Collection (All Materials)"
            borough=locations[i%5]
            late=(i%11==0 or i%7==0 or (borough=="QUEENS" and i%3!=1))
            closed=None if late and i%11==0 else created+timedelta(days=(55 if late else 3+i%18))
            writer.writerow({"unique_key":f"R{i}","created_date":created.isoformat(),
               "closed_date":closed.isoformat() if closed else "","agency":"DSNY",
               "complaint_type":service,"borough":borough,"status":"Open" if closed is None else "Closed"})
    context={"__name__":"__main__","display":lambda obj:print(obj.to_string(index=False))}
    for n,cell in enumerate(nb["cells"],1):
        if cell["cell_type"]=="code":
            exec(compile("".join(cell["source"]),f"notebook:cell-{n}","exec"),context)
    rows=list(csv.DictReader(open("prediction_kaggle_metrics.csv",newline="",encoding="utf-8")))
    assert len(rows)==3 and all(int(r["holdout_n"])>=20 for r in rows),rows
    assert Path("prediction_kaggle_manifest.json").is_file()
    assert Path("prediction_kaggle_calibration.csv").is_file()
    print("PASS independent scikit-learn notebook execution on 900 synthetic requests")
