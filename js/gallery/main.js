import { GALLERY_ITEMS } from './data.js';

const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
const SIZE_MAP = { tall: '1x2', wide: '2x1', big: '2x2', m: '1x1' };
const filterButtons = [
  { id: 'all', label: 'Все' }, { id: 'photo', label: 'Фото' }, { id: 'video', label: 'Видео' },
  { id: 'wedding', label: 'Свадебные' }, { id: 'bento', label: 'Бенто' }, { id: '3d', label: '3D' },
  { id: 'meringue', label: 'Рулеты' }, { id: 'pavlova', label: 'Павлова' },
  { id: 'bday', label: 'День рождения' },
];
const state = { filter:'all', items:[], visible:[], swiper:null, lbIndex:0, observer:null, bgTimer:null, isNavigating: false };

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
  if (id === 'bday') return `<svg ${a}><path d="M5 11h14v10H5zM12 11V7M9 7a1.5 1.5 0 1 1 3 0M12 7a1.5 1.5 0 1 1 3 0" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>`;
  return `<svg ${a}><path d="M12 3.5 14.8 9.2 20.5 12l-5.7 2.8L12 20.5l-2.8-5.7L3.5 12l5.7-2.8z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>`;
}
function luxeSeal(){ 
  const idSuffix = Math.random().toString(36).substr(2, 5);
  return `<svg viewBox="0 0 100 100" aria-hidden="true" class="gx-seal-svg"><defs><linearGradient id="sealGold_${idSuffix}" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#f5e6c0"/><stop offset="50%" stop-color="#d4a85c"/><stop offset="100%" stop-color="#8e5e20"/></linearGradient><radialGradient id="sealGlow_${idSuffix}" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="rgba(212,168,92,0.45)"/><stop offset="100%" stop-color="rgba(212,168,92,0)"/></radialGradient></defs><circle cx="50" cy="50" r="46" fill="url(#sealGlow_${idSuffix})"/><circle cx="50" cy="50" r="38" fill="none" stroke="url(#sealGold_${idSuffix})" stroke-width="1" opacity="0.7"/><circle cx="50" cy="50" r="32" fill="none" stroke="url(#sealGold_${idSuffix})" stroke-width="0.8" opacity="0.5"/><path d="M50 18 L54 30 L66 32 L57 40 L59 52 L50 47 L41 52 L43 40 L34 32 L46 30 Z" fill="url(#sealGold_${idSuffix})" fill-opacity="0.85"/><circle cx="50" cy="50" r="3.5" fill="url(#sealGold_${idSuffix})"/><circle cx="50" cy="12" r="1.8" fill="url(#sealGold_${idSuffix})" opacity="0.6"/><circle cx="50" cy="88" r="1.8" fill="url(#sealGold_${idSuffix})" opacity="0.6"/><circle cx="12" cy="50" r="1.8" fill="url(#sealGold_${idSuffix})" opacity="0.6"/><circle cx="88" cy="50" r="1.8" fill="url(#sealGold_${idSuffix})" opacity="0.6"/></svg>`; 
}
function renderFilters(){ 
  const wrap=$('#gxFilters'); 
  const activeId = state.filter;
  wrap.innerHTML=filterButtons.map(b=>`<button type="button" class="gx-chip${b.id===activeId?' gx-chip-active':''}" data-filter="${b.id}" aria-pressed="${b.id===activeId}"><span class="gx-chip-icon">${categoryGlyph(b.id)}</span>${esc(b.label)}</button>`).join(''); 
  $$('.gx-chip',wrap).forEach(btn=>btn.addEventListener('click',()=>{
    state.filter=btn.dataset.filter; 
    renderFilters(); 
    renderGrid(); 
    $('#galleryGrid')?.scrollIntoView({behavior:'smooth',block:'start'});
    // Restore focus
    $(`.gx-chip[data-filter="${state.filter}"]`, wrap)?.focus();
  })); 
}
function sizeClasses(size){ if(size==='2x2') return 'col-span-2 row-span-2'; if(size==='2x1') return 'col-span-2'; if(size==='1x2') return 'row-span-2'; return ''; }
function playIcon(){ return '<svg class="play-badge" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>'; }
function renderGrid(){
  state.visible=filteredItems();
  $('#photoCount').textContent=`${state.visible.filter(i=>i.type==='photo').length} фото`;
  $('#videoCount').textContent=`${state.visible.filter(i=>i.type==='video').length} видео`;
  const totalSpan = $('#gxTotalCount');
  if(totalSpan) totalSpan.textContent=String(state.visible.length);
  const grid=$('#galleryGrid'), empty=$('#gxEmpty'); 
  grid.innerHTML=''; 
  if(empty) {
    empty.hidden = state.visible.length > 0; // boolean hidden attr; CSS controls display type
  }
  if(!state.visible.length) return;
  const frag=document.createDocumentFragment();
  state.visible.forEach((item,index)=>{
    const card=document.createElement('button'); 
    card.type='button'; 
    card.className=`card ${sizeClasses(item.size)}`.trim(); 
    // Animation is handled by CSS now (added to fixes), but we keep delay for stagger
    card.style.animationDelay=`${Math.min(index*0.04, 1.2)}s`; 
    card.dataset.index=String(index); 
    card.dataset.id=item.id; 
    card.setAttribute('aria-label',`${item.title}. Открыть в 3D-галерее`);
    if(item.type==='video') { 
      const v=document.createElement('video'); 
      v.className='card-media'; 
      v.poster=item.src; 
      v.muted=true; 
      v.autoplay=true; 
      v.loop=true; 
      v.playsInline=true; 
      v.preload=index<8?'auto':'metadata'; 
      v.dataset.src=item.videoSrc; 
      if(index<8) v.src=item.videoSrc; 
      card.appendChild(v); 
      card.insertAdjacentHTML('beforeend', playIcon()); 
    }
    else { 
      const img=document.createElement('img'); 
      img.className='card-media'; 
      img.src=item.src; 
      img.alt=item.title; 
      img.loading=index<8?'eager':'lazy'; 
      img.decoding='async'; 
      img.onerror=()=>{ if(img.src!==item.src) img.src=item.src; };
      card.appendChild(img); 
    }
    card.insertAdjacentHTML('beforeend', `<div class="card-overlay"><span class="card-title">${esc(item.title)}</span></div>`);
    card.addEventListener('click',()=>openLightbox(index)); 
    attachCardTilt(card); 
    frag.appendChild(card);
  });
  grid.appendChild(frag); 
  setupVideoObserver();
}
function attachCardTilt(card){
  if(matchMedia('(hover: none), (pointer: coarse)').matches) return;
  let raf=0;
  card.addEventListener('mouseenter', () => {
    card.style.zIndex = '100';
    card.style.willChange = 'transform';
  });
  card.addEventListener('mousemove',e=>{ 
    if(raf) return; 
    raf=requestAnimationFrame(()=>{ 
      raf=0; 
      const rect=card.getBoundingClientRect(); 
      const x=e.clientX-rect.left; 
      const y=e.clientY-rect.top; 
      const centerX=rect.width/2; 
      const centerY=rect.height/2; 
      const rotateX=((y-centerY)/centerY)*-10; 
      const rotateY=((x-centerX)/centerX)*10; 
      card.style.transform=`perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.05)`; 
      card.style.setProperty('--mouse-x',`${x}px`); 
      card.style.setProperty('--mouse-y',`${y}px`); 
      card.classList.add('is-active'); 
    }); 
  });
  card.addEventListener('mouseleave',()=>{ 
    cancelAnimationFrame(raf);
    raf = 0;
    card.style.transform='perspective(1000px) rotateX(0deg) rotateY(0deg) scale(1)'; 
    card.classList.remove('is-active'); 
    setTimeout(() => {
      if(!card.classList.contains('is-active')) {
        card.style.zIndex = '';
        card.style.willChange = '';
      }
    }, 600);
  });
}
function setupVideoObserver(){ 
  if(state.observer) state.observer.disconnect(); 
  if(!('IntersectionObserver' in window)) return; 
  state.observer=new IntersectionObserver(entries=>{
    entries.forEach(entry=>{
      const v=entry.target; 
      if(entry.isIntersecting){ 
        if(!v.src&&v.dataset.src)v.src=v.dataset.src; 
        v.play().catch(()=>{});
      } else v.pause();
    });
  },{threshold:.3,rootMargin:'200px 0px'}); 
  $$('#galleryGrid video').forEach(v=>state.observer.observe(v)); 
}
function lightboxTemplate(){ 
  return `<div class="lb-root" id="lbRoot" role="dialog" aria-modal="true" aria-labelledby="lbTitle">
    <div class="lb-backdrop"><div class="lb-backdrop-bg" id="lbBackdropBg"></div><div class="lb-backdrop-overlay"></div></div>
    <div class="lb-header">
      <div class="lb-brand"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9z"/><path d="M9 22V12h6v10"/></svg>Milovi Cake</div>
      <div class="lb-counter" id="lbCounter"></div>
      <button class="lb-close" id="lbClose" type="button" aria-label="Закрыть"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
    </div>
    <button class="lb-nav lb-nav-prev" id="lbPrev" type="button" aria-label="Предыдущая"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg></button>
    <button class="lb-nav lb-nav-next" id="lbNext" type="button" aria-label="Следующая"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></button>
    <div class="lb-swiper-wrap"><div class="swiper lb-swiper" id="lbSwiper"><div class="swiper-wrapper" id="lbWrapper"></div></div></div>
    <div class="lb-info">
      <div class="lb-info-inner">
        <h2 class="lb-title" id="lbTitle"></h2>
        <p class="lb-desc" id="lbDesc"></p>
        <div class="lb-actions">
          <button type="button" class="lb-action" id="lbShare">Поделиться</button>
          <div class="lb-order-choice" aria-label="Написать пожелания по этой работе">
            <span class="lb-order-label">Хочу такой</span>
            <a class="lb-order-icon lb-order-wa" id="lbWantWa" target="_blank" rel="noopener noreferrer" aria-label="Написать в WhatsApp"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.64.08-.3-.15-1.26-.46-2.39-1.48-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.08-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.07c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.69.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35z"/><path d="M12.05 2.01A9.88 9.88 0 0 0 2.16 11.9c0 1.75.46 3.45 1.34 4.95L2.06 22l5.28-1.38a9.88 9.88 0 0 0 4.71 1.2h.01a9.89 9.89 0 0 0-.01-19.81zm0 18.14h-.01a8.2 8.2 0 0 1-4.18-1.14l-.3-.18-3.13.82.84-3.05-.2-.31a8.18 8.18 0 1 1 6.98 3.86z"/></svg></a>
            <a class="lb-order-icon lb-order-tg" id="lbWantTg" target="_blank" rel="noopener noreferrer" data-copy-msg="1" aria-label="Написать в Telegram"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21.7 4.3 2.7 11.7c-1.1.44-1.08 1.05-.2 1.32l4.88 1.52 1.87 5.86c.24.66.12.92.82.92.54 0 .78-.25 1.08-.54l2.6-2.53 5.4 3.99c.99.55 1.7.27 1.95-.92l3.53-16.62c.36-1.45-.55-2.1-1.99-1.5zm-3.26 3.82-8.58 7.75-.34 3.6-1.53-5.1 10.45-6.25z"/></svg></a>
            <a class="lb-order-icon lb-order-max" id="lbWantMax" target="_blank" rel="noopener noreferrer" data-copy-msg="1" aria-label="Написать в MAX"><svg viewBox="0 0 100 100" aria-hidden="true"><path d="M50 8C27 8 10 25 10 47c0 9 3 17 8 24l-3 15 15-4c6 3 13 5 21 5 23 0 40-17 40-39C91 25 73 8 50 8zm14 56c-9 8-22 9-32 3-2-1-4-1-6 1l-2 1 1-4c1-2 0-4-1-6-3-5-5-10-5-16 0-16 13-27 31-27 17 0 30 11 30 27 0 8-3 15-10 21z"/><path d="M38 34h8l6 12 6-12h8v32h-8V48l-5 10h-3l-5-10v18h-8V34z"/></svg></a>
          </div>
          <button type="button" class="lb-action" id="lbCopy">Копировать ссылку</button>
        </div>
        <p class="lb-disclaimer">Это референс, детали обсуждаются индивидуально</p>
      </div>
    </div>
    <div class="lb-thumbs" id="lbThumbs"></div>
  </div>`; 
}
function openLightbox(index){
  if ($('#lbRoot')) {
    closeLightbox._skipObserverRestore = true; // don't rebuild observer, we'll disconnect it immediately
    closeLightbox();
  }
  // Pause grid videos
  if(state.observer) state.observer.disconnect();
  $$('#galleryGrid video').forEach(v => v.pause());

  index = Math.max(0, Math.min(Number(index) || 0, state.visible.length - 1));
  state.lbIndex=index; 
  document.body.insertAdjacentHTML('beforeend',lightboxTemplate()); 
  document.body.style.overflow='hidden'; 
  const wrapper=$('#lbWrapper'), thumbs=$('#lbThumbs');
  
  state.visible.forEach((item,i)=>{ 
    const slide=document.createElement('div'); 
    slide.className='swiper-slide'; 
    const wrap=document.createElement('div'); 
    wrap.className='lb-media-wrap'; 
    if(item.type==='video'){ 
      const v=document.createElement('video'); 
      v.className='lb-media'; 
      // Lazy load video src
      if(Math.abs(i-index) <= 1) v.src=item.videoSrc;
      else v.dataset.pendingSrc = item.videoSrc;
      
      v.poster=item.src; 
      v.muted=true; 
      v.loop=true; 
      v.playsInline=true; 
      v.preload='metadata'; 
      wrap.appendChild(v); 
      const hint=document.createElement('div'); 
      hint.className='lb-video-hint'; 
      hint.textContent='Видео'; 
      wrap.appendChild(hint);
    } else { 
      const img=document.createElement('img'); 
      img.className='lb-media'; 
      img.src=item.fullSrc||item.src; 
      img.alt=item.title; 
      img.loading=Math.abs(i-index)<=1?'eager':'lazy'; 
      img.onerror=()=>{ if(img.src!==item.src) img.src=item.src; }; 
      wrap.appendChild(img); 
    } 
    slide.appendChild(wrap); 
    wrapper.appendChild(slide); 
    const th=document.createElement('button'); 
    th.className='lb-thumb'; 
    th.type='button'; 
    th.setAttribute('aria-label',item.title); 
    th.innerHTML=`<img src="${item.src}" alt="">${item.type==='video'?'<span class="thumb-play"><svg viewBox="0 0 12 12"><path d="M3.5 2v8l6.5-4z"/></svg></span>':''}`; 
    th.addEventListener('click',e=>{e.stopPropagation(); state.swiper?.slideTo(i);}); 
    thumbs.appendChild(th); 
  });
  
  $('#lbRoot').addEventListener('click',e=>{ if(e.target.id==='lbRoot') closeLightbox(); }); 
  $('.lb-backdrop')?.addEventListener('click',e=>{e.stopPropagation(); closeLightbox();}); 
  $('#lbClose').addEventListener('click',e=>{e.stopPropagation(); closeLightbox();}); 
  $('#lbPrev').addEventListener('click',e=>{e.stopPropagation(); state.swiper?.slidePrev();}); 
  $('#lbNext').addEventListener('click',e=>{e.stopPropagation(); state.swiper?.slideNext();}); 
  $('#lbShare')?.addEventListener('click', e=>{ e.stopPropagation(); shareCurrentWork(); }); 
  $('#lbCopy')?.addEventListener('click', e=>{ e.stopPropagation(); copyCurrentLink(); }); 
  $$('#lbRoot [data-copy-msg]').forEach(a=>a.addEventListener('click',()=>copyWishText(a.dataset.msg||''))); 
  
  initSwiperWhenReady(index); 
  updateLightbox(index,true); 
  window.addEventListener('keydown',onLightboxKey);
  window.addEventListener('popstate', onPopState);
  
  // Focus trap
  $('#lbClose').focus();
}

function onPopState() {
  if ($('#lbRoot')) closeLightbox(false);
}

function initSwiperWhenReady(index){ 
  let _swiperTries = 0;
  const _swiperToken = {};
  state._swiperAbort = _swiperToken;
  const init=()=>{ 
    if(state._swiperAbort !== _swiperToken) return;
    if(!window.Swiper){ 
      if(++_swiperTries >= 120){
        console.warn('[Milovi] Swiper CDN timeout');
        return;
      }
      setTimeout(init,50); 
      return; 
    } 
    const mobile=window.innerWidth<768; 
    state.swiper=new Swiper('#lbSwiper',{
      effect:'coverflow',
      grabCursor:true,
      centeredSlides:true,
      slidesPerView:'auto',
      initialSlide:index,
      speed:600,
      keyboard:false, // Managed by onLightboxKey to avoid double nav
      observer:true,
      observeParents:true,
      coverflowEffect:{rotate:mobile?18:28,stretch:mobile?-20:0,depth:mobile?150:280,modifier:1.3,slideShadows:false},
      on:{
        slideChange(){updateLightbox(this.activeIndex);},
        init(){
          // updateLightbox already called in openLightbox
        }
      }
    }); 
  }; 
  init(); 
}
function updateLightbox(index, immediate=false){ 
  state.lbIndex=index; 
  const item=state.visible[index]; 
  if(!item)return; 
  $('#lbTitle').textContent=item.title; 
  $('#lbDesc').textContent=item.desc; 
  $('#lbCounter').textContent=`${String(index+1).padStart(2,'0')} / ${String(state.visible.length).padStart(2,'0')}`; 
  $('#lbPrev').style.display=index>0?'flex':'none'; 
  $('#lbNext').style.display=index<state.visible.length-1?'flex':'none'; 
  $$('#lbThumbs .lb-thumb').forEach((t,i)=>t.classList.toggle('active',i===index)); 
  
  if(!immediate && !state.isNavigating) {
    state.isNavigating = true;
    $('#lbThumbs').children[index]?.scrollIntoView({behavior:'smooth',block:'nearest',inline:'center'});
    setTimeout(() => { state.isNavigating = false; }, 500);
  } else if (immediate) {
    $('#lbThumbs').children[index]?.scrollIntoView({behavior:'auto',block:'nearest',inline:'center'});
  }

  const bg=$('#lbBackdropBg'); 
  const setBg=()=>{
    if(!bg) return;
    bg.style.backgroundImage=`url("${item.src}")`; 
    bg.classList.remove('is-switching');
  }; 
  if(immediate)setBg(); 
  else{
    bg.classList.add('is-switching'); 
    clearTimeout(state.bgTimer); 
    state.bgTimer=setTimeout(setBg,90);
  } 

  // Lazy load video src and handle play/pause
  $$('#lbWrapper .swiper-slide').forEach((slide, i) => {
    const v = $('video', slide);
    if (!v) return;
    
    if (Math.abs(i - index) <= 1) {
      if (!v.src && v.dataset.pendingSrc) {
        v.src = v.dataset.pendingSrc;
        delete v.dataset.pendingSrc;
      }
    }
    
    v.controls = (i === index);
    if (i === index) v.play().catch(()=>{});
    else v.pause();
  });

  const url = `${location.origin}${location.pathname}#${encodeURIComponent(item.id)}`; 
  const wishText = buildWishText(item, url);
  $('#lbWantWa')?.setAttribute('href', buildContactUrl('wa', item, url)); 
  $('#lbWantTg')?.setAttribute('href', buildContactUrl('tg', item, url)); 
  $('#lbWantMax')?.setAttribute('href', buildContactUrl('max', item, url)); 
  $$('#lbRoot [data-copy-msg]').forEach(a=>{ a.dataset.msg = wishText; }); 
  
  if (decodeURIComponent(location.hash.replace('#','')) !== item.id) {
    history.replaceState(null,'',`#${item.id}`); 
  }
}

function currentWork() { return state.visible[state.lbIndex]; }
function currentWorkUrl(item = currentWork()) { return item ? `${location.origin}${location.pathname}#${encodeURIComponent(item.id)}` : location.href; }
function buildWishText(item, url = currentWorkUrl(item)) {
  return `Здравствуйте! Хочу торт по примеру: ${item?.title || 'работа из галереи'} (${url}). Мои пожелания: `;
}
function buildContactUrl(channel, item, url = currentWorkUrl(item)) {
  const text = buildWishText(item, url);
  if (channel === 'wa') return `https://wa.me/79119038886?text=${encodeURIComponent(text)}`;
  if (channel === 'tg') return `https://t.me/+79119038886?text=${encodeURIComponent(text)}`;
  if (channel === 'max') return `https://max.ru/+79119038886`;
  return url;
}
async function copyWishText(text) {
  if (!text) return;
  try { 
    await navigator.clipboard?.writeText(text); 
    const tgBtn = $('#lbWantTg');
    if (!tgBtn) return; // null-guard: lightbox may close during async clipboard write
    tgBtn.classList.add('copy-success');
    setTimeout(() => tgBtn.classList.remove('copy-success'), 1500);
  }
  catch(e) {}
}
async function shareCurrentWork() {
  const item = currentWork(); if (!item) return;
  const url = currentWorkUrl(item);
  const text = `${item.title} — ${item.desc}. Milovi Cake, торты на заказ в Санкт-Петербурге.`;
  
  if (navigator.share) {
    try { await navigator.share({ title: item.title, text, url }); } catch (e) {}
  } else {
    // Show a simple custom share menu or just copy
    copyCurrentLink();
  }
}
async function copyCurrentLink() {
  const item = currentWork(); const url = currentWorkUrl(item);
  try { 
    await navigator.clipboard.writeText(url); 
    const b=$('#lbCopy'); 
    if(b){ 
      const t=b.textContent; 
      b.textContent='Ссылка скопирована'; 
      setTimeout(()=>b.textContent=t,1400); 
    } 
  }
  catch(e) { prompt('Скопируйте ссылку на работу:', url); }
}

function onLightboxKey(e){ 
  if(e.key==='Escape') closeLightbox(); 
  if(e.key==='ArrowLeft') state.swiper?.slidePrev(); 
  if(e.key==='ArrowRight') state.swiper?.slideNext(); 
  if(e.key==='Tab') {
    const focusables = $$('button, a', $('#lbRoot'));
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
}
function closeLightbox(updateState = true){ 
  state._swiperAbort = null; // abort pending Swiper init
  window.removeEventListener('keydown',onLightboxKey); 
  window.removeEventListener('popstate', onPopState);
  clearTimeout(state.bgTimer);
  $$('#lbWrapper video').forEach(v=>{v.pause(); v.removeAttribute('src'); v.load();}); 
  if(state.swiper){state.swiper.destroy(true,true); state.swiper=null;} 
  $('#lbRoot')?.remove(); 
  document.body.style.overflow=''; 
  if (updateState) history.replaceState(null,'',location.pathname+location.search); 
  if (!closeLightbox._skipObserverRestore) setupVideoObserver(); // Re-enable grid videos
  closeLightbox._skipObserverRestore = false;
}
function hidePreloader(delay=650){ 
  const p = $('#preloader');
  if(!p) return;
  setTimeout(()=>p.classList.add('hidden'),delay); 
  setTimeout(()=>p.remove(),delay+800); 
}
function boot(){ 
  const seal = $('#gxSeal');
  if(seal) seal.innerHTML=luxeSeal(); 
  state.items=buildInterleavedItems(); 
  renderFilters(); 
  renderGrid(); 
  $('#resetFilter')?.addEventListener('click',()=>{state.filter='all'; renderFilters(); renderGrid();}); 
  hidePreloader(); 
  setTimeout(()=>hidePreloader(0),5000); 
  const hash=decodeURIComponent(location.hash.replace('#','')); 
  if(hash){ 
    const idx=state.visible.findIndex(item=>item.id===hash); 
    if(idx>=0) setTimeout(()=>openLightbox(idx),350); 
  } 
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else boot();
