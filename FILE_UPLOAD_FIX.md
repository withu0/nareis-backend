# File Upload Feature Fix

## Problem
The avatar/file uploading feature was not working because:
1. The backend had multer installed but was not using it
2. No file upload middleware was configured
3. Admin and user routes were only reading from `req.body`, which doesn't work for multipart/form-data
4. No static file serving was configured for uploaded files

## Solution Implemented

### 1. Created Upload Middleware (`src/middleware/uploadMiddleware.ts`)
- Configured multer to handle file uploads
- Files are saved to the `public/` folder
- Generates unique filenames with timestamps
- File filter to only accept images
- 5MB file size limit
- Proper error handling for non-image files

### 2. Updated Admin Routes (`src/routes/admin.ts`)
- Added multer middleware to both create and update user endpoints
- POST `/api/admin/users` - now handles avatar uploads during user creation
- PUT `/api/admin/users/:id` - now handles avatar uploads during user updates
- Properly handles boolean fields from FormData (converts string 'true'/'false')
- Returns the uploaded avatar URL in the response

### 3. Updated User Routes (`src/routes/user.ts`)
- PUT `/api/user/profile` - now handles avatar uploads for user profile updates
- Users can now upload their own avatars through their profile

### 4. Updated Server Configuration (`src/index.ts`)
- Added static file serving for the `/uploads` route
- Files in `public/` folder are now accessible via `http://localhost:5000/uploads/filename.jpg`
- Added necessary imports (path, fileURLToPath)

### 5. Updated Environment Variables (`env.example`)
- Added `BACKEND_URL` configuration for generating full URLs to uploaded files
- Default: `http://localhost:5000`

## How It Works

### Frontend Flow:
1. User selects an image file through the UI
2. Frontend validates file (size < 5MB, must be image)
3. Frontend creates FormData and appends:
   - `avatar` field with the file
   - Other form fields as needed
4. Sends multipart/form-data request to backend

### Backend Flow:
1. Multer middleware intercepts the request
2. Validates file type (must be image)
3. Saves file to `public/` folder with unique name
4. File metadata is available in `req.file`
5. Constructs public URL: `${BACKEND_URL}/uploads/${filename}`
6. Saves URL to database in `profilePictureUrl` field
7. Returns response with updated user data including avatar URL

### Frontend Retrieval:
1. Frontend receives user data with `profilePictureUrl`
2. Displays image using the URL
3. Image is served as static content from backend

## Files Modified

### Backend:
- ✅ `src/middleware/uploadMiddleware.ts` (NEW)
- ✅ `src/routes/admin.ts`
- ✅ `src/routes/user.ts`
- ✅ `src/index.ts`
- ✅ `env.example`

### Frontend (Already Working):
- `src/components/admin/MemberManagement.tsx` - Already handling FormData correctly
- `src/lib/api.ts` - Already detecting FormData and setting correct headers

## Testing

### Test Avatar Upload:
1. Start the backend: `cd nareis-backend && npm run dev`
2. Start the frontend: `cd nareis-frontend && npm run dev`
3. Login as admin
4. Go to Admin > Member Management
5. Click "Create User" or "Edit" on existing user
6. Upload an image in the avatar section
7. Save changes
8. Verify the avatar appears in the user list

### Expected Behavior:
- ✅ File uploads successfully
- ✅ Avatar preview shows immediately after selection
- ✅ Avatar displays in user list after save
- ✅ Avatar URL is saved to database
- ✅ Avatar is accessible via the generated URL

### Supported Endpoints:
- `POST /api/admin/users` - Create user with avatar
- `PUT /api/admin/users/:id` - Update user with avatar
- `PUT /api/user/profile` - Update own profile with avatar
- `GET /uploads/:filename` - Serve uploaded files

## Environment Setup

Make sure your `.env` file includes:
```
PORT=5000
BACKEND_URL=http://localhost:5000
MONGODB_URI=your_mongodb_uri
JWT_SECRET=your_jwt_secret
# ... other variables
```

## Troubleshooting

### Avatar not displaying:
1. Check backend logs for upload errors
2. Verify file is in `nareis-backend/public/` folder
3. Check browser network tab for 404 errors
4. Verify `BACKEND_URL` in .env is correct

### Upload fails:
1. File must be < 5MB
2. File must be an image (jpg, png, gif, etc.)
3. Check backend logs for multer errors
4. Verify `public/` folder exists and is writable

### Wrong URL format:
- URL should be: `http://localhost:5000/uploads/filename-timestamp-random.jpg`
- NOT: `http://localhost:5000/public/...`
- The `/uploads` route maps to the `public/` folder

## Notes

- Uploaded files are stored in `nareis-backend/public/`
- Files are never deleted automatically (implement cleanup if needed)
- Production: Consider using cloud storage (AWS S3, Cloudinary, etc.)
- The `public/` folder contains sample images and will now contain user uploads
