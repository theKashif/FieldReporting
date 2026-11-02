import {Router} from 'express';
import {upload} from '../middleware/upload';
import {
  createReportController,
  getReportsController,
  getReportByIdController,
  resetReportsController,
} from '../controllers/reportController';

const router = Router();

router.post('/', upload.array('images', 5), createReportController);
router.get('/', getReportsController);
router.get('/:id', getReportByIdController);
router.delete('/', resetReportsController);
router.post('/reset', resetReportsController);

export default router;
