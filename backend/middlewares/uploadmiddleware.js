const multer = require('multer');
const path = require('path');

//cONFigure storAge

const storage = multer.diskStorage({
    destination:(req, file, cb) => {
        cb(null, 'uploads/');
    },

    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname); // ✅ get extension
        cb(null, Date.now() + ext); // ✅ add extension
    }

});

// File filter
const fileFilter = (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    if(allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    }
    else{
        cb(new Error('Only .jpeg, .jpg and .png formats are allowed'), false);

    }
    };

    const upload = multer({storage, fileFilter});
module.exports = upload;