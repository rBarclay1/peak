import Anthropic from '@anthropic-ai/sdk'

// Structured-output schema: the model must return exactly these fields.
const SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string', description: 'Short label for the food, e.g. "Eggs & toast"' },
    calories: { type: 'number', description: 'Total kcal for the whole described amount' },
    protein_g: { type: 'number' },
    carbs_g: { type: 'number' },
    fat_g: { type: 'number' },
    assumptions: {
      type: 'string',
      description: 'One short phrase noting any portion sizes or prep that were assumed',
    },
  },
  required: ['name', 'calories', 'protein_g', 'carbs_g', 'fat_g', 'assumptions'],
  additionalProperties: false,
}

const SYSTEM = `You estimate nutrition macros from a free-text description of food someone ate.
Assume standard/typical portion sizes and common preparation when details are missing.
Estimate totals for the ENTIRE described amount (sum every item mentioned), not per-serving.
Return whole numbers. Keep "name" to a short label. In "assumptions", briefly note any portion
sizes or preparation you assumed, in one short phrase.`

function readJson(req) {
  return new Promise((resolve) => {
    let raw = ''
    req.on('data', (c) => {
      raw += c
    })
    req.on('end', () => {
      try {
        resolve(JSON.parse(raw || '{}'))
      } catch {
        resolve({})
      }
    })
    req.on('error', () => resolve({}))
  })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    res.status(500).json({ error: 'Server is missing ANTHROPIC_API_KEY' })
    return
  }

  let body = req.body
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body)
    } catch {
      body = null
    }
  }
  if (!body) body = await readJson(req)

  const description = String(body?.description || '').trim()
  if (!description) {
    res.status(400).json({ error: 'Missing description' })
    return
  }

  try {
    const client = new Anthropic() // reads ANTHROPIC_API_KEY from env
    const message = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1024,
      // Simple extraction task — Haiku is fast/cheap. Note: the `effort`
      // parameter is not supported on Haiku and would 400, so it's omitted.
      output_config: {
        format: { type: 'json_schema', schema: SCHEMA },
      },
      system: SYSTEM,
      messages: [{ role: 'user', content: description }],
    })

    const text = message.content.find((b) => b.type === 'text')?.text || '{}'
    res.status(200).json(JSON.parse(text))
  } catch (err) {
    const status = typeof err?.status === 'number' && err.status >= 400 && err.status < 600 ? err.status : 500
    res.status(status).json({ error: err?.message || 'Estimation failed' })
  }
}
