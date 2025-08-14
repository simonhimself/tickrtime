/**
 * @jest-environment node
 */

// Mock fetch first
global.fetch = jest.fn()

// Mock environment variable at the top level
const mockEnv = {
  FINNHUB_API_KEY: 'test-api-key'
}

jest.mock('process', () => ({
  ...jest.requireActual('process'),
  env: {
    ...jest.requireActual('process').env,
    ...mockEnv
  }
}))

import { GET } from '../route'
import { NextRequest } from 'next/server'

describe('/api/earnings', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(global.fetch as jest.Mock).mockClear()
  })

  it('should return 500 when FINNHUB_API_KEY is not set', async () => {
    // Temporarily mock empty env
    const originalGetEnv = jest.requireActual('process').env
    jest.doMock('process', () => ({
      ...jest.requireActual('process'),
      env: {
        ...originalGetEnv,
        FINNHUB_API_KEY: undefined
      }
    }))

    // Re-import to get the mocked version
    const { GET: MockedGET } = await import('../route')
    
    const req = new NextRequest('http://localhost:3000/api/earnings?symbol=AAPL')
    const response = await MockedGET(req)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data).toEqual({ error: 'API configuration error' })
  })

  it('should return 400 when symbol parameter is missing', async () => {
    const req = new NextRequest('http://localhost:3000/api/earnings')
    const response = await GET(req)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data).toEqual({ error: 'Missing symbol parameter' })
  })

  it('should fetch earnings data for a symbol', async () => {
    const mockEarningsData = {
      earningsCalendar: [
        {
          symbol: 'AAPL',
          date: '2024-01-25',
          epsActual: 2.18,
          epsEstimate: 2.10,
          hour: 'amc',
          quarter: 1,
          year: 2024,
        },
      ],
    }

    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockEarningsData,
    })

    const req = new NextRequest('http://localhost:3000/api/earnings?symbol=AAPL')
    const response = await GET(req)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({
      earnings: [
        {
          symbol: 'AAPL',
          date: '2024-01-25',
          actual: 2.18,
          estimate: 2.10,
          surprise: 0.08,
          surprisePercent: 3.8095238095238093,
          hour: 'amc',
          quarter: 1,
          year: 2024,
        },
      ],
      totalFound: 1,
    })

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('https://finnhub.io/api/v1/calendar/earnings?symbol=AAPL&token=test-api-key')
    )
  })

  it('should handle year and quarter parameters', async () => {
    const mockEarningsData = {
      earningsCalendar: [],
    }

    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockEarningsData,
    })

    const req = new NextRequest('http://localhost:3000/api/earnings?symbol=AAPL&year=2024&quarter=2')
    const response = await GET(req)

    expect(response.status).toBe(200)
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('from=2024-04-01&to=2024-06-30')
    )
  })

  it('should handle year parameter without quarter', async () => {
    const mockEarningsData = {
      earningsCalendar: [],
    }

    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockEarningsData,
    })

    const req = new NextRequest('http://localhost:3000/api/earnings?symbol=AAPL&year=2024')
    const response = await GET(req)

    expect(response.status).toBe(200)
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('from=2024-01-01&to=2024-12-31')
    )
  })

  it('should handle null EPS values gracefully', async () => {
    const mockEarningsData = {
      earningsCalendar: [
        {
          symbol: 'AAPL',
          date: '2024-01-25',
          epsActual: null,
          epsEstimate: 2.10,
          hour: 'amc',
          quarter: 1,
          year: 2024,
        },
      ],
    }

    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockEarningsData,
    })

    const req = new NextRequest('http://localhost:3000/api/earnings?symbol=AAPL')
    const response = await GET(req)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.earnings[0]).toEqual({
      symbol: 'AAPL',
      date: '2024-01-25',
      actual: null,
      estimate: 2.10,
      surprise: null,
      surprisePercent: null,
      hour: 'amc',
      quarter: 1,
      year: 2024,
    })
  })

  it('should handle Finnhub API errors', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
    })

    const req = new NextRequest('http://localhost:3000/api/earnings?symbol=AAPL')
    const response = await GET(req)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data).toEqual({ error: 'Failed to fetch from Finnhub' })
  })

  it('should handle network errors', async () => {
    ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'))

    const req = new NextRequest('http://localhost:3000/api/earnings?symbol=AAPL')
    const response = await GET(req)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data).toEqual({ error: 'Internal server error' })
  })
})