import type { ContentStyle, ParagraphLength, StudyMode } from './contentTopics.js'
import type { LearnerVocabularyProfile, VocabularyLevelBucket } from './generationTypes.js'

interface GeneratePromptParams {
  style: ContentStyle
  sourceContent?: string
  newWordCount: number
  paragraphLength: ParagraphLength
  studyMode: StudyMode
  learnerProfile: LearnerVocabularyProfile
  forbiddenWords?: string[]
}

interface TranslationFeedbackPromptParams {
  chinese: string
  userTranslation: string
  newWords: { simplified: string; english: string }[]
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
  const listedWords = bucket.words.length > 0
    ? bucket.words.join('、')
    : 'none listed'

  const scope = bucket.isComplete
    ? 'exact listed words'
    : 'listed words (truncated for prompt size)'

  return `- ${formatLevelLabel(bucket.level)}: ${bucket.count} word(s); ${scope}: ${listedWords}`
}

function buildKnowledgeSummary(profile: LearnerVocabularyProfile): string {
  const completedLevels = profile.fullyLearnedThroughLevel > 0
    ? `- Fully learned all HSK vocabulary through ${formatLevelLabel(profile.fullyLearnedThroughLevel)}.`
    : '- No HSK level is fully learned yet.'

  const partialLevels = profile.partialKnownWords.length > 0
    ? profile.partialKnownWords.map(formatBucket).join('\n')
    : '- No extra words are marked as learned from incomplete higher levels.'

  return `${completedLevels}
- Total learned words tracked: ${profile.knownWordCount}
- For any level above the fully learned boundary, only the listed tracked words are allowed:
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
    forbiddenWords,
  } = params

  const styleDesc = styleDescriptions[style]
  const length = lengthGuidance[paragraphLength]
  const knowledgeSummary = buildKnowledgeSummary(learnerProfile)
  const candidateSummary = buildCandidateSummary(learnerProfile)
  const forbiddenWordSummary = forbiddenWords && forbiddenWords.length > 0
    ? forbiddenWords.join('、')
    : ''
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
- Treat the listed words for incomplete levels as hard vocabulary limits, not examples.
- Before writing, first choose the exact new words you will introduce.
- Then write the passage using only:
  1. any words from fully learned levels,
  2. the tracked known words listed for incomplete levels,
  3. the exact chosen new words.
- Outside the exact chosen new words, do not use any other vocabulary from incomplete levels.
- The content must be realistic and natural. Write something a real Chinese speaker would actually say or write in this format. Avoid textbook-style artificial sentences.
- Do NOT include pinyin in the main text.
- Keep grammar appropriate for the learner's comfort zone.
${forbiddenWordSummary ? `- Do NOT use any of these previously rejected out-of-profile words: ${forbiddenWordSummary}` : ''}

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

  if (forbiddenWordSummary) {
    userPrompt += ` Do not use these rejected words: ${forbiddenWordSummary}.`
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

export function buildTranslationFeedbackPrompt(params: TranslationFeedbackPromptParams): {
  system: string
  user: string
} {
  const newWordContext = params.newWords.length > 0
    ? params.newWords
      .map((word) => `${word.simplified} = ${word.english}`)
      .join(', ')
    : 'No highlighted new words.'

  const system = `You are a concise Chinese-to-English translation tutor. Compare the learner's translation with the original Chinese. Be encouraging, specific, and practical.

Return JSON only with this exact shape:
{
  "summary": "one short paragraph",
  "strengths": ["short bullet", "short bullet"],
  "improvements": ["short bullet", "short bullet"],
  "newWordNotes": ["short bullet", "short bullet"]
}

Rules:
- Keep each list to 0-3 items.
- Focus on meaning, omissions, tone, and key vocabulary.
- Do not be harsh or academic.
- If the learner translation is acceptable but phrased differently, say so.
- If there are no useful notes for a list, return an empty array.`

  const user = `Original Chinese:
${params.chinese}

Learner translation:
${params.userTranslation}

Highlighted new words:
${newWordContext}`

  return { system, user }
}
