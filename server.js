const express = require("express");
const app = express();
const cors = require("cors");
const { MongoClient } = require("mongodb");
require("dotenv").config();
const ObjectId = require("mongodb").ObjectId;
const admin = require("firebase-admin");

const port = process.env.PORT || 5000;

var serviceAccount = require("./camera-house-e359b-firebase-adminsdk-vrm75-c09fee44b6.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.fobb8.mongodb.net/${process.env.DB_DATABASE}?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function verifyToken(req, res, next) {
  if (req.headers?.authorization?.startsWith("Bearer ")) {
    const token = req.headers.authorization.split(" ")[1];
    try {
      const decodedUser = await admin.auth().verifyIdToken(token);
      req.decodedEmail = decodedUser.email;
    } catch {}
  }
  next();
}

async function run() {
  try {
    await client.connect();
    const database = client.db("camera-house");
    const productsCollection = database.collection("products");
    const ordersCollection = database.collection("orders");
    const usersCollection = database.collection("users");
    const reviewsCollection = database.collection("reviews");

    // Get all products or single product by id
    app.get("/products", async (req, res) => {
      let query = {};
      if (!req.query.id) {
        query = {};
        const cursor = productsCollection.find(query);
        const result = await cursor.toArray();
        res.json(result);
      } else {
        const id = req.query.id;
        query = { _id: ObjectId(id) };
        const cursor = await productsCollection.findOne(query);
        res.json(cursor);
      }
    });

    // add a product
    app.post("/products", async (req, res) => {
      const productInfo = req.body;
      const cursor = await productsCollection.insertOne(productInfo);
      res.json(cursor);
    });

    // delete the product
    app.delete("/products", async (req, res) => {
      const id = req.body.id;
      const query = { _id: ObjectId(id) };
      const result = await productsCollection.deleteOne(query);
      res.json(result);
    });

    // get all order or filtered order
    app.get("/orders", async (req, res) => {
      if (!req.query.email) {
        const query = {};
        const cursor = ordersCollection.find(query);
        const result = await cursor.toArray();
        res.json(result);
      } else {
        const email = req.query.email;
        const query = { ordererEmail: email };
        const cursor = ordersCollection.find(query);
        const result = await cursor.toArray();
        res.json(result);
      }
    });

    // place an order
    app.post("/orders", async (req, res) => {
      const orderInfo = req.body;
      const cursor = await ordersCollection.insertOne(orderInfo);
      res.json(cursor);
    });

    // save user while registration
    app.post("/users", async (req, res) => {
      const user = req.body;
      const result = await usersCollection.insertOne(user);
      res.json(result);
    });

    // check is admin
    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      let isAdmin = false;
      if (user?.role === "admin") {
        isAdmin = true;
      }
      res.json({ admin: isAdmin });
    });

    // make an admin
    app.put("/users/admin", verifyToken, async (req, res) => {
      const user = req.body;
      const requester = req.decodedEmail;
      if (requester) {
        const requesterAccount = await usersCollection.findOne({
          email: requester,
        });
        if (requesterAccount.role === "admin") {
          const filter = { email: user.email };
          const updateDoc = {
            $set: {
              role: "admin",
            },
          };
          const result = await usersCollection.updateOne(filter, updateDoc);
          res.json(result);
        }
      } else {
        res
          .status(403)
          .json({ message: "You do not have access to make admin" });
      }
    });

    // save or update user while google registration
    app.put("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const options = { upsert: true };
      const updateDoc = { $set: user };
      const result = await usersCollection.updateOne(query, updateDoc, options);
      res.json(result);
    });

    // update the status of shipment
    app.put("/orders", async (req, res) => {
      const id = req.body.id;
      const query = { _id: ObjectId(id) };
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          ordererProductShipment: "shipped",
        },
      };
      const result = await ordersCollection.updateOne(
        query,
        updateDoc,
        options
      );
      res.json(result);
    });

    // cancel the shipment
    app.delete("/orders", async (req, res) => {
      const id = req.body.id;
      const query = { _id: ObjectId(id) };
      const result = await ordersCollection.deleteOne(query);
      res.json(result);
    });

    // get all reviews
    app.get("/reviews", async (req, res) => {
      const query = {};
      const cursor = reviewsCollection.find(query);
      const result = await cursor.toArray();
      res.json(result);
    });

    // post the review of user
    app.post("/reviews", async (req, res) => {
      const review = req.body;
      const result = await reviewsCollection.insertOne(review);
      res.json(result);
    });
  } finally {
    // await client.close();
  }
}

run().catch(console.dir);

app.get("/", async (req, res) => {
  res.send("getting data from index.js of camera house");
});

app.listen(port, () => {
  console.log(`listenning at ${port}`);
});
