/**
 * Rate Limiter for Riot API
 * 
 * Personal API Key limits:
 * - 20 requests every 1 second
 * - 100 requests every 2 minutes
 * 
 * Note: Rate limits are enforced per region
 */

interface RateLimitWindow {
  count: number;
  resetAt: number;
}

class RateLimiter {
  private shortWindow: RateLimitWindow = { count: 0, resetAt: Date.now() + 1000 };
  private longWindow: RateLimitWindow = { count: 0, resetAt: Date.now() + 120000 };
  
  private readonly SHORT_LIMIT = 20; // 20 requests per second
  private readonly LONG_LIMIT = 100; // 100 requests per 2 minutes
  private readonly SHORT_WINDOW_MS = 1000;
  private readonly LONG_WINDOW_MS = 120000;

  /**
   * Wait until we can make a request
   */
  async waitForAvailability(): Promise<void> {
    const now = Date.now();

    // Reset short window if expired
    if (now >= this.shortWindow.resetAt) {
      this.shortWindow = { count: 0, resetAt: now + this.SHORT_WINDOW_MS };
    }

    // Reset long window if expired
    if (now >= this.longWindow.resetAt) {
      this.longWindow = { count: 0, resetAt: now + this.LONG_WINDOW_MS };
    }

    // Check if we need to wait
    const shortWait = this.shortWindow.count >= this.SHORT_LIMIT 
      ? this.shortWindow.resetAt - now 
      : 0;
    
    const longWait = this.longWindow.count >= this.LONG_LIMIT 
      ? this.longWindow.resetAt - now 
      : 0;

    const waitTime = Math.max(shortWait, longWait);

    if (waitTime > 0) {
      console.log(`[RateLimiter] Waiting ${waitTime}ms (short: ${this.shortWindow.count}/${this.SHORT_LIMIT}, long: ${this.longWindow.count}/${this.LONG_LIMIT})`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      
      // Reset windows after waiting
      const newNow = Date.now();
      if (newNow >= this.shortWindow.resetAt) {
        this.shortWindow = { count: 0, resetAt: newNow + this.SHORT_WINDOW_MS };
      }
      if (newNow >= this.longWindow.resetAt) {
        this.longWindow = { count: 0, resetAt: newNow + this.LONG_WINDOW_MS };
      }
    }

    // Increment counters
    this.shortWindow.count++;
    this.longWindow.count++;
  }

  /**
   * Get current rate limit status
   */
  getStatus(): { short: { count: number; limit: number; resetIn: number }; long: { count: number; limit: number; resetIn: number } } {
    const now = Date.now();
    return {
      short: {
        count: this.shortWindow.count,
        limit: this.SHORT_LIMIT,
        resetIn: Math.max(0, this.shortWindow.resetAt - now),
      },
      long: {
        count: this.longWindow.count,
        limit: this.LONG_LIMIT,
        resetIn: Math.max(0, this.longWindow.resetAt - now),
      },
    };
  }

  /**
   * Reset all counters (for testing)
   */
  reset(): void {
    const now = Date.now();
    this.shortWindow = { count: 0, resetAt: now + this.SHORT_WINDOW_MS };
    this.longWindow = { count: 0, resetAt: now + this.LONG_WINDOW_MS };
  }
}

// Singleton instance
export const rateLimiter = new RateLimiter();

