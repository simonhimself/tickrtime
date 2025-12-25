# Fix: "User not found" Error

## Problem

You're getting "User not found" when trying to create an alert. This happens because:

1. **You're using `npm run dev`** - This runs in Edge runtime without D1 database bindings
2. **Your user was created before D1 migration** - Your account exists in KV but not in D1

## Solution

### Step 1: Use Wrangler Dev (Required)

**Stop the current dev server** and use wrangler instead:

```bash
# Stop npm run dev (Ctrl+C)
# Then run:
npx wrangler dev --port 3001
```

This provides D1 database bindings and runs on `http://localhost:3001`

### Step 2: Sign Up Again

Since your account was created before the D1 migration, you need to create a new account:

1. Go to `http://localhost:3001`
2. Click "Sign In" → "Sign up"
3. Create a new account with your email (or use a different email)
4. Try creating an alert again

### Step 3: Verify It Works

After signing up with wrangler dev:
- ✅ User will be created in D1
- ✅ Alerts will work
- ✅ All features will work

## Why This Happened

- **Before**: Users were stored in KV (key-value storage)
- **After**: Users are stored in D1 (SQL database)
- **Your account**: Was created in KV, doesn't exist in D1 yet

## Alternative: Migrate Existing User

If you want to keep your existing account, you can manually migrate it:

1. Get your user data from KV (if still accessible)
2. Insert it into D1 using the migration script
3. Or contact support for help

## Quick Test

After using `wrangler dev` and signing up:

```bash
# Check if user exists in D1
npx wrangler d1 execute tickrtime-db --command="SELECT email FROM users;" --remote=false
```

You should see your new user's email in the results.


