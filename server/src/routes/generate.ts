import { Router, type Request, type Response } from 'express'
import {
  buildGeneratePrompt,
  buildTranslatePrompt,
  buildTranslationFeedbackPrompt,
} from '../prompts.js'
import {
  isParagraphLength,
  isStudyMode,
  pickRandomTopic,
  studyModeToParams,
} from '../contentTopics.js'
import type { GenerateBody, LearnerVocabularyProfile, VocabularyLevelBucket } from '../generationTypes.js'

const router = Router()

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434'
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen3.5:4b'

interface TranslateBody {
  chinese: string
}

interface TranslationFeedbackBody {
  chinese: string
  userTranslation: string
  newWords?: { simplified: string; english: string }[]
}

function setupSSE(res: Response) {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()
}

async function fetchOllama(system: string, user: string, stream: boolean) {
  const url = `${OLLAMA_BASE_URL}/api/chat`
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      stream,
      think: false,
    }),
  })
}

async function streamResponseBody(
  ollamaBody: ReadableStream<Uint8Array>,
  res: Response,
) {
  const reader = ollamaBody.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) continue

        try {
          const parsed = JSON.parse(trimmed)
          if (parsed.message?.content) {
            res.write(`data: ${JSON.stringify({ content: parsed.message.content })}\n\n`)
          }
          if (parsed.done) {
            return
          }
        } catch {
          // Incomplete JSON line — will be handled in next iteration
        }
      }
    }

    if (buffer.trim()) {
      try {
        const parsed = JSON.parse(buffer.trim())
        if (parsed.message?.content) {
          res.write(`data: ${JSON.stringify({ content: parsed.message.content })}\n\n`)
        }
      } catch {
        // ignore
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Stream error'
    res.write(`data: ${JSON.stringify({ error: message })}\n\n`)
  }
}

async function handleOllamaRequest(system: string, user: string, res: Response) {
  let ollamaRes: globalThis.Response
  try {
    ollamaRes = await fetchOllama(system, user, true)
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'Unknown error'
    res.status(503).json({
      error: `Could not connect to Ollama. Is it running at ${OLLAMA_BASE_URL}? (${detail})`,
    })
    return
  }

  if (!ollamaRes.ok) {
    const errText = await ollamaRes.text().catch(() => 'Unknown error')
    res.status(502).json({
      error: `Ollama returned an error: ${ollamaRes.status} — ${errText}`,
    })
    return
  }

  if (!ollamaRes.body) {
    res.status(502).json({ error: 'No response body from Ollama' })
    return
  }

  setupSSE(res)
  await streamResponseBody(ollamaRes.body, res)
  res.write('data: [DONE]\n\n')
  res.end()
}

function isTranslationFeedbackBody(value: unknown): value is TranslationFeedbackBody {
  if (!value || typeof value !== 'object') return false

  const body = value as Record<string, unknown>
  return typeof body.chinese === 'string'
    && typeof body.userTranslation === 'string'
    && (body.newWords === undefined
      || (Array.isArray(body.newWords)
        && body.newWords.every((word) =>
          Boolean(word)
          && typeof word === 'object'
          && typeof (word as Record<string, unknown>).simplified === 'string'
          && typeof (word as Record<string, unknown>).english === 'string',
        )))
}

function extractJsonObject<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T
  } catch {
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return null

    try {
      return JSON.parse(match[0]) as T
    } catch {
      return null
    }
  }
}

async function fetchOllamaText(system: string, user: string) {
  let ollamaRes: globalThis.Response
  try {
    ollamaRes = await fetchOllama(system, user, false)
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'Unknown error'
    throw new Error(`Could not connect to Ollama. Is it running at ${OLLAMA_BASE_URL}? (${detail})`)
  }

  if (!ollamaRes.ok) {
    const errText = await ollamaRes.text().catch(() => 'Unknown error')
    throw new Error(`Ollama returned an error: ${ollamaRes.status} — ${errText}`)
  }

  const data = await ollamaRes.json() as { message?: { content?: unknown } }
  const content = data.message?.content

  if (typeof content !== 'string') {
    throw new Error('Ollama returned an invalid non-stream response')
  }

  return content
}

function isVocabularyLevelBucket(value: unknown): value is VocabularyLevelBucket {
  if (!value || typeof value !== 'object') return false

  const bucket = value as Record<string, unknown>
  return Number.isInteger(bucket.level)
    && Number.isInteger(bucket.count)
    && typeof bucket.isComplete === 'boolean'
    && Array.isArray(bucket.words)
    && bucket.words.every((word) => typeof word === 'string')
}

function isLearnerVocabularyProfile(value: unknown): value is LearnerVocabularyProfile {
  if (!value || typeof value !== 'object') return false

  const profile = value as Record<string, unknown>
  return Number.isInteger(profile.fullyLearnedThroughLevel)
    && Number.isInteger(profile.knownWordCount)
    && Array.isArray(profile.partialKnownWords)
    && profile.partialKnownWords.every(isVocabularyLevelBucket)
    && Array.isArray(profile.candidateNewWords)
    && profile.candidateNewWords.every(isVocabularyLevelBucket)
}

router.post('/generate', async (req: Request, res: Response) => {
  const body = req.body as Partial<GenerateBody>

  if (
    !isParagraphLength(body.paragraphLength)
    || !isStudyMode(body.studyMode)
    || !isLearnerVocabularyProfile(body.learnerProfile)
    || (body.forbiddenWords !== undefined
      && (!Array.isArray(body.forbiddenWords)
        || body.forbiddenWords.some((word) => typeof word !== 'string')))
  ) {
    res.status(400).json({
      error: 'Missing or invalid required fields: paragraphLength, studyMode, learnerProfile, forbiddenWords',
    })
    return
  }

  const { topic, style } = pickRandomTopic({
    paragraphLength: body.paragraphLength,
  })
  const { newWordCount, paragraphLength } = studyModeToParams(
    body.studyMode,
    body.paragraphLength,
  )
  const totalCandidateWords = body.learnerProfile.candidateNewWords.reduce(
    (sum, bucket) => sum + bucket.words.length,
    0,
  )
  const cappedNewWordCount = Math.min(newWordCount, totalCandidateWords)

  const { system, user } = buildGeneratePrompt({
    style,
    sourceContent: topic,
    newWordCount: cappedNewWordCount,
    paragraphLength,
    studyMode: body.studyMode,
    learnerProfile: body.learnerProfile,
    forbiddenWords: body.forbiddenWords,
  })

  await handleOllamaRequest(system, user, res)
})

router.post('/translate', async (req: Request, res: Response) => {
  const body = req.body as TranslateBody

  if (!body.chinese) {
    res.status(400).json({ error: 'Missing required field: chinese' })
    return
  }

  const { system, user } = buildTranslatePrompt(body.chinese)

  await handleOllamaRequest(system, user, res)
})

router.post('/translation-feedback', async (req: Request, res: Response) => {
  if (!isTranslationFeedbackBody(req.body)) {
    res.status(400).json({
      error: 'Missing or invalid required fields: chinese, userTranslation, newWords',
    })
    return
  }

  const { system, user } = buildTranslationFeedbackPrompt({
    chinese: req.body.chinese,
    userTranslation: req.body.userTranslation,
    newWords: req.body.newWords ?? [],
  })

  let content: string
  try {
    content = await fetchOllamaText(system, user)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Translation feedback failed'
    res.status(502).json({ error: message })
    return
  }

  const parsed = extractJsonObject<{
    summary?: unknown
    strengths?: unknown
    improvements?: unknown
    newWordNotes?: unknown
  }>(content)

  if (!parsed) {
    res.status(502).json({ error: 'Ollama returned invalid structured translation feedback.' })
    return
  }

  res.json({
    summary: typeof parsed.summary === 'string' ? parsed.summary : 'No summary available.',
    strengths: Array.isArray(parsed.strengths)
      ? parsed.strengths.filter((item): item is string => typeof item === 'string')
      : [],
    improvements: Array.isArray(parsed.improvements)
      ? parsed.improvements.filter((item): item is string => typeof item === 'string')
      : [],
    newWordNotes: Array.isArray(parsed.newWordNotes)
      ? parsed.newWordNotes.filter((item): item is string => typeof item === 'string')
      : [],
  })
})

export default router
