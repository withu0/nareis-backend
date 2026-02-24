import multer, { FileFilterCallback } from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { Request } from 'express';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure storage for avatar uploads
const avatarStorage = multer.diskStorage({
  destination: (req: Request, file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => {
    const uploadPath = path.join(__dirname, '../../public/avatars');
    cb(null, uploadPath);
  },
  filename: (req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const nameWithoutExt = path.basename(file.originalname, ext);
    cb(null, `${nameWithoutExt}-${uniqueSuffix}${ext}`);
  }
});

// Configure storage for event image uploads
const eventImageStorage = multer.diskStorage({
  destination: (req: Request, file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => {
    const uploadPath = path.join(__dirname, '../../public/events');
    cb(null, uploadPath);
  },
  filename: (req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const nameWithoutExt = path.basename(file.originalname, ext);
    cb(null, `event-${nameWithoutExt}-${uniqueSuffix}${ext}`);
  }
});

// File filter to only allow images
const fileFilter = (req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
  // Accept images only
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'));
  }
};

// Configure multer for avatars
export const upload = multer({
  storage: avatarStorage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB max file size
  }
});

// Configure multer for event images
export const uploadEventImage = multer({
  storage: eventImageStorage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB max file size for events
  }
});
