# Avatar Subfolder Implementation

## Changes Made

All avatar uploads are now organized in a dedicated subfolder structure.

### 1. Created Avatar Subfolder
- **Location**: `nareis-backend/public/avatars/`
- **Purpose**: Keep avatar uploads separate from other static files

### 2. Updated Upload Middleware (`src/middleware/uploadMiddleware.ts`)
```typescript
destination: (req, file, cb) => {
  const uploadPath = path.join(__dirname, '../../public/avatars');
  cb(null, uploadPath);
}
```
- Files now save to `public/avatars/` instead of `public/`

### 3. Updated Admin Routes (`src/routes/admin.ts`)
**POST /api/admin/users** (Line ~169):
```typescript
profilePictureUrl = `${baseUrl}/uploads/avatars/${req.file.filename}`;
```

**PUT /api/admin/users/:id** (Line ~310):
```typescript
user.profilePictureUrl = `${baseUrl}/uploads/avatars/${req.file.filename}`;
```

### 4. Updated User Routes (`src/routes/user.ts`)
**PUT /api/user/profile** (Line ~72):
```typescript
user.profilePictureUrl = `${baseUrl}/uploads/avatars/${req.file.filename}`;
```

### 5. Updated Server Configuration (`src/index.ts`)
Added static route for avatar subfolder:
```typescript
app.use('/uploads', express.static(path.join(__dirname, '../public')));
app.use('/uploads/avatars', express.static(path.join(__dirname, '../public/avatars')));
```

## File Structure

```
nareis-backend/
├── public/
│   ├── avatars/                    # NEW: Avatar uploads
│   │   └── user-123456789.jpg
│   ├── cast1.jpg                   # Existing static files
│   ├── guest.jpg
│   └── ...
└── src/
    └── middleware/
        └── uploadMiddleware.ts     # Updated
```

## URL Format

### Before:
- Physical: `public/filename.jpg`
- URL: `http://localhost:5000/uploads/filename.jpg`

### After:
- Physical: `public/avatars/filename.jpg`
- URL: `http://localhost:5000/uploads/avatars/filename.jpg`

## Database Storage

Avatar URLs in the database now look like:
```
http://localhost:5000/uploads/avatars/user-1768858029497-759349621.jpg
```

## Testing

1. **Create User with Avatar**:
   - Go to Admin > Member Management
   - Click "Create User"
   - Upload an avatar
   - File saves to: `public/avatars/`
   - URL: `http://localhost:5000/uploads/avatars/filename.jpg`

2. **Update User Avatar**:
   - Edit existing user
   - Upload new avatar
   - Old file remains in `public/avatars/`
   - New URL saved to database

3. **User Profile Update**:
   - Users can upload their own avatars
   - Files save to same `public/avatars/` folder

## Benefits

1. **Organization**: Avatars separate from other static files
2. **Clarity**: `/uploads/avatars/` clearly indicates user avatars
3. **Scalability**: Easy to add more upload types (documents, images, etc.)
4. **Maintenance**: Easier to manage and backup user avatars

## Future Enhancements

- Add automatic cleanup of old avatars when users upload new ones
- Implement image optimization/resizing
- Consider cloud storage (AWS S3, Cloudinary) for production
- Add file type validation at route level

## Rollback

If you need to revert to the flat structure:

1. Change `uploadMiddleware.ts` destination back to `'../../public'`
2. Update all route URLs to remove `/avatars` segment
3. Remove avatar static route from `index.ts`
4. Move files from `public/avatars/` to `public/`
