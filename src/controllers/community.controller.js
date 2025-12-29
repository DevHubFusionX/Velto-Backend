const mockData = require('../data/mockData');

const communityController = {
  getPosts: async (req, res) => {
    res.json(mockData.posts);
  },

  createPost: async (req, res) => {
    const data = req.body;
    res.status(201).json({ message: 'Post created successfully', data });
  },

  likePost: async (req, res) => {
    res.json({ message: 'Post liked' });
  }
};

module.exports = communityController;
