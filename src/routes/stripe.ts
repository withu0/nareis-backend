import express, { Request, Response } from 'express';
import { stripe } from '../config/stripe';
import { User } from '../models/User';
import { PaymentHistory } from '../models/PaymentHistory';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware';

const router = express.Router();

// Price IDs mapping from environment variables - All one-time payments
// Using a function to ensure environment variables are read at runtime, not module load time
const getTierPrices = () => ({
  foundation: { 
    priceId: process.env.STRIPE_PRICE_ID_FOUNDATION || '', 
    amount: 495, 
    isRecurring: false 
  },
  growth: { 
    priceId: process.env.STRIPE_PRICE_ID_GROWTH || '', 
    amount: 995, 
    isRecurring: false 
  },
  stakeholder: { 
    priceId: process.env.STRIPE_PRICE_ID_STAKEHOLDER || '', 
    amount: 1495, 
    isRecurring: false 
  },
  professional: { 
    priceId: process.env.STRIPE_PRICE_ID_PROFESSIONAL || '', 
    amount: 1995, 
    isRecurring: false 
  },
  enterprise: { 
    priceId: process.env.STRIPE_PRICE_ID_ENTERPRISE || '', 
    amount: 3995, 
    isRecurring: false 
  },
  founding: { 
    priceId: process.env.STRIPE_PRICE_ID_FOUNDING || '', 
    amount: 5995, 
    isRecurring: false 
  },
});

// Create checkout session
router.post('/create-checkout-session', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const { tier, successUrl, cancelUrl } = req.body;

    if (!tier) {
      res.status(400).json({ error: 'Tier is required' });
      return;
    }

    const tierPrices = getTierPrices();
    const priceInfo = tierPrices[tier as keyof ReturnType<typeof getTierPrices>];
    if (!priceInfo) {
      res.status(400).json({ error: 'Invalid tier' });
      return;
    }

    // Validate price ID is configured
    if (!priceInfo.priceId) {
      console.error(`Price ID not configured for tier: ${tier}`);
      console.error(`Available env vars:`, {
        STRIPE_PRICE_ID_FOUNDATION: process.env.STRIPE_PRICE_ID_FOUNDATION?.substring(0, 15) + '...',
        STRIPE_PRICE_ID_GROWTH: process.env.STRIPE_PRICE_ID_GROWTH?.substring(0, 15) + '...',
        STRIPE_PRICE_ID_STAKEHOLDER: process.env.STRIPE_PRICE_ID_STAKEHOLDER?.substring(0, 15) + '...',
        STRIPE_PRICE_ID_PROFESSIONAL: process.env.STRIPE_PRICE_ID_PROFESSIONAL?.substring(0, 15) + '...',
        STRIPE_PRICE_ID_ENTERPRISE: process.env.STRIPE_PRICE_ID_ENTERPRISE?.substring(0, 15) + '...',
        STRIPE_PRICE_ID_FOUNDING: process.env.STRIPE_PRICE_ID_FOUNDING?.substring(0, 15) + '...',
      });
      res.status(500).json({ 
        error: `Payment configuration error: Price ID for ${tier} tier is not set. Please contact support.` 
      });
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
            user.membershipStatus = 'active'; // Set membership status to active after successful payment
            user.membershipTier = session.metadata?.tier || user.membershipTier;
            user.onboardingCompleted = true; // Mark onboarding as complete
            
            // Set membership expiration to 1 year from now
            const expirationDate = new Date();
            expirationDate.setFullYear(expirationDate.getFullYear() + 1);
            user.membershipExpiresAt = expirationDate;
            
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
          user.membershipStatus = 'pending'; // Reset to pending when subscription is cancelled
          await user.save();
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as any;
        const user = await User.findOne({ stripeSubscriptionId: subscription.id });
        if (user) {
          user.membershipStatus = subscription.status === 'active' ? 'active' : 'pending';
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
        membershipStatus: user.membershipStatus,
        membershipTier: user.membershipTier,
        stripeCustomerId: user.stripeCustomerId,
        stripeSubscriptionId: user.stripeSubscriptionId,
        membershipExpiresAt: user.membershipExpiresAt,
        subscription,
      },
      error: null,
    });
  } catch (error: any) {
    console.error('Get subscription error:', error);
    res.status(500).json({ error: error.message || 'Failed to get subscription' });
  }
});

// Verify payment session and update user (called after successful Stripe checkout)
router.post('/verify-payment', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const { sessionId, tier } = req.body;

    if (!sessionId) {
      res.status(400).json({ error: 'Session ID is required' });
      return;
    }

    console.log(`[VERIFY PAYMENT] User: ${user._id}, Session: ${sessionId}, Tier: ${tier}`);

    // Retrieve the checkout session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    console.log(`[VERIFY PAYMENT] Session status: ${session.payment_status}, Amount: ${session.amount_total}`);

    // Check if payment was successful
    if (session.payment_status !== 'paid') {
      res.status(400).json({ 
        error: 'Payment not completed',
        data: { paymentStatus: session.payment_status }
      });
      return;
    }

    // Verify the session belongs to this user
    if (session.metadata?.userId !== user._id.toString()) {
      console.error(`[VERIFY PAYMENT] User ID mismatch: ${session.metadata?.userId} !== ${user._id}`);
      res.status(403).json({ error: 'Session does not belong to this user' });
      return;
    }

    // Update user with payment info
    user.membershipStatus = 'active'; // Set membership status to active after successful payment
    user.membershipTier = tier || session.metadata?.tier || user.membershipTier;
    user.stripeCustomerId = session.customer as string;
    user.onboardingCompleted = true; 
    
    // Set membership expiration to 1 year from now
    const expirationDate = new Date();
    expirationDate.setFullYear(expirationDate.getFullYear() + 1);
    user.membershipExpiresAt = expirationDate;
    
    // For one-time payments, payment_intent is used; for subscriptions, subscription is used
    if (session.subscription) {
      user.stripeSubscriptionId = session.subscription as string;
    }

    await user.save();

    console.log(`[VERIFY PAYMENT] ✅ User updated: status=${user.membershipStatus}, tier=${user.membershipTier}, expires=${user.membershipExpiresAt?.toISOString()}`);

    // Create payment history
    await PaymentHistory.create({
      userId: user._id,
      subscriptionId: session.subscription as string || undefined,
      amount: session.amount_total ? session.amount_total / 100 : 0,
      status: 'succeeded',
      stripePaymentIntentId: session.payment_intent as string || undefined,
    });

    console.log(`[VERIFY PAYMENT] ✅ Payment history created`);

    res.json({
      data: {
        success: true,
        membershipStatus: user.membershipStatus,
        membershipTier: user.membershipTier,
      },
      error: null,
    });
  } catch (error: any) {
    console.error('[VERIFY PAYMENT] Error:', error);
    res.status(500).json({ error: error.message || 'Failed to verify payment' });
  }
});

export default router;
