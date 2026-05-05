import { Router } from 'express'
import multer from 'multer'
import { supabaseAdmin } from '../lib/clients.js'
import { requireAuth } from '../lib/auth.js'
import { logError } from '../lib/errorLog.js'

const router = Router()

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (allowed.includes(file.mimetype)) cb(null, true)
    else cb(new Error('Only images are allowed'))
  },
})

router.post('/post-media', requireAuth, upload.array('files', 4), async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No files provided' })
  }

  const userId = req.user.id
  const urls = []

  for (const file of req.files) {
    const ext = file.originalname.split('.').pop() ?? 'jpg'
    const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

    const { error } = await supabaseAdmin.storage.from('post-media').upload(path, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    })

    if (error) {
      console.error('[upload] storage error:', error.message)
      logError({
        context: 'upload',
        message: 'Photo upload failed',
        detail: error.message,
        stack: null,
        userId,
        route: '/api/upload/post-media',
        method: 'POST',
        statusCode: 500,
      })
      return res.status(500).json({ error: `Upload failed: ${error.message}` })
    }

    const { data } = supabaseAdmin.storage.from('post-media').getPublicUrl(path)
    urls.push(data.publicUrl)
  }

  res.json({ urls })
})

export default router
