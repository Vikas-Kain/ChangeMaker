import mongoose, { Schema } from "mongoose";

const postSchema = new Schema({
    title: {
        type: String,
        required: true,
        trim: true,
    },
    content: {
        type: String,
        required: true,
        trim: true,
        maxlength: 5000, // limit content length
    },
    author: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    mediaFiles: [
        {
            type: String, // cloudinary url
            required: true
        }
    ],
    linkedProject: [
        {
            type: Schema.Types.ObjectId,
            ref: 'Project',
        }
    ]
}, { timestamps: true });

postSchema.index({ title: 'text', content: 'text' });
postSchema.index({ createdAt: -1 }); // for sorting by creation date

export const Post = mongoose.model("Post", postSchema);