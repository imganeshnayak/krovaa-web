import express from 'express'
import multer from 'multer'
import { v2 as cloudinary } from 'cloudinary'
import streamifier from 'streamifier'
import prisma from '../prismaClient.js'
import { auth as requireAuth } from '../middleware/auth.js'

const router = express.Router()
const upload = multer()

async function uploadToCloudinary(buffer, folder = 'posts') {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({ folder }, (error, result) => {
      if (error) return reject(error)
      resolve(result)
    })
    streamifier.createReadStream(buffer).pipe(stream)
  })
}

router.post('/', requireAuth, upload.array('files', 6), async (req, res) => {
  try {
    const user = req.user
    const text = req.body.text || null
    const files = req.files || []

    // Validate that files are only images or videos
    const validFiles = files.filter(f => {
      const type = f.mimetype
      return type.startsWith('image/') || type.startsWith('video/')
    })

    if (validFiles.length < files.length) {
      return res.status(400).json({ error: 'Only image and video files are allowed' })
    }

    const media = []
    for (const f of validFiles) {
      const result = await uploadToCloudinary(f.buffer)
      media.push({ url: result.secure_url, resource_type: result.resource_type })
    }

    const created = await prisma.post.create({
      data: {
        userId: user.id,
        text,
        media: media.length ? media : null,
      },
    })

    res.json(created)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to create post' })
  }
})

router.get('/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId, 10)
    const posts = await prisma.post.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
        likes: true,
        comments: {
          include: { user: { select: { id: true, username: true, displayName: true, avatarUrl: true } } },
          orderBy: { createdAt: 'desc' },
          take: 3,
        },
      },
    })
    res.json(posts)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch posts' })
  }
})

// Like a post
router.post('/:postId/like', requireAuth, async (req, res) => {
  try {
    const postId = parseInt(req.params.postId, 10)
    const userId = req.user.id

    // Check if already liked
    const existing = await prisma.post_Like.findUnique({
      where: { postId_userId: { postId, userId } },
    })

    if (existing) {
      // Unlike
      await prisma.post_Like.delete({ where: { id: existing.id } })
      return res.json({ liked: false })
    }

    // Like
    await prisma.post_Like.create({ data: { postId, userId } })
    res.json({ liked: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to like post' })
  }
})

// Get post with all details
router.get('/:postId/details', async (req, res) => {
  try {
    const postId = parseInt(req.params.postId, 10)
    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: {
        user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
        likes: { select: { userId: true } },
        comments: {
          include: { user: { select: { id: true, username: true, displayName: true, avatarUrl: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!post) return res.status(404).json({ error: 'Post not found' })
    res.json(post)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch post details' })
  }
})

// Add comment to post
router.post('/:postId/comments', requireAuth, async (req, res) => {
  try {
    const postId = parseInt(req.params.postId, 10)
    const { text } = req.body
    const userId = req.user.id

    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Comment text is required' })
    }

    const comment = await prisma.post_Comment.create({
      data: { postId, userId, text: text.trim() },
      include: { user: { select: { id: true, username: true, displayName: true, avatarUrl: true } } },
    })

    res.json(comment)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to add comment' })
  }
})

// Delete comment
router.delete('/:postId/comments/:commentId', requireAuth, async (req, res) => {
  try {
    const commentId = parseInt(req.params.commentId, 10)
    const userId = req.user.id

    const comment = await prisma.post_Comment.findUnique({
      where: { id: commentId },
    })

    if (!comment) return res.status(404).json({ error: 'Comment not found' })
    if (comment.userId !== userId) return res.status(403).json({ error: 'Unauthorized' })

    await prisma.post_Comment.delete({ where: { id: commentId } })
    res.json({ success: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to delete comment' })
  }
})

// Delete post
router.delete('/:postId', requireAuth, async (req, res) => {
  try {
    const postId = parseInt(req.params.postId, 10)
    const userId = req.user.id

    const post = await prisma.post.findUnique({
      where: { id: postId },
    })

    if (!post) return res.status(404).json({ error: 'Post not found' })
    if (post.userId !== userId) return res.status(403).json({ error: 'Unauthorized' })

    await prisma.post.delete({ where: { id: postId } })
    res.json({ success: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to delete post' })
  }
})

export default router
