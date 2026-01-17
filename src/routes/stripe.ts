import express, { Request, Response } from 'express';
import { stripe } from '../config/stripe';
import { User } from '../models/User';
import { PaymentHistory } from '../models/PaymentHistory';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware';

const router = express.Router();

// Price IDs mapping (update with your actual Stripe price IDs)
const TIER_PRICES: Record<string, { priceId: string; amount: number; isRecurring: boolean }> = {
  foundation: { priceId: 'price_foundation_yearly', amount: 495, isRecurring: true },
  growth: { priceId: 'price_growth_yearly', amount: 995, isRecurring: true },
  stakeholder: { priceId: 'price_stakeholder_yearly', amount: 1495, isRecurring: true },
  professional: { priceId: 'price_professional_yearly', amount: 1995, isRecurring: true },
  enterprise: { priceId: 'price_enterprise_yearly', amount: 3995, isRecurring: true },
  founding: { priceId: 'price_founding_lifetime', amount: 5995, isRecurring: false },
};

// Create checkout session
router.post('/create-checkout-session', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const { tier, successUrl, cancelUrl } = req.body;

    if (!tier) {
      res.status(400).json({ error: 'Tier is required' });
      return;
    }

    const priceInfo = TIER_PRICES[tier];
    if (!priceInfo) {
      res.status(400).json({ error: 'Invalid tier' });
      return;
    }

    // Get or create Stripe customer
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.fullName,
        metadata: {
          userId: user._id.toString(),
        },
      });
      customerId = customer.id;
      user.stripeCustomerId = customerId;
      await user.save();
    }

    // Create checkout session
    const sessionParams: any = {
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceInfo.priceId,
          quantity: 1,
        },
      ],
      mode: priceInfo.isRecurring ? 'subscription' : 'payment',
      success_url: successUrl || `${process.env.FRONTEND_URL}/onboarding?payment=success&tier=${tier}`,
      cancel_url: cancelUrl || `${process.env.FRONTEND_URL}/onboarding?payment=cancel`,
      metadata: {
        userId: user._id.toString(),
        tier,
      },
    };

    const session = await stripe.checkout.sessions.create(sessionParams);

    res.json({
      data: {
        url: session.url,
        sessionId: session.id,
      },
      error: null,
    });
  } catch (error: any) {
    console.error('Create checkout session error:', error);
    res.status(500).json({ error: error.message || 'Failed to create checkout session' });
  }
});

// Stripe webhook
router.post('/webhook', express.raw({ type: 'application/json' }), async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    res.status(400).json({ error: 'Missing signature or webhook secret' });
    return;
  }

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    res.status(400).json({ error: `Webhook Error: ${err.message}` });
    return;
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as any;
        const userId = session.metadata?.userId;

        if (userId) {
          const user = await User.findById(userId);
          if (user) {
            user.subscriptionStatus = 'active';
            user.membershipTier = session.metadata?.tier || user.membershipTier;
            if (session.subscription) {
              user.stripeSubscriptionId = session.subscription;
            }
            await user.save();

            // Create payment history
            await PaymentHistory.create({
              userId: user._id,
              subscriptionId: session.subscription,
              amount: session.amount_total ? session.amount_total / 100 : 0,
              status: 'succeeded',
              invoiceUrl: session.invoice?.hosted_invoice_url,
              stripePaymentIntentId: session.payment_intent,
            });
          }
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as any;
        const subscriptionId = invoice.subscription;

        if (subscriptionId) {
          const user = await User.findOne({ stripeSubscriptionId: subscriptionId });
          if (user) {
            await PaymentHistory.create({
              userId: user._id,
              subscriptionId,
              amount: invoice.amount_paid / 100,
              status: 'succeeded',
              invoiceUrl: invoice.hosted_invoice_url,
              stripeInvoiceId: invoice.id,
            });
          }
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as any;
        const user = await User.findOne({ stripeSubscriptionId: subscription.id });
        if (user) {
          user.subscriptionStatus = 'cancelled';
          await user.save();
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as any;
        const user = await User.findOne({ stripeSubscriptionId: subscription.id });
        if (user) {
          user.subscriptionStatus = subscription.status === 'active' ? 'active' : 'cancelled';
          await user.save();
        }
        break;
      }
    }

    res.json({ received: true });
  } catch (error: any) {
    console.error('Webhook handler error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get billing portal session
router.get('/billing-portal', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;

    if (!user.stripeCustomerId) {
      res.status(400).json({ error: 'No Stripe customer found' });
      return;
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${process.env.FRONTEND_URL}/dashboard`,
    });

    res.json({
      data: {
        url: session.url,
      },
      error: null,
    });
  } catch (error: any) {
    console.error('Billing portal error:', error);
    res.status(500).json({ error: error.message || 'Failed to create billing portal session' });
  }
});

// Get subscription status
router.get('/subscription', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;

    let subscription = null;
    if (user.stripeSubscriptionId) {
      try {
        subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
      } catch (error) {
        console.warn('Failed to retrieve subscription:', error);
      }
    }

    res.json({
      data: {
        subscriptionStatus: user.subscriptionStatus,
        membershipTier: user.membershipTier,
        stripeCustomerId: user.stripeCustomerId,
        stripeSubscriptionId: user.stripeSubscriptionId,
        subscription,
      },
      error: null,
    });
  } catch (error: any) {
    console.error('Get subscription error:', error);
    res.status(500).json({ error: error.message || 'Failed to get subscription' });
  }
});

export default router;
