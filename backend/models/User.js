const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
    {
        name:{type:String, required: true},
        email:{type:String, required:true, unique:true, lowercase: true, trim: true},
        password:{type:String, required:true},
        profileImageUrl:{type:String, default: null},
        assignedPreparationRole: { type: String, default: "" },
        adminNotes: { type: String, default: "" },
        assignedByAdminAt: { type: Date, default: null },
        isActive: { type: Boolean, default: true },
    
    },
    {timestamps: true}
);

module.exports = mongoose.model("User", UserSchema)
