<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import GenerateForm from './GenerateForm.vue'
import ParagraphDisplay from './ParagraphDisplay.vue'
import TranslationCheck from './TranslationCheck.vue'
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

  let fullResponse = ''

  try {
    const stream = generateParagraph(config)

    for await (const token of stream) {
      fullResponse += token

      const separatorIdx = fullResponse.indexOf(SEPARATOR)
      if (separatorIdx === -1) {
        generatedText.value = fullResponse
      } else {
        generatedText.value = fullResponse.slice(0, separatorIdx).trim()
      }
    }

    const separatorIdx = fullResponse.indexOf(SEPARATOR)
    if (separatorIdx !== -1) {
      const jsonStr = fullResponse.slice(separatorIdx + SEPARATOR.length).trim()
      try {
        newWords.value = JSON.parse(jsonStr)
      } catch {
        const match = jsonStr.match(/\[[\s\S]*\]/)
        if (match) {
          try {
            newWords.value = JSON.parse(match[0])
          } catch {
            // Silently fail — new words won't be shown
          }
        }
      }
    }

    generatedText.value = generatedText.value.trim()
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
