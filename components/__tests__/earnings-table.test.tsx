import React from 'react'
import { render, screen } from '@testing-library/react'
import { EarningsTable } from '../earnings-table'
import type { EarningsData } from '@/types'

// Mock the hooks
jest.mock('@/hooks/use-table-hover', () => ({
  useTableHover: () => ({
    hoveredRow: null,
    iconPosition: 0,
    rowRefs: { current: {} },
    tableHeaderRef: { current: null },
    handleRowHover: jest.fn(),
    handleHoverEnd: jest.fn(),
    handleIconAreaHover: jest.fn(),
    handleIconAreaLeave: jest.fn(),
    shouldShowIcons: false,
    ICON_VERTICAL_OFFSET: 30,
  }),
}))

jest.mock('@/hooks/use-table-sort', () => ({
  useTableSort: (data: EarningsData[]) => ({
    sortedData: data,
    sortState: { field: null, direction: null },
    handleSort: jest.fn(),
    getSortIcon: () => null,
    isSortable: () => true,
  }),
}))

describe('EarningsTable', () => {
  const mockData: EarningsData[] = [
    {
      symbol: 'AAPL',
      date: '2024-01-25',
      actual: 2.18,
      estimate: 2.10,
      surprise: 0.08,
      surprisePercent: 3.81,
      hour: 'amc',
      quarter: 1,
      year: 2024,
      exchange: 'NASDAQ',
    },
    {
      symbol: 'GOOGL',
      date: '2024-01-24',
      actual: 1.64,
      estimate: 1.59,
      surprise: 0.05,
      surprisePercent: 3.14,
      hour: 'amc',
      quarter: 1,
      year: 2024,
      exchange: 'NASDAQ',
    },
  ]

  const defaultProps = {
    data: mockData,
    loading: false,
    error: null,
    onRowAction: jest.fn(),
    watchlistedItems: new Set<string>(),
    onToggleWatchlist: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders loading state', () => {
    render(<EarningsTable {...defaultProps} loading={true} />)
    
    // Check for skeleton elements by class name
    const skeletons = document.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('renders error state', () => {
    const errorMessage = 'Failed to fetch earnings data'
    render(<EarningsTable {...defaultProps} error={errorMessage} />)
    
    expect(screen.getByText(errorMessage)).toBeInTheDocument()
  })

  it('renders empty state', () => {
    render(<EarningsTable {...defaultProps} data={[]} />)
    
    expect(screen.getByText('No earnings data found.')).toBeInTheDocument()
  })

  it('renders earnings data correctly', () => {
    render(<EarningsTable {...defaultProps} />)
    
    // Check headers
    expect(screen.getByText('TICKER')).toBeInTheDocument()
    expect(screen.getByText('EXCHANGE')).toBeInTheDocument()
    expect(screen.getByText('EARNINGS DATE')).toBeInTheDocument()
    expect(screen.getByText('ESTIMATE')).toBeInTheDocument()
    expect(screen.getByText('EPS')).toBeInTheDocument()
    expect(screen.getByText('SURPRISE')).toBeInTheDocument()
    
    // Check data rows
    expect(screen.getByText('AAPL')).toBeInTheDocument()
    expect(screen.getByText('GOOGL')).toBeInTheDocument()
    expect(screen.getByText('$2.18')).toBeInTheDocument()
    expect(screen.getByText('$2.10')).toBeInTheDocument()
    // Check for the formatted percentage (3.81 becomes +3.8%)
    expect(screen.getByText('+3.8%')).toBeInTheDocument()
  })

  it('displays watchlisted items with bookmark icon', () => {
    const watchlistedItems = new Set(['AAPL'])
    render(<EarningsTable {...defaultProps} watchlistedItems={watchlistedItems} />)
    
    // Look for the bookmark icon near AAPL
    const aaplRow = screen.getByText('AAPL').closest('[role="row"]')
    expect(aaplRow).toBeInTheDocument()
    
    // Check for bookmark icon within the row
    const bookmarkIcon = aaplRow?.querySelector('[aria-label="In watchlist"]')
    expect(bookmarkIcon).toBeInTheDocument()
  })

  it('handles null values gracefully', () => {
    const dataWithNulls: EarningsData[] = [
      {
        symbol: 'TSLA',
        date: '2024-01-25',
        actual: null,
        estimate: null,
        surprise: null,
        surprisePercent: null,
        hour: 'amc',
        quarter: 1,
        year: 2024,
      },
    ]
    
    render(<EarningsTable {...defaultProps} data={dataWithNulls} />)
    
    expect(screen.getByText('TSLA')).toBeInTheDocument()
    // Check that dashes are shown for null values
    const dashes = screen.getAllByText('-')
    expect(dashes.length).toBeGreaterThan(0)
  })

  it('renders table structure correctly', () => {
    render(<EarningsTable {...defaultProps} />)
    
    // Check for proper table structure
    const rows = screen.getAllByRole('row')
    expect(rows).toHaveLength(3) // header + 2 data rows
    
    const cells = screen.getAllByRole('cell')
    expect(cells).toHaveLength(12) // 2 rows × 6 columns
    
    const columnHeaders = screen.getAllByRole('columnheader')
    expect(columnHeaders).toHaveLength(6)
  })

  it('applies correct CSS classes for styling', () => {
    render(<EarningsTable {...defaultProps} />)
    
    const table = document.querySelector('.bg-card')
    expect(table).toBeInTheDocument()
    expect(table).toHaveClass('rounded-lg', 'shadow-sm', 'border', 'border-border')
  })
})