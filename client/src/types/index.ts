export interface HskWord {
  id: string
  simplified: string
  traditional?: string
  pinyin: string
  english: string
  level: number
}

export type Difficulty = 'easy' | 'medium' | 'hard'

export interface GenerationConfig {
  difficulty: Difficulty
}

export interface GenerationResult {
  chinese: string
  newWords: {
    simplified: string
    pinyin: string
    english: string
  }[]
}
