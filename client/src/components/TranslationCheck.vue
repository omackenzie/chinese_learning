<script setup lang="ts">
import { ref, watch } from 'vue'
import { getTranslation, getTranslationFeedback } from '../api/generate'

import type { NewWord, TranslationFeedback } from '../types'

const props = defineProps<{
  chineseText: string
  newWords: NewWord[]
}>()

const emit = defineEmits<{
  wordLearned: [simplified: string]
  translationReviewed: [
    payload: {
      userTranslation: string
      referenceTranslation: string
      feedback: TranslationFeedback | null
    },
  ]
}>()

const userTranslation = ref('')
const referenceTranslation = ref('')
const isChecking = ref(false)
const hasChecked = ref(false)
const errorMessage = ref('')
const feedback = ref<TranslationFeedback | null>(null)
const learnedWords = ref<Set<string>>(new Set())

function resetState() {
  userTranslation.value = ''
  referenceTranslation.value = ''
  isChecking.value = false
  hasChecked.value = false
  errorMessage.value = ''
  feedback.value = null
  learnedWords.value = new Set()
}

watch(() => props.chineseText, resetState, { immediate: true })

async function checkTranslation() {
  if (!userTranslation.value.trim()) return

  isChecking.value = true
  hasChecked.value = true
  referenceTranslation.value = ''
  errorMessage.value = ''
  feedback.value = null

  try {
    for await (const token of getTranslation(props.chineseText)) {
      referenceTranslation.value += token
    }

    feedback.value = await getTranslationFeedback({
      chinese: props.chineseText,
      userTranslation: userTranslation.value.trim(),
      newWords: props.newWords,
    })

    emit('translationReviewed', {
      userTranslation: userTranslation.value.trim(),
      referenceTranslation: referenceTranslation.value.trim(),
      feedback: feedback.value,
    })
  } catch (e) {
    hasChecked.value = false
    errorMessage.value = e instanceof Error
      ? e.message
      : 'Failed to get translation. Please try again.'
  } finally {
    isChecking.value = false
  }
}

function markAsLearned(simplified: string) {
  learnedWords.value.add(simplified)
  emit('wordLearned', simplified)
}
</script>

<template>
  <div class="space-y-5">
    <!-- Translation Input -->
    <div>
      <label for="translation" class="block text-sm font-medium text-gray-700 mb-1">
        Your Translation
      </label>
      <textarea
        id="translation"
        v-model="userTranslation"
        rows="4"
        placeholder="Type your English translation here..."
        class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder-gray-400 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 resize-none"
      />
    </div>

    <button
      @click="checkTranslation"
      :disabled="isChecking || !userTranslation.trim()"
      class="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
    >
      <svg
        v-if="isChecking"
        class="animate-spin h-4 w-4"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      {{ isChecking ? 'Checking...' : 'Check Translation' }}
    </button>

    <!-- Error Alert -->
    <div
      v-if="errorMessage"
      class="rounded-lg border border-red-200 bg-red-50 p-3 flex items-start gap-2"
    >
      <svg class="h-4 w-4 text-red-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
      <p class="text-sm text-red-700">{{ errorMessage }}</p>
    </div>

    <!-- Comparison -->
    <div v-if="hasChecked" class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div class="rounded-lg border border-gray-200 bg-white p-4">
        <h4 class="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Your Translation</h4>
        <p class="text-sm text-gray-800 leading-relaxed">{{ userTranslation }}</p>
      </div>
      <div class="rounded-lg border border-gray-200 bg-white p-4">
        <h4 class="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Reference Translation</h4>
        <p class="text-sm text-gray-800 leading-relaxed">
          {{ referenceTranslation }}
          <span v-if="isChecking" class="inline-block w-0.5 h-4 bg-red-700 animate-pulse ml-0.5 align-middle" />
        </p>
      </div>
    </div>

    <div
      v-if="feedback"
      class="rounded-lg border border-amber-200 bg-amber-50 p-4"
    >
      <h4 class="text-xs font-semibold uppercase tracking-wide text-amber-700 mb-2">Feedback</h4>
      <p class="text-sm text-amber-900">{{ feedback.summary }}</p>

      <div
        v-if="feedback.strengths.length"
        class="mt-4"
      >
        <h5 class="text-xs font-semibold uppercase tracking-wide text-amber-700 mb-2">What worked</h5>
        <ul class="space-y-1 text-sm text-amber-900 list-disc list-inside">
          <li v-for="item in feedback.strengths" :key="item">{{ item }}</li>
        </ul>
      </div>

      <div
        v-if="feedback.improvements.length"
        class="mt-4"
      >
        <h5 class="text-xs font-semibold uppercase tracking-wide text-amber-700 mb-2">What to improve</h5>
        <ul class="space-y-1 text-sm text-amber-900 list-disc list-inside">
          <li v-for="item in feedback.improvements" :key="item">{{ item }}</li>
        </ul>
      </div>

      <div
        v-if="feedback.newWordNotes.length"
        class="mt-4"
      >
        <h5 class="text-xs font-semibold uppercase tracking-wide text-amber-700 mb-2">New word notes</h5>
        <ul class="space-y-1 text-sm text-amber-900 list-disc list-inside">
          <li v-for="item in feedback.newWordNotes" :key="item">{{ item }}</li>
        </ul>
      </div>
    </div>

    <!-- New Words Section -->
    <div v-if="newWords.length" class="border-t border-gray-200 pt-5">
      <h3 class="text-sm font-semibold text-gray-700 mb-3">New Vocabulary</h3>
      <div class="space-y-2">
        <div
          v-for="word in newWords"
          :key="word.simplified"
          class="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3"
        >
          <div class="flex items-center gap-4">
            <span class="text-lg font-medium text-gray-900">{{ word.simplified }}</span>
            <span class="text-sm text-red-700">{{ word.pinyin }}</span>
            <span class="text-sm text-gray-500">{{ word.english }}</span>
          </div>
          <button
            v-if="!learnedWords.has(word.simplified)"
            @click="markAsLearned(word.simplified)"
            class="rounded-md border border-red-200 bg-red-50 px-3 py-1 text-xs font-medium text-red-700 transition-colors hover:bg-red-100"
          >
            Mark as Learned
          </button>
          <span v-else class="text-xs font-medium text-green-600 flex items-center gap-1">
            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Learned
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
