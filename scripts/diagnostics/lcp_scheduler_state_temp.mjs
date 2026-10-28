// PR-only Chrome scheduler capture on the unchanged published Gatchina page.
// Stops once both slow and fast raw FCP are observed; NOT a prevalence sample.
// Delete this and its temporary workflow after reading the anonymous trace.
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
const OUT='/tmp/milovi-lcp-scheduler-state';
const EXTRA=['renderer.scheduler','renderer.scheduler.status',
  'disabled-by-default-renderer.scheduler.debug','cc',
  'disabled-by-default-cc.debug.scheduler',
  'disabled-by-default-cc.debug.scheduler.frames','viz','network.scheduler'];
const round=x=>Number.isFinite(x)?Math.round(x*10)/10:null;
const notice=(title,data)=>console.log(`::notice title=${title}::${JSON.stringify(data)}`);

function instrumentDocument(){
  const lab=window.__frameLab={initial:{visibility:document.visibilityState,
    focused:document.hasFocus()},raf:[],visibility:[],paint:null,milestones:[]};
  const raf=window.requestAnimationFrame;
  window.requestAnimationFrame=function(callback){
    const requested=performance.now();
    return raf.call(window,function(timestamp){
      if(lab.raf.length<30)lab.raf.push({requested:Math.round(requested),
        fired:Math.round(performance.now()),visibility:document.visibilityState});
      return callback(timestamp);
    });
  };
  new PerformanceObserver(list=>{
    for(const x of list.getEntries())if(x.name==='first-contentful-paint')
      lab.paint={ms:Math.round(x.startTime),visibility:document.visibilityState,
        focused:document.hasFocus()};
  }).observe({type:'paint',buffered:true});
  document.addEventListener('visibilitychange',()=>lab.visibility.push({
    ms:Math.round(performance.now()),value:document.visibilityState}));
  for(const event of ['DOMContentLoaded','load']){
    const target=event==='load'?window:document;
    target.addEventListener(event,()=>{
      const image=document.querySelector('.hero-photo-bg img');
      lab.milestones.push({event,ms:Math.round(performance.now()),
        visible:document.visibilityState,focused:document.hasFocus(),
        hero:image?.currentSrc||'',complete:image?.complete,
        naturalWidth:image?.naturalWidth});
    },{once:true});
  }
}

function summariseTrace(events,observed,finished){
  const nav=events.find(e=>e.name==='navigationStart' &&
    e.args?.data?.isOutermostMainFrame && e.args.data.documentLoaderURL===URL);
  if(!nav)throw Error('Exact outermost navigation missing in trace');
  const fcp=events.find(e=>e.name==='firstContentfulPaint' && e.ts>nav.ts &&
    e.args?.data?.navigationId===nav.args.data.navigationId);
  if(!fcp||Math.abs((fcp.ts-nav.ts)/1000-observed)>150)
    throw Error('Observed FCP and trace FCP disagree');
  const ms=e=>round((e.ts-nav.ts)/1000);
  const before=events.filter(e=>e.ts>=nav.ts&&e.ts<=fcp.ts);
  const frames=before.filter(e=>e.name==='DrawFrame').sort((a,b)=>a.ts-b.ts);
  const next=frames.at(-1)?.ts??fcp.ts, prior=frames.at(-2)?.ts??nav.ts;
  const gap=before.filter(e=>e.ts>=prior&&e.ts<=next);
  const requests=gap.filter(e=>e.name==='RequestMainThreadFrame'&&e.pid===nav.pid);
  const frameBegins=gap.filter(e=>e.name==='BeginMainThreadFrame'&&e.pid===nav.pid);
  const states=gap.filter(e=>e.name==='SchedulerStateMachine'&&
    e.pid===nav.pid&&e.args?.cc_scheduler_state?.state_machine);
  const snapshots=before.filter(e=>e.name==='MainThreadScheduler:snapshot'&&
    e.pid===nav.pid&&e.tid===nav.tid);
  const samples=[0,Math.floor(states.length/2),Math.max(states.length-1,0)]
    .filter((index,pos,all)=>all.indexOf(index)===pos).map(index=>{
      const e=states[index], s=e?.args?.cc_scheduler_state;
      const major=s?.state_machine?.major_state||{},minor=s?.state_machine?.minor_state||{};
      return e&&{ms:ms(e),next:major.next_action,
        main:major.begin_main_frame_state,need:minor.needs_begin_main_frame,
        defer:minor.defer_begin_main_frame,missed:minor.main_thread_missed_last_deadline,
        canDraw:minor.can_draw,visible:minor.visible,
        paused:minor.begin_frame_source_paused||s.begin_frame_source_state?.paused,
        pending:minor.pending_submit_frames,first:minor.active_tree_needs_first_draw};
    }).filter(Boolean);
  const flagCounts={};
  for(const e of states){const s=e.args.cc_scheduler_state.state_machine;
    const key=`need:${s.minor_state?.needs_begin_main_frame}/defer:${s.minor_state?.defer_begin_main_frame}/next:${s.major_state?.next_action}`;
    flagCounts[key]=(flagCounts[key]||0)+1;}
  const queued=before.filter(e=>e.name==='LayerTreeHostImpl::DidNotProduceFrame'&&
    e.pid===nav.pid && e.ts>=prior&&e.ts<=next);
  const dropReasons={};for(const e of queued){const reason=e.args?.FrameSkippedReason||'unknown';
    dropReasons[reason]=(dropReasons[reason]||0)+1;}
  const timing=before.filter(e=>e.name==='SendBeginFrameDecision'&&
    e.ts>=prior&&e.ts<=next);
  const sendReasons={};for(const e of timing){const k=`${e.args?.reason}:${e.args?.should_send}`;
    sendReasons[k]=(sendReasons[k]||0)+1;}
  const nearbySnapshots=snapshots.filter(e=>e.ts>=prior-100000&&
    e.ts<=next+100000);
  const snapshotDetails=[nearbySnapshots[0],
    nearbySnapshots[Math.floor(nearbySnapshots.length/2)],nearbySnapshots.at(-1)]
    .filter((e,i,all)=>e&&all.indexOf(e)===i)
    .map(e=>{const s=e.args.snapshot,p=s?.page_schedulers?.[0],
      f=p?.frame_schedulers?.find(x=>x.frame_type==='MainFrame');
      return{ms:ms(e),useCase:s?.current_use_case,
        backgrounded:s?.renderer_backgrounded,hidden:s?.renderer_hidden,
        batterySaver:s?.battery_saver_enabled,
        virtualTime:s?.virtual_time,virtualStopped:s?.virtual_time_stopped,
        pageVisible:p?.page_visible,frozen:p?.is_frozen,
        frameVisible:f?.frame_visible,disableBgTimer:f?.disable_background_timer_throttling,
        cpuBudgetEnabled:p?.cpu_time_budget_pool?.is_enabled};});
  const duration=name=>round(gap.filter(e=>e.name===name&&e.pid===nav.pid)
    .reduce((sum,e)=>sum+(e.dur||0),0)/1000);
  const request=requests.at(-1);
  const aroundRequest=before.filter(e=>request&&
    e.pid===nav.pid&&e.ts>=request.ts-10000&&e.ts<request.ts+2000)
    .sort((a,b)=>a.ts-b.ts).slice(-16).map(e=>[e.name,ms(e)]);
  const possibleWakeups=gap.filter(e=>e.pid===nav.pid&&
    /TimerFire|FireAnimationFrame|ScheduleAnimation|SetNeedsCommit|ResourceFinish/.test(e.name))
    .slice(-18).map(e=>[e.name,ms(e)]);
  return{traceFcp:ms(fcp),priorDraw:round((prior-nav.ts)/1000),
    nextDraw:round((next-nav.ts)/1000),gapMs:round((next-prior)/1000),
    beginFrame:gap.filter(e=>e.name==='BeginFrame').length,
    dropped:gap.filter(e=>e.name==='DroppedFrame').length,
    request:requests.map(ms).slice(-4),mainFrames:frameBegins.map(ms).slice(-4),
    mainBusyMs:round(gap.filter(e=>e.name==='RunTask'&&e.pid===nav.pid&&
      e.tid===nav.tid).reduce((sum,e)=>sum+(e.dur||0),0)/1000),
    rasterBusyMs:duration('RasterTask'),
    resourceEnd:finished.filter(e=>e.timestamp*1e6>=nav.ts&&
      e.timestamp*1e6<=fcp.ts).map(e=>[e.name,round((e.timestamp*1e6-nav.ts)/1000)]).slice(-20),
    skipped:dropReasons,
    sent:sendReasons,schedulerSamples:samples,flags:flagCounts,
    snapshots:snapshotDetails,schedulerStateCount:states.length,
    nearRequest:aroundRequest,wakeups:possibleWakeups,
    eventCount:events.length};
}

async function visit(number){
  const chromeFlags=[...launcher.Launcher.defaultFlags(),
    '--disable-setuid-sandbox','--headless=new','--no-sandbox','--disable-dev-shm-usage'];
  const chrome=await launcher.launch({chromePath:process.env.CHROME_PATH,
    chromeFlags,ignoreDefaultFlags:true,logLevel:'error'});
  let browser,session;
  try{
    browser=await puppeteer.connect({browserURL:`http://127.0.0.1:${chrome.port}`,
      defaultViewport:null});
    const page=await browser.newPage();
    await page.bringToFront();
    await page.setViewport({width:412,height:915,deviceScaleFactor:1.75,
      isMobile:true,hasTouch:true});
    await page.evaluateOnNewDocument(instrumentDocument);
    const responses=[];
    page.on('response',r=>responses.push({url:r.url(),status:r.status()}));
    session=await page.createCDPSession();
    const requestUrls=new Map(),finished=[];
    session.on('Network.requestWillBeSent',e=>requestUrls.set(e.requestId,e.request.url));
    session.on('Network.loadingFinished',e=>{
      const url=requestUrls.get(e.requestId)||'';
      const type=['/css/style.css','/img/head_mobile.avif','/img/head_mobile.webp',
        '/js/main.js','fonts.googleapis.com','fonts.gstatic.com']
        .find(needle=>url.includes(needle));
      if(type)finished.push({name:type,timestamp:e.timestamp});
    });
    await session.send('Network.enable');
    const supported=(await session.send('Tracing.getCategories')).categories;
    const enabled=EXTRA.filter(cat=>supported.includes(cat));
    const missing=EXTRA.filter(cat=>!supported.includes(cat));
    const alternatives=enabled.includes('disabled-by-default-cc.debug.scheduler')?[]:
      ['cc.debug','disabled-by-default-cc.debug','scheduler',
        'disabled-by-default-renderer.scheduler','renderer.scheduler']
        .filter(cat=>supported.includes(cat)&&!enabled.includes(cat));
    if(number===1)notice('scheduler-trace-categories',{enabled,missing,
      alternatives,available:supported.filter(cat=>/schedul|^cc/.test(cat))});
    if(!enabled.includes('disabled-by-default-cc.debug.scheduler')&&
      !alternatives.includes('cc.debug')&&
      !alternatives.includes('disabled-by-default-cc.debug'))
      throw Error('Chrome 155 has no scheduler state category: '+missing.join(','));
    const categories=[...Trace.getDefaultTraceCategories(),...enabled,...alternatives];
    const chunks=[];
    session.on('Tracing.dataCollected',event=>chunks.push(...event.value));
    const done=new Promise(resolve=>session.once('Tracing.tracingComplete',resolve));
    await session.send('Tracing.start',{categories:categories.join(','),
      options:'sampling-frequency=10000'});
    await page.goto(URL,{waitUntil:'load',timeout:60000});
    // The node-side wait must not request frames or mutate the page.
    await new Promise(resolve=>setTimeout(resolve,3500));
    await session.send('Tracing.end');await done;
    const lab=await page.evaluate(()=>window.__frameLab||null);
    const state=await page.evaluate(()=>({consent:window.MiloviConsent?.getChoice(),
      dialog:Boolean(document.querySelector('.mc-consent-overlay.is-open')),
      focused:document.hasFocus(),visibility:document.visibilityState,
      hero:document.querySelector('.hero-photo-bg img')?.currentSrc||'',
      browser:navigator.userAgent}));
    const net=needle=>responses.filter(r=>r.url.includes(needle)&&r.status===200).length;
    const resourceCounts={css:net('/css/style.css'),avif:net('/img/head_mobile.avif'),
      webp:net('/img/head_mobile.webp'),main:net('/js/main.js'),
      fontCss:net('fonts.googleapis.com'),woff:net('fonts.gstatic.com')};
    const rawFcp=lab?.paint?.ms;
    const trace=summariseTrace(chunks,rawFcp,finished);
    const row={number,rawFcp,lab,state,resourceCounts,trace};
    if(!rawFcp||lab.paint.visibility!=='visible'||!lab.paint.focused||
      !lab.milestones.some(x=>x.event==='DOMContentLoaded'&&
        x.hero.endsWith('/img/head_mobile.avif')&&x.complete)||
      !lab.milestones.some(x=>x.event==='load'&&
        x.hero.endsWith('/img/head_mobile.avif'))||
      state.consent!=='denied'||!state.dialog||!state.focused||
      state.visibility!=='visible'||!state.browser.includes('Chrome/155.')||
      Object.values(resourceCounts).some(value=>value<1)||
      trace.eventCount<1000)
      throw Error('Invalid cold visit: '+JSON.stringify(row));
    if(rawFcp>=750||number===1){
      const stem=path.join(OUT,`${number}-${rawFcp}`);
      fs.writeFileSync(stem+'.trace.json.gz',zlib.gzipSync(
        JSON.stringify({traceEvents:chunks}),{level:3}));
    }
    return row;
  }finally{
    if(session)await session.detach().catch(()=>{});
    if(browser)browser.disconnect();
    await chrome.kill();
  }
}

async function main(){
  if(!process.env.CHROME_PATH||!fs.existsSync(process.env.CHROME_PATH))
    throw Error('Pinned Chrome 155 not installed');
  fs.mkdirSync(OUT,{recursive:true});
  const rows=[];
  for(let number=1;number<=20;number++){
    const row=await visit(number);rows.push(row);
    fs.writeFileSync(path.join(OUT,'summary.json'),JSON.stringify({
      release:RELEASE,browser:'Chrome 155.0.8059.39',
      label:'anonymous laboratory; selection stops after 3 slow and 3 fast',rows},null,2));
    if(row.rawFcp>=750||number===1)
      notice(`scheduler-visit-${number}`,{fcp:row.rawFcp,
        raf:row.lab.raf.slice(0,3),milestones:row.lab.milestones,
        resources:row.resourceCounts,trace:row.trace});
    const slow=rows.filter(x=>x.rawFcp>=750).length;
    const fast=rows.length-slow;
    if(slow>=3&&fast>=3)break;
  }
  const slow=rows.filter(x=>x.rawFcp>=750).length;
  notice('scheduler-sample',{release:RELEASE,visits:rows.length,slow,
    fast:rows.length-slow,fcp:rows.map(x=>x.rawFcp),
    caveat:'Selected until both frame states seen; not incidence or field p75'});
  if(slow<1)throw Error('No late raw frame reproduced; control inconclusive');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
