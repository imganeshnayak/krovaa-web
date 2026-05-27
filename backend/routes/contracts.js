import express from 'express';
import { PrismaClient } from '@prisma/client';
import { auth } from '../middleware/auth.js';
import { checkCommunityMembership } from '../middleware/rbac.js';
import { sendUserNotification } from './notifications.js';

const prisma = new PrismaClient();
const router = express.Router();

// GET /api/contracts - List contracts for a specific Workspace Team (Community)
router.get('/', auth, async (req, res) => {
    try {
        const communityId = Number(req.query.communityId);
        if (!communityId) {
            return res.status(400).json({ error: 'Community (Team) ID is required.' });
        }

        // Validate user belongs to workspace team with minimum role VIEWER
        const membership = await prisma.communityMember.findUnique({
            where: { communityId_userId: { communityId, userId: req.user.id } }
        });
        const community = await prisma.community.findUnique({ where: { id: communityId } });
        const isCreator = community && community.creatorId === req.user.id;

        if (!membership && !isCreator) {
            return res.status(403).json({ error: 'Access Denied: You are not a member of this Workspace Team.' });
        }

        const contracts = await prisma.contract.findMany({
            where: { communityId },
            include: {
                professional: {
                    select: { id: true, username: true, displayName: true, avatarUrl: true, profession: true }
                },
                community: {
                    select: { id: true, name: true, slug: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json(contracts);
    } catch (err) {
        console.error('List contracts error:', err);
        res.status(500).json({ error: 'Failed to fetch contracts.' });
    }
});

// POST /api/contracts - Create a new Contract under a Workspace Team (Funded via Escrow)
router.post('/', auth, async (req, res) => {
    try {
        const { communityId, professionalId, title, rate } = req.body;

        if (!communityId || !professionalId || !title || !rate) {
            return res.status(400).json({ error: 'Missing required fields: communityId, professionalId, title, rate.' });
        }

        const amountToDeduct = parseFloat(rate);
        if (amountToDeduct <= 0) {
            return res.status(400).json({ error: 'Contract rate must be greater than 0.' });
        }

        // Access Control check (must be TEAM_ADMIN or MANAGER in this community)
        const membership = await prisma.communityMember.findUnique({
            where: { communityId_userId: { communityId, userId: req.user.id } }
        });
        const community = await prisma.community.findUnique({ where: { id: communityId } });
        const isCreator = community && community.creatorId === req.user.id;
        const hasAccess = isCreator || (membership && ['TEAM_ADMIN', 'MANAGER'].includes(membership.role));

        if (!hasAccess) {
            return res.status(403).json({ error: 'Access Denied: Required role is TEAM_ADMIN or MANAGER.' });
        }

        // Validate professional exists
        const professional = await prisma.user.findUnique({ where: { id: parseInt(professionalId) } });
        if (!professional) {
            return res.status(404).json({ error: 'Professional freelancer not found.' });
        }

        // Verify professional is a member of this workspace
        const professionalMembership = await prisma.communityMember.findUnique({
            where: { communityId_userId: { communityId, userId: professional.id } }
        });
        if (!professionalMembership && community.creatorId !== professional.id) {
            return res.status(400).json({ error: 'Professional must be invited and added to the Workspace Team first.' });
        }

        // Check client balance
        const client = await prisma.user.findUnique({ where: { id: req.user.id } });
        if (client.walletBalance < amountToDeduct) {
            return res.status(400).json({
                error: `Insufficient wallet balance. Contract requires ₹${amountToDeduct.toLocaleString('en-IN')}, you have ₹${client.walletBalance.toLocaleString('en-IN')}. Please top up your wallet.`
            });
        }

        // Platform fee configuration
        let platformFeePercent = 0.10;
        const feeSetting = await prisma.systemSetting.findUnique({ where: { key: 'platform_fee_percent' } });
        if (feeSetting) platformFeePercent = parseFloat(feeSetting.value);
        const feeAmount = amountToDeduct * platformFeePercent;

        // Run entire hiring process inside a safe DB transaction
        const contract = await prisma.$transaction(async (tx) => {
            // 1. Deduct rate from client wallet
            const updatedClient = await tx.user.update({
                where: { id: req.user.id },
                data: { walletBalance: { decrement: amountToDeduct } }
            });

            // 2. Log client wallet transaction
            await tx.walletTransaction.create({
                data: {
                    userId: req.user.id,
                    type: 'debit',
                    amount: -amountToDeduct,
                    balance: updatedClient.walletBalance,
                    description: `Workspace Contract creation: ${title}`,
                    reference: `community_${communityId}`,
                    metadata: { communityId, professionalId: professional.id, title }
                }
            });

            // 3. Create Escrow Deal representing funded contract amount
            const deal = await tx.escrowDeal.create({
                data: {
                    chatId: `community_${communityId}`,
                    clientId: req.user.id,
                    vendorId: professional.id,
                    title: `Contract: ${title}`,
                    description: `Escrow funded contract under Workspace: ${community.name}`,
                    totalAmount: amountToDeduct,
                    status: 'active',
                    paymentStatus: 'paid',
                    paidAmount: amountToDeduct,
                    isSplitDeal: false,
                    teamId: communityId
                }
            });

            // 3a. Record platform fee transaction
            if (feeAmount > 0) {
                await tx.escrowTransaction.create({
                    data: {
                        dealId: deal.id,
                        percent: 0,
                        amount: feeAmount,
                        note: 'platform_fee'
                    }
                });
            }

            // 4. Create Contract record linked to Escrow Deal
            const newContract = await tx.contract.create({
                data: {
                    communityId,
                    professionalId: professional.id,
                    title,
                    rate: amountToDeduct,
                    status: 'Active',
                    escrowDealId: deal.id
                },
                include: {
                    professional: { select: { id: true, username: true, displayName: true } }
                }
            });

            // 5. Log activity
            await tx.activityLog.create({
                data: {
                    userId: req.user.id,
                    action: 'Created funded workspace contract',
                    details: `Contract "${title}" - freelancer ${professional.displayName || professional.username} | Rate ₹${amountToDeduct} | community_${communityId}`
                }
            });

            return newContract;
        });

        const io = req.app.get('io');
        if (io) {
            sendUserNotification(
                io,
                professional.id,
                '💼 New Contract Started',
                `You have a new contract "${title}" in workspace ${community.name} for ₹${amountToDeduct.toLocaleString('en-IN')}`,
                'success',
                { type: 'contract', contractId: contract.id, communityId }
            );
        }

        res.status(201).json(contract);
    } catch (err) {
        console.error('Create contract error:', err);
        res.status(500).json({ error: 'Failed to establish workspace contract.' });
    }
});

// POST /api/contracts/:contractId/transfer - Safe Team Transfer / Rehire Transaction Flow
router.post('/:contractId/transfer', auth, async (req, res) => {
    try {
        const contractId = Number(req.params.contractId);
        const { targetCommunityId } = req.body;

        if (!targetCommunityId) {
            return res.status(400).json({ error: 'Target Workspace Team (communityId) is required.' });
        }

        const targetCommId = Number(targetCommunityId);

        // Fetch original contract
        const oldContract = await prisma.contract.findUnique({
            where: { id: contractId },
            include: {
                community: true,
                professional: true
            }
        });

        if (!oldContract) {
            return res.status(404).json({ error: 'Contract not found.' });
        }

        if (oldContract.status !== 'Active') {
            return res.status(400).json({ error: `Safe transfers are only permitted on Active contracts. Current status: ${oldContract.status}` });
        }

        const sourceCommunityId = oldContract.communityId;

        // Verify Client is authorized in both source and target Workspace Teams
        const sourceMembership = await prisma.communityMember.findUnique({
            where: { communityId_userId: { communityId: sourceCommunityId, userId: req.user.id } }
        });
        const targetMembership = await prisma.communityMember.findUnique({
            where: { communityId_userId: { communityId: targetCommId, userId: req.user.id } }
        });

        const isSourceCreator = oldContract.community.creatorId === req.user.id;
        const targetCommunity = await prisma.community.findUnique({ where: { id: targetCommId } });
        if (!targetCommunity) {
            return res.status(404).json({ error: 'Target Workspace Team (community) not found.' });
        }
        const isTargetCreator = targetCommunity.creatorId === req.user.id;

        const hasSourceAccess = isSourceCreator || (sourceMembership && ['TEAM_ADMIN', 'MANAGER'].includes(sourceMembership.role));
        const hasTargetAccess = isTargetCreator || (targetMembership && ['TEAM_ADMIN', 'MANAGER'].includes(targetMembership.role));

        if (!hasSourceAccess || !hasTargetAccess) {
            return res.status(403).json({ error: 'Access Denied: You must be TEAM_ADMIN or MANAGER in both source and target Workspace Teams to transfer.' });
        }

        // Verify professional is also added to the target community
        const profTargetMembership = await prisma.communityMember.findUnique({
            where: { communityId_userId: { communityId: targetCommId, userId: oldContract.professionalId } }
        });
        if (!profTargetMembership && targetCommunity.creatorId !== oldContract.professionalId) {
            return res.status(400).json({ error: 'Freelancer professional must be added to the target Workspace Team before transfer.' });
        }

        // Locate original Escrow Deal
        if (!oldContract.escrowDealId) {
            return res.status(400).json({ error: 'Original contract does not carry an active escrow deal. Unable to resolve ledger.' });
        }

        const oldDeal = await prisma.escrowDeal.findUnique({
            where: { id: oldContract.escrowDealId },
            include: { transactions: true }
        });

        if (!oldDeal) {
            return res.status(404).json({ error: 'Associated original escrow deal not found.' });
        }

        // Safe Transactional Closure & Cloned Re-fund Workflow
        const result = await prisma.$transaction(async (tx) => {
            // A. Calculate unreleased percentage and refund client
            const releasedPercent = oldDeal.releasedPercent;
            const remainingFraction = 1 - (releasedPercent / 100);

            // Determine recorded platform fee
            const platformFeeTx = oldDeal.transactions.find(t => t.note === 'platform_fee');
            const recordedFee = platformFeeTx ? platformFeeTx.amount : (oldDeal.totalAmount * 0.10);

            const refundableAmount = (oldDeal.totalAmount - recordedFee) * remainingFraction;

            // 1. Terminate original contract A
            await tx.contract.update({
                where: { id: oldContract.id },
                data: { status: 'Closed' }
            });

            // 2. Set original escrow deal to cancelled
            await tx.escrowDeal.update({
                where: { id: oldDeal.id },
                data: { status: 'cancelled' }
            });

            let clientRefBalance = req.user.walletBalance;

            // 3. Credit refunded escrow balance back to client's wallet
            if (refundableAmount > 0) {
                const clientUp = await tx.user.update({
                    where: { id: req.user.id },
                    data: { walletBalance: { increment: refundableAmount } }
                });
                clientRefBalance = clientUp.walletBalance;

                // Log credit wallet transaction
                await tx.walletTransaction.create({
                    data: {
                        userId: req.user.id,
                        type: 'credit',
                        amount: refundableAmount,
                        balance: clientRefBalance,
                        description: `Escrow transfer refund from contract closure: ${oldContract.title}`,
                        reference: `contract_${oldContract.id}`
                    }
                });
            }

            // B. Establish fresh cloned Contract B under the new community
            const rateForNewContract = oldContract.rate;

            // Check if client has enough balance to re-fund the fresh contract
            if (clientRefBalance < rateForNewContract) {
                throw new Error(`Insufficient wallet balance to clone and re-fund contract under new team workspace. Required: ₹${rateForNewContract.toLocaleString('en-IN')}, Current Wallet (with Refund): ₹${clientRefBalance.toLocaleString('en-IN')}`);
            }

            // 4. Debit client wallet for contract B
            const finalClient = await tx.user.update({
                where: { id: req.user.id },
                data: { walletBalance: { decrement: rateForNewContract } }
            });

            // Log debit wallet transaction for contract B
            await tx.walletTransaction.create({
                data: {
                    userId: req.user.id,
                    type: 'debit',
                    amount: -rateForNewContract,
                    balance: finalClient.walletBalance,
                    description: `Workspace Contract rehire/transfer: ${oldContract.title}`,
                    reference: `community_${targetCommId}`,
                    metadata: { originalContractId: oldContract.id, targetCommunityId: targetCommId }
                }
            });

            // 5. Create fresh Escrow Deal linked to community B
            const newDeal = await tx.escrowDeal.create({
                data: {
                    chatId: `community_${targetCommId}`,
                    clientId: req.user.id,
                    vendorId: oldContract.professionalId,
                    title: `Contract (Transferred): ${oldContract.title}`,
                    description: `Escrow funded contract transferred to Workspace: ${targetCommunity.name}`,
                    totalAmount: rateForNewContract,
                    status: 'active',
                    paymentStatus: 'paid',
                    paidAmount: rateForNewContract,
                    isSplitDeal: false,
                    teamId: targetCommId
                }
            });

            // 5a. Record platform fee transaction
            const targetFeeSetting = await tx.systemSetting.findUnique({ where: { key: 'platform_fee_percent' } });
            const targetFeePercent = targetFeeSetting ? parseFloat(targetFeeSetting.value) : 0.10;
            const targetFeeAmount = rateForNewContract * targetFeePercent;
            
            if (targetFeeAmount > 0) {
                await tx.escrowTransaction.create({
                    data: {
                        dealId: newDeal.id,
                        percent: 0,
                        amount: targetFeeAmount,
                        note: 'platform_fee'
                    }
                });
            }

            // 6. Instantiate new Contract record
            const newContract = await tx.contract.create({
                data: {
                    communityId: targetCommId,
                    professionalId: oldContract.professionalId,
                    title: oldContract.title,
                    rate: rateForNewContract,
                    status: 'Active',
                    escrowDealId: newDeal.id
                },
                include: {
                    professional: { select: { id: true, username: true, displayName: true } }
                }
            });

            // 7. Log activities
            await tx.activityLog.create({
                data: {
                    userId: req.user.id,
                    action: 'Transferred Workspace Contract safely',
                    details: `Transferred professional from community_${sourceCommunityId} to community_${targetCommId} | Original contract closed, refunded net ₹${refundableAmount} | New contract ₹${rateForNewContract} funded.`
                }
            });

            return newContract;
        });

        const io = req.app.get('io');
        if (io) {
            sendUserNotification(
                io,
                oldContract.professionalId,
                '🔄 Contract Workspace Transfer',
                `Your contract "${oldContract.title}" has been transferred to Workspace: ${targetCommunity.name}`,
                'success',
                { type: 'contract', contractId: result.id, communityId: targetCommId }
            );
        }

        res.json({
            success: true,
            message: 'Contract successfully transferred, keeping billing records perfectly separated!',
            oldContractId: oldContract.id,
            newContract: result
        });
    } catch (err) {
        console.error('Contract safe transfer error:', err);
        res.status(500).json({ error: err.message || 'Failed to safely transfer workspace contract.' });
    }
});

export default router;
