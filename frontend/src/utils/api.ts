
/**
 * Wait for the backend to be ready by polling the health endpoint
 */
export async function waitForBackend(maxAttempts = 30, delayMs = 1000): Promise<boolean> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch('/api/health');
      if (response.ok) {
        const data = await response.json();
        if (data.status === 'ok' && data.database === 'connected') {
          console.log('✅ Backend is ready');
          return true;
        }
      }
    } catch (error) {
      // Silently continue on error
    }
    
    if (attempt < maxAttempts) {
      console.log(`⏳ Waiting for backend... (${attempt}/${maxAttempts})`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  console.error('❌ Backend failed to become ready after maximum attempts');
  return false;
}

/**
 * Check if backend is currently accessible
 */
export async function isBackendAccessible(): Promise<boolean> {
  try {
    const response = await fetch('/api/health');
    if (response.ok) {
      const data = await response.json();
      return data.status === 'ok' && data.database === 'connected';
    }
    return false;
  } catch (error) {
    return false;
  }
}
