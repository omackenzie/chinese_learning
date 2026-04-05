type ContentStyle =
  | 'conversation'
  | 'text_messages'
  | 'social_media'
  | 'short_story'
  | 'news_article'
  | 'diary_entry'
  | 'email'

export interface ContentTopic {
  topic: string
  style: ContentStyle
}

// Simple, casual styles suited to easy difficulty
const easyTopics: ContentTopic[] = [
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

// More complex styles suited to hard difficulty
const hardTopics: ContentTopic[] = [
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

// Mixed content suited to medium difficulty
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

export type Difficulty = 'easy' | 'medium' | 'hard'

const topicsByDifficulty: Record<Difficulty, ContentTopic[]> = {
  easy: easyTopics,
  medium: mediumTopics,
  hard: hardTopics,
}

export function pickRandomTopic(difficulty: Difficulty): ContentTopic {
  const topics = topicsByDifficulty[difficulty]
  return topics[Math.floor(Math.random() * topics.length)]
}

interface DifficultyParams {
  newWordCount: number
  paragraphLength: 'short' | 'medium' | 'long'
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export function difficultyToParams(difficulty: Difficulty): DifficultyParams {
  switch (difficulty) {
    case 'easy':
      return { newWordCount: randomInt(1, 2), paragraphLength: 'short' }
    case 'medium':
      return { newWordCount: randomInt(3, 5), paragraphLength: 'medium' }
    case 'hard':
      return { newWordCount: randomInt(5, 8), paragraphLength: 'long' }
  }
}
