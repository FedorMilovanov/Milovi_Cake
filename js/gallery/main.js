import { GALLERY_ITEMS } from './data.js';

const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
const SIZE_MAP = { tall: '1x2', wide: '2x1', big: '2x2', m: '1x1' };
const filterButtons = [
  { id: 'all', label: 'Все' }, { id: 'photo', label: 'Фото' }, { id: 'video', label: 'Видео' },
  { id: 'wedding', label: 'Свадебные' }, { id: 'bento', label: 'Бенто' }, { id: '3d', label: '3D' },
  { id: 'meringue', label: 'Рулеты' }, { id: 'pavlova', label: 'Павлова' },
];
const state = { filter:'all', items:[], visible:[], swiper:null, lbIndex:0, observer:null, bgTimer:null };

function esc(s=''){ return String(s).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function normalizeItem(item) {
  const isVideo = item.type === 'video';
  const poster = isVideo ? (item.poster || item.full || item.src) : item.src;
  return { id:item.id, type:item.type, size:SIZE_MAP[item.size] || item.size || '1x1', tags:item.tags || [], title:item.title || 'Работа Milovi Cake', desc:item.desc || '', src:poster, fullSrc:item.full || poster, videoSrc:isVideo ? item.src : null };
}
function buildInterleavedItems() {
  const all = GALLERY_ITEMS.map(normalizeItem);
  const photos = all.filter(i => i.type === 'photo');
  const videos = all.filter(i => i.type === 'video');
  const out = []; let pi = 0, vi = 0;
  while (pi < photos.length || vi < videos.length) {
    if (pi < photos.length) out.push(photos[pi++]);
    if (vi < videos.length) out.push(videos[vi++]);
    if (pi < photos.length) out.push(photos[pi++]);
  }
  return out;
}
function filteredItems() {
  if (state.filter === 'all') return state.items;
  return state.items.filter(item => state.filter === 'photo' ? item.type === 'photo' : state.filter === 'video' ? item.type === 'video' : item.tags.includes(state.filter));
}
function categoryGlyph(id) {
  const a = 'viewBox="0 0 24 24" class="gx-chip-glyph" aria-hidden="true"';
  if (id === 'photo') return `<svg ${a}><rect x="4" y="7" width="16" height="11" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="12" cy="12.5" r="3" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M8.5 7l1-1.8h5l1 1.8" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  if (id === 'video') return `<svg ${a}><rect x="4" y="7" width="12" height="11" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M16.5 10.2L20 8.5v7.5l-3.5-1.7z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><circle cx="10" cy="12.5" r="0.8" fill="currentColor"/></svg>`;
  if (id === 'wedding') return `<svg ${a}><path d="M12 4c2-2.5 5.8-1.5 6.2 2 .3 2.5-1.8 4.5-6.2 8.5-4.4-4-6.5-6-6.2-8.5C6.2 2.5 10 1.5 12 4z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M6 18.5h12M8 16h8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>`;
  if (id === 'bento') return `<svg ${a}><rect x="5" y="7.5" width="14" height="9.5" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M8.5 7.5V6a1.5 1.5 0 0 1 1.5-1.5h4A1.5 1.5 0 0 1 15.5 6v1.5" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M9.5 11.5c1-.8 2-1 3-1s2 .2 3 1" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>`;
  if (id === '3d') return `<svg ${a}><path d="M12 3.5L19 7v10l-7 3.5L5 17V7z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M12 3.5v17M5 7l7 3.5L19 7" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>`;
  if (id === 'meringue') return `<svg ${a}><path d="M6.5 14c1.8-4 4.5-6.2 8-6.2 2.4 0 4.2.9 5 2.5.9 1.8.5 3.8-1 5.5-1.6 1.8-3.8 2.7-6.3 2.7-2.6 0-4.7-.8-5.7-2.3-.6-.8-.6-1.6 0-2.2z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M8.5 16c1.2.6 2.5.9 3.8.8 2.3 0 4.2-.6 5.6-2" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>`;
  if (id === 'pavlova') return `<svg ${a}><path d="M7 14c0-3.5 2.2-6 5-6s5 2.5 5 6c0 2-1.8 3.5-5 3.5S7 16 7 14z" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M10.5 7.5c.4-1.4 1-2 1.8-2s1.4.6 1.8 2" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><circle cx="12" cy="11.5" r="1" fill="currentColor"/></svg>`;
  return `<svg ${a}><path d="M12 3.5 14.8 9.2 20.5 12l-5.7 2.8L12 20.5l-2.8-5.7L3.5 12l5.7-2.8z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>`;
}
function luxeSeal(){ return `<svg viewBox="0 0 100 100" aria-hidden="true" class="gx-seal-svg"><defs><linearGradient id="sealGold" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#f5e6c0"/><stop offset="50%" stop-color="#d4a85c"/><stop offset="100%" stop-color="#8e5e20"/></linearGradient><radialGradient id="sealGlow" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="rgba(212,168,92,0.45)"/><stop offset="100%" stop-color="rgba(212,168,92,0)"/></radialGradient></defs><circle cx="50" cy="50" r="46" fill="url(#sealGlow)"/><circle cx="50" cy="50" r="38" fill="none" stroke="url(#sealGold)" stroke-width="1" opacity="0.7"/><circle cx="50" cy="50" r="32" fill="none" stroke="url(#sealGold)" stroke-width="0.8" opacity="0.5"/><path d="M50 18 L54 30 L66 32 L57 40 L59 52 L50 47 L41 52 L43 40 L34 32 L46 30 Z" fill="url(#sealGold)" fill-opacity="0.85"/><circle cx="50" cy="50" r="3.5" fill="url(#sealGold)"/><circle cx="50" cy="12" r="1.8" fill="url(#sealGold)" opacity="0.6"/><circle cx="50" cy="88" r="1.8" fill="url(#sealGold)" opacity="0.6"/><circle cx="12" cy="50" r="1.8" fill="url(#sealGold)" opacity="0.6"/><circle cx="88" cy="50" r="1.8" fill="url(#sealGold)" opacity="0.6"/></svg>`; }
function renderFilters(){ const wrap=$('#gxFilters'); wrap.innerHTML=filterButtons.map(b=>`<button type="button" class="gx-chip${b.id===state.filter?' gx-chip-active':''}" data-filter="${b.id}" aria-pressed="${b.id===state.filter}"><span class="gx-chip-icon">${categoryGlyph(b.id)}</span>${esc(b.label)}</button>`).join(''); $$('.gx-chip',wrap).forEach(btn=>btn.addEventListener('click',()=>{state.filter=btn.dataset.filter; renderFilters(); renderGrid(); $('#galleryGrid')?.scrollIntoView({behavior:'smooth',block:'start'});})); }
function sizeClasses(size){ if(size==='2x2') return 'col-span-2 row-span-2'; if(size==='2x1') return 'col-span-2'; if(size==='1x2') return 'row-span-2'; return ''; }
function playIcon(){ return '<svg class="play-badge" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>'; }
function renderGrid(){
  state.visible=filteredItems();
  $('#photoCount').textContent=`${state.visible.filter(i=>i.type==='photo').length} фото`;
  $('#videoCount').textContent=`${state.visible.filter(i=>i.type==='video').length} видео`;
  $('#gxTotalCount').textContent=String(state.items.length);
  const grid=$('#galleryGrid'), empty=$('#gxEmpty'); grid.innerHTML=''; empty.hidden=state.visible.length>0; if(!state.visible.length) return;
  const frag=document.createDocumentFragment();
  state.visible.forEach((item,index)=>{
    const card=document.createElement('button'); card.type='button'; card.className=`card ${sizeClasses(item.size)}`.trim(); card.style.animationDelay=`${Math.min(index*0.04,1.2)}s`; card.dataset.index=String(index); card.dataset.id=item.id; card.setAttribute('role','listitem'); card.setAttribute('aria-label',`${item.title}. Открыть в 3D-галерее`);
    if(item.type==='video') { const v=document.createElement('video'); v.className='card-media'; v.poster=item.src; v.muted=true; v.autoplay=true; v.loop=true; v.playsInline=true; v.preload=index<8?'auto':'metadata'; v.dataset.src=item.videoSrc; if(index<8) v.src=item.videoSrc; card.appendChild(v); card.insertAdjacentHTML('beforeend', playIcon()); }
    else { const img=document.createElement('img'); img.className='card-media'; img.src=item.src; img.alt=item.title; img.loading=index<8?'eager':'lazy'; img.decoding='async'; card.appendChild(img); }
    card.insertAdjacentHTML('beforeend', `<div class="card-overlay"><span class="card-title">${esc(item.title)}</span></div>`);
    card.addEventListener('click',()=>openLightbox(index)); attachCardTilt(card); frag.appendChild(card);
  });
  grid.appendChild(frag); setupVideoObserver();
}
function attachCardTilt(card){
  if(matchMedia('(hover: none), (pointer: coarse)').matches) return;
  let raf=0;
  card.addEventListener('mousemove',e=>{ if(raf) return; raf=requestAnimationFrame(()=>{ raf=0; const rect=card.getBoundingClientRect(); const x=e.clientX-rect.left; const y=e.clientY-rect.top; const centerX=rect.width/2; const centerY=rect.height/2; const rotateX=((y-centerY)/centerY)*-10; const rotateY=((x-centerX)/centerX)*10; card.style.transform=`perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.05)`; card.style.setProperty('--mouse-x',`${x}px`); card.style.setProperty('--mouse-y',`${y}px`); card.classList.add('is-active'); }); });
  card.addEventListener('mouseleave',()=>{ card.style.transform='perspective(1000px) rotateX(0deg) rotateY(0deg) scale(1)'; card.classList.remove('is-active'); });
}
function setupVideoObserver(){ if(state.observer) state.observer.disconnect(); if(!('IntersectionObserver' in window)) return; state.observer=new IntersectionObserver(entries=>{entries.forEach(entry=>{const v=entry.target; if(entry.isIntersecting){ if(!v.src&&v.dataset.src)v.src=v.dataset.src; v.play().catch(()=>{});} else v.pause();});},{threshold:.3,rootMargin:'200px 0px'}); $$('#galleryGrid video').forEach(v=>state.observer.observe(v)); }
function lightboxTemplate(){ return `<div class="lb-root" id="lbRoot" role="dialog" aria-modal="true"><div class="lb-backdrop"><div class="lb-backdrop-bg" id="lbBackdropBg"></div><div class="lb-backdrop-overlay"></div></div><div class="lb-header"><div class="lb-brand"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9z"/><path d="M9 22V12h6v10"/></svg>Milovi Cake</div><div class="lb-counter" id="lbCounter"></div><button class="lb-close" id="lbClose" type="button" aria-label="Закрыть"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div><button class="lb-nav lb-nav-prev" id="lbPrev" type="button" aria-label="Предыдущая"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg></button><button class="lb-nav lb-nav-next" id="lbNext" type="button" aria-label="Следующая"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></button><div class="lb-swiper-wrap"><div class="swiper lb-swiper" id="lbSwiper"><div class="swiper-wrapper" id="lbWrapper"></div></div></div><div class="lb-info"><div class="lb-info-inner"><h2 class="lb-title" id="lbTitle"></h2><p class="lb-desc" id="lbDesc"></p></div></div><div class="lb-thumbs" id="lbThumbs"></div></div>`; }
function openLightbox(index){
  state.lbIndex=index; document.body.insertAdjacentHTML('beforeend',lightboxTemplate()); document.body.style.overflow='hidden'; const wrapper=$('#lbWrapper'), thumbs=$('#lbThumbs');
  state.visible.forEach((item,i)=>{ const slide=document.createElement('div'); slide.className='swiper-slide'; const wrap=document.createElement('div'); wrap.className='lb-media-wrap'; if(item.type==='video'){ const v=document.createElement('video'); v.className='lb-media'; v.src=item.videoSrc; v.poster=item.src; v.muted=true; v.loop=true; v.playsInline=true; v.preload=Math.abs(i-index)<=1?'auto':'metadata'; if(i===index) v.controls=true; wrap.appendChild(v); if(i===index){const hint=document.createElement('div'); hint.className='lb-video-hint'; hint.textContent='Видео'; wrap.appendChild(hint);} } else { const img=document.createElement('img'); img.className='lb-media'; img.src=item.fullSrc||item.src; img.alt=item.title; img.loading=Math.abs(i-index)<=1?'eager':'lazy'; img.onerror=()=>{ if(img.src!==item.src) img.src=item.src; }; wrap.appendChild(img); } slide.appendChild(wrap); wrapper.appendChild(slide); const th=document.createElement('button'); th.className='lb-thumb'; th.type='button'; th.setAttribute('aria-label',item.title); th.innerHTML=`<img src="${item.src}" alt="">${item.type==='video'?'<span class="thumb-play"><svg viewBox="0 0 12 12"><path d="M3.5 2v8l6.5-4z"/></svg></span>':''}`; th.addEventListener('click',e=>{e.stopPropagation(); state.swiper?.slideTo(i);}); thumbs.appendChild(th); });
  $('#lbRoot').addEventListener('click',e=>{ if(e.target.id==='lbRoot') closeLightbox(); }); $('.lb-backdrop')?.addEventListener('click',e=>{e.stopPropagation(); closeLightbox();}); $('#lbClose').addEventListener('click',e=>{e.stopPropagation(); closeLightbox();}); $('#lbPrev').addEventListener('click',e=>{e.stopPropagation(); state.swiper?.slidePrev();}); $('#lbNext').addEventListener('click',e=>{e.stopPropagation(); state.swiper?.slideNext();}); initSwiperWhenReady(index); updateLightbox(index,true); window.addEventListener('keydown',onLightboxKey);
}
function initSwiperWhenReady(index){ const init=()=>{ if(!window.Swiper){setTimeout(init,50); return;} const mobile=window.innerWidth<768; state.swiper=new Swiper('#lbSwiper',{effect:'coverflow',grabCursor:true,centeredSlides:true,slidesPerView:'auto',initialSlide:index,speed:600,keyboard:{enabled:true},coverflowEffect:{rotate:mobile?18:28,stretch:mobile?-20:0,depth:mobile?150:280,modifier:1.3,slideShadows:false},on:{slideChange(){updateLightbox(this.activeIndex);},init(){updateLightbox(this.activeIndex,true);}}}); }; init(); }
function updateLightbox(index, immediate=false){ state.lbIndex=index; const item=state.visible[index]; if(!item)return; $('#lbTitle').textContent=item.title; $('#lbDesc').textContent=item.desc; $('#lbCounter').textContent=`${String(index+1).padStart(2,'0')} / ${String(state.visible.length).padStart(2,'0')}`; $('#lbPrev').style.display=index>0?'flex':'none'; $('#lbNext').style.display=index<state.visible.length-1?'flex':'none'; $$('#lbThumbs .lb-thumb').forEach((t,i)=>t.classList.toggle('active',i===index)); $('#lbThumbs').children[index]?.scrollIntoView({behavior:immediate?'auto':'smooth',block:'nearest',inline:'center'}); const bg=$('#lbBackdropBg'); const setBg=()=>{bg.style.backgroundImage=`url("${item.src}")`; bg.classList.remove('is-switching');}; if(immediate)setBg(); else{bg.classList.add('is-switching'); clearTimeout(state.bgTimer); state.bgTimer=setTimeout(setBg,90);} $$('#lbWrapper video').forEach((v,i)=>{v.controls=i===index; if(i===index)v.play().catch(()=>{}); else v.pause();}); history.replaceState(null,'',`#${item.id}`); }
function onLightboxKey(e){ if(e.key==='Escape')closeLightbox(); if(e.key==='ArrowLeft')state.swiper?.slidePrev(); if(e.key==='ArrowRight')state.swiper?.slideNext(); }
function closeLightbox(){ window.removeEventListener('keydown',onLightboxKey); $$('#lbWrapper video').forEach(v=>{v.pause(); v.removeAttribute('src'); v.load();}); if(state.swiper){state.swiper.destroy(true,true); state.swiper=null;} $('#lbRoot')?.remove(); document.body.style.overflow=''; history.replaceState(null,'',location.pathname+location.search); }
function hidePreloader(delay=650){ setTimeout(()=>$('#preloader')?.classList.add('hidden'),delay); setTimeout(()=>$('#preloader')?.remove(),delay+800); }
function boot(){ $('#gxSeal').innerHTML=luxeSeal(); state.items=buildInterleavedItems(); renderFilters(); renderGrid(); $('#resetFilter')?.addEventListener('click',()=>{state.filter='all'; renderFilters(); renderGrid();}); hidePreloader(); setTimeout(()=>hidePreloader(0),5000); const hash=decodeURIComponent(location.hash.replace('#','')); if(hash){ const idx=state.visible.findIndex(item=>item.id===hash); if(idx>=0) setTimeout(()=>openLightbox(idx),350); } }
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else boot();
