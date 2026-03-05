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
        messages: [
          { role: 'system', content: system || 'You are a helpful assistant.' },
          ...messages
        ]
      })
    })
    const data = await response.json()
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: 'Failed to reach Groq API' })
  }
})

app.listen(3001, () => console.log('✅ API server running on http://localhost:3001'))
