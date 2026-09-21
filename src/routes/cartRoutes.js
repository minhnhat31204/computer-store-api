const router = require('express').Router();
const c = require('../controllers/cartController');

// Láº¥y toÃ n bá»™ danh sÃ¡ch giá» hÃ ng
router.get('/', c.getAll);

// Láº¥y giá» hÃ ng theo UserID (Gá»i tá»« Flutter: GET /api/cart/1)
router.get('/:userId', c.getByUser);

// ThÃªm sáº£n pháº©m vÃ o giá» (Gá»i tá»« Flutter: POST /api/cart/add)
router.post('/add', c.addToCart);

// Cáº­p nháº­t sá»‘ lÆ°á»£ng (Gá»i tá»« Flutter: PUT /api/cart/update)
router.put('/update', c.update);
router.put('/:id', c.update);

// XÃ³a sáº£n pháº©m khá»i giá» (DELETE /api/cart/:id)
router.delete('/:id', c.delete);

module.exports = router;


