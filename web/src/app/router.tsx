import { createBrowserRouter } from "react-router-dom";
import { HomeRoute } from "@/routes/HomeRoute";
import { HazardPuzzleRoute } from "@/routes/HazardPuzzleRoute";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <HomeRoute />
  },
  {
    path: "/hazard-puzzle",
    element: <HazardPuzzleRoute />
  }
]);

