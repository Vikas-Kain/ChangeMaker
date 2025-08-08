import mongoose, { Schema } from "mongoose";

const commentSchema = new Schema({
    parentType: {
        type: String,
        enum: ['Project', 'Task', 'Post'],
        required: true,
    },
    parentId: {
        type: Schema.Types.ObjectId,
        refPath: 'parentType',
        required: true,
    },
    commentator: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    comment: {
        type: String,
        required: true,
        maxlength: 500,
        trim: true
    },
    parentCommentId: {
        type: Schema.Types.ObjectId,
        ref: 'Comment',
        default: null
    },
    deleted: {
        type: Boolean,
        default: false
    },
}, { timestamps: true });

commentSchema.index({ parentId: 1, parentType: 1, parentCommentId: 1, createdAt: -1 });

export const Comment = mongoose.model("Comment", commentSchema);