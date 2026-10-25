import type { Product } from '../types';

/**
 * Временная заглушка. Каталог продуктов реализуется 
 * через /api/goals и /api/tariff. Пока возвращаем пустой массив, 
 * чтобы фронтенд использовал моковые данные.
 */
export async function getProducts(): Promise<Product[]> {
  return Promise.resolve([]);
}