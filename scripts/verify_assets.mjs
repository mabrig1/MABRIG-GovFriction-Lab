import fs from 'node:fs';
import {strict as assert} from 'node:assert';
const expected=['web/index.html','web/app.mjs','web/engine.mjs','web/styles.css','wrangler.toml','reference/GovFriction_Kaggle_Reference.ipynb','docs/METHODS.md'];
for(const file of expected)assert.ok(fs.statSync(file).size>0,'Missing or empty: '+file);
const html=fs.readFileSync('web/index.html','utf8');
for(const id of ['file','demo','mapping','analyze','results','kpis','audit','tablebody','bars','filterService','comparefile','compareout','reportjson','resultcsv'])assert.ok(html.includes('id="'+id+'"'),'Missing DOM element: '+id);
for(const asset of ['./app.mjs','./styles.css'])assert.ok(html.includes(asset),'Missing linked static asset: '+asset);
JSON.parse(fs.readFileSync('reference/GovFriction_Kaggle_Reference.ipynb','utf8'));
console.log('PASS: static assets, user controls, notebook JSON and deploy configuration');