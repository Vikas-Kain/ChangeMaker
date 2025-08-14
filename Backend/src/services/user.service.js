import { ApiError } from "../utils/ApiError";
import { User } from "../models/user.model.js";
import { Follow } from "../models/follow.model.js"
import { uploadFileOnCloudinary } from "../utils/cloudinary.js";
import { deleteFile } from "../utils/deleteFile.js";
import { validateInterests, validateLocationCoordinates } from "../utils/validateField.js";


const updateUserDetailsService = async (userId, reqBody) => {
    try {
        if (!userId) {
            throw new ApiError(401, "Unauthorized: User not found");
        }
        if ( userId != reqBody._id ) {
            throw new ApiError(401, "Unauthorized: User not authorized to update someone else's details");
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

        if (!updatedUser) {
            throw new ApiError(500, "Failed to update user details");
        }

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
        if (!userId) {
            await deleteFile(imageLocalPath)
            throw new ApiError(400, "Unauthorized User, user _id required")
        }

        // upload on cloudinary
        const image = await uploadFileOnCloudinary(imageLocalPath)

        if (!image.url) {
            throw new ApiError(500, "Error uploading image file on cloudinary")
        }

        const update = imageType === "avatar" ? { avatar: image.url } : { coverImage: image.url }

        const updatedUser = await User.findByIdAndUpdate(userId,
            {
                $set: update
            },
            { new: true }
        ).select("-password -refreshToken")

        if (!updatedUser) {
            throw new ApiError(500, "Failed to update user Image");
        }

        return updatedUser;
    } catch (error) {
        throw new ApiError(error.statusCode || 500, error.message || "Failed to update user image")
    }
}

const getUserProfileService = async (currentUserId, username) => {
    try {
        if (!username) {
            throw new ApiError(400, "Username is required")
        }

        const profile = await User.aggregate([
            {
                $match: { username }
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
                            if: { $in: [currentUserId, "$followers.follower"] },
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

        if (!profile?.length) {
            throw new ApiError(500, `User with username : ${username} could not be found`)
        }

        return profile[0]
    }
    catch (error) {
        throw new ApiError(500, `Couldn't fetch user with username : ${username}`)
    }
}

const followUserService = async (currentUserId, userToFollowName) => {
    try {
        if (!currentUserId) {
            throw new ApiError(400, "Unauthorized: user Id required");
        }
        if (!userToFollowName) {
            throw new ApiError(400, "Username to follow is required");
        }

        // Check if user to follow exists
        const userToFollow = await User.find({ username: userToFollowName });
        if (!userToFollow) {
            throw new ApiError(404, "User to follow not found");
        }

        // Check if trying to follow self
        if (currentUserId.toString() === userToFollow._id.toString()) {
            throw new ApiError(400, "You cannot follow yourself");
        }

        // Check if already following
        const existingFollow = await Follow.findOne({
            follower: currentUserId,
            following: userToFollow._id
        });

        if (existingFollow) {
            throw new ApiError(400, "You are already following this user");
        }

        // Create follow relationship
        const follow = await Follow.create({
            follower: currentUserId,
            following: userToFollow._id
        });

        if (!follow) {
            throw new ApiError(500, "Failed to create follow relationship");
        }

        return follow
    } catch (error) {
        throw new ApiError(500, "Could not follow user");
    }
}

const unfollowUserService = async (currentUserId, userToUnfollowName) => {
    try {
        if (!currentUserId) {
            throw new ApiError(400, "Unauthorized: user Id required");
        }
        if (!userToUnfollowName) {
            throw new ApiError(400, "Username to unfollow is required");
        }

        // Check if user to unfollow exists
        const userToUnfollow = await User.find({ username: userToUnfollowName });
        if (!userToUnfollow) {
            throw new ApiError(404, "User to unfollow not found");
        }

        // Check if trying to unfollow self
        if (currentUserId.toString() === userToUnfollow._id.toString()) {
            throw new ApiError(400, "You cannot unfollow yourself");
        }

        // Check if already following
        const existingFollow = await Follow.findOne({
            follower: currentUserId,
            following: userToUnfollow._id
        });

        if (!existingFollow) {
            throw new ApiError(400, "You are not following this user");
        }

        // Delete the follow relationship
        await Follow.findOneAndDelete({
            follower: currentUserId,
            following: userToUnfollow._id
        });

        const stillFollowing = await Follow.findOne({
            follower: currentUserId,
            following: userToUnfollow._id
        });

        if (stillFollowing) {
            throw new ApiError(500, "Failed to unfollow User")
        }
    } catch (error) {
        throw new ApiError(error.statusCode || 500, error.message || "Failed to unfollow User")
    }
}

const getFollowersService = async (username) => {
    try {
        if (!username) {
            throw new ApiError(400, "Username is required");
        }

        // Validate that the user exists
        const user = await User.find({ username });
        if (!user) {
            throw new ApiError(404, "User not found");
        }

        const followerList = await Follow.aggregate([
            {
                $match: {
                    following: user._id
                }
            },
            {
                $lookup: {
                    from: "users",
                    localField: "follower",
                    foreignField: "_id",
                    as: "followers"
                }
            },
            {
                $unwind: "$followers"
            },
            {
                $project: {
                    _id: 1,
                    follower: {
                        _id: "$followers._id",
                        username: "$followers.username",
                        fullname: "$followers.fullname",
                        avatar: "$followers.avatar",
                    },
                    createdAt: 1
                }
            },
            {
                $sort: {
                    createdAt: -1
                }
            }
        ]);

        return followerList;
    } catch (error) {
        throw new ApiError(error.statusCode || 500, error.message || "Failed to fetch followers");
    }
}

const getFollowingsService = async (username) => {
    try {
        if (!username) {
            throw new ApiError(400, "Unauthorized! user id required");
        }

        // Validate that the user exists
        const user = await User.find({ username });
        if (!user) {
            throw new ApiError(404, "User not found");
        }

        const followingList = await Follow.aggregate([
            {
                $match: {
                    follower: user._id
                }
            },
            {
                $lookup: {
                    from: "users",
                    localField: "following",
                    foreignField: "_id",
                    as: "followings"
                }
            },
            {
                $unwind: "$followings"
            },
            {
                $project: {
                    _id: 1,
                    following: {
                        _id: "$followings._id",
                        username: "$followings.username",
                        fullname: "$followings.fullname",
                        avatar: "$followings.avatar",
                    },
                    createdAt: 1
                }
            },
            {
                $sort: {
                    createdAt: -1
                }
            }
        ]);

        return followingList;
    } catch (error) {
        console.log("Error in getFollowingService:", error.message);
        throw new ApiError(error.statusCode || 500, error.message || "Failed to fetch following");
    }
}


export {
    updateUserDetailsService, updateUserImageService, getUserProfileService, followUserService,
    unfollowUserService, getFollowersService, getFollowingsService
}