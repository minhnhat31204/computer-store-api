const router = require('express').Router();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const c = require('../controllers/userController');
const userController = require('../controllers/userController');
const { authenticateToken, requireAdmin } = require('../middlewares/authMiddleware');
const { uploadLimiter } = require('../middlewares/rateLimiter');

const uploadDir = path.resolve(__dirname, '../../uploads');
fs.mkdirSync(uploadDir, { recursive: true });
const uploadAvatar = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.mimetype)) {
      return cb(new Error('Ảnh đại diện phải là JPG, PNG, WEBP hoặc GIF.'));
    }
    cb(null, true);
  },
});

function parseAvatar(req, res, next) {
  uploadAvatar.single('avatar')(req, res, (error) => {
    if (error) {
      const status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
      return res.status(status).json({ error: error.code === 'LIMIT_FILE_SIZE' ? 'Ảnh đại diện tối đa 5 MB.' : error.message });
    }
    next();
  });
}

router.get('/', authenticateToken, requireAdmin, c.getAll);
router.post('/', authenticateToken, requireAdmin, c.create);
function conditionalUploadLimiter(req, res, next) {
  // Chi ap dung gioi han upload khi nguoi dung thuc su tai len anh dai dien moi
  if (req.file) {
    return uploadLimiter(req, res, next);
  }
  next();
}

router.put('/:id/profile', authenticateToken, parseAvatar, conditionalUploadLimiter, c.updateProfile);
router.put('/:id', authenticateToken, c.update);
router.put('/:id/role', authenticateToken, requireAdmin, c.updateRole);
router.delete('/:id', authenticateToken, requireAdmin, c.delete);
router.post('/check-phone', userController.checkPhone);

module.exports = router;
