// Temporary PR-only A/B: does Chrome's PaintHolding defer the first live frame?
// Remove with its workflow after reviewing results. The CDN site is never changed.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import {createRequire} from 'node:module';
import lighthouse from '/tmp/milovi-lighthouse/node_modules/lighthouse/core/index.js';

const require = createRequire(import.meta.url);
const chromeLauncher = require('/tmp/milovi-lighthouse/node_modules/chrome-launcher');
const puppeteer = require('/tmp/milovi-lighthouse/node_modules/puppeteer-core');
const URL = 'https://milovicake.ru/prigorody/gatchina/';
const RELEASE = 'e4cc47a5478a2cd1cc29096f51e310633919f3e2';
const OUT = '/tmp/milovi-lcp-paint-holding';
const ORDERS = Array.from({length: 8}, (_,i) => i%2 ? ['paint-holding-off','original']
  : ['original','paint-holding-off']);
const round = n => Number.isFinite(n) ? Math.round(n*10)/10 : null;
const median = xs => {const s=[...xs].sort((a,b)=>a-b);
  return (s[Math.floor((s.length-1)/2)]+s[Math.floor(s.length/2)])/2;};
const notice = (title,value) => console.log(`::notice title=${title}::${JSON.stringify(value)}`);

function instrumentDocument() {
  const lab = window.__lcpFrameLab = {initial: {ms:performance.now(),
    visibility:document.visibilityState, focused:document.hasFocus()},
  stateChanges:[], milestones:[], raf:[], paint:null};
  document.addEventListener('visibilitychange', () => lab.stateChanges.push({
    ms:Math.round(performance.now()), visibility:document.visibilityState,
    focused:document.hasFocus()}));
  const original = window.requestAnimationFrame;
  window.requestAnimationFrame = function(callback) {
    const requested=performance.now();
    return original.call(window,function(timestamp) {
      if(lab.raf.length<50) lab.raf.push({requested:Math.round(requested),
        fired:Math.round(performance.now()), timestamp:Math.round(timestamp),
        visibility:document.visibilityState});
      return callback(timestamp);
    });
  };
  try {
    new PerformanceObserver(list => {
      for(const entry of list.getEntries()) if(entry.name==='first-contentful-paint')
        lab.paint={ms:Math.round(entry.startTime),visibility:document.visibilityState,
          focused:document.hasFocus()};
    }).observe({type:'paint',buffered:true});
  } catch(error) {lab.paintError=String(error);}
  function stamp(kind) {
    const image=document.querySelector('.hero-photo-bg img');
    lab.milestones.push({kind,ms:Math.round(performance.now()),
      visibility:document.visibilityState, focused:document.hasFocus(),
      currentSrc:image?.currentSrc || '', complete:image?.complete,
      naturalWidth:image?.naturalWidth, fonts:document.fonts?.status});
  }
  document.addEventListener('DOMContentLoaded',()=>stamp('domcontentloaded'),{once:true});
  window.addEventListener('load',()=>stamp('load'),{once:true});
}

function traceSummary(trace,fcp,ready) {
  const events=trace.traceEvents || [];
  const nav=events.find(e=>e.name==='navigationStart' &&
    e.args?.data?.isOutermostMainFrame && e.args.data.documentLoaderURL===URL);
  if(!nav) throw Error('Missing pinned outermost navigation');
  const first=events.find(e=>e.name==='firstContentfulPaint' && e.ts>nav.ts &&
    e.args?.data?.navigationId===nav.args.data.navigationId);
  if(!first || Math.abs((first.ts-nav.ts)/1000-fcp)>150)
    throw Error('Raw Lighthouse FCP differs from trace');
  const from=nav.ts+ready*1000;
  const interval=events.filter(e=>e.ts>=from && e.ts<=first.ts);
  const draws=events.filter(e=>e.name==='DrawFrame' && e.ts>=nav.ts && e.ts<=first.ts)
    .map(e=>e.ts).sort((a,b)=>a-b);
  const gaps=[nav.ts,...draws,first.ts].slice(1).map((ts,i,_,all)=>
    i===0 ? ts-nav.ts : ts-[nav.ts,...draws][i]);
  const mainFrames=interval.filter(e=>e.name==='BeginMainThreadFrame' &&
    e.pid===nav.pid && e.tid===nav.tid);
  return {traceFcp:round((first.ts-nav.ts)/1000),
    lastDraws:draws.slice(-3).map(ts=>round((ts-nav.ts)/1000)),
    longestNoDraw:round(Math.max(0,...gaps)/1000),
    mainFrameAfterReady:mainFrames.length,
    frameRequestsAfterReady:interval.filter(e=>e.name==='RequestMainThreadFrame'
      && e.pid===nav.pid).length,
    dropped:interval.filter(e=>e.name==='DroppedFrame' && e.pid===nav.pid).length,
    rasterBusy:round(interval.filter(e=>e.name==='RasterTask' && e.pid===nav.pid)
      .reduce((sum,e)=>sum+(e.dur||0),0)/1000)};
}

function makeChromeFlags(arm) {
  // Preserve ALL chrome-launcher defaults in both arms; vary one feature only.
  const defaults=chromeLauncher.Launcher.defaultFlags();
  const disabled=defaults.filter(flag=>flag.startsWith('--disable-features='));
  if(disabled.length!==1 || disabled[0].includes('PaintHolding'))
    throw Error('Unexpected launcher feature flags; fail closed');
  return [...defaults.map(flag=>arm==='paint-holding-off' && flag===disabled[0]
    ? flag+',PaintHolding' : flag), '--disable-setuid-sandbox',
    '--headless=new','--no-sandbox','--disable-dev-shm-usage'];
}

async function trial(block,arm) {
  const chrome=await chromeLauncher.launch({chromePath:process.env.CHROME_PATH,
    chromeFlags:makeChromeFlags(arm),ignoreDefaultFlags:true,logLevel:'error'});
  let browser;
  try {
    browser=await puppeteer.connect({browserURL:`http://127.0.0.1:${chrome.port}`,
      defaultViewport:null});
    const page=await browser.newPage();
    await page.evaluateOnNewDocument(instrumentDocument);
    const flags={logLevel:'error',onlyCategories:['performance','accessibility',
      'best-practices','seo'], formFactor:'mobile',throttlingMethod:'simulate',
      throttling:{rttMs:150,throughputKbps:1638.4,cpuSlowdownMultiplier:4},
      screenEmulation:{mobile:true,width:412,height:915,deviceScaleFactor:1.75,
        disabled:false},maxWaitForLoad:45000};
    const result=await lighthouse(URL,flags,undefined,page);
    if(!result?.lhr || !result.artifacts?.Trace) throw Error('Missing LHR/trace');
    const lhr=result.lhr;
    const m=lhr.audits.metrics?.details?.items?.[0] || {};
    const req=lhr.audits['network-requests']?.details?.items || [];
    const got=needle=>req.filter(r=>r.url.includes(needle) && r.statusCode===200);
    const finish=needle=>Math.max(0,...got(needle).map(r=>r.networkEndTime || 0));
    const hero=lhr.audits['largest-contentful-paint-element']?.details?.items?.[0]
      ?.items?.[0]?.node?.selector || null;
    const lab=await page.evaluate(()=>window.__lcpFrameLab || null);
    const browserVersion=lhr.userAgent?.match(/HeadlessChrome\/([\d.]+)/)?.[1];
    const resources={css:round(finish('/css/style.css')),
      avif:round(finish('/img/head_mobile.avif')),
      webp:round(finish('/img/head_mobile.webp')),
      main:round(finish('/js/main.js')),fontCss:got('fonts.googleapis.com').length,
      fontFiles:got('fonts.gstatic.com').length,
      lastFont:round(finish('fonts.gstatic.com'))};
    const rawFcp=round(m.observedFirstContentfulPaint);
    const row={block,arm,browser:browserVersion,rawFcp,
      rawLcp:round(m.observedLargestContentfulPaint),
      simLcp:round(lhr.audits['largest-contentful-paint']?.numericValue),
      cls:round(lhr.audits['cumulative-layout-shift']?.numericValue),
      hero,resources,lab,
      frame:traceSummary(result.artifacts.Trace,rawFcp,
        Math.max(resources.css,resources.avif,resources.lastFont)),
      traceEvents:result.artifacts.Trace.traceEvents?.length || 0,
      disabledFeatures:chrome.flags.filter(x=>x.startsWith('--disable-features='))};
    const settings=lhr.configSettings;
    if(lhr.finalUrl!==URL || lhr.lighthouseVersion!=='12.6.1' ||
      settings.throttlingMethod!=='simulate' || settings.throttling.rttMs!==150 ||
      settings.throttling.throughputKbps!==1638.4 ||
      settings.throttling.cpuSlowdownMultiplier!==4 ||
      settings.screenEmulation.width!==412 || settings.screenEmulation.height!==915 ||
      !browserVersion?.startsWith('155.') || !rawFcp || !row.rawLcp || !row.simLcp ||
      !hero || !resources.css || !resources.avif || !resources.webp ||
      !resources.main || !resources.fontCss || !resources.fontFiles ||
      !lab?.milestones?.some(x=>x.kind==='domcontentloaded' &&
        x.currentSrc.endsWith('/img/head_mobile.avif') && x.complete) ||
      !lab?.milestones?.some(x=>x.kind==='load' &&
        x.currentSrc.endsWith('/img/head_mobile.avif')) ||
      !lab.paint || row.traceEvents<1000 || lhr.runtimeError ||
      row.disabledFeatures.length!==1 ||
      row.disabledFeatures[0].includes('PaintHolding')!==
        (arm==='paint-holding-off')) throw Error('Invalid pinned trial: '+JSON.stringify(row));
    const prefix=path.join(OUT,`${String(block).padStart(2,'0')}-${arm}`);
    fs.writeFileSync(prefix+'.lhr.json',JSON.stringify(lhr));
    fs.writeFileSync(prefix+'.trace.json.gz',zlib.gzipSync(
      JSON.stringify(result.artifacts.Trace),{level:3}));
    return row;
  } finally {
    await browser?.disconnect().catch(()=>{});
    await chrome.kill();
  }
}

async function main() {
  if(!process.env.CHROME_PATH || !fs.existsSync(process.env.CHROME_PATH))
    throw Error('Pinned Chrome 155 missing');
  fs.mkdirSync(OUT,{recursive:true});
  const rows=[];
  for(let i=0;i<ORDERS.length;i++) {
    const pair=[];
    for(const arm of ORDERS[i]) pair.push(await trial(i+1,arm));
    rows.push(...pair);
    notice(`paint-pair-${i+1}`,pair.map(r=>({arm:r.arm,rawFcp:r.rawFcp,
      rawLcp:r.rawLcp,simLcp:r.simLcp,hero:r.hero,resources:r.resources,
      visibility:r.lab.milestones.map(x=>[x.kind,x.ms,x.visibility,x.focused]),
      raf:r.lab.raf.slice(0,4),frame:r.frame})));
  }
  if(rows.length!==16 || new Set(rows.map(r=>r.browser)).size!==1)
    throw Error('Missing pair or browser drift');
  const armRows=arm=>rows.filter(r=>r.arm===arm);
  const result={release:RELEASE,lighthouse:'12.6.1',browser:rows[0].browser,
    label:'laboratory CDP control only; NOT field LCP, a deployment or a site patch',
    groups:Object.fromEntries(ORDERS[0].map(arm=>[arm,{
      rawMedian:median(armRows(arm).map(r=>r.rawFcp)),
      simMedian:round(median(armRows(arm).map(r=>r.simLcp))),
      rawSlow:armRows(arm).filter(r=>r.rawFcp>=750).length,
      rawOver2500:armRows(arm).filter(r=>r.rawFcp>2500).length,
      heroCandidate:armRows(arm).filter(r=>r.hero.includes('hero-photo-bg')).length,
      hiddenOnLoad:armRows(arm).filter(r=>r.lab.milestones.find(
        x=>x.kind==='load')?.visibility!=='visible').length}])),
    pairedDelta:ORDERS.map((_,i)=>round(rows.find(r=>r.block===i+1 &&
      r.arm==='paint-holding-off').rawFcp-rows.find(r=>r.block===i+1 &&
      r.arm==='original').rawFcp)),rows};
  fs.writeFileSync(path.join(OUT,'summary.json'),JSON.stringify(result,null,2));
  notice('paint-control-summary',{release:RELEASE,browser:result.browser,
    groups:result.groups,pairedDelta:result.pairedDelta,
    pairedMedian:round(median(result.pairedDelta))});
}
main().catch(err=>{console.error(err);process.exitCode=1;});
