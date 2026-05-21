import express from 'express';
import { PrismaClient } from '@prisma/client';
import { auth } from '../middleware/auth.js';
import { createOrder } from '../config/razorpay.js';
import { sendSubscriptionSuccessArtifacts } from '../services/subscriptionFulfillment.js';

const prisma = new PrismaClient();
const router = express.Router();

const PLANS = {
  free: { id: 'free', name: 'Starter', monthlyLimit: 5, monthlyPrice: 0, annualPrice: 0 },
  pro: { id: 'pro', name: 'Pro', monthlyLimit: 100, monthlyPrice: 299, annualPrice: 2390 },
  enterprise: { id: 'enterprise', name: 'Extra', monthlyLimit: 999999, monthlyPrice: 799, annualPrice: 6390 },
};

function parsePriceValue(value, fallback) {
  const price = parseFloat(value);
  return Number.isFinite(price) ? price : fallback;
}

async function loadSubscriptionPricingSettings() {
  const settings = await prisma.systemSetting.findMany({
    where: {
      key: {
        in: [
          'image_generator_plan_starter_monthly_price',
          'image_generator_plan_pro_monthly_price',
          'image_generator_plan_extra_monthly_price'
        ]
      }
    }
  });

  const settingsMap = settings.reduce((acc, curr) => {
    acc[curr.key] = curr.value;
    return acc;
  }, {});

  return {
    starterMonthlyPrice: parsePriceValue(settingsMap.image_generator_plan_starter_monthly_price, PLANS.free.monthlyPrice),
    proMonthlyPrice: parsePriceValue(settingsMap.image_generator_plan_pro_monthly_price, PLANS.pro.monthlyPrice),
    extraMonthlyPrice: parsePriceValue(settingsMap.image_generator_plan_extra_monthly_price, PLANS.enterprise.monthlyPrice),
  };
}

async function getSubscriptionPlan(planId) {
  const plan = PLANS[planId];
  if (!plan) return null;
  if (planId === 'free') {
    return plan;
  }

  const pricingSettings = await loadSubscriptionPricingSettings();
  let monthlyPrice = plan.monthlyPrice;

  if (planId === 'pro') {
    monthlyPrice = pricingSettings.proMonthlyPrice;
  } else if (planId === 'enterprise') {
    monthlyPrice = pricingSettings.extraMonthlyPrice;
  }

  const annualPrice = Math.round(monthlyPrice * 12 * 0.67);

  return {
    ...plan,
    monthlyPrice,
    annualPrice,
  };
}

router.get('/status', auth, async (req, res) => {
  try {
    const subscription = await prisma.subscription.findUnique({
      where: { userId: req.user.id },
    });

    if (!subscription) {
      return res.json({
        planId: 'free',
        planName: 'Starter',
        billingCycle: 'monthly',
        monthlyLimit: 5,
        imagesUsed: 0,
        imagesThisMonth: 0,
        status: 'active',
        hasSubscription: false,
      });
    }

    const now = new Date();
    if (subscription.resetDate && now > subscription.resetDate) {
      await prisma.subscription.update({
        where: { userId: req.user.id },
        data: {
          imagesThisMonth: 0,
          resetDate: new Date(now.getFullYear(), now.getMonth() + 1, 1),
        },
      });
      subscription.imagesThisMonth = 0;
    }

    res.json({
      planId: subscription.planId,
      planName: subscription.planName,
      billingCycle: subscription.billingCycle,
      monthlyLimit: subscription.monthlyLimit,
      imagesUsed: subscription.imagesUsed,
      imagesThisMonth: subscription.imagesThisMonth,
      status: subscription.status,
      hasSubscription: true,
      expiresAt: subscription.expiresAt,
    });
  } catch (error) {
    console.error('Get subscription status error:', error);
    res.status(500).json({ error: 'Failed to get subscription status' });
  }
});

router.post('/subscribe', auth, async (req, res) => {
  try {
    const { planId, isAnnual = false } = req.body;

    if (!planId || !PLANS[planId]) {
      return res.status(400).json({ error: 'Invalid plan ID' });
    }

    const plan = PLANS[planId];
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, email: true, displayName: true, username: true, walletBalance: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    if (planId === 'free') {
      const now = new Date();
      const resetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const expiresAt = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());

      await prisma.subscription.upsert({
        where: { userId: req.user.id },
        create: {
          userId: req.user.id,
          planId: 'free',
          planName: 'Starter',
          billingCycle: 'monthly',
          monthlyLimit: 5,
          imagesUsed: 0,
          imagesThisMonth: 0,
          resetDate,
          status: 'active',
        },
        update: {
          planId: 'free',
          planName: 'Starter',
          billingCycle: 'monthly',
          monthlyLimit: 5,
          imagesUsed: 0,
          imagesThisMonth: 0,
          resetDate,
          status: 'active',
        },
      });

      const io = req.app.get('io');
      await sendSubscriptionSuccessArtifacts({
        io,
        user,
        plan,
        billingCycle: 'monthly',
        amount: 0,
        monthlyLimit: plan.monthlyLimit,
        expiresAt,
        receiptReference: `free_${req.user.id}_${Date.now()}`,
        paymentReference: 'free-plan',
        paymentMethod: 'free',
      });

      return res.json({ success: true, message: 'Subscribed to Starter plan' });
    }

    const existing = await prisma.subscription.findUnique({
      where: { userId: req.user.id },
    });

    if (existing && existing.planId !== 'free') {
      return res.json({
        success: true,
        free: true,
        message: 'Already subscribed to paid plan',
        planId: existing.planId,
      });
    }

    const amount = isAnnual ? plan.annualPrice : plan.monthlyPrice;
    const order = await createOrder(amount, 'INR', {
      type: 'subscription',
      planId: planId,
      billingCycle: isAnnual ? 'annual' : 'monthly',
      userId: req.user.id,
    });

    res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      key_id: process.env.RAZORPAY_KEY_ID,
      planId: plan.id,
      planName: plan.name,
    });
  } catch (error) {
    console.error('Subscribe error:', error);
    res.status(500).json({ error: 'Failed to create subscription' });
  }
});

router.get('/pricing', async (req, res) => {
  try {
    const pricingPlans = await Promise.all(Object.keys(PLANS).map(async (planId) => {
      const plan = await getSubscriptionPlan(planId);
      return {
        id: plan.id,
        name: plan.name,
        monthlyLimit: plan.monthlyLimit,
        monthlyPrice: plan.monthlyPrice,
        annualPrice: plan.annualPrice,
        monthlyEquivalent: plan.annualPrice ? Math.round(plan.annualPrice / 12) : 0,
      };
    }));
    res.json({ plans: pricingPlans });
  } catch (error) {
    console.error('Get pricing error:', error);
    res.status(500).json({ error: 'Failed to fetch pricing' });
  }
});

router.post('/wallet', auth, async (req, res) => {
  try {
    const { planId, isAnnual = false } = req.body;

    if (!planId || !PLANS[planId]) {
      return res.status(400).json({ error: 'Invalid plan ID' });
    }

    const plan = await getSubscriptionPlan(planId);
    if (!plan) {
      return res.status(400).json({ error: 'Invalid plan ID' });
    }
    const amount = isAnnual ? plan.annualPrice : plan.monthlyPrice;

    if (amount <= 0) {
      return res.json({ success: true, message: 'Subscribed to Starter plan', planId: plan.id });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, walletBalance: true, email: true, displayName: true, username: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    if (user.walletBalance < amount) {
      return res.status(400).json({ error: 'Insufficient wallet balance.' });
    }

    const now = new Date();
    const resetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const expiresAt = new Date(now.getFullYear() + (isAnnual ? 1 : 0), now.getMonth(), now.getDate());
    const billingCycle = isAnnual ? 'annual' : 'monthly';

    const updatedUser = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: req.user.id },
        data: { walletBalance: { decrement: amount } }
      });

      await tx.walletTransaction.create({
        data: {
          userId: req.user.id,
          type: 'debit',
          amount: -amount,
          balance: updated.walletBalance,
          reference: `subscription_${plan.id}_${Date.now()}`,
          description: `Subscription payment for ${plan.name} (${billingCycle})`
        }
      });

      await tx.subscription.upsert({
        where: { userId: req.user.id },
        create: {
          userId: req.user.id,
          planId: plan.id,
          planName: plan.name,
          billingCycle,
          monthlyLimit: plan.monthlyLimit,
          imagesUsed: 0,
          imagesThisMonth: 0,
          resetDate,
          expiresAt,
          status: 'active'
        },
        update: {
          planId: plan.id,
          planName: plan.name,
          billingCycle,
          monthlyLimit: plan.monthlyLimit,
          status: 'active',
          resetDate,
          expiresAt
        }
      });

      await tx.paymentLog.create({
        data: {
          type: 'subscription',
          entityId: req.user.id,
          amount: amount,
          currency: 'INR',
          status: 'paid',
          metadata: { method: 'wallet', planId: plan.id, billingCycle }
        }
      });

      return updated;
    });

    const io = req.app.get('io');
    await sendSubscriptionSuccessArtifacts({
      io,
      user,
      plan,
      billingCycle,
      amount,
      monthlyLimit: plan.monthlyLimit,
      expiresAt,
      receiptReference: `wallet_${req.user.id}_${Date.now()}`,
      paymentReference: `subscription_${plan.id}_${Date.now()}`,
      paymentMethod: 'wallet',
    });

    res.json({ success: true, message: `Subscribed to ${plan.name} plan using wallet.` });
  } catch (error) {
    console.error('Wallet subscription payment error:', error);
    res.status(500).json({ error: 'Failed to pay subscription from wallet.' });
  }
});

router.post('/check-usage', auth, async (req, res) => {
  try {
    const subscription = await prisma.subscription.findUnique({
      where: { userId: req.user.id },
    });

    const now = new Date();
    let monthlyLimit = 5;
    let imagesThisMonth = 0;

    if (subscription) {
      if (subscription.resetDate && now > subscription.resetDate) {
        await prisma.subscription.update({
          where: { userId: req.user.id },
          data: {
            imagesThisMonth: 0,
            resetDate: new Date(now.getFullYear(), now.getMonth() + 1, 1),
          },
        });
        imagesThisMonth = 0;
      } else {
        imagesThisMonth = subscription.imagesThisMonth;
      }
      monthlyLimit = subscription.monthlyLimit;
    }

    const remaining = Math.max(0, monthlyLimit - imagesThisMonth);
    const canGenerate = remaining > 0;

    res.json({
      canGenerate,
      remaining,
      monthlyLimit,
      imagesThisMonth,
      planId: subscription?.planId || 'free',
    });
  } catch (error) {
    console.error('Check usage error:', error);
    res.status(500).json({ error: 'Failed to check usage' });
  }
});

router.post('/record-usage', auth, async (req, res) => {
  try {
    const subscription = await prisma.subscription.findUnique({
      where: { userId: req.user.id },
    });

    const now = new Date();
    let monthlyLimit = 5;
    let imagesThisMonth = 0;

    if (subscription) {
      if (subscription.resetDate && now > subscription.resetDate) {
        imagesThisMonth = 1;
        await prisma.subscription.update({
          where: { userId: req.user.id },
          data: {
            imagesThisMonth: 1,
            imagesUsed: { increment: 1 },
            resetDate: new Date(now.getFullYear(), now.getMonth() + 1, 1),
          },
        });
      } else {
        imagesThisMonth = subscription.imagesThisMonth + 1;
        await prisma.subscription.update({
          where: { userId: req.user.id },
          data: {
            imagesThisMonth,
            imagesUsed: { increment: 1 },
          },
        });
      }
      monthlyLimit = subscription.monthlyLimit;
    } else {
      await prisma.subscription.create({
        data: {
          userId: req.user.id,
          planId: 'free',
          planName: 'Starter',
          monthlyLimit: 5,
          imagesUsed: 1,
          imagesThisMonth: 1,
          resetDate: new Date(now.getFullYear(), now.getMonth() + 1, 1),
          status: 'active',
        },
      });
    }

    const remaining = Math.max(0, monthlyLimit - imagesThisMonth);

    res.json({
      success: true,
      remaining,
      monthlyLimit,
      imagesThisMonth,
    });
  } catch (error) {
    console.error('Record usage error:', error);
    res.status(500).json({ error: 'Failed to record usage' });
  }
});

export default router;