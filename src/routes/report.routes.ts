import { Router } from 'express';
import { createReport, deleteReport, listReports, updateReport } from '../controllers/report.controller.js';
import { authenticate } from '../middleware/authenticate.middleware.js';
import { upload } from '../middleware/upload.js';

export const reportRouter = Router();

reportRouter.get('/', authenticate, listReports);
// Multer stores up to five evidence images before createReport runs.
reportRouter.post(
  '/',
  authenticate,
  upload.array('evidence', 5),
  createReport
);
reportRouter.patch('/:id', authenticate, updateReport);
reportRouter.delete('/:id', authenticate, deleteReport);
