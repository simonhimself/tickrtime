import fetch from 'node-fetch';

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY || '';
const EXCHANGES = ['NASDAQ', 'NYSE'];

async function getSymbols(exchange: string) {
  const url = `https://finnhub.io/api/v1/stock/symbol?exchange=${exchange}&token=${FINNHUB_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch symbols for ${exchange}: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  return data;
}

(async () => {
  for (const exchange of EXCHANGES) {
    try {
      const symbols = await getSymbols(exchange);
      console.log(`\nExchange: ${exchange}`);
      console.log(`Total symbols: ${symbols.length}`);
      console.log('Sample:', symbols.slice(0, 5));
    } catch (err) {
      console.error(`Error fetching symbols for ${exchange}:`, err);
    }
  }
})(); 