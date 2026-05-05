import express, { Response } from 'express';
import mongoose from 'mongoose';
import { PropertyListing } from '../models/PropertyListing.js';
import { PropertyListingInterest } from '../models/PropertyListingInterest.js';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware.js';
import { requireActiveMember } from '../middleware/memberAccessMiddleware.js';
import { uploadMarketingImages } from '../middleware/uploadMiddleware.js';
import { deleteMarketingFilesFromDisk } from '../utils/marketingFileUtils.js';

const router = express.Router();

router.use(authMiddleware);
router.use(requireActiveMember);

function parseNum(v: unknown, field: string): number {
  const n = typeof v === 'string' ? parseFloat(v) : Number(v);
  if (Number.isNaN(n) || n < 0) {
    throw new Error(`Invalid ${field}`);
  }
  return n;
}

// Browse active listings (optional query filters: search, dealType, budgetMin/Max, sqftMin/Max, sort)
router.get('/listings', async (req: AuthRequest, res: Response) => {
  try {
    const q = req.query;
    const filter: Record<string, unknown> = {
      status: 'active',
      visibility: { $ne: 'hidden' },
    };

    const search = typeof q.search === 'string' ? q.search.trim() : '';
    if (search) {
      filter.location = { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
    }

    const dealType = typeof q.dealType === 'string' ? q.dealType.trim() : '';
    if (dealType && dealType !== 'all') {
      filter.dealType = dealType;
    }

    const budgetMin = q.budgetMin !== undefined && q.budgetMin !== '' ? Number(q.budgetMin) : NaN;
    const budgetMax = q.budgetMax !== undefined && q.budgetMax !== '' ? Number(q.budgetMax) : NaN;
    if (!Number.isNaN(budgetMin) && budgetMin >= 0) {
      (filter as { priceMax?: { $gte: number } }).priceMax = { $gte: budgetMin };
    }
    if (!Number.isNaN(budgetMax) && budgetMax >= 0) {
      (filter as { priceMin?: { $lte: number } }).priceMin = { $lte: budgetMax };
    }

    const sqftMin = q.sqftMin !== undefined && q.sqftMin !== '' ? Number(q.sqftMin) : NaN;
    const sqftMax = q.sqftMax !== undefined && q.sqftMax !== '' ? Number(q.sqftMax) : NaN;
    const sqftRange: Record<string, number> = {};
    if (!Number.isNaN(sqftMin) && sqftMin >= 0) sqftRange.$gte = sqftMin;
    if (!Number.isNaN(sqftMax) && sqftMax >= 0) sqftRange.$lte = sqftMax;
    if (Object.keys(sqftRange).length > 0) {
      filter.squareFootage = sqftRange;
    }

    const sortParam = typeof q.sort === 'string' ? q.sort : 'newest';
    let sortSpec: Record<string, 1 | -1> | null = { createdAt: -1 };
    switch (sortParam) {
      case 'price_asc':
        sortSpec = { priceMin: 1 };
        break;
      case 'price_desc':
        sortSpec = { priceMax: -1 };
        break;
      case 'sqft_asc':
        sortSpec = { squareFootage: 1 };
        break;
      case 'sqft_desc':
        sortSpec = { squareFootage: -1 };
        break;
      case 'interest_desc':
        sortSpec = null;
        break;
      case 'newest':
      default:
        sortSpec = { createdAt: -1 };
        break;
    }

    let queryBuilder = PropertyListing.find(filter).populate('ownerId', 'fullName profilePictureUrl');
    if (sortSpec) {
      queryBuilder = queryBuilder.sort(sortSpec);
    }
    let listings = await queryBuilder.lean();

    const listingIds = listings.map((l) => l._id);
    const interestAgg =
      listingIds.length === 0
        ? []
        : await PropertyListingInterest.aggregate<{ _id: mongoose.Types.ObjectId; count: number }>([
            { $match: { listingId: { $in: listingIds } } },
            { $group: { _id: '$listingId', count: { $sum: 1 } } },
          ]);
    const interestByListing = new Map(interestAgg.map((x) => [x._id.toString(), x.count]));

    if (sortParam === 'interest_desc' && listings.length > 0) {
      listings = [...listings].sort(
        (a, b) =>
          (interestByListing.get(b._id.toString()) ?? 0) - (interestByListing.get(a._id.toString()) ?? 0)
      );
    }

    res.json({
      data: {
        listings: listings.map((l) => ({
          id: l._id.toString(),
          ownerId: l.ownerId && typeof l.ownerId === 'object' && '_id' in l.ownerId ? (l.ownerId as { _id: mongoose.Types.ObjectId })._id.toString() : String(l.ownerId),
          owner: l.ownerId && typeof l.ownerId === 'object' && 'fullName' in l.ownerId
            ? {
                fullName: (l.ownerId as { fullName?: string }).fullName,
                profilePictureUrl: (l.ownerId as { profilePictureUrl?: string }).profilePictureUrl,
              }
            : undefined,
          location: l.location,
          dealType: l.dealType,
          squareFootage: l.squareFootage,
          priceMin: l.priceMin,
          priceMax: l.priceMax,
          estimatedArv: l.estimatedArv,
          imageUrls: l.imageUrls,
          status: l.status,
          visibility: (l as { visibility?: string }).visibility === 'hidden' ? 'hidden' : 'visible',
          interestCount: interestByListing.get(l._id.toString()) ?? 0,
          createdAt: l.createdAt,
          updatedAt: l.updatedAt,
        })),
      },
      error: null,
    });
  } catch (error: any) {
    console.error('Marketing listings error:', error);
    res.status(500).json({ error: error.message || 'Failed to load listings' });
  }
});

// Single active listing (detail view)
router.get('/listings/:id', async (req: AuthRequest, res: Response) => {
  try {
    const listingId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(listingId)) {
      res.status(400).json({ error: 'Invalid listing id' });
      return;
    }

    const l = await PropertyListing.findOne({
      _id: listingId,
      status: 'active',
      visibility: { $ne: 'hidden' },
    })
      .populate('ownerId', 'fullName profilePictureUrl')
      .lean();

    if (!l) {
      res.status(404).json({ error: 'Listing not found' });
      return;
    }

    const ownerDoc = l.ownerId as unknown;
    let owner: { fullName?: string; profilePictureUrl?: string } | undefined;
    if (ownerDoc && typeof ownerDoc === 'object' && 'fullName' in ownerDoc) {
      const o = ownerDoc as { fullName?: string; profilePictureUrl?: string; _id?: mongoose.Types.ObjectId };
      owner = { fullName: o.fullName, profilePictureUrl: o.profilePictureUrl };
    }
    const ownerIdStr =
      ownerDoc && typeof ownerDoc === 'object' && '_id' in (ownerDoc as object)
        ? String((ownerDoc as { _id: mongoose.Types.ObjectId })._id)
        : String(l.ownerId);

    const interestCount = await PropertyListingInterest.countDocuments({ listingId: l._id });

    res.json({
      data: {
        listing: {
          id: l._id.toString(),
          ownerId: ownerIdStr,
          owner,
          location: l.location,
          dealType: l.dealType,
          squareFootage: l.squareFootage,
          priceMin: l.priceMin,
          priceMax: l.priceMax,
          estimatedArv: l.estimatedArv,
          imageUrls: l.imageUrls,
          status: l.status,
          visibility: (l as { visibility?: string }).visibility === 'hidden' ? 'hidden' : 'visible',
          interestCount,
          createdAt: l.createdAt,
          updatedAt: l.updatedAt,
        },
      },
      error: null,
    });
  } catch (error: any) {
    console.error('Get listing error:', error);
    res.status(500).json({ error: error.message || 'Failed to load listing' });
  }
});

// Owner's listings with interested members (dashboard)
router.get('/my-listings', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!._id;
    const listings = await PropertyListing.find({ ownerId: userId })
      .sort({ createdAt: -1 })
      .lean();

    const listingIds = listings.map((l) => l._id);
    const interests = await PropertyListingInterest.find({
      listingId: { $in: listingIds },
    })
      .populate('interestedUserId', 'fullName email phone organization profilePictureUrl')
      .sort({ createdAt: -1 })
      .lean();

    const byListing: Record<string, typeof interests> = {};
    for (const i of interests) {
      const lid = i.listingId.toString();
      if (!byListing[lid]) byListing[lid] = [];
      byListing[lid].push(i);
    }

    res.json({
      data: {
        listings: listings.map((l) => {
          const lid = l._id.toString();
          const raw = byListing[lid] || [];
          return {
            id: lid,
            ownerId: l.ownerId.toString(),
            location: l.location,
            dealType: l.dealType,
            squareFootage: l.squareFootage,
            priceMin: l.priceMin,
            priceMax: l.priceMax,
            estimatedArv: l.estimatedArv,
            imageUrls: l.imageUrls,
            status: l.status,
            visibility: (l as { visibility?: string }).visibility === 'hidden' ? 'hidden' : 'visible',
            interestCount: raw.length,
            createdAt: l.createdAt,
            updatedAt: l.updatedAt,
            interests: raw.map((row) => {
              const u = row.interestedUserId as unknown as {
                _id: mongoose.Types.ObjectId;
                fullName?: string;
                email?: string;
                phone?: string;
                organization?: string;
                profilePictureUrl?: string;
              } | null;
              if (!u || typeof u !== 'object') {
                return { userId: '', fullName: '', email: '' };
              }
              return {
                id: row._id.toString(),
                createdAt: row.createdAt,
                userId: u._id.toString(),
                fullName: u.fullName || '',
                email: u.email || '',
                phone: u.phone,
                organization: u.organization,
                profilePictureUrl: u.profilePictureUrl,
              };
            }),
          };
        }),
      },
      error: null,
    });
  } catch (error: any) {
    console.error('My marketing listings error:', error);
    res.status(500).json({ error: error.message || 'Failed to load your listings' });
  }
});

router.post(
  '/listings',
  uploadMarketingImages.array('images', 12),
  async (req: AuthRequest, res: Response) => {
    try {
      const files = req.files as Express.Multer.File[] | undefined;
      if (!files?.length) {
        res.status(400).json({ error: 'At least one image is required' });
        return;
      }

      const body = req.body as Record<string, string>;
      const location = (body.location || '').trim();
      let dealType = (body.dealType || 'other').trim();
      if (!dealType) dealType = 'other';
      if (dealType.length > 80) dealType = dealType.slice(0, 80);

      const squareFootage = parseNum(body.squareFootage, 'squareFootage');
      const priceMin = parseNum(body.priceMin, 'priceMin');
      const priceMax = parseNum(body.priceMax, 'priceMax');
      const estimatedArv = parseNum(body.estimatedArv, 'estimatedArv');

      if (!location) {
        res.status(400).json({ error: 'Location is required' });
        return;
      }
      if (priceMin > priceMax) {
        res.status(400).json({ error: 'Price range: min must be less than or equal to max' });
        return;
      }

      let visibility: 'visible' | 'hidden' = 'visible';
      const visRaw = (body.visibility || '').trim().toLowerCase();
      if (visRaw === 'hidden') visibility = 'hidden';

      const imageUrls = files.map((f) => `/uploads/marketing/${f.filename}`);

      const listing = await PropertyListing.create({
        ownerId: req.user!._id,
        location,
        dealType,
        squareFootage,
        priceMin,
        priceMax,
        estimatedArv,
        imageUrls,
        status: 'active',
        visibility,
      });

      res.status(201).json({
        data: {
          listing: {
            id: listing._id.toString(),
            location: listing.location,
            dealType: listing.dealType,
            squareFootage: listing.squareFootage,
            priceMin: listing.priceMin,
            priceMax: listing.priceMax,
            estimatedArv: listing.estimatedArv,
            imageUrls: listing.imageUrls,
            status: listing.status,
            visibility: listing.visibility,
            createdAt: listing.createdAt,
            updatedAt: listing.updatedAt,
          },
        },
        error: null,
      });
    } catch (error: any) {
      console.error('Create listing error:', error);
      res.status(500).json({ error: error.message || 'Failed to create listing' });
    }
  }
);

// Owner: update listing (JSON — fields + imageUrls; use POST .../images to add files)
router.put('/listings/:id', async (req: AuthRequest, res: Response) => {
  try {
    const listingId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(listingId)) {
      res.status(400).json({ error: 'Invalid listing id' });
      return;
    }

    const listing = await PropertyListing.findById(listingId);
    if (!listing) {
      res.status(404).json({ error: 'Listing not found' });
      return;
    }
    if (listing.ownerId.toString() !== req.user!._id.toString()) {
      res.status(403).json({ error: 'You can only edit your own listings' });
      return;
    }

    const body = req.body as Record<string, unknown>;
    if (body.location !== undefined) {
      const loc = String(body.location).trim();
      if (!loc) {
        res.status(400).json({ error: 'Location cannot be empty' });
        return;
      }
      listing.location = loc;
    }
    if (body.dealType !== undefined) {
      let dt = String(body.dealType).trim();
      if (!dt) dt = 'other';
      if (dt.length > 80) dt = dt.slice(0, 80);
      listing.dealType = dt;
    }
    if (body.squareFootage !== undefined) listing.squareFootage = parseNum(body.squareFootage, 'squareFootage');
    if (body.priceMin !== undefined) listing.priceMin = parseNum(body.priceMin, 'priceMin');
    if (body.priceMax !== undefined) listing.priceMax = parseNum(body.priceMax, 'priceMax');
    if (body.estimatedArv !== undefined) listing.estimatedArv = parseNum(body.estimatedArv, 'estimatedArv');
    if (body.status !== undefined) {
      const st = String(body.status);
      if (st !== 'active' && st !== 'archived') {
        res.status(400).json({ error: 'Invalid status' });
        return;
      }
      listing.status = st as 'active' | 'archived';
    }
    if (body.visibility !== undefined) {
      const v = String(body.visibility).toLowerCase();
      if (v !== 'visible' && v !== 'hidden') {
        res.status(400).json({ error: 'Invalid visibility' });
        return;
      }
      listing.visibility = v as 'visible' | 'hidden';
    }
    if (body.imageUrls !== undefined) {
      if (!Array.isArray(body.imageUrls)) {
        res.status(400).json({ error: 'imageUrls must be an array' });
        return;
      }
      const urls = body.imageUrls.map((u) => String(u));
      const removed = listing.imageUrls.filter((u) => !urls.includes(u));
      deleteMarketingFilesFromDisk(removed);
      for (const u of urls) {
        if (u && !u.startsWith('/uploads/marketing/')) {
          res.status(400).json({ error: 'Invalid image URL' });
          return;
        }
      }
      listing.imageUrls = urls.filter(Boolean);
      if (listing.imageUrls.length === 0) {
        res.status(400).json({ error: 'At least one image is required' });
        return;
      }
    }

    if (listing.priceMin > listing.priceMax) {
      res.status(400).json({ error: 'Price range: min must be less than or equal to max' });
      return;
    }

    await listing.save();

    res.json({
      data: {
        listing: {
          id: listing._id.toString(),
          location: listing.location,
          dealType: listing.dealType,
          squareFootage: listing.squareFootage,
          priceMin: listing.priceMin,
          priceMax: listing.priceMax,
          estimatedArv: listing.estimatedArv,
          imageUrls: listing.imageUrls,
          status: listing.status,
          visibility: listing.visibility,
          createdAt: listing.createdAt,
          updatedAt: listing.updatedAt,
        },
      },
      error: null,
    });
  } catch (error: any) {
    console.error('Update listing error:', error);
    res.status(500).json({ error: error.message || 'Failed to update listing' });
  }
});

// Owner: append images (multipart)
router.post(
  '/listings/:id/images',
  uploadMarketingImages.array('images', 12),
  async (req: AuthRequest, res: Response) => {
    try {
      const listingId = req.params.id;
      if (!mongoose.Types.ObjectId.isValid(listingId)) {
        res.status(400).json({ error: 'Invalid listing id' });
        return;
      }

      const files = req.files as Express.Multer.File[] | undefined;
      if (!files?.length) {
        res.status(400).json({ error: 'At least one image file is required' });
        return;
      }

      const listing = await PropertyListing.findById(listingId);
      if (!listing) {
        res.status(404).json({ error: 'Listing not found' });
        return;
      }
      if (listing.ownerId.toString() !== req.user!._id.toString()) {
        res.status(403).json({ error: 'You can only edit your own listings' });
        return;
      }

      const newUrls = files.map((f) => `/uploads/marketing/${f.filename}`);
      listing.imageUrls = [...listing.imageUrls, ...newUrls];
      await listing.save();

      res.json({
        data: {
          listing: {
            id: listing._id.toString(),
            imageUrls: listing.imageUrls,
            updatedAt: listing.updatedAt,
          },
        },
        error: null,
      });
    } catch (error: any) {
      console.error('Append images error:', error);
      res.status(500).json({ error: error.message || 'Failed to add images' });
    }
  }
);

// Owner: delete listing (and interests; removes image files)
router.delete('/listings/:id', async (req: AuthRequest, res: Response) => {
  try {
    const listingId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(listingId)) {
      res.status(400).json({ error: 'Invalid listing id' });
      return;
    }

    const listing = await PropertyListing.findById(listingId);
    if (!listing) {
      res.status(404).json({ error: 'Listing not found' });
      return;
    }
    if (listing.ownerId.toString() !== req.user!._id.toString()) {
      res.status(403).json({ error: 'You can only delete your own listings' });
      return;
    }

    const urls = [...listing.imageUrls];
    await PropertyListingInterest.deleteMany({ listingId: listing._id });
    await PropertyListing.deleteOne({ _id: listing._id });
    deleteMarketingFilesFromDisk(urls);

    res.json({
      data: { message: 'Listing deleted' },
      error: null,
    });
  } catch (error: any) {
    console.error('Delete listing error:', error);
    res.status(500).json({ error: error.message || 'Failed to delete listing' });
  }
});

// Register interest (idempotent)
router.post('/listings/:id/interest', async (req: AuthRequest, res: Response) => {
  try {
    const listingId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(listingId)) {
      res.status(400).json({ error: 'Invalid listing id' });
      return;
    }

    const listing = await PropertyListing.findById(listingId);
    if (!listing || listing.status !== 'active' || listing.visibility === 'hidden') {
      res.status(404).json({ error: 'Listing not found' });
      return;
    }

    const uid = req.user!._id;
    if (listing.ownerId.toString() === uid.toString()) {
      res.status(400).json({ error: 'You cannot express interest in your own listing' });
      return;
    }

    await PropertyListingInterest.findOneAndUpdate(
      { listingId: listing._id, interestedUserId: uid },
      { listingId: listing._id, interestedUserId: uid },
      { upsert: true, new: true }
    );

    res.json({
      data: { message: 'Interest recorded' },
      error: null,
    });
  } catch (error: any) {
    if (error.code === 11000) {
      res.json({ data: { message: 'Interest recorded' }, error: null });
      return;
    }
    console.error('Listing interest error:', error);
    res.status(500).json({ error: error.message || 'Failed to record interest' });
  }
});

// Owner: interested members for one listing
router.get('/listings/:id/interests', async (req: AuthRequest, res: Response) => {
  try {
    const listingId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(listingId)) {
      res.status(400).json({ error: 'Invalid listing id' });
      return;
    }

    const listing = await PropertyListing.findById(listingId);
    if (!listing) {
      res.status(404).json({ error: 'Listing not found' });
      return;
    }
    if (listing.ownerId.toString() !== req.user!._id.toString()) {
      res.status(403).json({ error: 'Only the listing owner can view interests' });
      return;
    }

    const interests = await PropertyListingInterest.find({ listingId: listing._id })
      .populate('interestedUserId', 'fullName email phone organization profilePictureUrl')
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      data: {
        interests: interests.map((row) => {
          const u = row.interestedUserId as unknown as {
            _id: mongoose.Types.ObjectId;
            fullName?: string;
            email?: string;
            phone?: string;
            organization?: string;
            profilePictureUrl?: string;
          } | null;
          return {
            id: row._id.toString(),
            createdAt: row.createdAt,
            userId: u && typeof u === 'object' ? u._id.toString() : '',
            fullName: u?.fullName || '',
            email: u?.email || '',
            phone: u?.phone,
            organization: u?.organization,
            profilePictureUrl: u?.profilePictureUrl,
          };
        }),
      },
      error: null,
    });
  } catch (error: any) {
    console.error('List interests error:', error);
    res.status(500).json({ error: error.message || 'Failed to load interests' });
  }
});

export default router;
