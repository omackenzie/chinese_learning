interface GeneratePromptParams {
  style: string
  sourceContent?: string
  newWordCount: number
  paragraphLength: 'short' | 'medium' | 'long'
  knownHskLevel: number
}

const lengthGuidance: Record<string, string> = {
  short: '2-3 sentences',
  medium: '4-6 sentences',
  long: '8-12 sentences',
}

const styleDescriptions: Record<string, string> = {
  conversation: 'a realistic conversation between two or more people',
  text_messages: 'a casual text message exchange between friends',
  story: 'a short narrative story',
  news_article: 'a short news article',
  diary_entry: 'a personal diary entry',
  email: 'a professional or semi-formal email',
}

export function buildGeneratePrompt(params: GeneratePromptParams): {
  system: string
  user: string
} {
  const { style, sourceContent, newWordCount, paragraphLength, knownHskLevel } = params

  const styleDesc = styleDescriptions[style] || `a ${style}`
  const length = lengthGuidance[paragraphLength] || '4-6 sentences'
  const targetLevel = Math.min(knownHskLevel + 1, 7)
  const targetLevelLabel = targetLevel === 7 ? '7-9' : String(targetLevel)

  const system = `You are a Chinese language teaching assistant. Your job is to write natural, coherent Chinese content for language learners.

The student's current level: HSK ${knownHskLevel}. They are comfortable with vocabulary from HSK levels 1 through ${knownHskLevel}.

Rules:
- Write in simplified Chinese characters.
- Use vocabulary primarily from HSK levels 1–${knownHskLevel}. This is the student's comfort zone.
- Introduce exactly ${newWordCount} new word(s) from HSK level ${targetLevelLabel}. These new words should fit naturally into the content — do not force them in awkwardly.
- The content must be realistic and natural. Write something a real Chinese speaker would actually say or write in this format. Avoid textbook-style artificial sentences.
- Do NOT include pinyin in the main text.
- Keep grammar structures appropriate for HSK ${knownHskLevel} level.

Output format (follow this exactly):
1. Write the Chinese content.
2. On a new line, write exactly: ---NEW_WORDS---
3. On a new line, output a JSON array of the ${newWordCount} new word(s) you introduced. Each element must have "simplified", "pinyin" (with tone marks), and "english" keys.
Example: [{"simplified":"例子","pinyin":"lìzi","english":"example"}]

Output nothing else after the JSON array.`

  let userPrompt = `Write ${styleDesc} in Chinese. Length: ${length}.`

  if (sourceContent) {
    userPrompt += ` Base the topic or theme on the following: "${sourceContent}".`
  }

  userPrompt += ` Remember to introduce exactly ${newWordCount} new word(s) from HSK ${targetLevelLabel}.`

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
