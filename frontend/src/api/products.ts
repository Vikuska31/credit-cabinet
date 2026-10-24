import { fetchApi } from './client';
import type { Product } from '../types';

export async function getProducts(): Promise<Product[]> {
  return fetchApi<Product[]>('/products');
}