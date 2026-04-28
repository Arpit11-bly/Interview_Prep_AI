require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const connectDB = require("./config/db");


const authRoutes = require('./routes/authRoutes');
const sessionRoutes = require('./routes/sessionRoutes');
const questionRoutes = require('./routes/questionRoutes');
const coachRoutes = require('./routes/coachRoutes');
const adminRoutes = require('./routes/adminRoutes');
const { protect } = require("./middlewares/authmiddleware");
const { generateInterviewQuestions, generateConceptExplanation } = require("./controllers/aiControllerFixed");
// const { protect } = require("./middlewares/authMiddleware");
// const{ generateInterviewQuestions,generateConceptExplanation} = require("./controllers/aiController");

const app = express();
// Middleware to handle CORS
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Middleware
app.use(express.json());



// Routes
app.use("/api/auth", authRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/questions', questionRoutes);
app.use("/api/coach", coachRoutes);
app.use("/api/admin", adminRoutes);

app.post("/api/ai/generate-questions", protect, generateInterviewQuestions);
app.post("/api/ai/generate-explanation", protect, generateConceptExplanation);

// Serve uploads folder
app.use("/uploads", express.static(path.join(__dirname, "uploads"), {}));

// Start Server only after DB is connected
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  } catch (error) {
    console.error("Failed to start server", error);
    process.exit(1);
  }
};

startServer();


