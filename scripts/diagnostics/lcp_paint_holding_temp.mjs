// Temporary PR-only A/B: identical Chrome 155 direct mobile navigation on the
// pinned live release, changing only new headless vs Xvfb headed display mode.
// No Lighthouse/tracing, site rewrite, service credentials or production edit.
// Remove this and its workflow after reviewing the anonymous paired lab data.
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const chromeLauncher=require('/tmp/milovi-lighthouse/node_modules/chrome-launcher');
const puppeteer=require('/tmp/milovi-lighthouse/node_modules/puppeteer-core');
const URL='https://milovicake.ru/prigorody/gatchina/';
const RELEASE='e4cc47a5478a2cd1cc29096f51e310633919f3e2';
const OUT='/tmp/milovi-lcp-display-control';
const ORDERS=Array.from({length:16},(_,i)=>i%2===0?
  ['headless','headed']:['headed','headless']);
const round=n=>Number.isFinite(n)?Math.round(n*10)/10:null;
const median=xs=>{const s=[...xs].sort((a,b)=>a-b);
  return (s[Math.floor((s.length-1)/2)]+s[Math.floor(s.length/2)])/2;};
const notice=(title,value)=>console.log(`::notice title=${title}::${JSON.stringify(value)}`);

function instrumentDocument(){
  const lab=window.__lcpFrameLab={initial:{visibility:document.visibilityState,
    focused:document.hasFocus()},stateChanges:[],milestones:[],raf:[],paint:null};
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

async function trial(block,mode){
  const browserFlags=[...chromeLauncher.Launcher.defaultFlags(),
    '--disable-setuid-sandbox',...(mode==='headless'?['--headless=new']:[]),
    '--no-sandbox','--disable-dev-shm-usage'];
  const chrome=await chromeLauncher.launch({chromePath:process.env.CHROME_PATH,
    chromeFlags:browserFlags,ignoreDefaultFlags:true,logLevel:'error'});
  let browser;
  try{
    browser=await puppeteer.connect({browserURL:`http://127.0.0.1:${chrome.port}`,
      defaultViewport:null});
    const page=await browser.newPage();
    await page.bringToFront();
    await page.evaluateOnNewDocument(instrumentDocument);
    const responses=[];
    page.on('response',response=>{
      const url=response.url();
      if(['/css/style.css','/img/head_mobile.avif','/img/head_mobile.webp',
        '/js/main.js','fonts.googleapis.com','fonts.gstatic.com']
        .some(needle=>url.includes(needle)))
        responses.push({url,status:response.status()});
    });
    await page.setViewport({width:412,height:915,deviceScaleFactor:1.75,
      isMobile:true,hasTouch:true});
    await page.goto(URL,{waitUntil:'load',timeout:60000});
    // No additional page-side rAF or polling; observe natural first paint.
    await new Promise(resolve=>setTimeout(resolve,3500));
    const lab=await page.evaluate(()=>window.__lcpFrameLab||null);
    const rawFcp=lab?.paint?.ms;
    const rawStatus=needle=>responses.filter(r=>r.url.includes(needle)&&
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
    const row={block,mode,rawFcp,lab,network,pageData,flags:browserFlags
      .filter(x=>x.startsWith('--headless')||x.startsWith('--disable-features='))};
    if(!rawFcp||!lab?.paint||lab.paint.visibility!=='visible'||
      !lab.paint.focused||
      !lab.milestones.some(x=>x.kind==='domcontentloaded' &&
        x.currentSrc.endsWith('/img/head_mobile.avif')&&x.complete)||
      !lab.milestones.some(x=>x.kind==='load' &&
        x.currentSrc.endsWith('/img/head_mobile.avif'))||
      pageData.consent!=='denied'||!pageData.modalOpen||
      !pageData.ua.includes('Chrome/155.')||
      (mode==='headless')!==pageData.ua.includes('HeadlessChrome/')||
      !network.css||!network.avif||!network.webp||!network.main||
      !network.fontCss||!network.fontFiles)
      throw Error('Invalid focused cold display-mode visit: '+JSON.stringify(row));
    return row;
  }finally{
    await browser?.disconnect().catch(()=>{});
    await chrome.kill();
  }
}

async function main(){
  if(!process.env.CHROME_PATH||!fs.existsSync(process.env.CHROME_PATH)||
    !process.env.DISPLAY)throw Error('Pinned Chrome 155 or virtual display missing');
  fs.mkdirSync(OUT,{recursive:true});
  const rows=[];
  for(let i=0;i<ORDERS.length;i++){
    const pair=[];
    for(const mode of ORDERS[i])pair.push(await trial(i+1,mode));
    rows.push(...pair);
    notice(`display-pair-${i+1}`,pair.map(r=>({mode:r.mode,rawFcp:r.rawFcp,
      network:r.network,vis:r.lab.milestones.map(x=>
        [x.kind,x.ms,x.visibility,x.focused]),
      raf:r.lab.raf.slice(0,3),initial:r.lab.initial,
      stateChanges:r.lab.stateChanges,ua:r.pageData.ua})));
  }
  if(rows.length!==32)throw Error('Incomplete balanced display-mode control');
  const group=Object.fromEntries(ORDERS[0].map(mode=>{
    const rs=rows.filter(r=>r.mode===mode);
    return[mode,{rawMedian:median(rs.map(r=>r.rawFcp)),
      slow:rs.filter(r=>r.rawFcp>=750).length,
      over2500:rs.filter(r=>r.rawFcp>2500).length,
      hidden:rs.filter(r=>r.lab.paint.visibility!=='visible').length}];
  }));
  const deltas=ORDERS.map((_,i)=>{
    const r=mode=>rows.find(x=>x.block===i+1&&x.mode===mode);
    return round(r('headed').rawFcp-r('headless').rawFcp);
  });
  fs.writeFileSync(path.join(OUT,'summary.json'),JSON.stringify({
    release:RELEASE,browser:'Chrome 155.0.8059.39',
    label:'anonymous lab only; NOT field p75, site edit or deployment',
    group,pairedDelta:deltas,pairedMedian:median(deltas),rows},null,2));
  notice('display-summary',{release:RELEASE,group,pairedDelta:deltas,
    pairedMedian:median(deltas)});
}
main().catch(error=>{console.error(error);process.exitCode=1;});
