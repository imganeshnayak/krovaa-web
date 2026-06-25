import { sendSubscriptionReceiptEmail } from './emailService.js';
import { sendUserNotification } from '../routes/notifications.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function createSubscriptionSupportCard(io, userId, message) {
  try {
    console.log(`[SUBSCRIPTION] Creating support card for user ${userId}`);
    const admin = await prisma.user.findFirst({
      where: { role: 'admin' },
      select: { id: true }
    });

    const chatId = `support_${userId}`;
    console.log(`[SUBSCRIPTION] Chat ID: ${chatId}, Admin ID: ${admin?.id}`);
    
    const msg = await prisma.message.create({
      data: {
        chatId,
        senderId: admin?.id || userId,
        receiverId: userId,
        content: message,
        messageType: 'notification'
      }
    });

    console.log(`[SUBSCRIPTION] Message created: ${msg.id} in chat ${chatId}`);

    if (io) {
      const socketPayload = {
        ...msg,
        sender_name: 'Krovaa',
        sender_avatar: null
      };
      io.to(chatId).emit('newMessage', socketPayload);
      io.to(`user_${userId}`).emit('chatListUpdate');
      console.log(`[SUBSCRIPTION] Socket emitted to ${chatId} and user_${userId}`);
    } else {
      console.warn('[SUBSCRIPTION] io not available for socket emit');
    }
  } catch (err) {
    console.error(`[SUBSCRIPTION] Failed to create support card for user ${userId}:`, err.message);
    throw err;
  }
}

export async function sendSubscriptionSuccessArtifacts({
  io,
  user,
  plan,
  billingCycle,
  amount,
  monthlyLimit,
  expiresAt,
  receiptReference,
  paymentReference,
  paymentMethod,
}) {
  const customerName = user?.displayName || user?.username || 'Krovaa member';
  const email = user?.email;
  const isPaidSubscription = Number(amount || 0) > 0;
  const baseMetadata = {
    type: 'subscription',
    planId: plan.id,
    billingCycle,
    amount,
    receiptReference,
    paymentReference,
  };

  const tasks = [];

  if (email) {
    tasks.push(sendSubscriptionReceiptEmail(email, {
      customerName,
      planName: plan.name,
      billingCycle,
      amount,
      monthlyLimit,
      expiresAt,
      receiptReference,
      paymentReference,
      paymentMethod,
      status: amount > 0 ? 'PAID' : 'ACTIVE',
    }));
  }

  tasks.push(sendUserNotification(
    io,
    user.id,
    '🎉 Subscription Active',
    `You're now subscribed to ${plan.name} (${billingCycle}).${email ? ` A receipt PDF was sent to ${email}.` : ''}`,
    'success',
    {
      ...baseMetadata,
      skipChatMirror: true
    }
  ));

  tasks.push(createSubscriptionSupportCard(
    io,
    user.id,
    `🔔 **Subscription Active**\n\nYou are subscribed to **${plan.name}** (${billingCycle}).${email ? ` Receipt PDF sent to ${email}.` : ''}`
  ));

  const results = await Promise.allSettled(tasks);
  results.forEach((result, idx) => {
    if (result.status === 'rejected') {
      console.error(`[SUBSCRIPTION] Fulfillment task ${idx} failed:`, result.reason?.message || result.reason);
    } else {
      console.log(`[SUBSCRIPTION] Task ${idx} completed for user ${user.id}`);
    }
  });

  console.log(`[SUBSCRIPTION] All artifacts completed for user ${user.id}:`, {
    emailSent: email ? true : false,
    chatCardSent: true,
    plan: plan.id,
    amount: amount
  });

  return baseMetadata;
}