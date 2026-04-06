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
  learnerProfile: LearnerVocabularyProfile
}

export interface NewWord {
  simplified: string
  pinyin: string
  english: string
}

export interface GenerationResult {
  chinese: string
  newWords: NewWord[]
}

export interface SavedGenerationConfig {
  paragraphLength: ParagraphLength
  studyMode: StudyMode
}

export interface TranslationFeedback {
  summary: string
  strengths: string[]
  improvements: string[]
  newWordNotes: string[]
}

export interface TranslationAttemptRecord {
  id: string
  createdAt: string
  userTranslation: string
  referenceTranslation: string
  feedback: TranslationFeedback | null
}

export interface PracticeHistoryEntry {
  id: string
  createdAt: string
  updatedAt: string
  chinese: string
  newWords: NewWord[]
  config: SavedGenerationConfig
  translationAttempts: TranslationAttemptRecord[]
  retainedWords: string[]
}

export interface TranslationFeedbackRequest {
  chinese: string
  userTranslation: string
  newWords: NewWord[]
}
