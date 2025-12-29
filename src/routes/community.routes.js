const express = require('express');
const router = express.Router();
const communityController = require('../controllers/community.controller');
const auth = require('../middleware/auth');

router.get('/posts', communityController.getPosts);
router.post('/posts', auth.protect, communityController.createPost);
router.post('/posts/:id/like', auth.protect, communityController.likePost);

module.exports = router;
