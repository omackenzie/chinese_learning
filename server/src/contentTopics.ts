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
  preferredStyle: ContentStyle | 'auto'
  topicHint?: string
}

const paragraphLengths = ['short', 'medium', 'long'] as const satisfies readonly ParagraphLength[]
const studyModes = ['review', 'balanced', 'stretch'] as const satisfies readonly StudyMode[]

const shortTopics: ContentTopic[] = [
  { topic: 'two friends deciding where to eat dinner', style: 'conversation' },
  { topic: 'a group chat planning a birthday party', style: 'text_messages' },
  { topic: 'asking a friend for restaurant recommendations', style: 'text_messages' },
  { topic: 'chatting about a popular TV drama', style: 'conversation' },
  { topic: 'making plans to go shopping at the weekend', style: 'text_messages' },
  { topic: 'posting a photo of homemade dumplings', style: 'social_media' },
  { topic: 'sharing excitement about the first snow of winter', style: 'social_media' },
  { topic: 'a family group chat about Spring Festival plans', style: 'text_messages' },
  { topic: 'two classmates discussing homework', style: 'conversation' },
  { topic: 'someone posting about adopting a new kitten', style: 'social_media' },
  { topic: 'friends chatting about a funny video they both saw', style: 'text_messages' },
  { topic: 'a conversation at a tea shop', style: 'conversation' },
  { topic: 'sharing a beautiful sunset view from a park', style: 'social_media' },
  { topic: 'a text exchange about being late to meet a friend', style: 'text_messages' },
]

const longTopics: ContentTopic[] = [
  { topic: 'a new high-speed rail line connecting two cities', style: 'news_article' },
  { topic: 'a traditional craft being revived by young artists', style: 'news_article' },
  { topic: 'the health benefits of drinking green tea regularly', style: 'news_article' },
  { topic: 'a community garden project transforming an urban neighbourhood', style: 'news_article' },
  { topic: 'a breakthrough in solar energy technology', style: 'news_article' },
  { topic: 'an email to a landlord about apartment maintenance issues', style: 'email' },
  { topic: 'a formal request to a professor for an assignment extension', style: 'email' },
  { topic: 'a cover letter for an internship application', style: 'email' },
  { topic: 'a young professional moving to a new city for work', style: 'diary_entry' },
  { topic: 'reflecting on the first year living abroad as a student', style: 'diary_entry' },
  { topic: 'an elderly grandparent teaching a grandchild a family recipe', style: 'short_story' },
  { topic: 'getting lost in an unfamiliar neighbourhood at night', style: 'short_story' },
  { topic: 'a chance encounter on the subway that changes someone\'s day', style: 'short_story' },
  { topic: 'the last day at a job before moving on to something new', style: 'diary_entry' },
]

const mediumTopics: ContentTopic[] = [
  { topic: 'the significance of red lanterns during the Lantern Festival', style: 'news_article' },
  { topic: 'a morning commute through a busy city', style: 'short_story' },
  { topic: 'posting about a scenic hike in the mountains', style: 'social_media' },
  { topic: 'two colleagues discussing a work project over lunch', style: 'conversation' },
  { topic: 'a university student\'s first week living in a dormitory', style: 'diary_entry' },
  { topic: 'sharing a recipe for a favourite childhood dish', style: 'social_media' },
  { topic: 'an afternoon spent exploring a local market', style: 'short_story' },
  { topic: 'a text exchange planning a weekend road trip', style: 'text_messages' },
  { topic: 'the tradition of giving red envelopes during Chinese New Year', style: 'news_article' },
  { topic: 'learning to ride a bicycle as an adult', style: 'diary_entry' },
  { topic: 'a neighbourhood café that has become a community hub', style: 'news_article' },
  { topic: 'two old friends reuniting after years apart', style: 'conversation' },
  { topic: 'a rainy Saturday spent cooking at home', style: 'diary_entry' },
  { topic: 'recommending a book to a friend over text', style: 'text_messages' },
]

const topicsByLength: Record<ParagraphLength, ContentTopic[]> = {
  short: shortTopics,
  medium: mediumTopics,
  long: longTopics,
}

const allTopics = [...shortTopics, ...mediumTopics, ...longTopics]

const newWordTargets: Record<StudyMode, Record<ParagraphLength, number>> = {
  review: { short: 1, medium: 2, long: 3 },
  balanced: { short: 2, medium: 3, long: 5 },
  stretch: { short: 3, medium: 5, long: 6 },
}

function randomItem<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]
}

export function isParagraphLength(value: unknown): value is ParagraphLength {
  return typeof value === 'string' && paragraphLengths.includes(value as ParagraphLength)
}

export function isStudyMode(value: unknown): value is StudyMode {
  return typeof value === 'string' && studyModes.includes(value as StudyMode)
}

export function isContentStyle(value: unknown): value is ContentStyle {
  return typeof value === 'string' && allTopics.some((topic) => topic.style === value)
}

export function pickRandomTopic(options: TopicSelectionOptions): ContentTopic {
  const hint = typeof options.topicHint === 'string'
    ? options.topicHint.trim()
    : ''
  const pool = topicsByLength[options.paragraphLength]

  if (hint) {
    const style = options.preferredStyle === 'auto'
      ? randomItem(pool).style
      : options.preferredStyle

    return { topic: hint, style }
  }

  if (options.preferredStyle !== 'auto') {
    const matchingLengthTopics = pool.filter((topic) => topic.style === options.preferredStyle)
    if (matchingLengthTopics.length > 0) {
      return randomItem(matchingLengthTopics)
    }

    const matchingTopics = allTopics.filter((topic) => topic.style === options.preferredStyle)
    if (matchingTopics.length > 0) {
      return randomItem(matchingTopics)
    }
  }

  return randomItem(pool)
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
