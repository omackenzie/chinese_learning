import { computed, ref } from 'vue'
import { acceptHMRUpdate, defineStore } from 'pinia'

import type {
  NewWord,
  PracticeHistoryEntry,
  SavedGenerationConfig,
  TranslationAttemptRecord,
  TranslationFeedback,
} from '../types'

const STORAGE_KEY = 'practiceHistoryEntries'
const MAX_HISTORY_ENTRIES = 30

function sortEntries(entries: PracticeHistoryEntry[]) {
  return [...entries].sort((a, b) => (
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  ))
}

function loadHistory(): PracticeHistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []

    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? sortEntries(parsed) : []
  } catch {
    return []
  }
}

export const useGenerationHistoryStore = defineStore('generationHistory', () => {
  const entries = ref<PracticeHistoryEntry[]>(loadHistory())

  function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.value))
  }

  function saveGeneration(config: SavedGenerationConfig, chinese: string, newWords: NewWord[]) {
    const now = new Date().toISOString()
    const entry: PracticeHistoryEntry = {
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
      chinese,
      newWords,
      config,
      translationAttempts: [],
      retainedWords: [],
    }

    entries.value = [entry, ...entries.value].slice(0, MAX_HISTORY_ENTRIES)
    persist()

    return entry.id
  }

  function getEntry(id: string) {
    return entries.value.find((entry) => entry.id === id) ?? null
  }

  function addTranslationAttempt(
    entryId: string,
    payload: {
      userTranslation: string
      referenceTranslation: string
      feedback: TranslationFeedback | null
    },
  ) {
    const entry = getEntry(entryId)
    if (!entry) return

    const attempt: TranslationAttemptRecord = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      userTranslation: payload.userTranslation,
      referenceTranslation: payload.referenceTranslation,
      feedback: payload.feedback,
    }

    entry.translationAttempts = [attempt, ...entry.translationAttempts]
    entry.updatedAt = attempt.createdAt
    entries.value = sortEntries(entries.value)
    persist()
  }

  function toggleRetainedWord(entryId: string, simplified: string) {
    const entry = getEntry(entryId)
    if (!entry) return

    const retained = new Set(entry.retainedWords)
    if (retained.has(simplified)) {
      retained.delete(simplified)
    } else {
      retained.add(simplified)
    }

    entry.retainedWords = [...retained]
    entry.updatedAt = new Date().toISOString()
    entries.value = sortEntries(entries.value)
    persist()
  }

  function deleteEntry(entryId: string) {
    entries.value = entries.value.filter((entry) => entry.id !== entryId)
    persist()
  }

  const totalAttempts = computed(() =>
    entries.value.reduce((sum, entry) => sum + entry.translationAttempts.length, 0),
  )

  return {
    entries,
    totalAttempts,
    saveGeneration,
    getEntry,
    addTranslationAttempt,
    toggleRetainedWord,
    deleteEntry,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useGenerationHistoryStore, import.meta.hot))
}
