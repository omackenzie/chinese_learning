<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import GenerateForm from './GenerateForm.vue'
import ParagraphDisplay from './ParagraphDisplay.vue'
import TranslationCheck from './TranslationCheck.vue'
import { hskWords } from '../data/hsk'
import { useVocabularyStore } from '../stores/vocabulary'
import { useGenerationHistoryStore } from '../stores/generationHistory'
import { generateParagraph } from '../api/generate'

import type { GenerateParagraphRequest, PracticeHistoryEntry, TranslationFeedback } from '../types'

const vocabularyStore = useVocabularyStore()
const historyStore = useGenerationHistoryStore()
const route = useRoute()
const router = useRouter()

const generatedText = ref('')
const newWords = ref<PracticeHistoryEntry['newWords']>([])
const isGenerating = ref(false)
const showTranslation = ref(false)
const errorMessage = ref('')
const activeHistoryEntryId = ref<string | null>(null)

const SEPARATOR = '---NEW_WORDS---'
const MAX_GENERATION_ATTEMPTS = 3
const TARGET_NEW_WORDS = {
  review: { short: 1, medium: 2, long: 3 },
  balanced: { short: 2, medium: 3, long: 5 },
  stretch: { short: 3, medium: 5, long: 6 },
} as const

const uniqueHskWords = [...new Set(hskWords.map((word) => word.simplified))]
  .sort((a, b) => b.length - a.length || a.localeCompare(b, 'zh-Hans-CN'))

const hskWordsByFirstChar = new Map<string, string[]>()
for (const word of uniqueHskWords) {
  const firstChar = word[0]
  const bucket = hskWordsByFirstChar.get(firstChar) ?? []
  bucket.push(word)
  hskWordsByFirstChar.set(firstChar, bucket)
}

const fullyKnownWordsByLevel = new Map<number, string[]>()
for (let level = 0; level <= 9; level += 1) {
  fullyKnownWordsByLevel.set(
    level,
    hskWords
      .filter((word) => word.level <= level)
      .map((word) => word.simplified),
  )
}

const activeHistoryEntry = computed(() =>
  activeHistoryEntryId.value ? historyStore.getEntry(activeHistoryEntryId.value) : null,
)

const reviewingSavedEntry = computed(() =>
  typeof route.query.history === 'string' && activeHistoryEntry.value !== null,
)

function loadHistoryEntry(entryId: string) {
  const entry = historyStore.getEntry(entryId)
  if (!entry) {
    errorMessage.value = 'Saved practice item not found.'
    return
  }

  generatedText.value = entry.chinese
  newWords.value = entry.newWords
  isGenerating.value = false
  showTranslation.value = true
  errorMessage.value = ''
  activeHistoryEntryId.value = entry.id
}

watch(
  () => route.query.history,
  (historyId) => {
    if (typeof historyId === 'string') {
      loadHistoryEntry(historyId)
    }
  },
  { immediate: true },
)

function parseGenerationResponse(fullResponse: string) {
  const separatorIdx = fullResponse.indexOf(SEPARATOR)
  const chinese = separatorIdx === -1
    ? fullResponse.trim()
    : fullResponse.slice(0, separatorIdx).trim()

  let parsedNewWords: PracticeHistoryEntry['newWords'] = []

  if (separatorIdx !== -1) {
    const jsonStr = fullResponse.slice(separatorIdx + SEPARATOR.length).trim()
    try {
      parsedNewWords = JSON.parse(jsonStr)
    } catch {
      const match = jsonStr.match(/\[[\s\S]*\]/)
      if (match) {
        try {
          parsedNewWords = JSON.parse(match[0])
        } catch {
          parsedNewWords = []
        }
      }
    }
  }

  const sanitizedNewWords = Array.isArray(parsedNewWords)
    ? parsedNewWords.filter((word): word is PracticeHistoryEntry['newWords'][number] => (
      Boolean(word)
      && typeof word === 'object'
      && typeof (word as { simplified?: unknown }).simplified === 'string'
      && typeof (word as { pinyin?: unknown }).pinyin === 'string'
      && typeof (word as { english?: unknown }).english === 'string'
    ))
    : []

  return { chinese, newWords: sanitizedNewWords }
}

function findUnauthorizedHskWords(text: string, allowedWords: Set<string>) {
  const unauthorized = new Set<string>()
  const segments = text.match(/[\u3400-\u9fff]+/g) ?? []

  for (const segment of segments) {
    let index = 0

    while (index < segment.length) {
      const candidates = hskWordsByFirstChar.get(segment[index]) ?? []
      const matchedWord = candidates.find((word) => segment.startsWith(word, index))

      if (matchedWord) {
        if (!allowedWords.has(matchedWord)) {
          unauthorized.add(matchedWord)
        }
        index += matchedWord.length
        continue
      }

      index += 1
    }
  }

  return [...unauthorized]
}

function validateGeneration(
  config: GenerateParagraphRequest,
  chinese: string,
  parsedNewWords: PracticeHistoryEntry['newWords'],
) {
  const knownWords = new Set<string>([
    ...(fullyKnownWordsByLevel.get(config.learnerProfile.fullyLearnedThroughLevel) ?? []),
    ...config.learnerProfile.partialKnownWords.flatMap((bucket) => bucket.words),
  ])
  const candidateNewWords = new Set<string>(
    config.learnerProfile.candidateNewWords.flatMap((bucket) => bucket.words),
  )
  const selectedNewWords = new Set<string>(parsedNewWords.map((word) => word.simplified))
  const expectedNewWordCount = Math.min(
    TARGET_NEW_WORDS[config.studyMode][config.paragraphLength],
    config.learnerProfile.candidateNewWords.reduce((sum, bucket) => sum + bucket.words.length, 0),
  )
  const allowedWords = new Set<string>([...knownWords, ...selectedNewWords])
  const unauthorizedHskWords = findUnauthorizedHskWords(chinese, allowedWords)
  const invalidNewWords = parsedNewWords
    .filter((word) => !candidateNewWords.has(word.simplified) || !chinese.includes(word.simplified))
    .map((word) => word.simplified)
  const duplicateNewWords = parsedNewWords
    .map((word) => word.simplified)
    .filter((word, index, words) => words.indexOf(word) !== index)

  const issues: string[] = []
  if (parsedNewWords.length !== expectedNewWordCount) {
    issues.push(`expected ${expectedNewWordCount} new words but got ${parsedNewWords.length}`)
  }
  if (invalidNewWords.length > 0) {
    issues.push(`invalid new words: ${invalidNewWords.join('、')}`)
  }
  if (duplicateNewWords.length > 0) {
    issues.push(`duplicate new words: ${duplicateNewWords.join('、')}`)
  }
  if (unauthorizedHskWords.length > 0) {
    issues.push(`out-of-profile HSK words: ${unauthorizedHskWords.join('、')}`)
  }

  return {
    isValid: issues.length === 0,
    retryForbiddenWords: [...new Set([...unauthorizedHskWords, ...invalidNewWords])],
    issues,
  }
}

async function handleGenerate(config: GenerateParagraphRequest) {
  if (route.query.history) {
    void router.replace({ name: 'practice' })
  }

  activeHistoryEntryId.value = null
  generatedText.value = ''
  newWords.value = []
  isGenerating.value = true
  showTranslation.value = false
  errorMessage.value = ''

  try {
    let activeConfig: GenerateParagraphRequest = { ...config }
    let acceptedChinese = ''
    let acceptedNewWords: PracticeHistoryEntry['newWords'] = []

    for (let attempt = 1; attempt <= MAX_GENERATION_ATTEMPTS; attempt += 1) {
      let fullResponse = ''
      const stream = generateParagraph(activeConfig)

      for await (const token of stream) {
        fullResponse += token

        const separatorIdx = fullResponse.indexOf(SEPARATOR)
        if (separatorIdx === -1) {
          generatedText.value = fullResponse
        } else {
          generatedText.value = fullResponse.slice(0, separatorIdx).trim()
        }
      }

      const parsed = parseGenerationResponse(fullResponse)
      const validation = validateGeneration(activeConfig, parsed.chinese, parsed.newWords)

      if (validation.isValid) {
        acceptedChinese = parsed.chinese
        acceptedNewWords = parsed.newWords
        break
      }

      if (attempt === MAX_GENERATION_ATTEMPTS) {
        throw new Error(
          `Generation still used words outside your learned list: ${validation.retryForbiddenWords.slice(0, 8).join('、') || validation.issues.join('; ')}.`,
        )
      }

      activeConfig = {
        ...config,
        forbiddenWords: [...new Set([
          ...(activeConfig.forbiddenWords ?? []),
          ...validation.retryForbiddenWords,
        ])],
      }
    }

    generatedText.value = acceptedChinese
    newWords.value = acceptedNewWords
    showTranslation.value = true
    activeHistoryEntryId.value = historyStore.saveGeneration(
      {
        paragraphLength: config.paragraphLength,
        studyMode: config.studyMode,
      },
      generatedText.value,
      newWords.value,
    )
  } catch (e) {
    errorMessage.value = e instanceof Error
      ? e.message
      : 'An unexpected error occurred. Please try again.'
  } finally {
    isGenerating.value = false
  }
}

function handleWordLearned(simplified: string) {
  vocabularyStore.markSimplifiedLearned(simplified)
}

function handleTranslationReviewed(payload: {
  userTranslation: string
  referenceTranslation: string
  feedback: TranslationFeedback | null
}) {
  if (!activeHistoryEntryId.value) return

  historyStore.addTranslationAttempt(activeHistoryEntryId.value, payload)
}
</script>

<template>
  <div class="max-w-4xl mx-auto p-6 space-y-8">
    <h2 class="text-2xl font-bold text-gray-900">Practice</h2>

    <div
      v-if="reviewingSavedEntry"
      class="rounded-xl border border-amber-200 bg-amber-50 p-4"
    >
      <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 class="text-sm font-semibold uppercase tracking-wide text-amber-700">Reviewing a saved passage</h3>
          <p class="text-sm text-amber-900 mt-1">
            Reopened from history on {{ new Date(activeHistoryEntry!.createdAt).toLocaleString() }}.
          </p>
        </div>
        <router-link
          to="/history"
          class="text-sm font-medium text-amber-800 underline underline-offset-2"
        >
          Back to History
        </router-link>
      </div>
    </div>

    <div class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h3 class="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-4">Configure</h3>
      <GenerateForm :loading="isGenerating" @generate="handleGenerate" />
    </div>

    <div
      v-if="errorMessage"
      class="rounded-xl border border-red-200 bg-red-50 p-4 flex items-start gap-3"
    >
      <svg class="h-5 w-5 text-red-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
      <div class="min-w-0">
        <h4 class="text-sm font-semibold text-red-800">Generation Failed</h4>
        <p class="text-sm text-red-700 mt-1">{{ errorMessage }}</p>
      </div>
    </div>

    <ParagraphDisplay
      :text="generatedText"
      :new-words="newWords"
      :loading="isGenerating"
    />

    <div
      v-if="showTranslation && generatedText"
      class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
    >
      <h3 class="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-4">Translation Practice</h3>
      <TranslationCheck
        :chinese-text="generatedText"
        :new-words="newWords"
        @word-learned="handleWordLearned"
        @translation-reviewed="handleTranslationReviewed"
      />
    </div>
  </div>
</template>
