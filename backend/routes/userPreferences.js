import express from 'express';
import { PrismaClient } from '@prisma/client';
import { auth } from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/users/preferences - Get current user's job preferences
router.get('/preferences', auth, async (req, res) => {
  try {
    let preferences = await prisma.jobPreference.findUnique({
      where: { userId: req.user.id }
    });

    // If no preferences exist, create default ones
    if (!preferences) {
      preferences = await prisma.jobPreference.create({
        data: {
          userId: req.user.id,
          skills: [],
          jobTypes: [],
          locations: [],
          remoteOnly: false
        }
      });
    }

    res.json(preferences);
  } catch (err) {
    console.error('Get preferences error:', err);
    res.status(500).json({ error: 'Failed to fetch preferences' });
  }
});

// POST /api/users/preferences - Update user job preferences
router.post('/preferences', auth, async (req, res) => {
  try {
    const { skills, jobTypes, locations, remoteOnly, minBudget, maxBudget } = req.body;

    // Validate inputs
    if (skills !== undefined && !Array.isArray(skills)) {
      return res.status(400).json({ error: 'Skills must be an array' });
    }
    if (jobTypes !== undefined && !Array.isArray(jobTypes)) {
      return res.status(400).json({ error: 'Job types must be an array' });
    }
    if (locations !== undefined && !Array.isArray(locations)) {
      return res.status(400).json({ error: 'Locations must be an array' });
    }
    if (remoteOnly !== undefined && typeof remoteOnly !== 'boolean') {
      return res.status(400).json({ error: 'Remote only must be a boolean' });
    }
    if (minBudget !== undefined && (typeof minBudget !== 'number' || minBudget < 0)) {
      return res.status(400).json({ error: 'Min budget must be a positive number' });
    }
    if (maxBudget !== undefined && (typeof maxBudget !== 'number' || maxBudget < 0)) {
      return res.status(400).json({ error: 'Max budget must be a positive number' });
    }
    if (minBudget !== undefined && maxBudget !== undefined && minBudget > maxBudget) {
      return res.status(400).json({ error: 'Min budget cannot be greater than max budget' });
    }

    // Update or create preferences
    const preferences = await prisma.jobPreference.upsert({
      where: { userId: req.user.id },
      update: {
        skills: skills || [],
        jobTypes: jobTypes || [],
        locations: locations || [],
        remoteOnly: remoteOnly !== undefined ? remoteOnly : false,
        minBudget: minBudget !== undefined ? minBudget : null,
        maxBudget: maxBudget !== undefined ? maxBudget : null,
        updatedAt: new Date()
      },
      create: {
        userId: req.user.id,
        skills: skills || [],
        jobTypes: jobTypes || [],
        locations: locations || [],
        remoteOnly: remoteOnly || false,
        minBudget: minBudget || null,
        maxBudget: maxBudget || null
      }
    });

    res.json(preferences);
  } catch (err) {
    console.error('Update preferences error:', err);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

export default router;