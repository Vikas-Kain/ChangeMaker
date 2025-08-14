import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import {
    getUserProfileService, updateUserDetailsService, updateUserImageService, followUserService,
    unfollowUserService, getFollowersService, getFollowingsService
} from "../services/user.service.js"


const sanitizeUser = (user) => {
    const sanitizedUser = user.toObject();
    delete sanitizedUser.password;
    delete sanitizedUser.refreshToken;
    return sanitizedUser;
}


const getCurrentUser = asyncHandler(async (req, res) => {
    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                {
                    user: sanitizeUser(req.user)
                },
                "Current user fetched successfully")
        );
});

const updateUserDetails = asyncHandler(async (req, res) => {
    const updatedUser = await updateUserDetailsService(req.user?._id, req.body);

    if (!updatedUser) {
        throw new ApiError(error.statusCode || 500, error.message || "Failed to update user details");
    }

    return res
        .status(200)
        .json(
            new ApiResponse(200,
                {
                    user: sanitizeUser(updatedUser)
                },
                "User details updated successfully"
            )
        );
});

const updateUserAvatar = asyncHandler(async (req, res) => {
    const updatedUser = await updateUserImageService(req.user?._id, req.file?.path, "avatar");

    if (!updatedUser) {
        throw new ApiError(error.statusCode || 500, error.message || "Failed to update user avatar");
    }

    return res
        .status(200)
        .json(
            new ApiResponse(200, {
                user: sanitizeUser(updatedUser)
            },
                "Avatar updated successfully")
        )
});

const updateUserCoverImage = asyncHandler(async (req, res) => {
    const updatedUser = await updateUserImageService(req.user?._id, req.file?.path, "coverImage");

    if (!updatedUser) {
        throw new ApiError(error.statusCode || 500, error.message || "Failed to update user coverImage");
    }

    return res
        .status(200)
        .json(
            new ApiResponse(200, {
                user: sanitizeUser(updatedUser)
            },
                "cover Image updated successfully")
        )
});

const getUserProfile = asyncHandler(async (req, res) => {

    const profile = await getUserProfileService(req.user?._id, req.params?.username);

    if (!profile) {
        throw new ApiError(404, "User not found");
    }

    return res
        .status(200)
        .json(
            new ApiResponse(200, profile, "User profile fetched successfully")
        );
});

const followUser = asyncHandler(async (req, res) => {

    const follow = followUserService(req.user?._id, req.params?.username);

    if (!follow) {
        throw new ApiError(500, "Failed to create follow relationship");
    }

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                {
                    followId: follow._id,
                    follower: follow.follower,
                    following: follow.following
                },
                "User followed successfully")
        );
});

const unfollowUser = asyncHandler(async (req, res) => {

    await unfollowUserService(req.user?._id, req.params?.username);

    return res
        .status(200)
        .json(
            new ApiResponse(200, {}, "User unfollowed successfully")
        );
});

const getFollowers = asyncHandler(async (req, res) => {

    const followers = await getFollowersService(req.params?.username);

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                {
                    followers: followers,
                    count: followers.length
                },
                "Followers fetched successfully"
            )
        );
});

const getFollowings = asyncHandler(async (req, res) => {

    const following = await getFollowingsService(req.params?.username);

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                {
                    following: following,
                    count: following.length
                },
                "Following fetched successfully"
            )
        );
});


export {
    getCurrentUser, updateUserDetails, updateUserAvatar, updateUserCoverImage, getUserProfile,
    followUser, unfollowUser, getFollowers, getFollowings
}