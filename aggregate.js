/* ============================================================
   Autoria 工作台 · 资讯聚合器
   由 GitHub Actions 每 2 小时运行一次：抓取科技/金融/游戏三栏资讯，
   归一化、去重、排序后产出 news.js（window.NEWS_DATA），
   工作台通过 jsDelivr CDN 读取，彻底摆脱浏览器端 CORS/公共代理/限流。

   本机手动运行：node aggregate.js
   想换/加信息源：改下方 SOURCES（type=rss 走 rss-parser；type=api 走 JSON 接口）
   ============================================================ */
const fs = require('fs');
const path = require('path');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const MAX_PER_CAT = 40;        // 每栏最多保留条数
const TIMEOUT_MS = 20000;      // 单源抓取超时

const Parser = require('rss-parser');
const parser = new Parser({
  timeout: TIMEOUT_MS,
  headers: { 'User-Agent': UA, Accept: 'application/rss+xml, application/xml, text/xml, */*' }
});

/* ---------------- 源配置（实现时已逐源实测，失效即换） ---------------- */
const SOURCES = {
  tech: [
    { name: 'RadarAI', type: 'rss', url: 'https://radarai.top/feed' },
    { name: '新智元',   type: 'rss', url: 'https://www.aiera.com.cn/feed' },
    { name: '量子位',   type: 'rss', url: 'https://www.qbitai.com/feed' },
    { name: '少数派',   type: 'rss', url: 'https://sspai.com/feed' }
  ],
  finance: [
    { name: '新浪财经', type: 'api', url: 'https://feed.mix.sina.com.cn/api/roll/get?pageid=153&lid=2516&k=&num=20&page=1',
      referer: 'https://finance.sina.com.cn/',
      map: j => ((j && j.result && j.result.data) || []).map(x => ({
        title: x.title || '', link: x.url || '', date: fmtDate(x.ctime),
        img: x.image || ''
      })) },
    { name: '新浪财经', type: 'api', url: 'https://feed.mix.sina.com.cn/api/roll/get?pageid=153&lid=2517&k=&num=20&page=1',
      referer: 'https://finance.sina.com.cn/',
      map: j => ((j && j.result && j.result.data) || []).map(x => ({
        title: x.title || '', link: x.url || '', date: fmtDate(x.ctime),
        img: x.image || ''
      })) },
    { name: '第一财经', type: 'api', url: 'https://www.yicai.com/api/ajax/getlatest?page=1&pagesize=20',
      referer: 'https://www.yicai.com/',
      map: j => ((Array.isArray(j) ? j : [])).map(x => ({
        title: x.NewsTitle || '', link: x.url || '', date: fmtDate(x.CreateDate || x.pubDate),
        img: x.originPic || (typeof x.NewsThumbs === 'string' ? x.NewsThumbs : '')
      })) }
  ],
  game: [
    { name: '触乐',   type: 'rss', url: 'https://www.chuapp.com/feed' },
    { name: 'IGN',    type: 'rss', url: 'https://feeds.ign.com/ign/all' },
    { name: 'Steam',  type: 'rss', url: 'https://store.steampowered.com/feeds/news/' }
  ]
};

/* ---------------- 工具函数 ---------------- */
function pad(n) { return String(n).padStart(2, '0'); }

// 统一成 YYYY-MM-DD：支持 ISO 字符串 / 已有日期 / Unix 秒
function fmtDate(d) {
  if (!d) return '';
  const s = String(d).trim();
  let m = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return m[1] + '-' + pad(m[2]) + '-' + pad(m[3]);
  if (/^\d{10}$/.test(s)) {
    const dt = new Date(Number(s) * 1000);
    if (!isNaN(dt)) return dt.getFullYear() + '-' + pad(dt.getMonth() + 1) + '-' + pad(dt.getDate());
  }
  const dt = new Date(s);
  if (!isNaN(dt.getTime())) return dt.getFullYear() + '-' + pad(dt.getMonth() + 1) + '-' + pad(dt.getDate());
  return '';
}

// 相对路径转绝对（img / link 都可能相对，浏览器侧需要完整地址）
function absUrl(base, u) {
  if (!u || u === '#' || /^#/.test(u)) return u || '';
  try { return new URL(u, base).href; } catch (e) { return u; }
}

// 规范化标题用于去重（与工作台 renderNewsItems 规则一致）
function normTitle(t) {
  return String(t || '').replace(/[\s｜|·:：,，。!！?？]/g, '').toLowerCase();
}

/* ---------------- 抓取 ---------------- */
async function fetchRss(src) {
  const feed = await parser.parseURL(src.url);
  return (feed.items || []).map(it => {
    let img = '';
    if (it.enclosure && it.enclosure.url) img = it.enclosure.url;
    else if (it['media:content'] && it['media:content'].url) img = it['media:content'].url;
    else {
      const body = String(it['content:encoded'] || it.content || '');
      const m = body.match(/<img[^>]+src=["']([^"']+)["']/i);
      if (m) img = m[1];
    }
    return {
      title: String(it.title || '').trim(),
      link: absUrl(src.url, it.link),
      date: fmtDate(it.isoDate || it.pubDate),
      img: img ? absUrl(src.url, img) : '',
      src: src.name
    };
  }).filter(it => it.title);
}

async function fetchApi(src) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(src.url, {
      headers: { 'User-Agent': UA, Accept: 'application/json, text/plain, */*', Referer: src.referer || '' },
      signal: ctrl.signal
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    return (src.map(j) || []).map(it => Object.assign({}, it, {
      link: absUrl(src.url, it.link), img: it.img ? absUrl(src.url, it.img) : ''
    })).filter(it => it.title);
  } finally {
    clearTimeout(t);
  }
}

async function fetchSource(src) {
  return src.type === 'rss' ? fetchRss(src) : fetchApi(src);
}

/* ---------------- 聚合 ---------------- */
async function buildCategory(key) {
  const results = await Promise.allSettled(SOURCES[key].map(async src => {
    try {
      const items = await fetchSource(src);
      return { name: src.name, items };
    } catch (e) {
      console.log(`  [${key}] ${src.name} 抓取失败: ${e.message.slice(0, 80)}`);
      return { name: src.name, items: [] };
    }
  }));

  const merged = [], counts = {};
  for (const res of results) {
    const val = res.status === 'fulfilled' ? res.value : null;
    const items = (val && val.items) || [];
    const name = (val && val.name) || '未知源';
    counts[name] = (counts[name] || 0) + items.length;
    for (const it of items) merged.push(Object.assign({}, it, { src: name }));
  }

  // 多源转载同一内容：规范化标题去重，保留先抓到的源
  const seen = new Set();
  const unique = merged.filter(it => {
    const k = normTitle(it.title);
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  unique.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return { items: unique.slice(0, MAX_PER_CAT), counts };
}

/* ---------------- 主流程 ---------------- */
(async () => {
  console.log('== 资讯聚合开始 ==');
  const out = {
    meta: { generatedAt: new Date().toISOString(), counts: {}, sources: {} },
    tech: [], finance: [], game: []
  };
  for (const key of ['tech', 'finance', 'game']) {
    const { items, counts } = await buildCategory(key);
    out[key] = items;
    out.meta.counts[key] = items.length;
    out.meta.sources[key] = counts;
    console.log(`  [${key}] ${items.length} 条（各源: ${JSON.stringify(counts)}）`);
  }
  // 用 <script> 加载，必须转义 </ 防止字符串内的 </script> 提前闭合标签
  const js = '/* Autoria 工作台资讯数据 · 由 GitHub Actions 定时生成，请勿手改 */\nwindow.NEWS_DATA = ' +
    JSON.stringify(out).replace(/<\//g, '<\\/') + ';\n';
  fs.writeFileSync(path.join(__dirname, 'news.js'), js, 'utf8');
  console.log('== news.js 已生成，meta:', JSON.stringify(out.meta), '==');
})().catch(e => {
  console.error('聚合失败:', e);
  process.exit(1);
});
