/** Storage is stored in GB where 1TB = 1024GB. */
export const formatStorage = (gb: number): string => (gb >= 1024 ? `${gb / 1024}TB` : `${gb}GB`);

export const formatRange = (range: [number, number] | null, fmt: (n: number) => string): string =>
  !range ? 'n/a' : range[0] === range[1] ? fmt(range[0]) : `${fmt(range[0])} to ${fmt(range[1])}`;

export const formatMoney = (amount: number, currency: string): string =>
  new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', { style: 'currency', currency, minimumFractionDigits: Number.isInteger(amount) ? 0 : 2, maximumFractionDigits: 2 }).format(amount);
