import express from 'express';
import { PrismaClient } from '@prisma/client';
import { auth } from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/jobs/saved - Get all jobs saved by the current user
router.get('/saved', auth, async (req, res) => {
  try {
    const savedJobs = await prisma.savedJob.findMany({
      where: { userId: req.user.id },
      include: {
        job: {
          include: {
            attachments: {
              orderBy: { sortOrder: 'asc' },
            },
            postedBy: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatarUrl: true,
                profession: true,
              }
            },
          }
        }
      },
      orderBy: { savedAt: 'desc' },
    });

    res.json(savedJobs.map(savedJob => savedJob.job));
  } catch (err) {
    console.error('Get saved jobs error:', err);
    res.status(500).json({ error: 'Failed to fetch saved jobs' });
  }
});

// POST /api/jobs/:id/save - Save a job to user's collection
router.post('/:id/save', auth, async (req, res) => {
  try {
    const jobId = Number(req.params.id);
    if (Number.isNaN(jobId)) {
      return res.status(400).json({ error: 'Invalid job ID.' });
    }

    // Check if job exists
    const job = await prisma.job.findUnique({
      where: { id: jobId }
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found.' });
    }

    // Check if already saved
    const existingSave = await prisma.savedJob.findUnique({
      where: {
        userId_jobId: {
          userId: req.user.id,
          jobId: jobId
        }
      }
    });

    if (existingSave) {
      return res.status(400).json({ error: 'Job already saved.' });
    }

    // Save the job
    const savedJob = await prisma.savedJob.create({
      data: {
        userId: req.user.id,
        jobId: jobId
      }
    });

    res.status(201).json(savedJob);
  } catch (err) {
    console.error('Save job error:', err);
    res.status(500).json({ error: 'Failed to save job' });
  }
});

// DELETE /api/jobs/:id/unsave - Remove a job from user's saved collection
router.delete('/:id/unsave', auth, async (req, res) => {
  try {
    const jobId = Number(req.params.id);
    if (Number.isNaN(jobId)) {
      return res.status(400).json({ error: 'Invalid job ID.' });
    }

    // Check if job exists
    const job = await prisma.job.findUnique({
      where: { id: jobId }
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found.' });
    }

    // Check if saved
    const existingSave = await prisma.savedJob.findUnique({
      where: {
        userId_jobId: {
          userId: req.user.id,
          jobId: jobId
        }
      }
    });

    if (!existingSave) {
      return res.status(400).json({ error: 'Job not saved.' });
    }

    // Remove the save
    await prisma.savedJob.delete({
      where: {
        userId_jobId: {
          userId: req.user.id,
          jobId: jobId
        }
      }
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Unsave job error:', err);
    res.status(500).json({ error: 'Failed to unsave job' });
  }
});

export default router;