const Session = require("../models/Session");
const Question = require("../models/Question");

//@desc Create a new session and linked questions
// @route Post/api/sessions/create
// @access private

exports.createSession = async (req, res) =>{
    try{

        const {role, experience, topicsToFocus, description, questions} =
        req.body;

        const userId = req.user._id; // Assuming you have a middleware setting req.user

        const session = await Session.create({
            user: userId,
            role,
            experience,
            topicsToFocus,
            description,
        });

            const questionDocs = await Promise.all(
                questions.map( async(q) =>{
                    const question = await Question.create({
                        session: session._id,
                        question: q.question,
                        answer: q.answer,
                    });
                    return question._id;
                })
            );

            session.questions = questionDocs;
            await session.save();

            res.status(201).json({ success: true, session});
    }
    catch(error)
    {
        res.status(500).json({success: false, message:"Server Error"});
    }
};

// @desc Get all sessions for the loogged in user
// @route Get/api/sessions/my-sessions
// @access Private

exports.getMySessions = async (req, res ) =>{
    try{

        const sessions = await Session.find({user: req.user._id})
        .sort({createdAt: -1})
         .populate("questions");
//console.log("Sessions:", JSON.stringify(sessions, null, 2));
         res.status(200).json(sessions);
    }
    catch(error)
    {
        res.status(500).json({success:false, message:"Server Error"});
    }
};

// @desc      Get a single session
// @route     GET /api/v1/sessions/:id
// @access    Private

exports.getSessionById = async (req, res) => {
    try {
        const session = await Session.findById(req.params.id)
            .populate({
                path: "questions",
                options: { sort: { isPinned: -1, createdAt: 1 } },
            })
            .exec();

        if (!session) {
            return res
                .status(404)
                .json({ success: false, message: "Session not found" });
        }

        res.status(200).json({ success: true, session });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server Error" });
    }
};
// @desc Delete a session and its questions
// @route Delete/api/sessions/:id
// @access Private

// @access  Private
exports.deleteSession = async (req, res) => {
    try {
        const session = await Session.findById(req.params.id);

        if (!session) {
            return res.status(404).json({ message: "Session not found" });
        }

        // Check Kro kya loogged-in wale user ne session ko own kiya h 
        if (session.user.toString() !== req.user.id) {
            return res
                .status(401)
                .json({ message: "Not authorized to delete this session" });
        }

        // First, delete all questions linked to this session
        await Question.deleteMany({ session: session._id });

        // Then, delete the session
        await session.deleteOne();
        
        res.status(200).json({message: "Session deleted successfully"});
    } catch (error) {
        res.status(500).json({ success: false, message: "Server Error" });
    }
};

