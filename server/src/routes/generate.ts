import { Router, type Request, type Response } from 'express'
import { buildGeneratePrompt, buildTranslatePrompt } from '../prompts.js'
import { pickRandomTopic, difficultyToParams, type Difficulty } from '../contentTopics.js'

const router = Router()

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434'
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen3.5:9b'

interface GenerateBody {
  difficulty: Difficulty
  knownHskLevel: number
}

interface TranslateBody {
  chinese: string
}

function setupSSE(res: Response) {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()
}

async function fetchOllamaStream(system: string, user: string) {
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
      stream: true,
      think: false,
    }),
  })
}

async function streamResponseBody(
  ollamaBody: ReadableStream<Uint8Array>,
  res: Response
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
    ollamaRes = await fetchOllamaStream(system, user)
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'Unknown error'
    res.status(503).json({
      error: `Could not connect to Ollama. Is it running at ${OLLAMA_BASE_URL}? (${detail})`
    })
    return
  }

  if (!ollamaRes.ok) {
    const errText = await ollamaRes.text().catch(() => 'Unknown error')
    res.status(502).json({
      error: `Ollama returned an error: ${ollamaRes.status} — ${errText}`
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

router.post('/generate', async (req: Request, res: Response) => {
  const body = req.body as GenerateBody

  if (!body.difficulty || body.knownHskLevel === undefined || body.knownHskLevel === null) {
    res.status(400).json({ error: 'Missing required fields: difficulty, knownHskLevel' })
    return
  }

  const { topic, style } = pickRandomTopic(body.difficulty)
  const { newWordCount, paragraphLength } = difficultyToParams(body.difficulty)

  const { system, user } = buildGeneratePrompt({
    style,
    sourceContent: topic,
    newWordCount,
    paragraphLength,
    knownHskLevel: body.knownHskLevel,
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

export default router
