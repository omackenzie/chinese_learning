import type { ParagraphLength, StudyMode } from './contentTopics.js'

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

export interface GenerateBody {
  paragraphLength: ParagraphLength
  studyMode: StudyMode
  learnerProfile: LearnerVocabularyProfile
}
