import { asyncHandler } from "../utils/asyncHandler.js";
import { User } from "../models/user.model.js";
import { Follow } from "../models/follow.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { registerUserService, loginUserService, logoutUserService, refreshAccessTokenService } from "../services/auth.services.js";
import { changePasswordService, getUserProfileService, updateUserDetailsService, updateUserImageService,
    getUserProfileService, followUserService,
    unfollowUserService
 } from  "../services/user.service.js"


const sanitizeUser = (user) => {
    const sanitizedUser = user.toObject();
    delete sanitizedUser.password;
    delete sanitizedUser.refreshToken;
    return sanitizedUser;
}


// register user
const registerUser = asyncHandler(async (req, res) => {
    const createdUser = await registerUserService(req.body, req.files);

    if (!createdUser) {
        throw new ApiError(500, "Failed to create user in Database")
    }

    return res
        .status(201)
        .json(
            new ApiResponse(201, sanitizeUser(createdUser), "User Registered Successfully")
        )

});

// login user
const loginUser = asyncHandler(async (req, res) => {
    const { user, accessToken, refreshToken } = await loginUserService(req.body);

    if (!user || !accessToken || !refreshToken) {
        throw new ApiError(500, "Failed to login user")
    }
    
    const options = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production', // set secure flag in production
    }

    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(
                200,
                {
                    user: sanitizeUser(user), accessToken, refreshToken
                },
                "User Logged In Successfully"
            )
        )
});

const logoutUser = asyncHandler(async (req, res) => {
    await logoutUserService(req.user?._id);

    const options = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production', // set secure flag in production
    }

    return res
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(
            new ApiResponse(200, {}, "User logged out successfully")
        )
});

const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies?.refreshToken || req.header("Authorization")?.replace("Bearer ", "");

    const { user, accessToken, refreshToken } = await refreshAccessTokenService(incomingRefreshToken);

    if (!user || !accessToken || !refreshToken ) {
        throw new ApiError(500, "Failed to refresh access token")
    }

    const options = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production', // set secure flag in production
    }

    return res
            .status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", refreshToken, options)
            .json(
                new ApiResponse(
                    200,
                    {
                        user: sanitizeUser(user), accessToken, refreshToken
                    },
                    "Access token refreshed successfully")
            );
});

const changePassword = asyncHandler(async (req, res) => {
    const updatedUser = await changePasswordService(req.user?._id, req.body);

    if (!updatedUser) {
        throw new ApiError(error.statusCode || 500, error.message || "Failed to change password")
    }
    
    return res
        .status(200)
        .json(
            new ApiResponse(200,
                {
                    user: sanitizeUser(updatedUser)
                },
                "Password changed successfully")
        );
});

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

    if ( !updatedUser ) {
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

    if ( !updatedUser ) {
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
    const username = req.params.username?.trim().toLowerCase();

    const profile = await getUserProfileService(username);

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
    // Get the user ID to follow from request body or params
    const userToFollowId = req.body.userId || req.params.userId;
    const currentUserId = req.user?._id;
    
    const follow = followUserService(userToFollowId, currentUserId);

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
                    follower: currentUserId,
                    following: userToFollowId
            },
            "User followed successfully")
        );
});

const unfollowUser = asyncHandler(async (req, res) => {
    const userToUnfollowId = req.body.userId;
    const currentUserId = req.user?._id;

    await unfollowUserService(userToUnfollowId, currentUserId);

    return res
        .status(200)
        .json(
            new ApiResponse(200, {}, "User unfollowed successfully")
        );
});


export {
    registerUser, loginUser, logoutUser, refreshAccessToken, changePassword, getCurrentUser,
    updateUserDetails, updateUserAvatar, updateUserCoverImage, getUserProfile, followUser, unfollowUser
}