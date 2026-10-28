// Temporary PR-only A/B: the same unchanged CDN page in Chrome 155 vs
// pinned Chrome 158 before/after disabling its exact upstream Viz fix.
// Only the new feature flag differs between the two Chrome 158 arms.
// Lab FCP and Viz begin-frame reasons; NOT a field p75 or release candidate.
// Delete with temporary workflow after reviewing the controls.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import {createRequire} from 'node:module';
import Trace from '/tmp/milovi-lighthouse/node_modules/lighthouse/core/gather/gatherers/trace.js';

const require=createRequire(import.meta.url);
const launcher=require('/tmp/milovi-lighthouse/node_modules/chrome-launcher');
const puppeteer=require('/tmp/milovi-lighthouse/node_modules/puppeteer-core');
const URL='https://milovicake.ru/prigorody/gatchina/';
const RELEASE='e4cc47a5478a2cd1cc29096f51e310633919f3e2';
const FEATURE='NoUndrawnFrameThrottleWhileEmbedderWaits';
const OUT='/tmp/milovi-lcp-upstream-control';
const ARMS=['chrome155','chrome158-fixed','chrome158-fix-off'];
const ORDERS=Array.from({length:12},(_,i)=>[
  ARMS[i%3],ARMS[(i+1)%3],ARMS[(i+2)%3]]);
const round=x=>Number.isFinite(x)?Math.round(x*10)/10:null;
const median=xs=>{const s=[...xs].sort((a,b)=>a-b);
  return round((s[Math.floor((s.length-1)/2)]+s[Math.floor(s.length/2)])/2);};
const notice=(title,obj)=>console.log(`::notice title=${title}::${JSON.stringify(obj)}`);
const stored=new Map();

function instrument(){
  const lab=window.__lab={raf:[],paint:null,milestones:[],states:[]};
  const native=window.requestAnimationFrame;
  window.requestAnimationFrame=function(callback){
    const requested=performance.now();
    return native.call(window,function(ts){
      if(lab.raf.length<30)lab.raf.push({requested:Math.round(requested),
        fired:Math.round(performance.now()),visible:document.visibilityState});
      return callback(ts);
    });
  };
  new PerformanceObserver(list=>{
    for(const e of list.getEntries())if(e.name==='first-contentful-paint')
      lab.paint={ms:Math.round(e.startTime),visible:document.visibilityState,
        focused:document.hasFocus()};
  }).observe({type:'paint',buffered:true});
  document.addEventListener('visibilitychange',()=>lab.states.push({
    ms:Math.round(performance.now()),state:document.visibilityState}));
  for(const name of ['DOMContentLoaded','load']){
    (name==='load'?window:document).addEventListener(name,()=>{
      const image=document.querySelector('.hero-photo-bg img');
      lab.milestones.push({name,ms:Math.round(performance.now()),
        visible:document.visibilityState,focused:document.hasFocus(),
        hero:image?.currentSrc||'',complete:image?.complete,
        width:image?.naturalWidth||0});
    },{once:true});
  }
}

function inspect(events,rawFcp){
  const nav=events.find(e=>e.name==='navigationStart'&&
    e.args?.data?.isOutermostMainFrame&&e.args.data.documentLoaderURL===URL);
  const fcp=events.find(e=>nav&&e.name==='firstContentfulPaint'&&e.ts>nav.ts&&
    e.args?.data?.navigationId===nav.args.data.navigationId);
  if(!fcp||Math.abs((fcp.ts-nav.ts)/1000-rawFcp)>150)
    throw Error('Observed paint and exact trace navigation disagree');
  const before=events.filter(e=>e.ts>=nav.ts&&e.ts<=fcp.ts);
  const draws=before.filter(e=>e.name==='DrawFrame').sort((a,b)=>a.ts-b.ts);
  const prev=draws.at(-2)?.ts??nav.ts,last=draws.at(-1)?.ts??fcp.ts;
  const gap=before.filter(e=>e.ts>=prev&&e.ts<=last);
  const reasonCount=(subset)=>{
    const result={};for(const e of subset.filter(e=>e.name==='SendBeginFrameDecision')){
      const reason=e.args?.reason;
      if(reason)result[`${reason}:${e.args?.should_send}`]=
        (result[`${reason}:${e.args?.should_send}`]||0)+1;
    }return result;
  };
  const t=e=>round((e.ts-nav.ts)/1000);
  const throttled=before.filter(e=>e.name==='SendBeginFrameDecision'&&
    e.args?.reason==='ThrottleUndrawnFrames'&&e.args?.should_send===false);
  const awaited=before.filter(e=>e.name==='SendBeginFrameDecision'&&
    e.args?.reason==='SendAwaitedByEmbedder'&&e.args?.should_send===true);
  const busy=name=>round(gap.filter(e=>e.name===name&&e.pid===nav.pid)
    .reduce((sum,e)=>sum+(e.dur||0),0)/1000);
  return {traceFcp:t(fcp),gapMs:round((last-prev)/1000),
    previousDraw:round((prev-nav.ts)/1000),nextDraw:round((last-nav.ts)/1000),
    requests:gap.filter(e=>e.name==='RequestMainThreadFrame'&&e.pid===nav.pid)
      .map(t).slice(-3),
    begin:gap.filter(e=>e.name==='BeginFrame').length,
    dropped:gap.filter(e=>e.name==='DroppedFrame').length,
    mainBusyMs:round(gap.filter(e=>e.name==='RunTask'&&e.pid===nav.pid&&
      e.tid===nav.tid).reduce((sum,e)=>sum+(e.dur||0),0)/1000),
    rasterBusyMs:busy('RasterTask'),vizReasons:reasonCount(gap),
    allVizReasons:reasonCount(before),
    throttled:[throttled[0]&&t(throttled[0]),
      throttled.at(-1)&&t(throttled.at(-1))],
    awaited:[awaited[0]&&t(awaited[0]),awaited.at(-1)&&t(awaited.at(-1))],
    traceEvents:events.length};
}

async function trial(block,arm){
  const chromePath=process.env[arm==='chrome155'?'CHROME_155_PATH':'CHROME_158_PATH'];
  const chromeFlags=[...launcher.Launcher.defaultFlags()].map(f=>
    arm==='chrome158-fix-off'&&f.startsWith('--disable-features=')?
      `${f},${FEATURE}`:f).concat(['--disable-setuid-sandbox',
      '--headless=new','--no-sandbox','--disable-dev-shm-usage']);
  const chrome=await launcher.launch({chromePath,chromeFlags,
    ignoreDefaultFlags:true,logLevel:'error'});
  let browser,session;
  try{
    browser=await puppeteer.connect({browserURL:`http://127.0.0.1:${chrome.port}`,
      defaultViewport:null});
    const version=await browser.version();
    const major=arm==='chrome155'?'155':'158';
    if(!version.includes(`/${major}.`))throw Error('Unexpected Chrome version: '+version);
    const page=await browser.newPage();await page.bringToFront();
    await page.setViewport({width:412,height:915,deviceScaleFactor:1.75,
      isMobile:true,hasTouch:true});
    await page.evaluateOnNewDocument(instrument);
    const responses=[];
    page.on('response',r=>responses.push({url:r.url(),status:r.status()}));
    session=await page.createCDPSession();
    const traceEvents=[];
    session.on('Tracing.dataCollected',e=>traceEvents.push(...e.value));
    const complete=new Promise(resolve=>session.once('Tracing.tracingComplete',resolve));
    await session.send('Tracing.start',{categories:[
      ...Trace.getDefaultTraceCategories(),'viz','cc'].join(','),
      options:'sampling-frequency=10000'});
    await page.goto(URL,{waitUntil:'load',timeout:60000});
    // No page-side frame requests or polling by the diagnostic.
    await new Promise(resolve=>setTimeout(resolve,3600));
    await session.send('Tracing.end');await complete;
    const lab=await page.evaluate(()=>window.__lab||null);
    const state=await page.evaluate(()=>({
      consent:window.MiloviConsent?.getChoice(),
      dialog:Boolean(document.querySelector('.mc-consent-overlay.is-open')),
      hero:document.querySelector('.hero-photo-bg img')?.currentSrc||'',
      visible:document.visibilityState,focused:document.hasFocus(),
      userAgent:navigator.userAgent}));
    const count=needle=>responses.filter(x=>x.status===200&&
      x.url.includes(needle)).length;
    const resources={css:count('/css/style.css'),
      avif:count('/img/head_mobile.avif'),
      webp:count('/img/head_mobile.webp'),main:count('/js/main.js'),
      fontCss:count('fonts.googleapis.com'),woff:count('fonts.gstatic.com')};
    const rawFcp=lab?.paint?.ms;
    const trace=inspect(traceEvents,rawFcp);
    const row={block,arm,version,rawFcp,
      flags:chromeFlags.filter(x=>x.startsWith('--disable-features=')),
      lab,state,resources,trace};
    if(!rawFcp||lab.paint.visible!=='visible'||!lab.paint.focused||
      !lab.milestones.some(x=>x.name==='DOMContentLoaded'&&
        x.hero.endsWith('/img/head_mobile.avif'))||
      !lab.milestones.some(x=>x.name==='load'&&
        x.hero.endsWith('/img/head_mobile.avif')&&x.complete&&x.width===768)||
      state.visible!=='visible'||!state.focused||
      !state.hero.endsWith('/img/head_mobile.avif')||
      state.consent!=='denied'||!state.dialog||
      Object.values(resources).some(x=>x<1)||
      !state.userAgent.includes(`Chrome/${major}.`)||trace.traceEvents<1000)
      throw Error('Invalid cold Chrome visit: '+JSON.stringify(row));
    const bucket=`${arm}:${rawFcp>=750?'late':'fast'}`;
    const kept=stored.get(bucket)||0;
    if(kept<(rawFcp>=750?2:1)){
      stored.set(bucket,kept+1);
      fs.writeFileSync(path.join(OUT,`${block}-${arm}-${rawFcp}.trace.json.gz`),
        zlib.gzipSync(JSON.stringify({traceEvents}),{level:3}));
    }
    return row;
  }finally{
    if(session)await session.detach().catch(()=>{});
    if(browser)browser.disconnect();
    await chrome.kill();
  }
}

async function main(){
  for(const key of ['CHROME_155_PATH','CHROME_158_PATH'])
    if(!process.env[key]||!fs.existsSync(process.env[key]))
      throw Error('Missing pinned browser: '+key);
  fs.mkdirSync(OUT,{recursive:true});
  const rows=[];
  for(let i=0;i<ORDERS.length;i++){
    const sample=[];
    for(const arm of ORDERS[i]){
      const row=await trial(i+1,arm);rows.push(row);sample.push({
        arm,rawFcp:row.rawFcp,oldThrottle:row.trace.allVizReasons['ThrottleUndrawnFrames:false']||0,
        newFix:row.trace.allVizReasons['SendAwaitedByEmbedder:true']||0});
      fs.writeFileSync(path.join(OUT,'summary.json'),JSON.stringify({
        release:RELEASE,browsers:['155.0.8059.39','158.0.8117.2'],
        label:'raw laboratory; not simulated Lighthouse or field p75',rows},null,2));
      globalThis.gc?.();
    }
    if((i+1)%3===0)notice(`upstream-blocks-${i-1}-${i+1}`,sample);
  }
  if(rows.length!==36)throw Error('Incomplete 12-block three-arm control');
  const group=Object.fromEntries(ARMS.map(arm=>{
    const selected=rows.filter(r=>r.arm===arm);
    return[arm,{rawFcp: selected.map(r=>r.rawFcp),
      median:median(selected.map(r=>r.rawFcp)),
      late:selected.filter(r=>r.rawFcp>=750).length,
      over2500:selected.filter(r=>r.rawFcp>2500).length,
      throttleCount:selected.reduce((s,r)=>s+(r.trace.allVizReasons['ThrottleUndrawnFrames:false']||0),0),
      awaitedCount:selected.reduce((s,r)=>s+(r.trace.allVizReasons['SendAwaitedByEmbedder:true']||0),0)}];
  }));
  const differences=Array.from({length:12},(_,i)=>{
    const r=arm=>rows.find(x=>x.block===i+1&&x.arm===arm).rawFcp;
    return {block:i+1,fixOffMinusFixed:r('chrome158-fix-off')-r('chrome158-fixed'),
      fixedMinus155:r('chrome158-fixed')-r('chrome155')};
  });
  notice('upstream-feature-summary',{release:RELEASE,group,differences,
    medianFixEffect:median(differences.map(d=>d.fixOffMinusFixed)),
    caveat:'same published release, different lab browser; not field p75 or CI threshold'});
}
main().catch(error=>{console.error(error);process.exitCode=1;});
