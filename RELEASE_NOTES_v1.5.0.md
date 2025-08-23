# Release Notes - v1.5.0

## 🎉 New Features

### User Avatar & Profile System
- **User Avatar Dropdown**: Implemented a sophisticated user avatar component that generates initials from email addresses
  - Smart initial generation (e.g., "john.doe@" → "JD", "test@" → "TE")
  - Clean dropdown menu with Profile and Log out options
  - Consistent blue theme matching the brand identity

### Comprehensive Profile Page
- **Account Management**: New `/profile` page for managing user settings
  - View account email (read-only)
  - Set display name
  - Change password functionality (UI ready, backend integration pending)
  
- **User Preferences**: Customizable app behavior
  - Default time period (Today, Tomorrow, Next 30 Days, Previous 30 Days)
  - Timezone selection for earnings times display
  - Data display toggles (Show/Hide Estimates, Surprises, Exchange)
  - Preferences saved to localStorage for persistence

- **Account Actions**: 
  - Account deletion with confirmation dialog
  - Clean navigation back to dashboard

## 🐛 Bug Fixes

### Authentication in Edge Environment
- **Fixed Profile Page Authentication**: Resolved critical issue where Profile page would log users out on Cloudflare deployment
  - Created `/api/auth/me` endpoint for server-side JWT verification
  - Updated Profile page to use API endpoint instead of direct JWT verification
  - Updated Header component authentication check to use API endpoint
  - Ensures proper authentication flow in both local and Cloudflare Edge environments

## 🔧 Technical Improvements

- **Component Architecture**: 
  - Added `AlertDialog` UI component for destructive actions
  - Improved separation of concerns between client and server code
  - Better error handling for authentication flows

- **User Experience**:
  - Smooth transitions between logged in/out states
  - Responsive design for all new components
  - Consistent styling with existing UI patterns

## 📦 Dependencies

No new dependencies added - all features built with existing libraries.

## 🚀 Deployment Notes

- Fully compatible with Cloudflare Pages Edge Runtime
- No environment variable changes required
- Backward compatible with existing user sessions

## 🔮 Future Enhancements

This release lays the foundation for:
- Email notification system (coming in v1.6.0)
- Extended user profile features
- Advanced preference management
- Subscription/billing integration

## Contributors

- Simon Peterhans (@simonhimself)

---

**Full Changelog**: https://github.com/simonhimself/tickrtime/compare/v1.4.0...v1.5.0