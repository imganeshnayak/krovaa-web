# Deployment Checklist: KrovAI Rate Limiting Feature

## ✅ Backend Setup

### 1. Database Migration
```bash
cd backend
npx prisma migrate dev --name add_image_generation_daily_limit
```
- [ ] Run the migration command
- [ ] Verify the `image_generation_daily` table is created
- [ ] Confirm unique index on `(user_id, date)` exists

### 2. Environment Variables
Ensure these are set in `.env`:
```bash
IMAGE_GENERATOR_PROVIDER=pollinations  # or openai/stability/puter
IMAGE_GENERATOR_ENABLED=true          # Can be set via admin dashboard later
```

### 3. Backend Service
```bash
# Restart the backend service
npm start
# or
node server.js
```
- [ ] No errors in logs
- [ ] Backend is running on port 5000 (or configured port)

## ✅ Frontend Setup

### 1. Dependencies
All required components already exist in the project:
- [ ] Verify `@/components/ui/switch` exists
- [ ] Verify `lucide-react` has all icons (Zap, AlertCircle, etc.)

### 2. Frontend Build
```bash
cd frontend
npm run build
# or
bun build
```
- [ ] No TypeScript errors
- [ ] Build completes successfully

### 3. Start Frontend
```bash
npm run dev
# or
bun dev
```
- [ ] Frontend loads without errors
- [ ] Can navigate to /settings and /admin

## ✅ Feature Verification

### For Regular Users:
1. [ ] Go to Settings → Features
2. [ ] See "KrovAI Image Generator" toggle
3. [ ] Toggle ON → See daily limit info
   - [ ] Shows "0 / 5" count
   - [ ] Shows progress bar
   - [ ] Shows "5 remaining"
4. [ ] Generate 5 images
5. [ ] 6th attempt should fail with "Daily limit reached"
6. [ ] Error shows reset time (next midnight)

### For Admins:
1. [ ] Go to Admin Dashboard
2. [ ] Click "Settings" tab
3. [ ] Scroll to "KrovAI Image Generator" card
4. [ ] See toggle for Enable/Disable
5. [ ] See daily limit input (default: 5)
6. [ ] Change limit to 10 and save
7. [ ] Go to Overview tab
8. [ ] See "Today's AI Generations" stats
9. [ ] See "Daily Limit Status" card
10. [ ] See "AI Generator Status" card

## ✅ Database Verification

### Check the migration was successful:
```bash
cd backend
npx prisma db push  # If using existing DB
# or
npx prisma migrate status  # Check migration status
```

### Connect to database and verify:
```sql
-- Check if table exists
SELECT * FROM information_schema.tables 
WHERE table_name = 'image_generation_daily';

-- Check if constraint exists
SELECT constraint_name FROM information_schema.table_constraints 
WHERE table_name = 'image_generation_daily' 
AND constraint_type = 'UNIQUE';
```

## ✅ API Endpoint Testing

### Test the daily limit check endpoint:
```bash
# Get user's current daily limit status
curl -X GET http://localhost:5000/api/image-generator/daily-limit/check \
  -H "Authorization: Bearer <USER_TOKEN>"

# Expected Response:
{
  "limit": 5,
  "used": 0,
  "remaining": 5,
  "resetTime": "2026-05-20T00:00:00.000Z"
}
```

### Test image generation with rate limiting:
```bash
# First request (should succeed)
curl -X POST http://localhost:5000/api/image-generator/generate \
  -H "Authorization: Bearer <USER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Test image"}'

# After 5 images, next request (should fail with 429)
curl -X POST http://localhost:5000/api/image-generator/generate \
  -H "Authorization: Bearer <USER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Test image"}'

# Expected 429 Response:
{
  "error": "Daily limit reached. You can generate 5 images per day.",
  "limit": 5,
  "used": 5,
  "resetTime": "2026-05-20T00:00:00.000Z"
}
```

### Test admin stats endpoint:
```bash
# Get image generation stats (admin only)
curl -X GET http://localhost:5000/api/image-generator/stats \
  -H "Authorization: Bearer <ADMIN_TOKEN>"

# Expected Response:
{
  "totalGenerations": 25,
  "todayGenerations": 5,
  "topStyles": [...],
  "dailyLimit": 5,
  "isEnabled": true,
  "usersAtLimitToday": 1,
  "uniqueUsersToday": 3,
  "totalDailyUsers": [1, 2, 5],
  "averagePerUser": "1.67"
}
```

## ✅ Admin Settings Configuration

### Initial System Settings (Auto-created on first request):
```
key: "image_generator_enabled"
value: "true"

key: "image_generation_daily_limit"
value: "5"
```

### To Change Settings via Admin Dashboard:
1. Go to Admin Dashboard → Settings
2. Find "KrovAI Image Generator" section
3. Toggle Enable/Disable
4. Set Daily Limit (1-100)
5. Click "Update Image Generator Settings"

### To Change Settings via API:
```bash
curl -X POST http://localhost:5000/api/admin/settings \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "settings": {
      "image_generator_enabled": "false",
      "image_generation_daily_limit": "10"
    }
  }'
```

## ✅ Troubleshooting

### Issue: Daily limit not working
- [ ] Verify `ImageGenerationDaily` table exists
- [ ] Check if `image_generation_daily_limit` setting exists in system_settings
- [ ] Restart backend service
- [ ] Check server logs for errors

### Issue: Admin settings not showing image generator settings
- [ ] Verify user has admin role
- [ ] Check admin permissions include "settings"
- [ ] Refresh the admin dashboard
- [ ] Clear browser cache

### Issue: User settings not showing daily limit
- [ ] Verify `getDailyGenerationLimit` API is called
- [ ] Check browser console for API errors
- [ ] Verify user is authenticated
- [ ] Check network tab for 401/403 responses

### Issue: Daily limit resets at wrong time
- [ ] Verify server timezone is set correctly
- [ ] Check database timezone settings
- [ ] Ensure `date` field in `ImageGenerationDaily` is using UTC

## ✅ Monitoring

### Things to Monitor:
1. [ ] Daily generation volume (check Admin Dashboard)
2. [ ] Users hitting the daily limit
3. [ ] Average generations per user
4. [ ] Feature enable/disable status

### Logs to Check:
```bash
# Backend logs
tail -f backend/logs/server.log

# Check for rate limit messages
grep -i "limit" backend/logs/server.log

# Check for errors
grep -i "error" backend/logs/server.log
```

## ✅ Post-Deployment

### Notify Users:
- [ ] Send notification about daily 5-image limit
- [ ] Explain how to check remaining generations
- [ ] Provide info about premium/verification tiers (if applicable)

### Monitor Feedback:
- [ ] Track user complaints about limit
- [ ] Monitor admin dashboard for patterns
- [ ] Adjust limit if needed

### Optional Enhancements:
- [ ] Add tier-based limits (verified users get more)
- [ ] Add user notifications at 80% usage
- [ ] Create analytics dashboard
- [ ] Implement cost-based system

## 🎉 Completion

All items checked? Your KrovAI rate limiting feature is live!

If any issues arise:
1. Check error logs
2. Review this checklist
3. Verify database migrations
4. Restart services and try again
