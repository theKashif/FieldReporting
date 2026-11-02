import { Request, Response, NextFunction } from 'express';

export type ChaosMode = 'none' | 'error' | 'delay' | 'drop' | 'rate_limit';

export interface ChaosConfig {
  mode: ChaosMode;
  status: number;
  delayMs: number;
  message: string;
}

const currentConfig: ChaosConfig = {
  mode: 'none',
  status: 500,
  delayMs: 10000,
  message: 'Simulated backend failure',
};

export function getChaosConfig(): ChaosConfig {
  return { ...currentConfig };
}

export function setChaosConfig(newConfig: Partial<ChaosConfig>): ChaosConfig {
  if (newConfig.mode) currentConfig.mode = newConfig.mode;
  if (newConfig.status) currentConfig.status = Number(newConfig.status);
  if (newConfig.delayMs) currentConfig.delayMs = Number(newConfig.delayMs);
  if (newConfig.message) currentConfig.message = String(newConfig.message);
  return getChaosConfig();
}

export function resetChaosConfig(): ChaosConfig {
  currentConfig.mode = 'none';
  currentConfig.status = 500;
  currentConfig.delayMs = 10000;
  currentConfig.message = 'Simulated backend failure';
  return getChaosConfig();
}

export function chaosMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  // Never disrupt health or chaos management endpoints.
  if (req.path.startsWith('/api/chaos') || req.path === '/health') {
    return next();
  }

  // 1. Check for request-specific headers (allows per-request testing)
  const headerStatus = req.headers['x-chaos-status'];
  const headerDelay = req.headers['x-chaos-delay'];
  const headerDrop = req.headers['x-chaos-drop'];

  if (headerDrop === 'true' || headerDrop === '1') {
    console.log('[CHAOS] Abruptly destroying socket connection:', req.url);
    req.socket.destroy();
    return;
  }

  if (headerDelay) {
    const delay = Number(headerDelay) || 5000;
    console.log(`[CHAOS] Injecting header-based delay of ${delay}ms:`, req.url);
    setTimeout(() => {
      if (headerStatus) {
        const status = Number(headerStatus);
        res.status(status).json({ message: `[CHAOS] Simulated failure (${status})` });
        return;
      }
      next();
    }, delay);
    return;
  }

  if (headerStatus) {
    const status = Number(headerStatus);
    console.log(`[CHAOS] Injecting header-based status ${status}:`, req.url);
    res.status(status).json({ message: `[CHAOS] Simulated failure (${status})` });
    return;
  }

  // 2. Check global server chaos mode
  switch (currentConfig.mode) {
    case 'drop':
      console.log('[CHAOS] Dropping connection as per active chaos mode');
      req.socket.destroy();
      return;


    case 'error':
      console.log(`[CHAOS] Returning ${currentConfig.status} error:`, currentConfig.message);
      res.status(currentConfig.status).json({
        message: currentConfig.message || 'Simulated internal server error.',
      });
      return;

    case 'rate_limit':
      console.log('[CHAOS] Returning 429 Too Many Requests');
      res.status(429).json({
        message: 'Too many requests. Please slow down.',
      });
      return;

    case 'delay':
      console.log(`[CHAOS] Delaying request by ${currentConfig.delayMs}ms`);
      setTimeout(() => {
        next();
      }, currentConfig.delayMs);
      return;

    case 'none':
    default:
      next();
  }
}

