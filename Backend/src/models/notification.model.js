import mongoose, { Schema } from "mongoose";

const notificationSchema = new Schema({
    recipient: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    type: {
        type: String,
        enum: ['Project', 'Task', 'Post', 'ProjectChat'],
        required: true
    },
    entityId: { // the project/task/post that triggered this
        type: Schema.Types.ObjectId,
        refPath: 'type',
        required: true
    },
    message: {
        type: String,
        required: true,
        maxlength: 500,
        trim: true
    },
    metadata: {
        type: Schema.Types.Mixed, // to store additional data if needed
        default: {}
    },
    read: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

notificationSchema.index({ recipient: 1, read: 1, createdAt: -1 });

export const Notification = mongoose.model("Notification", notificationSchema);