// backend/src/utils/concurrency.ts

/**
 * Simple concurrency limiter for controlling parallel execution
 * @param items Array of items to process
 * @param concurrency Maximum number of concurrent operations
 * @param fn Function to apply to each item
 * @returns Promise that resolves to array of results
 */
export async function limitConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  const chunks = [];
  
  // Split items into chunks based on concurrency limit
  for (let i = 0; i < items.length; i += concurrency) {
    chunks.push(items.slice(i, i + concurrency));
  }
  
  // Process chunks sequentially, but items within each chunk concurrently
  for (const chunk of chunks) {
    const chunkResults = await Promise.all(chunk.map(fn));
    results.push(...chunkResults);
  }
  
  return results;
}

/**
 * Alternative: Use p-limit if you prefer a more robust solution
 * npm install p-limit
 * 
 * import pLimit from 'p-limit';
 * 
 * export async function limitConcurrencyWithPLimit<T, R>(
 *   items: T[],
 *   concurrency: number,
 *   fn: (item: T) => Promise<R>
 * ): Promise<R[]> {
 *   const limit = pLimit(concurrency);
 *   return Promise.all(items.map(item => limit(() => fn(item))));
 * }
 */
