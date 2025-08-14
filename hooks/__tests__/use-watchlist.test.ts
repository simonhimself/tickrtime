import { renderHook, act, waitFor } from '@testing-library/react'
import { useWatchlist } from '../use-watchlist'
import { toast } from 'sonner'

// Mock sonner toast
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}))

// Mock fetch
global.fetch = jest.fn()

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
  }
})()

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
})

describe('useWatchlist', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    localStorageMock.clear()
    ;(global.fetch as jest.Mock).mockClear()
  })

  it('initializes with empty watchlist when no auth token', () => {
    const { result } = renderHook(() => useWatchlist())

    expect(result.current.watchlist.tickers).toEqual([])
    expect(result.current.count).toBe(0)
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('loads watchlist when auth token exists', async () => {
    const mockToken = 'test-auth-token'
    const mockWatchlist = {
      tickers: [
        { symbol: 'AAPL', addedAt: '2024-01-01' },
        { symbol: 'GOOGL', addedAt: '2024-01-02' },
      ],
      lastUpdated: '2024-01-02',
    }

    localStorageMock.setItem('tickrtime-auth-token', mockToken)
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, watchlist: mockWatchlist }),
    })

    const { result } = renderHook(() => useWatchlist())

    await waitFor(() => {
      expect(result.current.watchlist.tickers).toHaveLength(2)
    })

    expect(global.fetch).toHaveBeenCalledWith('/api/watchlist', {
      headers: {
        'Authorization': `Bearer ${mockToken}`,
        'Content-Type': 'application/json',
      },
    })
    expect(result.current.count).toBe(2)
  })

  it('handles authentication errors when loading watchlist', async () => {
    const mockToken = 'expired-token'
    localStorageMock.setItem('tickrtime-auth-token', mockToken)
    
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 401,
    })

    const { result } = renderHook(() => useWatchlist())

    await waitFor(() => {
      expect(result.current.error).toBe('Authentication required')
    })

    expect(localStorageMock.getItem('tickrtime-auth-token')).toBeNull()
  })

  it('adds ticker to watchlist successfully', async () => {
    const mockToken = 'test-auth-token'
    localStorageMock.setItem('tickrtime-auth-token', mockToken)
    
    const initialWatchlist = {
      tickers: [],
      lastUpdated: '2024-01-01',
    }
    
    const updatedWatchlist = {
      tickers: [{ symbol: 'AAPL', addedAt: '2024-01-01' }],
      lastUpdated: '2024-01-01',
    }

    // Mock initial load
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, watchlist: initialWatchlist }),
    })

    const { result } = renderHook(() => useWatchlist())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    // Mock add to watchlist
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, watchlist: updatedWatchlist }),
    })

    let addResult: boolean = false
    await act(async () => {
      addResult = await result.current.addToWatchlist('AAPL')
    })

    expect(addResult).toBe(true)
    expect(result.current.watchlist.tickers).toHaveLength(1)
    expect(result.current.isInWatchlist('AAPL')).toBe(true)
    expect(toast.success).toHaveBeenCalledWith('AAPL added to watchlist')
  })

  it('prevents adding duplicate tickers', async () => {
    const mockToken = 'test-auth-token'
    localStorageMock.setItem('tickrtime-auth-token', mockToken)
    
    const watchlist = {
      tickers: [{ symbol: 'AAPL', addedAt: '2024-01-01' }],
      lastUpdated: '2024-01-01',
    }

    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, watchlist }),
    })

    const { result } = renderHook(() => useWatchlist())

    await waitFor(() => {
      expect(result.current.watchlist.tickers).toHaveLength(1)
    })

    let addResult: boolean = false
    await act(async () => {
      addResult = await result.current.addToWatchlist('AAPL')
    })

    expect(addResult).toBe(true)
    // Fetch should not have been called again since ticker already exists
    expect(global.fetch).toHaveBeenCalledTimes(1) // Only initial load
  })

  it('removes ticker from watchlist successfully', async () => {
    const mockToken = 'test-auth-token'
    localStorageMock.setItem('tickrtime-auth-token', mockToken)
    
    const initialWatchlist = {
      tickers: [{ symbol: 'AAPL', addedAt: '2024-01-01' }],
      lastUpdated: '2024-01-01',
    }
    
    const updatedWatchlist = {
      tickers: [],
      lastUpdated: '2024-01-01',
    }

    // Mock initial load
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, watchlist: initialWatchlist }),
    })

    const { result } = renderHook(() => useWatchlist())

    await waitFor(() => {
      expect(result.current.watchlist.tickers).toHaveLength(1)
    })

    // Mock remove from watchlist
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, watchlist: updatedWatchlist }),
    })

    let removeResult: boolean = false
    await act(async () => {
      removeResult = await result.current.removeFromWatchlist('AAPL')
    })

    expect(removeResult).toBe(true)
    expect(result.current.watchlist.tickers).toHaveLength(0)
    expect(result.current.isInWatchlist('AAPL')).toBe(false)
    expect(toast.success).toHaveBeenCalledWith('AAPL removed from watchlist')
  })

  it('toggles watchlist correctly', async () => {
    const mockToken = 'test-auth-token'
    localStorageMock.setItem('tickrtime-auth-token', mockToken)
    
    const initialWatchlist = {
      tickers: [{ symbol: 'AAPL', addedAt: '2024-01-01' }],
      lastUpdated: '2024-01-01',
    }

    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, watchlist: initialWatchlist }),
    })

    const { result } = renderHook(() => useWatchlist())

    await waitFor(() => {
      expect(result.current.isInWatchlist('AAPL')).toBe(true)
    })

    // Mock remove
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, watchlist: { tickers: [], lastUpdated: '2024-01-01' } }),
    })

    await act(async () => {
      await result.current.toggleWatchlist('AAPL')
    })

    expect(result.current.isInWatchlist('AAPL')).toBe(false)

    // Mock add
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, watchlist: initialWatchlist }),
    })

    await act(async () => {
      await result.current.toggleWatchlist('AAPL')
    })

    expect(result.current.isInWatchlist('AAPL')).toBe(true)
  })

  it('shows error when trying to add without auth token', async () => {
    const { result } = renderHook(() => useWatchlist())

    let addResult: boolean = false
    await act(async () => {
      addResult = await result.current.addToWatchlist('AAPL')
    })

    expect(addResult).toBe(false)
    expect(toast.error).toHaveBeenCalledWith('Please log in to save watchlist items')
  })

  it('handles auth state changes', async () => {
    const { result } = renderHook(() => useWatchlist())

    // Simulate login event
    const loginEvent = new CustomEvent('authStateChanged', {
      detail: { action: 'login' },
    })

    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ 
        success: true, 
        watchlist: { 
          tickers: [{ symbol: 'AAPL', addedAt: '2024-01-01' }], 
          lastUpdated: '2024-01-01' 
        } 
      }),
    })

    localStorageMock.setItem('tickrtime-auth-token', 'new-token')

    act(() => {
      window.dispatchEvent(loginEvent)
    })

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled()
    })

    // Simulate logout event
    const logoutEvent = new CustomEvent('authStateChanged', {
      detail: { action: 'logout' },
    })

    act(() => {
      window.dispatchEvent(logoutEvent)
    })

    expect(result.current.watchlist.tickers).toHaveLength(0)
  })

  it('getWatchedSymbols returns array of symbols', async () => {
    const mockToken = 'test-auth-token'
    localStorageMock.setItem('tickrtime-auth-token', mockToken)
    
    const watchlist = {
      tickers: [
        { symbol: 'AAPL', addedAt: '2024-01-01' },
        { symbol: 'GOOGL', addedAt: '2024-01-02' },
        { symbol: 'MSFT', addedAt: '2024-01-03' },
      ],
      lastUpdated: '2024-01-03',
    }

    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, watchlist }),
    })

    const { result } = renderHook(() => useWatchlist())

    await waitFor(() => {
      expect(result.current.count).toBe(3)
    })

    const symbols = result.current.getWatchedSymbols()
    expect(symbols).toEqual(['AAPL', 'GOOGL', 'MSFT'])
  })
})