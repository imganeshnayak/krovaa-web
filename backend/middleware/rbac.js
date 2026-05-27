import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Middleware to validate Company Membership and Roles
 * @param {string[]} allowedCompanyRoles - Array of roles permitted (e.g. ['OWNER', 'ADMIN', 'MEMBER'])
 */
export const checkCompanyMembership = (allowedCompanyRoles = ['OWNER', 'ADMIN', 'MEMBER']) => {
    return async (req, res, next) => {
        try {
            const userId = req.user.id;
            let companyId = Number(req.params.companyId || req.body.companyId || req.query.companyId);

            if (!companyId) {
                // If checking community, we can find the company ID from the community
                const communityId = Number(req.params.communityId || req.params.id || req.body.communityId);
                if (communityId) {
                    const community = await prisma.community.findUnique({
                        where: { id: communityId },
                        select: { companyId: true }
                    });
                    if (community) {
                        companyId = community.companyId;
                    }
                }
            }

            if (!companyId) {
                return res.status(400).json({ error: 'Company ID is required for validation.' });
            }

            // Check membership
            const membership = await prisma.companyMembership.findUnique({
                where: {
                    companyId_userId: {
                        companyId,
                        userId
                    }
                }
            });

            if (!membership) {
                return res.status(403).json({ error: 'Access Denied: You are not a member of this parent company.' });
            }

            if (!allowedCompanyRoles.includes(membership.role)) {
                return res.status(403).json({ error: `Access Denied: Required company role is one of: [${allowedCompanyRoles.join(', ')}]. Current role: ${membership.role}` });
            }

            // Attach company context to request
            req.companyId = companyId;
            req.companyRole = membership.role;
            next();
        } catch (err) {
            console.error('Company membership validation error:', err);
            res.status(500).json({ error: 'Internal server error during company security validation.' });
        }
    };
};

/**
 * Middleware to validate Community (Workspace Team) Membership and Roles
 * @param {string[]} allowedTeamRoles - Array of team roles permitted (e.g. ['TEAM_ADMIN', 'MANAGER', 'VIEWER'])
 */
export const checkCommunityMembership = (allowedTeamRoles = ['TEAM_ADMIN', 'MANAGER', 'VIEWER']) => {
    return async (req, res, next) => {
        try {
            const userId = req.user.id;
            const communityId = Number(req.params.communityId || req.params.id || req.body.communityId);

            if (!communityId) {
                return res.status(400).json({ error: 'Workspace Team (Community) ID is required for validation.' });
            }

            const community = await prisma.community.findUnique({
                where: { id: communityId },
                include: { creator: true }
            });

            if (!community) {
                return res.status(404).json({ error: 'Workspace Team not found.' });
            }

            // Creator of community has absolute control
            if (community.creatorId === userId) {
                req.communityRole = 'TEAM_ADMIN';
                req.communityId = communityId;
                req.companyId = community.companyId;
                return next();
            }

            // Verify if user has an active membership record in the community
            const membership = await prisma.communityMember.findUnique({
                where: {
                    communityId_userId: {
                        communityId,
                        userId
                    }
                }
            });

            // Fallback: If user is an OWNER or ADMIN of the parent company, they can bypass community check
            if (!membership && community.companyId) {
                const companyMembership = await prisma.companyMembership.findUnique({
                    where: {
                        companyId_userId: {
                            companyId: community.companyId,
                            userId
                        }
                    }
                });

                if (companyMembership && ['OWNER', 'ADMIN'].includes(companyMembership.role)) {
                    req.communityRole = 'TEAM_ADMIN'; // Treat company admin as team admin
                    req.communityId = communityId;
                    req.companyId = community.companyId;
                    return next();
                }
            }

            if (!membership || membership.status !== 'approved') {
                return res.status(403).json({ error: 'Access Denied: You are not an active member of this Workspace Team.' });
            }

            if (!allowedTeamRoles.includes(membership.role)) {
                return res.status(403).json({ error: `Access Denied: Action requires one of these team roles: [${allowedTeamRoles.join(', ')}]. Current role: ${membership.role}` });
            }

            req.communityRole = membership.role;
            req.communityId = communityId;
            req.companyId = community.companyId;
            next();
        } catch (err) {
            console.error('Community/team validation error:', err);
            res.status(500).json({ error: 'Internal server error during workspace security validation.' });
        }
    };
};
