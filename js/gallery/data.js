/* ===========================================================================
 * Milovi Cake — Gallery Data (Single Source of Truth)
 * 46 works: 30 photos + 16 videos
 * Each item: { id, type, src, full?, poster?, title, desc, tags[], size? }
 *   size: 'm' (default 1×1), 'tall' (1×2), 'wide' (2×1), 'big' (2×2)
 *   tags: any of: photo|video|3d|bento|meringue|wedding|pavlova|bday
 * --------------------------------------------------------------------------- */
export const GALLERY_ITEMS = [
  // ========== VIDEOS (16) ==========
  { id: 'v01', type: 'video', src: '/img/gallery/videos/video-01-knigi.webm',          poster: '/img/gallery/gallery-15.webp', title: '3D-торт «Книги»',              desc: 'Авторский торт в виде стопки книг с именами — ручная лепка, съедобная мастика', tags: ['3d','bday'],   size: 'tall' },
  { id: 'v02', type: 'video', src: '/img/gallery/videos/video-02-spb-cakes.webm',      poster: '/img/gallery/gallery-07.webp', title: 'Витрина авторских тортов',     desc: 'Обзор премиум-тортов студии Milovi Cake — Санкт-Петербург', tags: ['bday'] },
  { id: 'v03', type: 'video', src: '/img/gallery/videos/video-03-bday.webm',           poster: '/img/gallery/gallery-03.webp', title: 'Торт на день рождения',        desc: 'Праздничное оформление с авторским декором', tags: ['bday'], size: 'wide' },
  { id: 'v04', type: 'video', src: '/img/gallery/videos/video-04-eclair.webm',         poster: '/img/gallery/gallery-12.webp', title: 'Эклеры с зеркальной глазурью', desc: 'Авторские эклеры — крем шантильи, ваниль из Мадагаскара', tags: ['pavlova'] },
  { id: 'v05', type: 'video', src: '/img/gallery/videos/video-05-secret.webm',         poster: '/img/gallery/gallery-19.webp', title: '«Секрет» внутри торта',        desc: 'Сюрприз внутри — конфеты высыпаются при разрезе', tags: ['3d','bday'] },
  { id: 'v06', type: 'video', src: '/img/gallery/videos/video-06-bento-love.webm',     poster: '/img/gallery/gallery-06.webp', title: 'Бенто «Love»',                 desc: 'Мини-торт с признанием — идеально для двоих', tags: ['bento'] },
  { id: 'v07', type: 'video', src: '/img/gallery/videos/video-07-bento-bday.webm',     poster: '/img/gallery/gallery-08.webp', title: 'Бенто на день рождения',       desc: 'Камерный праздник в одном ярком десерте', tags: ['bento','bday'], size: 'tall' },
  { id: 'v08', type: 'video', src: '/img/gallery/videos/video-08-foxes.webm',          poster: '/img/gallery/gallery-05.webp', title: '3D-торт «Лисята»',             desc: 'Скульптурная лепка персонажей вручную', tags: ['3d','bday'] },
  { id: 'v09', type: 'video', src: '/img/gallery/videos/video-09-cupcakes-berry.webm', poster: '/img/gallery/gallery-22.webp', title: 'Капкейки с ягодами',           desc: 'Свежая малина и черника, крем на маскарпоне', tags: ['bday'] },
  { id: 'v10', type: 'video', src: '/img/gallery/videos/video-10-cupcakes.webm',       poster: '/img/gallery/gallery-23.webp', title: 'Праздничные капкейки',         desc: 'Авторская подача и фирменный декор', tags: ['bday'] },
  { id: 'v11', type: 'video', src: '/img/gallery/videos/video-11-bears.webm',          poster: '/img/gallery/gallery-01.webp', title: '3D-торт с мишками',            desc: 'Детский торт со скульптурными фигурками', tags: ['3d','bday'], size: 'wide' },
  { id: 'v12', type: 'video', src: '/img/gallery/videos/video-12-wedding-heart.webm',  poster: '/img/gallery/gallery-04.webp', title: 'Свадебный торт «Сердце»',      desc: 'Минимализм, белый шёлк крема, ягодный акцент', tags: ['wedding'], size: 'tall' },
  { id: 'v13', type: 'video', src: '/img/gallery/videos/video-13-bunny.webm',          poster: '/img/gallery/gallery-11.webp', title: '3D-торт «Зайчик»',             desc: 'Детский 3D-торт ручной работы', tags: ['3d','bday'] },
  { id: 'v14', type: 'video', src: '/img/gallery/videos/video-14-blue-balloons.webm',  poster: '/img/gallery/gallery-13.webp', title: 'Торт с голубыми шариками',     desc: 'Воздушное оформление для мальчика', tags: ['bday'] },
  { id: 'v15', type: 'video', src: '/img/gallery/videos/video-15-basketball.webm',     poster: '/img/gallery/gallery-17.webp', title: '3D-торт «Баскетбол»',          desc: 'Спортивная тематика — ручная роспись', tags: ['3d','bday'] },
  { id: 'v16', type: 'video', src: '/img/gallery/videos/video-16-moon-stars.webm',     poster: '/img/gallery/gallery-25.webp', title: 'Торт «Луна и звёзды»',         desc: 'Космическое оформление с золотым декором', tags: ['bday'] },

  // ========== PHOTOS (30) ==========
  { id: 'p01', type: 'photo', src: '/img/gallery/gallery-01.webp', full: '/img/gallery/gallery-01-hd.webp', title: '3D-торт с мишками',          desc: 'Детский торт со скульптурными мишками — ручная лепка', tags: ['3d','bday'], size: 'big' },
  { id: 'p02', type: 'photo', src: '/img/gallery/gallery-02.webp', full: '/img/gallery/gallery-02-hd.webp', title: 'Торт с цветами',             desc: 'Букет крем-чиз цветов — нежная пастель', tags: ['bday'] },
  { id: 'p03', type: 'photo', src: '/img/gallery/gallery-03.webp', full: '/img/gallery/gallery-03-hd.webp', title: 'Праздничный торт',           desc: 'Многоярусный праздничный торт', tags: ['bday'] },
  { id: 'p04', type: 'photo', src: '/img/gallery/gallery-04.webp', full: '/img/gallery/gallery-04-hd.webp', title: 'Свадебный торт',             desc: 'Элегантный белый свадебный торт', tags: ['wedding'], size: 'tall' },
  { id: 'p05', type: 'photo', src: '/img/gallery/gallery-05.webp', full: '/img/gallery/gallery-05-hd.webp', title: '3D-торт «Лиса»',             desc: 'Авторская скульптурная лепка', tags: ['3d','bday'] },
  { id: 'p06', type: 'photo', src: '/img/gallery/gallery-06.webp', full: '/img/gallery/gallery-06-hd.webp', title: 'Бенто «Сердце»',             desc: 'Романтичный мини-торт', tags: ['bento'] },
  { id: 'p07', type: 'photo', src: '/img/gallery/gallery-07.webp', full: '/img/gallery/gallery-07-hd.webp', title: 'Витрина тортов',             desc: 'Премиум-композиция авторских тортов', tags: ['bday'], size: 'wide' },
  { id: 'p08', type: 'photo', src: '/img/gallery/gallery-08.webp', full: '/img/gallery/gallery-08-hd.webp', title: 'Бенто к празднику',          desc: 'Камерный праздничный десерт', tags: ['bento','bday'] },
  { id: 'p09', type: 'photo', src: '/img/gallery/gallery-09.webp', full: '/img/gallery/gallery-09-hd.webp', title: 'Павлова с клубникой',        desc: 'Хрустящая Павлова со свежей клубникой', tags: ['pavlova'] },
  { id: 'p10', type: 'photo', src: '/img/gallery/gallery-10.webp', full: '/img/gallery/gallery-10-hd.webp', title: 'Торт с ягодами',             desc: 'Свежая малина, черника и ежевика', tags: ['bday'] },
  { id: 'p11', type: 'photo', src: '/img/gallery/gallery-11.webp', full: '/img/gallery/gallery-11-hd.webp', title: '3D-торт «Зайчик»',           desc: 'Детский торт с ручной лепкой', tags: ['3d','bday'], size: 'tall' },
  { id: 'p12', type: 'photo', src: '/img/gallery/gallery-12.webp', full: '/img/gallery/gallery-12-hd.webp', title: 'Эклеры авторские',           desc: 'Эклеры с зеркальной глазурью', tags: ['pavlova'] },
  { id: 'p13', type: 'photo', src: '/img/gallery/gallery-13.webp', full: '/img/gallery/gallery-13-hd.webp', title: 'Торт «Голубые шары»',        desc: 'Праздничный торт для мальчика', tags: ['bday'] },
  { id: 'p14', type: 'photo', src: '/img/gallery/gallery-14.webp', full: '/img/gallery/gallery-14-hd.webp', title: 'Торт «Цветочный сад»',       desc: 'Композиция с живыми цветами', tags: ['wedding','bday'] },
  { id: 'p15', type: 'photo', src: '/img/gallery/gallery-15.webp', full: '/img/gallery/gallery-15-hd.webp', title: 'Праздничная композиция',     desc: 'Многоярусный торт с авторским декором', tags: ['bday'], size: 'big' },
  { id: 'p16', type: 'photo', src: '/img/gallery/gallery-16.webp', full: '/img/gallery/gallery-16-hd.webp', title: 'Торт с золотом',             desc: 'Премиум-декор с пищевым золотом', tags: ['wedding','bday'] },
  { id: 'p17', type: 'photo', src: '/img/gallery/gallery-17.webp', full: '/img/gallery/gallery-17-hd.webp', title: 'Спортивный торт',            desc: 'Авторский торт «Баскетбол»', tags: ['3d','bday'] },
  { id: 'p18', type: 'photo', src: '/img/gallery/gallery-18.webp', full: '/img/gallery/gallery-18-hd.webp', title: 'Романтичный торт',           desc: 'Нежный декор для двоих', tags: ['wedding'] },
  { id: 'p19', type: 'photo', src: '/img/gallery/gallery-19.webp', full: '/img/gallery/gallery-19-hd.webp', title: 'Торт «Сюрприз»',             desc: 'Со скрытым сюрпризом внутри', tags: ['3d','bday'], size: 'tall' },
  { id: 'p20', type: 'photo', src: '/img/gallery/gallery-20.webp', full: '/img/gallery/gallery-20-hd.webp', title: 'Торт классический',          desc: 'Безупречная классика — крем-чиз и ягоды', tags: ['bday'] },
  { id: 'p21', type: 'photo', src: '/img/gallery/gallery-21.webp', full: '/img/gallery/gallery-21-hd.webp', title: 'Торт с фруктами',            desc: 'Сезонные фрукты, сливочный крем', tags: ['bday'] },
  { id: 'p22', type: 'photo', src: '/img/gallery/gallery-22.webp', full: '/img/gallery/gallery-22-hd.webp', title: 'Капкейки с ягодами',         desc: 'Свежая малина, крем-маскарпоне', tags: ['bday'], size: 'wide' },
  { id: 'p23', type: 'photo', src: '/img/gallery/gallery-23.webp', full: '/img/gallery/gallery-23-hd.webp', title: 'Праздничные капкейки',       desc: 'Авторский декор и подача', tags: ['bday'] },
  { id: 'p24', type: 'photo', src: '/img/gallery/gallery-24.webp', full: '/img/gallery/gallery-24-hd.webp', title: 'Торт с орехами',             desc: 'Карамель, грецкий орех, шоколад', tags: ['bday'] },
  { id: 'p25', type: 'photo', src: '/img/gallery/gallery-25.webp', full: '/img/gallery/gallery-25-hd.webp', title: 'Торт «Луна и звёзды»',       desc: 'Космическое оформление с золотом', tags: ['bday'] },
  { id: 'p26', type: 'photo', src: '/img/gallery/gallery-26.webp', full: '/img/gallery/gallery-26-hd.webp', title: 'Торт «Шоколадный»',          desc: 'Бельгийский шоколад, зеркальная глазурь', tags: ['bday'] },
  { id: 'p27', type: 'photo', src: '/img/gallery/gallery-27.webp', full: '/img/gallery/gallery-27-hd.webp', title: 'Меренговый рулет с малиной', desc: 'Хрустящий рулет с фисташковым кремом', tags: ['meringue'] },
  { id: 'p28', type: 'photo', src: '/img/gallery/gallery-28.webp', full: '/img/gallery/gallery-28-hd.webp', title: 'Меренговый рулет ягодный',   desc: 'Классический безглютеновый десерт', tags: ['meringue'] },
  { id: 'p29', type: 'photo', src: '/img/gallery/gallery-29.webp', full: '/img/gallery/gallery-29-hd.webp', title: 'Павлова с ягодами',          desc: 'Хрустящая основа, крем шантильи, сезонные ягоды', tags: ['pavlova'] },
  { id: 'p30', type: 'photo', src: '/img/gallery/gallery-30.webp', full: '/img/gallery/gallery-30-hd.webp', title: 'Меренговый рулет премиум',   desc: 'Авторский десерт с фисташкой и малиной', tags: ['meringue'] },
];
