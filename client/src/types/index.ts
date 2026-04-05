export interface HskWord {
  id: string
  simplified: string
  traditional?: string
  pinyin: string
  english: string
  level: number
}

export type ParagraphLength = 'short' | 'medium' | 'long'

export type StudyMode = 'review' | 'balanced' | 'stretch'

export type ContentStyle =
  | 'conversation'
  | 'text_messages'
  | 'social_media'
  | 'short_story'
  | 'news_article'
  | 'diary_entry'
  | 'email'

export type PreferredStyle = ContentStyle | 'auto'

export interface VocabularyLevelBucket {
  level: number
  count: number
  words: string[]
}

export interface LearnerVocabularyProfile {
  fullyLearnedThroughLevel: number
  knownWordCount: number
  partialKnownWords: VocabularyLevelBucket[]
  candidateNewWords: VocabularyLevelBucket[]
}

export interface GenerateParagraphRequest {
  paragraphLength: ParagraphLength
  studyMode: StudyMode
  preferredStyle: PreferredStyle
  topicHint: string
  learnerProfile: LearnerVocabularyProfile
}

export interface GenerationResult {
  chinese: string
  newWords: {
    simplified: string
    pinyin: string
    english: string
  }[]
}
