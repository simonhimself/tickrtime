# Contributing to TickrTime

Thank you for your interest in contributing to TickrTime! This document provides guidelines for contributing to the project.

## Getting Started

### Prerequisites
- Node.js 18+ 
- npm/yarn/pnpm
- Finnhub API key (get one at [finnhub.io](https://finnhub.io))

### Development Setup

1. Fork and clone the repository:
   ```bash
   git clone https://github.com/your-username/tickrtime.git
   cd tickrtime
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env.local
   # Add your Finnhub API key to .env.local
   ```

4. Run the development server:
   ```bash
   npm run dev
   ```

## Development Guidelines

### Code Style
- Use TypeScript for all new code
- Follow the existing ESLint configuration
- Use Prettier for code formatting
- Follow the established component patterns

### Commit Convention
We use [Conventional Commits](https://conventionalcommits.org/):

- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, etc.)
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

Example: `feat: add earnings alert notifications`

### Pull Request Process

1. Create a feature branch from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes and commit with conventional commit messages

3. Ensure all tests pass and there are no linting errors:
   ```bash
   npm run lint
   npm run type-check
   ```

4. Push your branch and create a Pull Request

5. Provide a clear description of your changes and any relevant context

## Project Structure

```
tickrtime/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   └── ...
├── components/            # React components
│   ├── ui/               # shadcn/ui components
│   └── ...
├── hooks/                # Custom React hooks
├── lib/                  # Utilities and configurations
├── types/                # TypeScript type definitions
└── data/                 # Static data files
```

## Areas for Contribution

### High Priority
- Performance optimizations
- Additional data visualizations
- Mobile experience improvements
- Accessibility enhancements

### Features
- Email/SMS alerts for earnings
- Portfolio integration
- Historical earnings analysis
- Earnings call transcripts
- Social sentiment analysis

### Technical Improvements
- Caching strategies
- Database integration
- Real-time updates
- PWA features

## Bug Reports

When reporting bugs, please include:
- Steps to reproduce
- Expected behavior
- Actual behavior
- Browser/environment details
- Screenshots if applicable

## Feature Requests

For feature requests, please provide:
- Clear description of the feature
- Use case and benefits
- Any implementation ideas
- Mockups or examples if applicable

## Questions?

Feel free to open an issue for any questions about contributing or the codebase.

Thank you for helping make TickrTime better! 🚀
