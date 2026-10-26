export function formatRub(amount: number): string {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatMonths(months: number): string {
  const mod10 = months % 10;
  const mod100 = months % 100;
  if (mod10 === 1 && mod100 !== 11) return `${months} месяц`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return `${months} месяца`;
  return `${months} месяцев`;
}

export function getInitials(name?: string): string {
  if (!name) return 'А';
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/** Значение изменённого условия из ответа банка («3000000» → «3 000 000,00 ₽», «24» → «24 месяца»). */
export function formatOfferValue(field: string, value: string): string {
  const number = Number(value);
  if (!Number.isFinite(number)) return value;
  switch (field) {
    case 'amount':
    case 'monthlyPayment':
      return formatRub(number);
    case 'termMonths':
      return formatMonths(number);
    case 'annualRatePercent':
      return `${String(number).replace('.', ',')}%`;
    default:
      return value;
  }
}
