import express from 'express';
import { PrismaClient } from '@prisma/client';
import { auth } from '../middleware/auth.js';

const prisma = new PrismaClient();
const router = express.Router();

// Create community
router.post('/', auth, async (req, res) => {
  try {
    const { name, description, isPrivate } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required.' });

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    const community = await prisma.community.create({
      data: {
        name,
        slug,
        description,
        isPrivate: !!isPrivate,
        creatorId: req.user.id,
        members: { create: { userId: req.user.id, role: 'owner' } }
      }
    });

    res.json(community);
  } catch (err) {
    console.error('Create community error:', err);
    res.status(500).json({ error: 'Failed to create community.' });
  }
});

// List communities (public + joined)
router.get('/', auth, async (req, res) => {
  try {
    const communities = await prisma.community.findMany({
      where: { OR: [{ isPrivate: false }, { members: { some: { userId: req.user.id } } }] },
      include: { members: { select: { userId: true, role: true } }, creator: true }
    });
    res.json(communities);
  } catch (err) {
    console.error('List communities error:', err);
    res.status(500).json({ error: 'Failed to list communities.' });
  }
});

// Get community details
router.get('/:id', auth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const community = await prisma.community.findUnique({
      where: { id },
      include: { members: { include: { user: true } }, projects: true, creator: true }
    });
    if (!community) return res.status(404).json({ error: 'Community not found.' });
    // If private, ensure member
    if (community.isPrivate) {
      const member = await prisma.communityMember.findUnique({ where: { communityId_userId: { communityId: id, userId: req.user.id } } }).catch(() => null);
      if (!member && req.user.id !== community.creatorId) return res.status(403).json({ error: 'Private community.' });
    }
    
    // Add helper flags
    const isCreator = community.creatorId === req.user.id;
    const isMember = community.members.some(m => m.userId === req.user.id);
    const memberCount = community.members.length;
    
    res.json({
      ...community,
      isCreator,
      isMember,
      memberCount
    });
  } catch (err) {
    console.error('Get community error:', err);
    res.status(500).json({ error: 'Failed to get community.' });
  }
});

// Join community
router.post('/:id/join', auth, async (req, res) => {
  try {
    const communityId = Number(req.params.id);
    const community = await prisma.community.findUnique({ 
      where: { id: communityId }
    });
    if (!community) return res.status(404).json({ error: 'Community not found.' });
    if (community.isPrivate) return res.status(403).json({ error: 'Cannot join private community without invite.' });
    await prisma.communityMember.create({ data: { communityId, userId: req.user.id } });
    res.json({ success: true });
  } catch (err) {
    console.error('Join community error:', err);
    res.status(500).json({ error: 'Failed to join community.' });
  }
});

// Leave community
router.post('/:id/leave', auth, async (req, res) => {
  try {
    const communityId = Number(req.params.id);
    await prisma.communityMember.deleteMany({ where: { communityId, userId: req.user.id } });
    res.json({ success: true });
  } catch (err) {
    console.error('Leave community error:', err);
    res.status(500).json({ error: 'Failed to leave community.' });
  }
});

// Create project in community
router.post('/:id/projects', auth, async (req, res) => {
  try {
    const communityId = Number(req.params.id);
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: 'Project name required.' });
    // Ensure user is member
    const member = await prisma.communityMember.findUnique({ where: { communityId_userId: { communityId, userId: req.user.id } } }).catch(() => null);
    if (!member && req.user.id !== (await prisma.community.findUnique({ where: { id: communityId } })).creatorId) return res.status(403).json({ error: 'Not a member.' });

    const project = await prisma.project.create({ data: { communityId, name, description, createdBy: req.user.id } });
    res.json(project);
  } catch (err) {
    console.error('Create project error:', err);
    res.status(500).json({ error: 'Failed to create project.' });
  }
});

// List projects in community
router.get('/:id/projects', auth, async (req, res) => {
  try {
    const communityId = Number(req.params.id);
    const projects = await prisma.project.findMany({ where: { communityId }, include: { creator: true } });
    res.json(projects);
  } catch (err) {
    console.error('List projects error:', err);
    res.status(500).json({ error: 'Failed to list projects.' });
  }
});

// Add member (invite/approve simplified)
router.post('/:id/members', auth, async (req, res) => {
  try {
    const communityId = Number(req.params.id);
    const { userId, role = 'member' } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId required.' });
    const existing = await prisma.communityMember.findUnique({ where: { communityId_userId: { communityId, userId } } }).catch(() => null);
    if (existing) return res.status(400).json({ error: 'User already a member.' });
    const member = await prisma.communityMember.create({ data: { communityId, userId, role } });
    res.json(member);
  } catch (err) {
    console.error('Add member error:', err);
    res.status(500).json({ error: 'Failed to add member.' });
  }
});

// Remove member
router.delete('/:id/members/:userId', auth, async (req, res) => {
  try {
    const communityId = Number(req.params.id);
    const userId = Number(req.params.userId);
    await prisma.communityMember.deleteMany({ where: { communityId, userId } });
    res.json({ success: true });
  } catch (err) {
    console.error('Remove member error:', err);
    res.status(500).json({ error: 'Failed to remove member.' });
  }
});

// Create project message
router.post('/projects/:projectId/messages', auth, async (req, res) => {
  try {
    const projectId = Number(req.params.projectId);
    const { content, messageType = 'text', attachmentUrl } = req.body;
    if (!content && !attachmentUrl) return res.status(400).json({ error: 'Message content or attachment required.' });
    const msg = await prisma.projectMessage.create({ data: { projectId, senderId: req.user.id, content: content || '', messageType, attachmentUrl } });
    res.json(msg);
  } catch (err) {
    console.error('Create project message error:', err);
    res.status(500).json({ error: 'Failed to post message.' });
  }
});

// List project messages
router.get('/projects/:projectId/messages', auth, async (req, res) => {
  try {
    const projectId = Number(req.params.projectId);
    const messages = await prisma.projectMessage.findMany({ where: { projectId }, include: { sender: true }, orderBy: { createdAt: 'asc' } });
    res.json(messages);
  } catch (err) {
    console.error('List project messages error:', err);
    res.status(500).json({ error: 'Failed to list messages.' });
  }
});

// Create project file (placeholder - expects file uploaded elsewhere and URL provided)
router.post('/projects/:projectId/files', auth, async (req, res) => {
  try {
    const projectId = Number(req.params.projectId);
    const { fileName, fileUrl, metadata } = req.body;
    if (!fileName || !fileUrl) return res.status(400).json({ error: 'fileName and fileUrl required.' });
    const file = await prisma.projectFile.create({ data: { projectId, uploadedBy: req.user.id, fileName, fileUrl, metadata } });
    res.json(file);
  } catch (err) {
    console.error('Upload project file error:', err);
    res.status(500).json({ error: 'Failed to upload file.' });
  }
});

// List project files
router.get('/projects/:projectId/files', auth, async (req, res) => {
  try {
    const projectId = Number(req.params.projectId);
    const files = await prisma.projectFile.findMany({ where: { projectId }, include: { uploader: true }, orderBy: { createdAt: 'desc' } });
    res.json(files);
  } catch (err) {
    console.error('List project files error:', err);
    res.status(500).json({ error: 'Failed to list files.' });
  }
});

// Get share link for community
router.get('/:id/share', auth, async (req, res) => {
  try {
    const communityId = Number(req.params.id);
    const community = await prisma.community.findUnique({ where: { id: communityId } });
    if (!community) return res.status(404).json({ error: 'Community not found.' });
    
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const shareLink = `${baseUrl}/join/${community.slug}`;
    
    res.json({ 
      shareLink,
      slug: community.slug,
      name: community.name,
      isPrivate: community.isPrivate
    });
  } catch (err) {
    console.error('Share link error:', err);
    res.status(500).json({ error: 'Failed to get share link.' });
  }
});

// Join community via share link (public communities only)
router.get('/join/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const community = await prisma.community.findUnique({ 
      where: { slug },
      include: { members: true }
    });
    if (!community) return res.status(404).json({ error: 'Community not found.' });
    if (community.isPrivate) return res.status(403).json({ error: 'Private community.', community });
    res.json({ 
      community: {
        id: community.id,
        name: community.name,
        slug: community.slug,
        description: community.description,
        isPrivate: community.isPrivate,
        memberCount: community.members.length
      }
    });
  } catch (err) {
    console.error('Join via slug error:', err);
    res.status(500).json({ error: 'Failed to find community.' });
  }
});

// Join community via slug (authenticated)
router.post('/join/:slug', auth, async (req, res) => {
  try {
    const { slug } = req.params;
    const community = await prisma.community.findUnique({ 
      where: { slug }
    });
    if (!community) return res.status(404).json({ error: 'Community not found.' });
    if (community.isPrivate) return res.status(403).json({ error: 'Cannot join private community.' });
    
    const existing = await prisma.communityMember.findUnique({ 
      where: { communityId_userId: { communityId: community.id, userId: req.user.id } } 
    }).catch(() => null);
    if (existing) return res.status(400).json({ error: 'Already a member.' });
    
    await prisma.communityMember.create({ data: { communityId: community.id, userId: req.user.id } });
    res.json({ success: true, communityId: community.id });
  } catch (err) {
    console.error('Join via slug error:', err);
    res.status(500).json({ error: 'Failed to join community.' });
  }
});

// Create community message (chat)
router.post('/:id/messages', auth, async (req, res) => {
  try {
    const communityId = Number(req.params.id);
    const { content, attachmentUrl } = req.body;
    if (!content && !attachmentUrl) return res.status(400).json({ error: 'Message content or attachment required.' });
    
    const member = await prisma.communityMember.findUnique({ 
      where: { communityId_userId: { communityId, userId: req.user.id } } 
    }).catch(() => null);
    if (!member) return res.status(403).json({ error: 'Not a member of this community.' });
    
    const message = await prisma.communityMessage.create({ 
      data: { 
        communityId,
        senderId: req.user.id,
        content: content || '',
        messageType: 'text',
        attachmentUrl
      } 
    });
    
    const fullMessage = await prisma.communityMessage.findUnique({
      where: { id: message.id },
      include: { sender: true }
    });
    res.json(fullMessage);
  } catch (err) {
    console.error('Create message error:', err);
    res.status(500).json({ error: 'Failed to send message.' });
  }
});

// List community messages (chat)
router.get('/:id/messages', auth, async (req, res) => {
  try {
    const communityId = Number(req.params.id);
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    
    const messages = await prisma.communityMessage.findMany({
      where: { communityId },
      include: { sender: true },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    });
    res.json(messages.reverse());
  } catch (err) {
    console.error('List messages error:', err);
    res.status(500).json({ error: 'Failed to list messages.' });
  }
});

// Basic analytics for a job (aggregated from JobAnalytics)
router.get('/jobs/:jobId/analytics', auth, async (req, res) => {
  try {
    const jobId = Number(req.params.jobId);
    const analytics = await prisma.jobAnalytics.findMany({ where: { jobId }, orderBy: { year: 'desc', month: 'desc' } });
    res.json(analytics);
  } catch (err) {
    console.error('Job analytics error:', err);
    res.status(500).json({ error: 'Failed to fetch analytics.' });
  }
});

// Delete community
router.delete('/:id', auth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const community = await prisma.community.findUnique({ where: { id } });
    if (!community) return res.status(404).json({ error: 'Community not found.' });
    if (community.creatorId !== req.user.id) return res.status(403).json({ error: 'Only creator can delete.' });
    
    // Delete community-level messages
    await prisma.communityMessage.deleteMany({
      where: { communityId: id }
    });
    
    await prisma.community.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) {
    console.error('Delete community error:', err);
    res.status(500).json({ error: 'Failed to delete community.' });
  }
});

export default router;
