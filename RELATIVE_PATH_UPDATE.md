# Relative Path Update for Avatar URLs

## Change Summary

Updated the avatar upload system to store **relative paths** instead of full URLs in the database.

## Why This Change?

### Before:
```
Database: http://localhost:5000/uploads/avatars/user-123456789.jpg
```

### After:
```
Database: /uploads/avatars/user-123456789.jpg
```

### Benefits:
1. **Portability**: Works with any domain (dev/staging/production)
2. **Database Efficiency**: Smaller string size
3. **Flexibility**: Easy to switch backend servers or use CDN
4. **No Configuration Needed**: No BACKEND_URL environment variable required

## Backend Changes

### 1. Admin Routes (`src/routes/admin.ts`)

**POST /api/admin/users** (Line ~166):
```typescript
// Before
const baseUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`;
profilePictureUrl = `${baseUrl}/uploads/avatars/${req.file.filename}`;

// After
profilePictureUrl = `/uploads/avatars/${req.file.filename}`;
```

**PUT /api/admin/users/:id** (Line ~312):
```typescript
// Before
const baseUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`;
user.profilePictureUrl = `${baseUrl}/uploads/avatars/${req.file.filename}`;

// After
user.profilePictureUrl = `/uploads/avatars/${req.file.filename}`;
```

### 2. User Routes (`src/routes/user.ts`)

**PUT /api/user/profile** (Line ~72):
```typescript
// Before
const baseUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`;
user.profilePictureUrl = `${baseUrl}/uploads/avatars/${req.file.filename}`;

// After
user.profilePictureUrl = `/uploads/avatars/${req.file.filename}`;
```

## Frontend Changes

### 1. API Utility (`src/lib/api.ts`)

Added helper function to convert relative paths to full URLs:

```typescript
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const BACKEND_URL = API_URL.replace('/api', '');

export const getFileUrl = (relativePath: string | undefined | null): string => {
  if (!relativePath) return '';
  // If already a full URL, return as is (backward compatibility)
  if (relativePath.startsWith('http://') || relativePath.startsWith('https://')) {
    return relativePath;
  }
  // If relative path, prepend backend URL
  return `${BACKEND_URL}${relativePath}`;
};
```

### 2. Member Management Component (`src/components/admin/MemberManagement.tsx`)

Updated to use the `getFileUrl` helper:

```typescript
// Import the helper
import { adminAPI, getFileUrl } from '@/lib/api';

// In the user list display
<img 
  src={getFileUrl(u.profilePictureUrl)} 
  alt={u.fullName} 
  className="w-10 h-10 rounded-full object-cover border-2 border-gray-200"
/>

// In the edit dialog preview
setEditAvatarPreview(user.profilePictureUrl ? getFileUrl(user.profilePictureUrl) : null);
```

## How It Works

### Upload Flow:
1. User uploads avatar via frontend
2. Backend saves file to `public/avatars/filename.jpg`
3. Backend stores relative path in database: `/uploads/avatars/filename.jpg`
4. Backend returns user data with relative path

### Display Flow:
1. Frontend receives user data with relative path: `/uploads/avatars/filename.jpg`
2. Frontend calls `getFileUrl()` helper
3. Helper prepends backend URL: `http://localhost:5000/uploads/avatars/filename.jpg`
4. Image displays correctly

## Backward Compatibility

The `getFileUrl()` function checks if the URL already starts with `http://` or `https://`:
- **Old data** (full URLs): Returns as-is
- **New data** (relative paths): Prepends backend URL

This ensures existing avatars continue to work!

## Environment Setup

No changes needed to environment variables! The backend URL is automatically derived from `VITE_API_URL`.

### Development:
```env
VITE_API_URL=http://localhost:5000/api
```
Result: Images served from `http://localhost:5000/uploads/avatars/...`

### Production:
```env
VITE_API_URL=https://api.example.com/api
```
Result: Images served from `https://api.example.com/uploads/avatars/...`

## Testing

1. **Create new user with avatar**:
   - Upload succeeds
   - Database stores: `/uploads/avatars/filename.jpg`
   - Avatar displays correctly in UI

2. **Update existing user**:
   - Old avatars with full URLs still work
   - New avatars use relative paths
   - Both display correctly

3. **Profile updates**:
   - Users can upload their own avatars
   - Relative paths stored and displayed correctly

## Migration Note

Existing database entries with full URLs will continue to work thanks to the `getFileUrl()` helper's backward compatibility check.

If you want to migrate old data to relative paths, run this MongoDB update:

```javascript
// Optional migration script (not required)
db.users.find({ profilePictureUrl: { $regex: '^http' } }).forEach(user => {
  if (user.profilePictureUrl) {
    const url = new URL(user.profilePictureUrl);
    db.users.updateOne(
      { _id: user._id },
      { $set: { profilePictureUrl: url.pathname } }
    );
  }
});
```

## Files Modified

### Backend:
- ✅ `src/routes/admin.ts` - Relative paths for create/update
- ✅ `src/routes/user.ts` - Relative paths for profile update

### Frontend:
- ✅ `src/lib/api.ts` - Added `getFileUrl()` helper
- ✅ `src/components/admin/MemberManagement.tsx` - Use `getFileUrl()` for display

## Summary

The system now stores portable relative paths in the database while the frontend automatically converts them to full URLs for display. This makes the application more flexible and production-ready!
