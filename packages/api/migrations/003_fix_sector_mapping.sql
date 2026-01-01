-- Fix sector mapping for 2,266 tickers that have valid industries but sector = 'Other'
-- These industries are in SECTOR_MAPPING but the database wasn't properly updated

-- Financials
UPDATE tickers SET sector = 'Financials' WHERE industry = 'Banking';

-- Healthcare
UPDATE tickers SET sector = 'Healthcare' WHERE industry = 'Health Care';
UPDATE tickers SET sector = 'Healthcare' WHERE industry = 'Life Sciences Tools & Services';

-- Technology
UPDATE tickers SET sector = 'Technology' WHERE industry = 'Electrical Equipment';

-- Consumer
UPDATE tickers SET sector = 'Consumer' WHERE industry = 'Hotels, Restaurants & Leisure';
UPDATE tickers SET sector = 'Consumer' WHERE industry = 'Consumer products';
UPDATE tickers SET sector = 'Consumer' WHERE industry = 'Diversified Consumer Services';
UPDATE tickers SET sector = 'Consumer' WHERE industry = 'Textiles, Apparel & Luxury Goods';
UPDATE tickers SET sector = 'Consumer' WHERE industry = 'Auto Components';
UPDATE tickers SET sector = 'Consumer' WHERE industry = 'Automobiles';
UPDATE tickers SET sector = 'Consumer' WHERE industry = 'Leisure Products';
UPDATE tickers SET sector = 'Consumer' WHERE industry = 'Distributors';

-- Industrials
UPDATE tickers SET sector = 'Industrials' WHERE industry = 'Machinery';
UPDATE tickers SET sector = 'Industrials' WHERE industry = 'Professional Services';
UPDATE tickers SET sector = 'Industrials' WHERE industry = 'Commercial Services & Supplies';
UPDATE tickers SET sector = 'Industrials' WHERE industry = 'Trading Companies & Distributors';
UPDATE tickers SET sector = 'Industrials' WHERE industry = 'Marine';
UPDATE tickers SET sector = 'Industrials' WHERE industry = 'Road & Rail';
UPDATE tickers SET sector = 'Industrials' WHERE industry = 'Building';
UPDATE tickers SET sector = 'Industrials' WHERE industry = 'Packaging';
UPDATE tickers SET sector = 'Industrials' WHERE industry = 'Logistics & Transportation';
UPDATE tickers SET sector = 'Industrials' WHERE industry = 'Transportation Infrastructure';
UPDATE tickers SET sector = 'Industrials' WHERE industry = 'Industrial Conglomerates';

-- Materials
UPDATE tickers SET sector = 'Materials' WHERE industry = 'Metals & Mining';
UPDATE tickers SET sector = 'Materials' WHERE industry = 'Paper & Forest';

-- Communication
UPDATE tickers SET sector = 'Communication' WHERE industry = 'Telecommunication';
UPDATE tickers SET sector = 'Communication' WHERE industry = 'Communications';
