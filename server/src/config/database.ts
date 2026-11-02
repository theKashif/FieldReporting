import mongoose from 'mongoose';

export async function connectDatabase(): Promise<void> {
  const uri =
    process.env.MONGODB_URI ||
    'mongodb://127.0.0.1:27017/field-reporting';

  await mongoose.connect(uri);

  console.log('MongoDB connected successfully.');
}
