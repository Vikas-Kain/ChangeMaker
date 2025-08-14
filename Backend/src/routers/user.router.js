import { Router } from 'express';
import {
    changePassword, getCurrentUser, loginUser, logoutUser, refreshAccessToken, registerUser,
    updateUserAvatar, updateUserCoverImage, updateUserDetails, getUserProfile, followUser, unfollowUser,
    getFollowers, getFollowings
} from '../controllers/user.controller.js';
import { upload } from '../middlewares/multer.middleware.js';
import { verifyJWT } from '../middlewares/auth.middleware.js';

const router = Router();

router.route('/register').post(upload.fields([
    {
        name: 'avatar',
        maxCount: 1
    },
    {
        name: 'coverImage',
        maxCount: 1
    }
]), registerUser);

router.route('/login').post(loginUser);

router.route('/logout').post(verifyJWT, logoutUser);

router.route('/refresh-token').post(refreshAccessToken);

router.route('/change-password').post(verifyJWT, changePassword);

router.route('/current-user').get(verifyJWT, getCurrentUser);

router.route('/update-details').post(verifyJWT, updateUserDetails);

router.route('/update-avatar').post(verifyJWT, upload.single("avatar"), updateUserAvatar);

router.route('/update-cover-image').post(verifyJWT, upload.single("coverImage"), updateUserCoverImage);

router.route('/profile/:username').get(verifyJWT, getUserProfile);

router.route('/follow/:username').post(verifyJWT, followUser);

router.route('/unfollow/:username').post(verifyJWT, unfollowUser);

router.route('/followers/:username').get(getFollowers);

router.route('/followings/:username').get(getFollowings);

export default router;