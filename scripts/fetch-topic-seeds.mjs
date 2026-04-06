/**
 * Generate a larger topic/context bank from open Wikimedia category titles.
 * The resulting file is used as prompt seed metadata rather than copied source text.
 *
 * Run with: node scripts/fetch-topic-seeds.mjs
 */
import { mkdirSync, writeFileSync } from 'fs'

const OUTPUT_FILE = new URL('../server/src/data/topicSeeds.json', import.meta.url)

const SOURCE_ATTRIBUTION =
  'Topic seeds derived from English Wikipedia category titles via the MediaWiki API. Wikipedia content is available under CC BY-SA 4.0.'

const CATEGORY_CONFIGS = [
  {
    category: 'Chinese_cuisine',
    tags: ['food', 'culture'],
    styles: ['conversation', 'social_media', 'diary_entry'],
    lengths: ['short', 'medium'],
  },
  {
    category: 'Coffeehouses_and_cafés',
    tags: ['food', 'daily-life'],
    styles: ['conversation', 'social_media', 'text_messages'],
    lengths: ['short', 'medium'],
  },
  {
    category: 'Pets',
    tags: ['animals', 'daily-life'],
    styles: ['social_media', 'short_story', 'diary_entry'],
    lengths: ['short', 'medium'],
  },
  {
    category: 'Festivals_in_China',
    tags: ['culture', 'seasonal'],
    styles: ['social_media', 'short_story', 'news_article'],
    lengths: ['medium', 'long'],
  },
  {
    category: 'Public_transport',
    tags: ['transport', 'city-life'],
    styles: ['conversation', 'text_messages', 'news_article'],
    lengths: ['short', 'medium', 'long'],
  },
  {
    category: 'Hiking',
    tags: ['outdoors', 'travel'],
    styles: ['social_media', 'short_story', 'diary_entry'],
    lengths: ['medium', 'long'],
  },
  {
    category: 'Camping',
    tags: ['outdoors', 'travel'],
    styles: ['short_story', 'diary_entry', 'social_media'],
    lengths: ['medium', 'long'],
  },
  {
    category: 'Gardening',
    tags: ['home', 'community'],
    styles: ['diary_entry', 'short_story', 'news_article'],
    lengths: ['medium', 'long'],
  },
  {
    category: 'Libraries',
    tags: ['education', 'community'],
    styles: ['conversation', 'diary_entry', 'email'],
    lengths: ['short', 'medium', 'long'],
  },
  {
    category: 'Education',
    tags: ['education', 'study'],
    styles: ['conversation', 'diary_entry', 'email'],
    lengths: ['short', 'medium', 'long'],
  },
  {
    category: 'Workplace',
    tags: ['work', 'professional'],
    styles: ['conversation', 'email', 'diary_entry'],
    lengths: ['short', 'medium', 'long'],
  },
  {
    category: 'Urban_planning',
    tags: ['city-life', 'infrastructure'],
    styles: ['news_article', 'email', 'short_story'],
    lengths: ['medium', 'long'],
  },
  {
    category: 'Bicycles',
    tags: ['transport', 'lifestyle'],
    styles: ['conversation', 'short_story', 'social_media'],
    lengths: ['short', 'medium'],
  },
  {
    category: 'Renewable_energy',
    tags: ['technology', 'environment'],
    styles: ['news_article', 'email', 'short_story'],
    lengths: ['medium', 'long'],
  },
  {
    category: 'Environmental_issues',
    tags: ['environment', 'society'],
    styles: ['news_article', 'email', 'diary_entry'],
    lengths: ['medium', 'long'],
  },
  {
    category: 'Tea',
    tags: ['food', 'culture'],
    styles: ['conversation', 'social_media', 'news_article'],
    lengths: ['short', 'medium'],
  },
  {
    category: 'Photography',
    tags: ['hobby', 'arts'],
    styles: ['social_media', 'diary_entry', 'short_story'],
    lengths: ['short', 'medium'],
  },
  {
    category: 'Smartphones',
    tags: ['technology', 'daily-life'],
    styles: ['text_messages', 'news_article', 'conversation'],
    lengths: ['short', 'medium'],
  },
] 

const EXCLUDED_PATTERNS = [
  /^list of /i,
  /^outline of /i,
  /^index of /i,
  /^portal:/i,
  /^category:/i,
  /^wikipedia:/i,
  /^template:/i,
  /^history of /i,
  /^bibliography of /i,
]

const SENSITIVE_KEYWORDS = [
  'war',
  'murder',
  'suicide',
  'weapon',
  'terror',
  'bomb',
  'abuse',
  'assault',
  'prison',
  'execution',
  'disease',
  'epidemic',
  'pandemic',
  'crime',
  'violent',
  'military',
  'blood',
  'dog meat',
  'theft',
]

function normalizeTitle(title) {
  return title
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function isUsefulTitle(title) {
  if (!title || title.length < 3 || title.length > 80) return false
  if (!/^[A-Za-z]/.test(title)) return false
  if (title.includes(':')) return false
  if (EXCLUDED_PATTERNS.some((pattern) => pattern.test(title))) return false

  const lowered = title.toLowerCase()
  if (SENSITIVE_KEYWORDS.some((keyword) => lowered.includes(keyword))) return false
  if (/\d{3,}/.test(title)) return false
  if (/[A-Z]{2,}\s*\d/.test(title)) return false

  return true
}

async function fetchCategoryTitles(category) {
  const titles = []
  let cmcontinue = undefined

  while (titles.length < 40) {
    const url = new URL('https://en.wikipedia.org/w/api.php')
    url.searchParams.set('action', 'query')
    url.searchParams.set('list', 'categorymembers')
    url.searchParams.set('cmtitle', `Category:${category}`)
    url.searchParams.set('cmlimit', '50')
    url.searchParams.set('format', 'json')
    url.searchParams.set('origin', '*')
    if (cmcontinue) {
      url.searchParams.set('cmcontinue', cmcontinue)
    }

    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Failed to fetch ${category}: ${response.status}`)
    }

    const data = await response.json()
    const members = data.query?.categorymembers ?? []
    for (const member of members) {
      titles.push(member.title)
    }

    if (!data.continue?.cmcontinue) {
      break
    }

    cmcontinue = data.continue.cmcontinue
  }

  return titles
}

async function main() {
  const deduped = new Map()

  for (const config of CATEGORY_CONFIGS) {
    const titles = await fetchCategoryTitles(config.category)

    for (const rawTitle of titles) {
      const title = normalizeTitle(rawTitle)
      if (!isUsefulTitle(title)) continue

      const existing = deduped.get(title) ?? {
        topic: title,
        source: 'Wikipedia',
        sourceUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(rawTitle.replaceAll(' ', '_'))}`,
        styles: [],
        lengths: [],
        tags: [],
      }

      existing.styles = [...new Set([...existing.styles, ...config.styles])].sort()
      existing.lengths = [...new Set([...existing.lengths, ...config.lengths])].sort()
      existing.tags = [...new Set([...existing.tags, ...config.tags])].sort()

      deduped.set(title, existing)
    }
  }

  const items = [...deduped.values()].sort((a, b) => a.topic.localeCompare(b.topic))

  mkdirSync(new URL('../server/src/data/', import.meta.url), { recursive: true })
  writeFileSync(
    OUTPUT_FILE,
    `${JSON.stringify({
      attribution: SOURCE_ATTRIBUTION,
      generatedAt: new Date().toISOString(),
      itemCount: items.length,
      items,
    }, null, 2)}\n`,
  )

  console.log(`Wrote ${items.length} topic seeds to ${OUTPUT_FILE.pathname}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
