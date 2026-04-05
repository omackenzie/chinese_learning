import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { hskWords, hskWordsByLevel, HSK_LEVELS } from '../data/hsk'

import type { HskWord } from '../types'

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

export const useVocabularyStore = defineStore('vocabulary', () => {
  const learnedWordIds = ref<Set<string>>(loadLearnedIds())

  const wordMap = new Map<string, HskWord>(hskWords.map((w) => [w.id, w]))
  const simplifiedToWord = new Map<string, HskWord>(
    hskWords.map((w) => [w.simplified, w])
  )

  function _persist() {
    localStorage.setItem(
      'learnedWordIds',
      JSON.stringify([...learnedWordIds.value])
    )
  }

  // --- Getters ---

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

  const effectiveHskLevel = computed<number>(() => {
    let highest = 0
    for (const { level } of HSK_LEVELS) {
      const total = hskWordsByLevel[level]?.length ?? 0
      if (total === 0) continue
      const learned = learnedCountByLevel.value[level] ?? 0
      if (learned / total > 0.5) {
        highest = level
      }
    }
    return highest
  })

  // --- Actions ---

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

  return {
    learnedWordIds,
    learnedWords,
    learnedByLevel,
    learnedCountByLevel,
    totalLearnedCount,
    totalWordCount,
    knownSimplified,
    effectiveHskLevel,
    toggleWord,
    markWordLearned,
    bulkMarkLevel,
    bulkUnmarkLevel,
    isWordLearned,
    isSimplifiedLearned,
    markSimplifiedLearned,
  }
})
