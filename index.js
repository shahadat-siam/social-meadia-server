const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const port = process.env.PORT || 5000;

//------ middlewere ----
const corsOptions = {
  origin: [
    "http://localhost:5173",
    "http://localhost:5174",
    "https://friend-nest.web.app",
    "https://friend-nest.firebaseapp.com",
  ],
  credentials: true,
  optionSuccessStatus: 200,
};
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

// Verify Token Middleware
const verifyToken = async (req, res, next) => {
  const token = req.cookies?.token;
  // console.log(token);
  if (!token) {
    return res.status(401).send({ message: "unauthorized access1" });
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      console.log(err);
      return res.status(401).send({ message: "unauthorized access2" });
    }
    req.user = decoded;
    next();
  });
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ot34xl4.mongodb.net/?appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const postsCollection = client.db("FriendNest").collection("posts");

    // auth related api
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "365d",
      });
      res
        .cookie("token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true });
    });

    // Logout
    app.get("/logout", async (req, res) => {
      try {
        res
          .clearCookie("token", {
            maxAge: 0,
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
          })
          .send({ success: true });
        console.log("Logout successful");
      } catch (err) {
        res.status(500).send(err);
      }
    });

    // save post data in db
    app.post("/post", verifyToken, async (req, res) => {
      const postData = req.body;
      const result = await postsCollection.insertOne(postData);
      res.send(result);
    });

    // get all posts from db
    app.get("/posts", async (req, res) => {
      const result = await postsCollection.find().toArray();
      res.send(result);
    });

    // get a user post by email in db
    app.get("/post/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      let query = { email: email };
      const result = await postsCollection.find(query).toArray();
      res.send(result);
    });

    app.delete("/posts/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await postsCollection.deleteOne(query);
      res.send(result);
    });

    // // update data
    app.put("/single-post/:id", async (req, res) => {
      const id = req.params.id;
      const Data = req.body;
      const query = { _id: new ObjectId(id) };
      const option = { upsert: true };
      const updateDoc = {
        $set: {
          ...Data,
        },
      };
      const result = await postsCollection.updateOne(query, updateDoc, option);
      res.send(result);
    });

    app.post("/posts/:postId/like", verifyToken, async (req, res) => {
      const postId = req.params.postId;
      try {
        const updatedPost = await postsCollection.findOneAndUpdate(
          { _id: new ObjectId(postId) },
          { $inc: { likes: 1 } }, // Increment likes by 1
          { returnDocument: "after" }
        );
        res.send(updatedPost.value); // Return updated post
      } catch (error) {
        console.error("Error liking post:", error);
        res.status(500).send({ message: "Error liking post" });
      }
    });

    app.post("/posts/:postId/unlike", verifyToken, async (req, res) => {
      const postId = req.params.postId;
      try {
        const updatedPost = await postsCollection.findOneAndUpdate(
          { _id: new ObjectId(postId), likes: { $gt: 0 } },
          { $inc: { likes: -1 } }, // Decrement likes by 1 (if likes > 0)
          { returnDocument: "after" }
        );
        res.send(updatedPost.value); // Return updated post
      } catch (error) {
        console.error("Error unliking post:", error);
        res.status(500).send({ message: "Error unliking post" });
      }
    });

    app.post("/posts/:postId/comment", verifyToken, async (req, res) => {
      const postId = req.params.postId;
      const newComment = req.body;
      try {
        const updatedPost = await postsCollection.findOneAndUpdate(
          { _id: new ObjectId(postId) },
          { $push: { comments: newComment } }, // Add new comment to comments array
          { returnDocument: "after" }
        );
        res.send(updatedPost.value); // Return updated post
      } catch (error) {
        console.error("Error adding comment:", error);
        res.status(500).send({ message: "Error adding comment" });
      }
    });

    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("social media server calling.");
});

app.listen(port, () => {
  console.log(`social media server on port ${port}`);
});
