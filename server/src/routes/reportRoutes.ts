import {Router} from 'express';
import {upload} from '../middleware/upload';
import {
  createReportController,
  getReportsController,
} from '../controllers/reportController';

const router = Router();

router.post('/', upload.array('images', 5), createReportController);
router.get('/', getReportsController);

export default router;