const jwt = require("jsonwebtoken");
const User = require("../models/User");

const getAdminIdentity = () => ({
    id: "admin",
    role: "admin",
    name: process.env.ADMIN_NAME || "Platform Admin",
    email: process.env.ADMIN_LOGIN_ID || "admin",
    profileImageUrl: null,
});

// Middleware to protect routes

const protect = async(req, res, next) => {
    try{
        let token = req.headers.authorization;

        if(token && token.startsWith("Bearer")){
            token = token.split(" ")[1]; //Extract token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            if (decoded?.role === "admin") {
                req.user = getAdminIdentity();
                return next();
            }

            const user = await User.findById(decoded.id).select("-password");
            if (!user) {
                return res.status(401).json({message: "Token failed"});
            }
            if (user.isActive === false) {
                return res.status(403).json({ message: "Your account has been deactivated by admin." });
            }

            req.user = user;
            next();
        }else{
            res.status(401).json({message: "Not authorized, no token"});
        }

    } catch(error) {
        res.status(401).json({message: "Token failed", error: error.message});
    }
};

const requireAdmin = async (req, res, next) => {
    await protect(req, res, () => {
        if (req.user?.role !== "admin") {
            return res.status(403).json({ message: "Admin access only" });
        }
        next();
    });
};

module.exports = {protect, requireAdmin};
