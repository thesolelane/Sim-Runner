import { Router } from 'express'
import { supabaseAdmin } from '../lib/clients.js'
import { requireAuth } from '../lib/auth.js'
import { logError } from '../lib/errorLog.js'

const router = Router()

router.post('/', requireAuth, async (req, res) => {
  const { post_type, body, hashtags, is_urgent, media_urls } = req.body
  const userId = req.user.id

  if (!body?.trim()) return res.status(400).json({ error: 'Body is required' })

  const insertRow = {
    author_id: userId,
    post_type: post_type ?? 'update',
    body: body.trim(),
    hashtags: hashtags ?? [],
    media_urls: media_urls ?? [],
  }

  const { data, error } = await supabaseAdmin
    .from('posts')
    .insert(insertRow)
    .select(
      `
      id, post_type, body, media_urls, hashtags, like_count, comment_count, share_count,
      is_boosted, created_at, author_id,
      users!author_id (display_name, handle, avatar_url, account_type)
    `
    )
    .single()

  if (error) {
    console.error('[posts] insert error:', error)
    logError({
      context: 'post',
      message: 'Post creation failed',
      detail: error.message,
      stack: null,
      userId,
      route: '/api/posts',
      method: 'POST',
      statusCode: 500,
    })
    return res.status(500).json({ error: error.message })
  }

  res.json({ post: data })
})

export default router
