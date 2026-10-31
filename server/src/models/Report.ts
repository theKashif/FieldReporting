import mongoose, {Schema, Document} from 'mongoose';

export interface ReportImage {
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
}

export interface IReport extends Document {
  reportId: string;
  description: string;
  images: ReportImage[];
  createdAt: Date;
}

const imageSchema = new Schema<ReportImage>(
  {
    filename: {type: String, required: true},
    originalName: {type: String, required: true},
    mimeType: {type: String, required: true},
    size: {type: Number, required: true},
  },
  {_id: false},
);

const reportSchema = new Schema<IReport>(
  {
    reportId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    images: {
      type: [imageSchema],
      required: true,
      validate: {
        validator: (images: ReportImage[]) =>
          images.length >= 1 && images.length <= 5,
        message: 'A report must contain between 1 and 5 images.',
      },
    },
  },
  {timestamps: {createdAt: true, updatedAt: false}},
);

export const Report = mongoose.model<IReport>('Report', reportSchema);