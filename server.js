import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
dotenv.config()

const app = express()
app.use(cors())
app.use(express.json())

app.post('/api/chat', async (req, res) => {
  try {
    const { messages, system } = req.body
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        stream: true,
        messages: [
          { role: 'system', content: system || 'You are a helpful assistant.' },
          ...messages
        ]
      })
    })

    if (!response.ok) {
      const err = await response.text()
      return res.status(response.status).json({ error: err })
    }

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')

    // Pipe the Groq SSE stream straight to the client
    response.body.pipeTo(
      new WritableStream({
        write(chunk) { res.write(chunk) },
        close() { res.end() },
        abort(err) { res.end() }
      })
    )
  } catch (err) {
    res.status(500).json({ error: 'Failed to reach Groq API' })
  }
})

app.listen(3001, () => console.log('✅ API server running on http://localhost:3001'))
