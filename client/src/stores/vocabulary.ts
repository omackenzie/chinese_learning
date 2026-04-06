import { computed, ref } from 'vue'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { hskWords, hskWordsByLevel, HSK_LEVELS } from '../data/hsk'

import type {
  HskWord,
  LearnerVocabularyProfile,
  StudyMode,
  VocabularyLevelBucket,
} from '../types'

const MAX_PARTIAL_WORDS_PER_LEVEL = 1500
const MAX_CANDIDATE_WORDS_PER_LEVEL = 1500
const WORD_LIST_EXPORT_VERSION = 1

type ImportMode = 'merge' | 'replace'

interface ExportedWordList {
  version: number
  exportedAt: string
  learnedWordIds: string[]
  words: Array<{
    id: string
    simplified: string
    pinyin: string
    english: string
    level: number
  }>
}

interface WordListImportSummary {
  mode: ImportMode
  importedCount: number
  totalAfterImport: number
  invalidCount: number
  duplicateCount: number
}

function loadLearnedIds(): Set<string> {
  try {
    const raw = localStorage.getItem('learnedWordIds')
    if (!raw) return new Set()
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.filter((id: unknown) => typeof id === 'string'))
  } catch {
    return new Set()
  }
}

function selectWordsForPrompt(words: HskWord[], limit: number): {
  words: string[]
  isComplete: boolean
} {
  const simplifiedWords = words
    .map((word) => word.simplified)
    .sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'))

  return {
    words: simplifiedWords.slice(0, limit),
    isComplete: simplifiedWords.length <= limit,
  }
}

function toBucket(
  level: number,
  words: HskWord[],
  limit: number,
): VocabularyLevelBucket {
  const selected = selectWordsForPrompt(words, limit)

  return {
    level,
    count: words.length,
    isComplete: selected.isComplete,
    words: selected.words,
  }
}

function parseImportedIds(input: unknown): string[] {
  if (Array.isArray(input)) {
    return input.filter((id): id is string => typeof id === 'string')
  }

  if (!input || typeof input !== 'object') {
    throw new Error('Import file must be a JSON array or an object with learnedWordIds.')
  }

  const payload = input as { learnedWordIds?: unknown }
  if (!Array.isArray(payload.learnedWordIds)) {
    throw new Error('Import file is missing learnedWordIds.')
  }

  return payload.learnedWordIds.filter((id): id is string => typeof id === 'string')
}

export const useVocabularyStore = defineStore('vocabulary', () => {
  const learnedWordIds = ref<Set<string>>(loadLearnedIds())

  const wordMap = new Map<string, HskWord>(hskWords.map((w) => [w.id, w]))
  const simplifiedToWord = new Map<string, HskWord>(
    hskWords.map((w) => [w.simplified, w]),
  )

  function _persist() {
    localStorage.setItem(
      'learnedWordIds',
      JSON.stringify([...learnedWordIds.value]),
    )
  }

  const learnedWords = computed<HskWord[]>(() => {
    const result: HskWord[] = []
    for (const id of learnedWordIds.value) {
      const word = wordMap.get(id)
      if (word) result.push(word)
    }
    return result
  })

  const learnedByLevel = computed<Record<number, HskWord[]>>(() => {
    const groups: Record<number, HskWord[]> = {}
    for (const { level } of HSK_LEVELS) {
      groups[level] = []
    }
    for (const word of learnedWords.value) {
      groups[word.level]?.push(word)
    }
    return groups
  })

  const learnedCountByLevel = computed<Record<number, number>>(() => {
    const counts: Record<number, number> = {}
    for (const { level } of HSK_LEVELS) {
      counts[level] = learnedByLevel.value[level]?.length ?? 0
    }
    return counts
  })

  const totalLearnedCount = computed(() => learnedWordIds.value.size)

  const totalWordCount = computed(() => hskWords.length)

  const knownSimplified = computed<Set<string>>(() => {
    const set = new Set<string>()
    for (const id of learnedWordIds.value) {
      const word = wordMap.get(id)
      if (word) set.add(word.simplified)
    }
    return set
  })

  const fullyLearnedThroughLevel = computed<number>(() => {
    let highest = 0

    for (const { level } of HSK_LEVELS) {
      const total = hskWordsByLevel[level]?.length ?? 0
      const learned = learnedCountByLevel.value[level] ?? 0

      if (total > 0 && learned === total) {
        highest = level
        continue
      }

      break
    }

    return highest
  })

  const frontierLevel = computed<number | null>(() => {
    for (const { level } of HSK_LEVELS) {
      const total = hskWordsByLevel[level]?.length ?? 0
      const learned = learnedCountByLevel.value[level] ?? 0

      if (total > 0 && learned < total) {
        return level
      }
    }

    return null
  })

  function buildLearnerProfile(studyMode: StudyMode): LearnerVocabularyProfile {
    const partialKnownWords: VocabularyLevelBucket[] = []

    for (const { level } of HSK_LEVELS) {
      if (level <= fullyLearnedThroughLevel.value) continue

      const words = learnedByLevel.value[level] ?? []
      if (words.length === 0) continue

      partialKnownWords.push(
        toBucket(level, words, MAX_PARTIAL_WORDS_PER_LEVEL),
      )
    }

    const candidateNewWords: VocabularyLevelBucket[] = []
    const maxCandidateLevels = studyMode === 'review' ? 1 : 2

    for (const { level } of HSK_LEVELS) {
      const words = hskWordsByLevel[level] ?? []
      const unknownWords = words.filter((word) => !learnedWordIds.value.has(word.id))

      if (unknownWords.length === 0) continue

      candidateNewWords.push(
        toBucket(level, unknownWords, MAX_CANDIDATE_WORDS_PER_LEVEL),
      )

      if (candidateNewWords.length >= maxCandidateLevels) {
        break
      }
    }

    return {
      fullyLearnedThroughLevel: fullyLearnedThroughLevel.value,
      knownWordCount: totalLearnedCount.value,
      partialKnownWords,
      candidateNewWords,
    }
  }

  function toggleWord(wordId: string) {
    const next = new Set(learnedWordIds.value)
    if (next.has(wordId)) {
      next.delete(wordId)
    } else {
      next.add(wordId)
    }
    learnedWordIds.value = next
    _persist()
  }

  function markWordLearned(wordId: string) {
    if (learnedWordIds.value.has(wordId)) return
    const next = new Set(learnedWordIds.value)
    next.add(wordId)
    learnedWordIds.value = next
    _persist()
  }

  function bulkMarkLevel(level: number) {
    const words = hskWordsByLevel[level]
    if (!words?.length) return
    const next = new Set(learnedWordIds.value)
    for (const word of words) {
      next.add(word.id)
    }
    learnedWordIds.value = next
    _persist()
  }

  function bulkUnmarkLevel(level: number) {
    const words = hskWordsByLevel[level]
    if (!words?.length) return
    const ids = new Set(words.map((w) => w.id))
    const next = new Set(learnedWordIds.value)
    for (const id of ids) {
      next.delete(id)
    }
    learnedWordIds.value = next
    _persist()
  }

  function isWordLearned(wordId: string): boolean {
    return learnedWordIds.value.has(wordId)
  }

  function isSimplifiedLearned(simplified: string): boolean {
    const word = simplifiedToWord.get(simplified)
    return word ? learnedWordIds.value.has(word.id) : false
  }

  function markSimplifiedLearned(simplified: string) {
    const word = simplifiedToWord.get(simplified)
    if (word) markWordLearned(word.id)
  }

  function exportWordList(): ExportedWordList {
    const learned = learnedWords.value
      .slice()
      .sort((a, b) => (
        a.level - b.level
        || a.simplified.localeCompare(b.simplified, 'zh-Hans-CN')
      ))

    return {
      version: WORD_LIST_EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      learnedWordIds: learned.map((word) => word.id),
      words: learned.map((word) => ({
        id: word.id,
        simplified: word.simplified,
        pinyin: word.pinyin,
        english: word.english,
        level: word.level,
      })),
    }
  }

  function importWordList(
    payload: unknown,
    mode: ImportMode,
  ): WordListImportSummary {
    const importedIds = parseImportedIds(payload)

    if (importedIds.length === 0) {
      throw new Error('Import file does not contain any learned word IDs.')
    }

    const validUniqueIds: string[] = []
    const seen = new Set<string>()
    let invalidCount = 0
    let duplicateCount = 0

    for (const id of importedIds) {
      if (!wordMap.has(id)) {
        invalidCount += 1
        continue
      }

      if (seen.has(id)) {
        duplicateCount += 1
        continue
      }

      seen.add(id)
      validUniqueIds.push(id)
    }

    if (validUniqueIds.length === 0) {
      throw new Error('Import file does not contain any valid word IDs for this app.')
    }

    const next = mode === 'replace'
      ? new Set<string>()
      : new Set(learnedWordIds.value)

    let importedCount = 0
    for (const id of validUniqueIds) {
      if (next.has(id)) {
        duplicateCount += 1
        continue
      }

      next.add(id)
      importedCount += 1
    }

    learnedWordIds.value = next
    _persist()

    return {
      mode,
      importedCount,
      totalAfterImport: next.size,
      invalidCount,
      duplicateCount,
    }
  }

  return {
    learnedWordIds,
    learnedWords,
    learnedByLevel,
    learnedCountByLevel,
    totalLearnedCount,
    totalWordCount,
    knownSimplified,
    fullyLearnedThroughLevel,
    frontierLevel,
    buildLearnerProfile,
    toggleWord,
    markWordLearned,
    bulkMarkLevel,
    bulkUnmarkLevel,
    isWordLearned,
    isSimplifiedLearned,
    markSimplifiedLearned,
    exportWordList,
    importWordList,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useVocabularyStore, import.meta.hot))
}
