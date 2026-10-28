// Temporary PR-only control: Lighthouse vs identical Chrome with/without its
// exact CDP trace categories. No production code, synthetic page or field data.
// Remove this file and the temporary workflow after the paired readout.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import {createRequire} from 'node:module';
import lighthouse from '/tmp/milovi-lighthouse/node_modules/lighthouse/core/index.js';
import Trace from '/tmp/milovi-lighthouse/node_modules/lighthouse/core/gather/gatherers/trace.js';

const require=createRequire(import.meta.url);
const chromeLauncher=require('/tmp/milovi-lighthouse/node_modules/chrome-launcher');
const puppeteer=require('/tmp/milovi-lighthouse/node_modules/puppeteer-core');
const URL='https://milovicake.ru/prigorody/gatchina/';
const RELEASE='e4cc47a5478a2cd1cc29096f51e310633919f3e2';
const OUT='/tmp/milovi-lcp-mode-control';
const ORDERS=[['lighthouse','direct-traced','direct-plain'],
  ['direct-traced','direct-plain','lighthouse'],
  ['direct-plain','lighthouse','direct-traced'],
  ['lighthouse','direct-plain','direct-traced'],
  ['direct-traced','lighthouse','direct-plain'],
  ['direct-plain','direct-traced','lighthouse'],
  ['lighthouse','direct-traced','direct-plain'],
  ['direct-traced','direct-plain','lighthouse']];
const round=n=>Number.isFinite(n)?Math.round(n*10)/10:null;
const median=xs=>{const s=[...xs].sort((a,b)=>a-b);
  return (s[Math.floor((s.length-1)/2)]+s[Math.floor(s.length/2)])/2;};
const notice=(title,value)=>console.log(`::notice title=${title}::${JSON.stringify(value)}`);

function instrumentDocument(){
  const lab=window.__lcpFrameLab={initial:{visibility:document.visibilityState,
    focused:document.hasFocus()}, stateChanges:[],milestones:[],raf:[],paint:null};
  document.addEventListener('visibilitychange',()=>lab.stateChanges.push({
    ms:Math.round(performance.now()),visibility:document.visibilityState,
    focused:document.hasFocus()}));
  const original=window.requestAnimationFrame;
  window.requestAnimationFrame=function(callback){
    const requested=performance.now();
    return original.call(window,function(timestamp){
      if(lab.raf.length<50)lab.raf.push({requested:Math.round(requested),
        fired:Math.round(performance.now()),visibility:document.visibilityState});
      return callback(timestamp);
    });
  };
  new PerformanceObserver(list=>{
    for(const entry of list.getEntries())if(entry.name==='first-contentful-paint')
      lab.paint={ms:Math.round(entry.startTime),visibility:document.visibilityState,
        focused:document.hasFocus()};
  }).observe({type:'paint',buffered:true});
  const stamp=kind=>{const image=document.querySelector('.hero-photo-bg img');
    lab.milestones.push({kind,ms:Math.round(performance.now()),
      visibility:document.visibilityState,focused:document.hasFocus(),
      currentSrc:image?.currentSrc||'',complete:image?.complete,
      naturalWidth:image?.naturalWidth,fonts:document.fonts?.status});};
  document.addEventListener('DOMContentLoaded',()=>stamp('domcontentloaded'),{once:true});
  window.addEventListener('load',()=>stamp('load'),{once:true});
}

function frameSummary(trace,rawFcp,ready){
  const events=trace.traceEvents || [];
  const nav=events.find(e=>e.name==='navigationStart' &&
    e.args?.data?.isOutermostMainFrame && e.args.data.documentLoaderURL===URL);
  if(!nav)throw Error('Missing exact outermost navigation');
  const fcp=events.find(e=>e.name==='firstContentfulPaint' && e.ts>nav.ts &&
    e.args?.data?.navigationId===nav.args.data.navigationId);
  if(!fcp||Math.abs((fcp.ts-nav.ts)/1000-rawFcp)>150)
    throw Error('PerformanceObserver/LHR and trace FCP disagree');
  const draws=events.filter(e=>e.name==='DrawFrame' && e.ts>=nav.ts && e.ts<=fcp.ts)
    .map(e=>e.ts).sort((a,b)=>a-b);
  const stamps=[nav.ts,...draws,fcp.ts];
  const gaps=stamps.slice(1).map((x,i)=>(x-stamps[i])/1000);
  const inside=events.filter(e=>e.ts>=nav.ts+ready*1000 && e.ts<=fcp.ts);
  return {traceFcp:round((fcp.ts-nav.ts)/1000),
    lastDraws:draws.slice(-3).map(ts=>round((ts-nav.ts)/1000)),
    longestNoDraw:round(Math.max(0,...gaps)),
    rendererFrameRequests:inside.filter(e=>e.name==='RequestMainThreadFrame'
      && e.pid===nav.pid).length,
    rendererMainFrames:inside.filter(e=>e.name==='BeginMainThreadFrame'
      && e.pid===nav.pid && e.tid===nav.tid).length,
    rasterBusy:round(inside.filter(e=>e.name==='RasterTask' && e.pid===nav.pid)
      .reduce((sum,e)=>sum+(e.dur||0),0)/1000)};
}

async function trial(block,mode){
  const browserFlags=[...chromeLauncher.Launcher.defaultFlags(),
    '--disable-setuid-sandbox','--headless=new','--no-sandbox',
    '--disable-dev-shm-usage'];
  const chrome=await chromeLauncher.launch({chromePath:process.env.CHROME_PATH,
    chromeFlags:browserFlags,ignoreDefaultFlags:true,logLevel:'error'});
  let browser,client;
  try{
    browser=await puppeteer.connect({browserURL:`http://127.0.0.1:${chrome.port}`,
      defaultViewport:null});
    const page=await browser.newPage();
    await page.evaluateOnNewDocument(instrumentDocument);
    const responses=[];
    page.on('response',response=>{
      const url=response.url();
      if(['/css/style.css','/img/head_mobile.avif','/img/head_mobile.webp',
        '/js/main.js','fonts.googleapis.com','fonts.gstatic.com']
        .some(needle=>url.includes(needle)))
        responses.push({url,status:response.status()});
    });
    let lhr=null,trace=null,rawFcp=null,rawLcp=null,simLcp=null,hero=null;
    if(mode==='lighthouse'){
      const flags={logLevel:'error',onlyCategories:['performance','accessibility',
        'best-practices','seo'],formFactor:'mobile',throttlingMethod:'simulate',
        throttling:{rttMs:150,throughputKbps:1638.4,cpuSlowdownMultiplier:4},
        screenEmulation:{mobile:true,width:412,height:915,deviceScaleFactor:1.75,
          disabled:false},maxWaitForLoad:45000};
      const result=await lighthouse(URL,flags,undefined,page);
      if(!result?.lhr||!result.artifacts?.Trace)throw Error('Lighthouse LHR/trace missing');
      lhr=result.lhr;trace=result.artifacts.Trace;
      const settings=lhr.configSettings;
      const m=lhr.audits.metrics?.details?.items?.[0] || {};
      rawFcp=round(m.observedFirstContentfulPaint);
      rawLcp=round(m.observedLargestContentfulPaint);
      simLcp=round(lhr.audits['largest-contentful-paint']?.numericValue);
      hero=lhr.audits['largest-contentful-paint-element']?.details?.items?.[0]
        ?.items?.[0]?.node?.selector||null;
      if(lhr.finalUrl!==URL||lhr.lighthouseVersion!=='12.6.1'||
        settings.throttlingMethod!=='simulate'||
        settings.throttling?.rttMs!==150||
        settings.throttling?.throughputKbps!==1638.4||
        settings.throttling?.cpuSlowdownMultiplier!==4||
        settings.screenEmulation?.width!==412||
        settings.screenEmulation?.height!==915||lhr.runtimeError||!simLcp||
        !rawLcp||!hero)throw Error('Unpinned Lighthouse trial');
      // Some LH sessions restore desktop viewport before reading the page.
    }else{
      await page.setViewport({width:412,height:915,deviceScaleFactor:1.75,
        isMobile:true,hasTouch:true});
      if(mode==='direct-traced'){
        client=await page.createCDPSession();
        const chunks=[];
        client.on('Tracing.dataCollected',data=>chunks.push(...data.value));
        const completed=new Promise(resolve=>client.once('Tracing.tracingComplete',resolve));
        await client.send('Tracing.start',{categories:Trace.getDefaultTraceCategories()
          .join(','),options:'sampling-frequency=10000'});
        await page.goto(URL,{waitUntil:'load',timeout:60000});
        // No page-side polling/rAF requests: let its natural first paint settle.
        await new Promise(resolve=>setTimeout(resolve,3500));
        await client.send('Tracing.end');
        await completed;
        trace={traceEvents:chunks};
      }else{
        await page.goto(URL,{waitUntil:'load',timeout:60000});
        await new Promise(resolve=>setTimeout(resolve,3500));
      }
    }
    const lab=await page.evaluate(()=>window.__lcpFrameLab||null);
    if(mode!=='lighthouse')rawFcp=lab?.paint?.ms;
    const networkRecords=mode==='lighthouse'?
      lhr.audits['network-requests']?.details?.items?.map(r=>({
        url:r.url,status:r.statusCode}))||[]:responses;
    const rawStatus=needle=>networkRecords.filter(r=>r.url?.includes(needle)&&
      r.status===200).length;
    const network={css:rawStatus('/css/style.css'),
      avif:rawStatus('/img/head_mobile.avif'),
      webp:rawStatus('/img/head_mobile.webp'),main:rawStatus('/js/main.js'),
      fontCss:rawStatus('fonts.googleapis.com'),
      fontFiles:rawStatus('fonts.gstatic.com')};
    const pageData=await page.evaluate(()=>({
      consent:window.MiloviConsent?.getChoice(),
      modalOpen:Boolean(document.querySelector('.mc-consent-overlay.is-open')),
      image:document.querySelector('.hero-photo-bg img')?.currentSrc||'',
      viewport:{width:innerWidth,height:innerHeight},
      ua:navigator.userAgent,visibility:document.visibilityState,
      focused:document.hasFocus()}));
    const row={block,mode,rawFcp,rawLcp,simLcp,hero,lab,network,pageData,
      frame:trace?frameSummary(trace,rawFcp,0):null,
      traceEvents:trace?.traceEvents?.length||0};
    if(!rawFcp||!lab?.paint||Math.abs(lab.paint.ms-rawFcp)>150||
      lab.paint.visibility!=='visible'||!lab.paint.focused||
      !lab.milestones.some(x=>x.kind==='domcontentloaded' &&
        x.currentSrc.endsWith('/img/head_mobile.avif')&&x.complete)||
      !lab.milestones.some(x=>x.kind==='load' &&
        x.currentSrc.endsWith('/img/head_mobile.avif'))||
      pageData.consent!=='denied'||!pageData.modalOpen||
      !pageData.ua.includes('Chrome/155.')||
      !network.css||!network.avif||!network.webp||!network.main||
      !network.fontCss||!network.fontFiles||
      (trace && row.traceEvents<1000))
      throw Error('Invalid same-origin cold mode trial: '+JSON.stringify(row));
    const stem=path.join(OUT,`${String(block).padStart(2,'0')}-${mode}`);
    if(lhr)fs.writeFileSync(stem+'.lhr.json',JSON.stringify(lhr));
    if(trace)fs.writeFileSync(stem+'.trace.json.gz',zlib.gzipSync(
      JSON.stringify(trace),{level:3}));
    return row;
  }finally{
    await client?.detach().catch(()=>{});
    await browser?.disconnect().catch(()=>{});
    await chrome.kill();
  }
}

async function main(){
  if(!process.env.CHROME_PATH||!fs.existsSync(process.env.CHROME_PATH))
    throw Error('Pinned Chrome 155 missing');
  fs.mkdirSync(OUT,{recursive:true});
  const rows=[];
  for(let i=0;i<ORDERS.length;i++){
    const pair=[];
    for(const mode of ORDERS[i])pair.push(await trial(i+1,mode));
    rows.push(...pair);
    notice(`mode-block-${i+1}`,pair.map(r=>({mode:r.mode,rawFcp:r.rawFcp,
      simLcp:r.simLcp,hero:r.hero,network:r.network,
      vis:r.lab.milestones.map(x=>[x.kind,x.ms,x.visibility,x.focused]),
      raf:r.lab.raf.slice(0,3),frame:r.frame})));
  }
  if(rows.length!==24)throw Error('Incomplete balanced mode control');
  const group=Object.fromEntries(ORDERS[0].map(mode=>{
    const rs=rows.filter(r=>r.mode===mode);
    return[mode,{rawMedian:median(rs.map(r=>r.rawFcp)),
      slow:rs.filter(r=>r.rawFcp>=750).length,
      over2500:rs.filter(r=>r.rawFcp>2500).length,
      simMedian:mode==='lighthouse'?round(median(rs.map(r=>r.simLcp))):null}];
  }));
  const deltas=ORDERS.map((_,i)=>{
    const r=mode=>rows.find(x=>x.block===i+1&&x.mode===mode);
    return {block:i+1,traceMinusLighthouse:round(r('direct-traced').rawFcp-
      r('lighthouse').rawFcp),plainMinusLighthouse:round(r('direct-plain').rawFcp-
      r('lighthouse').rawFcp),traceMinusPlain:round(r('direct-traced').rawFcp-
      r('direct-plain').rawFcp)};
  });
  fs.writeFileSync(path.join(OUT,'summary.json'),JSON.stringify({
    release:RELEASE,browser:'Chrome 155.0.8059.39',
    label:'anonymous lab only; NOT field p75, a site edit or a deployment',
    group,deltas,rows},null,2));
  notice('mode-summary',{release:RELEASE,group,
    pairedMedians:Object.fromEntries(['traceMinusLighthouse','plainMinusLighthouse',
      'traceMinusPlain'].map(k=>[k,round(median(deltas.map(d=>d[k])))])),deltas});
}
main().catch(error=>{console.error(error);process.exitCode=1;});
