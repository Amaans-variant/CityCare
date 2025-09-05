module.exports = {
  PORT: process.env.PORT || 3001,
  JWT_SECRET: process.env.JWT_SECRET || 'your_jwt_secret_key_here',
  UPLOAD_DIR: process.env.UPLOAD_DIR || 'uploads',
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb+srv://mateen:valhalla@mateen.fqk7zny.mongodb.net/complaint_management?retryWrites=true&w=majority&appName=Mateen'
};
