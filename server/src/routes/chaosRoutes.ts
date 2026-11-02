import { Router, Request, Response } from 'express';
import {
  getChaosConfig,
  setChaosConfig,
  resetChaosConfig,
} from '../middleware/chaos';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  res.json({
    chaos: getChaosConfig(),
    supportedModes: ['none', 'error', 'delay', 'drop', 'rate_limit'],
    examplePost: {
      mode: 'error',
      status: 500,
      delayMs: 10000,
      message: 'Database temporarily unavailable',
    },
  });
});

router.post('/', (req: Request, res: Response) => {
  const updated = setChaosConfig(req.body);
  res.json({
    message: `Chaos mode set to: ${updated.mode}`,
    chaos: updated,
  });
});

router.delete('/', (_req: Request, res: Response) => {
  const reset = resetChaosConfig();
  res.json({
    message: 'Chaos mode disabled (normal operation restored).',
    chaos: reset,
  });
});

router.post('/reset', (_req: Request, res: Response) => {
  const reset = resetChaosConfig();
  res.json({
    message: 'Chaos mode disabled (normal operation restored).',
    chaos: reset,
  });
});

export default router;

