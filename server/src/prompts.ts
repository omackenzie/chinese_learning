import type { ContentStyle, ParagraphLength, StudyMode } from './contentTopics.js'
import type { LearnerVocabularyProfile, VocabularyLevelBucket } from './generationTypes.js'

interface GeneratePromptParams {
  style: ContentStyle
  sourceContent?: string
  newWordCount: number
  paragraphLength: ParagraphLength
  studyMode: StudyMode
  learnerProfile: LearnerVocabularyProfile
}

const lengthGuidance: Record<ParagraphLength, string> = {
  short: '2-3 sentences',
  medium: '4-6 sentences',
  long: '8-12 sentences',
}

const styleDescriptions: Record<ContentStyle, string> = {
  conversation: 'a realistic conversation between two or more people',
  text_messages: 'a casual text message exchange between friends',
  social_media: 'a natural social media post or thread',
  short_story: 'a short narrative story',
  news_article: 'a short news article',
  diary_entry: 'a personal diary entry',
  email: 'a professional or semi-formal email',
}

function formatLevelLabel(level: number): string {
  return level === 7 ? 'HSK 7-9' : `HSK ${level}`
}

function formatBucket(bucket: VocabularyLevelBucket): string {
  const examples = bucket.words.length > 0
    ? bucket.words.join('、')
    : 'none listed'

  return `- ${formatLevelLabel(bucket.level)}: ${bucket.count} word(s); examples: ${examples}`
}

function buildKnowledgeSummary(profile: LearnerVocabularyProfile): string {
  const completedLevels = profile.fullyLearnedThroughLevel > 0
    ? `- Fully learned all HSK vocabulary through ${formatLevelLabel(profile.fullyLearnedThroughLevel)}.`
    : '- No HSK level is fully learned yet.'

  const partialLevels = profile.partialKnownWords.length > 0
    ? profile.partialKnownWords.map(formatBucket).join('\n')
    : '- No extra higher-level words are marked as learned yet.'

  return `${completedLevels}
- Total learned words tracked: ${profile.knownWordCount}
- Additional learned higher-level words:
${partialLevels}`
}

function buildCandidateSummary(profile: LearnerVocabularyProfile): string {
  if (profile.candidateNewWords.length === 0) {
    return '- No candidate new words remain. Keep all vocabulary inside the known profile and output an empty JSON array.'
  }

  return profile.candidateNewWords.map(formatBucket).join('\n')
}

function buildStudyModeRules(
  studyMode: StudyMode,
  candidateBuckets: VocabularyLevelBucket[],
): string[] {
  const lowestLevel = candidateBuckets[0]?.level
  const highestLevel = candidateBuckets[candidateBuckets.length - 1]?.level

  switch (studyMode) {
    case 'review':
      return [
        'Stay very close to the learner\'s comfort zone.',
        lowestLevel !== undefined
          ? `Choose all new words from ${formatLevelLabel(lowestLevel)} only.`
          : 'Do not introduce any new words.',
        'Keep grammar and sentence patterns familiar and low-risk.',
      ]
    case 'balanced':
      return [
        'Aim for mostly comfortable reading with a small amount of challenge.',
        lowestLevel !== undefined
          ? `Prefer new words from ${formatLevelLabel(lowestLevel)}. Only use the next candidate level if it helps the text feel natural.`
          : 'Do not introduce any new words.',
        'Keep the text natural rather than cramming in difficult vocabulary.',
      ]
    case 'stretch':
      return [
        'Make the passage meaningfully challenging while still readable.',
        highestLevel !== undefined
          ? `You may use any candidate level, and prefer ${formatLevelLabel(highestLevel)} when it still feels natural.`
          : 'Do not introduce any new words.',
        'Use slightly richer phrasing, but keep the passage coherent for a learner.',
      ]
  }
}

export function buildGeneratePrompt(params: GeneratePromptParams): {
  system: string
  user: string
} {
  const {
    style,
    sourceContent,
    newWordCount,
    paragraphLength,
    studyMode,
    learnerProfile,
  } = params

  const styleDesc = styleDescriptions[style]
  const length = lengthGuidance[paragraphLength]
  const knowledgeSummary = buildKnowledgeSummary(learnerProfile)
  const candidateSummary = buildCandidateSummary(learnerProfile)
  const studyModeRules = buildStudyModeRules(studyMode, learnerProfile.candidateNewWords)
    .map((rule) => `- ${rule}`)
    .join('\n')

  const newWordRule = newWordCount > 0
    ? `- Introduce exactly ${newWordCount} new word(s), chosen only from the allowed candidate-word lists below.`
    : '- Introduce zero new words and output an empty JSON array after the separator.'

  const system = `You are a Chinese language teaching assistant. Your job is to write natural, coherent Chinese content for a learner while staying tightly aligned to the learner profile.

Learner profile:
${knowledgeSummary}

Allowed candidate new words:
${candidateSummary}

Study mode guidance:
${studyModeRules}

Rules:
- Write in simplified Chinese characters.
- Use vocabulary primarily from the learner's known profile.
${newWordRule}
- Outside the exact new words you introduce, avoid vocabulary that falls outside the learner's known profile.
- The content must be realistic and natural. Write something a real Chinese speaker would actually say or write in this format. Avoid textbook-style artificial sentences.
- Do NOT include pinyin in the main text.
- Keep grammar appropriate for the learner's comfort zone.

Output format (follow this exactly):
1. Write the Chinese content.
2. On a new line, write exactly: ---NEW_WORDS---
3. On a new line, output a JSON array of the new word(s) you introduced. Each element must have "simplified", "pinyin" (with tone marks), and "english" keys.
Example: [{"simplified":"例子","pinyin":"lìzi","english":"example"}]
If there are zero new words, output [].

Output nothing else after the JSON array.`

  let userPrompt = `Write ${styleDesc} in Chinese. Length: ${length}. Study mode: ${studyMode}.`

  if (sourceContent) {
    userPrompt += ` Base the topic or theme on the following: "${sourceContent}".`
  }

  if (newWordCount > 0) {
    userPrompt += ` Introduce exactly ${newWordCount} new word(s) from the allowed candidate-word lists.`
  } else {
    userPrompt += ' Do not introduce any new words.'
  }

  return { system, user: userPrompt }
}

export function buildTranslatePrompt(chinese: string): {
  system: string
  user: string
} {
  const system = `You are a professional Chinese-to-English translator. Provide a natural, accurate English translation. Only output the translation — no explanations, notes, or additional commentary.`

  const user = `Translate the following Chinese text into natural English:\n\n${chinese}`

  return { system, user }
}
