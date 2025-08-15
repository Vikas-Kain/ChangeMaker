import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { 
    registerUserService, loginUserService, logoutUserService, refreshAccessTokenService, changePasswordService
} from "../services/auth.services.js";



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

    if (!user || !accessToken || !refreshToken) {
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


export { registerUser, loginUser, logoutUser, refreshAccessToken, changePassword }