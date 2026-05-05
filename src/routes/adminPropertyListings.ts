import express, { Response } from 'express';
import mongoose from 'mongoose';
import { PropertyListing } from '../models/PropertyListing.js';
import { PropertyListingInterest } from '../models/PropertyListingInterest.js';
import { User } from '../models/User.js';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware.js';
import { uploadMarketingImages } from '../middleware/uploadMiddleware.js';
import { deleteMarketingFilesFromDisk } from '../utils/marketingFileUtils.js';

const router = express.Router();

const adminMiddleware = (req: AuthRequest, res: Response, next: express.NextFunction) => {
  if (!req.user || req.user.role !== 'admin') {
    res.status(403).json({ error: 'Access denied. Admin privileges required.' });
    return;
  }
  next();
};

router.use(authMiddleware);
router.use(adminMiddleware);

function parseNum(v: unknown, field: string): number {
  const n = typeof v === 'string' ? parseFloat(v) : Number(v);
  if (Number.isNaN(n) || n < 0) {
    throw new Error(`Invalid ${field}`);
  }
  return n;
}

function serializeListing(
  l: {
    _id: mongoose.Types.ObjectId;
    ownerId: unknown;
    location: string;
    dealType: string;
    squareFootage: number;
    priceMin: number;
    priceMax: number;
    estimatedArv: number;
    imageUrls: string[];
    status: 'active' | 'archived';
    visibility?: 'visible' | 'hidden';
    createdAt: Date;
    updatedAt: Date;
  },
  opts?: { interestCount?: number }
) {
  const ownerDoc = l.ownerId as unknown;
  let owner: { email?: string; fullName?: string } | undefined;
  let ownerIdStr: string;
  if (ownerDoc && typeof ownerDoc === 'object' && '_id' in ownerDoc) {
    const o = ownerDoc as { _id: mongoose.Types.ObjectId; email?: string; fullName?: string };
    ownerIdStr = o._id.toString();
    owner = { email: o.email, fullName: o.fullName };
  } else {
    ownerIdStr = String((l.ownerId as mongoose.Types.ObjectId).toString?.() ?? l.ownerId);
  }

  return {
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
    visibility: l.visibility === 'hidden' ? 'hidden' : 'visible',
    interestCount: opts?.interestCount ?? 0,
    createdAt: l.createdAt,
    updatedAt: l.updatedAt,
  };
}

// List all listings (any status), optional filters
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { status, search, visibility } = req.query;
    const filter: Record<string, unknown> = {};
    if (status === 'active' || status === 'archived') {
      filter.status = status;
    }
    if (visibility === 'visible' || visibility === 'hidden') {
      filter.visibility = visibility;
    }
    if (typeof search === 'string' && search.trim()) {
      filter.location = { $regex: search.trim(), $options: 'i' };
    }

    const listings = await PropertyListing.find(filter)
      .populate('ownerId', 'email fullName')
      .sort({ createdAt: -1 })
      .lean();

    const ids = listings.map((l) => l._id);
    const interestAgg =
      ids.length === 0
        ? []
        : await PropertyListingInterest.aggregate<{ _id: mongoose.Types.ObjectId; count: number }>([
            { $match: { listingId: { $in: ids } } },
            { $group: { _id: '$listingId', count: { $sum: 1 } } },
          ]);
    const countMap = new Map(interestAgg.map((x) => [x._id.toString(), x.count]));

    res.json({
      data: {
        listings: listings.map((l) =>
          serializeListing(l as Parameters<typeof serializeListing>[0], {
            interestCount: countMap.get(l._id.toString()) ?? 0,
          })
        ),
      },
      error: null,
    });
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error('Admin list property listings error:', error);
    res.status(500).json({ error: err.message || 'Failed to load listings' });
  }
});

// Create listing for a member (multipart)
router.post(
  '/',
  uploadMarketingImages.array('images', 12),
  async (req: AuthRequest, res: Response) => {
    try {
      const files = req.files as Express.Multer.File[] | undefined;
      if (!files?.length) {
        res.status(400).json({ error: 'At least one image is required' });
        return;
      }

      const body = req.body as Record<string, string>;
      const ownerIdRaw = (body.ownerId || '').trim();
      if (!ownerIdRaw || !mongoose.Types.ObjectId.isValid(ownerIdRaw)) {
        res.status(400).json({ error: 'Valid owner user ID is required' });
        return;
      }
      const owner = await User.findById(ownerIdRaw).select('_id').lean();
      if (!owner) {
        res.status(400).json({ error: 'Owner user not found' });
        return;
      }

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

      let status: 'active' | 'archived' = 'active';
      if (body.status === 'archived') status = 'archived';
      else if (body.status === 'active') status = 'active';

      let vis: 'visible' | 'hidden' = 'visible';
      const vRaw = (body.visibility || '').trim().toLowerCase();
      if (vRaw === 'hidden') vis = 'hidden';

      const imageUrls = files.map((f) => `/uploads/marketing/${f.filename}`);

      const listing = await PropertyListing.create({
        ownerId: ownerIdRaw,
        location,
        dealType,
        squareFootage,
        priceMin,
        priceMax,
        estimatedArv,
        imageUrls,
        status,
        visibility: vis,
      });

      const populated = await PropertyListing.findById(listing._id)
        .populate('ownerId', 'email fullName')
        .lean();

      res.status(201).json({
        data: {
          listing: populated
            ? serializeListing(populated as Parameters<typeof serializeListing>[0], { interestCount: 0 })
            : serializeListing(listing.toObject() as Parameters<typeof serializeListing>[0]),
        },
        error: null,
      });
    } catch (error: unknown) {
      const err = error as { message?: string };
      console.error('Admin create listing error:', error);
      res.status(500).json({ error: err.message || 'Failed to create listing' });
    }
  }
);

router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const listingId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(listingId)) {
      res.status(400).json({ error: 'Invalid listing id' });
      return;
    }

    const l = await PropertyListing.findById(listingId).populate('ownerId', 'email fullName').lean();
    if (!l) {
      res.status(404).json({ error: 'Listing not found' });
      return;
    }

    const ic = await PropertyListingInterest.countDocuments({ listingId: l._id });

    res.json({
      data: {
        listing: serializeListing(l as Parameters<typeof serializeListing>[0], { interestCount: ic }),
      },
      error: null,
    });
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error('Admin get listing error:', error);
    res.status(500).json({ error: err.message || 'Failed to load listing' });
  }
});

router.put('/:id', async (req: AuthRequest, res: Response) => {
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

    const body = req.body as Record<string, unknown>;

    if (body.ownerId !== undefined) {
      const oid = String(body.ownerId).trim();
      if (!mongoose.Types.ObjectId.isValid(oid)) {
        res.status(400).json({ error: 'Invalid owner user id' });
        return;
      }
      const owner = await User.findById(oid).select('_id').lean();
      if (!owner) {
        res.status(400).json({ error: 'Owner user not found' });
        return;
      }
      listing.ownerId = new mongoose.Types.ObjectId(oid);
    }

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

    const populated = await PropertyListing.findById(listing._id)
      .populate('ownerId', 'email fullName')
      .lean();
    const ic = await PropertyListingInterest.countDocuments({ listingId: listing._id });

    res.json({
      data: {
        listing: populated
          ? serializeListing(populated as Parameters<typeof serializeListing>[0], { interestCount: ic })
          : serializeListing(listing.toObject() as Parameters<typeof serializeListing>[0], { interestCount: ic }),
      },
      error: null,
    });
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error('Admin update listing error:', error);
    res.status(500).json({ error: err.message || 'Failed to update listing' });
  }
});

router.post(
  '/:id/images',
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

      const newUrls = files.map((f) => `/uploads/marketing/${f.filename}`);
      listing.imageUrls = [...listing.imageUrls, ...newUrls];
      await listing.save();

      const populated = await PropertyListing.findById(listing._id)
        .populate('ownerId', 'email fullName')
        .lean();
      const ic = await PropertyListingInterest.countDocuments({ listingId: listing._id });

      res.json({
        data: {
          listing: populated
            ? serializeListing(populated as Parameters<typeof serializeListing>[0], { interestCount: ic })
            : serializeListing(listing.toObject() as Parameters<typeof serializeListing>[0], { interestCount: ic }),
        },
        error: null,
      });
    } catch (error: unknown) {
      const err = error as { message?: string };
      console.error('Admin append images error:', error);
      res.status(500).json({ error: err.message || 'Failed to add images' });
    }
  }
);

router.delete('/:id', async (req: AuthRequest, res: Response) => {
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

    const urls = [...listing.imageUrls];
    await PropertyListingInterest.deleteMany({ listingId: listing._id });
    await PropertyListing.deleteOne({ _id: listing._id });
    deleteMarketingFilesFromDisk(urls);

    res.json({
      data: { message: 'Listing deleted' },
      error: null,
    });
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error('Admin delete listing error:', error);
    res.status(500).json({ error: err.message || 'Failed to delete listing' });
  }
});

export default router;
