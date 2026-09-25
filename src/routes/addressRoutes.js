const router = require('express').Router();
const controller = require('../controllers/addressController');

router.get('/user/:userId', controller.list);
router.post('/user/:userId/import', controller.importLegacy);
router.post('/user/:userId', controller.create);
router.put('/user/:userId/:addressId/default', controller.setDefault);
router.put('/user/:userId/:addressId', controller.update);
router.delete('/user/:userId/:addressId', controller.remove);

module.exports = router;
