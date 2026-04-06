import topicSeedData from './data/topicSeeds.json'

export type ContentStyle =
  | 'conversation'
  | 'text_messages'
  | 'social_media'
  | 'short_story'
  | 'news_article'
  | 'diary_entry'
  | 'email'

export type ParagraphLength = 'short' | 'medium' | 'long'

export type StudyMode = 'review' | 'balanced' | 'stretch'

export interface ContentTopic {
  topic: string
  style: ContentStyle
}

interface TopicSelectionOptions {
  paragraphLength: ParagraphLength
}

interface TopicSeed {
  topic: string
  source: string
  sourceUrl: string
  styles: ContentStyle[]
  lengths: ParagraphLength[]
  tags: string[]
}

const paragraphLengths = ['short', 'medium', 'long'] as const satisfies readonly ParagraphLength[]
const studyModes = ['review', 'balanced', 'stretch'] as const satisfies readonly StudyMode[]
const contentStyles = [
  'conversation',
  'text_messages',
  'social_media',
  'short_story',
  'news_article',
  'diary_entry',
  'email',
] as const satisfies readonly ContentStyle[]

const autoStylePreference: Record<ParagraphLength, ContentStyle[]> = {
  short: ['conversation', 'text_messages', 'social_media', 'diary_entry'],
  medium: ['conversation', 'social_media', 'short_story', 'diary_entry', 'news_article'],
  long: ['short_story', 'diary_entry', 'news_article', 'email', 'conversation'],
}

const fallbackTopics: Record<ParagraphLength, ContentTopic[]> = {
  short: [
    { topic: 'meeting a friend at a cafe after work', style: 'conversation' },
    { topic: 'posting about a favorite home-cooked lunch', style: 'social_media' },
    { topic: 'a quick chat about commuting delays', style: 'text_messages' },
    { topic: 'writing about a new pet at home', style: 'social_media' },
  ],
  medium: [
    { topic: 'a student settling into dorm life', style: 'diary_entry' },
    { topic: 'planning a weekend trip with friends', style: 'text_messages' },
    { topic: 'an afternoon exploring a local market', style: 'short_story' },
    { topic: 'a neighborhood cafe becoming a community hub', style: 'news_article' },
  ],
  long: [
    { topic: 'a city improving bike lanes and public transport', style: 'news_article' },
    { topic: 'reflecting on the first month in a new job', style: 'diary_entry' },
    { topic: 'a formal email about apartment maintenance issues', style: 'email' },
    { topic: 'getting lost during a hiking trip and finding help', style: 'short_story' },
  ],
}

function isTopicSeed(value: unknown): value is TopicSeed {
  if (!value || typeof value !== 'object') return false

  const seed = value as Record<string, unknown>
  return typeof seed.topic === 'string'
    && typeof seed.source === 'string'
    && typeof seed.sourceUrl === 'string'
    && Array.isArray(seed.styles)
    && seed.styles.every((style) => isContentStyle(style))
    && Array.isArray(seed.lengths)
    && seed.lengths.every((length) => isParagraphLength(length))
    && Array.isArray(seed.tags)
    && seed.tags.every((tag) => typeof tag === 'string')
}

const topicSeeds: TopicSeed[] = Array.isArray((topicSeedData as { items?: unknown[] }).items)
  ? (topicSeedData as { items: unknown[] }).items.filter(isTopicSeed)
  : []

const newWordTargets: Record<StudyMode, Record<ParagraphLength, number>> = {
  review: { short: 1, medium: 2, long: 3 },
  balanced: { short: 2, medium: 3, long: 5 },
  stretch: { short: 3, medium: 5, long: 6 },
}

function randomItem<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]
}

function pickAutoStyle(options: {
  paragraphLength: ParagraphLength
  allowedStyles?: ContentStyle[]
}) {
  const preferredOrder = autoStylePreference[options.paragraphLength]
  const allowed = options.allowedStyles && options.allowedStyles.length > 0
    ? options.allowedStyles
    : [...contentStyles]

  for (const style of preferredOrder) {
    if (allowed.includes(style)) {
      return style
    }
  }

  return allowed[0] ?? 'conversation'
}

export function isParagraphLength(value: unknown): value is ParagraphLength {
  return typeof value === 'string' && paragraphLengths.includes(value as ParagraphLength)
}

export function isStudyMode(value: unknown): value is StudyMode {
  return typeof value === 'string' && studyModes.includes(value as StudyMode)
}

export function isContentStyle(value: unknown): value is ContentStyle {
  return typeof value === 'string' && contentStyles.includes(value as ContentStyle)
}

export function pickRandomTopic(options: TopicSelectionOptions): ContentTopic {
  const matchingSeeds = topicSeeds.filter((seed) =>
    seed.lengths.includes(options.paragraphLength)
  )

  if (matchingSeeds.length > 0) {
    const selected = randomItem(matchingSeeds)
    return {
      topic: selected.topic,
      style: pickAutoStyle({
        paragraphLength: options.paragraphLength,
        allowedStyles: selected.styles,
      }),
    }
  }

  return randomItem(fallbackTopics[options.paragraphLength])
}

export function studyModeToParams(
  studyMode: StudyMode,
  paragraphLength: ParagraphLength,
) {
  return {
    newWordCount: newWordTargets[studyMode][paragraphLength],
    paragraphLength,
  }
}
