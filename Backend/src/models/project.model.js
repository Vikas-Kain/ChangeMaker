import mongoose, { Schema } from "mongoose";

const projectSchema = new Schema({
    title: {
        type: String,
        required: true,
        trim: true,
    },
    description: {
        type: String,
        required: true,
        trim: true,
    },
    owner: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    coverImage: {
        type: String, // cloudinary url
        required: true
    },
    tags: [
        {
            type: String,
            enum: ['environment', 'education', 'health', 'community', 'technology', 'other'],
            trim: true,
            lowercase: true
        }
    ],
    location: {
        type: String,
        lowercase: true,
        trim: true,
        required: true,
    },
    locationCoordinates: {
        type: {
            type: String,  // 'Point'
            enum: ['Point'],
        },
        coordinates: {
            type: [Number],  // [longitude, latitude]
            validate: {
                validator: function (value) {
                    return value.length === 2;
                },
                message: 'Coordinates must be an array of [lng, lat]'
            },
            index: "2dsphere"  // for geospatial queries
        }
    },
    volunteerRequired: {
        type: Boolean,
        default: false,
        index: true
    },
    milestones: [
        {
            title: {
                type: String,
                required: true
            },
            description: {
                type: String,
                required: true
            },
            dueDate: {
                type: Date,
                required: true
            },
            completed: {
                type: Boolean,
                default: false
            },
            completedAt: {
                type: Date
            }
        }
    ],
    progress: {
        type: Number,   // percentage of milestones completed
        default: 0,
        min: 0,
        max: 100
    },
    status: {
        type: String,
        enum: ['draft', 'active', 'completed', 'cancelled'],
        default: 'draft',
        index: true
    },
    endDate: {
        type: Date,
    },
}, { timestamps: true });

projectSchema.index({ title: 'text', tags: 'text', location: 'text', createdAt: -1 });

projectSchema.virtual('progress').get( function() {
    if (!this.milestones || this.milestones.length === 0) return 0;

    const completedMilestones = this.milestones.filter(m => m.completed).length;
    return Math.round( (completedMilestones / this.milestones.length) * 100 );
})

projectSchema.set('toJSON', {
    virtuals: true
})

export const Project = mongoose.model('Project', projectSchema);