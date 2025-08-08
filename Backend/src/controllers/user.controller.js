import { asyncHandler } from "../utils/asyncHandler.js";
import { User } from "../models/user.model.js";

const registerUser = asyncHandler(async (req, res) => {
    return res
    .status(200)
    .json({
        message: "User registration endpoint",
    });
});

export {
    registerUser
};