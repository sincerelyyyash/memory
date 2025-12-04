import Express from "express"

const app = Express();
const PORT = process.env.PORT ?? 8000;


app.listen(PORT, ()=> {
    console.log("Memory Engine is running on port: " + PORT);
})