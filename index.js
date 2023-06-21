const express = require('express')
const app = express()
const   jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()


//PAYMENT
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY);




const cors = require('cors');
const port = process.env.PORT || 5000;


//middleware
app.use(cors())
app.use(express.json())

//verify jwt token
const verifyJWT=(req,res,next)=>{
    const authorization=req.headers.authorization;//user comes or not properly
   
    //if not come authorization header
    if(!authorization){
        //return with status and error message
        return res.status(401).send({error:true,message:'unauthorized access'});
    }

    //if come then get the token using split
    //bearer token
    const token=authorization.split(' ')[1];

    //then verify the token
    jwt.verify(token,process.env.ACCESS_TOKEN_SECRET,(err,decoded)=>{
        if(err){
            return res.status(401).send({error:true,message:'unauthorized access'});
        }
        req.decoded=decoded;
        next();
    })
}

//-----------------------------------------------------------




const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.843endu.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();


        //----------------------code stat-----------
        const menuCollection = client.db("bistroDb").collection('menu');
        const usersCollection = client.db("bistroDb").collection('users');
        const reviewCollection = client.db("bistroDb").collection('reviews');
        const cartCollection = client.db("bistroDb").collection('cart');


        //verify admin
        const verifyAdmin=async(req,res,next)=>{
            const email=req.decoded.email;
            const query={email:email};
            const user=await usersCollection.findOne(query);
            if(user?.role !=='admin'){
                return res.status(403).send({error:TextTrackCue,message:'forbidden access'});
            }
            next();
        }




        //JWT 
        app.post('/jwt',(req,res)=>{
            const user=req.body;//get user
            //create token
            const token=jwt.sign(user, process.env.ACCESS_TOKEN_SECRET,{expiresIn:'1h'});
            res.send({token});
        })


        //step 1: verifyJWT


        //all user related api
        //find specific user
        app.get('/users',verifyJWT,verifyAdmin, async (req, res) => {
            const result = await usersCollection.find().toArray();
            res.send(result);
        })



        //create a user
        app.post('/users', async (req, res) => {
            const user = req.body;
            const query = { email: user.email };
            const existingUser = await usersCollection.findOne(query);
            if (existingUser) {
                return res.send({ message: 'User already Exist' });
            }
            const result = await usersCollection.insertOne(user);
            res.send(result);
        })

        //update user role using patch
        app.patch('/users/admin/:id', async (req, res) => {
            const id = req.params.id;
            console.log(id);

            const filter = { _id: new ObjectId(id) };
            const updateUser = {
                $set: {
                    role: 'admin'
                }
            }
            const result = await usersCollection.updateOne(filter, updateUser);
            res.send(result);

        })
        //delete specific user from dashboard
        app.delete('/user/admin/:id', async (req, res) => {
            const deletedId = req.params.id;
            const query = { _id: new ObjectId(deletedId) };
            const result = await usersCollection.deleteOne(query);
            res.send(result);
        })




        //menu related api
        app.get('/menu', async (req, res) => {
            const result = await menuCollection.find().toArray();
            res.send(result);
        })

        //add new item in the menu collection
        app.post('/menu',verifyJWT,verifyAdmin, async (req, res) => {
            const newItem = req.body;
            const result = await menuCollection.insertOne(newItem);
            res.send(result);
        })
        
        //delete menu api
        app.delete('/menu/:id',verifyJWT,verifyAdmin, async (req, res) => {
            const deletedId = req.params.id;
            const query = { _id: new ObjectId(deletedId) };
            const result = await menuCollection.deleteOne(query);
            res.send(result);
        })




        //review related api
        app.get('/review', async (req, res) => {
            const result = await reviewCollection.find().toArray();
            res.send(result);
        })



        //cart collection
        app.post('/carts', async (req, res) => {
            const item = req.body;
            console.log(item);
            const result = await cartCollection.insertOne(item);
            res.send(result);
        })


        //get specific user cart product
        app.get('/carts',verifyJWT, async (req, res) => {
            const email = req.query.email;
            console.log(email);
            if (!email) {
                res.send([]);
            }
      
            //get email from verifyJWT function
            const decodedEmail=req.decoded.email;

            //if query email and decoded email doesnt match give error
            if(email!==decodedEmail){
                return res.status(403).send({error:true,message:'Forbidden access'})
            }


                //find multiple document
                const query = { email: email };
                const result = await cartCollection.find(query).toArray();
                res.send(result);
          
        })



        //delete specific user cart product
        app.delete('/carts/:id', async (req, res) => {
            const deletedId = req.params.id;
            const query = { _id: new ObjectId(deletedId) };
            const result = await cartCollection.deleteOne(query);
            res.send(result);
        })


        //users admin or not
        //security level 1: verifyJWT
        //email same
        //check admin role
        app.get('/users/admin/:email',verifyJWT, async(req,res)=>{
            const email=req.params.email;

            if(req.decoded.email!==email){
                res.send({admin:false})
            }


            const query={email:email};
            const user=await usersCollection.findOne(query);
            const result={admin: user?.role==='admin'};
            res.send(result);
  

        })








        //payment api
        //create payment intent
        app.post('/create-payment-intent',verifyJWT, async(req,res)=>{
            const {price}=req.body;
            const newPrice=parseFloat(price)
            const amount=newPrice*100;
            console.log(typeof amount);
            console.log(typeof price);
            console.log(typeof newPrice);

            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: "usd",
                payment_method_types:['card']
      
            });

            res.send({
                clientSecret:paymentIntent.client_secret
            })

        })







        //----------------------code end-----------

        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);








































//-------------------------------------------------------------





app.get('/', (req, res) => {
    res.send('Bistro Boss is running')
})

app.listen(port, () => {
    console.log(`Running at port is ${port}`);
})


