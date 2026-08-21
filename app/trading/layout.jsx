export const metadata = {
  title: 'Trading',
  description: 'The fictional MM3 exchange terminal. Convert mined MM3 tokens to in-game EUR, USD or CNY. Commission affected by macro indicators and the hourly Dice.',
  openGraph: {
    title: 'Trading · MathsMine3',
    description: 'Fictional MM3 exchange: sell mined tokens for in-game fiat across EUR, USD, CNY.',
    url: 'https://mathsmine3.xyz/trading',
  },
  alternates: { canonical: '/trading' },
};
export default function TradingLayout({ children }) { return children; }
