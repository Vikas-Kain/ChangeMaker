import mongoose, { Schema } from "mongoose";

const projectChatSchema = new Schema({
    project: {
        type: Schema.Types.ObjectId,
        ref: 'Project',
        required: true,
    },
    replyTo: {
        type: Schema.Types.ObjectId,
        ref: 'ProjectChat',
        default: null
    },
    sender: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    message: {
        type: String,
        required: true,
        maxlength: 500,
        trim: true
    },
    attachments: [
        {
            type: String,  // URL or path to the attachment
        }
    ],
    deleted: {
        type: Boolean,
        default: false
    },
}, { timestamps: true });

projectChatSchema.index({ project: 1, createdAt: -1 });

export const ProjectChat = mongoose.model("ProjectChat", projectChatSchema);