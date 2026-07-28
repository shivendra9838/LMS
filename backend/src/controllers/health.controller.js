const checkHealth = (req, res) => {
  res.status(200).json({ status: 'OK' });
};

module.exports = {
  checkHealth
};
