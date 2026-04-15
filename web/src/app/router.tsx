import { createBrowserRouter } from "react-router-dom";
import { HomeRoute } from "@/routes/HomeRoute";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <HomeRoute />
  }
]);

