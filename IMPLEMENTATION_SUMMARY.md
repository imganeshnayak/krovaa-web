# Implementation Summary: KrovAI Rate Limiting & Admin Controls

## Overview
Added comprehensive rate limiting for the KrovAI image generator feature with:
- **5 images per day** limit per user (configurable by admin)
- **Enable/Disable toggle** in user settings
- **Enable/Disable toggle** in admin system settings
- **Admin dashboard** with detailed image generation statistics
- **User-friendly UI** showing daily generation count and reset time

## Changes Made

### 1. **Database Schema** (`backend/prisma/schema.prisma`)
- Added new `ImageGenerationDaily` model to track daily image generation counts per user
- Fields: `id`, `userId`, `count`, `date`, `createdAt`, `updatedAt`
- Unique constraint on `userId_date` to prevent duplicate daily records

### 2. **Backend - Image Generator Route** (`backend/routes/imageGenerator.js`)

#### Updated `/api/image-generator/generate` endpoint:
- Added rate limiting check (checks daily limit from `ImageGenerationDaily` table)
- Returns 429 error if daily limit is reached with details about limit, usage, and reset time
- After successful generation, increments daily count using `upsert` operation

#### New `/api/image-generator/daily-limit/check` endpoint (GET):
- Returns current user's daily generation status
- Response includes: `limit`, `used`, `remaining`, `resetTime`

#### Updated `/api/image-generator/stats` endpoint:
- Enhanced to include image generation specific stats
- Returns: `totalGenerations`, `todayGenerations`, `topStyles`, `dailyLimit`, `isEnabled`, `usersAtLimitToday`, `uniqueUsersToday`, `totalDailyUsers`, `averagePerUser`

### 3. **Frontend - API Client** (`frontend/src/lib/api.ts`)
- Added `DailyLimitInfo` interface
- Added `getDailyGenerationLimit()` function to fetch user's daily limit info
- Updated `getImageGeneratorStats()` return type to include new fields

### 4. **Frontend - Settings Page** (`frontend/src/pages/SettingsPage.tsx`)

#### Features Section - KrovAI Toggle:
- Existing toggle to enable/disable KrovAI feature
- **NEW**: Shows daily generation limit info when feature is enabled
- Displays:
  - Images generated today (used / limit)
  - Progress bar showing usage percentage
  - Remaining images count
  - Warning message when daily limit is reached
  - Formatted with Zap icon in purple theme

#### Implementation:
- Added `getDailyGenerationLimit` import
- New state variables: `dailyLimitInfo`, `isLoadingLimit`
- Auto-loads limit info when user enables the feature
- Real-time display of remaining generations

### 5. **Frontend - Admin Dashboard** (`frontend/src/pages/AdminDashboard.tsx`)

#### System Settings - New Section:
- **KrovAI Image Generator Configuration Card**
- Contains:
  1. **Enable/Disable Feature Switch** - Toggle AI image generation globally
  2. **Daily Limit Input** - Set images per day (default: 5)
  - Validates number between 1-100
  - Input field with Zap icon styling

#### Overview Tab - New Stats Cards:
- **Today's AI Generations**: Shows daily generation count and active users
- **Daily Limit Status**: Shows how many users hit the daily limit
- **AI Generator Status**: Shows if feature is enabled/disabled and current limit

#### Implementation:
- Added image generation stats state
- Fetches stats from `/api/image-generator/stats` endpoint
- Displays conditional cards based on stats availability

### 6. **System Settings (Automatic)**
Two new system settings are automatically managed through the admin dashboard:
- `image_generator_enabled`: `"true"` or `"false"` (default: `"true"`)
- `image_generation_daily_limit`: `"5"` (configurable)

## User Flows

### For Regular Users:
1. User visits Settings → Features section
2. User toggles KrovAI Image Generator
3. When enabled, sees daily limit info:
   - "3 / 5 images generated today"
   - Progress bar showing usage
   - "2 images remaining"
4. When limit is reached:
   - Can't generate more images
   - See message "Daily limit reached. Try again tomorrow!"

### For Admin:
1. Admin visits Admin Dashboard → Settings tab
2. Find "KrovAI Image Generator" configuration card
3. Can toggle enable/disable for all users
4. Can set daily limit (1-100 images)
5. On Overview tab, see:
   - Today's total generations
   - How many users hit the daily limit
   - Current feature status and limit

## Database Migration

Run the following commands to apply changes:

```bash
cd backend
npx prisma migrate dev --name add_image_generation_daily_limit
```

This will:
1. Create the `image_generation_daily` table
2. Set up the unique constraint on `(userId, date)`

## API Endpoints

### User Endpoints:
- `GET /api/image-generator/daily-limit/check` - Get user's daily limit status

### Admin Endpoints:
- `GET /api/image-generator/stats` - Get detailed image generation statistics

### Existing Endpoints (Enhanced):
- `POST /api/image-generator/generate` - Now includes rate limiting
- `GET /api/admin/settings` - Manages image generator settings

## Configuration

### Default Settings:
- Feature enabled: `true`
- Daily limit: `5 images per user`
- Reset time: Midnight UTC (date changes)

### How to Change:
1. Go to Admin Dashboard → Settings
2. Scroll to "KrovAI Image Generator" section
3. Adjust settings and click "Update Image Generator Settings"

## Error Handling

### When daily limit exceeded:
```json
{
  "error": "Daily limit reached. You can generate 5 images per day.",
  "limit": 5,
  "used": 5,
  "resetTime": "2026-05-20T00:00:00.000Z"
}
```

### Response Code: `429 (Too Many Requests)`

## Future Enhancements

Possible improvements:
- Per-tier rate limits (different limits for verified users)
- Reset time customization
- Cost-based system (users earn daily quota)
- Premium tier unlimited generation
- Request analytics and reports
- User-specific limit overrides
