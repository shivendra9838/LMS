const app = require('./app');
const connectDB = require('./config/db');
const { PORT } = require('./config/env');

connectDB();

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
