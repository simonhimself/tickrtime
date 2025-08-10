# TickrTime

> Never miss earnings again

A modern, responsive earnings tracking dashboard for technology stocks built with Next.js, TypeScript, and Tailwind CSS.

## Features

- 📊 **Real-time Earnings Data** - Live data from Finnhub API for 2,246+ tech companies
- 🎯 **Smart Filtering** - Filter by time periods, search by ticker, year, and quarter
- ⭐ **Watchlist** - Persistent watchlist with localStorage
- 🌓 **Dark/Light Mode** - Beautiful theming support
- 📱 **Responsive Design** - Optimized for desktop, tablet, and mobile
- ⚡ **Fast Performance** - Edge runtime and efficient data caching
- 🎨 **Modern UI** - Clean, accessible design with smooth animations

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui
- **Data Source**: Finnhub API
- **Deployment**: Cloudflare Pages (Edge Runtime)

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm/yarn/pnpm
- Finnhub API key (get one at [finnhub.io](https://finnhub.io))

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd tickrtime
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env.local
   ```
   
   Add your API keys to `.env.local`:
   ```env
   FINNHUB_API_KEY=your_finnhub_api_key_here
   RESEND_API_KEY=your_resend_api_key_here
   ```

4. Run the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
tickrtime/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   │   ├── earnings/      # Main earnings endpoint
│   │   ├── earnings-today/ # Today's earnings
│   │   └── ...            # Other time-based endpoints
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Home page
├── components/            # React components
│   ├── ui/               # shadcn/ui components
│   ├── EarningsTable.tsx # Main data table
│   ├── Header.tsx        # App header
│   └── ...               # Other components
├── hooks/                # Custom React hooks
├── lib/                  # Utilities and configurations
├── data/                 # Static data files
│   └── tech_tickers.json # Tech company database
└── scripts/              # Build and utility scripts
```

## API Endpoints

- `GET /api/earnings-today` - Today's earnings
- `GET /api/earnings-tomorrow` - Tomorrow's earnings  
- `GET /api/earnings-next-30-days` - Upcoming 30 days
- `GET /api/earnings-previous-30-days` - Previous 30 days
- `GET /api/earnings?symbol=AAPL&year=2024&quarter=1` - Custom search

## Development

### Building Tech Universe

To update the tech companies database:

```bash
npm run build:tech-universe
```

This script fetches all NASDAQ and NYSE companies and filters for technology companies using the Finnhub API.

### Code Quality

- **TypeScript**: Strict type checking enabled
- **ESLint**: Code linting with Next.js rules
- **Prettier**: Code formatting (recommended)
- **Husky**: Git hooks for quality checks (optional)

## Deployment

The app is optimized for Cloudflare Pages with Edge Runtime:

1. Build the application:
   ```bash
   npm run build
   ```

2. Deploy to Cloudflare Pages or your preferred platform.

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `FINNHUB_API_KEY` | Finnhub API key for earnings data | Yes |
| `RESEND_API_KEY` | Resend API key for email verification | Yes |
| `NODE_ENV` | Environment (development/production) | Auto-set |

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Finnhub](https://finnhub.io) for providing financial data
- [shadcn/ui](https://ui.shadcn.com) for the beautiful component library
- [Lucide React](https://lucide.dev) for icons
