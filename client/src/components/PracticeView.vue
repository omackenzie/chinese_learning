<script setup lang="ts">
import { ref } from 'vue'
import GenerateForm from './GenerateForm.vue'
import ParagraphDisplay from './ParagraphDisplay.vue'
import TranslationCheck from './TranslationCheck.vue'
import { useVocabularyStore } from '../stores/vocabulary'
import { generateParagraph } from '../api/generate'

import type { GenerateParagraphRequest } from '../types'

const vocabularyStore = useVocabularyStore()

const generatedText = ref('')
const newWords = ref<{ simplified: string; pinyin: string; english: string }[]>([])
const isGenerating = ref(false)
const showTranslation = ref(false)
const errorMessage = ref('')

const SEPARATOR = '---NEW_WORDS---'

async function handleGenerate(config: GenerateParagraphRequest) {
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
</script>

<template>
  <div class="max-w-4xl mx-auto p-6 space-y-8">
    <h2 class="text-2xl font-bold text-gray-900">Practice</h2>

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
      />
    </div>
  </div>
</template>
