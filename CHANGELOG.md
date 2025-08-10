# Changelog

All notable changes to TickrTime will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.1] - 2025-08-10

### Added
- 🛠️ **Local Development Configuration** - Added `wrangler.toml` with proper Node.js compatibility flags
- 🚀 **Local Development Environment** - Enable local testing of Next.js app with Wrangler
- 🔧 **Development Workflow** - Test changes locally before deployment

### Fixed
- 🐛 **Node.js Compatibility Error** - Fixed local development server startup issues
- ⚡ **Local API Testing** - All API endpoints now work in local development environment
- 🔄 **Environment Variable Loading** - Proper local environment variable configuration

### Technical Improvements
- **Wrangler Configuration**: Added `nodejs_compat` compatibility flag for Next.js support
- **Local Development**: Configured local environment variable loading with `.env.local`
- **Development Experience**: Real-time error tracking and debugging in local environment
- **Consistent Environment**: Local development now matches production setup

## [1.2.0] - 2025-08-10

### Fixed
- 🔧 **Cloudflare Pages Deployment** - Fixed environment variable access in edge functions
- 🌐 **Production Environment** - Successfully deployed to Cloudflare Pages production
- ⚡ **API Functionality** - All API endpoints now working with proper environment variables
- 🚀 **Live Deployment** - App now accessible at https://main.tickrtime.pages.dev

### Technical Improvements
- **Edge Function Compatibility** - Moved environment variable access inside function scope
- **Production Environment Variables** - Properly configured for Cloudflare Pages
- **Build Optimization** - Streamlined deployment process for Cloudflare Pages

## [1.0.0] - 2025-08-09

### Added
- 🎉 **Initial Release** - Complete earnings tracking dashboard
- 📊 **Real-time Earnings Data** - Integration with Finnhub API for 2,246+ tech companies
- 🎯 **Multiple Time Periods** - Today, Tomorrow, Next 30 Days, Previous 30 Days
- 🔍 **Advanced Search** - Filter by ticker symbol, year, and quarter
- ⭐ **Watchlist Functionality** - Persistent watchlist with localStorage
- 🎨 **Beautiful UI** - Figma-inspired design with smooth animations
- 🌓 **Dark/Light Mode** - System preference detection and manual toggle
- 📱 **Responsive Design** - Optimized for desktop, tablet, and mobile
- 🎯 **Interactive Table** - Sortable columns, hover effects, floating action panels
- 🔔 **Toast Notifications** - User feedback for all actions
- ⚡ **Edge Runtime** - Optimized for Cloudflare Pages deployment
- 🛡️ **TypeScript** - Full type safety and excellent developer experience
- 🎭 **Accessibility** - ARIA labels, keyboard navigation, screen reader support

### Technical Features
- **Next.js 15** with App Router
- **shadcn/ui** component library
- **Tailwind CSS** for styling
- **Real API Integration** with comprehensive error handling
- **Persistent Data** with localStorage for watchlist
- **Performance Optimized** with Edge Runtime
- **Production Ready** with proper build configuration

### API Endpoints
- `GET /api/earnings-today` - Today's tech earnings
- `GET /api/earnings-tomorrow` - Tomorrow's tech earnings  
- `GET /api/earnings-next-30-days` - Upcoming 30 days earnings
- `GET /api/earnings-previous-30-days` - Historical 30 days earnings
- `GET /api/earnings?symbol=TICKER&year=YYYY&quarter=Q` - Custom search

### Data Sources
- **Finnhub API** for real-time earnings data
- **Tech Tickers Database** - Curated list of 2,246 technology companies
- **NASDAQ & NYSE** - Complete coverage of major exchanges
