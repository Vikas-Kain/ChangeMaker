import { ApiError } from "../utils/ApiError";
import { User } from "../models/user.model.js";
import { Follow } from "../models/follow.model.js"
import { uploadFileOnCloudinary } from "../utils/cloudinary.js";
import { deleteFile } from "../utils/deleteFile.js";
import { validateInterests, validateLocationCoordinates } from "../utils/validateField.js";


const changePasswordService = async (userId, reqBody) => {
    try {
        if (!userId) {
            throw new ApiError(401, "Unauthorized: UserId required");
        }
    
        const { oldPassword, newPassword } = reqBody;
    
        if (!oldPassword || !newPassword) {
            throw new ApiError(400, "Old password and new password are required");
        }
    
        if (oldPassword === newPassword) {
            throw new ApiError(400, "New password must be different from old password");
        }
    
        if (newPassword.length < 6) {
            throw new ApiError(400, "New password must be at least 6 characters long");
        }
    
        const user = await User.findById(userId);
        if (!user) {
            throw new ApiError(404, "User not found");
        }
    
        const isOldPasswordCorrect = await user.comparePassword(oldPassword);
        if (!isOldPasswordCorrect) {
            throw new ApiError(401, "Old password is incorrect");
        }
    
        user.password = newPassword;
        await user.save();
    
        return user;
    } catch (error) {
        throw new ApiError(error.statusCode || 500, error.message || "Failed to change password")
    }
}

const updateUserDetailsService = async (userId, reqBody) => {
    try {
        if (!userId) {
            throw new ApiError(401, "Unauthorized: User not found");
        }
    
        const fullname = reqBody.fullname?.trim() || "";
        const bio = reqBody.bio?.trim() || "";
        const location = reqBody.location?.trim() || "";
    
        const locationCoordinates = reqBody.locationCoordinates ? validateLocationCoordinates(reqBody.locationCoordinates) : null;
    
        const interests = reqBody.interests ? reqBody.interests.split(',').map(interest => interest.trim().toLowerCase()) : [];
        if (interests.length > 0) {
            validateInterests(interests);
        }
    
        if ((!fullname || fullname.length == 0) && (!bio || bio.length == 0) && (!location || location.length == 0) && !locationCoordinates && interests.length == 0) {
            throw new ApiError(400, "At least one field required")
        }
    
        const user = await User.findById(userId);

        if (!user) {
            throw new ApiError(404, "Unauthorized: User not found");
        }
    
        // update user details
        user.fullname = fullname?.length > 0 ? fullname : user.fullname;
        user.bio = bio?.length > 0 ? bio : user.bio;
        user.location = location?.length > 0 ? location : user.location;
        user.locationCoordinates = locationCoordinates ? {
            type: "Point",
            coordinates: locationCoordinates
        } : user.locationCoordinates;
        user.interests = interests.length > 0 ? interests : user.interests;
    
        const updatedUser = await user.save({ validateBeforeSave: false }); // skip validation for this update
    
        return updatedUser;
    } catch (error) {
        throw new ApiError(error.statusCode || 500, error.message || "Failed to update user details")
    }
}

const updateUserImageService = async (userId, imageLocalPath, imageType) => {
    try {
        if (!imageLocalPath) {
            throw new ApiError(400, "Image file required")
        }
        if ( !userId ) {
            await deleteFile(imageLocalPath)
            throw new ApiError(400, "Unauthorized User, user _id required")
        }
    
        // upload on cloudinary
        const image = await uploadFileOnCloudinary(imageLocalPath)
    
        if (!image.url) {
            throw new ApiError(500, "Error uploading image file on cloudinary")
        }

        const update = imageType === "avatar" ? { avatar : image.url } : { coverImage : image.url }
    
        const updatedUser = await User.findByIdAndUpdate(userId,
            {
                $set: update
            },
            { new: true }
        ).select("-password -refreshToken")

        return updatedUser;
    } catch (error) {
        throw new ApiError(error.statusCode || 500, error.message || "Failed to update user image")
    }
}

const getUserProfileService = async (username) => {
    try{
        if (!username || username == "") {
            throw new ApiError(400, "Username is required");
        }

        const profile = await User.aggregate([
            {
                $match: {
                    username: username
                }
            },
            {
                $lookup: {
                    from: "projects",
                    localField: "_id",
                    foreignField: "owner",
                    as: "ownProjects"
                }
            },
            {
                $lookup: {
                    from: "posts",
                    localField: "_id",
                    foreignField: "author",
                    as: "userPosts"
                }
            },
            {
                $lookup: {
                    from: "members",
                    localField: "_id",
                    foreignField: "member",
                    as: "joinedProjects"
                }
            },
            {
                $lookup: {
                    from: "follows",
                    localField: "_id",
                    foreignField: "following",
                    as: "followers"
                }
            },
            {
                $lookup: {
                    from: "follows",
                    localField: "_id",
                    foreignField: "follower",
                    as: "following"
                }
            },
            {
                $addFields: {
                    followersCount: { $size: "$followers" },
                    followingCount: { $size: "$following" },
                    isFollowing: {
                        $cond: {
                            if: { $in: [req.user._id, "$followers.follower"] },
                            then: true,
                            else: false
                        }
                    }
                }
            },
            {
                $project: {
                    password: 0,
                    refreshToken: 0,
                    __v: 0,
                    followers: 0,
                    following: 0
                }
            }
        ]);

        if ( !profile?.length ) {
            throw new ApiError(500, `User with username : ${username} could not be found`)
        }

        return profile[0]
    }
    catch (error) {
        throw new ApiError(500, `Couldn't fetch user with username : ${username}`)
    }
}

const followUserService = async (userToFollowId, currentUserId) => {
    try {
        if (!currentUserId) {
            throw new ApiError(400, "Unauthorized: user Id required");
        }
        if (!userToFollowId) {
            throw new ApiError(400, "User ID to follow is required");
        }

        // Check if trying to follow self
        if (currentUserId.toString() === userToFollowId.toString()) {
            throw new ApiError(400, "You cannot follow yourself");
        }
    
        // Check if user to follow exists
        const userToFollow = await User.findById(userToFollowId);
        if (!userToFollow) {
            throw new ApiError(404, "User to follow not found");
        }
    
        // Check if already following
        const existingFollow = await Follow.findOne({
            follower: currentUserId,
            following: userToFollowId
        });
    
        if (existingFollow) {
            throw new ApiError(400, "You are already following this user");
        }
    
        // Create follow relationship
        const follow = await Follow.create({
            follower: currentUserId,
            following: userToFollowId
        });

        return follow
    } catch (error) {
        throw new ApiError(500, "Could not follow user");
    }
}

const unfollowUserService = async (userToUnfollowId, currentUserId) => {
    try {
        if (!currentUserId) {
            throw new ApiError(400, "Unauthorized: user Id required");
        }
        if (!userToUnfollowId) {
            throw new ApiError(400, "User ID to unfollow is required");
        }

        // Check if trying to unfollow self
        if (currentUserId.toString() === userToUnfollowId.toString()) {
            throw new ApiError(400, "You cannot unfollow yourself");
        }
    
        // Check if user to unfollow exists
        const userToUnfollow = await User.findById(userToUnfollowId);
        if (!userToUnfollow) {
            throw new ApiError(404, "User to unfollow not found");
        }
    
        // Check if already following
        const existingFollow = await Follow.findOne({
            follower: currentUserId,
            following: userToUnfollowId
        });
    
        if (!existingFollow) {
            throw new ApiError(400, "You are not following this user");
        }
    
        // Delete the follow relationship
        await Follow.findOneAndDelete({
            follower: currentUserId,
            following: userToUnfollowId
        });

        const stillFollowing = await Follow.findOne({
            follower: currentUserId,
            following: userToUnfollowId
        });

        if ( stillFollowing ) {
            throw new ApiError(500, "Failed to unfollow User")
        }
    } catch (error) {
        throw new ApiError(error.statusCode || 500, error.message || "Failed to unfollow User")
    }
}


export { changePasswordService, updateUserDetailsService, updateUserImageService, getUserProfileService,
    followUserService, unfollowUserService
 }