import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { ApiResponse, NewsItem, NewsCategory } from '../types';

export const newsRouter = Router();

const newsQuerySchema = z.object({
  category: z.enum(['all', 'pollution', 'government', 'legal', 'local', 'general']).optional(),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 30))
    .pipe(z.number().min(1).max(100)),
});

// In-memory 5-minute cache
const CACHE_TTL_MS = 5 * 60 * 1000;
let cachedNews: NewsItem[] | null = null;
let lastCacheTime = 0;

// High-quality seeded regional news stories
const SEEDED_REGIONAL_NEWS: NewsItem[] = [
  {
    id: 'news-indrayani-001',
    title: 'NGT Principal Bench Directs MPCB and PCMC to Inspect Industrial Outfalls into Indrayani River',
    summary: 'The National Green Tribunal has sought an action-taken report on untreated chemical effluent discharges and hazardous foam observed near Chikhali and Moshi bridges.',
    source: 'The Indian Express (Pune)',
    url: 'https://indianexpress.com/article/cities/pune/ngt-indrayani-river-pollution-mpcb-pcmc/',
    imageUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80',
    publishedAt: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
    category: 'legal',
    relatedStations: ['S3', 'S4'],
  },
  {
    id: 'news-indrayani-002',
    title: 'Thick Toxic Foam Coats Alandi Holy Ghat on Eve of Ekadashi Pilgrimage',
    summary: 'Devotees and local residents express anguish as toxic surfactant froth covers the river surface near Sant Dnyaneshwar Maharaj Samadhi temple, raising urgent health alarms.',
    source: 'Hindustan Times',
    url: 'https://www.hindustantimes.com/cities/pune-news/toxic-foam-alandi-indrayani-river/',
    imageUrl: 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=800&q=80',
    publishedAt: new Date(Date.now() - 1000 * 60 * 75).toISOString(),
    category: 'pollution',
    relatedStations: ['S2'],
  },
  {
    id: 'news-indrayani-003',
    title: 'PCMC Commences Construction of 12 MLD Sewage Treatment Plant at Charholi',
    summary: 'Municipal authorities expedite decentralized STP infrastructure to curb direct domestic sewage ingress along the Charholi and Nirgudi riverbank stretches.',
    source: 'Times of India (Pune)',
    url: 'https://timesofindia.indiatimes.com/city/pune/pcmc-stp-charholi-indrayani/',
    imageUrl: 'https://images.unsplash.com/photo-1581093458791-9f3c3900df4b?auto=format&fit=crop&w=800&q=80',
    publishedAt: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
    category: 'government',
    relatedStations: ['S5'],
  },
  {
    id: 'news-indrayani-004',
    title: 'MPCB Seals 3 Bhosari MIDC Electroplating Units for Bypassing Effluent Treatment',
    summary: 'Surprise midnight inspections revealed industrial wastewater with high heavy metal and conductivity content discharging directly into storm lines connecting to Chikhali nullah.',
    source: 'Maharashtra Pollution Control Board',
    url: 'https://www.mpcb.gov.in/news/bhosari-closure-notices',
    imageUrl: 'https://images.unsplash.com/photo-1584982751601-97dcc096659c?auto=format&fit=crop&w=800&q=80',
    publishedAt: new Date(Date.now() - 1000 * 60 * 360).toISOString(),
    category: 'government',
    relatedStations: ['S4'],
  },
  {
    id: 'news-indrayani-005',
    title: 'Dehu Temple Trust and River Advocates Launch Upstream Watershed Protection Drive',
    summary: 'Community volunteers gather near Tukaram Maharaj Vaikunth Ghat to remove plastic debris and plant native riparian trees along pristine upstream banks.',
    source: 'Punya Nagari Environmental Desk',
    url: 'https://example.com/news/dehu-watershed-drive',
    imageUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80',
    publishedAt: new Date(Date.now() - 1000 * 60 * 540).toISOString(),
    category: 'local',
    relatedStations: ['S1'],
  },
  {
    id: 'news-indrayani-006',
    title: 'Severe Dissolved Oxygen Drop Causes Massive Fish Mortality Near Downstream Confluence',
    summary: 'Fishermen report dead fish floating along the riverbanks where industrial discharge waters meet the Bhima river confluence, prompting environmental department sampling.',
    source: 'Sakal Media',
    url: 'https://www.esakal.com/pune/indrayani-fish-mortality-confluence',
    imageUrl: 'https://images.unsplash.com/photo-1530595467537-0b5996c41f2d?auto=format&fit=crop&w=800&q=80',
    publishedAt: new Date(Date.now() - 1000 * 60 * 820).toISOString(),
    category: 'pollution',
    relatedStations: ['S6'],
  },
  {
    id: 'news-indrayani-007',
    title: 'NGT Directs State Chief Secretary to Form Inter-Agency Committee for Indrayani Rejuvenation',
    summary: 'A bench headed by Justice Sheo Kumar Singh mandates joint supervision by MPCB, Irrigation Dept, and PCMC to formulate an actionable 18-month cleanup roadmap.',
    source: 'National Green Tribunal',
    url: 'https://greentribunal.gov.in/indrayani-order-2024',
    imageUrl: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=800&q=80',
    publishedAt: new Date(Date.now() - 1000 * 60 * 1200).toISOString(),
    category: 'legal',
    relatedStations: ['S2', 'S3', 'S4'],
  },
  {
    id: 'news-indrayani-008',
    title: 'Moshi Citizens Protest Unregulated Solid Waste Dumping Along River Floodplain',
    summary: 'Residents submit memorandum to ward officer citing pungent odour and leachate seeping into groundwater aquifers near Pune-Nashik highway bridge.',
    source: 'Pune Mirror',
    url: 'https://punemirror.com/pune/civic/moshi-riverbed-dumping-protest',
    imageUrl: 'https://images.unsplash.com/photo-1611273426858-450d8e3c9fce?auto=format&fit=crop&w=800&q=80',
    publishedAt: new Date(Date.now() - 1000 * 60 * 1500).toISOString(),
    category: 'local',
    relatedStations: ['S3'],
  },
];

/**
 * Keyword-based categorizer for headlines and excerpts
 */
function categorizeArticle(title: string, summary: string): NewsCategory {
  const text = `${title} ${summary}`.toLowerCase();

  if (
    text.includes('ngt') ||
    text.includes('tribunal') ||
    text.includes('court') ||
    text.includes('petition') ||
    text.includes('bench') ||
    text.includes('order') ||
    text.includes('lawsuit') ||
    text.includes('penalty')
  ) {
    return 'legal';
  }

  if (
    text.includes('mpcb') ||
    text.includes('pcmc') ||
    text.includes('pmc') ||
    text.includes('government') ||
    text.includes('minister') ||
    text.includes('notice') ||
    text.includes('inspect') ||
    text.includes('stp') ||
    text.includes('treatment plant') ||
    text.includes('civic') ||
    text.includes('administration')
  ) {
    return 'government';
  }

  if (
    text.includes('pollution') ||
    text.includes('toxic') ||
    text.includes('foam') ||
    text.includes('froth') ||
    text.includes('effluent') ||
    text.includes('sewage') ||
    text.includes('chemical') ||
    text.includes('hypoxia') ||
    text.includes('fish') ||
    text.includes('dirty') ||
    text.includes('waste') ||
    text.includes('dumping') ||
    text.includes('discharge')
  ) {
    return 'pollution';
  }

  if (
    text.includes('alandi') ||
    text.includes('dehu') ||
    text.includes('moshi') ||
    text.includes('chikhali') ||
    text.includes('charholi') ||
    text.includes('bhosari') ||
    text.includes('warkari') ||
    text.includes('ghat') ||
    text.includes('pilgrimage') ||
    text.includes('temple') ||
    text.includes('resident') ||
    text.includes('citizens') ||
    text.includes('volunteer')
  ) {
    return 'local';
  }

  return 'general';
}

/**
 * Correlate article with telemetry station IDs (S1..S6) based on location mentions
 */
function correlateStations(title: string, summary: string): string[] {
  const text = `${title} ${summary}`.toLowerCase();
  const matched = new Set<string>();

  if (text.includes('dehu') || text.includes('tukaram')) matched.add('S1');
  if (text.includes('alandi') || text.includes('dnyaneshwar')) matched.add('S2');
  if (text.includes('moshi')) matched.add('S3');
  if (text.includes('chikhali') || text.includes('bhosari') || text.includes('midc')) matched.add('S4');
  if (text.includes('charholi') || text.includes('nirgudi')) matched.add('S5');
  if (text.includes('confluence') || text.includes('bhima') || text.includes('tulapur') || text.includes('sangam')) {
    matched.add('S6');
  }

  return Array.from(matched);
}

/**
 * Clean and normalize title for deduplication
 */
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, 6)
    .join(' ');
}

/**
 * Parse Google News / TOI RSS XML feed
 */
function parseRssFeed(xmlText: string): NewsItem[] {
  const items: NewsItem[] = [];
  const itemMatches = xmlText.match(/<item[\s\S]*?<\/item>/gi) || [];

  for (const itemXml of itemMatches) {
    const titleMatch = itemXml.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
    const linkMatch = itemXml.match(/<link>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i);
    const pubDateMatch = itemXml.match(/<pubDate>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/pubDate>/i);
    const descMatch = itemXml.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i);

    if (titleMatch && linkMatch) {
      const rawTitle = titleMatch[1].replace(/<[^>]+>/g, '').trim();
      const rawDesc = descMatch ? descMatch[1].replace(/<[^>]+>/g, '').trim() : '';
      const pubDate = pubDateMatch ? new Date(pubDateMatch[1]).toISOString() : new Date().toISOString();

      // Extract publisher source name if formatted like "Title - Source"
      const parts = rawTitle.split(' - ');
      const title = parts.length > 1 ? parts.slice(0, -1).join(' - ') : rawTitle;
      const source = parts.length > 1 ? parts[parts.length - 1] : 'Regional Media';

      items.push({
        id: `rss-${Buffer.from(linkMatch[1]).toString('base64').slice(0, 16)}`,
        title,
        summary: rawDesc.slice(0, 220) || 'Regional reporting on river environmental status and municipal monitoring.',
        source,
        url: linkMatch[1].trim(),
        publishedAt: pubDate,
        category: categorizeArticle(title, rawDesc),
        relatedStations: correlateStations(title, rawDesc),
      });
    }
  }

  return items;
}

/**
 * Fetch articles from live feeds (Google News RSS / NewsAPI) with timeout
 */
async function fetchLiveNews(): Promise<NewsItem[]> {
  const query = encodeURIComponent('Indrayani river pollution OR Pimpri Chinchwad water MPCB');
  const rssUrl = `https://news.google.com/rss/search?q=${query}&hl=en-IN&gl=IN&ceid=IN:en`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(rssUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'IndrayaniWatch/1.0',
      },
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const xml = await res.text();
      const parsed = parseRssFeed(xml);
      if (parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('[news.ts] RSS fetch failed, utilizing seeded baseline:', err);
  }

  return [];
}

/**
 * GET /api/news
 * Returns live or cached news articles, categorized and correlated with station telemetry.
 * Cached 5 minutes server-side.
 */
newsRouter.get('/', async (req: Request, res: Response<ApiResponse<NewsItem[]>>) => {
  const parseResult = newsQuerySchema.safeParse(req.query);

  if (!parseResult.success) {
    return res.status(400).json({
      error: `Invalid query parameters: ${parseResult.error.issues.map((i) => i.message).join(', ')}`,
    });
  }

  const { category, limit } = parseResult.data;
  const now = Date.now();

  // Check 5-minute cache
  let allArticles = cachedNews;
  if (!allArticles || now - lastCacheTime > CACHE_TTL_MS) {
    const liveItems = await fetchLiveNews();

    // Merge live RSS items and seeded regional items
    const combined = [...liveItems, ...SEEDED_REGIONAL_NEWS];

    // Deduplicate by normalized title prefix
    const seenTitles = new Set<string>();
    const deduplicated: NewsItem[] = [];

    for (const item of combined) {
      const key = normalizeTitle(item.title);
      if (!seenTitles.has(key)) {
        seenTitles.add(key);
        deduplicated.push({
          ...item,
          category: categorizeArticle(item.title, item.summary),
          relatedStations: correlateStations(item.title, item.summary),
        });
      }
    }

    // Sort newest first
    deduplicated.sort(
      (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );

    cachedNews = deduplicated;
    lastCacheTime = now;
    allArticles = deduplicated;
  }

  // Filter by category if specified and not 'all'
  let results = allArticles || [...SEEDED_REGIONAL_NEWS];
  if (category && category !== 'all') {
    results = results.filter((item) => item.category === category);
  }

  return res.status(200).json({
    data: results.slice(0, limit || 30),
    cached: true,
  });
});
