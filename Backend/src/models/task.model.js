import mongoose, { Schema } from "mongoose";

const taskSchema = new Schema({
    project: {
        type: Schema.Types.ObjectId,
        ref: 'Project',
        required: true
    },
    assignedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    assignedTo: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    subject: {
        type: String,
        required: true,
        lowercase: true,
        default: 'Assigned Task',
    },
    description: {
        type: String,
        required: true,
        maxlength: 1000,
        trim: true
    },
    status: {
        type: String,
        required: true,
        enum: ['pending', 'in-progress', 'completed', 'cancelled'],
        lowercase: true,
        default: 'pending',
    },
    priority: {
        type: String,
        required: true,
        enum: ['low', 'medium', 'high'],
        lowercase: true,
        default: 'medium',
    },
    dueDate: {
        type: Date,
        required: true
    },
    completedAt: {
        type: Date,
        default: null
    },
    attachments: [
        {
            type: String,  // URL or path to the attachment
            required: false,
            trim: true
        }
    ]
}, { timestamps: true });

taskSchema.index({ project: 1, member: 1 , role: 1, createdAt: -1 });

export const Task = mongoose.model("Task", taskSchema);