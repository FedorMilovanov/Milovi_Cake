/* ===========================================================================
 * Milovi Cake — Gallery Data (Single Source of Truth)
 * 46 works: 30 photos + 16 videos
 * Поля: { id, type, src, full?, poster?, title, desc, tags[], size? }
 * size: 'm' (1×1), 'tall' (1×2), 'wide' (2×1), 'big' (2×2)
 * tags: 3d | bento | meringue | wedding | pavlova | bday
 * --------------------------------------------------------------------------- */
export const GALLERY_ITEMS = [
  // ========== VIDEOS (16) ==========
  { id: 'v01', type: 'video', src: '/img/gallery/videos/video-01-knigi.webm',          poster: '/img/gallery/gallery-15.webp', title: 'Видео: 3D-торт «Книги»',          desc: 'Скульптурный 3D-торт в виде книг — идея для персонального праздника', tags: ['3d','bday'], size: 'tall' },
  { id: 'v02', type: 'video', src: '/img/gallery/videos/video-02-spb-cakes.webm',      poster: '/img/gallery/gallery-14.webp', title: 'Видео: фактурный торт с золотом', desc: 'Авторский праздничный торт с объёмным декором и золотыми акцентами', tags: ['bday'] },
  { id: 'v03', type: 'video', src: '/img/gallery/videos/video-03-bday.webm',           poster: '/img/gallery/gallery-20.webp', title: 'Видео: торт на 20-летие',         desc: 'Голубой торт на день рождения с праздничным декором', tags: ['bday'], size: 'wide' },
  { id: 'v04', type: 'video', src: '/img/gallery/videos/video-04-eclair.webm',         poster: '/img/gallery/gallery-25.webp', title: 'Видео: меренговый рулет',         desc: 'Нежный меренговый десерт с кремом и золотыми акцентами', tags: ['meringue'] },
  { id: 'v05', type: 'video', src: '/img/gallery/videos/video-05-secret.webm',         poster: '/img/gallery/gallery-23.webp', title: 'Видео: бенто с признанием',       desc: 'Мини-торт с персональной надписью — компактный формат для подарка', tags: ['bento'] },
  { id: 'v06', type: 'video', src: '/img/gallery/videos/video-06-bento-love.webm',     poster: '/img/gallery/gallery-29.webp', title: 'Видео: бенто Love',              desc: 'Романтичный бенто-торт с кремовым декором', tags: ['bento'] },
  { id: 'v07', type: 'video', src: '/img/gallery/videos/video-07-bento-bday.webm',     poster: '/img/gallery/gallery-19.webp', title: 'Видео: бенто на день рождения',  desc: 'Небольшой праздничный торт с милой иллюстрацией и надписью', tags: ['bento','bday'], size: 'tall' },
  { id: 'v08', type: 'video', src: '/img/gallery/videos/video-08-foxes.webm',          poster: '/img/gallery/gallery-10.webp', title: 'Видео: 3D-торт с лисёнком',       desc: 'Детский 3D-торт с ручной лепкой персонажа', tags: ['3d','bday'] },
  { id: 'v09', type: 'video', src: '/img/gallery/videos/video-09-cupcakes-berry.webm', poster: '/img/gallery/gallery-16.webp', title: 'Видео: капкейки с ягодами',       desc: 'Набор капкейков с кремом и ягодным декором', tags: ['bday'] },
  { id: 'v10', type: 'video', src: '/img/gallery/videos/video-10-cupcakes.webm',       poster: '/img/gallery/gallery-09.webp', title: 'Видео: праздничные капкейки',     desc: 'Капкейки ручной работы с ярким кремовым оформлением', tags: ['bday'] },
  { id: 'v11', type: 'video', src: '/img/gallery/videos/video-11-bears.webm',          poster: '/img/gallery/gallery-02.webp', title: 'Видео: торт с мишками',          desc: 'Нежный детский торт с фигурками и розовым декором', tags: ['3d','bday'], size: 'wide' },
  { id: 'v12', type: 'video', src: '/img/gallery/videos/video-12-wedding-heart.webm',  poster: '/img/gallery/gallery-11.webp', title: 'Видео: свадебный торт с сердцем', desc: 'Светлый свадебный торт с минималистичным декором', tags: ['wedding'], size: 'tall' },
  { id: 'v13', type: 'video', src: '/img/gallery/videos/video-13-bunny.webm',          poster: '/img/gallery/gallery-03.webp', title: 'Видео: детский торт с зайчиком',  desc: 'Нежный детский торт с зайчиком и цветочным декором', tags: ['3d','bday'] },
  { id: 'v14', type: 'video', src: '/img/gallery/videos/video-14-blue-balloons.webm',  poster: '/img/gallery/gallery-06.webp', title: 'Видео: торт с шарами',           desc: 'Праздничный торт с воздушными шарами и контрастным декором', tags: ['bday'] },
  { id: 'v15', type: 'video', src: '/img/gallery/videos/video-15-basketball.webm',     poster: '/img/gallery/gallery-17.webp', title: 'Видео: 3D-торт «Баскетбол»',     desc: 'Спортивный торт с баскетбольной тематикой', tags: ['3d','bday'] },
  { id: 'v16', type: 'video', src: '/img/gallery/videos/video-16-moon-stars.webm',     poster: '/img/gallery/gallery-26.webp', title: 'Видео: торт «Луна и звёзды»',    desc: 'Голубой торт с космическими мотивами и золотыми звёздами', tags: ['bday'] },

  // ========== PHOTOS (30) ==========
  { id: 'p01', type: 'photo', src: '/img/gallery/gallery-01.webp', full: '/img/gallery/gallery-01-hd.webp', title: 'Шоколадный торт с мишками',       desc: 'Шоколадный праздничный торт с объёмным декором', tags: ['3d','bday'], size: 'big' },
  { id: 'p02', type: 'photo', src: '/img/gallery/gallery-02.webp', full: '/img/gallery/gallery-02-hd.webp', title: 'Розовый торт с цветами',          desc: 'Нежный торт на день рождения с цветочным декором', tags: ['bday'] },
  { id: 'p03', type: 'photo', src: '/img/gallery/gallery-03.webp', full: '/img/gallery/gallery-03-hd.webp', title: 'Детский торт с зайчиком',        desc: 'Праздничный торт с зайчиком, цветами и звёздами', tags: ['3d','bday'] },
  { id: 'p04', type: 'photo', src: '/img/gallery/gallery-04.webp', full: '/img/gallery/gallery-04-hd.webp', title: '3D-торт в прозрачном цилиндре',  desc: 'Сложный торт с персонажем, шарами и прозрачной конструкцией', tags: ['3d','bday'], size: 'tall' },
  { id: 'p05', type: 'photo', src: '/img/gallery/gallery-05.webp', full: '/img/gallery/gallery-05-hd.webp', title: '3D-торт с хоккейной сценой',     desc: 'Тематический торт под стеклянным куполом', tags: ['3d','bday'] },
  { id: 'p06', type: 'photo', src: '/img/gallery/gallery-06.webp', full: '/img/gallery/gallery-06-hd.webp', title: 'Чёрно-золотой торт с шарами',    desc: 'Премиальный торт в чёрно-золотой гамме', tags: ['bday'] },
  { id: 'p07', type: 'photo', src: '/img/gallery/gallery-07.webp', full: '/img/gallery/gallery-07-hd.webp', title: 'Премиальный торт с золотом',     desc: 'Высокий авторский торт с золотым декором', tags: ['bday'], size: 'wide' },
  { id: 'p08', type: 'photo', src: '/img/gallery/gallery-08.webp', full: '/img/gallery/gallery-08-hd.webp', title: 'Бенто «Горжусь тобой»',          desc: 'Мини-торт с персональной надписью', tags: ['bento'] },
  { id: 'p09', type: 'photo', src: '/img/gallery/gallery-09.webp', full: '/img/gallery/gallery-09-hd.webp', title: 'Праздничный торт в цилиндре',    desc: 'Авторский торт с воздушными шарами и декором', tags: ['bday'] },
  { id: 'p10', type: 'photo', src: '/img/gallery/gallery-10.webp', full: '/img/gallery/gallery-10-hd.webp', title: '3D-торт с мышонком',            desc: 'Скульптурный торт с фигуркой персонажа', tags: ['3d','bday'] },
  { id: 'p11', type: 'photo', src: '/img/gallery/gallery-11.webp', full: '/img/gallery/gallery-11-hd.webp', title: 'Светлый свадебный торт',        desc: 'Элегантный белый торт для камерной свадьбы', tags: ['wedding'], size: 'tall' },
  { id: 'p12', type: 'photo', src: '/img/gallery/gallery-12.webp', full: '/img/gallery/gallery-12-hd.webp', title: 'Бенто Happy Birthday',          desc: 'Небольшой торт на день рождения с надписью', tags: ['bento','bday'] },
  { id: 'p13', type: 'photo', src: '/img/gallery/gallery-13.webp', full: '/img/gallery/gallery-13-hd.webp', title: 'Чёрно-золотой торт с перьями',  desc: 'Эффектный праздничный торт в тёмной гамме', tags: ['bday'] },
  { id: 'p14', type: 'photo', src: '/img/gallery/gallery-14.webp', full: '/img/gallery/gallery-14-hd.webp', title: 'Фактурный торт с карамелью',    desc: 'Авторский торт с объёмным декором и золотом', tags: ['bday'] },
  { id: 'p15', type: 'photo', src: '/img/gallery/gallery-15.webp', full: '/img/gallery/gallery-15-hd.webp', title: 'Подарочный десертный набор',    desc: 'Набор сладостей в подарочной упаковке', tags: ['bday'], size: 'big' },
  { id: 'p16', type: 'photo', src: '/img/gallery/gallery-16.webp', full: '/img/gallery/gallery-16-hd.webp', title: 'Капкейки с кремовым декором',   desc: 'Подарочный набор капкейков', tags: ['bday'] },
  { id: 'p17', type: 'photo', src: '/img/gallery/gallery-17.webp', full: '/img/gallery/gallery-17-hd.webp', title: 'Павлова с ягодной начинкой',    desc: 'Воздушный десерт Павлова с ягодным центром', tags: ['pavlova'] },
  { id: 'p18', type: 'photo', src: '/img/gallery/gallery-18.webp', full: '/img/gallery/gallery-18-hd.webp', title: 'Премиальный торт с золотом',     desc: 'Торт в прозрачном цилиндре с золотыми акцентами', tags: ['bday'] },
  { id: 'p19', type: 'photo', src: '/img/gallery/gallery-19.webp', full: '/img/gallery/gallery-19-hd.webp', title: 'Бенто ко дню рождения',         desc: 'Мини-торт с поздравительной надписью', tags: ['bento','bday'], size: 'tall' },
  { id: 'p20', type: 'photo', src: '/img/gallery/gallery-20.webp', full: '/img/gallery/gallery-20-hd.webp', title: '3D-торт в стиле Minecraft',     desc: 'Детский торт с игровым персонажем и шарами', tags: ['3d','bday'] },
  { id: 'p21', type: 'photo', src: '/img/gallery/gallery-21.webp', full: '/img/gallery/gallery-21-hd.webp', title: '3D-торт Minecraft',             desc: 'Вертикальная композиция с игровым героем', tags: ['3d','bday'] },
  { id: 'p22', type: 'photo', src: '/img/gallery/gallery-22.webp', full: '/img/gallery/gallery-22-hd.webp', title: '3D-торт с собаками',            desc: 'Шоколадный торт с объёмными фигурками собак', tags: ['3d','bday'], size: 'wide' },
  { id: 'p23', type: 'photo', src: '/img/gallery/gallery-23.webp', full: '/img/gallery/gallery-23-hd.webp', title: 'Бенто с романтичной надписью',   desc: 'Мини-торт с ягодами и персональным посланием', tags: ['bento'] },
  { id: 'p24', type: 'photo', src: '/img/gallery/gallery-24.webp', full: '/img/gallery/gallery-24-hd.webp', title: '3D-торт Minecraft с зеленью',    desc: 'Тематический торт с игровым декором и фактурой', tags: ['3d','bday'] },
  { id: 'p25', type: 'photo', src: '/img/gallery/gallery-25.webp', full: '/img/gallery/gallery-25-hd.webp', title: 'Меренговые рулеты в коробке',   desc: 'Подарочный набор меренговых рулетов', tags: ['meringue'] },
  { id: 'p26', type: 'photo', src: '/img/gallery/gallery-26.webp', full: '/img/gallery/gallery-26-hd.webp', title: 'Мини Павлова с кремом',          desc: 'Порционные десерты Павлова с нежным кремом', tags: ['pavlova'] },
  { id: 'p27', type: 'photo', src: '/img/gallery/gallery-27.webp', full: '/img/gallery/gallery-27-hd.webp', title: 'Бенто Happy Birthday',          desc: 'Мини-торт с поздравительной надписью', tags: ['bento','bday'] },
  { id: 'p28', type: 'photo', src: '/img/gallery/gallery-28.webp', full: '/img/gallery/gallery-28-hd.webp', title: 'Павлова с кремом и орехами',    desc: 'Порционный десерт Павлова крупным планом', tags: ['pavlova'] },
  { id: 'p29', type: 'photo', src: '/img/gallery/gallery-29.webp', full: '/img/gallery/gallery-29-hd.webp', title: 'Торт к 8 Марта',                desc: 'Нежный сиреневый торт с цветочным декором', tags: ['bday'] },
  { id: 'p30', type: 'photo', src: '/img/gallery/gallery-30.webp', full: '/img/gallery/gallery-30-hd.webp', title: 'Подарочный бенто-торт',         desc: 'Мини-торт в коробке с праздничным оформлением', tags: ['bento'] },
];

if (typeof window !== 'undefined') {
  window.GALLERY_ITEMS = GALLERY_ITEMS;
}
