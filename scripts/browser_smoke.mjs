/* End-to-end browser smoke for local-first R/content/visualization controls.
   webR runtime itself is not invoked; it requires an external WASM download. */
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage({acceptDownloads:true,viewport:{width:1280,height:850}});
const errors=[];
page.on('pageerror',err=>errors.push(String(err)));
try{
 await page.goto('http://127.0.0.1:8788/web/',{waitUntil:'domcontentloaded',timeout:30000});
 await page.locator('#demo').click();
 await page.waitForFunction(()=>!document.querySelector('#rlab').hidden,{timeout:30000});
 assert.equal(await page.locator('#textcolumn').inputValue(),'public_summary');
 assert.equal(await page.locator('#rx').inputValue(),'synthetic_wait_days');
 const scriptPromise=page.waitForEvent('download');
 await page.locator('#rscript').click();
 const script=await scriptPromise;
 assert.equal(script.suggestedFilename(),'govfriction-base-r-analysis.R');
 assert.match(await page.locator('#rstatus').textContent(),/Downloaded R script/);
 await page.locator('#textthemes').fill('Communication: no feedback, agency update\nWaiting: delayed response, missed pickup');
 await page.locator('#textanalyze').click();
 await page.waitForFunction(()=>!document.querySelector('#textresults').hidden,{timeout:30000});
 assert.ok((await page.locator('#textterms tr').count())>0);
 assert.ok((await page.locator('#textthemesoutput tr').count())===2);
 await page.locator('#vizsource').selectOption('content');
 await page.locator('#viztype').selectOption('bar');
 await page.locator('#vizx').selectOption('term');
 await page.locator('#vizy').selectOption('count');
 await page.locator('#vizdraw').click();
 assert.equal(await page.locator('#vizcanvas svg').count(),1);
 const svgPromise=page.waitForEvent('download');
 await page.locator('#vizsvg').click();
 assert.equal((await svgPromise).suggestedFilename(),'govfriction-research-chart.svg');
 await page.locator('#analyze').click();
 await page.waitForFunction(()=>!document.querySelector('#results').hidden,{timeout:30000});
 assert.ok(await page.locator('#comparative-observatory table').count()===2);
 assert.match(await page.locator('#comparative-observatory').textContent(),/SYNTHETIC/);
 const figPromise=page.waitForEvent('download');
 await page.getByRole('button',{name:'Publication figure SVG'}).click();
 assert.equal((await figPromise).suggestedFilename(),'govfriction-comparative.svg');
 await page.getByRole('button',{name:'Run common-cohort sensitivity'}).click();
 assert.match(await page.locator('#uncertainty-lab').textContent(),/Common eligible:/);
 await page.getByRole('button',{name:'Run composite day bootstrap'}).click();
 assert.match(await page.locator('#uncertainty-lab').textContent(),/499 paired creation-day/);
 const bootPromise=page.waitForEvent('download');
 await page.getByRole('button',{name:'Bootstrap JSON'}).click();
 assert.equal((await bootPromise).suggestedFilename(),'govfriction-composite-bootstrap.json');
 await page.locator('#runcpu').click();
 await page.waitForFunction(()=>!document.querySelector('#cpuoutput').hidden,{timeout:30000});
 assert.ok((await page.locator('#cpugroups tr').count())>0);
 await page.locator('#rlab details summary').click();
 await page.locator('#rnewname').fill('wait_plus_one');
 await page.locator('#rleft').selectOption('synthetic_wait_days');
 await page.locator('#rright').selectOption('__constant__');
 await page.locator('#rconstant').fill('1');
 await page.locator('#rcreate').click();
 assert.match(await page.locator('#rcreatemessage').textContent(),/Created wait_plus_one/);
 assert.ok(await page.locator('#results').isHidden(),'Derived data should invalidate old analysis');
 assert.ok(errors.length===0,'Browser JavaScript errors: '+errors.join('; '));
 console.log('PASS: browser loads, synthetic data, R script export, content coding, SVG chart, CPU lab and variable invalidation');
}finally{await browser.close();}

// Paper evaluation: separate core benchmark and independent Python parity.
await import('./evaluate_bfs_dai.mjs');
