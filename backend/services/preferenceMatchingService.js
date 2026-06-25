import { PrismaClient } from '@prisma/client';
import { sendUserNotification } from '../routes/notifications.js';

const prisma = new PrismaClient();

/**
 * Find users whose job preferences match a newly posted job
 * @param {Object} job - The newly posted job object
 * @returns {Promise<Array>} Array of user objects that match the job preferences
 */
async function findMatchingUsers(job) {
  try {
    // Get all users with job preferences
    const usersWithPreferences = await prisma.jobPreference.findMany({
      include: {
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true
          }
        }
      }
    });

    const matchingUsers = [];

    for (const prefObj of usersWithPreferences) {
      const user = prefObj.user;
      const prefs = prefObj;

      // Skip if user is the job poster
      if (user.id === job.postedById) {
        continue;
      }

      // Check if user matches job preferences
      if (matchesPreferences(job, prefs)) {
        matchingUsers.push(user);
      }
    }

    return matchingUsers;
  } catch (error) {
    console.error('Error finding matching users:', error);
    return []; // Return empty array on error to avoid breaking job posting
  }
}

/**
 * Check if a job matches user preferences
 * @param {Object} job - The job to check
 * @param {Object} prefs - User's job preferences
 * @returns {boolean} True if job matches preferences
 */
function matchesPreferences(job, prefs) {
  // Check skills match
  if (prefs.skills && prefs.skills.length > 0) {
    // For simplicity, we'll check if any preferred skill appears in job title or description
    // In a more sophisticated implementation, we might have a separate skills field on jobs
    const jobText = (job.title + ' ' + (job.description || '')).toLowerCase();
    const hasSkillMatch = prefs.skills.some(skill =>
      jobText.includes(skill.toLowerCase())
    );
    if (!hasSkillMatch) {
      return false;
    }
  }

  // Check job types (we don't have job type field yet, so skip for now)
  // Could add employmentType field to Job model later

  // Check locations
  if (prefs.locations && prefs.locations.length > 0) {
    const jobLocation = (job.location || '').toLowerCase();
    const hasLocationMatch = prefs.locations.some(location =>
      jobLocation.includes(location.toLowerCase())
    );
    if (!hasLocationMatch) {
      return false;
    }
  }

  // Check remote only preference
  if (prefs.remoteOnly && job.mode.toLowerCase() !== 'remote') {
    return false;
  }

  // Check budget range
  // Since job.budget is a string, we'd need to parse it - for now skip budget filtering
  // Could add minBudget/maxBudget fields to Job model later

  return true;
}

/**
 * Send targeted notifications to users matching job preferences
 * @param {Object} io - Socket.IO instance
 * @param {Object} job - The newly posted job
 * @param {number} posterId - ID of the user who posted the job
 */
async function sendTargetedJobNotifications(io, job, posterId) {
  try {
    const matchingUsers = await findMatchingUsers(job);

    if (matchingUsers.length === 0) {
      // No matching users found, optionally fall back to broad notification
      console.log('No users matched job preferences for job:', job.id);
      return [];
    }

    const poster = await prisma.user.findUnique({
      where: { id: posterId },
      select: { displayName: true, username: true }
    });
    const posterName = getUserDisplayName(poster);

    const jobNotificationMetadata = {
      type: 'job',
      jobId: job.id,
      redirect: `/jobs/${job.id}`,
      skipChatMirror: true,
    };

    // Send notifications to matching users
    const notificationPromises = matchingUsers.map(user =>
      sendUserNotification(
        io,
        user.id,
        `New Job Match: ${job.title}`,
        `${posterName} posted a new ${job.mode.toLowerCase()} job at ${job.company} that matches your preferences.`,
        'info',
        jobNotificationMetadata
      )
    );

    await Promise.allSettled(notificationPromises);

    console.log(`Sent job notifications to ${matchingUsers.length} users matching preferences`);
    return matchingUsers;
  } catch (error) {
    console.error('Error sending targeted job notifications:', error);
    return [];
  }
}

// Helper function from jobs.js
function getUserDisplayName(user) {
  return user?.displayName || user?.username || 'Someone';
}

// Helper function from jobs.js
function sanitizeText(input) {
  if (input === undefined || input === null) return input;
  if (typeof input !== 'string') return input;
  return input.replace(/["\*]/g, '').trim();
}

export {
  findMatchingUsers,
  matchesPreferences,
  sendTargetedJobNotifications
};