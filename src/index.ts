import Express from "express";
import memoryRoutes from "./routes/memory.routes";

const app = Express();
const PORT = process.env.PORT ?? 8000;

app.use(Express.json());


app.use("/api", memoryRoutes);

app.listen(PORT, ()=> {
    console.log("Memory Engine is running on port: " + PORT);
})